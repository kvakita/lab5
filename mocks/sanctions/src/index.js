const express = require("express");
const app = express();

app.get("/sanctions/company/:inn", (req, res) => {
  const inn = req.params.inn;
  // пусть для примера ИНН заканчивается на 9 => в санкциях
  const listed = inn.endsWith("9");
  res.json({ listed, source: "mock-sanctions" });
});

app.listen(9004, () => console.log("Sanctions mock on 9004"));