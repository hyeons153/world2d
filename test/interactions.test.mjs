import assert from "node:assert/strict";
import { test } from "node:test";
import { stepPlayers } from "../public/movement.mjs";
import { decodeSnapshot, EFFECT, FLOOR, KEY, POSE } from "../public/protocol.mjs";
import { Room } from "../server/room.mjs";

function setup(t) {
  const room = new Room();
  t.after(() => clearInterval(room.timer));
  let now = Date.now();
  const enter = (x) => {
    const token = room.players.size.toString(16).padStart(32, "0");
    let snapshot;
    const peer = {
      send(message) { if (message instanceof Uint8Array) snapshot = message; },
      close() {},
    };
    const receive = (message) => room.receive(peer, JSON.stringify(message));
    room.accept(peer);
    receive({ t: "join", token, name: "친구", character: "chiikawa", autoMove: false });
    const player = room.players.get(token);
    Object.assign(player, { x, facing: 1 });
    const input = (keys) => receive({ t: "input", keys });
    return { player, input, observe: (subject) => decodeSnapshot(snapshot.buffer).find(({ slot }) => slot === subject.slot) };
  };
  const step = () => { now += 50; stepPlayers(room.active(), now, 0.05); };
  return { room, enter, step };
}

test("an attack reaches players in front and both clients see the hit and knockback", (t) => {
  const { room, enter, step } = setup(t);
  const attacker = enter(150);
  const target = enter(174);
  const behind = enter(129);
  attacker.input(KEY.attack | KEY.right);
  step();
  attacker.input(KEY.attack);
  const hitX = target.player.x;
  step();
  room.snapshot();
  assert.ok(attacker.observe(attacker.player).effects & EFFECT.attack);
  assert.ok(attacker.observe(target.player).effects & EFFECT.hit);
  assert.ok(target.observe(target.player).effects & EFFECT.hit);
  assert.ok(hitX > 174 && target.player.x > hitX);
  assert.equal(behind.player.x, 129);
  assert.equal(behind.player.effects, 0);
  for (let index = 0; index < 10; index++) step();
  assert.equal(attacker.player.effects, 0, "holding the key must not repeatedly attack");
  target.player.x = 175;
  attacker.input(0);
  attacker.input(KEY.attack);
  step();
  assert.ok(target.player.effects & EFFECT.hit);
});

test("a descending jump squashes the player below and bounces exactly once", (t) => {
  const { room, enter, step } = setup(t);
  const jumper = enter(150);
  const target = enter(150);
  jumper.input(KEY.jump);
  step();
  jumper.input(0);
  assert.ok(jumper.player.y < FLOOR);
  assert.equal(target.player.effects, 0, "jumping up does not trigger a stomp");
  for (let index = 0; index < 20 && !(target.player.effects & EFFECT.squash); index++) step();
  room.snapshot();
  assert.ok(target.observe(target.player).effects & EFFECT.squash);
  assert.ok(jumper.observe(target.player).effects & EFFECT.squash);
  assert.ok(jumper.player.vy < 0);
  assert.equal(jumper.player.pose, POSE.jump);
  for (let index = 0; index < 24; index++) step();
  assert.equal(target.player.effects, 0);
  assert.equal(jumper.player.y, FLOOR);
});
