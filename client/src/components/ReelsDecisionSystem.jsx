import { formatCompactNumber, formatMultiplier, formatPercent, formatSignedCompactNumber, getWorkflowTone, truncate } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

function formatSignalMetric(item) {
  if (!item) {
    return "--";
  }

  switch (item.metricLabel) {
    case "Save rate":
    case "Share rate":
      return formatPercent(item.metricValue);
    case "ER vs age median":
      return formatMultiplier(item.metricValue);
    case "Slowdown":
      return formatSignedCompactNumber(item.metricValue);
    default:
      return formatCompactNumber(item.metricValue);
  }
}

function getLaneSignal(laneKey, executiveSummary) {
  const map = {
    scale: ["best-new-reel", "strongest-save-rate"],
    watch: ["strongest-share-rate"],
    drop: ["biggest-drop", "weak-engagement-outlier"]
  };

  return map[laneKey]
    ?.map((id) => executiveSummary?.find((item) => item.id === id))
    .find(Boolean);
}

export default function ReelsDecisionSystem({ roadmap, executiveSummary, onApplyDecision, onSelectReel }) {
  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Decision System"
        title="One framework for what to do next"
        description="Run the library in three lanes only: scale the clear winners, watch the maybes, and drop the weak patterns."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {roadmap.map((lane) => {
          const signal = getLaneSignal(lane.key, executiveSummary);

          return (
            <article key={lane.key} className="rounded-[1.5rem] border border-white/6 bg-white/[0.015] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getWorkflowTone(lane.key)}`}>
                    {lane.key.charAt(0).toUpperCase() + lane.key.slice(1)}
                  </span>
                  <p className="font-display text-[2.4rem] leading-[0.92] text-white">{formatCompactNumber(lane.count)}</p>
                  <p className="text-[12px] text-slate-500">{lane.share}% of the current slice</p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyDecision(lane.key)}
                  className="rounded-full border border-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-white/16 hover:text-white"
                >
                  Show lane
                </button>
              </div>

              <p className="mt-5 text-[12px] leading-6 text-slate-300">{lane.action}</p>
              <p className="mt-3 text-[12px] leading-6 text-slate-500">{lane.description}</p>

              {signal ? (
                <div className="mt-5 border-t border-white/6 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Signal</p>
                  <p className="mt-2 font-display text-[1.9rem] leading-[0.94] text-[#d7b878]">{formatSignalMetric(signal)}</p>
                  <p className="mt-1 text-[12px] text-slate-400">{signal.title}</p>
                </div>
              ) : null}

              {lane.sampleReel ? (
                <button
                  type="button"
                  onClick={() => onSelectReel(lane.sampleReel)}
                  className="mt-5 w-full rounded-[1.25rem] border border-white/6 bg-white/[0.02] p-4 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Example reel</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-200">{truncate(lane.sampleReel.caption, 92)}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    <span>{formatCompactNumber(lane.sampleReel.workflowScore)} score</span>
                    <span>{formatCompactNumber(lane.sampleReel.views)} views</span>
                  </div>
                </button>
              ) : (
                <p className="mt-5 text-[12px] text-slate-500">No reels in this lane for the current slice.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
