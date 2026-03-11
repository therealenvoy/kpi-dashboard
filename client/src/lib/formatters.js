import { format, formatDistanceToNowStrict } from "date-fns";

export function formatCompactNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value || 0);
}

export function formatSignedCompactNumber(value) {
  const numericValue = value || 0;
  const prefix = numericValue > 0 ? "+" : "";
  return `${prefix}${formatCompactNumber(numericValue)}`;
}

export function formatFullNumber(value) {
  return new Intl.NumberFormat("en").format(value || 0);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function formatPercent(value) {
  return `${(value || 0).toFixed(2)}%`;
}

export function formatMultiplier(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0x";
  }

  return `${value.toFixed(1)}x`;
}

export function formatDate(value) {
  if (!value) {
    return "Unknown";
  }
  return format(new Date(value), "MMM d, yyyy");
}

export function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }
  return format(new Date(value), "MMM d, yyyy p");
}

export function formatRelative(value) {
  if (!value) {
    return "Unknown";
  }
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function truncate(text, maxLength = 88) {
  if (!text) {
    return "No caption";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

export function getEngagementTone(rate) {
  if (rate > 4) {
    return "text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-400/20";
  }
  if (rate >= 2) {
    return "text-amber-200 bg-amber-500/10 ring-1 ring-amber-400/20";
  }
  return "text-rose-200 bg-rose-500/10 ring-1 ring-rose-400/20";
}

export function formatDecisionLabel(value) {
  if (!value) {
    return "Watch";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getWorkflowTone(decision) {
  if (decision === "scale") {
    return "text-emerald-200 bg-emerald-500/12 ring-1 ring-emerald-400/25";
  }
  if (decision === "drop") {
    return "text-rose-200 bg-rose-500/12 ring-1 ring-rose-400/25";
  }
  return "text-amber-100 bg-amber-500/12 ring-1 ring-amber-300/20";
}

export function getReelInsightReasons(reel) {
  if (!reel) {
    return [];
  }

  const reasons = [];

  if ((reel.saveRateVsMedian || 0) >= 1.4 && (reel.shareRateVsMedian || 0) >= 1.4) {
    reasons.push("High saves + share rate");
  } else {
    if ((reel.saveRateVsMedian || 0) >= 1.4) {
      reasons.push("High saves");
    }

    if ((reel.shareRateVsMedian || 0) >= 1.4) {
      reasons.push("High share rate");
    }
  }

  if ((reel.breakoutVsAgeMedian || 0) >= 1.2 || reel.anomalyStatus === "overperforming") {
    reasons.push("Outperforming age cohort");
  } else if ((reel.breakoutVsAgeMedian || 0) > 0 && (reel.breakoutVsAgeMedian || 0) <= 0.7) {
    reasons.push("Below age cohort");
  }

  if ((reel.ageDays || 0) <= 3 && (reel.views24hDelta || 0) > 0) {
    reasons.push("Strong early momentum");
  } else if ((reel.slowdownScore || 0) < 0) {
    reasons.push("Momentum slowing");
  }

  if ((reel.engagementVsAgeMedian || 0) >= 1.15) {
    reasons.push("Engagement above peers");
  } else if ((reel.engagementVsAgeMedian || 0) > 0 && (reel.engagementVsAgeMedian || 0) <= 0.8) {
    reasons.push("Weak engagement vs peers");
  }

  if (!reasons.length && Array.isArray(reel.workflowReasons)) {
    return reel.workflowReasons.slice(0, 3);
  }

  return reasons.slice(0, 3);
}
