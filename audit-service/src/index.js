const express = require("express");
const { Pool } = require("pg");
const { connectAndConsume } = require("./amqp");

const app = express();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS
});

async function saveEvent(eventType, inn, payload) {
  await pool.query(
    "INSERT INTO audit_log (event_type, inn, payload) VALUES ($1, $2, $3::jsonb)",
    [eventType, inn || null, JSON.stringify(payload)]
  );
}

app.get("/audit", async (req, res) => {
  const inn = String(req.query.inn || "").trim();
  const r = inn
    ? await pool.query("SELECT * FROM audit_log WHERE inn=$1 ORDER BY created_at DESC", [inn])
    : await pool.query("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50");
  res.json(r.rows);
});

app.listen(8084, async () => {
  console.log("Audit Service on 8084");

  try {
    await connectAndConsume(async (rk, payload) => {
      const inn = payload.inn;
      await saveEvent(rk, inn, payload);
    });
    console.log("Audit consumer connected");
  } catch {
    console.log("Audit consumer not connected yet");
  }
});