import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  formatCompactNumber,
  formatDecisionLabel,
  formatDateTime,
  formatFullNumber,
  formatMultiplier,
  formatPercent,
  formatSignedCompactNumber,
  getWorkflowTone
} from "../lib/formatters";

function Metric({ label, value, helper }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 font-display text-[1.75rem] leading-none text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
    </div>
  );
}

function buildChartData(snapshots, compareSnapshots, benchmarkSnapshots) {
  const rows = {};

  snapshots.forEach((point) => {
    rows[point.ageDayBucket] = {
      ...(rows[point.ageDayBucket] || {}),
      ageDayBucket: point.ageDayBucket,
      views: point.views,
      reach: point.reach
    };
  });

  (compareSnapshots || []).forEach((point) => {
    rows[point.ageDayBucket] = {
      ...(rows[point.ageDayBucket] || {}),
      ageDayBucket: point.ageDayBucket,
      compareViews: point.views,
      compareReach: point.reach
    };
  });

  (benchmarkSnapshots || []).forEach((point) => {
    rows[point.ageDayBucket] = {
      ...(rows[point.ageDayBucket] || {}),
      ageDayBucket: point.ageDayBucket,
      benchmarkViews: point.benchmarkViews,
      benchmarkReach: point.benchmarkReach
    };
  });

  return Object.values(rows).sort((a, b) => a.ageDayBucket - b.ageDayBucket);
}

export default function ReelModal({
  reel,
  snapshots,
  compareSnapshots,
  benchmarkSnapshots,
  compareOptions,
  compareReelId,
  onCompareChange,
  benchmarks,
  loading,
  onClose
}) {
  if (!reel) {
    return null;
  }

  const chartData = buildChartData(snapshots, compareSnapshots, benchmarkSnapshots);
  const compareReel = compareOptions.find((option) => option.reelId === compareReelId);
  const benchmarkViewsMultiplier = benchmarks?.medianViews ? reel.views / benchmarks.medianViews : 0;
  const benchmarkBreakoutMultiplier = benchmarks?.medianBreakoutScore ? reel.breakoutScore / benchmarks.medianBreakoutScore : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="panel max-h-[90vh] w-full max-w-6xl overflow-hidden border-white/15 bg-[linear-gradient(180deg,rgba(143,190,255,0.08),rgba(255,255,255,0.03))]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Reel drill-down</p>
            <h3 className="mt-1 font-display text-2xl text-white">Performance snapshot</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Caption</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{reel.caption || "No caption"}</p>
                </div>
                <a
                  href={reel.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-sm font-semibold text-sky-200 transition-colors hover:text-white"
                >
                  View on Instagram
                </a>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Anomaly</p>
                  <p className="mt-2 font-semibold capitalize text-white">{reel.anomalyStatus}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Views vs median</p>
                  <p className="mt-2 font-semibold text-white">{formatMultiplier(benchmarkViewsMultiplier)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Breakout vs median</p>
                  <p className="mt-2 font-semibold text-white">{formatMultiplier(benchmarkBreakoutMultiplier)}</p>
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Benchmark chart</p>
                  <h4 className="mt-1 font-display text-xl text-white">Views and reach vs median trajectory</h4>
                </div>
                <label className="space-y-2">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Compare to reel</span>
                  <select
                    value={compareReelId}
                    onChange={(event) => onCompareChange(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-sky-300/60"
                  >
                    <option value="">No comparison</option>
                    {compareOptions.map((option) => (
                      <option key={option.reelId} value={option.reelId}>
                        {option.caption || option.reelId}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {loading ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">Loading chart…</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="ageDayBucket"
                      tickFormatter={(value) => `${value}d`}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(value) => `Age ${value} days`}
                      formatter={(value) => formatFullNumber(value)}
                      contentStyle={{
                        backgroundColor: "#0b111b",
                        borderColor: "rgba(255,255,255,0.12)",
                        borderRadius: "16px"
                      }}
                    />
                    <Legend wrapperStyle={{ color: "#e2e8f0" }} />
                    <Line type="monotone" dataKey="views" name="Views" stroke="#8fbfff" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="benchmarkViews" name="Benchmark views" stroke="#ffffff" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="reach" name="Reach" stroke="#9dd6c2" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="benchmarkReach" name="Benchmark reach" stroke="#d4d8e2" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    {compareReel ? (
                      <Line type="monotone" dataKey="compareViews" name="Compare views" stroke="#f6a560" strokeWidth={2} dot={false} />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Metric label="Posted" value={formatDateTime(reel.postedAt)} helper={`${reel.ageBucket} old`} />
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Decision</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getWorkflowTone(reel.workflowDecision)}`}>
                    {formatDecisionLabel(reel.workflowDecision)}
                  </span>
                  <span className="text-sm text-slate-400">{formatCompactNumber(reel.workflowScore)} pts</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{reel.workflowHeadline}</p>
              </div>
              <Metric label="Engagement rate" value={formatPercent(reel.engagementRate)} helper={`${formatMultiplier(reel.engagementVsAgeMedian)} age median`} />
              <Metric label="Views" value={formatFullNumber(reel.views)} helper={`${formatMultiplier(reel.viewsVsAgeMedian)} age median`} />
              <Metric label="Reach" value={formatFullNumber(reel.reach)} helper={`${formatCompactNumber(reel.viewsPerDay)} views/day`} />
              <Metric label="Breakout" value={formatCompactNumber(reel.breakoutScore)} helper={`${formatMultiplier(reel.breakoutVsAgeMedian)} age median`} />
              <Metric label="24h momentum" value={formatSignedCompactNumber(reel.views24hDelta)} helper={`${formatSignedCompactNumber(reel.slowdownScore)} vs 7d pace`} />
              <Metric label="Save rate" value={formatPercent(reel.saveRate)} helper={`${formatPercent(reel.shareRate)} share rate`} />
              <Metric label="Shares" value={formatFullNumber(reel.shares)} helper={`${formatPercent(reel.likeRate)} like rate`} />
            </div>

            {compareReel ? (
              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
                <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Comparison reel</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{compareReel.caption || compareReel.reelId}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <span>{formatCompactNumber(compareReel.views)} views</span>
                  <span>{formatPercent(compareReel.engagementRate)} ER</span>
                  <span>{formatCompactNumber(compareReel.breakoutScore)} breakout</span>
                  <span>{formatPercent(compareReel.saveRate)} save rate</span>
                </div>
              </div>
            ) : null}

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Derived insights</p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <p>This reel is outperforming the 30-day median by {formatMultiplier(benchmarkViewsMultiplier)} on views.</p>
                <p>Its breakout score is {formatMultiplier(benchmarkBreakoutMultiplier)} the current median breakout.</p>
                <p>The anomaly engine classifies it as <span className="capitalize text-white">{reel.anomalyStatus}</span>.</p>
                <p>The workflow score says <span className="text-white">{formatDecisionLabel(reel.workflowDecision)}</span>: {reel.workflowAction}</p>
                {reel.workflowReasons?.length ? (
                  <span className="block text-slate-400">{reel.workflowReasons.join(" ")}</span>
                ) : null}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Audience signals</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {reel.topCountries.length ? (
                  reel.topCountries.map((country) => (
                    <span
                      key={country}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                    >
                      {country}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No country data available.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
