import { formatPercent } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

function buildActions(summary) {
  if (!summary) {
    return [];
  }

  const scaleLane = summary.workflowRoadmap?.find((lane) => lane.key === "scale");
  const watchLane = summary.workflowRoadmap?.find((lane) => lane.key === "watch");
  const dropLane = summary.workflowRoadmap?.find((lane) => lane.key === "drop");

  return [
    {
      title: "Scale the winner",
      reason: scaleLane?.sampleReel?.caption || summary.highlights?.breakoutScore?.caption || "No standout reel yet.",
      action:
        "Reuse the winning hook and opening structure in the next post, and consider extra distribution on this reel while momentum is still live."
    },
    {
      title: "Watch the maybes",
      reason: watchLane?.sampleReel?.caption || "No watchlist reel detected.",
      action: "Set a 24h checkpoint for these reels. Only scale if they improve versus age peers."
    },
    {
      title: "Drop weak patterns",
      reason: dropLane?.sampleReel?.caption || summary.highlights?.underperforming?.caption || "No weak recent reel detected.",
      action: `The strongest save-rate reel is running at ${formatPercent(summary.highlights?.saved?.saveRate)}. Redirect effort toward formats that create revisit and share intent instead.`
    }
  ];
}

export default function ActionPlanPanel({ summary }) {
  const actions = buildActions(summary);

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Action Plan"
        title="What to do next"
        description="A simplified read of the data, translated into three concrete next moves."
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {actions.map((item, index) => (
          <article key={item.title} className="rounded-[1.5rem] border border-white/6 bg-white/[0.015] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Priority {index + 1}</p>
            <h3 className="mt-3 font-display text-[1.75rem] leading-[1.02] text-white">{item.title}</h3>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Why</p>
            <p className="mt-2 text-[12px] leading-6 text-slate-300">{item.reason}</p>
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Do</p>
            <p className="mt-2 text-[12px] leading-6 text-slate-400">{item.action}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
