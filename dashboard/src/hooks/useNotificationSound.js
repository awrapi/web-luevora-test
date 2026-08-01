/**
 * useNotificationSound.js
 * ─────────────────────────────────────────────────────────────
 * Hook global untuk memainkan audio notifikasi secara real-time
 * via SSE (Server-Sent Events).
 *
 * Dipasang di level SharedLayout agar aktif di SEMUA halaman,
 * bukan hanya di halaman NotificationCenter.
 *
 * Fitur:
 *   - Suara tetap bunyi walau tab di-background (YouTube, dll)
 *     selama user sudah pernah interaksi (klik) di tab dashboard.
 *   - Menggunakan AudioContext API untuk bypass autoplay policy.
 *   - Menampilkan Browser Notification sebagai fallback visual.
 *   - Polling fallback jika SSE gagal connect.
 * ─────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useCallback } from 'react';
import api from '@/services/api';

// ─── Helper: ambil token dari localStorage ─────────────────
function getAuthToken() {
  try {
    const session = localStorage.getItem('luevora_session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token || null;
    }
  } catch (e) {
    // fallback
  }
  // Fallback ke key lama jika ada
  return localStorage.getItem('token') || null;
}

// ─── Preload & cache audio elements ─────────────────────────
const audioCache = {};

function getAudioElement(url) {
  if (!audioCache[url]) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audioCache[url] = audio;
  }
  return audioCache[url];
}

async function playAudio(url) {
  try {
    const audio = getAudioElement(url);
    // Rewind ke awal jika sedang dimainkan
    audio.currentTime = 0;
    
    // Pastikan volume penuh dan unmute sebelum play
    audio.muted = false;
    audio.volume = 1.0;
    
    await audio.play();
    console.log('[NotifSound] 🔊 Playing notification sound!');
  } catch (err) {
    console.warn('[NotifSound] ❌ Gagal play audio:', err);
  }
}

// ─── Browser Notification permission ───────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => {
      console.log('[NotifSound] Browser notification permission:', perm);
    });
  }
}

function showBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag: 'luevora-notif-' + Date.now(), // Unique tag so each notif shows
      });
    } catch (e) {
      // Silent fail — some environments don't support Notification constructor
    }
  }
}

// ─── Main Hook ─────────────────────────────────────────────
const useNotificationSound = () => {
  const lastNotifIdRef = useRef(null);
  const isInitializedRef = useRef(false);
  const pollingIntervalRef = useRef(null);
  const sseConnectedRef = useRef(false);

  // Preload audio files saat pertama kali
  useEffect(() => {
    getAudioElement('/audio/center-notif.mp3');
    getAudioElement('/audio/transaction-notif.mp3');
    requestNotifPermission();
    console.log('[NotifSound] 🎵 Hook initialized, preloading audio elements...');
  }, []);

  // Unlock audio policy on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      // Mainkan suara secara silent/muted untuk memancing browser
      // mengizinkan playback audio di background tab
      const dummy = getAudioElement('/audio/center-notif.mp3');
      const originalVolume = dummy.volume;
      dummy.volume = 0; // Muted sementara
      
      dummy.play().then(() => {
        dummy.pause();
        dummy.currentTime = 0;
        dummy.volume = originalVolume; // Kembalikan volume
        console.log('[NotifSound] 🔓 Audio unlocked by user interaction');
      }).catch(() => {});

      // Hapus listener setelah sukses (cukup satu kali)
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Fungsi play notifikasi
  const playNotifSound = useCallback(async (type) => {
    const url = type === 'transaction'
      ? '/audio/transaction-notif.mp3'
      : '/audio/center-notif.mp3';

    console.log('[NotifSound] 🎶 Attempting to play:', url, 'type:', type);
    await playAudio(url);
  }, []);

  // Fungsi cek notifikasi baru
  const checkForNewNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications?page=1&limit=1');
      if (res.data.success && res.data.data.length > 0) {
        const newest = res.data.data[0];

        if (!isInitializedRef.current) {
          // Pertama kali: simpan ID tanpa bunyi
          lastNotifIdRef.current = newest.id;
          isInitializedRef.current = true;
          console.log('[NotifSound] 📋 Initialized with last ID:', newest.id);
          return;
        }

        if (newest.id !== lastNotifIdRef.current) {
          console.log('[NotifSound] 🆕 New notification detected!', newest.id, 'prev:', lastNotifIdRef.current);
          lastNotifIdRef.current = newest.id;

          // 🔊 Mainkan suara
          await playNotifSound(newest.type);

          // 🔔 Tampilkan browser notification (fallback visual)
          showBrowserNotification(
            newest.title || 'Notifikasi Baru',
            newest.message || 'Ada aktivitas baru di Luevora CRM'
          );
        }
      }
    } catch (err) {
      console.warn('[NotifSound] Error fetch notif:', err.message);
    }
  }, [playNotifSound]);

  // SSE listener global + polling fallback
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      console.warn('[NotifSound] ⚠️ No auth token found, skipping SSE');
      return;
    }

    console.log('[NotifSound] 🔌 Connecting SSE with token...');
    const baseURL = api.defaults.baseURL || 'http://127.0.0.1:3001/api';
    let eventSource;

    try {
      eventSource = new EventSource(`${baseURL}/notifications/stream?token=${token}`);
      
      eventSource.onopen = () => {
        console.log('[NotifSound] ✅ SSE connected');
        sseConnectedRef.current = true;
        // Clear polling jika SSE berhasil connect
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };

      eventSource.onmessage = async (event) => {
        console.log('[NotifSound] 📨 SSE message received:', event.data);
        if (event.data === 'NEW_DATA') {
          await checkForNewNotifications();
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[NotifSound] ⚠️ SSE error, starting polling fallback');
        sseConnectedRef.current = false;
        
        // Start polling sebagai fallback (setiap 15 detik)
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(() => {
            checkForNewNotifications();
          }, 15000);
        }
      };
    } catch (err) {
      console.error('[NotifSound] ❌ SSE creation failed:', err);
    }

    // Initial check
    checkForNewNotifications();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [checkForNewNotifications]);
};

export default useNotificationSound;
