import { formatPercent, formatCompactNumber } from "../lib/formatters";

const TYPE_COLORS = {
  "Thirst Trap": { gradient: "linear-gradient(90deg, #e11d48, #fb7185)", glow: "rgba(251,113,133,0.3)" },
  "Skit": { gradient: "linear-gradient(90deg, #7c3aed, #a78bfa)", glow: "rgba(167,139,250,0.3)" },
  "Reaction/Meme": { gradient: "linear-gradient(90deg, #0284c7, #38bdf8)", glow: "rgba(56,189,248,0.3)" },
  "Interview": { gradient: "linear-gradient(90deg, #059669, #34d399)", glow: "rgba(52,211,153,0.3)" },
  "Untagged": { gradient: "linear-gradient(90deg, #475569, #64748b)", glow: "rgba(100,116,139,0.2)" }
};

export default function TapDrivers({ tapRateByReelType, averageTapRate }) {
  if (!tapRateByReelType || Object.keys(tapRateByReelType).length === 0) return null;

  // Sort by avg tap rate descending, exclude Untagged from top
  const entries = Object.entries(tapRateByReelType)
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.avgTapRate - a.avgTapRate);

  const maxRate = Math.max(...entries.map((e) => e.avgTapRate), 0.01);
  const topType = entries.find((e) => e.type !== "Untagged");

  return (
    <section className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">What drives tap rate</p>

      <div className="rounded-[1.4rem] border border-white/6 bg-white/[0.02] px-5 py-5 space-y-4">
        <p className="text-[11px] text-slate-400">Avg bio tap rate by reel type</p>

        <div className="space-y-3">
          {entries.map((entry) => {
            const pct = Math.min((entry.avgTapRate / maxRate) * 100, 100);
            const colors = TYPE_COLORS[entry.type] || TYPE_COLORS["Untagged"];
            const multiplier = averageTapRate > 0 ? (entry.avgTapRate / averageTapRate).toFixed(1) : "—";

            return (
              <div key={entry.type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-200">{entry.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-white">{formatPercent(entry.avgTapRate)}</span>
                    {entry.type !== "Untagged" && averageTapRate > 0 && (
                      <span className={`text-[10px] ${entry.avgTapRate > averageTapRate ? "text-emerald-300" : "text-slate-500"}`}>
                        {multiplier}×
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-[6px] w-full rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: colors.gradient,
                      boxShadow: pct > 20 ? `0 0 8px ${colors.glow}` : "none"
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  {entry.count} reel{entry.count !== 1 ? "s" : ""} · {formatCompactNumber(entry.totalTaps)} total taps
                </p>
              </div>
            );
          })}
        </div>

        {/* Auto-insight */}
        {topType && averageTapRate > 0 && (
          <p className="mt-2 text-[12px] leading-5 text-slate-400 border-t border-white/6 pt-3">
            <span className="text-white font-medium">{topType.type}</span> reels avg{" "}
            <span className="text-white">{formatPercent(topType.avgTapRate)}</span> tap rate —{" "}
            <span className="text-emerald-300">{(topType.avgTapRate / averageTapRate).toFixed(1)}× your overall average</span>
          </p>
        )}
      </div>
    </section>
  );
}
