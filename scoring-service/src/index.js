const express = require("express");
const axios = require("axios");
const { pool } = require("./db");
const { connectAmqp, publish } = require("./amqp");

const app = express();
app.use(express.json());

const DATA_AGG_URL = process.env.DATA_AGG_URL;
const RULES_URL = process.env.RULES_URL;

let amqp = null;

function calcRisk(triggeredRules) {
  // супер-просто: 0-1 LOW, 2 MEDIUM, 3+ HIGH
  const n = triggeredRules.length;
  if (n >= 3) return "HIGH";
  if (n === 2) return "MEDIUM";
  return "LOW";
}

app.post("/scoring/run", async (req, res) => {
  const inn = String(req.body.inn || "").trim();
  if (!inn) return res.status(400).json({ error: "inn is required" });

  const started = { inn, ts: new Date().toISOString() };
  try {
    if (amqp) await publish(amqp.ch, "ScoringStarted", started);

    // 1) собрать факты
    const factsResp = await axios.get(`${DATA_AGG_URL}/data/company/${inn}`);
    const facts = factsResp.data;

    // 2) оценить правила
    const rulesResp = await axios.post(`${RULES_URL}/rules/evaluate`, { inn, facts });
    const triggeredRules = rulesResp.data.triggeredRules || [];

    // 3) итоговый риск
    const riskLevel = calcRisk(triggeredRules);

    // 4) сохранить
    const q = `
      INSERT INTO scoring_results (inn, risk_level, triggered_rules, facts)
      VALUES ($1, $2, $3::jsonb, $4::jsonb)
      RETURNING id, inn, risk_level, triggered_rules, created_at
    `;
    const saved = await pool.query(q, [
      inn,
      riskLevel,
      JSON.stringify(triggeredRules),
      JSON.stringify(facts)
    ]);

    const completed = { inn, riskLevel, triggeredRules, ts: new Date().toISOString() };
    if (amqp) await publish(amqp.ch, "ScoringCompleted", completed);

    res.json({
      ...saved.rows[0],
      riskLevel,
      triggeredRules
    });
  } catch (e) {
    res.status(500).json({ error: "scoring failed" });
  }
});

app.get("/scoring/results", async (req, res) => {
  const inn = String(req.query.inn || "").trim();
  const r = inn
    ? await pool.query("SELECT * FROM scoring_results WHERE inn=$1 ORDER BY created_at DESC", [inn])
    : await pool.query("SELECT * FROM scoring_results ORDER BY created_at DESC LIMIT 50");
  res.json(r.rows);
});

app.listen(8082, async () => {
  try {
    amqp = await connectAmqp();
    console.log("Scoring Service on 8082 + AMQP connected");
  } catch {
    console.log("Scoring Service on 8082 (AMQP not connected yet)");
  }
});