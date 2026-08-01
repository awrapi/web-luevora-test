import React, { useState, useRef, useEffect, useCallback } from 'react';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import Icon from '@/components/shared/Icon';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Singleton FFmpeg instance — loaded once, reused across trims.
// WhatsApp/Meta only accepts MP4 (H.264 + AAC). MediaRecorder can only
// produce WebM, which WhatsApp rejects, so we use FFmpeg.wasm to trim
// AND transcode to MP4 in one pass.
let ffmpegInstance = null;
let ffmpegLoadingPromise = null;
// Mutable progress handler — registered ONCE on the singleton, but the
// active callback is swapped per-trim to avoid accumulating listeners
// (FFmpeg's on() pushes into an array with no dedupe).
let activeProgressHandler = null;

const getFFmpeg = () => {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = `${import.meta.env.BASE_URL}ffmpeg`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    // Register a single progress listener that delegates to the active handler
    ffmpeg.on('progress', ({ progress: p }) => {
      if (activeProgressHandler) activeProgressHandler(p);
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadingPromise;
};

const MediaEditor = ({ file, type, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ ratio: 0, text: '' });

  // Image
  const cropperRef = useRef(null);

  // Video
  const videoRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const fileUrl = React.useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const handleVideoLoaded = useCallback((dur) => {
    if (dur && dur !== Infinity && !isNaN(dur)) {
      setDuration(dur);
      setEndTime(prev => prev === 0 ? dur : prev);
    }
  }, []);

  useEffect(() => {
    if (type === 'video' && videoRef.current) {
      if (videoRef.current.readyState >= 1) {
        handleVideoLoaded(videoRef.current.duration);
      }
    }
  }, [type, fileUrl, handleVideoLoaded]);

  // --- Video Trim using FFmpeg.wasm → output MP4 (H.264/AAC) ---
  // WhatsApp only accepts MP4. MediaRecorder only produces WebM which
  // WhatsApp rejects, so we transcode to MP4 here.
  const handleSaveVideo = async () => {
    const vid = videoRef.current;
    if (!vid) return;

    // No trim needed AND already MP4 → pass through unchanged
    const isAlreadyMp4 = /\.mp4$/i.test(file.name) || file.type === 'video/mp4';
    if (startTime === 0 && endTime === duration && isAlreadyMp4) {
      onSave(file);
      return;
    }

    setLoading(true);
    setProgress({ ratio: 0, text: 'Memuat FFmpeg...' });

    try {
      const ffmpeg = await getFFmpeg();

      const inputExt = (file.name.match(/\.([^.]+)$/) || [, 'mp4'])[1].toLowerCase();
      const inputName = `input.${inputExt === 'webm' ? 'webm' : inputExt === 'mov' ? 'mov' : 'mp4'}`;
      const outputName = 'output.mp4';

      setProgress({ ratio: 0.05, text: 'Menyiapkan video...' });
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      // Set the active progress handler (delegated via singleton listener)
      activeProgressHandler = (p) => {
        const ratio = Math.min(Math.max(p, 0.05), 0.98);
        setProgress({
          ratio,
          text: `Memproses video... ${Math.round(ratio * 100)}%`
        });
      };

      setProgress({ ratio: 0.1, text: 'Memotong & mengkonversi ke MP4...' });

      // Build args: trim with -ss/-t, transcode to H.264 + AAC for WhatsApp
      const args = [
        '-ss', startTime.toFixed(2),
        '-i', inputName,
        '-t', (endTime - startTime).toFixed(2),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName,
      ];

      await ffmpeg.exec(args);

      // Clear the handler so stale progress events don't leak into next trim
      activeProgressHandler = null;

      setProgress({ ratio: 0.99, text: 'Menyelesaikan...' });

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const newFile = new File([blob], `${baseName}.mp4`, { type: 'video/mp4' });

      // Cleanup virtual FS
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}

      vid.pause();
      onSave(newFile);
    } catch (err) {
      console.error('[MediaEditor] FFmpeg trim failed:', err);
      alert('Gagal memotong video: ' + (err?.message || 'Coba lagi'));
    } finally {
      activeProgressHandler = null;
      setLoading(false);
    }
  };

  const handleSaveImage = () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;
    setLoading(true);

    // Determine the output format from the original file type.
    // Cropper's toBlob may fall back to image/png if the requested type
    // is unsupported, so we map the extension to match the actual blob type.
    const outType = file.type || 'image/jpeg';
    const extMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const outExt = extMap[outType] || 'jpg';

    cropper.getCroppedCanvas({ maxWidth: 2048, maxHeight: 2048 }).toBlob((blob) => {
      if (!blob) { setLoading(false); return; }
      // Use the ACTUAL blob type (browser may have fallen back to png)
      const actualType = blob.type || outType;
      const actualExt = extMap[actualType] || outExt;
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
      const newFile = new File([blob], `${baseName}.${actualExt}`, { type: actualType });
      onSave(newFile);
      setLoading(false);
    }, outType, 0.92);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-8">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
        <h3 className="text-white font-medium flex items-center gap-2">
          <Icon name={type === 'video' ? 'Scissors' : 'Crop'} size={18} />
          {type === 'video' ? 'Potong Video' : 'Crop Gambar'}
        </h3>
        <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
          <Icon name="X" size={18} />
        </button>
      </div>

      {/* Editor Content */}
      <div className="w-full max-w-4xl flex-1 min-h-0 flex flex-col items-center justify-center mt-12 mb-4 relative overflow-y-auto scrollbar-none">
        {type === 'image' ? (
          <div className="w-full h-full bg-black/50 rounded-xl overflow-hidden shadow-2xl">
            <Cropper
              ref={cropperRef}
              src={fileUrl}
              style={{ height: '100%', width: '100%' }}
              background={false}
              guides={true}
              viewMode={2}
              dragMode="crop"
            />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black border border-white/10 max-w-[80vw]">
              <video
                ref={videoRef}
                src={fileUrl}
                className="max-h-[35vh] sm:max-h-[40vh] max-w-full"
                controls
                controlsList="nodownload nofullscreen noremoteplayback"
                onLoadedMetadata={(e) => handleVideoLoaded(e.target.duration)}
                onDurationChange={(e) => handleVideoLoaded(e.target.duration)}
                onTimeUpdate={(e) => {
                  const ct = e.target.currentTime;
                  setCurrentTime(ct);
                  if (!loading && duration > 0 && endTime > 0) {
                    if (ct < startTime) {
                      e.target.currentTime = startTime;
                    } else if (ct >= endTime) {
                      e.target.currentTime = startTime;
                      if (!e.target.paused) e.target.play();
                    }
                  }
                }}
              />
            </div>

            {duration > 0 && (
              <div className="w-full max-w-2xl bg-[#1c1c1e] p-6 rounded-[24px] border border-white/10 flex flex-col gap-5 shadow-2xl">
                <div className="flex justify-between text-white/80 text-sm font-medium px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Start</span>
                    <span className="font-mono text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">{formatTime(startTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">{formatTime(endTime)}</span>
                    <span className="text-gray-400">End</span>
                  </div>
                </div>

                {/* iOS-like Trimmer */}
                <div className="relative h-14 bg-black/50 rounded-xl overflow-hidden mt-2 mx-4 select-none">
                  {/* Darkened outside trim region */}
                  <div className="absolute inset-y-0 left-0 bg-black/70 z-10 pointer-events-none"
                    style={{ width: `${(startTime / duration) * 100}%` }} />
                  <div className="absolute inset-y-0 right-0 bg-black/70 z-10 pointer-events-none"
                    style={{ width: `${100 - (endTime / duration) * 100}%` }} />

                  {/* Yellow trim frame */}
                  <div
                    className="absolute inset-y-0 border-y-4 border-yellow-500 z-20 pointer-events-none"
                    style={{ left: `${(startTime / duration) * 100}%`, right: `${100 - (endTime / duration) * 100}%` }}
                  >
                    <div className="absolute top-[-4px] bottom-[-4px] left-0 w-4 bg-yellow-500 flex items-center justify-center rounded-l-md transform -translate-x-full">
                      <div className="w-[2px] h-4 bg-black/40 rounded-full" />
                    </div>
                    <div className="absolute top-[-4px] bottom-[-4px] right-0 w-4 bg-yellow-500 flex items-center justify-center rounded-r-md transform translate-x-full">
                      <div className="w-[2px] h-4 bg-black/40 rounded-full" />
                    </div>
                  </div>

                  {/* Playback cursor */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-30 shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />

                  {/* Range Sliders */}
                  <input
                    type="range" min={0} max={duration} step={0.05} value={startTime}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (val < endTime - 0.1) {
                        setStartTime(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }
                    }}
                    className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none trim-range z-40"
                  />
                  <input
                    type="range" min={0} max={duration} step={0.05} value={endTime}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      if (val > startTime + 0.1) {
                        setEndTime(val);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }
                    }}
                    className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none trim-range z-40"
                  />
                </div>

                <p className="text-white/40 text-[13px] text-center mt-1 font-medium">
                  Geser garis tepi kuning untuk menentukan bagian video yang akan disimpan.
                </p>

                <style>{`
                  .trim-range::-webkit-slider-thumb {
                    pointer-events: auto;
                    appearance: none;
                    width: 32px;
                    height: 56px;
                    background: transparent;
                    cursor: ew-resize;
                  }
                  .trim-range::-moz-range-thumb {
                    pointer-events: auto;
                    width: 32px;
                    height: 56px;
                    background: transparent;
                    border: none;
                    cursor: ew-resize;
                  }
                `}</style>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-4 pb-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all disabled:opacity-50"
        >
          Batal
        </button>
        <button
          onClick={type === 'image' ? handleSaveImage : handleSaveVideo}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 min-w-[140px] justify-center"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Icon name="Check" size={18} />
              Terapkan
            </>
          )}
        </button>
      </div>

      {/* Loading Overlay for video processing */}
      {loading && type === 'video' && (
        <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
          <div className="w-72 bg-gray-900 rounded-2xl p-6 border border-white/10 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <div className="text-center w-full">
              <p className="text-white text-sm font-medium">{progress.text || 'Memproses...'}</p>
              <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress.ratio * 100}%` }}
                />
              </div>
              <p className="text-white/40 text-xs mt-2">Mohon tunggu, video sedang dipotong & dikonversi ke MP4 (WhatsApp hanya mendukung MP4)...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaEditor;
