const express = require("express");
const app = express();

app.get("/crm/company/:inn", (req, res) => {
  res.json({ hasActiveContracts: true, source: "mock-crm" });
});

app.listen(9001, () => console.log("CRM mock on 9001"));