const express = require("express");
const app = express();
app.use(express.json());

app.post("/introspect", (req, res) => {
  // token == "ok" => valid, иначе invalid
  const token = req.body.token;
  if (token === "ok") return res.json({ active: true, sub: "demo-user" });
  return res.json({ active: false });
});

app.listen(9000, () => console.log("SSO mock on 9000"));