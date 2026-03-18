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

function DailyBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/[0.04]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function getDelta(today, yesterday) {
  if (today == null || yesterday == null) return null;
  const diff = today - yesterday;
  if (diff === 0) return { text: "same as yesterday", tone: "text-slate-500" };
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${formatCompactNumber(diff)} vs yesterday`, tone: diff > 0 ? "text-emerald-300" : "text-rose-300" };
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

  // Max values for bar scaling
  const maxSubs = Math.max(...daily.map((r) => r.paidSubs || 0), 1);
  const maxTaps = Math.max(...daily.map((r) => linkTapsByDate[r.date] || 0), 1);

  return (
    <div className="space-y-6">
      {(syncing || refreshing) && <div className="progress-slim fixed inset-x-0 top-0 z-40 h-[2px] bg-white/[0.04]" aria-hidden="true" />}

      {/* Hero: 2 KPI cards */}
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

          <div className="grid gap-6 md:grid-cols-2">
            {/* Paid subs KPI */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/60">Paid subs today</p>
              <p className="font-display text-[3.5rem] leading-[0.9] text-white">{todaySubs != null ? formatCompactNumber(todaySubs) : "—"}</p>
              {subsDelta && <p className={`text-[12px] font-medium ${subsDelta.tone}`}>{subsDelta.text}</p>}
            </div>

            {/* Link taps KPI */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/60">Bio link taps today</p>
              <p className="font-display text-[3.5rem] leading-[0.9] text-white">{todayTaps != null ? formatCompactNumber(todayTaps) : "—"}</p>
              {tapsDelta && <p className={`text-[12px] font-medium ${tapsDelta.tone}`}>{tapsDelta.text}</p>}
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
        <section className="space-y-1.5">
          {daily.map((row) => {
            const taps = linkTapsByDate[row.date] || 0;
            return (
              <button key={row.date} type="button" onClick={() => setSelectedDate(row.date)}
                className="flex w-full items-center gap-4 rounded-[1rem] border border-white/6 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/12 hover:bg-white/[0.04]">
                {/* Date */}
                <span className="w-20 shrink-0 text-[13px] font-semibold text-white">{formatDate(row.date)}</span>

                {/* Bars */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right text-[11px] font-semibold text-amber-300">{formatCompactNumber(row.paidSubs)}</span>
                    <div className="flex-1"><DailyBar value={row.paidSubs || 0} max={maxSubs} color="#fbbf24" /></div>
                    <span className="w-8 text-[9px] uppercase text-slate-500">subs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right text-[11px] font-semibold text-sky-300">{formatCompactNumber(taps)}</span>
                    <div className="flex-1"><DailyBar value={taps} max={maxTaps} color="#38bdf8" /></div>
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
