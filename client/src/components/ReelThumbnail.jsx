function buildGradient(seed) {
  const numeric = Array.from(String(seed || "0")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hueA = numeric % 360;
  const hueB = (numeric * 1.7) % 360;
  return `linear-gradient(165deg, hsl(${hueA} 34% 34%) 0%, hsl(${hueB} 42% 20%) 100%)`;
}

export default function ReelThumbnail({ reel, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.05rem] border border-white/8 bg-slate-950 shadow-[0_12px_28px_rgba(0,0,0,0.22)] ${className}`}
    >
      <div className="absolute inset-[1px] rounded-[1rem]" style={{ background: buildGradient(reel?.reelId) }} />
      <div className="absolute inset-[1px] rounded-[1rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),transparent_24%,rgba(8,11,18,0.18)_56%,rgba(8,11,18,0.58)_100%)]" />
      <div className="absolute inset-x-[1px] top-[1px] h-7 rounded-t-[1rem] bg-white/5" />
      <div className="absolute inset-[1px] rounded-[1rem] ring-1 ring-inset ring-white/8" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.10),transparent_24%)]" />
      <div className="relative flex h-full items-start justify-start p-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/28 text-[10px] text-white/88 backdrop-blur-sm">
          ▶
        </span>
      </div>
    </div>
  );
}
