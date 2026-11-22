import { FLOOR, KEY, POSE, WIDTH } from "./protocol.mjs";

export const WALK_SPEED = 47;

export function movementDirection(keys) {
  return Number(Boolean(keys & KEY.right)) - Number(Boolean(keys & KEY.left));
}

export function advancePlayer(player, { direction, speed, jump, pose }, dt) {
  if (jump && player.y === FLOOR) player.vy = -122;
  if (direction) player.facing = direction;
  player.x = Math.max(20, Math.min(WIDTH - 20, player.x + direction * speed * dt));
  if (player.y !== FLOOR || player.vy < 0) {
    player.vy += 360 * dt;
    player.y = Math.min(FLOOR, player.y + player.vy * dt);
    if (player.y === FLOOR) player.vy = 0;
  }
  player.pose = player.y < FLOOR ? POSE.jump : pose;
}

export function setAutoMove(player, enabled, now) {
  if (player.autoMove === enabled) return;
  player.autoMove = enabled;
  player.autoPose = POSE.idle;
  player.nextAction = now;
}

const between = (min, max) => min + Math.random() * (max - min);

export function movePlayer(player, players, now, dt) {
  if (now > player.inputUntil && player.keys) {
    player.keys = 0;
    player.nextAction = now;
  }
  let direction = 0;
  let speed = WALK_SPEED;
  let pose = POSE.idle;
  let jump = player.jumpQueued;
  player.jumpQueued = false;
  if (player.keys) {
    direction = movementDirection(player.keys);
    if (direction) pose = POSE.walk;
    player.nextAction = now;
  } else if (player.autoMove !== false) {
    const grounded = player.y === FLOOR;
    if (now >= player.nextAction && grounded) jump = chooseAction(player, players, now) || jump;
    pose = player.autoPose ?? POSE.idle;
    if (pose === POSE.walk || pose === POSE.run) {
      const delta = player.target - player.x;
      direction = Math.abs(delta) > 2 ? Math.sign(delta) : 0;
      speed = pose === POSE.run ? 57 : 26;
      if (!direction) {
        player.autoPose = POSE.idle;
        pose = POSE.idle;
      }
    }
  }
  advancePlayer(player, { direction, speed, jump, pose }, dt);
}

function chooseAction(player, players, now) {
  const roll = Math.random();
  const neighbours = players.filter((other) => other !== player && Math.abs(other.x - player.x) < 35);
  if (roll < 0.57) {
    const others = players.filter((other) => other !== player);
    const other = others[Math.floor(Math.random() * others.length)];
    player.target = other && roll < 0.29 ? other.x + between(-14, 14) : player.x + between(-76, 76);
    player.autoPose = roll < 0.20 ? POSE.run : POSE.walk;
    player.nextAction = now + between(750, 2400);
  } else if (roll < 0.70) {
    player.autoPose = POSE.idle;
    player.nextAction = now + between(600, 1150);
    return true;
  } else if (roll < 0.86) {
    player.autoPose = POSE.sit;
    player.nextAction = now + between(700, 2300);
  } else if (neighbours.length) {
    player.autoPose = POSE.wave;
    player.facing = Math.sign(neighbours[0].x - player.x) || player.facing;
    player.nextAction = now + between(500, 1100);
  } else {
    player.autoPose = POSE.idle;
    player.nextAction = now + between(350, 850);
  }
  return false;
}
