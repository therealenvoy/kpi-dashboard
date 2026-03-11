import { formatCompactNumber, formatCurrency, formatDate, formatPercent, truncate } from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";

function getConfidenceTone(confidence) {
  if (confidence === "high") {
    return "text-emerald-200 bg-emerald-500/12 ring-1 ring-emerald-400/25";
  }
  if (confidence === "low") {
    return "text-rose-200 bg-rose-500/12 ring-1 ring-rose-400/25";
  }
  return "text-amber-100 bg-amber-500/12 ring-1 ring-amber-300/20";
}

function getReasonBadges(reasonTags = []) {
  return reasonTags.slice(0, 3);
}

export default function MonetizationDayDrawer({ payload, onClose }) {
  if (!payload) {
    return null;
  }

  const { metrics, countries, likelyDrivers } = payload;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="panel flex h-full w-full max-w-2xl flex-col overflow-hidden border-white/15">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Day drill-down</p>
            <h3 className="mt-1 font-display text-2xl text-white">{formatDate(metrics.date)}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Visits</p>
              <p className="mt-3 font-display text-3xl text-white">{formatCompactNumber(metrics.profileVisitsTotal)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">New subs</p>
              <p className="mt-3 font-display text-3xl text-white">{formatCompactNumber(metrics.newSubs)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Paid vs free</p>
              <p className="mt-3 text-lg font-semibold text-white">
                {formatCompactNumber(metrics.paidSubs)} paid / {formatCompactNumber(metrics.freeSubs)} free
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Revenue</p>
              <p className="mt-3 font-display text-3xl text-white">{formatCurrency(metrics.earningsTotal)}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">Total day revenue</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Subscription revenue</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatCurrency(metrics.earningsSubscribes)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Message revenue</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatCurrency(metrics.earningsMessages)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Tip revenue</p>
              <p className="mt-3 text-lg font-semibold text-white">{formatCurrency(metrics.earningsTips)}</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Likely reel drivers</p>
                <p className="mt-2 text-sm text-slate-300">
                  A 72h weighted model using age-adjusted breakout, share/save intent, workflow score, and recency. This is directional,
                  not deterministic attribution.
                </p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${getConfidenceTone(likelyDrivers.confidence)}`}>
                {likelyDrivers.confidence} confidence
              </span>
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">
              {formatCompactNumber(likelyDrivers.candidateCount || 0)} reels were active in the 72h attribution window
            </p>

            <div className="mt-5 space-y-3">
              {likelyDrivers.reels.length ? (
                likelyDrivers.reels.map((reel) => (
                  <article key={`${metrics.date}-${reel.reelId}`} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex gap-4">
                      <ReelThumbnail reel={reel} className="h-20 w-16 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm leading-6 text-slate-100">{truncate(reel.caption, 90)}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">{formatDate(reel.postedAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-2xl text-white">{reel.attributionShare}%</p>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">share</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Est. visits</p>
                            <p className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(reel.estimatedVisitPressure)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Est. subs</p>
                            <p className="mt-1 text-sm font-semibold text-white">{reel.estimatedSubPressure}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Est. paid</p>
                            <p className="mt-1 text-sm font-semibold text-white">{reel.estimatedPaidPressure}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-400">{reel.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getReasonBadges(reel.reasonTags).map((tag) => (
                            <span
                              key={`${reel.reelId}-${tag}`}
                              className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-400">
                  No reels were active in the 72h window for this day.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Visitor countries</p>
            <div className="mt-4 space-y-3">
              {countries.length ? (
                countries.map((country) => (
                  <div key={country.countryCode} className="flex items-center justify-between text-sm text-slate-300">
                    <span>{country.countryCode}</span>
                    <span>{formatCompactNumber(country.visits)} visits</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No stored country snapshot for this day yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Conversion read</p>
            <div className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
              <p>Visit to sub conversion: {formatPercent(metrics.visitToSubConversion)}</p>
              <p>Visit to paid conversion: {formatPercent(metrics.visitToPaidConversion)}</p>
              <p>Subscription revenue: {formatCurrency(metrics.earningsSubscribes)}</p>
              <p>Messages + tips: {formatCurrency(metrics.earningsSupport)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
