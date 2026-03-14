import {
  formatCompactNumber,
  formatSignedCompactNumber,
  formatPercent,
  truncate
} from "../lib/formatters";
import SectionHeader from "./SectionHeader";

const ACTION_ICONS = ["1", "2", "3", "4", "5"];

function buildEditorActions(summary) {
  if (!summary) {
    return [];
  }

  const actions = [];
  const highlights = summary.highlights || {};
  const roadmap = summary.workflowRoadmap || [];
  const execSummary = summary.executiveSummary || [];

  // Priority 1: Breakout reel spiking — repost on stories
  const breakoutReel = highlights.breakout || highlights.breakoutScore;
  if (breakoutReel && (breakoutReel.views24hDelta || 0) > 5000 && (breakoutReel.ageDays || 0) <= 3) {
    actions.push({
      reel: breakoutReel,
      verb: "Repost on stories",
      sentence: `Repost "${truncate(breakoutReel.caption, 50)}" on stories`,
      why: `It gained ${formatSignedCompactNumber(breakoutReel.views24hDelta)} views in the last 24 hours and is still fresh.`,
      urgency: "high"
    });
  }

  // Priority 2: Top scale reel — replicate format
  const scaleLane = roadmap.find((lane) => lane.key === "scale");
  const scaleReel = highlights.scale || scaleLane?.sampleReel;
  if (scaleReel && !actions.some((a) => a.reel?.reelId === scaleReel.reelId)) {
    actions.push({
      reel: scaleReel,
      verb: "Replicate this format",
      sentence: `Draft a new reel similar to "${truncate(scaleReel.caption, 50)}"`,
      why: `Your top performer with ${formatCompactNumber(scaleReel.views)} views and ${formatPercent(scaleReel.engagementRate)} engagement.`,
      urgency: "medium"
    });
  }

  // Priority 3: High saves but slowing momentum — engage comments
  const savedReel = highlights.saved;
  if (savedReel && (savedReel.slowdownScore || 0) < 0 && !actions.some((a) => a.reel?.reelId === savedReel.reelId)) {
    actions.push({
      reel: savedReel,
      verb: "Engage the audience",
      sentence: `Reply to comments on "${truncate(savedReel.caption, 50)}"`,
      why: `High save rate (${formatPercent(savedReel.saveRate)}) but momentum is slowing down. Engagement can reignite reach.`,
      urgency: "medium"
    });
  }

  // Priority 4: Strong shares but low reach — boost candidate
  const sharedReel = highlights.shared;
  if (
    sharedReel &&
    (sharedReel.reach || 0) < (summary.averageViews || Infinity) &&
    !actions.some((a) => a.reel?.reelId === sharedReel.reelId)
  ) {
    actions.push({
      reel: sharedReel,
      verb: "Consider boosting",
      sentence: `Consider boosting "${truncate(sharedReel.caption, 50)}"`,
      why: `Strong shares (${formatCompactNumber(sharedReel.shares)}) but reach is below average. Paid push could amplify organic momentum.`,
      urgency: "low"
    });
  }

  // Priority 5: Biggest momentum drop — review the hook
  const dropSignal = execSummary.find((signal) => signal.id === "biggest-drop");
  if (dropSignal?.reel && !actions.some((a) => a.reel?.reelId === dropSignal.reel.reelId)) {
    actions.push({
      reel: dropSignal.reel,
      verb: "Review the hook",
      sentence: `Review the hook on "${truncate(dropSignal.reel.caption, 50)}"`,
      why: `Biggest momentum drop this week. ${dropSignal.metricLabel ? `${dropSignal.metricLabel}: ${dropSignal.metricValue}` : "Consider what went wrong."}`,
      urgency: "low"
    });
  }

  // Fallback: if we have fewer than 2 actions, add lane-level generic actions
  if (actions.length < 2) {
    const watchLane = roadmap.find((lane) => lane.key === "watch");
    if (watchLane?.sampleReel && !actions.some((a) => a.reel?.reelId === watchLane.sampleReel.reelId)) {
      actions.push({
        reel: watchLane.sampleReel,
        verb: "Set a checkpoint",
        sentence: `Check back on "${truncate(watchLane.sampleReel.caption, 50)}" in 24 hours`,
        why: `It's on the watchlist — could go either way. Revisit before making a call.`,
        urgency: "low"
      });
    }
  }

  return actions.slice(0, 5);
}

function getUrgencyStyle(urgency) {
  if (urgency === "high") {
    return "border-emerald-500/25 bg-emerald-500/[0.04]";
  }
  if (urgency === "medium") {
    return "border-amber-500/20 bg-amber-500/[0.03]";
  }
  return "border-white/6 bg-white/[0.015]";
}

function getUrgencyBadge(urgency) {
  if (urgency === "high") {
    return "text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-400/20";
  }
  if (urgency === "medium") {
    return "text-amber-200 bg-amber-500/12 ring-1 ring-amber-400/20";
  }
  return "text-slate-300 bg-white/[0.04] ring-1 ring-white/8";
}

export default function ActionPlanPanel({ summary, onSelectReel }) {
  const actions = buildEditorActions(summary);

  if (!actions.length) {
    return null;
  }

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Today's actions"
        title="What to do right now"
        description="Concrete next moves based on your latest reel data. Start from the top."
      />
      <div className="mt-6 space-y-3">
        {actions.map((item, index) => (
          <article
            key={item.reel?.reelId || index}
            className={`flex flex-col gap-4 rounded-[1.2rem] border p-5 transition-colors sm:flex-row sm:items-start sm:gap-6 ${getUrgencyStyle(item.urgency)}`}
          >
            <div className="flex shrink-0 items-start gap-4">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${getUrgencyBadge(item.urgency)}`}
              >
                {ACTION_ICONS[index]}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#d7b878]/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#d7b878]">
                  {item.verb}
                </span>
              </div>
              <p className="text-[14px] font-medium leading-6 text-white">{item.sentence}</p>
              <p className="text-[12px] leading-6 text-slate-400">{item.why}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:self-center">
              {item.reel?.permalink ? (
                <a
                  href={item.reel.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full border border-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:border-white/16 hover:text-white"
                >
                  Instagram ↗
                </a>
              ) : null}
              {item.reel && onSelectReel ? (
                <button
                  type="button"
                  onClick={() => onSelectReel(item.reel)}
                  className="rounded-full border border-[#d7b878]/25 bg-[#d7b878]/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#d7b878] transition-colors hover:bg-[#d7b878]/15"
                >
                  View reel
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
