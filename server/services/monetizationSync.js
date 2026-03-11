const { fetchOnlyFansDailySnapshot, isOnlyFansConfigured } = require("./onlyfans");
const {
  createSyncRun,
  ensureStoreReady,
  finishSyncRun,
  replaceCountryVisits,
  upsertAccount,
  upsertDailyMetric
} = require("./monetizationStore");

async function syncOnlyFansDaily({ startDate, endDate }) {
  if (!isOnlyFansConfigured()) {
    throw new Error("ONLYFANS_API_KEY is not configured.");
  }

  await ensureStoreReady();
  const syncRunId = await createSyncRun("onlyfans-daily", { startDate, endDate });

  try {
    const snapshot = await fetchOnlyFansDailySnapshot({ startDate, endDate });

    await upsertAccount(snapshot.accountId, snapshot.username);

    for (const row of snapshot.daily) {
      await upsertDailyMetric(snapshot.accountId, row);
    }

    if (snapshot.countries.length) {
      await replaceCountryVisits(snapshot.accountId, endDate, snapshot.countries);
    }

    await finishSyncRun(syncRunId, "success", {
      startDate,
      endDate,
      accountId: snapshot.accountId,
      rowCount: snapshot.daily.length,
      countryCount: snapshot.countries.length,
      metricCoverage: snapshot.metricCoverage,
      revenueCoverage: snapshot.revenueCoverage
    });

    return snapshot;
  } catch (error) {
    await finishSyncRun(syncRunId, "failed", { startDate, endDate, error: error.message });
    throw error;
  }
}

module.exports = {
  syncOnlyFansDaily
};
