const axios = require("axios");

const ONLYFANS_BASE_URL = "https://app.onlyfansapi.com/api";

function normalizeEnvSecret(name) {
  const rawValue = String(process.env[name] || "").trim();
  const withoutPrefix = rawValue.startsWith(`${name}=`) ? rawValue.slice(name.length + 1) : rawValue;
  const unquoted =
    (withoutPrefix.startsWith('"') && withoutPrefix.endsWith('"')) ||
    (withoutPrefix.startsWith("'") && withoutPrefix.endsWith("'"))
      ? withoutPrefix.slice(1, -1)
      : withoutPrefix;

  return unquoted.trim();
}

function isOnlyFansConfigured() {
  return Boolean(normalizeEnvSecret("ONLYFANS_API_KEY"));
}

function createOnlyFansClient() {
  const apiKey = normalizeEnvSecret("ONLYFANS_API_KEY");

  if (!apiKey) {
    throw new Error("ONLYFANS_API_KEY is not configured.");
  }

  return axios.create({
    baseURL: ONLYFANS_BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });
}

function toApiDate(value, endOfDay = false) {
  const date = new Date(value);
  const isoDate = date.toISOString().slice(0, 10);
  return `${isoDate} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function normalizeDateKey(value) {
  if (!value) {
    return null;
  }

  const normalized = new Date(value);
  if (Number.isNaN(normalized.getTime())) {
    return null;
  }

  return normalized.toISOString().slice(0, 10);
}

function getNumericValue(entry, preferredKeys = []) {
  for (const key of preferredKeys) {
    if (entry?.[key] !== undefined && entry?.[key] !== null && entry?.[key] !== "") {
      const value = Number(String(entry[key]).replace(/[^\d.-]/g, ""));
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }

  const fallbackValue = Number(String(entry?.value ?? entry?.count ?? entry?.total ?? 0).replace(/[^\d.-]/g, ""));
  return Number.isFinite(fallbackValue) ? fallbackValue : 0;
}

function normalizeChartRows(payload, preferredValueKeys = []) {
  const rows = payload?.chartData || payload?.chart || payload?.data?.chartData || payload?.data?.chart || payload?.data || payload || [];
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((entry) => {
      const date = normalizeDateKey(entry.date || entry.day || entry.label || entry.name || entry.createdAt);
      if (!date) {
        return null;
      }

      return {
        date,
        value: getNumericValue(entry, preferredValueKeys)
      };
    })
    .filter(Boolean);
}

function normalizeCountryRows(payload) {
  const rows =
    payload?.topCountries ||
    payload?.countries ||
    payload?.data?.topCountries ||
    payload?.data?.countries ||
    payload?.data?.chart?.topCountries ||
    [];
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((entry) => ({
      countryCode: String(entry.code || entry.countryCode || entry.country || "").trim().toUpperCase(),
      visits: Math.round(getNumericValue(entry, ["visits", "count", "value"]))
    }))
    .filter((entry) => entry.countryCode);
}

function enumerateDateKeys(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${normalizeDateKey(startDate)}T00:00:00.000Z`);
  const last = new Date(`${normalizeDateKey(endDate)}T00:00:00.000Z`);

  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return results;
}

async function resolveOnlyFansAccountId(client) {
  const configuredAccountId = normalizeEnvSecret("ONLYFANS_ACCOUNT_ID");

  if (configuredAccountId) {
    return configuredAccountId;
  }

  const response = await client.get("/accounts");
  const accounts = response.data?.data || response.data || [];
  const account = Array.isArray(accounts) ? accounts[0] : null;

  if (!account?.id) {
    throw new Error("No OnlyFans account connected to the API key.");
  }

  return account.id;
}

async function fetchProfileVisitors(client, accountId, startDate, endDate, type = "total", filter = "chart") {
  const response = await client.get(`/${accountId}/statistics/reach/profile-visitors`, {
    params: {
      start_date: toApiDate(startDate),
      end_date: toApiDate(endDate, true),
      type,
      filter
    }
  });

  return response.data;
}

async function fetchSubscriberStatistics(client, accountId, startDate, endDate) {
  const response = await client.get(`/${accountId}/subscribers/statistics`, {
    params: {
      start_date: toApiDate(startDate),
      end_date: toApiDate(endDate, true),
      type: "total"
    }
  });

  return response.data;
}

async function fetchEarnings(client, accountId, startDate, endDate, type = "total") {
  const response = await client.get(`/${accountId}/statistics/statements/earnings`, {
    params: {
      start_date: toApiDate(startDate),
      end_date: toApiDate(endDate, true),
      type
    }
  });

  return response.data;
}

