const express = require("express");
const app = express();

app.get("/registry/company/:inn", (req, res) => {
  const inn = req.params.inn;
  // возраст компании: последние 1-2 цифры
  const ageYears = Number(inn.slice(-2)) % 5; // 0..4
  res.json({ ageYears, source: "mock-registry" });
});

app.listen(9002, () => console.log("Registry mock on 9002"));