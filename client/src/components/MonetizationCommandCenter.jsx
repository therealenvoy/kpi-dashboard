import { formatCurrency, formatFullNumber, formatPercent, truncate } from "../lib/formatters";

function getMonthVerdict(metrics) {
  if (!metrics) {
    return {
      title: "Waiting for synced data",
      tone: "text-slate-200",
      detail: "Run a sync to evaluate month quality."
    };
  }

  if (metrics.paidShare >= 20 && metrics.revenuePerPaidSub >= 75) {
    return {
      title: "Yes, this is a healthy month",
      tone: "text-emerald-200",
      detail: "Paid acquisition quality and revenue density are strong enough to keep scaling winners."
    };
  }

  if (metrics.paidShare >= 15) {
    return {
      title: "Mixed month, but worth scaling carefully",
      tone: "text-amber-100",
      detail: "Paid acquisition exists, but some of the volume is still too free-heavy."
    };
  }

  return {
    title: "No, quality is too soft right now",
    tone: "text-rose-200",
    detail: "Traffic is coming in, but not enough of it is becoming paid subscribers."
  };
}

export default function MonetizationCommandCenter({ currentMonth, metrics, topPaidReel, topPattern, canViewRevenue = true }) {
  const verdict = getMonthVerdict(metrics);

  return (
    <section className="hero-shell relative overflow-hidden px-6 py-7 md:px-8 md:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(215,184,120,0.1),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_36%)]" />
      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Monetization</p>
            <p className="text-[13px] leading-6 text-slate-300">This month</p>
            <p className="font-display text-[4rem] leading-[0.88] text-white md:text-[6rem]">
              {canViewRevenue ? formatCurrency(currentMonth?.totalRevenue) : formatFullNumber(currentMonth?.totalPaidSubs)}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
              <span className="text-slate-300">
                Paid share <span className="text-[#d7b878]">{formatPercent(metrics?.paidShare)}</span>
              </span>
              {canViewRevenue ? (
                <span className="text-slate-300">
                  Revenue / paid sub <span className="text-[#d7b878]">{formatCurrency(metrics?.revenuePerPaidSub)}</span>
                </span>
              ) : (
                <span className="text-slate-300">
                  New subs <span className="text-[#d7b878]">{formatFullNumber(currentMonth?.totalNewSubs)}</span>
                </span>
              )}
            </div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${verdict.tone}`}>{verdict.title}</p>
            <p className="max-w-2xl text-[13px] leading-6 text-slate-400">{verdict.detail}</p>
          </div>

          <article className="hero-primary-card px-6 py-5 md:px-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Paid subscribers</p>
                <p className="mt-2 font-display text-[2.5rem] leading-[0.92] text-white">{formatFullNumber(currentMonth?.totalPaidSubs)}</p>
                <p className="mt-3 text-[12px] leading-5 text-slate-400">The people who matter most this month.</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Free subscribers</p>
                <p className="mt-2 font-display text-[2.5rem] leading-[0.92] text-white">{formatFullNumber(currentMonth?.totalFreeSubs)}</p>
                <p className="mt-3 text-[12px] leading-5 text-slate-400">Useful context, but not the primary success metric.</p>
              </div>
            </div>
          </article>
        </div>

        <div className="support-card">
          <div className="space-y-6">
            <div className="space-y-2 border-b border-white/6 pb-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Scale next</p>
              <h3 className="font-display text-[1.9rem] leading-[1.02] text-white">
                {topPaidReel ? truncate(topPaidReel.caption, 46) : "Waiting for a clear signal"}
              </h3>
              <p className="text-[12px] leading-6 text-slate-400">
                {topPaidReel
                  ? canViewRevenue
                    ? `${topPaidReel.estimatedPaidSubs} estimated paid subs and ${formatCurrency(topPaidReel.estimatedNetRevenue)} in estimated net revenue.`
                    : `${topPaidReel.estimatedPaidSubs} estimated paid subs at ${topPaidReel.paidShare}% paid share.`
                  : "Once enough data is available, this will surface the clearest reel to repeat."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Winning pattern</p>
              <h3 className="font-display text-[1.9rem] leading-[1.02] text-white">{topPattern?.winner?.label || "Waiting for a pattern"}</h3>
              <p className="text-[12px] leading-6 text-slate-400">
                {topPattern
                  ? `${topPattern.winner.estimatedPaidSubs} estimated paid subs at ${topPattern.winner.paidShare}% paid share.`
                  : "This will become the format-level instruction once attribution is strong enough."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
