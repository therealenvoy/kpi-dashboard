require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { VIEWER_COOKIE_NAME } = require("./config");
const { createReelsRouter } = require("./routes/reels");
const { createMonetizationRouter } = require("./routes/monetization");
const { startAutoMonetizationScheduler } = require("./services/monetizationScheduler");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_VIEW_CODE = String(process.env.ADMIN_VIEW_CODE || "").trim();
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// --- Middleware ---

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed."));
    },
    credentials: true
  })
);
app.use(express.json());

// --- Cookie helpers ---

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, entry) => {
    const [rawKey, ...rawValue] = entry.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("=") || "");
    return acc;
  }, {});
}

function getViewerMode(req) {
  const cookies = parseCookies(req);
  return cookies[VIEWER_COOKIE_NAME] === "admin" ? "admin" : "worker";
}

function canViewRevenue(req) {
  return Boolean(ADMIN_VIEW_CODE) && getViewerMode(req) === "admin";
}

function setViewerCookie(res, mode) {
  const attributes = [
    `${VIEWER_COOKIE_NAME}=${encodeURIComponent(mode)}`,
    "Path=/", "HttpOnly", "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

function clearViewerCookie(res) {
  const attributes = [`${VIEWER_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

// --- Startup validation ---

function validateStartupEnv() {
  const missing = [];
  if (!process.env.GOOGLE_API_KEY) missing.push("GOOGLE_API_KEY");
  if (!process.env.SPREADSHEET_ID) missing.push("SPREADSHEET_ID");
  if (process.env.NODE_ENV === "production") {
    if (!ADMIN_VIEW_CODE) missing.push("ADMIN_VIEW_CODE");
    if (!CORS_ORIGINS.length) missing.push("CORS_ORIGINS");
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

validateStartupEnv();
startAutoMonetizationScheduler();

// --- Viewer routes ---

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/viewer", (req, res) => {
  res.json({
    viewerMode: getViewerMode(req),
    canViewRevenue: canViewRevenue(req),
    adminCodeConfigured: Boolean(ADMIN_VIEW_CODE)
  });
});

app.post("/api/viewer/unlock", (req, res) => {
  const code = String(req.body?.code || req.query?.code || "").trim();
  if (!ADMIN_VIEW_CODE) return res.status(400).json({ error: "ADMIN_VIEW_CODE is not configured." });
  if (!code || code !== ADMIN_VIEW_CODE) return res.status(403).json({ error: "Invalid admin code." });
  setViewerCookie(res, "admin");
  return res.json({ ok: true, viewerMode: "admin", canViewRevenue: true });
});

app.post("/api/viewer/lock", (_req, res) => {
  clearViewerCookie(res);
  res.json({ ok: true, viewerMode: "worker", canViewRevenue: false });
});

// --- Mount route modules ---

const { router: reelsRouter, getReelsData, getFilteredReels } = createReelsRouter();
app.use("/api", reelsRouter);

app.use(
  "/api/monetization",
  createMonetizationRouter({
    getReelsData,
    getViewerMode,
    canViewRevenue,
    getContextualReels: async () => {
      const { reels } = await getFilteredReels({ timeframe: "all" });
      return reels;
    }
  })
);

// --- Static files & SPA fallback ---

const clientDistPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  return res.sendFile(path.join(clientDistPath, "index.html"));
});

// --- Error handler ---

app.use((error, _req, res, _next) => {
  const status = error.response?.status || 500;
  const upstreamDetails = error.response?.data;
  const message = error.message || "Unexpected server error.";
  const isProduction = process.env.NODE_ENV === "production";

  console.error("[server-error]", { status, message, upstreamDetails });

  res.status(status).json({
    error: "Request failed",
    details: isProduction ? "Something went wrong." : upstreamDetails || message
  });
});

app.listen(PORT, () => {
  console.log(`KPI Dashboard server listening on port ${PORT}`);
});
