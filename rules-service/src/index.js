const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const rulesPath = path.join(__dirname, "..", "rules.json");

function load() {
  return JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
}

app.get("/rules/version", (req, res) => {
  const data = load();
  res.json({ version: data.version });
});

app.post("/rules/evaluate", (req, res) => {
  const { facts } = req.body || {};
  const data = load();

  const triggered = [];

  // Минимальная логика “как будто правила”
  if (facts?.sanctions?.listed === true) triggered.push({ id: "R1", severity: "HIGH" });
  if ((facts?.registry?.ageYears ?? 999) < 1) triggered.push({ id: "R2", severity: "MEDIUM" });
  if (facts?.egrul?.uboMissing === true) triggered.push({ id: "R3", severity: "MEDIUM" });

  res.json({ triggeredRules: triggered, rulesVersion: data.version });
});

app.post("/rules/update", (req, res) => {
  // “Обновление правил” для вида: перезаписываем rules.json
  fs.writeFileSync(rulesPath, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

app.listen(8083, () => console.log("Rules Service on 8083"));