const { randomUUID } = require("crypto");
const { syncOnlyFansDaily } = require("./monetizationSync");

const jobs = new Map();

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function listRunningJobs() {
  return [...jobs.values()].filter((job) => job.status === "running");
}

function serializeJob(job) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    payload: job.payload,
    result: job.result || null,
    error: job.error || null
  };
}

function startMonetizationSyncJob(payload) {
  const existingRunning = listRunningJobs()[0];
  if (existingRunning) {
    return serializeJob(existingRunning);
  }

  const job = {
    id: randomUUID(),
    type: "monetization-sync",
    status: "running",
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    payload,
    result: null,
    error: null
  };

  jobs.set(job.id, job);

  (async () => {
    try {
      const snapshot = await syncOnlyFansDaily(payload);
      job.status = "success";
      job.finishedAt = new Date().toISOString();
      job.result = {
        accountId: snapshot.accountId,
        rowCount: snapshot.daily.length,
        startDate: payload.startDate,
        endDate: payload.endDate,
        metricCoverage: snapshot.metricCoverage,
        revenueCoverage: snapshot.revenueCoverage
      };
    } catch (error) {
      job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.error = {
        message: error.message
      };
    }
  })();

  return serializeJob(job);
}

module.exports = {
  getJob,
  listRunningJobs,
  serializeJob,
  startMonetizationSyncJob
};
