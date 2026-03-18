import { useEffect, useState } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { fetchCorrelation } from "../lib/api";
import { formatCompactNumber } from "../lib/formatters";

function truncate(text, max) {
  if (!text || text.length <= max) return text || "";
  return text.slice(0, max) + "…";
}

function buildTimelineData(spikeDays, meta) {
  if (!spikeDays?.length) return [];
  const spikeSet = new Set(spikeDays.map((d) => d.date));
  return spikeDays
    .map((day) => ({
      date: day.date.slice(5),
      newSubs: day.newSubs,
      baseline: day.baseline,
      isSpike: spikeSet.has(day.date)
    }));
}

export default function CorrelationPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCorrelation({ days: 60 })
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load correlation data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-400">
        Analyzing reel-to-subscription patterns…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
        {error}
      </div>
    );
  }

  if (!data || data.meta?.insufficientData) {
    return (
      <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-slate-400">Need at least 14 days of subscription data to detect patterns.</p>
        <p className="mt-2 text-xs text-slate-500">Currently have {data?.meta?.totalDays || 0} days. Keep the daily sync running.</p>
      </div>
    );
  }

  const { meta, spikeDays, topCorrelatedReels, patterns, insights } = data;
  const timelineData = buildTimelineData(spikeDays, meta);

  return (
    <div className="space-y-6">
      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((insight, i) => (
            <div key={i} className="rounded-[1.2rem] border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3">
              <p className="text-[13px] leading-6 text-slate-200">{insight}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline chart */}
      {timelineData.length > 0 && (
        <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.02] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Subscription spikes</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={timelineData}>
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0b111b", borderColor: "rgba(255,255,255,0.12)", borderRadius: "12px", fontSize: "12px" }}
                labelFormatter={(v) => `Date: ${v}`}
              />
              <Bar dataKey="newSubs" name="New subs" radius={[4, 4, 0, 0]} maxBarSize={20}>
                {timelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.isSpike ? "#d4a853" : "rgba(255,255,255,0.1)"} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="baseline" name="7d average" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">What spike-preceding reels have in common</p>
          <div className="grid gap-3 md:grid-cols-3">
            {patterns.map((p) => (
              <div key={p.metric} className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{p.label}</p>
                <p className="mt-2 font-display text-2xl text-white">{p.multiplier}x</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Spike reels: {p.spikeReelAvg}% vs all reels: {p.allReelAvg}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top correlated reels */}
      {topCorrelatedReels.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Reels most often posted before sub spikes ({meta.spikeDayCount} spike days detected)
          </p>
          <div className="space-y-2">
            {topCorrelatedReels.slice(0, 5).map((reel) => (
              <div key={reel.reelId} className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] leading-6 text-slate-200">{truncate(reel.caption, 80)}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Score {reel.avgPerformanceScore}/100 · Saves top {100 - reel.avgSavesPercentile}%
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-xl text-white">{reel.spikeAppearances}<span className="text-sm text-slate-400">/{reel.totalSpikeDays}</span></p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">spikes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spike days detail */}
      {spikeDays.length > 0 && (
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recent spike days</p>
          <div className="space-y-2">
            {spikeDays.slice(0, 5).map((day) => (
              <div key={day.date} className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{day.date}</span>
                    <span className="ml-3 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">+{day.spikePercent}% above baseline</span>
                  </div>
                  <div className="text-right text-sm">
                    <span className="text-white">{day.newSubs}</span>
                    <span className="text-slate-500"> subs (avg {day.baseline})</span>
                  </div>
                </div>
                {day.activeReels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.activeReels.slice(0, 3).map((reel) => (
                      <span key={reel.reelId} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300">
                        {truncate(reel.caption, 40)} · {Math.round(reel.hoursBeforeSpike)}h before
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <p className="text-[11px] text-slate-500">
        Analyzed {meta.totalDays} days · {meta.spikeDayCount} spike days detected · Avg {meta.averageDailySubs} subs/day
      </p>
    </div>
  );
}
