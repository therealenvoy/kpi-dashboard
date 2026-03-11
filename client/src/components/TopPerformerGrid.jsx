import { formatCompactNumber, formatDate, formatPercent, truncate } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

function formatMetricValue(metric, reel) {
  if (metric === "engagementRate") {
    return formatPercent(reel.engagementRate);
  }
  return formatCompactNumber(reel[metric] || 0);
}

export default function TopPerformerGrid({ title, description, reels, metric, label }) {
  return (
    <section className="space-y-5">
      <SectionHeader eyebrow="Leaders" title={title} description={description} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reels.map((reel, index) => (
          <article
            key={`${metric}-${reel.reelId}`}
            className="panel group flex min-h-[220px] flex-col justify-between overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-300">
                  #{index + 1}
                </span>
                <span className="text-xs text-slate-400">{formatDate(reel.postedAt)}</span>
              </div>
              <p className="text-sm leading-6 text-slate-200">{truncate(reel.caption, 115)}</p>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
                <p className="font-display text-3xl text-white">{formatMetricValue(metric, reel)}</p>
              </div>
              <a
                href={reel.permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-semibold text-neon transition-colors hover:text-white"
              >
                Open reel
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

