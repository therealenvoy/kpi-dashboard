import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { fetchAccount, fetchReels, fetchReport, fetchSnapshotsWithCompare, fetchViewer, lockViewer, unlockViewer } from "./lib/api";
import {
  formatCompactNumber,
  formatDateTime,
  formatMultiplier,
  formatPercent,
  formatRelative
} from "./lib/formatters";
import ActionPlanPanel from "./components/ActionPlanPanel";
import AlertsBanner, { buildAlerts } from "./components/AlertsBanner";
import CountryBreakdown from "./components/CountryBreakdown";
import CollapsibleAnalysisSection from "./components/CollapsibleAnalysisSection";
import DashboardFilters from "./components/DashboardFilters";
import KpiCard from "./components/KpiCard";
import LifecycleView from "./components/LifecycleView";
import MobileReelsBriefing from "./components/MobileReelsBriefing";
import MobileDecisionFeed from "./components/MobileDecisionFeed";
import ReelModal from "./components/ReelModal";
import ReelsDecisionSystem from "./components/ReelsDecisionSystem";
import ReelsTable from "./components/ReelsTable";
import ReportPanel from "./components/ReportPanel";
import TopPerformerBoard from "./components/TopPerformerBoard";
import MonetizationPage from "./pages/MonetizationPage";
import MonetizationPasswordPrompt from "./components/MonetizationPasswordPrompt";

const PAGE_SIZE = 25;

const topConfig = [
  { key: "breakout", label: "Breakout", sort: "breakout", order: "desc", metric: "breakoutScore" },
  { key: "views", label: "Views", sort: "views", order: "desc", metric: "views" },
  { key: "engagement", label: "Engagement rate", sort: "engagement", order: "desc", metric: "engagementRate" },
  { key: "saves", label: "Saves", sort: "saves", order: "desc", metric: "saves" },
  { key: "shares", label: "Shares", sort: "shares", order: "desc", metric: "shares" }
];

function buildBaseParams(timeframe, filters, deferredQuery) {
  return {
    timeframe,
    q: deferredQuery,
    preset: filters.preset,
    boosted: filters.boosted,
    surface: filters.surface,
    topCountry: filters.topCountry,
    engagementBand: filters.engagementBand,
    workflowDecision: filters.workflowDecision,
    weekday: filters.weekday,
    minViews: Number(filters.minViews) || 0
  };
}

