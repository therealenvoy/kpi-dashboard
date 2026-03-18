import { useEffect, useRef, useState } from "react";
import { formatCompactNumber, formatDate, formatRelative } from "../lib/formatters";
import {
  fetchMonetizationDaily,
  fetchMonetizationDay,
  fetchMonetizationStatus,
  fetchMonetizationSyncJob,
  fetchDailyLinkTaps,
  syncMonetization
} from "../lib/api";
import MonetizationDayDrawer from "../components/MonetizationDayDrawer";

/* ── Sparkline ── */
function MiniSparkline({ data, color, height = 48 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 160;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });
  const line = points.join(" ");
  const area = `${pad},${height} ${line} ${w - pad},${height}`;
  return (
    <svg width={w} height={height} className="absolute bottom-0 right-0 opacity-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${color.replace("#", "")})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Gradient bar ── */
function DailyBar({ value, max, gradient, glow }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-[6px] w-full rounded-full bg-white/[0.04]">
      <div className="h-full rounded-full transition-all duration-500" style={{
        width: `${pct}%`,
        background: gradient,
        boxShadow: pct > 20 ? `0 0 8px ${glow}` : "none"
      }} />
    </div>
  );
}

/* ── Delta badge ── */
function getDelta(today, yesterday) {
  if (today == null || yesterday == null) return null;
  const diff = today - yesterday;
  if (diff === 0) return { text: "0", tone: "text-slate-400 bg-white/[0.04]", arrow: "→" };
  const sign = diff > 0 ? "+" : "";
  return {
    text: `${sign}${formatCompactNumber(diff)}`,
    tone: diff > 0 ? "text-emerald-300 bg-emerald-500/10" : "text-rose-300 bg-rose-500/10",
    arrow: diff > 0 ? "↑" : "↓"
  };
}

