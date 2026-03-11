import { formatCurrency, formatPercent, truncate } from "../lib/formatters";

function MobileMetric({ label, value, tone = "text-white" }) {
  return (
    <article className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className={`mt-2 font-display text-[2rem] leading-[0.94] ${tone}`}>{value}</p>
    </article>
  );
}

export default function MobileBriefingMode({ currentMonth, metrics, topPaidReel, topMoneyReels, patternWinners, onOpenDay, latestDate }) {
  const topReels = (topMoneyReels || []).slice(0, 3);
  const topPatterns = (patternWinners || []).slice(0, 2);

  return (
    <section className="space-y-4 md:hidden">
      <div className="panel px-5 py-5">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Mobile briefing</p>
          <h2 className="font-display text-[2rem] leading-[1.02] text-white">Today’s operator read</h2>
          <p className="text-[12px] leading-6 text-slate-300">Use this as the phone version of the dashboard: read the month, the next move, and the strongest reels without scanning the full desktop layout.</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3">
          <MobileMetric label="Month net" value={formatCurrency(currentMonth?.totalRevenue)} tone="text-amber-50" />
          <div className="grid grid-cols-2 gap-3">
            <MobileMetric label="Paid share" value={formatPercent(metrics?.paidShare)} tone="text-amber-100" />
            <MobileMetric label="Rev / paid sub" value={formatCurrency(metrics?.revenuePerPaidSub)} tone="text-amber-100" />
          </div>
        </div>
      </div>

      <div className="panel px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">2 recommendations</p>
        <div className="mt-4 space-y-3">
          <article className="money-card rounded-[1.3rem] border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-100/65">Scale next</p>
            <h3 className="mt-2 font-display text-[1.5rem] leading-[1] text-amber-50">
              {topPaidReel ? truncate(topPaidReel.caption, 40) : "Waiting for a clear reel"}
            </h3>
            <p className="mt-3 text-[12px] leading-5 text-amber-50/78">
              {topPaidReel
                ? `${topPaidReel.estimatedPaidSubs} estimated paid subs and ${formatCurrency(topPaidReel.estimatedNetRevenue)} in estimated net.`
                : "Run another sync to surface the next scale candidate."}
            </p>
          </article>

          <article className="cool-card rounded-[1.3rem] border p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-100/65">Repeat this pattern</p>
            <h3 className="mt-2 font-display text-[1.5rem] leading-[1] text-white">
              {topPatterns[0]?.winner?.label || "Waiting for a clear pattern"}
            </h3>
            <p className="mt-3 text-[12px] leading-5 text-sky-100/72">
              {topPatterns[0]
                ? `${topPatterns[0].winner.estimatedPaidSubs} estimated paid subs at ${topPatterns[0].winner.paidShare}% paid share.`
                : "Pattern winners will appear once enough attribution data is available."}
            </p>
          </article>
        </div>
      </div>

      <div className="panel px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top 3 reels</p>
            <p className="mt-1 text-[12px] text-slate-400">Highest estimated money drivers this month.</p>
          </div>
          {onOpenDay && latestDate ? (
            <button
              type="button"
              onClick={() => onOpenDay(latestDate)}
              className="rounded-full border border-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-300"
            >
              Open latest
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {topReels.map((reel, index) => (
            <article key={reel.reelId} className="rounded-[1.2rem] border border-white/8 bg-white/[0.025] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">#{index + 1} money driver</p>
                  <h3 className="mt-1 text-[14px] font-semibold leading-5 text-white">{truncate(reel.caption, 46)}</h3>
                </div>
                <div className="text-right">
                  <p className="font-display text-[1.65rem] leading-none text-amber-50">{formatCurrency(reel.estimatedNetRevenue)}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-amber-100/65">Net</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                <span className="text-amber-100/72">{reel.estimatedPaidSubs} paid subs</span>
                <span className="text-amber-100/72">{reel.paidShare}% paid share</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Top 2 pattern winners</p>
        <div className="mt-4 space-y-3">
          {topPatterns.map((pattern, index) => (
            <article key={pattern.key} className="rounded-[1.2rem] border border-white/8 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Pattern {index + 1}</p>
                <span className="text-[10px] uppercase tracking-[0.08em] text-slate-500">{pattern.title}</span>
              </div>
              <h3 className="mt-2 font-display text-[1.5rem] leading-[1] text-white">{pattern.winner.label}</h3>
              <p className="mt-3 text-[12px] leading-5 text-slate-300">
                {pattern.winner.estimatedPaidSubs} estimated paid subs and {formatCurrency(pattern.winner.estimatedNetRevenue)} in estimated net revenue.
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
