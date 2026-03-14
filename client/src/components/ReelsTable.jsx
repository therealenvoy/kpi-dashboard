import { useState } from "react";
import {
  formatCompactNumber,
  formatDecisionLabel,
  formatDate,
  formatPercent,
  formatSignedCompactNumber,
  getReelInsightReasons,
  getWorkflowTone,
  getEngagementTone,
  truncate
} from "../lib/formatters";
import ReelThumbnail from "./ReelThumbnail";
import SectionHeader from "./SectionHeader";

const SORTABLE_COLUMNS = [
  { key: "workflow", label: "Score" },
  { key: "postedAt", label: "Posted" },
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "engagement", label: "ER" },
  { key: "saves", label: "Saves" },
  { key: "shares", label: "Shares" }
];

function getRowClasses(decision) {
  if (decision === "scale") {
    return "bg-[linear-gradient(90deg,rgba(215,184,120,0.08),rgba(255,255,255,0.02)_22%,rgba(255,255,255,0.015)_100%)] ring-1 ring-[#d7b878]/18 hover:ring-[#d7b878]/30";
  }

  if (decision === "drop") {
    return "bg-white/[0.01] opacity-[0.72] ring-1 ring-white/0 hover:bg-white/[0.02] hover:opacity-[0.9]";
  }

  return "bg-white/[0.015] ring-1 ring-white/0 hover:bg-white/[0.03] hover:ring-white/8";
}

function SortButton({ column, sort, order, onChange }) {
  const isActive = sort === column.key;

  return (
    <button
      type="button"
      onClick={() => onChange(column.key)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
        isActive
          ? "border border-[#d7b878]/30 bg-[#d7b878]/12 text-white shadow-[0_0_0_1px_rgba(215,184,120,0.08)]"
          : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200"
      }`}
    >
      {column.label}
      <span className={`text-[11px] ${isActive ? "text-[#d7b878]" : "text-slate-500"}`}>{isActive ? (order === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  function handleCopy(event) {
    event.stopPropagation();
    navigator.clipboard.writeText(text || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Ignore clipboard failures.
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-white/16 hover:text-white"
    >
      {copied ? "Copied!" : "Copy caption"}
    </button>
  );
}

function InsightTooltip({ reel }) {
  const reasons = reel.workflowReasons?.length
    ? reel.workflowReasons
    : getReelInsightReasons(reel);

  if (!reasons?.length) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-white/10 bg-slate-800 px-4 py-3 opacity-0 shadow-xl transition-opacity group-hover/insight:opacity-100">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Why this decision</p>
      <ul className="space-y-1">
        {reasons.map((reason, index) => (
          <li key={index} className="text-[12px] leading-5 text-slate-200">• {reason}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ReelsTable({
  reels,
  sort,
  order,
  onSortChange,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onSelectReel
}) {
  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Library"
        title="Reels performance"
        description="The operating table: newest first by default, optimized for scanning the reels that need attention now."
      />

      <div className="table-scroll mt-6 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Reel
              </th>
              {SORTABLE_COLUMNS.map((column) => (
                <th key={column.key} className="px-3 py-2 text-left">
                  <SortButton column={column} sort={sort} order={order} onChange={onSortChange} />
                </th>
              ))}
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Comments
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                24h
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Reach
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {reels.map((reel, index) => (
              <tr
                key={reel.reelId}
                onClick={() => onSelectReel(reel)}
                className={`group cursor-pointer rounded-3xl transition-all duration-150 ${getRowClasses(reel.workflowDecision)}`}
              >
                <td className="rounded-l-3xl px-3 py-4">
                  <div className="flex min-w-[300px] items-center gap-4">
                    <ReelThumbnail reel={reel} className="h-20 w-14 shrink-0" />
                    <div className="space-y-1">
                      <p className="max-w-[260px] text-[14px] font-medium leading-6 text-slate-100">
                        {truncate(reel.caption, 96)}
                      </p>
                      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.06em] text-slate-500">
                        <span>{reel.boosted ? "Boosted" : "Organic"}</span>
                        <span>{reel.inFeed ? "In feed" : "Reels only"}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getWorkflowTone(reel.workflowDecision)}`}>
                          {formatDecisionLabel(reel.workflowDecision)}
                        </span>
                      </div>
                      <div className="group/insight relative">
                        <p className="cursor-help text-[11px] leading-5 text-slate-500 underline decoration-dotted decoration-slate-600 underline-offset-2">
                          {getReelInsightReasons(reel).join(" · ") || reel.workflowAction}
                        </p>
                        <InsightTooltip reel={reel} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4">
                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getWorkflowTone(reel.workflowDecision)}`}>
                      {formatDecisionLabel(reel.workflowDecision)}
                    </span>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      {reel.workflowDecision === "scale"
                        ? "Ready now"
                        : reel.workflowDecision === "drop"
                          ? "Low priority"
                          : "Check again"}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-4 text-[13px] text-slate-300">{formatDate(reel.postedAt)}</td>
                <td className="px-3 py-4 font-semibold text-white">{formatCompactNumber(reel.views)}</td>
                <td className="px-3 py-4 text-[13px] text-slate-300">{formatCompactNumber(reel.likes)}</td>
                <td className="px-3 py-4">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getEngagementTone(reel.engagementRate)}`}>
                    {formatPercent(reel.engagementRate)}
                  </span>
                </td>
                <td className="px-3 py-4 text-[13px] text-slate-300">{formatCompactNumber(reel.saves)}</td>
                <td className="px-3 py-4 text-[13px] text-slate-300">{formatCompactNumber(reel.shares)}</td>
                <td className="px-3 py-4 text-[13px] text-slate-300">{formatCompactNumber(reel.comments)}</td>
                <td className="px-3 py-4 text-[13px] font-medium text-[#d7b878]">{formatSignedCompactNumber(reel.views24hDelta)}</td>
                <td className="px-3 py-4 text-[13px] text-slate-300">{formatCompactNumber(reel.reach)}</td>
                <td className="rounded-r-3xl px-3 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {reel.permalink ? (
                        <a
                          href={reel.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-full border border-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-white/16 hover:text-white"
                        >
                          IG ↗
                        </a>
                      ) : null}
                      <CopyButton text={reel.caption} />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 transition-colors group-hover:text-white">
                      <span>Open</span>
                      <span className="text-[12px] text-[#d7b878] transition-transform group-hover:translate-x-0.5">↗</span>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/6 pt-5 md:flex-row md:items-center md:justify-between">
        <p className="text-[12px] text-slate-400">
          Showing {reels.length} of {totalItems} reels, page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="rounded-full border border-white/8 px-4 py-2 text-[12px] font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="rounded-full border border-white/8 px-4 py-2 text-[12px] font-semibold text-slate-300 transition-colors hover:border-white/16 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