async function fetchSubscriberMetrics(client, accountId, startDate, endDate) {
  const response = await client.get(`/${accountId}/statistics/subscriber-metrics`, {
    params: {
      start_date: toApiDate(startDate),
      end_date: toApiDate(endDate, true),
      detailed: true
    }
  });

  return response.data;
}

function normalizeSubscriberMetricDetail(payload, date) {
  if (payload?.error) {
    throw new Error(payload.message || payload.description || payload.error);
  }

  const data = payload?.data || payload || {};
  const detailed = data?.detailed || {};
  const hasMetricShape =
    data?.total_subscriptions !== undefined ||
    data?.new_subscriptions !== undefined ||
    data?.renewed_subscriptions !== undefined ||
    detailed?.paid_subscriptions !== undefined ||
    detailed?.free_subscriptions !== undefined;

  if (!hasMetricShape) {
    throw new Error("Subscriber metrics response did not include the expected paid/free breakdown.");
  }

  return {
    date,
    totalSubs: Math.round(getNumericValue(data, ["total_subscriptions", "totalSubscriptions", "total", "count"])),
    newSubs: Math.round(getNumericValue(data, ["new_subscriptions", "newSubscriptions", "newSubs"])),
    renewedSubs: Math.round(getNumericValue(data, ["renewed_subscriptions", "renewedSubscriptions", "renewed", "renewals"])),
    paidSubs: Math.round(getNumericValue(detailed, ["paid_subscriptions", "paidSubscriptions", "paid", "paidSubs"])),
    freeSubs: Math.round(getNumericValue(detailed, ["free_subscriptions", "freeSubscriptions", "free", "freeSubs"])),
    unknownSubs: Math.round(getNumericValue(detailed, ["unknown_subscriptions", "unknownSubscriptions", "unknown"]))
  };
}

function normalizeEarningsRows(payload, preferredKey) {
  if (!payload || payload?.error) {
    return [];
  }

  const data = payload?.data || payload || {};
  const keyCandidates = [
    preferredKey,
    preferredKey === "messages" ? "chat_messages" : null,
    preferredKey === "subscribes" ? "subscriptions" : null,
    "total",
    "subscribes",
    "chat_messages",
    "messages",
    "tips"
  ].filter(Boolean);
  const entry =
    keyCandidates.map((key) => data?.[key]).find((value) => value && (Array.isArray(value.chartAmount) || Array.isArray(value.chartCount))) ||
    Object.values(data).find((value) => value && (Array.isArray(value.chartAmount) || Array.isArray(value.chartCount)));
  const rows = entry?.chartAmount || [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const date = normalizeDateKey(row.date || row.day || row.name);
      if (!date) {
        return null;
      }

      return {
        date,
        value: getNumericValue(row, ["count", "value", "total", "amount"])
      };
    })
    .filter(Boolean);
}

async function fetchSubscriberMetricsByDate(client, accountId, dates) {
  const failures = [];
  const rows = await mapWithConcurrency(dates, 4, async (date) => {
    try {
      const payload = await fetchSubscriberMetrics(client, accountId, date, date);
      return normalizeSubscriberMetricDetail(payload, date);
    } catch (error) {
      failures.push({
        date,
        error: error.message
      });
      return null;
    }
  });

  return {
    byDate: rows.filter(Boolean).reduce((acc, entry) => {
      acc.set(entry.date, entry);
      return acc;
    }, new Map()),
    failures
  };
}

