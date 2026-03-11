import {
  formatCompactNumber,
  formatDecisionLabel,
  formatPercent,
  formatSignedCompactNumber,
  getWorkflowTone,
  truncate
} from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";

export default function MobileDecisionFeed({ reels, onSelectReel }) {
  return (
    <section className="space-y-3 md:hidden">
      {reels.map((reel) => (
        <button
          key={reel.reelId}
          type="button"
          onClick={() => onSelectReel(reel)}
          className="panel flex w-full items-center gap-4 p-4 text-left"
        >
          <ReelThumbnail reel={reel} className="h-24 w-[4.25rem] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-6 text-slate-100">{truncate(reel.caption, 64)}</p>
            <div className="mt-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getWorkflowTone(reel.workflowDecision)}`}>
                {formatDecisionLabel(reel.workflowDecision)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <span>{formatCompactNumber(reel.views)} views</span>
              <span>{formatSignedCompactNumber(reel.views24hDelta)}</span>
              <span>{formatPercent(reel.engagementRate)}</span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">{reel.workflowAction}</p>
          </div>
        </button>
      ))}
    </section>
  );
}
