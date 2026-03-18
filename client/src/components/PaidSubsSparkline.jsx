import { useEffect, useState } from "react";
import { fetchPaidSubsTrend } from "../lib/api";

export default function PaidSubsSparkline() {
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    fetchPaidSubsTrend()
      .then((response) => setTrend(response.trend || []))
      .catch(() => setTrend([]));
  }, []);

  if (!trend.length) return null;

  const values = trend.map((d) => d.paidSubs);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 120;
  const height = 32;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const latest = values[values.length - 1];
  const previous = values.length >= 2 ? values[values.length - 2] : latest;
  const delta = latest - previous;
  const isUp = delta > 0;
  const isDown = delta < 0;

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={isDown ? "#f87171" : "#d4a853"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.split(",")[0]}
            cy={point.split(",")[1]}
            r="2"
            fill={i === points.length - 1 ? (isDown ? "#f87171" : "#d4a853") : "transparent"}
          />
        ))}
      </svg>
      <div className="text-[11px] leading-tight">
        <span className="font-semibold text-white">{latest}</span>
        {delta !== 0 && (
          <span className={`ml-1 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
            {isUp ? "+" : ""}{delta}
          </span>
        )}
        <p className="text-slate-500">{trend.length}d trend</p>
      </div>
    </div>
  );
}