export default function MonetizationPage() {
  const pollTimeoutRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const [status, setStatus] = useState(null);
  const [daily, setDaily] = useState([]);
  const [linkTapsByDate, setLinkTapsByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncJob, setSyncJob] = useState(null);
  const [error, setError] = useState("");

  async function loadData(options = {}) {
    const background = options.background || hasLoadedRef.current;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const [statusResponse, dailyResponse, linkTapsResponse] = await Promise.all([
        fetchMonetizationStatus(),
        fetchMonetizationDaily({ limit: 30 }),
        fetchDailyLinkTaps().catch(() => ({ data: [] }))
      ]);
      setStatus(statusResponse);
      setSyncJob(statusResponse.activeJob || null);
      setSyncing(statusResponse.activeJob?.status === "running");
      setDaily(dailyResponse.data || []);

      const tapsMap = {};
      for (const row of linkTapsResponse.data || []) tapsMap[row.date] = row.linkTaps;
      setLinkTapsByDate(tapsMap);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.details?.error?.message || err.message || "Unable to load.");
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedDate) return;
    fetchMonetizationDay(selectedDate).then(setSelectedDay).catch(() => setSelectedDay(null));
  }, [selectedDate]);

  useEffect(() => {
    if (!syncJob?.id || syncJob.status !== "running") return undefined;
    pollTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetchMonetizationSyncJob(syncJob.id);
        const nextJob = response.job;
        setSyncJob(nextJob);
        if (nextJob.status === "success") { setSyncing(false); await loadData({ background: true }); }
        else if (nextJob.status === "failed") { setSyncing(false); setError(nextJob.error?.message || "Sync failed."); }
      } catch (err) { setSyncing(false); setError(err.message || "Sync check failed."); }
    }, 2000);
    return () => { if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current); };
  }, [syncJob]);

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await syncMonetization({ days: 30 });
      setSyncJob(response.job || null);
      if (response.job?.status === "success") { setSyncing(false); await loadData({ background: true }); }
      else if (response.job?.status === "failed") { setSyncing(false); setError(response.job.error?.message || "Sync failed."); }
    } catch (err) { setError(err.message || "Sync failed."); setSyncing(false); }
  }

  const canViewRevenue = Boolean(status?.canViewRevenue);
  const latestFinishedAt = status?.latestSync?.finished_at || syncJob?.finishedAt || null;
  const hasCriticalError = Boolean(error && !daily.length && !loading);

  // Today + yesterday for deltas
  const todaySubs = daily[0]?.paidSubs ?? null;
  const yesterdaySubs = daily[1]?.paidSubs ?? null;
  const todayTaps = linkTapsByDate[daily[0]?.date] ?? null;
  const yesterdayTaps = linkTapsByDate[daily[1]?.date] ?? null;
  const subsDelta = getDelta(todaySubs, yesterdaySubs);
  const tapsDelta = getDelta(todayTaps, yesterdayTaps);

  // Sparkline data (last 7 days, reversed so oldest → newest)
  const subsSparkData = daily.slice(0, 7).map((r) => r.paidSubs || 0).reverse();
  const tapsSparkData = daily.slice(0, 7).map((r) => linkTapsByDate[r.date] || 0).reverse();

  // Max values for bar scaling
  const maxSubs = Math.max(...daily.map((r) => r.paidSubs || 0), 1);
  const maxTaps = Math.max(...daily.map((r) => linkTapsByDate[r.date] || 0), 1);

  // Peak day indices
  const peakSubsDate = daily.reduce((best, r) => (r.paidSubs || 0) > (best?.paidSubs || 0) ? r : best, daily[0])?.date;
  const peakTapsDate = daily.reduce((best, r) => (linkTapsByDate[r.date] || 0) > (linkTapsByDate[best?.date] || 0) ? r : best, daily[0])?.date;

  return (
    <div className="space-y-5">
      {(syncing || refreshing) && <div className="progress-slim fixed inset-x-0 top-0 z-40 h-[2px] bg-white/[0.04]" aria-hidden="true" />}

      {/* Hero: 2 KPI cards with sparklines */}
      <section className="hero-shell relative overflow-hidden px-6 py-6 md:px-8 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(215,184,120,0.06),transparent_18%)]" />
        <div className="relative space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500">
              {latestFinishedAt ? `Updated ${formatRelative(latestFinishedAt)}` : ""}
            </p>
            <button type="button" onClick={handleSync} disabled={syncing}
              className="rounded-full bg-sky-300 px-4 py-2 text-[12px] font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-60">
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Paid subs card */}
            <div className="relative overflow-hidden rounded-[1.4rem] border border-amber-400/10 bg-gradient-to-br from-amber-500/[0.06] to-transparent px-6 py-5">
              <MiniSparkline data={subsSparkData} color="#fbbf24" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/70">Paid subs today</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="font-display text-[3.8rem] leading-[0.85] text-white">{todaySubs != null ? formatCompactNumber(todaySubs) : "—"}</p>
                {subsDelta && (
                  <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${subsDelta.tone}`}>
                    {subsDelta.arrow} {subsDelta.text}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">7-day trend</p>
            </div>

            {/* Link taps card */}
            <div className="relative overflow-hidden rounded-[1.4rem] border border-sky-400/10 bg-gradient-to-br from-sky-500/[0.06] to-transparent px-6 py-5">
              <MiniSparkline data={tapsSparkData} color="#38bdf8" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/70">Bio link taps today</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="font-display text-[3.8rem] leading-[0.85] text-white">{todayTaps != null ? formatCompactNumber(todayTaps) : "—"}</p>
                {tapsDelta && (
                  <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tapsDelta.tone}`}>
                    {tapsDelta.arrow} {tapsDelta.text}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">7-day trend</p>
            </div>
          </div>

          {error && !hasCriticalError && <p className="text-[11px] text-rose-300">{error}</p>}
        </div>
      </section>

      {hasCriticalError && (
        <section className="panel border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p className="font-semibold">Monetization error.</p>
          <p className="mt-2 text-rose-100/80">{error}</p>
        </section>
      )}

      {loading ? (
        <section className="panel flex min-h-[200px] items-center justify-center p-6 text-sm text-slate-400">
          Loading…
        </section>
      ) : (
        /* Daily feed */
        <section className="space-y-1">
          {daily.map((row) => {
            const taps = linkTapsByDate[row.date] || 0;
            const isPeakSubs = row.date === peakSubsDate && (row.paidSubs || 0) > 0;
            const isPeakTaps = row.date === peakTapsDate && taps > 0;
            const isPeak = isPeakSubs || isPeakTaps;
            return (
              <button key={row.date} type="button" onClick={() => setSelectedDate(row.date)}
                className={`flex w-full items-center gap-4 rounded-[1rem] border px-4 py-3 text-left transition-all hover:bg-white/[0.04] ${
                  isPeak ? "border-white/12 bg-white/[0.03]" : "border-white/6 bg-white/[0.015]"
                }`}>
                {/* Date + peak badge */}
                <div className="w-20 shrink-0">
                  <span className="text-[13px] font-semibold text-white">{formatDate(row.date)}</span>
                  {isPeak && <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400/60">peak</p>}
                </div>

                {/* Bars */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right text-[11px] font-semibold text-amber-300">{formatCompactNumber(row.paidSubs)}</span>
                    <div className="flex-1">
                      <DailyBar value={row.paidSubs || 0} max={maxSubs} gradient="linear-gradient(90deg, #f59e0b, #fbbf24)" glow="rgba(251,191,36,0.3)" />
                    </div>
                    <span className="w-8 text-[9px] uppercase text-slate-500">subs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right text-[11px] font-semibold text-sky-300">{formatCompactNumber(taps)}</span>
                    <div className="flex-1">
                      <DailyBar value={taps} max={maxTaps} gradient="linear-gradient(90deg, #0284c7, #38bdf8)" glow="rgba(56,189,248,0.3)" />
                    </div>
                    <span className="w-8 text-[9px] uppercase text-slate-500">taps</span>
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      )}

      <MonetizationDayDrawer payload={selectedDay} canViewRevenue={canViewRevenue}
        onClose={() => { setSelectedDate(""); setSelectedDay(null); }} />
    </div>
  );
}
