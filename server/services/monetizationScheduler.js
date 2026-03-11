const { isOnlyFansConfigured } = require("./onlyfans");
const { getStatusSnapshot } = require("./monetizationStore");
const { listRunningJobs, startMonetizationSyncJob } = require("./monetizationJobs");

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_SYNC_ENABLED =
  process.env.MONETIZATION_AUTO_SYNC === "false" ? false : process.env.NODE_ENV === "production";
const AUTO_SYNC_DAYS = Math.max(1, Math.min(Number(process.env.MONETIZATION_AUTO_SYNC_DAYS) || 30, 90));
const AUTO_SYNC_HOUR_UTC = Math.max(0, Math.min(Number(process.env.MONETIZATION_AUTO_SYNC_HOUR_UTC) || 1, 23));
const AUTO_SYNC_MINUTE_UTC = Math.max(0, Math.min(Number(process.env.MONETIZATION_AUTO_SYNC_MINUTE_UTC) || 15, 59));
const AUTO_SYNC_CHECK_INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  Math.min(Number(process.env.MONETIZATION_AUTO_SYNC_CHECK_MINUTES) || 15, 60) * 60 * 1000
);

let schedulerTimer = null;
let schedulerStarted = false;
let lastScheduledJobId = null;
let lastSchedulerError = null;

function formatDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getScheduledTimeForDate(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), AUTO_SYNC_HOUR_UTC, AUTO_SYNC_MINUTE_UTC, 0, 0));
}

function getLastDueAt(now = new Date()) {
  const todayDue = getScheduledTimeForDate(now);
  if (now.getTime() >= todayDue.getTime()) {
    return todayDue;
  }

  return new Date(todayDue.getTime() - DAY_MS);
}

function getNextDueAt(now = new Date()) {
  const lastDueAt = getLastDueAt(now);
  if (now.getTime() < lastDueAt.getTime()) {
    return lastDueAt;
  }

  return new Date(lastDueAt.getTime() + DAY_MS);
}

function hasCompletedCurrentWindow(snapshot, now = new Date()) {
  const latestFinishedAt = snapshot?.latestSync?.finished_at;
  const latestStatus = snapshot?.latestSync?.status;

  if (!latestFinishedAt || latestStatus !== "success") {
    return false;
  }

  return new Date(latestFinishedAt).getTime() >= getLastDueAt(now).getTime();
}

function buildPayload(now = new Date()) {
  const endDate = formatDateKey(now);
  const startDate = formatDateKey(new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() - (AUTO_SYNC_DAYS - 1) * DAY_MS));

  return {
    startDate,
    endDate
  };
}

async function runAutoSyncCheck() {
  if (!AUTO_SYNC_ENABLED || !isOnlyFansConfigured()) {
    return;
  }

  if (listRunningJobs().length) {
    return;
  }

  const snapshot = await getStatusSnapshot();
  const now = new Date();

  if (!snapshot?.hasData) {
    const job = startMonetizationSyncJob(buildPayload(now));
    lastScheduledJobId = job.id;
    lastSchedulerError = null;
    return;
  }

  if (hasCompletedCurrentWindow(snapshot, now)) {
    return;
  }

  if (now.getTime() < getLastDueAt(now).getTime()) {
    return;
  }

  const job = startMonetizationSyncJob(buildPayload(now));
  lastScheduledJobId = job.id;
  lastSchedulerError = null;
}

function getAutoSyncSnapshot(now = new Date()) {
  return {
    enabled: AUTO_SYNC_ENABLED,
    configured: AUTO_SYNC_ENABLED && isOnlyFansConfigured(),
    days: AUTO_SYNC_DAYS,
    scheduleUtc: `${String(AUTO_SYNC_HOUR_UTC).padStart(2, "0")}:${String(AUTO_SYNC_MINUTE_UTC).padStart(2, "0")} UTC`,
    nextRunAt: AUTO_SYNC_ENABLED ? getNextDueAt(now).toISOString() : null,
    checkIntervalMinutes: Math.round(AUTO_SYNC_CHECK_INTERVAL_MS / 60000),
    lastScheduledJobId,
    lastError: lastSchedulerError
  };
}

function startAutoMonetizationScheduler() {
  if (schedulerStarted || !AUTO_SYNC_ENABLED) {
    return;
  }

  schedulerStarted = true;

  const run = async () => {
    try {
      await runAutoSyncCheck();
    } catch (error) {
      lastSchedulerError = error.message;
      console.error("[monetization-auto-sync]", { message: error.message });
    }
  };

  setTimeout(run, 15 * 1000);
  schedulerTimer = setInterval(run, AUTO_SYNC_CHECK_INTERVAL_MS);
}

module.exports = {
  getAutoSyncSnapshot,
  startAutoMonetizationScheduler
};
