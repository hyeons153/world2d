import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createPlayground } from "../server/local.mjs";
import { decodeSnapshot, FLOOR, KEY, LIMIT, PIXELS, POSE } from "../public/protocol.mjs";

async function waitFor(predicate, description, timeout = 4_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = predicate();
    if (result) return result;
    await delay(18);
  }
  assert.fail(description);
}

test("one WebSocket room shares characters, motion and reconnects with a 20-player cap", { timeout: 13_000 }, async (t) => {
  const { server, room } = createPlayground();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = "127.0.0.1:" + server.address().port;
  const clients = [];
  t.after(() => {
    for (const client of clients) {
      if (client.ws.readyState < WebSocket.CLOSING) client.ws.close();
    }
    clearInterval(room.timer);
    server.close();
  });
  assert.equal((await fetch("http://" + address)).status, 200);

  async function connect(profile = {}) {
    const ws = new WebSocket("ws://" + address + "/ws");
    ws.binaryType = "arraybuffer";
    const client = {
      ws, closed: 0, slot: -1, roster: new Map(), points: new Map(), snapshots: 0, arrival: [],
      token: profile.token ?? randomBytes(16).toString("hex"),
      send(message) { ws.send(JSON.stringify(message)); },
    };
    clients.push(client);
    ws.addEventListener("close", (event) => { client.closed = event.code; });
    ws.addEventListener("message", ({ data }) => {
      if (typeof data !== "string") {
        const entries = decodeSnapshot(data);
        client.snapshots++;
        client.arrival.push(Date.now());
        client.points = new Map(entries.map((point) => [point.slot, point]));
        return;
      }
      const message = JSON.parse(data);
      if (message.t === "welcome") client.slot = message.slot;
      if (message.t === "player") client.roster.set(message.slot, message);
      if (message.t === "left") client.roster.delete(message.slot);
    });
    await once(ws, "open");
    client.send({ t: "join", name: "친구", character: "sprout", ...profile, token: client.token });
    return client;
  }

  const sprite = { frames: 4, pixels: Buffer.alloc(PIXELS * PIXELS * 4 * 4, 255).toString("base64") };
  const [a, b] = await Promise.all([connect(), connect({ sprite, character: "custom" })]);
  await waitFor(() => a.roster.size === 2 && b.roster.size === 2 && a.points.get(a.slot), "both players must see the room");
  assert.equal(a.roster.get(b.slot).sprite.pixels, sprite.pixels);
  assert.equal(a.roster.get(b.slot).name, b.roster.get(a.slot).name, "same nickname can coexist");

  const initial = a.points.get(a.slot).x;
  a.send({ t: "input", keys: KEY.right | KEY.jump });
  await waitFor(() => b.points.get(a.slot)?.y < FLOOR && b.points.get(a.slot)?.x > initial + 2, "remote sees movement and jump");
  await waitFor(() => a.points.get(a.slot)?.x > initial + 15, "local receives authoritative movement");
  a.send({ t: "input", keys: 0 });
  await waitFor(() => !room.players.get(a.token).keys && a.points.get(a.slot)?.pose !== POSE.jump, "released input resumes automatic behavior");
  const startAuto = a.points.get(a.slot);
  await waitFor(() => {
    const point = a.points.get(a.slot);
    return point && (Math.abs(point.x - startAuto.x) > 1 || point.pose !== startAuto.pose);
  }, "automatic activity is sent to clients", 4_500);

  const c = await connect({ token: a.token });
  await waitFor(() => a.closed === 4001 && c.slot === a.slot, "a second tab replaces the old connection");
  assert.equal(b.roster.size, 2);
  c.ws.close();
  await waitFor(() => b.roster.size === 1, "exit removes a player from the other screen");
  const disconnected = room.players.get(a.token).x;
  const d = await connect({ token: a.token });
  await waitFor(() => d.points.has(d.slot) && b.roster.size === 2, "a reconnect restores one player");
  assert.equal(d.slot, a.slot);
  assert.ok(Math.abs(d.points.get(d.slot).x - disconnected) < 5);

  const invalid = await connect({ character: "custom", sprite: { frames: 4, pixels: "broken" } });
  await waitFor(() => invalid.closed === 4004, "invalid normalized sprite is rejected");
  const others = await Promise.all(Array.from({ length: LIMIT - 2 }, () => connect()));
  const all = [b, d, ...others];
  await waitFor(() => all.every((client) => client.roster.size === LIMIT && client.points.size === LIMIT), "all 20 sockets receive the same set");
  all.forEach((client, index) => client.send({ t: "input", keys: index % 2 ? KEY.left : KEY.right }));
  const counts = all.map(({ snapshots }) => snapshots);
  await delay(1_100);
  assert.ok(all.every((client, index) => client.snapshots >= counts[index] + 7), "20 players receive a steady snapshot cadence");
  assert.equal(new Set(all.map(({ slot }) => slot)).size, LIMIT);
  for (const point of d.points.values()) {
    assert.equal(point.y, FLOOR);
    assert.ok(point.x >= 20 && point.x <= 364);
  }
  const overflow = await connect();
  await waitFor(() => overflow.closed === 4003, "the 21st connection is rejected");
  for (const client of all) client.ws.close();
  await waitFor(() => room.active().length === 0, "closed connections leave no active ghost players");
});
