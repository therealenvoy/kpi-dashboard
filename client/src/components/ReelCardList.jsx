import { useState } from "react";
import { formatCompactNumber, formatPercent, formatRelative, formatSignedCompactNumber, truncate } from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";

function getDecisionStyle(decision) {
  switch (decision) {
    case "scale": return "text-emerald-300 bg-emerald-500/12 border-emerald-400/20";
    case "drop": return "text-rose-300 bg-rose-500/12 border-rose-400/20";
    default: return "text-slate-300 bg-white/[0.04] border-white/8";
  }
}

function ReelCard({ reel, expanded, onToggle }) {
  const linkTaps = reel.linkTaps || 0;
  const hasLinkTaps = linkTaps > 0;

  return (
    <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] transition-colors hover:border-white/10">
      {/* Main row — always visible */}
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-4 py-3 text-left">
        <ReelThumbnail reel={reel} className="h-14 w-10 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-5 text-slate-100">{truncate(reel.caption, 60)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {hasLinkTaps ? (
              <span className="font-semibold text-amber-300">🔗 {formatCompactNumber(linkTaps)} link taps</span>
            ) : (
              <span className="text-slate-500">No link taps</span>
            )}
            {reel.topCountryCodes?.length > 0 && (
              <span className="text-slate-500">{reel.topCountryCodes.slice(0, 3).join(", ")}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
            <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.08em] ${getDecisionStyle(reel.workflowDecision)}`}>
              {reel.workflowDecision || "watch"}
            </span>
            <span className="text-slate-500">Score {reel.performanceScore ?? "—"}</span>
            <span className="text-slate-500">{reel.postedAt ? formatRelative(reel.postedAt) : "—"}</span>
          </div>
        </div>

        {/* Hero number — link taps */}
        <div className="shrink-0 text-right">
          <p className={`font-display text-[1.4rem] leading-none ${hasLinkTaps ? "text-amber-300" : "text-slate-600"}`}>
            {hasLinkTaps ? formatCompactNumber(linkTaps) : "—"}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-slate-500">taps</p>
        </div>

        <svg className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/6 px-4 py-3">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <MetricPill label="Views" value={formatCompactNumber(reel.views)} />
            <MetricPill label="Reach" value={formatCompactNumber(reel.reach)} />
            <MetricPill label="ER" value={formatPercent(reel.engagementRate)} />
            <MetricPill label="Saves" value={formatCompactNumber(reel.saves)} />
            <MetricPill label="Shares" value={formatCompactNumber(reel.shares)} />
            <MetricPill label="Likes" value={formatCompactNumber(reel.likes)} />
            <MetricPill label="24h" value={formatSignedCompactNumber(reel.views24hDelta)} />
            <MetricPill label="Boosted" value={reel.boosted ? "Yes" : "No"} />
            <MetricPill label="Surface" value={reel.inFeed ? "In feed" : "Reels only"} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {reel.permalink && (
              <a href={reel.permalink} target="_blank" rel="noreferrer"
                className="rounded-full border border-white/8 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white">
                Open on IG ↗
              </a>
            )}
            <button type="button"
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(reel.caption || ""); }}
              className="rounded-full border border-white/8 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white">
              Copy caption
            </button>
          </div>

          {reel.workflowReasons?.length > 0 && (
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{reel.workflowReasons.join(" ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-lg border border-white/6 bg-black/20 px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-white">{value}</p>
    </div>
  );
}

export default function ReelCardList({ reels, page, totalPages, totalItems, onPageChange }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {reels.map((reel) => (
          <ReelCard
            key={reel.reelId}
            reel={reel}
            expanded={expandedId === reel.reelId}
            onToggle={() => setExpandedId(expandedId === reel.reelId ? null : reel.reelId)}
          />
        ))}
        {reels.length === 0 && (
          <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-6 py-10 text-center text-[13px] text-slate-500">
            No reels match your current filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-500">{totalItems} reels · page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}
              className="rounded-full border border-white/8 px-3 py-1.5 font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}
              className="rounded-full border border-white/8 px-3 py-1.5 font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
