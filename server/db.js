const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

let pool;
let schemaEnsured = false;

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "false"
          ? false
          : process.env.NODE_ENV === "production" || process.env.DATABASE_SSL === "true"
            ? { rejectUnauthorized: false }
            : false
    });
  }

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function ensureMonetizationSchema() {
  if (schemaEnsured || !isDatabaseConfigured()) {
    return;
  }

  const sql = fs.readFileSync(path.join(__dirname, "sql", "001_monetization.sql"), "utf8");
  await query(sql);
  schemaEnsured = true;
}

module.exports = {
  ensureMonetizationSchema,
  getPool,
  isDatabaseConfigured,
  query
};
