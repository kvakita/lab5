const express = require("express");
const app = express();

app.get("/egrul/company/:inn", (req, res) => {
  const inn = req.params.inn;
  const uboMissing = inn.endsWith("0");
  res.json({ uboMissing, source: "mock-egrul" });
});

app.listen(9003, () => console.log("EGRUL mock on 9003"));