export default function SkeletonList({ count = 4 }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-4 px-5 py-4 rounded-xl border border-border-base/60"
          style={{ animationDelay: `${idx * 80}ms` }}
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-200 shimmer shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded-full bg-slate-200 shimmer" />
            <div className="h-2.5 w-1/2 rounded-full bg-slate-200 shimmer" />
          </div>
          <div className="hidden sm:block w-20 h-6 rounded-lg bg-slate-200 shimmer" />
        </div>
      ))}
      <style>{`
        @keyframes shimmerSlide {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
          background-size: 800px 100%;
          animation: shimmerSlide 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
