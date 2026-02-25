const express = require("express");
const axios = require("axios");

const app = express();

const CRM_URL = process.env.CRM_URL;
const CORP_URL = process.env.CORP_URL;
const EGRUL_URL = process.env.EGRUL_URL;
const SANCTIONS_URL = process.env.SANCTIONS_URL;

app.get("/data/company/:inn", async (req, res) => {
  const inn = req.params.inn;

  try {
    const [crm, reg, egrul, sanc] = await Promise.all([
      axios.get(`${CRM_URL}/crm/company/${inn}`),
      axios.get(`${CORP_URL}/corp/company/${inn}`),
      axios.get(`${EGRUL_URL}/egrul/company/${inn}`),
      axios.get(`${SANCTIONS_URL}/sanctions/company/${inn}`)
    ]);

    res.json({
      inn,
      crm: crm.data,
      corp: reg.data,
      egrul: egrul.data,
      sanctions: sanc.data,
      aggregatedAt: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: "aggregation failed" });
  }
});

app.listen(8086, () => console.log("Data Aggregation on 8086"));