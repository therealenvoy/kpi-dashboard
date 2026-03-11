import { formatCompactNumber, formatDecisionLabel, getWorkflowTone, truncate } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

export default function ContentScoringRoadmap({ roadmap, onApplyDecision, onSelectReel }) {
  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Roadmap"
        title="Content scoring system"
        description="Run the library in three lanes: scale the clear winners, watch the maybes, and drop the weak patterns."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {roadmap.map((lane) => (
          <article key={lane.key} className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getWorkflowTone(lane.key)}`}>
                  {formatDecisionLabel(lane.key)}
                </span>
                <p className="mt-4 font-display text-4xl leading-none text-white">{formatCompactNumber(lane.count)}</p>
                <p className="mt-2 text-sm text-slate-400">{lane.share}% of the current view</p>
              </div>
              <button
                type="button"
                onClick={() => onApplyDecision(lane.key)}
                className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition-colors hover:border-white/30 hover:text-white"
              >
                Show
              </button>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-300">{lane.description}</p>
            <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-7 text-slate-200">{lane.action}</p>

            {lane.sampleReel ? (
              <button
                type="button"
                onClick={() => onSelectReel(lane.sampleReel)}
                className="mt-5 w-full rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:bg-white/[0.07]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Example reel</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{truncate(lane.sampleReel.caption, 92)}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                  <span>{formatCompactNumber(lane.sampleReel.workflowScore)} score</span>
                  <span>{formatCompactNumber(lane.sampleReel.views)} views</span>
                </div>
              </button>
            ) : (
              <p className="mt-5 text-sm text-slate-500">No reels in this lane for the current slice.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
