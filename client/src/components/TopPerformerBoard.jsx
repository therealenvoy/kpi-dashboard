import { formatCompactNumber, formatDate, formatPercent, getReelInsightReasons, truncate } from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";
import SectionHeader from "./SectionHeader";

function getMetricValue(metric, reel) {
  if (!reel) {
    return "0";
  }
  if (metric === "engagementRate") {
    return formatPercent(reel.engagementRate);
  }
  return formatCompactNumber(reel[metric] || 0);
}

export default function TopPerformerBoard({ configs, reels, activeMetric, onMetricChange, onSelectReel }) {
  const activeConfig = configs.find((config) => config.key === activeMetric) || configs[0];
  const featuredReel = reels[0];
  const secondaryReels = reels.slice(1);
  const featuredReasons = getReelInsightReasons(featuredReel);

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Leaders"
        title="Top performers"
        description="One board, one lens at a time. Switch the metric and keep the comparison clean."
        action={
          <div className="inline-flex flex-wrap rounded-full border border-white/6 bg-white/[0.02] p-1 text-sm">
            {configs.map((config) => (
              <button
                key={config.key}
                type="button"
                onClick={() => onMetricChange(config.key)}
                className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                  activeMetric === config.key ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(300px,0.98fr)]">
        <article className="hero-primary-card p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Featured reel</p>
          <button
            type="button"
            onClick={() => featuredReel && onSelectReel(featuredReel)}
            className="mt-5 w-full text-left transition-opacity hover:opacity-90"
          >
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_4.8rem] md:items-start">
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{activeConfig.label}</p>
                <p className="font-display text-[4rem] leading-[0.9] text-white">{getMetricValue(activeConfig.metric, featuredReel)}</p>
                <p className="max-w-xl text-[15px] leading-7 text-slate-200">{featuredReel?.caption || "No reel available"}</p>
                {featuredReasons.length ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {featuredReasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {featuredReel ? <ReelThumbnail reel={featuredReel} className="hidden h-24 w-[4.8rem] shrink-0 md:block" /> : null}
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-[12px] text-slate-500">
              <span>{formatDate(featuredReel?.postedAt)}</span>
              <span>{formatCompactNumber(featuredReel?.views)} views</span>
              <span>{formatPercent(featuredReel?.engagementRate)} ER</span>
            </div>
          </button>
          {featuredReel ? (
            <a
              href={featuredReel.permalink}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex text-sm font-semibold text-sky-200 transition-colors hover:text-white"
            >
              Open on Instagram
            </a>
          ) : null}
        </article>

        <div className="space-y-3">
          {secondaryReels.map((reel, index) => (
            <article
              key={`${activeMetric}-${reel.reelId}`}
              className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-white/6 bg-white/[0.015] px-5 py-4 transition-colors hover:bg-white/[0.025]"
            >
              <button type="button" onClick={() => onSelectReel(reel)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                <ReelThumbnail reel={reel} className="h-[4.5rem] w-[3.4rem] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">#{index + 2}</p>
                  <p className="mt-2 text-[14px] leading-6 text-slate-200">{truncate(reel.caption, 76)}</p>
                  <p className="mt-2 text-[11px] text-slate-500">{getReelInsightReasons(reel).join(" · ")}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{formatDate(reel.postedAt)}</p>
                </div>
              </button>
              <div className="shrink-0 text-right">
                <p className="font-display text-[2rem] text-[#d7b878]">{getMetricValue(activeConfig.metric, reel)}</p>
                <a
                  href={reel.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[12px] font-semibold text-slate-400 transition-colors hover:text-white"
                >
                  Instagram
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