async function fetchOnlyFansDailySnapshot({ startDate, endDate }) {
  const client = createOnlyFansClient();
  const accountId = await resolveOnlyFansAccountId(client);

  const [totalVisitsPayload, userVisitsPayload, guestVisitsPayload, subscriberStatsPayload] =
    await Promise.all([
      fetchProfileVisitors(client, accountId, startDate, endDate, "total", "chart"),
      fetchProfileVisitors(client, accountId, startDate, endDate, "users", "chart"),
      fetchProfileVisitors(client, accountId, startDate, endDate, "guests", "chart"),
      fetchSubscriberStatistics(client, accountId, startDate, endDate)
    ]);

  const countryPayload = await fetchProfileVisitors(client, accountId, startDate, endDate, "total", "topCountries").catch(() => null);
  const [earningsTotalPayload, earningsSubscribesPayload, earningsMessagesPayload, earningsTipsPayload] = await Promise.all([
    fetchEarnings(client, accountId, startDate, endDate, "total").catch(() => null),
    fetchEarnings(client, accountId, startDate, endDate, "subscribes").catch(() => null),
    fetchEarnings(client, accountId, startDate, endDate, "messages").catch(() => null),
    fetchEarnings(client, accountId, startDate, endDate, "tips").catch(() => null)
  ]);

  const visitsTotal = normalizeChartRows(totalVisitsPayload?.data?.chart?.visitors || totalVisitsPayload, ["visits", "count", "value", "total"]);
  const visitsUsers = normalizeChartRows(userVisitsPayload?.data?.chart?.visitors || userVisitsPayload, ["visits", "count", "value", "total"]);
  const visitsGuests = normalizeChartRows(guestVisitsPayload?.data?.chart?.visitors || guestVisitsPayload, ["visits", "count", "value", "total"]);
  const newSubsRows = normalizeChartRows(
    subscriberStatsPayload?.data?.subscribes || subscriberStatsPayload,
    ["subscribes", "subscriptions", "newSubscriptions", "count", "value"]
  );
  const earningsSubsRows = normalizeChartRows(
    subscriberStatsPayload?.data?.earnings || subscriberStatsPayload,
    ["earnings", "amount", "value", "total", "count"]
  );
  const earningsTotalRows = normalizeEarningsRows(earningsTotalPayload, "total");
  const earningsSubscribesRows = normalizeEarningsRows(earningsSubscribesPayload, "subscribes");
  const earningsMessagesRows = normalizeEarningsRows(earningsMessagesPayload, "messages");
  const earningsTipsRows = normalizeEarningsRows(earningsTipsPayload, "tips");

  const daily = new Map();

  function upsert(date, patch) {
    daily.set(date, {
      date,
      profileVisitsTotal: 0,
      profileVisitsUsers: 0,
      profileVisitsGuests: 0,
      newSubs: 0,
      renewedSubs: null,
      paidSubs: null,
      freeSubs: null,
      earningsTotal: null,
      earningsSubscribes: 0,
      earningsMessages: null,
      earningsTips: null,
      ...(daily.get(date) || {}),
      ...patch
    });
  }

  visitsTotal.forEach((entry) => upsert(entry.date, { profileVisitsTotal: Math.round(entry.value) }));
  visitsUsers.forEach((entry) => upsert(entry.date, { profileVisitsUsers: Math.round(entry.value) }));
  visitsGuests.forEach((entry) => upsert(entry.date, { profileVisitsGuests: Math.round(entry.value) }));
  newSubsRows.forEach((entry) => upsert(entry.date, { newSubs: Math.round(entry.value) }));
  earningsSubsRows.forEach((entry) =>
    upsert(entry.date, {
      earningsSubscribes: Number(entry.value.toFixed ? entry.value.toFixed(2) : entry.value)
    })
  );
  earningsTotalRows.forEach((entry) =>
    upsert(entry.date, {
      earningsTotal: Number(entry.value.toFixed ? entry.value.toFixed(2) : entry.value)
    })
  );
  earningsSubscribesRows.forEach((entry) =>
    upsert(entry.date, {
      earningsSubscribes: Number(entry.value.toFixed ? entry.value.toFixed(2) : entry.value)
    })
  );
  earningsMessagesRows.forEach((entry) =>
    upsert(entry.date, {
      earningsMessages: Number(entry.value.toFixed ? entry.value.toFixed(2) : entry.value)
    })
  );
  earningsTipsRows.forEach((entry) =>
    upsert(entry.date, {
      earningsTips: Number(entry.value.toFixed ? entry.value.toFixed(2) : entry.value)
    })
  );

  const metricDates = enumerateDateKeys(startDate, endDate);
  const subscriberMetricResult = metricDates.length
    ? await fetchSubscriberMetricsByDate(client, accountId, metricDates)
    : { byDate: new Map(), failures: [] };

  subscriberMetricResult.byDate.forEach((entry, date) =>
    upsert(date, {
      renewedSubs: entry.renewedSubs,
      paidSubs: entry.paidSubs,
      freeSubs: entry.freeSubs
    })
  );

  return {
    accountId,
    username: totalVisitsPayload?.username || totalVisitsPayload?.data?.username || null,
    daily: [...daily.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    countries: normalizeCountryRows(countryPayload),
    metricCoverage: {
      requestedDays: metricDates.length,
      completedDays: metricDates.length - subscriberMetricResult.failures.length,
      failedDays: subscriberMetricResult.failures.length,
      failedDates: subscriberMetricResult.failures.map((entry) => entry.date)
    },
    revenueCoverage: {
      total: Boolean(earningsTotalRows.length),
      subscriptions: Boolean(earningsSubscribesRows.length || earningsSubsRows.length),
      messages: Boolean(earningsMessagesRows.length),
      tips: Boolean(earningsTipsRows.length)
    }
  };
}

module.exports = {
  fetchOnlyFansDailySnapshot,
  isOnlyFansConfigured
};
