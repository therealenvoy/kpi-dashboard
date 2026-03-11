import { formatCompactNumber, formatCurrency, formatDate, formatPercent } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

export default function MonetizationDailyTable({ rows, onSelectDay }) {
  return (
    <section className="drilldown-panel p-5 md:p-6">
      <SectionHeader
        eyebrow="Daily View"
        title="Daily drill-down"
        description="Use this only when you want to inspect a specific day. The primary decisions should come from the sections above."
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-slate-400">Click any day to open the likely reel drivers behind that performance.</p>
        <span className="rounded-full border border-white/6 bg-white/[0.02] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Secondary surface
        </span>
      </div>

      <div className="table-scroll mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Date</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Visits</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">New subs</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Paid</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Free</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Net Rev</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Subs Rev</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Msg + Tips</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Visit→Sub</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Visit→Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.date}
                onClick={() => onSelectDay(row.date)}
                className="drilldown-row cursor-pointer rounded-3xl transition-colors"
              >
                <td className="rounded-l-3xl px-3 py-3.5 text-[13px] font-semibold text-white">{formatDate(row.date)}</td>
                <td className="px-3 py-3.5 text-[13px] text-sky-100/72">{formatCompactNumber(row.profileVisitsTotal)}</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-400">{formatCompactNumber(row.newSubs)}</td>
                <td className="px-3 py-3.5 text-[13px] font-semibold text-amber-100/92">{formatCompactNumber(row.paidSubs)}</td>
                <td className="px-3 py-3.5 text-[13px] text-sky-100/68">{formatCompactNumber(row.freeSubs)}</td>
                <td className="px-3 py-3.5 text-[13px] font-semibold text-amber-50/92">{formatCurrency(row.earningsTotal)}</td>
                <td className="px-3 py-3.5 text-[13px] text-amber-100/72">{formatCurrency(row.earningsSubscribes)}</td>
                <td className="px-3 py-3.5 text-[13px] text-sky-100/68">{formatCurrency(row.earningsSupport)}</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-400">{formatPercent(row.visitToSubConversion)}</td>
                <td className="rounded-r-3xl px-3 py-3.5 text-[13px] font-semibold text-amber-100/88">{formatPercent(row.visitToPaidConversion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
