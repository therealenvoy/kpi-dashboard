import { formatCompactNumber, formatPercent } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

export default function LifecycleView({ lifecycle, onSelectReel }) {
  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Lifecycle"
        title="Reel lifecycle"
        description="Age-normalized buckets so a reel posted 8 hours ago does not compete unfairly with one posted 20 days ago."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {lifecycle.map((bucket) => (
          <article key={bucket.key} className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{bucket.label}</p>
            <p className="mt-4 font-display text-4xl text-white">{bucket.count}</p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>{formatCompactNumber(bucket.averageViews)} avg views</p>
              <p>{formatCompactNumber(bucket.averageViews24hDelta)} avg 24h delta</p>
              <p>{formatPercent(bucket.averageEngagementRate)} avg ER</p>
              <p>{formatCompactNumber(bucket.averageBreakoutScore)} avg breakout</p>
            </div>
            {bucket.strongestReel ? (
              <button
                type="button"
                onClick={() => onSelectReel(bucket.strongestReel)}
                className="mt-5 text-sm font-semibold text-sky-200 transition-colors hover:text-white"
              >
                Open strongest reel
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

