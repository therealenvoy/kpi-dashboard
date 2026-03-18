import { useEffect, useState } from "react";
import { fetchCorrelation } from "../lib/api";

export default function CorrelationInsightsStrip() {
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    fetchCorrelation({ days: 60 })
      .then((data) => {
        if (data?.insights?.length && !data.meta?.insufficientData) {
          setInsights(data.insights.slice(0, 2));
        }
      })
      .catch(() => {});
  }, []);

  if (!insights.length) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {insights.map((text, i) => (
        <div key={i} className="rounded-full border border-amber-500/15 bg-amber-500/[0.04] px-4 py-2 text-[12px] leading-5 text-slate-300">
          {text}
        </div>
      ))}
    </div>
  );
}
