import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeSnapshot, EFFECT, FLOOR, KEY, LIMIT, POSE } from "../public/protocol.mjs";
import { Room } from "../server/room.mjs";

function setup(t, options) {
  const room = new Room(options);
  t.after(() => clearInterval(room.timer));
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const enter = (x) => {
    const token = room.players.size.toString(16).padStart(32, "0");
    const packets = [];
    const roster = [];
    const peer = {
      send(message) {
        if (message instanceof Uint8Array) packets.push(decodeSnapshot(message.buffer));
        else roster.push(JSON.parse(message));
      },
      close() {},
    };
    const receive = (message) => room.receive(peer, JSON.stringify(message));
    room.accept(peer);
    receive({ t: "join", token, name: "친구", character: "chiikawa", autoMove: false });
    const player = room.players.get(token);
    Object.assign(player, { x, facing: 1 });
    const input = (keys) => receive({ t: "input", keys });
    const observe = (subject) => packets.findLast((packet) => packet.some(({ slot }) => slot === subject.slot))
      ?.find(({ slot }) => slot === subject.slot);
    return { player, input, observe, roster, packets };
  };
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) {
      now += 50;
      room.tick();
    }
  };
  return { room, enter, step };
}

test("an attack reaches players in front and both clients see the hit and knockback", (t) => {
  const { room, enter, step } = setup(t);
  const attacker = enter(150);
  const target = enter(174);
  const behind = enter(129);
  attacker.input(KEY.attack | KEY.right);
  step();
  assert.equal(attacker.player.effects, EFFECT.attack, "wind-up only moves the arm");
  assert.equal(target.player.effects, 0, "the target is untouched during wind-up");
  attacker.input(KEY.attack);
  step(2);
  const hitX = target.player.x;
  step();
  room.snapshot();
  assert.ok(attacker.observe(attacker.player).effects & EFFECT.attack);
  assert.ok(attacker.observe(attacker.player).effects & EFFECT.punch);
  assert.ok(attacker.observe(target.player).effects & EFFECT.hit);
  assert.ok(target.observe(target.player).effects & EFFECT.hit);
  assert.ok(hitX > 174 && target.player.x > hitX);
  assert.equal(behind.player.x, 129);
  assert.equal(behind.player.effects, 0);
  step(10);
  assert.equal(attacker.player.effects, 0, "holding the key must not repeatedly attack");
  target.player.x = 175;
  attacker.input(0);
  attacker.input(KEY.attack);
  step(3);
  assert.ok(target.player.effects & EFFECT.hit);
});

test("a punch that misses animates the arm without impact", (t) => {
  const { enter, step } = setup(t);
  const attacker = enter(150);
  const behind = enter(132);
  const tooFar = enter(191);
  attacker.input(KEY.attack);
  attacker.input(0);
  step(3);
  assert.equal(attacker.player.effects, EFFECT.attack | EFFECT.punch);
  assert.equal(behind.player.effects, 0);
  assert.equal(tooFar.player.effects, 0);
  assert.equal(tooFar.player.x, 191);
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

test("the optional practice NPC can be hit and does not use a player slot", (t) => {
  const { room, enter, step } = setup(t, { practiceNpc: true });
  const attacker = enter(145);
  const npc = room.practiceNpc;
  const start = npc.x;
  assert.equal(attacker.roster.filter(({ t, slot }) => t === "player" && slot === LIMIT).length, 1);
  assert.equal(attacker.observe(npc).x, start);
  attacker.input(KEY.attack);
  attacker.input(0);
  step(4);
  assert.ok(attacker.observe(npc).effects & EFFECT.hit);
  assert.ok(npc.x > start);
  step(45);
  assert.ok(Math.abs(npc.x - start) <= 3, "the NPC walks back after the hit");

  for (let index = 1; index < LIMIT; index++) enter(300);
  assert.equal(room.active().length, LIMIT);
  assert.equal(attacker.packets.at(-2).length, LIMIT);
  assert.deepEqual(attacker.packets.at(-1).map(({ slot }) => slot), [LIMIT]);
});
