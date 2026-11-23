import assert from "node:assert/strict";
import { test } from "node:test";
import { queueInput, stepPlayers, WALK_SPEED } from "../public/movement.mjs";
import { decodeSnapshot, EFFECT, encodeSnapshot, FLOOR, HEIGHT, KEY, LIMIT, POSE, ROOM_VERSION } from "../public/protocol.mjs";
import { BODY_HEIGHT, climbCamera, currentLeader, heightMetres, offscreenPlayers, platforms, SUMMIT_Y, towerHazards, WORLD_CYCLE } from "../public/tower.mjs";
import { Room } from "../server/room.mjs";

function player(x, y = FLOOR, slot = 0) {
  return { slot, name: `친구${slot}`, spawnX: x, x, y, vy: 0, facing: 1, keys: 0, pose: POSE.idle, inputUntil: Infinity };
}

test("the real simulation can climb every one-way platform and land at 100 m", () => {
  const climber = player(68);
  // One manual route through the full course. Some gaps need a walk to the edge
  // before jumping, and some landings need a pause until the route is clear.
  const starts = new Map([
    [8, [279, 6, 5]], [9, [237, 4]], [12, [null, 0, 4]],
    [22, [null, 0, 15]], [24, [197, 1]], [25, [153, 5, 15]],
    [32, [110, 3]], [34, [112, 1]], [35, [151, 2]], [36, [187, 2]],
    [37, [231, 4]], [38, [275, 5]], [39, [330, 9, 1]],
    [42, [223, 3]], [43, [null, 0, 24]], [44, [152, 2]], [45, [114, 2]],
    [50, [198, 2]], [51, [232, 1]], [52, [275, 4]], [57, [182, 3, 8]],
    [60, [80, 2]],
  ]);
  const landingOffsets = new Map([[13, 8], [32, -8]]);
  let now = 0;
  function step(goal, jump = false) {
    const dx = goal - climber.x;
    const direction = Math.abs(dx) <= WALK_SPEED * 0.05 * 0.62 ? 0 : dx > 0 ? KEY.right : KEY.left;
    queueInput(climber, direction | (jump ? KEY.jump : 0));
    assert.equal(stepPlayers([climber], now += 50, 0.05).length, 0);
  }
  for (const [index, pad] of platforms.entries()) {
    const [launch, walk, wait = 0] = starts.get(index) ?? [null, 0];
    for (let i = 0; i < walk; i++) step(launch);
    for (let i = 0; i < wait; i++) step(climber.x);
    const goal = pad.x + pad.width / 2 + (landingOffsets.get(index) ?? 0);
    for (let tick = 0; tick < 24; tick++) {
      step(goal, tick === 0);
      if (climber.grounded && climber.y === pad.y) break;
    }
    assert.equal(climber.y, pad.y, `platform ${index + 1}`);
    assert.equal(climber.grounded, true);
  }
  assert.equal(climber.y, SUMMIT_Y);
  assert.equal(heightMetres(climber.y), 100);
});

test("spikes warn, retract, and knock the player back only when extended", () => {
  assert.equal(towerHazards(0).spikes[0].state, "down");
  assert.equal(towerHazards(1_650).spikes[0].state, "warning");
  const spike = towerHazards(2_050).spikes[0];
  const climber = player(spike.x + 5, spike.y);
  assert.equal(spike.state, "up");
  assert.equal(stepPlayers([climber], 1_650, 0.05).length, 0);
  assert.equal(stepPlayers([climber], 2_050, 0.05).length, 1);
  assert.ok(climber.effects & EFFECT.hit);
  assert.ok(climber.x < spike.x + 5 && climber.vy < 0);
  assert.equal(climber.y, spike.y);
  assert.equal(towerHazards(3_100).spikes[0].state, "down");
});

test("birds follow the shared clock and knock an airborne player away without teleporting", () => {
  const phase = 600;
  const bird = towerHazards(phase).birds[0];
  const other = towerHazards(phase + 150).birds[0];
  assert.ok(other.x > bird.x);
  assert.deepEqual(towerHazards(phase + WORLD_CYCLE), towerHazards(phase));
  const climber = player(bird.x, bird.y + 8);
  assert.deepEqual(stepPlayers([climber], phase, 0.05), [{ slot: 0, side: -1 }]);
  assert.ok(climber.x > bird.x && climber.vy > 0 && climber.y < FLOOR);
});

