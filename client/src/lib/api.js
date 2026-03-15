import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 15000
});

export async function fetchAccount() {
  const { data } = await api.get("/account");
  return data;
}

export async function fetchReels(params) {
  const { data } = await api.get("/reels", { params });
  return data;
}

export async function fetchSnapshots(reelId) {
  const { data } = await api.get(`/snapshots/${reelId}`);
  return data;
}

export async function fetchSnapshotsWithCompare(reelId, compareTo) {
  const { data } = await api.get(`/snapshots/${reelId}`, {
    params: compareTo ? { compareTo } : {}
  });
  return data;
}

export async function fetchReport(params) {
  const { data } = await api.get("/report/daily", { params });
  return data;
}

export async function fetchMonetizationStatus() {
  const { data } = await api.get("/monetization/status");
  return data;
}

export async function fetchViewer() {
  const { data } = await api.get("/viewer");
  return data;
}

export async function unlockViewer(code) {
  const { data } = await api.post("/viewer/unlock", { code });
  return data;
}

export async function lockViewer() {
  const { data } = await api.post("/viewer/lock");
  return data;
}

export async function fetchPaidSubsSummary() {
  const { data } = await api.get("/monetization/paid-subs-summary");
  return data;
}

export async function fetchMonetizationDaily(params) {
  const { data } = await api.get("/monetization/daily", { params });
  return data;
}

export async function fetchMonetizationDay(date) {
  const { data } = await api.get(`/monetization/day/${date}`);
  return data;
}

export async function syncMonetization(payload) {
  const { data } = await api.post("/monetization/sync", payload);
  return data;
}

export async function fetchMonetizationSyncJob(jobId) {
  const { data } = await api.get(`/monetization/sync/${jobId}`);
  return data;
}
