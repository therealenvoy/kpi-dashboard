const fs = require("fs");
const path = require("path");
const { ensureMonetizationSchema, isDatabaseConfigured, query } = require("../db");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "monetization.json");

function getStorageMode() {
  return isDatabaseConfigured() ? "postgres" : "file";
}

function ensureFileStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ accounts: [], dailyMetrics: [], countryVisits: [], syncRuns: [] }, null, 2),
      "utf8"
    );
  }
}

function readFileStore() {
  ensureFileStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeFileStore(store) {
  ensureFileStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function normalizeRevenueValue(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return Number(value);
}

async function ensureStoreReady() {
  if (getStorageMode() === "postgres") {
    await ensureMonetizationSchema();
  } else {
    ensureFileStore();
  }
}

async function createSyncRun(source, details) {
  if (getStorageMode() === "postgres") {
    const result = await query("INSERT INTO sync_runs (source, details) VALUES ($1, $2::jsonb) RETURNING id", [
      source,
      JSON.stringify(details || {})
    ]);
    return result.rows[0].id;
  }

  const store = readFileStore();
  const id = (store.syncRuns.at(-1)?.id || 0) + 1;
  store.syncRuns.push({
    id,
    source,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "running",
    details: details || {}
  });
  writeFileStore(store);
  return id;
}

async function finishSyncRun(id, status, details) {
  if (getStorageMode() === "postgres") {
    await query("UPDATE sync_runs SET finished_at = NOW(), status = $2, details = $3::jsonb WHERE id = $1", [
      id,
      status,
      JSON.stringify(details || {})
    ]);
    return;
  }

  const store = readFileStore();
  const run = store.syncRuns.find((entry) => entry.id === id);
  if (run) {
    run.finished_at = new Date().toISOString();
    run.status = status;
    run.details = details || {};
    writeFileStore(store);
  }
}

async function upsertAccount(accountId, username) {
  if (getStorageMode() === "postgres") {
    await query(
      `INSERT INTO of_accounts (account_id, username, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (account_id)
       DO UPDATE SET username = EXCLUDED.username, updated_at = NOW()`,
      [accountId, username]
    );
    return;
  }

  const store = readFileStore();
  const existing = store.accounts.find((entry) => entry.accountId === accountId);
  if (existing) {
    existing.username = username;
    existing.updated_at = new Date().toISOString();
  } else {
    store.accounts.push({
      accountId,
      username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  writeFileStore(store);
}

async function upsertDailyMetric(accountId, row) {
  if (getStorageMode() === "postgres") {
    await query(
      `INSERT INTO of_daily_metrics (
        account_id,
        date,
        profile_visits_total,
        profile_visits_users,
        profile_visits_guests,
        new_subs,
        renewed_subs,
        paid_subs,
        free_subs,
        earnings_total,
        earnings_subscribes,
        earnings_messages,
        earnings_tips,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (account_id, date)
      DO UPDATE SET
        profile_visits_total = EXCLUDED.profile_visits_total,
        profile_visits_users = EXCLUDED.profile_visits_users,
        profile_visits_guests = EXCLUDED.profile_visits_guests,
        new_subs = EXCLUDED.new_subs,
        renewed_subs = COALESCE(EXCLUDED.renewed_subs, of_daily_metrics.renewed_subs),
        paid_subs = COALESCE(EXCLUDED.paid_subs, of_daily_metrics.paid_subs),
        free_subs = COALESCE(EXCLUDED.free_subs, of_daily_metrics.free_subs),
        earnings_total = COALESCE(EXCLUDED.earnings_total, of_daily_metrics.earnings_total),
        earnings_subscribes = COALESCE(EXCLUDED.earnings_subscribes, of_daily_metrics.earnings_subscribes),
        earnings_messages = COALESCE(EXCLUDED.earnings_messages, of_daily_metrics.earnings_messages),
        earnings_tips = COALESCE(EXCLUDED.earnings_tips, of_daily_metrics.earnings_tips),
        updated_at = NOW()`,
      [
        accountId,
        row.date,
        row.profileVisitsTotal,
        row.profileVisitsUsers,
        row.profileVisitsGuests,
        row.newSubs,
        row.renewedSubs,
        row.paidSubs,
        row.freeSubs,
        row.earningsTotal,
        row.earningsSubscribes,
        row.earningsMessages,
        row.earningsTips
      ]
    );
    return;
  }

  const store = readFileStore();
  const existing = store.dailyMetrics.find((entry) => entry.accountId === accountId && entry.date === row.date);
  const payload = {
    accountId,
    ...row,
    renewedSubs: row.renewedSubs ?? existing?.renewedSubs ?? null,
    paidSubs: row.paidSubs ?? existing?.paidSubs ?? null,
    freeSubs: row.freeSubs ?? existing?.freeSubs ?? null,
    earningsTotal: row.earningsTotal ?? existing?.earningsTotal ?? null,
    earningsSubscribes: row.earningsSubscribes ?? existing?.earningsSubscribes ?? 0,
    earningsMessages: row.earningsMessages ?? existing?.earningsMessages ?? null,
    earningsTips: row.earningsTips ?? existing?.earningsTips ?? null,
    updated_at: new Date().toISOString()
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    store.dailyMetrics.push({
      ...payload,
      created_at: new Date().toISOString()
    });
  }
  writeFileStore(store);
}

async function replaceCountryVisits(accountId, date, countries) {
  if (getStorageMode() === "postgres") {
    await query("DELETE FROM of_daily_country_visits WHERE account_id = $1 AND date = $2", [accountId, date]);
    for (const country of countries) {
      await query(
        `INSERT INTO of_daily_country_visits (account_id, date, country_code, visits)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (account_id, date, country_code)
         DO UPDATE SET visits = EXCLUDED.visits`,
        [accountId, date, country.countryCode, country.visits]
      );
    }
    return;
  }

  const store = readFileStore();
  store.countryVisits = store.countryVisits.filter((entry) => !(entry.accountId === accountId && entry.date === date));
  countries.forEach((country) => {
    store.countryVisits.push({
      accountId,
      date,
      countryCode: country.countryCode,
      visits: country.visits,
      created_at: new Date().toISOString()
    });
  });
  writeFileStore(store);
}

async function getStatusSnapshot() {
  if (getStorageMode() === "postgres") {
    const metricsResult = await query("SELECT COUNT(*)::int AS total_rows, MAX(date)::text AS latest_date FROM of_daily_metrics");
    const syncResult = await query(
      "SELECT status, finished_at, details FROM sync_runs WHERE source = $1 ORDER BY started_at DESC LIMIT 1",
      ["onlyfans-daily"]
    );

    return {
      hasData: metricsResult.rows[0].total_rows > 0,
      totalRows: metricsResult.rows[0].total_rows,
      latestDate: metricsResult.rows[0].latest_date,
      latestSync: syncResult.rows[0] || null
    };
  }

  const store = readFileStore();
  const sortedDates = store.dailyMetrics.map((entry) => entry.date).sort();
  const latestSync = store.syncRuns.filter((entry) => entry.source === "onlyfans-daily").at(-1) || null;

  return {
    hasData: store.dailyMetrics.length > 0,
    totalRows: store.dailyMetrics.length,
    latestDate: sortedDates.at(-1) || null,
    latestSync
  };
}

async function listDailyMetrics(limit, offset) {
  if (getStorageMode() === "postgres") {
    const metricsResult = await query(
      `SELECT
        date::text AS date,
        profile_visits_total AS "profileVisitsTotal",
        profile_visits_users AS "profileVisitsUsers",
        profile_visits_guests AS "profileVisitsGuests",
        new_subs AS "newSubs",
        renewed_subs AS "renewedSubs",
        paid_subs AS "paidSubs",
        free_subs AS "freeSubs",
        earnings_total::float AS "earningsTotal",
        earnings_subscribes::float AS "earningsSubscribes",
        earnings_messages::float AS "earningsMessages",
        earnings_tips::float AS "earningsTips"
       FROM of_daily_metrics
       ORDER BY date DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return metricsResult.rows.map((row) => ({
      ...row,
      earningsTotal: normalizeRevenueValue(row.earningsTotal, row.earningsSubscribes || 0),
      earningsSubscribes: normalizeRevenueValue(row.earningsSubscribes, 0),
      earningsMessages: normalizeRevenueValue(row.earningsMessages, 0),
      earningsTips: normalizeRevenueValue(row.earningsTips, 0)
    }));
  }

  const store = readFileStore();
  return [...store.dailyMetrics]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(offset, offset + limit)
    .map((entry) => ({
      date: entry.date,
      profileVisitsTotal: entry.profileVisitsTotal,
      profileVisitsUsers: entry.profileVisitsUsers,
      profileVisitsGuests: entry.profileVisitsGuests,
      newSubs: entry.newSubs,
      renewedSubs: entry.renewedSubs,
      paidSubs: entry.paidSubs,
      freeSubs: entry.freeSubs,
      earningsTotal: normalizeRevenueValue(entry.earningsTotal, entry.earningsSubscribes || 0),
      earningsSubscribes: normalizeRevenueValue(entry.earningsSubscribes, 0),
      earningsMessages: normalizeRevenueValue(entry.earningsMessages, 0),
      earningsTips: normalizeRevenueValue(entry.earningsTips, 0)
    }));
}

async function getDailyMetricsCount() {
  if (getStorageMode() === "postgres") {
    const countResult = await query("SELECT COUNT(*)::int AS total FROM of_daily_metrics");
    return countResult.rows[0].total;
  }
  return readFileStore().dailyMetrics.length;
}

async function getDailyMetricsSummary() {
  if (getStorageMode() === "postgres") {
    const summaryResult = await query(
      `SELECT
        COALESCE(SUM(profile_visits_total), 0)::int AS "totalVisits",
        COALESCE(SUM(new_subs), 0)::int AS "totalNewSubs",
        COALESCE(SUM(paid_subs), 0)::int AS "totalPaidSubs",
        COALESCE(SUM(free_subs), 0)::int AS "totalFreeSubs",
        COALESCE(SUM(COALESCE(earnings_total, earnings_subscribes)), 0)::float AS "totalRevenue",
        COALESCE(SUM(earnings_subscribes), 0)::float AS "totalSubscriptionRevenue",
        COALESCE(SUM(earnings_messages), 0)::float AS "totalMessageRevenue",
        COALESCE(SUM(earnings_tips), 0)::float AS "totalTipRevenue"
       FROM of_daily_metrics`
    );
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthResult = await query(
      `SELECT
        COALESCE(SUM(profile_visits_total), 0)::int AS "totalVisits",
        COALESCE(SUM(new_subs), 0)::int AS "totalNewSubs",
        COALESCE(SUM(paid_subs), 0)::int AS "totalPaidSubs",
        COALESCE(SUM(free_subs), 0)::int AS "totalFreeSubs",
        COALESCE(SUM(COALESCE(earnings_total, earnings_subscribes)), 0)::float AS "totalRevenue",
        COALESCE(SUM(earnings_subscribes), 0)::float AS "subscriptionRevenue",
        COALESCE(SUM(earnings_messages), 0)::float AS "messageRevenue",
        COALESCE(SUM(earnings_tips), 0)::float AS "tipRevenue"
       FROM of_daily_metrics
       WHERE TO_CHAR(date, 'YYYY-MM') = $1`,
      [monthKey]
    );
    return {
      ...summaryResult.rows[0],
      currentMonth: {
        key: monthKey,
        ...monthResult.rows[0]
      }
    };
  }

  const store = readFileStore();
  const monthKey = new Date().toISOString().slice(0, 7);
  const summary = store.dailyMetrics.reduce(
    (acc, entry) => ({
      totalVisits: acc.totalVisits + (entry.profileVisitsTotal || 0),
      totalNewSubs: acc.totalNewSubs + (entry.newSubs || 0),
      totalPaidSubs: acc.totalPaidSubs + (entry.paidSubs || 0),
      totalFreeSubs: acc.totalFreeSubs + (entry.freeSubs || 0),
      totalRevenue: Number((acc.totalRevenue + normalizeRevenueValue(entry.earningsTotal, entry.earningsSubscribes || 0)).toFixed(2)),
      totalSubscriptionRevenue: Number((acc.totalSubscriptionRevenue + normalizeRevenueValue(entry.earningsSubscribes, 0)).toFixed(2)),
      totalMessageRevenue: Number((acc.totalMessageRevenue + normalizeRevenueValue(entry.earningsMessages, 0)).toFixed(2)),
      totalTipRevenue: Number((acc.totalTipRevenue + normalizeRevenueValue(entry.earningsTips, 0)).toFixed(2))
    }),
    {
      totalVisits: 0,
      totalNewSubs: 0,
      totalPaidSubs: 0,
      totalFreeSubs: 0,
      totalRevenue: 0,
      totalSubscriptionRevenue: 0,
      totalMessageRevenue: 0,
      totalTipRevenue: 0
    }
  );
  const currentMonth = store.dailyMetrics
    .filter((entry) => String(entry.date || "").startsWith(monthKey))
    .reduce(
      (acc, entry) => ({
        key: monthKey,
        totalVisits: acc.totalVisits + (entry.profileVisitsTotal || 0),
        totalNewSubs: acc.totalNewSubs + (entry.newSubs || 0),
        totalPaidSubs: acc.totalPaidSubs + (entry.paidSubs || 0),
        totalFreeSubs: acc.totalFreeSubs + (entry.freeSubs || 0),
        totalRevenue: Number((acc.totalRevenue + normalizeRevenueValue(entry.earningsTotal, entry.earningsSubscribes || 0)).toFixed(2)),
        subscriptionRevenue: Number((acc.subscriptionRevenue + normalizeRevenueValue(entry.earningsSubscribes, 0)).toFixed(2)),
        messageRevenue: Number((acc.messageRevenue + normalizeRevenueValue(entry.earningsMessages, 0)).toFixed(2)),
        tipRevenue: Number((acc.tipRevenue + normalizeRevenueValue(entry.earningsTips, 0)).toFixed(2))
      }),
      {
        key: monthKey,
        totalVisits: 0,
        totalNewSubs: 0,
        totalPaidSubs: 0,
        totalFreeSubs: 0,
        totalRevenue: 0,
        subscriptionRevenue: 0,
        messageRevenue: 0,
        tipRevenue: 0
      }
    );
  return {
    ...summary,
    currentMonth
  };
}

async function getDailyMetricByDate(date) {
  if (getStorageMode() === "postgres") {
    const metricsResult = await query(
      `SELECT
        account_id AS "accountId",
        date::text AS date,
        profile_visits_total AS "profileVisitsTotal",
        profile_visits_users AS "profileVisitsUsers",
        profile_visits_guests AS "profileVisitsGuests",
        new_subs AS "newSubs",
        renewed_subs AS "renewedSubs",
        paid_subs AS "paidSubs",
        free_subs AS "freeSubs",
        earnings_total::float AS "earningsTotal",
        earnings_subscribes::float AS "earningsSubscribes",
        earnings_messages::float AS "earningsMessages",
        earnings_tips::float AS "earningsTips"
       FROM of_daily_metrics
       WHERE date = $1
       LIMIT 1`,
      [date]
    );
    if (!metricsResult.rows[0]) {
      return null;
    }

    return {
      ...metricsResult.rows[0],
      earningsTotal: normalizeRevenueValue(metricsResult.rows[0].earningsTotal, metricsResult.rows[0].earningsSubscribes || 0),
      earningsSubscribes: normalizeRevenueValue(metricsResult.rows[0].earningsSubscribes, 0),
      earningsMessages: normalizeRevenueValue(metricsResult.rows[0].earningsMessages, 0),
      earningsTips: normalizeRevenueValue(metricsResult.rows[0].earningsTips, 0)
    };
  }

  const store = readFileStore();
  const entry = store.dailyMetrics.find((row) => row.date === date);
  if (!entry) {
    return null;
  }

  return {
    ...entry,
    earningsTotal: normalizeRevenueValue(entry.earningsTotal, entry.earningsSubscribes || 0),
    earningsSubscribes: normalizeRevenueValue(entry.earningsSubscribes, 0),
    earningsMessages: normalizeRevenueValue(entry.earningsMessages, 0),
    earningsTips: normalizeRevenueValue(entry.earningsTips, 0)
  };
}

async function getCountryVisitsByDate(date) {
  if (getStorageMode() === "postgres") {
    const countriesResult = await query(
      `SELECT country_code AS "countryCode", visits
       FROM of_daily_country_visits
       WHERE date = $1
       ORDER BY visits DESC
       LIMIT 5`,
      [date]
    );
    return countriesResult.rows;
  }

  const store = readFileStore();
  return store.countryVisits
    .filter((entry) => entry.date === date)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 5)
    .map((entry) => ({ countryCode: entry.countryCode, visits: entry.visits }));
}

module.exports = {
  createSyncRun,
  ensureStoreReady,
  finishSyncRun,
  getCountryVisitsByDate,
  getDailyMetricByDate,
  getDailyMetricsCount,
  getDailyMetricsSummary,
  getStatusSnapshot,
  getStorageMode,
  listDailyMetrics,
  replaceCountryVisits,
  upsertAccount,
  upsertDailyMetric
};
