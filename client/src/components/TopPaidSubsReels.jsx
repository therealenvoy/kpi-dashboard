import { formatCurrency, truncate } from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";
import SectionHeader from "./SectionHeader";

export default function TopPaidSubsReels({ reels, showHeader = true, canViewRevenue = true }) {
  if (!reels?.length) {
    return null;
  }

  return (
    <section className="rank-panel">
      {showHeader ? (
        <SectionHeader
          eyebrow="Paid Reels"
          title="Paid subs by reel"
          description="Sorted directly by estimated paid subscribers. This is the fastest way to see which reels are likely bringing buyers, not just traffic."
        />
      ) : null}

      <div className={`${showHeader ? "mt-6" : ""} grid gap-3`}>
        {reels.map((reel, index) => (
          <article key={reel.reelId} className="rank-row">
            <div className="leaderboard-row">
              <div className="pt-1">
                <p className="leaderboard-rank text-white/92">{index + 1}</p>
              </div>
              <ReelThumbnail reel={reel} className="h-16 w-12 shrink-0 rounded-[0.9rem]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Paid-sub driver</p>
                <h3 className="mt-1 text-[15px] font-semibold leading-6 text-white">{truncate(reel.caption, 72)}</h3>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {canViewRevenue ? <span className="text-slate-400">Net {formatCurrency(reel.estimatedNetRevenue)}</span> : null}
                  <span className="text-slate-400">Paid share {reel.paidShare}%</span>
                  <span className="text-slate-500">Free {reel.estimatedFreeSubs}</span>
                </div>
              </div>
              <div className="pt-1 text-right">
                <p className="font-display text-[2.5rem] leading-none text-[#d7b878]">{reel.estimatedPaidSubs}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-500">Est. paid subs</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
