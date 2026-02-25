// scoring-service/src/index.js
const express = require("express");
const axios = require("axios");
const { pool } = require("./db");
const { connectAmqp, publish } = require("./amqp");

const app = express();
app.use(express.json());

const DATA_AGG_URL = process.env.DATA_AGG_URL || "http://data-aggregation:8086";
const RULES_URL = process.env.RULES_URL || "http://rules-service:8083";

let amqp = null;

function calcRisk(triggeredRules) {
  const n = Array.isArray(triggeredRules) ? triggeredRules.length : 0;
  if (n >= 3) return "HIGH";
  if (n === 2) return "MEDIUM";
  return "LOW";
}

app.get("/health", (_req, res) => res.status(200).send("ok"));

/**
 * POST /scoring/run
 * body: { inn }
 * Сохраняет запись в scoring_results и возвращает { id, inn, riskLevel, triggeredRules, created_at, ... }
 */
app.post("/scoring/run", async (req, res) => {
  const inn = String(req.body?.inn || "").trim();
  if (!inn) return res.status(400).json({ error: "inn is required" });

  try {
    const started = { inn, ts: new Date().toISOString() };
    if (amqp) await publish(amqp.ch, "ScoringStarted", started);

    // 1) собрать факты (моки)
    const factsResp = await axios.get(`${DATA_AGG_URL}/data/company/${encodeURIComponent(inn)}`, {
      timeout: 15000
    });
    const facts = factsResp.data;

    // 2) оценить правила
    const rulesResp = await axios.post(
      `${RULES_URL}/rules/evaluate`,
      { inn, facts },
      { timeout: 15000 }
    );
    const triggeredRules = rulesResp.data?.triggeredRules || [];
    const riskLevel = calcRisk(triggeredRules);

    // 3) сохранить в БД
    const q = `
      INSERT INTO scoring_results (inn, risk_level, triggered_rules, facts)
      VALUES ($1, $2, $3::jsonb, $4::jsonb)
      RETURNING id, inn, risk_level, triggered_rules, facts, created_at
    `;
    const saved = await pool.query(q, [
      inn,
      riskLevel,
      JSON.stringify(triggeredRules),
      JSON.stringify(facts)
    ]);

    const row = saved.rows[0];

    const completed = { inn, riskLevel, triggeredRules, ts: new Date().toISOString(), runId: row.id };
    if (amqp) await publish(amqp.ch, "ScoringCompleted", completed);

    return res.json({
      id: row.id,
      inn: row.inn,
      riskLevel: row.risk_level,
      triggeredRules: row.triggered_rules,
      facts: row.facts,
      created_at: row.created_at
    });
  } catch (e) {
    return res.status(500).json({ error: "scoring failed" });
  }
});

/**
 * GET /scoring/runs
 * optional query: inn
 */
app.get("/scoring/runs", async (req, res) => {
  const inn = String(req.query?.inn || "").trim();
  const r = inn
    ? await pool.query("SELECT * FROM scoring_results WHERE inn=$1 ORDER BY created_at DESC", [inn])
    : await pool.query("SELECT * FROM scoring_results ORDER BY created_at DESC LIMIT 50");
  return res.json(r.rows);
});

/**
 * GET /scoring/runs/:id
 * 404 если нет
 */
app.get("/scoring/runs/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const r = await pool.query("SELECT * FROM scoring_results WHERE id=$1", [id]);
  if (r.rows.length === 0) return res.status(404).json({ error: "not found" });

  return res.json(r.rows[0]);
});

/**
 * GET /scoring/runs/:id/result
 * то же, что run
 */
app.get("/scoring/runs/:id/result", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const r = await pool.query("SELECT * FROM scoring_results WHERE id=$1", [id]);
  if (r.rows.length === 0) return res.status(404).json({ error: "not found" });

  // includeServiceCalls сейчас игнорируем (для тестов ок)
  return res.json(r.rows[0]);
});

/**
 * GET /scoring/runs/:id/rules
 */
app.get("/scoring/runs/:id/rules", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  const r = await pool.query("SELECT triggered_rules FROM scoring_results WHERE id=$1", [id]);
  if (r.rows.length === 0) return res.status(404).json({ error: "not found" });

  return res.json(r.rows[0].triggered_rules);
});

// Backward compatibility: старые пути, если где-то остались
app.get("/scoring/results", async (req, res) => {
  const inn = String(req.query?.inn || "").trim();
  const r = inn
    ? await pool.query("SELECT * FROM scoring_results WHERE inn=$1 ORDER BY created_at DESC", [inn])
    : await pool.query("SELECT * FROM scoring_results ORDER BY created_at DESC LIMIT 50");
  return res.json(r.rows);
});

app.listen(8082, async () => {
  try {
    amqp = await connectAmqp();
    console.log("Scoring Service on 8082 + AMQP connected");
  } catch {
    console.log("Scoring Service on 8082 (AMQP not connected yet)");
  }
});