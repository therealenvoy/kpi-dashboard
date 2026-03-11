import { formatCompactNumber, formatDate, formatPercent, truncate } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

export default function AttentionPanel({ reels, featuredReel, onSelectReel }) {
  const secondaryReels = featuredReel ? reels.filter((reel) => reel.reelId !== featuredReel.reelId) : reels;

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Attention"
        title="Needs attention"
        description="This is the action bucket: reels that are recent enough to matter but weak enough to justify intervention."
      />

      {featuredReel ? (
        <button
          type="button"
          onClick={() => onSelectReel(featuredReel)}
          className="mt-6 w-full rounded-[1.75rem] border border-rose-400/20 bg-rose-400/5 p-5 text-left transition-colors hover:bg-rose-400/10"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-200/80">Weakest recent breakout</p>
          <p className="mt-3 font-display text-3xl text-white">{formatCompactNumber(featuredReel.breakoutScore)}</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">{truncate(featuredReel.caption, 110)}</p>
          <p className="mt-4 text-sm font-semibold text-white">Action: review the opening hook and distribution choice first.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.12em] text-slate-400">
            <span>{formatDate(featuredReel.postedAt)}</span>
            <span>{formatCompactNumber(featuredReel.views)} views</span>
            <span>{formatPercent(featuredReel.engagementRate)} ER</span>
          </div>
        </button>
      ) : null}

      <div className="mt-4 space-y-3">
        {secondaryReels.length ? (
          secondaryReels.map((reel) => (
            <button
              key={reel.reelId}
              type="button"
              onClick={() => onSelectReel(reel)}
              className="flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div className="min-w-0">
                <p className="text-sm leading-6 text-slate-200">{truncate(reel.caption, 74)}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDate(reel.postedAt)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-2xl text-white">{formatCompactNumber(reel.breakoutScore)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">Breakout</p>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-4 text-sm text-slate-400">
            No weak recent reels match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}
