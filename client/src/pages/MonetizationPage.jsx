import { useEffect, useRef, useState } from "react";
import { formatCompactNumber, formatCurrency, formatDate, formatFullNumber, formatPercent, formatRelative, truncate } from "../lib/formatters";
import {
  fetchMonetizationDaily,
  fetchMonetizationDay,
  fetchMonetizationStatus,
  fetchMonetizationSyncJob,
  syncMonetization
} from "../lib/api";
import MonetizationDayDrawer from "../components/MonetizationDayDrawer";
import ReelThumbnail from "../components/ReelThumbnail";
import MobileBriefingMode from "../components/MobileBriefingMode";

function getVerdictTone(metrics) {
  if (!metrics) return "text-slate-400";
  if (metrics.paidShare >= 20) return "text-emerald-300";
  if (metrics.paidShare >= 15) return "text-amber-200";
  return "text-rose-300";
}

export default function MonetizationPage() {
  const pollTimeoutRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const [status, setStatus] = useState(null);
  const [daily, setDaily] = useState([]);
  const [summary, setSummary] = useState(null);
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
      const [statusResponse, dailyResponse] = await Promise.all([fetchMonetizationStatus(), fetchMonetizationDaily({ limit: 30 })]);
      setStatus(statusResponse);
      setSyncJob(statusResponse.activeJob || null);
      setSyncing(statusResponse.activeJob?.status === "running");
      setDaily(dailyResponse.data || []);
      setSummary(dailyResponse.summary || null);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.details?.error?.message || err.message || "Unable to load monetization.");
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

  const currentMonth = summary?.currentMonth;
  const metrics = summary?.operatorMetrics;
  const canViewRevenue = Boolean(status?.canViewRevenue);
  const latestFinishedAt = status?.latestSync?.finished_at || syncJob?.finishedAt || null;
  const hasCriticalError = Boolean(error && !summary && !daily.length && !loading);
  const topDrivers = summary?.topPaidSubsReels || [];

  return (
    <div className="space-y-6">
      {(syncing || refreshing) && <div className="progress-slim fixed inset-x-0 top-0 z-40 h-[2px] bg-white/[0.04]" aria-hidden="true" />}

      {/* Hero: 3 KPI cards + status */}
      <section className="hero-shell relative overflow-hidden px-6 py-5 md:px-8 md:py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(215,184,120,0.1),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_36%)]" />
        <div className="relative space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-[13px] font-medium text-slate-200">
                {canViewRevenue ? "Revenue dashboard" : "Subscriber dashboard"}
              </p>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${getVerdictTone(metrics)}`}>
                {!metrics ? "Waiting for data" : metrics.paidShare >= 20 ? "Healthy month" : metrics.paidShare >= 15 ? "Mixed signals" : "Quality too soft"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" onClick={handleSync} disabled={syncing}
                className="rounded-full bg-sky-300 px-4 py-2 text-[12px] font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-60">
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              {latestFinishedAt && <span className="text-[11px] text-slate-500">Updated {formatRelative(latestFinishedAt)}</span>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/60">This month</p>
              <p className="mt-2 font-display text-[1.6rem] leading-[1] text-white">
                {canViewRevenue ? formatCurrency(currentMonth?.totalRevenue) : formatFullNumber(currentMonth?.totalPaidSubs)}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {canViewRevenue ? `${formatFullNumber(currentMonth?.totalPaidSubs)} paid subs` : `${formatFullNumber(currentMonth?.totalNewSubs)} new subs total`}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/60">Paid share</p>
              <p className="mt-2 font-display text-[1.6rem] leading-[1] text-white">{formatPercent(metrics?.paidShare)}</p>
              <p className="mt-1.5 text-[11px] text-slate-500">{formatFullNumber(currentMonth?.totalPaidSubs)} paid / {formatFullNumber(currentMonth?.totalFreeSubs)} free</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/60">
                {canViewRevenue ? "Rev / paid sub" : "New subs today"}
              </p>
              <p className="mt-2 font-display text-[1.6rem] leading-[1] text-white">
                {canViewRevenue ? formatCurrency(metrics?.revenuePerPaidSub) : formatCompactNumber(daily[0]?.newSubs)}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {canViewRevenue ? "Average revenue per paying subscriber" : `${formatCompactNumber(daily[0]?.paidSubs)} paid today`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <span>{daily.length} days loaded</span>
            {status?.autoSync?.enabled && <span>Auto-sync daily at {status.autoSync.scheduleUtc}</span>}
            {error && !hasCriticalError && <span className="text-rose-300">{error}</span>}
          </div>
        </div>
      </section>

      {hasCriticalError && (
        <section className="panel border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p className="font-semibold">Monetization module error.</p>
          <p className="mt-2 text-rose-100/80">{error}</p>
        </section>
      )}

      {loading ? (
        <section className="panel flex min-h-[200px] items-center justify-center p-6 text-sm text-slate-400">
          Loading monetization metrics…
        </section>
      ) : (
        <>
          <MobileBriefingMode
            currentMonth={currentMonth} metrics={metrics}
            topPaidReel={topDrivers[0] || null}
            topMoneyReels={summary?.topMoneyReels}
            patternWinners={summary?.patternWinners}
            canViewRevenue={canViewRevenue}
            onOpenDay={status?.latestDate ? setSelectedDate : undefined}
            latestDate={status?.latestDate}
          />

          {/* Top drivers — unified list */}
          {topDrivers.length > 0 && (
            <section className="hidden space-y-3 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Top reel drivers this month</p>
              <div className="space-y-2">
                {topDrivers.slice(0, 5).map((reel, index) => (
                  <div key={reel.reelId} className="flex items-center gap-4 rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                    <span className="w-6 text-center font-display text-lg text-slate-500">{index + 1}</span>
                    <ReelThumbnail reel={reel} className="h-12 w-9 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-5 text-slate-100">{truncate(reel.caption, 70)}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                        <span className="text-amber-300">{reel.estimatedPaidSubs} paid subs</span>
                        <span>Paid share {reel.paidShare}%</span>
                        {canViewRevenue && <span>{formatCurrency(reel.estimatedNetRevenue)} rev</span>}
                      </div>
                    </div>
                    {reel.permalink && (
                      <a href={reel.permalink} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-[11px] text-slate-500 transition-colors hover:text-white">IG ↗</a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Daily table — slim columns */}
          <section className="hidden space-y-3 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Daily breakdown — click any day to drill down</p>
            <div className="table-scroll overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-1.5">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Date</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Visits</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">New subs</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Paid</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Free</th>
                    {canViewRevenue && <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Revenue</th>}
                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">Conv %</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((row) => (
                    <tr key={row.date} onClick={() => setSelectedDate(row.date)} className="drilldown-row cursor-pointer rounded-3xl transition-colors">
                      <td className="rounded-l-3xl px-3 py-3 text-[13px] font-semibold text-white">{formatDate(row.date)}</td>
                      <td className="px-3 py-3 text-[13px] text-slate-400">{formatCompactNumber(row.profileVisitsTotal)}</td>
                      <td className="px-3 py-3 text-[13px] text-slate-300">{formatCompactNumber(row.newSubs)}</td>
                      <td className="px-3 py-3 text-[13px] font-semibold text-amber-200">{formatCompactNumber(row.paidSubs)}</td>
                      <td className="px-3 py-3 text-[13px] text-slate-500">{formatCompactNumber(row.freeSubs)}</td>
                      {canViewRevenue && <td className="px-3 py-3 text-[13px] font-semibold text-amber-100">{formatCurrency(row.earningsTotal)}</td>}
                      <td className="rounded-r-3xl px-3 py-3 text-[13px] text-slate-400">{formatPercent(row.visitToPaidConversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <MonetizationDayDrawer payload={selectedDay} canViewRevenue={canViewRevenue}
        onClose={() => { setSelectedDate(""); setSelectedDay(null); }} />
    </div>
  );
}
