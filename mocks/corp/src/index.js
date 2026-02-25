const express = require("express");
const app = express();

app.get("/corp/company/:inn", (req, res) => {
  const inn = req.params.inn;
  // возраст компании: последние 1-2 цифры
  const ageYears = Number(inn.slice(-2)) % 5; // 0..4
  res.json({ ageYears, source: "corp" });
});

app.listen(9002, () => console.log("Corp mock on 9002"));