const amqplib = require("amqplib");
const EXCHANGE = "scoring.events";

async function connectAndConsume(onMessage) {
  const conn = await amqplib.connect(process.env.AMQP_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, "topic", { durable: true });

  const q = await ch.assertQueue("audit.queue", { durable: true });
  await ch.bindQueue(q.queue, EXCHANGE, "#");

  ch.consume(q.queue, (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString("utf-8"));
      const rk = msg.fields.routingKey;
      onMessage(rk, payload).finally(() => ch.ack(msg));
    } catch {
      ch.ack(msg);
    }
  });

  return { conn, ch };
}

module.exports = { connectAndConsume };