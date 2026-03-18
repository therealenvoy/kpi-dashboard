import { startTransition, useDeferredValue, useEffect, useReducer, useState } from "react";
import { fetchAccount, fetchPaidSubsSummary, fetchReels, fetchReport, fetchSnapshotsWithCompare, fetchViewer, lockViewer, unlockViewer } from "./lib/api";
import {
  formatCompactNumber,
  formatMultiplier,
  formatPercent,
  formatRelative
} from "./lib/formatters";
import DashboardFilters from "./components/DashboardFilters";
import KpiCard from "./components/KpiCard";
import LifecycleView from "./components/LifecycleView";
import MobileReelsBriefing from "./components/MobileReelsBriefing";
import MobileDecisionFeed from "./components/MobileDecisionFeed";
import CollapsibleAnalysisSection from "./components/CollapsibleAnalysisSection";
import PaidSubsSparkline from "./components/PaidSubsSparkline";
import ReelModal from "./components/ReelModal";
import ReelsTable from "./components/ReelsTable";
import ReportPanel from "./components/ReportPanel";
import MonetizationPage from "./pages/MonetizationPage";
import MonetizationPasswordPrompt from "./components/MonetizationPasswordPrompt";

const PAGE_SIZE = 25;

const INITIAL_FILTERS = {
  q: "",
  preset: "",
  boosted: "all",
  surface: "all",
  topCountry: "",
  engagementBand: "all",
  workflowDecision: "all",
  weekday: "all",
  minViews: "0"
};

const INITIAL_STATE = {
  account: null,
  tableData: [],
  summary: null,
  report: null,
  pagination: { total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false },
  paidSubsSummary: null,
  refreshMeta: null,
  loading: true,
  hasLoadedOnce: false,
  error: ""
};

function dashboardReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: "" };
    case "LOAD_SUCCESS":
      return {
        ...state,
        account: action.account,
        tableData: action.tableData,
        summary: action.summary,
        pagination: action.pagination,
        paidSubsSummary: action.paidSubsSummary,
        report: action.report,
        refreshMeta: action.refreshMeta,
        loading: false,
        hasLoadedOnce: true
      };
    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

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
  if (!expiresAt) return "Waiting for first sync";
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Refreshing now";
  return `Next refresh in ${Math.ceil(diffMs / (1000 * 60))}m`;
}

