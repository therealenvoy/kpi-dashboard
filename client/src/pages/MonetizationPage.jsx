import { useEffect, useRef, useState } from "react";
import { formatDateTime, formatRelative } from "../lib/formatters";
import {
  fetchMonetizationDaily,
  fetchMonetizationDay,
  fetchMonetizationStatus,
  fetchMonetizationSyncJob,
  syncMonetization
} from "../lib/api";
import MonetizationCommandCenter from "../components/MonetizationCommandCenter";
import MonetizationInsights from "../components/MonetizationInsights";
import MonetizationDailyTable from "../components/MonetizationDailyTable";
import MonetizationDayDrawer from "../components/MonetizationDayDrawer";
import PatternWinnersBoard from "../components/PatternWinnersBoard";
import TopMoneyReels from "../components/TopMoneyReels";
import TopPaidSubsReels from "../components/TopPaidSubsReels";
import SectionHeader from "../components/SectionHeader";
import MobileBriefingMode from "../components/MobileBriefingMode";

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
  const [notice, setNotice] = useState("");

  async function loadData(options = {}) {
    const background = options.background || hasLoadedRef.current;

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [statusResponse, dailyResponse] = await Promise.all([fetchMonetizationStatus(), fetchMonetizationDaily({ limit: 30 })]);
      setStatus(statusResponse);
      setSyncJob(statusResponse.activeJob || null);
      setSyncing(statusResponse.activeJob?.status === "running");
      setDaily(dailyResponse.data || []);
      setSummary(dailyResponse.summary || null);
      hasLoadedRef.current = true;
    } catch (requestError) {
      setError(requestError.response?.data?.details?.error?.message || requestError.message || "Unable to load monetization.");
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    fetchMonetizationDay(selectedDate)
      .then((response) => setSelectedDay(response))
      .catch(() => setSelectedDay(null));
  }, [selectedDate]);

  useEffect(() => {
    if (!syncJob?.id || syncJob.status !== "running") {
      return undefined;
    }

    pollTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetchMonetizationSyncJob(syncJob.id);
        const nextJob = response.job;
        setSyncJob(nextJob);

        if (nextJob.status === "success") {
          setSyncing(false);
          setNotice("Fresh monetization data is ready.");
          await loadData({ background: true });
        } else if (nextJob.status === "failed") {
          setSyncing(false);
          setError(nextJob.error?.message || "Sync failed.");
        }
      } catch (requestError) {
        setSyncing(false);
        setError(requestError.response?.data?.error || requestError.message || "Unable to check sync status.");
      }
    }, 2000);

    return () => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [syncJob]);

  async function handleSync() {
    setSyncing(true);
    setNotice("Sync started. The page will refresh in place when the new snapshot is ready.");

    try {
      const response = await syncMonetization({ days: 30 });
      setSyncJob(response.job || null);

      if (response.job?.status === "success") {
        setSyncing(false);
        setNotice("Fresh monetization data is ready.");
        await loadData({ background: true });
      } else if (response.job?.status === "failed") {
        setSyncing(false);
        setError(response.job.error?.message || "Sync failed.");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.details?.error?.message || requestError.message || "Sync failed.");
      setSyncing(false);
    }
  }

  const currentMonth = summary?.currentMonth;
  const topPaidReel = summary?.topPaidSubsReels?.[0] || null;
  const topPattern = summary?.patternWinners?.[0] || null;
  const latestFinishedAt = status?.latestSync?.finished_at || syncJob?.finishedAt || null;
  const hasCriticalError = Boolean(error && !summary && !daily.length && !loading);
  const canViewRevenue = Boolean(status?.canViewRevenue);

  return (
    <div className="space-y-8">
      {syncing || refreshing ? (
        <div className="progress-slim fixed inset-x-0 top-0 z-40 h-[2px] bg-white/[0.04]" aria-hidden="true" />
      ) : null}

      <section className="space-y-4">
        <div className="hidden md:block">
          <MonetizationCommandCenter
            currentMonth={currentMonth}
            metrics={summary?.operatorMetrics}
            topPaidReel={topPaidReel}
            topPattern={topPattern}
            canViewRevenue={canViewRevenue}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="panel px-6 py-6 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Monetization</p>
                  {latestFinishedAt ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">
                      <span className="status-pulse relative inline-flex h-2 w-2 rounded-full bg-emerald-300 text-emerald-300" />
                      <span className="text-[11px] text-slate-300">Last updated {formatRelative(latestFinishedAt)}</span>
                    </div>
                  ) : null}
                  {refreshing ? (
                    <span className="text-[11px] text-sky-100/75">Refreshing in place…</span>
                  ) : null}
                </div>
                <h1 className="font-display text-[1.75rem] leading-tight text-white md:text-[2.45rem]">
                  {canViewRevenue ? "Daily revenue board" : "Daily subscriber board"}
                </h1>
                <p className="max-w-2xl text-[13px] leading-6 text-slate-300">
                  {canViewRevenue
                    ? "Use the control room above for the answer. Use the sections below to understand the drivers, formats, and daily details behind it."
                    : "This view hides money and keeps the focus on daily paid subscribers, quality, and the reels most likely bringing buyers."}
                </p>
                {notice ? <p className="text-[12px] text-sky-100/72">{notice}</p> : null}
                {!hasCriticalError && error ? <p className="text-[12px] text-rose-200/80">{error}</p> : null}
              </div>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="rounded-full bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {syncing ? "Syncing…" : "Sync 30 days"}
              </button>
            </div>
          </div>

          <div className="panel hidden px-6 py-6 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">System</p>
            <p className="mt-3 text-[13px] leading-6 text-slate-300">
              {status?.enabled
                ? `Monetization sync is configured. Latest stored day: ${status.latestDate || "none yet"}.`
                : status?.message || "Set DATABASE_URL and ONLYFANS_API_KEY to enable this module."}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Viewer mode: {status?.viewerMode || "worker"} {canViewRevenue ? "· money visible" : "· money hidden"}
            </p>
            {latestFinishedAt ? (
              <p className="mt-3 text-[12px] text-slate-400">Latest completed sync: {formatDateTime(latestFinishedAt)}</p>
            ) : null}
            {syncJob?.status === "running" ? (
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-sky-200">
                Background sync running for {syncJob.payload?.startDate} to {syncJob.payload?.endDate}
              </p>
            ) : null}
            {status?.latestSync?.details?.metricCoverage ? (
              <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Paid/free coverage: {status.latestSync.details.metricCoverage.completedDays}/
                {status.latestSync.details.metricCoverage.requestedDays} days on the last sync
              </p>
            ) : null}
            {canViewRevenue && status?.latestSync?.details?.revenueCoverage ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                Revenue split:
                {status.latestSync.details.revenueCoverage.total ? " total" : " total fallback"}
                {" · "}
                {status.latestSync.details.revenueCoverage.messages ? "messages" : "messages unavailable"}
                {" · "}
                {status.latestSync.details.revenueCoverage.tips ? "tips" : "tips unavailable"}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {hasCriticalError ? (
        <section className="panel border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p className="font-semibold">Monetization module error.</p>
          <p className="mt-2 text-rose-100/80">{error}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="panel flex min-h-[280px] items-center justify-center p-6 text-sm text-slate-400">
          Loading monetization metrics…
        </section>
      ) : (
        <>
          <MobileBriefingMode
            currentMonth={currentMonth}
            metrics={summary?.operatorMetrics}
            topPaidReel={topPaidReel}
            topMoneyReels={summary?.topMoneyReels}
            patternWinners={summary?.patternWinners}
            canViewRevenue={canViewRevenue}
            onOpenDay={status?.latestDate ? setSelectedDate : undefined}
            latestDate={status?.latestDate}
          />

          <section className="hidden space-y-4 md:block">
            <SectionHeader
              eyebrow="Health"
              title="Are we having a good month?"
              description="This zone reduces the month to signal quality, subscriber quality, and the one operating read that matters right now."
            />
            <MonetizationInsights metrics={summary?.operatorMetrics} showHeader={false} canViewRevenue={canViewRevenue} />
          </section>

          <section className="hidden space-y-4 md:block">
            <SectionHeader
              eyebrow="Drivers"
              title="Which reels are actually moving buyers?"
              description={
                canViewRevenue
                  ? "Read these as ranked decisions. One board shows which reels appear to create paid subscribers. The other shows which ones appear to create money."
                  : "Read these as ranked decisions. This view keeps the focus on paid-subscriber pressure, not revenue."
              }
            />
            <div className={`grid gap-4 ${canViewRevenue ? "2xl:grid-cols-2" : ""}`}>
              <TopPaidSubsReels reels={summary?.topPaidSubsReels} showHeader={false} />
              {canViewRevenue ? <TopMoneyReels reels={summary?.topMoneyReels} showHeader={false} /> : null}
            </div>
          </section>

          <section className="hidden space-y-4 md:block">
            <SectionHeader
              eyebrow="Patterns"
              title="What format is winning this month?"
              description={
                canViewRevenue
                  ? "This is the scaling layer. Use it to repeat the formats that are producing paid subscribers and net revenue, not just spikes in attention."
                  : "This is the scaling layer. Use it to repeat the formats that are producing paid subscribers, not just spikes in attention."
              }
            />
            <PatternWinnersBoard patterns={summary?.patternWinners} showHeader={false} canViewRevenue={canViewRevenue} />
          </section>

          <section className="hidden space-y-4 md:block">
            <SectionHeader
              eyebrow="Daily Detail"
              title="Forensic detail, only when you need it."
              description="This is intentionally quieter. Use it after the higher-level answers above, when you want to inspect a single day and open the reel-driver drill-down."
            />
            <MonetizationDailyTable rows={daily} onSelectDay={setSelectedDate} canViewRevenue={canViewRevenue} />
          </section>
        </>
      )}

      <MonetizationDayDrawer
        payload={selectedDay}
        canViewRevenue={canViewRevenue}
        onClose={() => {
          setSelectedDate("");
          setSelectedDay(null);
        }}
      />
    </div>
  );
}
