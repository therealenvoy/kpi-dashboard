import { formatCompactNumber, formatCurrency, formatDate, formatPercent, truncate } from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";

function getConfidenceTone(confidence) {
  if (confidence === "high") return "text-emerald-300 bg-emerald-500/12";
  if (confidence === "low") return "text-rose-300 bg-rose-500/12";
  return "text-amber-200 bg-amber-500/12";
}

export default function MonetizationDayDrawer({ payload, onClose, canViewRevenue = true }) {
  if (!payload) return null;

  const { metrics, countries, likelyDrivers } = payload;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="panel flex h-full w-full max-w-xl flex-col overflow-hidden border-white/15">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Day detail</p>
            <h3 className="mt-1 font-display text-xl text-white">{formatDate(metrics.date)}</h3>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white">
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Metrics strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Visits</p>
              <p className="mt-1 font-display text-2xl text-white">{formatCompactNumber(metrics.profileVisitsTotal)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">New subs</p>
              <p className="mt-1 font-display text-2xl text-white">{formatCompactNumber(metrics.newSubs)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Paid / Free</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatCompactNumber(metrics.paidSubs)} <span className="text-slate-500">/</span> {formatCompactNumber(metrics.freeSubs)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {canViewRevenue ? "Revenue" : "Conversion"}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {canViewRevenue ? formatCurrency(metrics.earningsTotal) : formatPercent(metrics.visitToPaidConversion)}
              </p>
            </div>
          </div>

          {/* Likely drivers — compact */}
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Likely reel drivers</p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${getConfidenceTone(likelyDrivers.confidence)}`}>
                {likelyDrivers.confidence}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {likelyDrivers.reels.length ? (
                likelyDrivers.reels.slice(0, 3).map((reel) => (
                  <div key={`${metrics.date}-${reel.reelId}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
                    <ReelThumbnail reel={reel} className="h-12 w-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] leading-5 text-slate-200">{truncate(reel.caption, 60)}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        {reel.reasonTags?.slice(0, 2).map((tag) => (
                          <span key={`${reel.reelId}-${tag}`} className="rounded-full border border-white/8 px-2 py-0.5">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg text-amber-300">{reel.attributionShare}%</p>
                      <p className="text-[9px] uppercase text-slate-500">share</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-4 text-[12px] text-slate-500">No reels active in the 72h window.</p>
              )}
            </div>
          </div>

          {/* Countries — inline */}
          {countries.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Top countries</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {countries.slice(0, 5).map((c) => (
                  <span key={c.countryCode} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300">
                    {c.countryCode} {formatCompactNumber(c.visits)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conversion summary — single line */}
          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
            <span>Visit→Sub {formatPercent(metrics.visitToSubConversion)}</span>
            <span>Visit→Paid {formatPercent(metrics.visitToPaidConversion)}</span>
            {canViewRevenue && <span>Sub rev {formatCurrency(metrics.earningsSubscribes)}</span>}
            {canViewRevenue && <span>Msg+Tips {formatCurrency(metrics.earningsSupport)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
