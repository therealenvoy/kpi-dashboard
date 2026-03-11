import { formatCompactNumber, formatCurrency, formatPercent } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

export default function MonetizationInsights({ metrics, showHeader = true }) {
  if (!metrics) {
    return null;
  }

  return (
    <section className="panel p-6">
      {showHeader ? (
        <SectionHeader
          eyebrow="Operator Layer"
          title="What matters now"
          description="These are the decision metrics that tell you whether this month is producing valuable subscribers."
        />
      ) : null}

      <div className={`${showHeader ? "mt-6" : ""} grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]`}>
        <div className="cool-card rounded-[1.75rem] border p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/60">Read</p>
          <h3 className="mt-3 font-display text-[2rem] leading-[1.02] text-white">{metrics.headline}</h3>
          <p className="mt-4 text-[12px] leading-6 text-sky-100/70">{metrics.action}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="money-card rounded-[1.75rem] border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100/60">Paid share</p>
            <p className="mt-2 font-display text-[2.65rem] leading-[0.92] text-amber-50">{formatPercent(metrics.paidShare)}</p>
            <p className="mt-4 text-[12px] leading-5 text-amber-50/70">Share of current-month subscribers that were paid.</p>
          </div>
          <div className="money-card rounded-[1.75rem] border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100/60">Net / paid sub</p>
            <p className="mt-2 font-display text-[2.65rem] leading-[0.92] text-amber-50">{formatCurrency(metrics.revenuePerPaidSub)}</p>
            <p className="mt-4 text-[12px] leading-5 text-amber-50/70">Net earnings generated per paid subscriber this month.</p>
          </div>
          <div className="cool-card rounded-[1.75rem] border p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100/60">Subs rev / paid sub</p>
            <p className="mt-2 font-display text-[2.65rem] leading-[0.92] text-white">{formatCurrency(metrics.subscriptionRevenuePerPaidSub)}</p>
            <p className="mt-4 text-[12px] leading-5 text-sky-100/65">Subscription revenue only, normalized by paid subscribers.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
