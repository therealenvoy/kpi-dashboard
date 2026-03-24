import { startTransition, useDeferredValue, useEffect, useReducer, useState } from "react";
import { fetchAccount, fetchPaidSubsSummary, fetchReels, fetchReport, fetchViewer, forceRefresh, lockViewer, unlockViewer } from "./lib/api";
import {
  formatCompactNumber,
  formatMultiplier,
  formatPercent,
  formatRelative
} from "./lib/formatters";
import KpiCard from "./components/KpiCard";
import PaidSubsSparkline from "./components/PaidSubsSparkline";
import ReelCardList from "./components/ReelCardList";
import MonetizationPage from "./pages/MonetizationPage";
import MonetizationPasswordPrompt from "./components/MonetizationPasswordPrompt";

const PAGE_SIZE = 25;

const INITIAL_FILTERS = {
  q: "",
  workflowDecision: "all"
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
    workflowDecision: filters.workflowDecision
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

  const [sort, setSort] = useState("linkTaps");
  const [order, setOrder] = useState("desc");
  const [timeframe, setTimeframe] = useState("30d");
  const [page, setPage] = useState(1);
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
  }, [deferredQuery, filters.workflowDecision, order, page, refreshNonce, sort, timeframe, dashboardMode]);

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
          {/* Hero: KPI strip */}
          <section className="hero-shell relative overflow-hidden px-6 py-5 md:px-8 md:py-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(215,184,120,0.06),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_34%)]" />
            <div className="relative space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-[13px] font-medium text-slate-200">
                  {account?.username ? `@${account.username}` : "Reels dashboard"}
                </p>
                <div className="flex items-center gap-4">
                  <div className="inline-flex rounded-full border border-white/6 bg-white/[0.02] p-1 text-sm">
                    {["30d", "all"].map((value) => (
                      <button key={value} type="button" onClick={() => handleTimeframeChange(value)}
                        className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${timeframe === value ? "bg-white text-slate-950" : "text-slate-400 hover:text-white"}`}>
                        {value === "30d" ? "30d" : "All"}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => { forceRefresh().catch(() => {}); setRefreshNonce((c) => c + 1); }} className="text-[11px] text-slate-500 transition-colors hover:text-white">
                    Refresh now
                  </button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/60">Paid subs</p>
                  <p className="font-display text-[3.5rem] leading-[0.9] text-white">{formatCompactNumber(paidSubsSummary?.latest?.paidSubs)}</p>
                  {paidSubsSummary?.previous?.paidSubs != null && (() => {
                    const diff = (paidSubsSummary.latest?.paidSubs || 0) - paidSubsSummary.previous.paidSubs;
                    const sign = diff > 0 ? "+" : "";
                    const tone = diff > 0 ? "text-emerald-300" : diff < 0 ? "text-rose-300" : "text-slate-500";
                    return <p className={`text-[12px] font-medium ${tone}`}>{sign}{formatCompactNumber(diff)} vs previous day</p>;
                  })()}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-400/60">Bio link taps</p>
                  <p className="font-display text-[3.5rem] leading-[0.9] text-white">{formatCompactNumber(summary?.totalLinkTaps)}</p>
                  <p className="text-[12px] text-slate-500">{formatCompactNumber(pagination.total || summary?.count)} reels · {timeframe === "30d" ? "30 days" : "all time"}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                <span>{formatCompactNumber(account?.followers)} followers</span>
                <span>{formatPercent(summary?.averageEngagementRate)} avg ER</span>
                <span>{formatCompactNumber(summary?.averageViews)} avg views</span>
                <span>{formatRelative(account?.lastUpdated || summary?.latestUpdate)}</span>
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
                  Refreshing…
                </section>
              ) : null}

              {/* Sort bar + search + decision pills */}
              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Sort pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sort</span>
                    {[
                      { key: "linkTaps", label: "Link taps" },
                      { key: "views", label: "Views" },
                      { key: "saves", label: "Saves" },
                      { key: "shares", label: "Shares" },
                      { key: "performance", label: "Score" },
                      { key: "postedAt", label: "Newest" }
                    ].map((item) => (
                      <button key={item.key} type="button" onClick={() => handleSortChange(item.key)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          sort === item.key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-200"
                        }`}>
                        {item.label}{sort === item.key ? (order === "desc" ? " ↓" : " ↑") : ""}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <input
                    type="text" value={filters.q} placeholder="Search reels…"
                    onChange={(e) => updateFilter("q", e.target.value)}
                    className="w-full rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[12px] text-slate-200 placeholder-slate-500 outline-none focus:border-white/16 sm:w-56"
                  />
                </div>

                {/* Decision pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: "all", label: "All" },
                    { key: "scale", label: "Scale" },
                    { key: "watch", label: "Watch" },
                    { key: "drop", label: "Drop" }
                  ].map((item) => (
                    <button key={item.key} type="button"
                      onClick={() => updateFilter("workflowDecision", item.key)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        filters.workflowDecision === item.key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-200"
                      }`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Reel cards */}
              <ReelCardList
                reels={tableData}
                page={page}
                totalPages={totalPages}
                totalItems={pagination.total}
                onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
              />
            </>
          )}
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
