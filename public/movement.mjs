import { EFFECT, FLOOR, KEY, POSE, WIDTH } from "./protocol.mjs";

export const WALK_SPEED = 47;
const JUMP_SPEED = 168;
const HEAD_HEIGHT = 26;
const STOMP_RADIUS = 12;
const HIT_REACH = 33;
const HIT_HEIGHT = 19;
const ATTACK_COOLDOWN = 420;
const ATTACK_WINDUP = 100;
const ATTACK_EXTENSION = 140;
const ATTACK_RECOVERY = 100;

export function movementDirection(keys) {
  return Number(Boolean(keys & KEY.right)) - Number(Boolean(keys & KEY.left));
}

export function advancePlayer(player, { direction, speed, jump, pose, knockback = 0 }, dt) {
  if (jump && player.y === FLOOR) player.vy = -JUMP_SPEED;
  if (direction) player.facing = direction;
  player.x = Math.max(20, Math.min(WIDTH - 20, player.x + (direction * speed + knockback) * dt));
  if (player.y !== FLOOR || player.vy < 0) {
    player.vy += 360 * dt;
    player.y = Math.min(FLOOR, player.y + player.vy * dt);
    if (player.y === FLOOR) player.vy = 0;
  }
  player.pose = player.y < FLOOR ? POSE.jump : pose;
}

export function queueInput(player, keys) {
  const pressed = keys & ~player.keys;
  if (pressed & KEY.jump) player.jumpQueued = true;
  if (pressed & KEY.attack) player.attackQueued = true;
  player.keys = keys;
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
  let knockback = 0;
  player.jumpQueued = false;
  if (now < player.stunnedUntil) {
    knockback = player.knockback * 83;
    jump = false;
  } else if (player.keys) {
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
  advancePlayer(player, { direction, speed, jump, pose, knockback }, dt);
}

export function stepPlayers(players, now, dt) {
  const previousHeights = players.map((player) => player.y);
  const strikes = [];
  const impacts = [];
  for (const player of players) {
    if (player.y === FLOOR) player.stompedPlayers = undefined;
    movePlayer(player, players, now, dt);
    const interrupted = now < player.stunnedUntil || now < player.squashUntil;
    if (interrupted) {
      player.strikeAt = undefined;
      player.punchUntil = 0;
      player.attackUntil = 0;
    } else if (player.attackQueued && !(now < player.readyAt)) {
      player.strikeAt = now + ATTACK_WINDUP;
      player.punchUntil = 0;
      player.attackUntil = player.strikeAt + ATTACK_EXTENSION + ATTACK_RECOVERY;
      player.readyAt = now + ATTACK_COOLDOWN;
    }
    player.attackQueued = false;
  }

  for (let index = 0; index < players.length; index++) {
    const jumper = players[index];
    if (jumper.y <= previousHeights[index] || jumper.vy < 0 || now < jumper.stunnedUntil) continue;
    let landedOn;
    let surface = Infinity;
    for (let target = 0; target < players.length; target++) {
      const other = players[target];
      if (other === jumper || jumper.stompedPlayers?.has(other) || now < other.squashUntil ||
          Math.abs(jumper.x - other.x) > STOMP_RADIUS) continue;
      const head = other.y - HEAD_HEIGHT;
      if (previousHeights[index] <= previousHeights[target] - HEAD_HEIGHT && jumper.y >= head && head < surface) {
        surface = head;
        landedOn = other;
      }
    }
    if (landedOn) {
      landedOn.squashUntil = now + 340;
      landedOn.strikeAt = undefined;
      jumper.stompedPlayers ??= new Set();
      jumper.stompedPlayers.add(landedOn);
      jumper.y = surface;
      jumper.vy = -103;
      jumper.pose = POSE.jump;
    }
  }

  for (const player of players) {
    if (now >= player.strikeAt) {
      player.strikeAt = undefined;
      player.punchUntil = now + ATTACK_EXTENSION;
      player.attackUntil = player.punchUntil + ATTACK_RECOVERY;
      strikes.push(player);
    }
  }
  for (const attacker of strikes) {
    for (const target of players) {
      const distance = (target.x - attacker.x) * attacker.facing;
      if (target === attacker || distance < -2 || distance > HIT_REACH ||
          Math.abs(target.y - attacker.y) > HIT_HEIGHT || now < target.stunnedUntil) continue;
      target.hitUntil = now + 230;
      target.stunnedUntil = now + 230;
      target.knockback = attacker.facing;
      impacts.push({ slot: target.slot, side: -attacker.facing });
      // The next simulation ticks carry the target away from the attacker.
      target.x = Math.max(20, Math.min(WIDTH - 20, target.x + target.knockback * 4));
    }
  }

  for (const player of players) {
    player.effects = (now < player.attackUntil ? EFFECT.attack : 0) |
      (now < player.punchUntil ? EFFECT.punch : 0) |
      (now < player.hitUntil ? EFFECT.hit : 0) |
      (now < player.squashUntil ? EFFECT.squash : 0);
  }
  return impacts;
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
