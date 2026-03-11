import { formatCompactNumber, formatMultiplier, formatPercent, formatSignedCompactNumber, truncate } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

function formatMetric(item) {
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

function getActionCopy(item) {
  const map = {
    "best-new-reel": {
      signal: "Clear winner",
      action: "Push this format again soon"
    },
    "biggest-drop": {
      signal: "Losing pace",
      action: "Review hook, timing, or packaging"
    },
    "strongest-save-rate": {
      signal: "High revisit intent",
      action: "Build a follow-up on the same angle"
    },
    "strongest-share-rate": {
      signal: "High share intent",
      action: "Use this topic for reach expansion"
    },
    "weak-engagement-outlier": {
      signal: "Weak interaction",
      action: "Rework the concept before repeating it"
    }
  };

  return map[item.id] || { signal: "Worth attention", action: "Open the reel and inspect it" };
}

export default function ExecutiveSummaryStrip({ items, onSelectReel }) {
  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow="Executive"
        title="Decisions at a glance"
        description="Read each card as: signal, proof, and next move."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.reel && onSelectReel(item.reel)}
            className="panel rounded-[1.5rem] p-5 text-left transition-colors hover:bg-white/[0.03]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.title}</p>
            <p className="mt-3 text-[12px] font-semibold text-[#d7b878]">{getActionCopy(item).signal}</p>
            <p className="mt-3 font-display text-[2.2rem] leading-[0.94] text-white">{formatMetric(item)}</p>
            <p className="mt-2 text-[12px] leading-5 text-slate-400">{item.metricLabel}</p>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Reel</p>
            <p className="mt-2 text-[12px] leading-6 text-slate-300">
              {item.reel ? truncate(item.reel.caption, 86) : "No reel matched this condition"}
            </p>
            <p className="mt-5 border-t border-white/6 pt-4 text-[12px] font-semibold text-white">{getActionCopy(item).action}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
