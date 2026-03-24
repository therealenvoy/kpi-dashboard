import { useState } from "react";
import { formatCompactNumber, formatPercent, formatRelative, formatSignedCompactNumber, truncate } from "../lib/formatters";
import { tagReel } from "../lib/api";
import ReelThumbnail from "./ReelThumbnail";

const COUNTRY_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#a855f7", "#ef4444"];
const OTHERS_COLOR = "rgba(255,255,255,0.1)";
const RANK_FALLBACK = [40, 25, 18, 10, 7];

function buildCountryItems(entries) {
  const items = entries.slice(0, 5).map((e, i) => {
    if (typeof e === "string") return { code: e, pct: RANK_FALLBACK[i] || 5, color: COUNTRY_COLORS[i] };
    return { code: e.code, pct: e.pct ?? RANK_FALLBACK[i] ?? 5, color: COUNTRY_COLORS[i] };
  });
  const knownTotal = items.reduce((sum, c) => sum + c.pct, 0);
  const hasRealPct = entries.some((e) => typeof e !== "string" && e.pct != null);
  if (hasRealPct && knownTotal < 100) {
    items.push({ code: "Others", pct: 100 - knownTotal, color: OTHERS_COLOR });
  }
  return items;
}

// entries: array of { code, pct } or plain string codes
function CountryDonut({ entries, size = 28 }) {
  if (!entries?.length) return null;

  const items = buildCountryItems(entries);
  const total = items.reduce((sum, c) => sum + c.pct, 0) || 1;
  const r = size / 2;
  const strokeWidth = 4;
  const radius = r - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = items.map((c) => {
    const fraction = c.pct / total;
    const dash = fraction * circumference;
    const gap = circumference - dash;
    const rotation = (offset / total) * 360 - 90;
    offset += c.pct;

    return (
      <circle key={c.code} cx={r} cy={r} r={radius} fill="none"
        stroke={c.color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rotation} ${r} ${r})`} />
    );
  });

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={r} cy={r} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      {arcs}
    </svg>
  );
}

function getDecisionStyle(decision) {
  switch (decision) {
    case "scale": return "text-emerald-300 bg-emerald-500/12 border-emerald-400/20";
    case "drop": return "text-rose-300 bg-rose-500/12 border-rose-400/20";
    default: return "text-slate-300 bg-white/[0.04] border-white/8";
  }
}

function ReelCard({ reel, expanded, onToggle, averageTapRate, onTagChange }) {
  const linkTaps = reel.linkTaps || 0;
  const hasLinkTaps = linkTaps > 0;
  const tapRate = reel.tapRate || 0;
  const isHighTapRate = tapRate > 0 && averageTapRate > 0 && tapRate > averageTapRate;

  return (
    <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] transition-colors hover:border-white/10">
      {/* Main row — always visible */}
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 px-4 py-3 text-left">
        <ReelThumbnail reel={reel} className="h-14 w-10 shrink-0" />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-5 text-slate-100">{truncate(reel.caption, 60)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {hasLinkTaps ? (
              <span className="font-semibold text-amber-300">🔗 {formatCompactNumber(linkTaps)} taps</span>
            ) : (
              <span className="text-slate-500">No link taps</span>
            )}
            {tapRate > 0 && (
              <span className={`font-semibold ${isHighTapRate ? "text-emerald-300" : "text-slate-400"}`}>
                {formatPercent(tapRate)} tap rate
              </span>
            )}
            {reel.usAudienceShare > 0 && (
              <span className="text-sky-300/70">US {reel.usAudienceShare}%</span>
            )}
            {reel.reelType && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300">{reel.reelType}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
            <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.08em] ${getDecisionStyle(reel.workflowDecision)}`}>
              {reel.workflowDecision || "watch"}
            </span>
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
        <div className="border-t border-white/6 px-4 py-3 space-y-3">
          {/* Country audience + donut */}
          {(reel.topCountriesWithPct?.length > 0 || reel.topCountryCodes?.length > 0) && (() => {
            const raw = reel.topCountriesWithPct?.length ? reel.topCountriesWithPct : reel.topCountryCodes;
            const items = buildCountryItems(raw);
            return (
              <div className="flex items-start gap-4">
                <CountryDonut entries={raw} size={52} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {items.map((c) => (
                    <div key={c.code} className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="w-16 shrink-0 text-[11px] font-medium text-slate-200">{c.code}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color, opacity: 0.7 }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-[10px] text-slate-500">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Metrics grid */}
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

          {/* Actions + reel type */}
          <div className="flex flex-wrap items-center gap-2">
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

            <span className="mx-1 text-slate-600">|</span>

            {/* Reel type dropdown */}
            <select
              value={reel.reelType || ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onTagChange(reel.reelId, e.target.value || null); }}
              className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-300 outline-none focus:border-white/16"
            >
              <option value="">Tag type…</option>
              <option value="Thirst Trap">Thirst Trap</option>
              <option value="Skit">Skit</option>
              <option value="Reaction/Meme">Reaction/Meme</option>
              <option value="Interview">Interview</option>
            </select>
          </div>

          {reel.workflowReasons?.length > 0 && (
            <p className="text-[11px] leading-5 text-slate-500">{reel.workflowReasons.join(" ")}</p>
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

export default function ReelCardList({ reels, averageTapRate = 0, page, totalPages, totalItems, onPageChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const [localTags, setLocalTags] = useState({});

  async function handleTagChange(reelId, reelType) {
    setLocalTags((prev) => ({ ...prev, [reelId]: reelType }));
    try {
      await tagReel(reelId, reelType);
    } catch { /* silent — local state already updated */ }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {reels.map((reel) => {
          const mergedReel = localTags[reel.reelId] !== undefined
            ? { ...reel, reelType: localTags[reel.reelId] }
            : reel;
          return (
            <ReelCard
              key={reel.reelId}
              reel={mergedReel}
              averageTapRate={averageTapRate}
              expanded={expandedId === reel.reelId}
              onToggle={() => setExpandedId(expandedId === reel.reelId ? null : reel.reelId)}
              onTagChange={handleTagChange}
            />
          );
        })}
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
