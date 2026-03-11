import { formatDecisionLabel, formatSignedCompactNumber, truncate } from "../lib/formatters";

function getDominantCaptionBand(patterns) {
  return Object.entries(patterns?.captionBand || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || "short";
}

function getWeekdayLabel(value) {
  const labels = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday"
  };

  return labels[value] || "";
}

function formatCaptionBandLabel(value) {
  if (value === "short") {
    return "Short captions";
  }

  if (value === "medium") {
    return "Mid-length captions";
  }

  if (value === "long") {
    return "Long captions";
  }

  return "This format";
}

export default function ReelsOperatorBrief({ summary, patterns, onSelectReel }) {
  const roadmap = summary?.workflowRoadmap || [];
  const scaleLane = roadmap.find((lane) => lane.key === "scale") || null;
  const watchLane = roadmap.find((lane) => lane.key === "watch") || null;
  const dropLane = roadmap.find((lane) => lane.key === "drop") || null;
  const fading = summary?.highlights?.underperforming || dropLane?.sampleReel || null;
  const watchReel = watchLane?.sampleReel || null;
  const dominantCaptionBand = getDominantCaptionBand(patterns);
  const weekdayLabel = getWeekdayLabel(patterns?.topWeekday);
  const headline = `${formatCaptionBandLabel(dominantCaptionBand)} are winning.`;
  const subline = weekdayLabel ? `Make 3 more this week. Start ${weekdayLabel}.` : "Make 3 more this week.";
  const watchLabel = watchReel ? formatDecisionLabel(watchReel.workflowDecision) : "Watch";

  return (
    <section className="hero-primary-card px-6 py-6 md:px-8 md:py-8">
      <div className="max-w-5xl space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">What to do next</p>
          <h2 className="max-w-3xl font-display text-[2.5rem] leading-[0.92] text-white md:text-[4.25rem] xl:text-[4.6rem]">{headline}</h2>
          <p className="max-w-xl text-[15px] leading-7 text-slate-300 md:text-[17px]">{subline}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-[1.4rem] border border-white/8 bg-white/[0.02] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Do next</p>
            <h3 className="mt-3 font-display text-[1.4rem] leading-[1] text-white">{formatCaptionBandLabel(dominantCaptionBand)}</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              {weekdayLabel
                ? `Build 3 fresh variants and schedule the first repeat on ${weekdayLabel}.`
                : "Build 3 fresh variants and schedule the first repeat this week."}
            </p>
            <p className="mt-4 text-[11px] text-slate-500">{scaleLane?.count || 0} reels currently score as scale.</p>
          </article>

          <button
            type="button"
            onClick={() => fading && onSelectReel(fading)}
            className="rounded-[1.4rem] border border-white/8 bg-white/[0.02] p-5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Stop doing</p>
            <h3 className="mt-3 font-display text-[1.4rem] leading-[1.02] text-white">
              {fading ? truncate(fading.caption, 26) : "No clear drop"}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              {fading
                ? "Momentum has stalled. Do not let this concept shape the next round."
                : "Nothing is weak enough to kill outright yet."}
            </p>
            {fading ? <p className="mt-4 text-[11px] text-[#d7b878]">{formatSignedCompactNumber(fading.views24hDelta)} in the last 24h.</p> : null}
          </button>

          <button
            type="button"
            onClick={() => watchReel && onSelectReel(watchReel)}
            className="rounded-[1.4rem] border border-white/8 bg-white/[0.02] p-5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Watch</p>
            <h3 className="mt-3 font-display text-[1.4rem] leading-[1.02] text-white">
              {watchReel ? truncate(watchReel.caption, 26) : "No borderline reel"}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              {watchReel
                ? `${watchLabel} this one for another cycle before you repeat it.`
                : "Nothing is sitting in the maybe lane right now."}
            </p>
            {watchLane?.count ? <p className="mt-4 text-[11px] text-slate-500">{watchLane.count} reels still need another check.</p> : null}
          </button>
        </div>
      </div>
    </section>
  );
}
