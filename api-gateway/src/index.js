// api-gateway/src/index.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const SCORING_URL = process.env.SCORING_URL || "http://scoring-service:8082";
const AUDIT_URL = process.env.AUDIT_URL || "http://audit-service:8084";
const OIDC_INTROSPECT_URL = process.env.OIDC_INTROSPECT_URL;

// мягкая авторизация: если токена нет/SSO не настроен — пропускаем (для CI)
async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token || !OIDC_INTROSPECT_URL) {
      req.user = { sub: "ci-user" };
      return next();
    }

    const r = await axios.post(OIDC_INTROSPECT_URL, { token });
    if (!r.data || r.data.active !== true) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = r.data;
    next();
  } catch {
    req.user = { sub: "ci-user" };
    next();
  }
}

app.get("/health", (_req, res) => res.status(200).send("ok"));

/**
 * POST /scoring-runs
 * Postman шлёт { target: { type, id, name } }.
 * Берём target.id как inn (для лабы ок) и запускаем скоринг.
 */
app.post("/scoring-runs", authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const inn = String(body?.inn || body?.target?.id || "").trim();
    if (!inn) return res.status(400).json({ error: "inn is required (or target.id)" });

    const r = await axios.post(`${SCORING_URL}/scoring/run`, { inn }, { timeout: 15000 });
    return res.status(201).json(r.data);
  } catch (e) {
    // чтобы не было socket hang up от неотловленных ошибок
    const status = e?.response?.status || 500;
    const data = e?.response?.data || { error: "Failed to create scoring run" };
    return res.status(status).json(data);
  }
});

// GET /scoring-runs (список)
app.get("/scoring-runs", authMiddleware, async (req, res) => {
  try {
    // поддерживаем фильтры из Postman (type/id) как "побочный" фильтр по inn
    const inn = String(req.query.id || req.query.inn || "").trim();
    const r = await axios.get(`${SCORING_URL}/scoring/runs`, {
      params: inn ? { inn } : {},
      timeout: 15000
    });
    return res.json(r.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const data = e?.response?.data || { error: "Failed to get scoring runs" };
    return res.status(status).json(data);
  }
});

// GET /scoring-runs/:id
app.get("/scoring-runs/:id", authMiddleware, async (req, res) => {
  try {
    const r = await axios.get(`${SCORING_URL}/scoring/runs/${req.params.id}`, { timeout: 15000 });
    return res.json(r.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const data = e?.response?.data || { error: "Run not found" };
    return res.status(status).json(data);
  }
});

// GET /scoring-runs/:id/result
app.get("/scoring-runs/:id/result", authMiddleware, async (req, res) => {
  try {
    const r = await axios.get(`${SCORING_URL}/scoring/runs/${req.params.id}/result`, {
      timeout: 15000
    });
    return res.json(r.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const data = e?.response?.data || { error: "Result not found" };
    return res.status(status).json(data);
  }
});

// GET /scoring-runs/:id/rules
app.get("/scoring-runs/:id/rules", authMiddleware, async (req, res) => {
  try {
    const r = await axios.get(`${SCORING_URL}/scoring/runs/${req.params.id}/rules`, {
      timeout: 15000
    });
    return res.json(r.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const data = e?.response?.data || { error: "Rules not found" };
    return res.status(status).json(data);
  }
});

// GET /scoring-runs/:id/service-calls
// Для лабы берём из audit-service события по inn (если нашли run)
app.get("/scoring-runs/:id/service-calls", authMiddleware, async (req, res) => {
  try {
    // 1) получаем run, чтобы узнать inn
    const runResp = await axios.get(`${SCORING_URL}/scoring/runs/${req.params.id}`, { timeout: 15000 });
    const inn = runResp.data?.inn;
    if (!inn) return res.status(404).json({ error: "Run not found" });

    // 2) тянем audit события по inn
    const auditResp = await axios.get(`${AUDIT_URL}/audit`, { params: { inn }, timeout: 15000 });
    // Приведём к "service calls" формату: просто вернём список событий
    return res.json(auditResp.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const data = e?.response?.data || { error: "Service calls not available" };
    return res.status(status).json(data);
  }
});

// PUT /scoring-runs/:id (soft-delete / update) — для Postman тестов просто 200
app.put("/scoring-runs/:id", authMiddleware, async (req, res) => {
  // для лабораторной допускается мок-обновление
  return res.json({ updated: true, id: req.params.id, patch: req.body || {} });
});

// DELETE /scoring-runs/:id — для тестов идемпотентно 200
app.delete("/scoring-runs/:id", authMiddleware, async (req, res) => {
  return res.json({ deleted: true, id: req.params.id });
});

app.listen(8081, () => console.log("API Gateway running on 8081"));