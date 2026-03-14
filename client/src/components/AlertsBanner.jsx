import { formatSignedCompactNumber, truncate } from "../lib/formatters";

export function buildAlerts(allReels) {
  if (!allReels?.length) {
    return [];
  }

  const seen = new Set();
  const alerts = [];

  for (const reel of allReels) {
    if (!reel?.reelId || seen.has(reel.reelId)) {
      continue;
    }
    seen.add(reel.reelId);

    // Spiking: big 24h jump on a recent reel
    if ((reel.views24hDelta || 0) > 10000 && (reel.ageDays || 0) <= 5) {
      alerts.push({
        reelId: reel.reelId,
        reel,
        type: "spiking",
        severity: "warning",
        message: `Spiking: "${truncate(reel.caption, 55)}" gained ${formatSignedCompactNumber(reel.views24hDelta)} views in 24h`
      });
    }

    // Dropping: underperforming with negative momentum
    if (
      (reel.slowdownScore || 0) < -500 &&
      reel.anomalyStatus === "underperforming" &&
      reel.workflowDecision !== "drop"
    ) {
      alerts.push({
        reelId: reel.reelId,
        reel,
        type: "dropping",
        severity: "danger",
        message: `Dropping: "${truncate(reel.caption, 55)}" is losing momentum fast`
      });
    }

    // Breakout: overperforming fresh reel
    if (reel.anomalyStatus === "overperforming" && (reel.ageDays || 0) <= 3) {
      alerts.push({
        reelId: reel.reelId,
        reel,
        type: "breakout",
        severity: "success",
        message: `Breakout detected: "${truncate(reel.caption, 55)}" is outperforming its age group`
      });
    }
  }

  // Sort: success first, then warning, then danger
  const severityOrder = { success: 0, warning: 1, danger: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0));

  return alerts;
}

function getSeverityStyle(severity) {
  if (severity === "success") {
    return "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200";
  }
  if (severity === "warning") {
    return "border-amber-500/20 bg-amber-500/[0.06] text-amber-200";
  }
  return "border-rose-500/20 bg-rose-500/[0.06] text-rose-200";
}

function getSeverityIcon(type) {
  if (type === "breakout") {
    return "✦";
  }
  if (type === "spiking") {
    return "↑";
  }
  return "↓";
}

export default function AlertsBanner({ alerts, onDismiss, onSelectReel }) {
  if (!alerts?.length) {
    return null;
  }

  return (
    <section className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={`${alert.type}-${alert.reelId}`}
          className={`flex items-center gap-4 rounded-[1rem] border px-5 py-3 ${getSeverityStyle(alert.severity)}`}
        >
          <span className="shrink-0 text-[16px]">{getSeverityIcon(alert.type)}</span>
          <p className="min-w-0 flex-1 text-[13px] font-medium leading-6">{alert.message}</p>
          <div className="flex shrink-0 items-center gap-2">
            {alert.reel && onSelectReel ? (
              <button
                type="button"
                onClick={() => onSelectReel(alert.reel)}
                className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                View
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss(alert.reelId)}
                className="rounded-full px-2 py-1 text-[14px] text-white/30 transition-colors hover:text-white/70"
                aria-label="Dismiss alert"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}
