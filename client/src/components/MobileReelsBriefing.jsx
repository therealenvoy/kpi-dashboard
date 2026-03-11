import {
  formatCompactNumber,
  formatPercent,
  formatSignedCompactNumber,
  getReelInsightReasons,
  truncate
} from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";

function MobileMetric({ label, value, tone = "text-white" }) {
  return (
    <article className="rounded-[1.35rem] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-2 font-display text-[1.9rem] leading-[0.94] ${tone}`}>{value}</p>
    </article>
  );
}

export default function MobileReelsBriefing({ summary, topReels, onSelectReel }) {
  const scaleLane = summary?.workflowRoadmap?.find((lane) => lane.key === "scale");
  const winning = summary?.highlights?.scale || summary?.highlights?.breakoutScore || null;
  const weakReel = summary?.highlights?.underperforming || summary?.highlights?.drop || null;
  const repeatPattern = Object.entries(summary?.winnersPatterns?.captionBand || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || "short";
  const topThree = (topReels || []).slice(0, 3);

  return (
    <section className="space-y-4 md:hidden">
      <div className="panel px-5 py-5">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mobile briefing</p>
          <h2 className="font-display text-[2rem] leading-[1.02] text-white">Today’s reels read</h2>
          <p className="text-[12px] leading-6 text-slate-300">
            Read the signals, decide the next move, and only then open the deeper analysis.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <MobileMetric label="Scale now" value={formatCompactNumber(scaleLane?.count)} tone="text-amber-50" />
          <div className="grid grid-cols-2 gap-3">
            <MobileMetric label="Avg ER" value={formatPercent(summary?.averageEngagementRate)} tone="text-amber-100" />
            <MobileMetric label="Best 24h push" value={formatSignedCompactNumber(summary?.highlights?.breakout?.views24hDelta)} tone="text-amber-100" />
          </div>
        </div>
      </div>

      <div className="panel px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">2 next moves</p>
        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={() => winning && onSelectReel(winning)}
            className="money-card w-full rounded-[1.3rem] border p-4 text-left"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-100/65">Scale next</p>
            <h3 className="mt-2 font-display text-[1.5rem] leading-[1] text-amber-50">
              {winning ? truncate(winning.caption, 42) : "Waiting for a clear reel"}
            </h3>
            <p className="mt-3 text-[12px] leading-5 text-amber-50/78">
              {winning
                ? `${getReelInsightReasons(winning).join(" · ")}`
                : "Run another refresh once fresh reels have enough data."}
            </p>
          </button>

          <article className="cool-card rounded-[1.3rem] border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-100/65">Repeat this pattern</p>
            <h3 className="mt-2 font-display text-[1.5rem] leading-[1] text-white">{repeatPattern} captions</h3>
            <p className="mt-3 text-[12px] leading-5 text-sky-100/72">
              Likely because the hook structure is resolving cleanly. Repeat this with 3 fresh variants before changing the format.
            </p>
          </article>
        </div>
      </div>

      <div className="panel px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top 3 reels</p>
        <div className="mt-4 space-y-3">
          {topThree.map((reel, index) => (
            <button
              key={reel.reelId}
              type="button"
              onClick={() => onSelectReel(reel)}
              className="flex w-full items-center gap-4 rounded-[1.2rem] border border-white/8 bg-white/[0.025] p-4 text-left"
            >
              <ReelThumbnail reel={reel} className="h-20 w-[3.8rem] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">#{index + 1} scale reel</p>
                <h3 className="mt-1 text-[14px] font-semibold leading-5 text-white">{truncate(reel.caption, 40)}</h3>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">{getReelInsightReasons(reel).join(" · ")}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Avoid repeating</p>
        <button
          type="button"
          onClick={() => weakReel && onSelectReel(weakReel)}
          className="mt-4 flex w-full items-center gap-4 rounded-[1.2rem] border border-white/8 bg-white/[0.025] p-4 text-left"
        >
          <ReelThumbnail reel={weakReel} className="h-20 w-[3.8rem] shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-5 text-white">
              {weakReel ? truncate(weakReel.caption, 42) : "No weak reel surfaced"}
            </h3>
            <p className="mt-2 text-[11px] leading-5 text-slate-400">
              {weakReel ? getReelInsightReasons(weakReel).join(" · ") : "The current slice does not show a clear drop candidate."}
            </p>
          </div>
        </button>
      </div>
    </section>
  );
}