test("the server camera stays at its high point on descent and resets only below the viewport", () => {
  const climber = player(364, -170);
  climber.vy = -60;
  const friend = player(190, FLOOR, 1);
  let previousLift = 0;
  let wasFalling = false;
  let lastY;
  let lastVy;
  let now = 0;
  while (!climber.descent && now < 4_000) {
    lastY = climber.y;
    lastVy = climber.vy;
    stepPlayers([climber, friend], now += 50, 0.05);
    assert.equal(friend.cameraLift, 0);
    if (!climber.descent) {
      assert.ok(climber.cameraLift >= previousLift);
      if (climber.vy > 0) {
        wasFalling = true;
        assert.equal(climber.cameraLift, previousLift);
        assert.ok(climber.y - BODY_HEIGHT < HEIGHT - climber.cameraLift);
      }
      previousLift = climber.cameraLift;
    }
  }
  assert.ok(wasFalling);
  assert.ok(lastY - BODY_HEIGHT < HEIGHT - previousLift);
  assert.ok(lastY + (lastVy + 360 * 0.05) * 0.05 - BODY_HEIGHT >= HEIGHT - previousLift);
  assert.equal(climber.descent, 1);
  assert.equal(climber.y, FLOOR);
  assert.equal(climber.cameraLift, 0);
  queueInput(climber, KEY.jump);
  stepPlayers([climber, friend], now + 50, 0.05);
  assert.ok(climber.y < FLOOR);
});

test("snapshot preserves world heights, camera and resets; ranking and markers use current positions", () => {
  const own = { ...player(160, -110, 3), cameraLift: climbCamera(0, -110), descent: 7 };
  const near = player(90, -224, 2);
  const far = player(181, SUMMIT_Y, 1);
  const lower = player(150, 40, 4);
  const visible = player(170, -230 + 16, 5);
  const everyone = [own, near, far, lower, visible];
  assert.equal(currentLeader(everyone), far);
  const packet = decodeSnapshot(encodeSnapshot(everyone, 23_950, far.slot).buffer);
  assert.deepEqual(packet.players[0], { slot: 3, x: 160, y: -110, cameraLift: 218, pose: POSE.idle, facing: 1, effects: 0, descent: 7 });
  assert.equal(packet.leader, 1);
  assert.equal(packet.phase, 23_950);
  const { above, below } = offscreenPlayers(everyone, own, own.cameraLift);
  assert.deepEqual(above.map(({ slot }) => slot), [2, 1]);
  assert.deepEqual(below.map(({ slot }) => slot), [4]);
  assert.equal(above[1].distance, 82.5);
  assert.equal(packet.players.find(({ slot }) => slot === far.slot).y, SUMMIT_Y);
  far.y = FLOOR;
  assert.equal(currentLeader(everyone), near);
  near.y = visible.y;
  assert.equal(currentLeader(everyone), near, "lowest slot wins an exact tie");
  assert.equal(currentLeader([player(200, SUMMIT_Y, LIMIT)]), undefined);
});

test("20 connected players share world phases and leader updates, and reconnect keeps the climb", (t) => {
  const room = new Room();
  t.after(() => clearInterval(room.timer));
  let now = 10_000;
  t.mock.method(Date, "now", () => now);
  function join(slot) {
    const token = slot.toString(16).padStart(32, "0");
    const socket = { send(data) { if (data instanceof Uint8Array) this.packet = data; }, close() {} };
    room.accept(socket);
    room.receive(socket, JSON.stringify({ t: "join", version: ROOM_VERSION, token, name: `친구${slot}`, character: "anoko" }));
    return { socket, climber: room.players.get(token) };
  }
  const members = Array.from({ length: LIMIT }, (_, index) => join(index));
  const top = members[9];
  Object.assign(top.climber, { y: -180, x: 364, cameraLift: 300 });
  Object.assign(members[3].climber, { y: platforms[6].y, x: 292 });
  for (let i = 0; i < 8; i++) {
    now += 50;
    room.tick();
  }
  assert.ok(members.every(({ socket }) => socket.packet === top.socket.packet));
  assert.equal(top.socket.packet.byteLength, 184);
  assert.equal(decodeSnapshot(top.socket.packet.buffer).leader, 9);
  const previous = top.climber.y;
  room.disconnect(top.socket);
  assert.equal(decodeSnapshot(members[0].socket.packet.buffer).leader, 3);
  const reconnected = join(9);
  assert.equal(reconnected.climber.y, previous);
  assert.equal(reconnected.climber.cameraLift, 300);
  assert.equal(decodeSnapshot(reconnected.socket.packet.buffer).leader, 9);
  while (!reconnected.climber.descent && now < 13_000) {
    now += 50;
    room.tick();
  }
  room.snapshot();
  const result = decodeSnapshot(members[0].socket.packet.buffer);
  assert.equal(result.leader, 3);
  assert.equal(result.players.find(({ slot }) => slot === 9).y, FLOOR);
});
