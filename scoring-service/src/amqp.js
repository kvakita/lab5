const amqplib = require("amqplib");

const EXCHANGE = "scoring.events";

async function connectAmqp() {
  const conn = await amqplib.connect(process.env.AMQP_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });
  return { conn, ch };
}

async function publish(ch, routingKey, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  ch.publish(EXCHANGE, routingKey, body, { contentType: "application/json" });
}

module.exports = { connectAmqp, publish, EXCHANGE };