import { formatCompactNumber } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

function getDominantCaptionBand(patterns) {
  return Object.entries(patterns.captionBand || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || "short";
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

  return labels[value] || "This day";
}

export default function WinnersPatterns({ patterns }) {
  const dominantCaptionBand = getDominantCaptionBand(patterns);
  const topCountry = patterns.topCountries?.[0];
  const weekdayLabel = getWeekdayLabel(patterns.topWeekday);
  const captionHeadline =
    dominantCaptionBand === "short"
      ? "Short captions are winning"
      : dominantCaptionBand === "medium"
        ? "Mid-length captions are landing"
        : "Long captions are surprisingly working";
  const captionWhy =
    dominantCaptionBand === "short"
      ? "Likely because the hook resolves faster and keeps the reel feeling immediate."
      : dominantCaptionBand === "medium"
        ? "Likely because the hook gets enough setup without slowing the scroll."
        : "Likely because the extra context is helping the audience commit to the premise.";
  const captionAction =
    dominantCaptionBand === "short"
      ? "Repeat this with 3 new variants that keep the caption tight and let the visual carry the promise."
      : "Repeat this with 3 new variants in the same structure before changing the writing style again.";

  const distributionHeadline =
    (patterns.organicShare || 0) >= 80 ? "Organic is beating paid support" : "In-feed distribution is doing the work";
  const distributionWhy =
    (patterns.organicShare || 0) >= 80
      ? "Likely because the concept is carrying itself without needing spend to create signal."
      : "Likely because the winners are getting stronger native context from feed exposure.";
  const distributionAction =
    (patterns.organicShare || 0) >= 80
      ? "Test the next 3 variants organically first, then only boost the concepts that already show scale signals."
      : "Keep building with feed-first concepts and treat reels-only distribution as secondary unless the hook clearly needs it.";

  const audienceHeadline = topCountry ? `${topCountry.code} is reacting most` : "Audience pull is still diffuse";
  const audienceWhy = topCountry
    ? `Likely because the current winning hooks are resonating especially well with this audience cluster.`
    : "Likely because the current winner set is still too mixed to show one dominant geography.";
  const audienceAction = topCountry
    ? `Make 3 variants that keep the same emotional angle, then watch whether ${topCountry.code} stays overrepresented in the next winner set.`
    : "Hold off on geography-specific creative until the winner set clusters more clearly.";

  const timingHeadline = `${weekdayLabel} is strongest`;
  const timingWhy = "Likely because the current winners are clustering there, which is where repeatable distribution timing starts to matter.";
  const timingAction = `Queue 3 fresh variants for ${weekdayLabel} before changing the posting rhythm.`;

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Patterns"
        title="What winners have in common"
        description="Read these as strategic findings: what is working, why it is likely working, and what to repeat next."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Caption pattern</p>
          <p className="mt-4 font-display text-[1.9rem] leading-tight text-white">{captionHeadline}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{captionWhy}</p>
          <p className="mt-4 text-[12px] font-semibold leading-6 text-[#d7b878]">{captionAction}</p>
          <p className="mt-4 text-[11px] text-slate-500">{formatCompactNumber(patterns.averageCaptionLength)} average caption length in the current winner set.</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Distribution pattern</p>
          <p className="mt-4 font-display text-[1.9rem] leading-tight text-white">{distributionHeadline}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{distributionWhy}</p>
          <p className="mt-4 text-[12px] font-semibold leading-6 text-[#d7b878]">{distributionAction}</p>
          <p className="mt-4 text-[11px] text-slate-500">{patterns.organicShare}% of winners are organic and {patterns.feedShare}% are in-feed.</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Audience pattern</p>
          <p className="mt-4 font-display text-[1.9rem] leading-tight text-white">{audienceHeadline}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{audienceWhy}</p>
          <p className="mt-4 text-[12px] font-semibold leading-6 text-[#d7b878]">{audienceAction}</p>
          <p className="mt-4 text-[11px] text-slate-500">{patterns.sampleSize} reels are informing this pattern read.</p>
        </article>
        <article className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Timing pattern</p>
          <p className="mt-4 font-display text-[1.9rem] leading-tight text-white">{timingHeadline}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{timingWhy}</p>
          <p className="mt-4 text-[12px] font-semibold leading-6 text-[#d7b878]">{timingAction}</p>
          <p className="mt-4 text-[11px] text-slate-500">Use timing as a repeatable advantage only after the concept stays consistent.</p>
        </article>
      </div>
    </section>
  );
}
