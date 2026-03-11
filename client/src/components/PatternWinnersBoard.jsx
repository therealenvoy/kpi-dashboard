import { formatCurrency } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

function getStrategicFinding(pattern) {
  const label = pattern.winner.label;

  switch (pattern.key) {
    case "captionBand":
      return {
        statement: `${label} are winning`,
        interpretation: `Keep hooks and payoff tight. This caption style is producing the strongest paid-subscriber signal right now.`
      };
    case "weekday":
      return {
        statement: `${label} is strongest`,
        interpretation: `This posting day is showing the best monetization quality this month. Treat it like a priority slot.`
      };
    case "boosted":
      return {
        statement: `${label} beats the alternative`,
        interpretation: `This distribution path is creating a better paid-sub pattern. Scale it before adding more complexity.`
      };
    case "surface":
      return {
        statement: `${label} are converting better`,
        interpretation: `This surface is outperforming the alternative on monetization quality, not just attention.`
      };
    default:
      return {
        statement: `${label} is winning`,
        interpretation: pattern.description
      };
  }
}

export default function PatternWinnersBoard({ patterns, showHeader = true, canViewRevenue = true }) {
  if (!patterns?.length) {
    return null;
  }

  return (
    <section className="editorial-panel p-6">
      {showHeader ? (
        <SectionHeader
          eyebrow="Pattern Winners"
          title="Scale formats, not one-offs"
          description={
            canViewRevenue
              ? "These are the format-level winners this month based on estimated paid subscribers and net revenue."
              : "These are the format-level winners this month based on estimated paid subscribers and paid-share quality."
          }
        />
      ) : null}

      <div className={`${showHeader ? "mt-6" : ""} grid gap-4 md:grid-cols-2 xl:grid-cols-4`}>
        {patterns.map((pattern, index) => {
          const finding = getStrategicFinding(pattern);

          return (
            <article key={pattern.key} className="editorial-card">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{pattern.title}</p>
                <span className="rounded-full border border-white/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Finding {index + 1}
                </span>
              </div>

              <h3 className="mt-4 font-display text-[2rem] leading-[1.02] text-white">{finding.statement}</h3>
              <p className="mt-4 text-[12px] leading-6 text-slate-300">{finding.interpretation}</p>

              <div className="mt-5 grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Proof</p>
                  <p className="mt-1 text-[1.1rem] font-semibold leading-5 text-white">{pattern.winner.estimatedPaidSubs} paid subs</p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">
                    {canViewRevenue ? `${formatCurrency(pattern.winner.estimatedNetRevenue)} est. net revenue` : `${pattern.winner.reels} reels in this pattern`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Quality</p>
                  <p className="mt-1 text-[1.1rem] font-semibold leading-5 text-white">{pattern.winner.paidShare}% paid share</p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">
                    {canViewRevenue ? `${pattern.winner.reels} reels in this pattern` : "Revenue hidden in worker mode"}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
