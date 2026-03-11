import { formatDate, formatSignedCompactNumber, getReelInsightReasons, truncate } from "../lib/formatters";

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

  return labels[value] || "this day";
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
  const winning = summary?.highlights?.scale || summary?.highlights?.breakoutScore || null;
  const fading = summary?.highlights?.underperforming || null;
  const dominantCaptionBand = getDominantCaptionBand(patterns);
  const weekdayLabel = getWeekdayLabel(patterns?.topWeekday);
  const headline = `${formatCaptionBandLabel(dominantCaptionBand)} are winning. Repeat them next.`;
  const subline = winning
    ? `${truncate(winning.caption, 44)} is the clearest current winner${
        fading ? `, while ${truncate(fading.caption, 34)} is fading and should not shape the next round.` : "."
      }`
    : "The current slice does not have a clear winner yet.";

  return (
    <section className="hero-primary-card px-6 py-6 md:px-8 md:py-8">
      <div className="max-w-5xl space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reels intelligence</p>
        <h2 className="max-w-5xl font-display text-[2.4rem] leading-[0.98] text-white md:text-[4.35rem]">{headline}</h2>
        <p className="max-w-3xl text-[13px] leading-6 text-slate-300 md:text-[15px]">{subline}</p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => winning && onSelectReel(winning)}
          className="rounded-[1.45rem] border border-white/6 bg-black/18 p-5 text-left transition-colors hover:bg-white/[0.03]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Winning now</p>
          <h3 className="mt-3 font-display text-[1.8rem] leading-[1.02] text-white">
            {winning ? truncate(winning.caption, 34) : "No clear winner yet"}
          </h3>
          <p className="mt-3 text-[12px] leading-6 text-slate-300">
            {winning ? getReelInsightReasons(winning).join(" · ") : "Wait for a stronger winner set."}
          </p>
          {winning ? <p className="mt-5 text-[11px] text-slate-500">{formatDate(winning.postedAt)}</p> : null}
        </button>

        <button
          type="button"
          onClick={() => fading && onSelectReel(fading)}
          className="rounded-[1.45rem] border border-white/6 bg-black/18 p-5 text-left transition-colors hover:bg-white/[0.03]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Fading now</p>
          <h3 className="mt-3 font-display text-[1.8rem] leading-[1.02] text-white">
            {fading ? truncate(fading.caption, 34) : "No weak reel surfaced"}
          </h3>
          <p className="mt-3 font-display text-[2.2rem] leading-none text-[#d7b878]">
            {formatSignedCompactNumber(fading?.views24hDelta)}
          </p>
          <p className="mt-2 text-[12px] leading-6 text-slate-300">
            {fading ? "Momentum has stalled. Do not repeat this concept until the signal improves." : "The current slice does not show a clear drop candidate."}
          </p>
        </button>

        <article className="rounded-[1.45rem] border border-white/6 bg-black/18 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Repeat next</p>
          <h3 className="mt-3 font-display text-[1.8rem] leading-[1.02] text-white">{formatCaptionBandLabel(dominantCaptionBand)}</h3>
          <p className="mt-3 font-display text-[2.2rem] leading-none text-[#d7b878]">{weekdayLabel}</p>
          <p className="mt-2 text-[12px] leading-6 text-slate-300">
            Likely because the hook resolves faster. Make 3 fresh variants and schedule the first repeat on {weekdayLabel}.
          </p>
        </article>
      </div>
    </section>
  );
}