export default function App() {
  const [state, dispatch] = useReducer(dashboardReducer, INITIAL_STATE);
  const { account, tableData, summary, report, pagination, paidSubsSummary, refreshMeta, loading, hasLoadedOnce, error } = state;

  const [sort, setSort] = useState("postedAt");
  const [order, setOrder] = useState("desc");
  const [timeframe, setTimeframe] = useState("30d");
  const [page, setPage] = useState(1);
  const [selectedReel, setSelectedReel] = useState(null);
  const [compareReelId, setCompareReelId] = useState("");
  const [snapshotPayload, setSnapshotPayload] = useState({ data: [], compare: null, benchmark: [] });
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [clockTick, setClockTick] = useState(Date.now());
  const [dashboardMode, setDashboardMode] = useState("reels");
  const [viewerState, setViewerState] = useState({ viewerMode: "worker", canViewRevenue: false, adminCodeConfigured: false });
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const deferredQuery = useDeferredValue(filters.q);

  // Clock tick for refresh countdown
  useEffect(() => {
    const intervalId = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Viewer state
  useEffect(() => {
    fetchViewer().then(setViewerState).catch(() => {});
  }, []);

  // URL-based admin/worker toggle
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const adminCode = params.get("admin");
    const workerMode = params.get("worker");
    if (!adminCode && !workerMode) return;

    const cleanUrl = () => {
      const nextParams = new URLSearchParams(window.location.search);
      nextParams.delete("admin");
      nextParams.delete("worker");
      const nextQuery = nextParams.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);
    };

    if (adminCode) {
      unlockViewer(adminCode).then((r) => setViewerState((c) => ({ ...c, ...r }))).finally(cleanUrl);
      return;
    }
    lockViewer().then((r) => setViewerState((c) => ({ ...c, ...r }))).finally(cleanUrl);
  }, []);

  // Auto-refresh when cache expires
  useEffect(() => {
    if (!refreshMeta?.expiresAt || loading) return;
    if (Date.now() >= new Date(refreshMeta.expiresAt).getTime()) {
      setRefreshNonce((c) => c + 1);
    }
  }, [clockTick, loading, refreshMeta]);

  // Main data load
  useEffect(() => {
    if (dashboardMode !== "reels") return undefined;
    let ignore = false;

    async function loadDashboard() {
      dispatch({ type: "LOAD_START" });
      try {
        const baseParams = buildBaseParams(timeframe, filters, deferredQuery);
        const [accountResponse, reelsResponse, reportResponse, paidSubsResponse] = await Promise.all([
          fetchAccount(),
          fetchReels({ ...baseParams, sort, order, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
          fetchReport(baseParams),
          fetchPaidSubsSummary().catch(() => null)
        ]);
        if (ignore) return;
        dispatch({
          type: "LOAD_SUCCESS",
          account: accountResponse,
          tableData: reelsResponse.data,
          summary: reelsResponse.summary,
          pagination: reelsResponse.pagination,
          paidSubsSummary: paidSubsResponse,
          report: reportResponse,
          refreshMeta: reelsResponse.refresh || accountResponse.refresh || reportResponse.refresh || null
        });
      } catch (requestError) {
        if (!ignore) {
          dispatch({ type: "LOAD_ERROR", error: requestError.response?.data?.details?.error?.message || requestError.message || "Unable to load dashboard." });
        }
      }
    }

    loadDashboard();
    return () => { ignore = true; };
  }, [deferredQuery, filters.boosted, filters.engagementBand, filters.minViews, filters.preset, filters.surface, filters.topCountry, filters.workflowDecision, filters.weekday, order, page, refreshNonce, sort, timeframe, dashboardMode]);

  // Snapshot loading
  useEffect(() => {
    if (dashboardMode !== "reels" || !selectedReel) return undefined;
    let ignore = false;
    setLoadingSnapshots(true);
    fetchSnapshotsWithCompare(selectedReel.reelId, compareReelId || undefined)
      .then((r) => { if (!ignore) setSnapshotPayload(r); })
      .catch(() => { if (!ignore) setSnapshotPayload({ data: [], compare: null, benchmark: [] }); })
      .finally(() => { if (!ignore) setLoadingSnapshots(false); });
    return () => { ignore = true; };
  }, [compareReelId, selectedReel, dashboardMode]);

  function handleSortChange(nextSort) {
    if (sort === nextSort) { setOrder((c) => (c === "asc" ? "desc" : "asc")); }
    else { setSort(nextSort); setOrder("desc"); }
    setPage(1);
  }

  function handleTimeframeChange(nextTimeframe) {
    setTimeframe(nextTimeframe);
    setPage(1);
  }

  function updateFilter(key, value) {
    setFilters((c) => ({ ...c, [key]: value }));
    startTransition(() => setPage(1));
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS);
    startTransition(() => setPage(1));
  }

  function handleSelectReel(reel) {
    setSelectedReel(reel);
    setCompareReelId("");
  }

  async function handleCopySummary() {
    if (!report?.markdown) return;
    try { await navigator.clipboard.writeText(report.markdown); } catch (_e) {}
  }

  async function handleLockAdminView() {
    try {
      const r = await lockViewer();
      setViewerState((c) => ({ ...c, ...r }));
      if (dashboardMode === "monetization") setDashboardMode("reels");
    } catch (_e) {}
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
      const r = await unlockViewer(code);
      setViewerState((c) => ({ ...c, ...r }));
      setShowPasswordPrompt(false);
      setDashboardMode("monetization");
    } catch (_e) {
      setUnlockError("Invalid password.");
    }
  }

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));
  const showInitialLoading = loading && !hasLoadedOnce;
  const exportUrl = `/api/reels/export.csv?${new URLSearchParams(buildBaseParams(timeframe, filters, deferredQuery)).toString()}`;
  const compareOptions = tableData.filter((reel) => reel?.reelId && reel.reelId !== selectedReel?.reelId);

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
                  <button type="button" onClick={handleLockAdminView} className="rounded-full border border-white/8 px-3 py-1 font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-white/16 hover:text-white">
                    Lock admin
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="inline-flex rounded-full border border-white/6 bg-white/[0.02] p-1 text-sm">
            {[{ key: "reels", label: "Reels Intelligence" }, { key: "monetization", label: "Monetization" }].map((item) => (
              <button key={item.key} type="button" onClick={() => handleTabClick(item.key)}
                className={`rounded-full px-4 py-2 font-semibold transition-colors ${dashboardMode === item.key ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>
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
                      <button key={value} type="button" onClick={() => handleTimeframeChange(value)}
                        className={`rounded-full px-4 py-2 font-semibold transition-colors ${timeframe === value ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>
                        {value === "30d" ? "Last 30 days" : "All time"}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setRefreshNonce((c) => c + 1)} className="text-[12px] text-slate-400 transition-colors hover:text-white">
                    Refresh this view
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                <KpiCard label="Followers" value={formatCompactNumber(account?.followers)} helper={account?.countries?.[0] ? `Largest audience in ${account.countries[0].code}` : "Live audience size"} accent="#8fbfff" />
                <KpiCard label="Reels in view" value={formatCompactNumber(summary?.count ?? account?.mediaCount)} helper={filters.preset ? `Preset: ${filters.preset}` : timeframe === "30d" ? "Latest 30-day slice" : "Full historical library"} accent="#9cb0d3" />
                <KpiCard label="Avg engagement" value={formatPercent(summary?.averageEngagementRate)} helper={summary?.medianEngagementRate ? `${formatMultiplier((summary.averageEngagementRate || 0) / summary.medianEngagementRate)} median reel` : "Mean engagement rate in this view"} accent="#c8d2e5" />
                <KpiCard label="Avg views / reel" value={formatCompactNumber(summary?.averageViews)} helper={summary?.benchmarks?.previous7dAverageViews ? `${formatMultiplier((summary.averageViews || 0) / summary.benchmarks.previous7dAverageViews)} previous 7d cohort` : "Average current views per reel"} accent="#5875af" />
                <KpiCard label="Paid subs" value={formatCompactNumber(paidSubsSummary?.latest?.paidSubs)} helper={paidSubsSummary?.previous?.paidSubs != null ? `Previous day: ${formatCompactNumber(paidSubsSummary.previous.paidSubs)}` : "Paid subscriber count"} accent="#d4a853" />
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Subs trend (7d)</p>
                  <div className="mt-2"><PaidSubsSparkline /></div>
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

              <MobileReelsBriefing summary={summary} topReels={tableData.slice(0, 5)} onSelectReel={handleSelectReel} />

              <section className="space-y-6 border-t border-white/6 pt-8">
                <DashboardFilters
                  query={filters.q} preset={filters.preset} boosted={filters.boosted}
                  surface={filters.surface} topCountry={filters.topCountry}
                  engagementBand={filters.engagementBand} workflowDecision={filters.workflowDecision}
                  weekday={filters.weekday} minViews={filters.minViews}
                  presets={summary?.presets || []}
                  countryOptions={account?.countries?.map((c) => c.code) || []}
                  resultCount={pagination.total}
                  onQueryChange={(v) => updateFilter("q", v)} onPresetChange={(v) => updateFilter("preset", v)}
                  onBoostedChange={(v) => updateFilter("boosted", v)} onSurfaceChange={(v) => updateFilter("surface", v)}
                  onTopCountryChange={(v) => updateFilter("topCountry", v)}
                  onEngagementBandChange={(v) => updateFilter("engagementBand", v)}
                  onWorkflowDecisionChange={(v) => updateFilter("workflowDecision", v)}
                  onWeekdayChange={(v) => updateFilter("weekday", v)}
                  onMinViewsChange={(v) => updateFilter("minViews", v)}
                  onReset={resetFilters}
                />

                <MobileDecisionFeed reels={tableData} onSelectReel={handleSelectReel} />
                <div className="mt-6 hidden md:block">
                  <ReelsTable
                    reels={tableData} sort={sort} order={order} onSortChange={handleSortChange}
                    page={page} totalPages={totalPages} totalItems={pagination.total}
                    onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
                    onSelectReel={handleSelectReel}
                  />
                </div>
              </section>

              <section className="space-y-6">
                <CollapsibleAnalysisSection title="Lifecycle view" description="Inspect where momentum is building or dying across the reel aging curve.">
                  <LifecycleView lifecycle={summary?.lifecycle || []} onSelectReel={handleSelectReel} />
                </CollapsibleAnalysisSection>
                <CollapsibleAnalysisSection title="Operator report" description="Full written readout and export summary.">
                  <ReportPanel report={report} onCopySummary={handleCopySummary} exportUrl={exportUrl} />
                </CollapsibleAnalysisSection>
              </section>
            </>
          )}

          <ReelModal
            reel={selectedReel} snapshots={snapshotPayload.data}
            compareSnapshots={snapshotPayload.compare} benchmarkSnapshots={snapshotPayload.benchmark}
            compareOptions={compareOptions} compareReelId={compareReelId}
            onCompareChange={setCompareReelId} benchmarks={summary?.benchmarks}
            loading={loadingSnapshots}
            onClose={() => { setSelectedReel(null); setCompareReelId(""); setSnapshotPayload({ data: [], compare: null, benchmark: [] }); }}
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