function getRefreshCountdown(expiresAt) {
  if (!expiresAt) {
    return "Waiting for first sync";
  }

  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return "Refreshing now";
  }

  const minutes = Math.ceil(diffMs / (1000 * 60));
  return `Next refresh in ${minutes}m`;
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false });
  const [sort, setSort] = useState("postedAt");
  const [order, setOrder] = useState("desc");
  const [timeframe, setTimeframe] = useState("30d");
  const [page, setPage] = useState(1);
  const [topLists, setTopLists] = useState({});
  const [selectedReel, setSelectedReel] = useState(null);
  const [compareReelId, setCompareReelId] = useState("");
  const [snapshotPayload, setSnapshotPayload] = useState({ data: [], compare: null, benchmark: [] });
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState("");
  const [selectedTopMetric, setSelectedTopMetric] = useState("breakout");
  const [refreshMeta, setRefreshMeta] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [clockTick, setClockTick] = useState(Date.now());
  const [dashboardMode, setDashboardMode] = useState("reels");
  const [viewerState, setViewerState] = useState({ viewerMode: "worker", canViewRevenue: false, adminCodeConfigured: false });
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const stored = sessionStorage.getItem("dismissed-alerts");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filters, setFilters] = useState({
    q: "",
    preset: "",
    boosted: "all",
    surface: "all",
    topCountry: "",
    engagementBand: "all",
    workflowDecision: "all",
    weekday: "all",
    minViews: "0"
  });
  const deferredQuery = useDeferredValue(filters.q);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchViewer()
      .then((response) => setViewerState(response))
      .catch(() => {
        // Ignore viewer state failures and keep the safe worker default.
      });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adminCode = params.get("admin");
    const workerMode = params.get("worker");

    if (!adminCode && !workerMode) {
      return;
    }

    const cleanUrl = () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("admin");
      nextParams.delete("worker");
      const nextQuery = nextParams.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    };

    if (adminCode) {
      unlockViewer(adminCode)
        .then((response) => setViewerState((current) => ({ ...current, ...response })))
        .finally(cleanUrl);
      return;
    }

    lockViewer()
      .then((response) => setViewerState((current) => ({ ...current, ...response })))
      .finally(cleanUrl);
  }, []);

  async function handleLockAdminView() {
    try {
      const response = await lockViewer();
      setViewerState((current) => ({ ...current, ...response }));
      if (dashboardMode === "monetization") {
        setDashboardMode("reels");
      }
    } catch (_error) {
      // Ignore lock failures and keep current viewer state visible.
    }
  }

  function handleTabClick(key) {
    if (key === "monetization" && viewerState.viewerMode !== "admin") {
      setShowPasswordPrompt(true);
      return;
    }
    setDashboardMode(key);
  }

  async function handleUnlockSubmit(code) {
    setUnlockError("");
    try {
      const response = await unlockViewer(code);
      setViewerState((current) => ({ ...current, ...response }));
      setShowPasswordPrompt(false);
      setDashboardMode("monetization");
    } catch (_error) {
      setUnlockError("Invalid password.");
    }
  }

  useEffect(() => {
    if (!refreshMeta?.expiresAt || loading) {
      return;
    }

    if (Date.now() >= new Date(refreshMeta.expiresAt).getTime()) {
      setRefreshNonce((current) => current + 1);
    }
  }, [clockTick, loading, refreshMeta]);

  useEffect(() => {
    if (dashboardMode !== "reels") {
      return undefined;
    }

    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const baseParams = buildBaseParams(timeframe, filters, deferredQuery);
        const [accountResponse, reelsResponse, reportResponse, ...topResponses] = await Promise.all([
          fetchAccount(),
          fetchReels({
            ...baseParams,
            sort,
            order,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE
          }),
          fetchReport(baseParams),
          ...topConfig.map((config) =>
            fetchReels({
              ...baseParams,
              sort: config.sort,
              order: config.order,
              limit: 5,
              offset: 0
            })
          )
        ]);

        if (ignore) {
          return;
        }

        const listMap = topConfig.reduce((acc, config, index) => {
          acc[config.key] = topResponses[index].data;
          return acc;
        }, {});

        setAccount(accountResponse);
        setTableData(reelsResponse.data);
        setSummary(reelsResponse.summary);
        setPagination(reelsResponse.pagination);
        setTopLists(listMap);
        setReport(reportResponse);
        setRefreshMeta(reelsResponse.refresh || accountResponse.refresh || reportResponse.refresh || null);
        setHasLoadedOnce(true);
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.response?.data?.details?.error?.message || requestError.message || "Unable to load dashboard.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      ignore = true;
    };
  }, [
    deferredQuery,
    filters.boosted,
    filters.engagementBand,
    filters.minViews,
    filters.preset,
    filters.surface,
    filters.topCountry,
    filters.workflowDecision,
    filters.weekday,
    order,
    page,
    refreshNonce,
    sort,
    timeframe,
    dashboardMode
  ]);

  useEffect(() => {
    if (dashboardMode !== "reels") {
      return undefined;
    }

    if (!selectedReel) {
      return undefined;
    }

    let ignore = false;
    setLoadingSnapshots(true);

    fetchSnapshotsWithCompare(selectedReel.reelId, compareReelId || undefined)
      .then((response) => {
        if (!ignore) {
          setSnapshotPayload(response);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSnapshotPayload({ data: [], compare: null, benchmark: [] });
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingSnapshots(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [compareReelId, selectedReel]);

  function handleSortChange(nextSort) {
    if (sort === nextSort) {
      setOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSort(nextSort);
      setOrder("desc");
    }
    setPage(1);
  }

  function handleTimeframeChange(nextTimeframe) {
    setTimeframe(nextTimeframe);
    setPage(1);
  }

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value
    }));
    startTransition(() => {
      setPage(1);
    });
  }

  function applyWorkflowDecisionFilter(value) {
    setFilters((current) => ({
      ...current,
      preset: "",
      workflowDecision: value
    }));
    startTransition(() => {
      setPage(1);
    });
  }

  function resetFilters() {
    setFilters({
      q: "",
      preset: "",
      boosted: "all",
      surface: "all",
      topCountry: "",
      engagementBand: "all",
      workflowDecision: "all",
      weekday: "all",
      minViews: "0"
    });
    startTransition(() => {
      setPage(1);
    });
  }

  function handleSelectReel(reel) {
    setSelectedReel(reel);
    setCompareReelId("");
  }

  async function handleCopySummary() {
    if (!report?.markdown) {
      return;
    }

    try {
      await navigator.clipboard.writeText(report.markdown);
    } catch (_error) {
      // Ignore clipboard failures in unsupported environments.
    }
  }

  function handleDismissAlert(reelId) {
    setDismissedAlerts((current) => {
      const next = new Set(current);
      next.add(reelId);
      try {
        sessionStorage.setItem("dismissed-alerts", JSON.stringify([...next]));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }

  const allUniqueReels = Object.values(
    [...tableData, ...Object.values(topLists).flat()].reduce((acc, reel) => {
      if (reel?.reelId) {
        acc[reel.reelId] = reel;
      }
      return acc;
    }, {})
  );
  const activeAlerts = buildAlerts(allUniqueReels).filter((a) => !dismissedAlerts.has(a.reelId));

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));
  const showInitialLoading = loading && !hasLoadedOnce;
  const exportUrl = `/api/reels/export.csv?${new URLSearchParams(buildBaseParams(timeframe, filters, deferredQuery)).toString()}`;
  const compareOptions = Object.values(
    [...tableData, ...Object.values(topLists).flat()].reduce((acc, reel) => {
      if (reel && reel.reelId && reel.reelId !== selectedReel?.reelId) {
        acc[reel.reelId] = reel;
      }
      return acc;
    }, {})
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
      <section className="panel px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workspace</p>
            <p className="mt-1 text-[13px] text-slate-300">{account?.username ? `@${account.username}` : "Reels dashboard"}</p>
            {dashboardMode === "monetization" ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 font-semibold uppercase tracking-[0.08em] text-slate-300">
                  {viewerState.viewerMode === "admin" ? "Admin mode" : "Worker mode"}
                </span>
                {viewerState.viewerMode === "admin" ? (
                  <button
                    type="button"
                    onClick={handleLockAdminView}
                    className="rounded-full border border-white/8 px-3 py-1 font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-white/16 hover:text-white"
                  >
                    Lock admin
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="inline-flex rounded-full border border-white/6 bg-white/[0.02] p-1 text-sm">
            {[
              { key: "reels", label: "Reels Intelligence" },
              { key: "monetization", label: "Monetization" }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleTabClick(item.key)}
                className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                  dashboardMode === item.key ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {dashboardMode === "monetization" ? (
        <MonetizationPage />
      ) : (
        <>
          <section className="hero-shell relative overflow-hidden px-6 py-6 md:px-8 md:py-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(215,184,120,0.06),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_34%)]" />
            <div className="relative space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Content intelligence</p>
                  <p className="text-[13px] leading-6 text-slate-300">
                    A sharp read on what to repeat next for {account?.username ? `@${account.username}` : "@itslittlealyson__"}.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                  <div className="inline-flex rounded-full border border-white/6 bg-white/[0.02] p-1 text-sm">
                    {["30d", "all"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleTimeframeChange(value)}
                        className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                          timeframe === value ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {value === "30d" ? "Last 30 days" : "All time"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRefreshNonce((current) => current + 1)}
                    className="text-[12px] text-slate-400 transition-colors hover:text-white"
                  >
                    Refresh this view
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Followers"
                    value={formatCompactNumber(account?.followers)}
                    helper={account?.countries?.[0] ? `Largest audience in ${account.countries[0].code}` : "Live audience size"}
                    accent="#8fbfff"
                  />
                  <KpiCard
                    label="Reels in view"
                    value={formatCompactNumber(summary?.count ?? account?.mediaCount)}
                    helper={filters.preset ? `Preset: ${filters.preset}` : timeframe === "30d" ? "Latest 30-day slice" : "Full historical library"}
                    accent="#9cb0d3"
                  />
                  <KpiCard
                    label="Avg engagement"
                    value={formatPercent(summary?.averageEngagementRate)}
                    helper={
                      summary?.medianEngagementRate
                        ? `${formatMultiplier((summary.averageEngagementRate || 0) / summary.medianEngagementRate)} median reel`
                        : "Mean engagement rate in this view"
                    }
                    accent="#c8d2e5"
                  />
                  <KpiCard
                    label="Avg views / reel"
                    value={formatCompactNumber(summary?.averageViews)}
                    helper={
                      summary?.benchmarks?.previous7dAverageViews
                        ? `${formatMultiplier((summary.averageViews || 0) / summary.benchmarks.previous7dAverageViews)} previous 7d cohort`
                        : "Average current views per reel"
                    }
                    accent="#5875af"
                  />
                </div>

                <div className="support-card">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Account</p>
                      <h2 className="mt-2 font-display text-[1.8rem] leading-[1] text-white">
                        {account?.username ? `@${account.username}` : "@itslittlealyson__"}
                      </h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Last refresh</p>
                        <p className="mt-2 text-[14px] font-semibold text-white">{formatDateTime(account?.lastUpdated || summary?.latestUpdate)}</p>
                        <p className="mt-1 text-[12px] text-slate-500">{formatRelative(account?.lastUpdated || summary?.latestUpdate)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Overview</p>
                        <p className="mt-2 text-[12px] leading-6 text-slate-400">
                          {summary?.count
                            ? `${summary.workflowRoadmap?.find((lane) => lane.key === "scale")?.count || 0} ready to scale now. ${
                                summary.workflowRoadmap?.find((lane) => lane.key === "watch")?.count || 0
                              } still need another read.`
                            : "Waiting for live sheet data."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Current slice</p>
                  <p className="mt-2 text-[13px] text-slate-200">{pagination.total || 0} reels in focus</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Timeframe</p>
                  <p className="mt-2 text-[13px] text-slate-200">{timeframe === "30d" ? "Last 30 days" : "Full archive"}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Refresh</p>
                  <p className="mt-2 text-[13px] text-slate-200">{getRefreshCountdown(refreshMeta?.expiresAt)}</p>
                </div>
                <div className="rounded-[1.2rem] border border-white/6 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Last updated</p>
                  <p className="mt-2 text-[13px] text-slate-200">{formatRelative(account?.lastUpdated || summary?.latestUpdate)}</p>
                </div>
              </div>
            </div>
          </section>

      {error ? (
        <section className="panel border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
          <p className="font-semibold">Dashboard data failed to load.</p>
          <p className="mt-2 text-rose-100/80">{error}</p>
        </section>
      ) : null}

      {showInitialLoading ? (
        <section className="panel flex min-h-[280px] items-center justify-center p-6 text-sm text-slate-400">
          Pulling the latest KPI data from Google Sheets…
        </section>
      ) : (
        <>
          {loading ? (
            <section className="panel border border-white/6 bg-white/[0.02] px-5 py-4 text-[12px] text-slate-300">
              Refreshing the current view without resetting your scroll position…
            </section>
          ) : null}

          <MobileReelsBriefing
            summary={summary}
            topReels={topLists.breakout || []}
            onSelectReel={handleSelectReel}
          />

          <div className="hidden space-y-8 md:block">
            <AlertsBanner
              alerts={activeAlerts}
              onDismiss={handleDismissAlert}
              onSelectReel={handleSelectReel}
            />

            <ActionPlanPanel summary={summary} onSelectReel={handleSelectReel} />

            <section className="space-y-6 border-t border-white/6 pt-8">
              <div className="space-y-2 px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Top reels</p>
                <h3 className="font-display text-[1.55rem] leading-[1] text-white md:text-[2rem]">Winners and risks</h3>
                <p className="max-w-3xl text-[12px] leading-6 text-slate-400">
                  Your leading reels ranked by key metrics. Compare and validate which examples deserve attention.
                </p>
              </div>

              <TopPerformerBoard
                configs={topConfig}
                reels={topLists[selectedTopMetric] || []}
                activeMetric={selectedTopMetric}
                onMetricChange={setSelectedTopMetric}
                onSelectReel={handleSelectReel}
              />
            </section>
          </div>

          <section className="space-y-8 border-t border-white/6 pt-8">
            <div className="space-y-3 px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Deep dive</p>
              <h2 className="font-display text-[1.8rem] leading-[1] text-white md:text-[2.35rem]">Supporting analysis</h2>
              <p className="max-w-3xl text-[13px] leading-6 text-slate-400">
                Expand any section below when you need to dig deeper into the data behind the top-line actions.
              </p>
            </div>

            <CollapsibleAnalysisSection
              title="Decision system"
              description="The scale / watch / drop framework. Open this to see the full breakdown of which reels fall into each lane."
            >
              <ReelsDecisionSystem
                roadmap={summary?.workflowRoadmap || []}
                executiveSummary={summary?.executiveSummary || []}
                onApplyDecision={applyWorkflowDecisionFilter}
                onSelectReel={handleSelectReel}
              />
            </CollapsibleAnalysisSection>

            <CollapsibleAnalysisSection
              title="Full reels table"
              description="Search, filter, and sort the full library. Use this when you need to find a specific reel or dig into the numbers."
            >
              <DashboardFilters
                query={filters.q}
                preset={filters.preset}
                boosted={filters.boosted}
                surface={filters.surface}
                topCountry={filters.topCountry}
                engagementBand={filters.engagementBand}
                workflowDecision={filters.workflowDecision}
                weekday={filters.weekday}
                minViews={filters.minViews}
                presets={summary?.presets || []}
                countryOptions={account?.countries?.map((country) => country.code) || []}
                resultCount={pagination.total}
                onQueryChange={(value) => updateFilter("q", value)}
                onPresetChange={(value) => updateFilter("preset", value)}
                onBoostedChange={(value) => updateFilter("boosted", value)}
                onSurfaceChange={(value) => updateFilter("surface", value)}
                onTopCountryChange={(value) => updateFilter("topCountry", value)}
                onEngagementBandChange={(value) => updateFilter("engagementBand", value)}
                onWorkflowDecisionChange={(value) => updateFilter("workflowDecision", value)}
                onWeekdayChange={(value) => updateFilter("weekday", value)}
                onMinViewsChange={(value) => updateFilter("minViews", value)}
                onReset={resetFilters}
              />

              <MobileDecisionFeed reels={tableData} onSelectReel={handleSelectReel} />
              <div className="mt-6 hidden md:block">
                <ReelsTable
                  reels={tableData}
                  sort={sort}
                  order={order}
                  onSortChange={handleSortChange}
                  page={page}
                  totalPages={totalPages}
                  totalItems={pagination.total}
                  onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
                  onSelectReel={handleSelectReel}
                />
              </div>
            </CollapsibleAnalysisSection>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <CollapsibleAnalysisSection
                title="Lifecycle view"
                description="Open this when you want to inspect where momentum is building or dying across the reel aging curve."
              >
                <LifecycleView lifecycle={summary?.lifecycle || []} onSelectReel={handleSelectReel} />
              </CollapsibleAnalysisSection>

              {account?.countries?.length ? (
                <CollapsibleAnalysisSection
                  title="Country breakdown"
                  description="Open this only when geography matters for the current decision or distribution plan."
                >
                  <CountryBreakdown countries={account.countries} />
                </CollapsibleAnalysisSection>
              ) : null}
            </div>

            <CollapsibleAnalysisSection
              title="Operator report"
              description="Keep this collapsed until you need the full written readout or export summary."
            >
              <ReportPanel report={report} onCopySummary={handleCopySummary} exportUrl={exportUrl} />
            </CollapsibleAnalysisSection>
          </section>
        </>
      )}

          <ReelModal
            reel={selectedReel}
            snapshots={snapshotPayload.data}
            compareSnapshots={snapshotPayload.compare}
            benchmarkSnapshots={snapshotPayload.benchmark}
            compareOptions={compareOptions}
            compareReelId={compareReelId}
            onCompareChange={setCompareReelId}
            benchmarks={summary?.benchmarks}
            loading={loadingSnapshots}
            onClose={() => {
              setSelectedReel(null);
              setCompareReelId("");
              setSnapshotPayload({ data: [], compare: null, benchmark: [] });
            }}
          />
        </>
      )}
      {showPasswordPrompt ? (
        <MonetizationPasswordPrompt
          error={unlockError}
          onSubmit={handleUnlockSubmit}
          onClose={() => { setShowPasswordPrompt(false); setUnlockError(""); }}
        />
      ) : null}
    </main>
  );
}
