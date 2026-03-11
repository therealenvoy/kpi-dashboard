import { formatCompactNumber, formatCurrency, truncate } from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";
import SectionHeader from "./SectionHeader";

export default function TopMoneyReels({ reels, showHeader = true }) {
  if (!reels?.length) {
    return null;
  }

  return (
    <section className="rank-panel">
      {showHeader ? (
        <SectionHeader
          eyebrow="Money Reels"
          title="Top money reels"
          description="Estimated from the daily attribution model. Use this to scale the reels and formats that appear to create paid subscribers and net revenue."
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Money driver</p>
                <h3 className="mt-1 text-[15px] font-semibold leading-6 text-white">{truncate(reel.caption, 70)}</h3>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  <span className="text-slate-400">Paid subs {reel.estimatedPaidSubs}</span>
                  <span className="text-slate-400">Paid share {reel.paidShare}%</span>
                  <span className="text-slate-500">Days {formatCompactNumber(reel.contributingDays)}</span>
                  <span className="text-slate-500">Free {reel.estimatedFreeSubs}</span>
                </div>
                <a
                  href={reel.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border border-white/8 px-3 py-1.5 text-[12px] font-semibold text-slate-200 transition-colors hover:border-white/16 hover:text-white"
                >
                  Open reel
                </a>
              </div>
              <div className="pt-1 text-right">
                <p className="font-display text-[2.2rem] leading-none text-[#d7b878]">{formatCurrency(reel.estimatedNetRevenue)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-slate-500">Est. net</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
