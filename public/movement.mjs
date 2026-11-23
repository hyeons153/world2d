import { EFFECT, FLOOR, KEY, POSE } from "./protocol.mjs";
import { belowCamera, clampX, climbCamera, firstPlatformAtOrAbove, platforms, SKY_LIMIT, towerHazards, worldPhase } from "./tower.mjs";

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
const FOOT_RADIUS = 7;

export function movementDirection(keys) {
  return Number(Boolean(keys & KEY.right)) - Number(Boolean(keys & KEY.left));
}

function overlapsPlatform(x, platform) {
  return x + FOOT_RADIUS > platform.x && x - FOOT_RADIUS < platform.x + platform.width;
}

function advancePlayer(player, { direction, jump, knockback }, dt) {
  const startY = player.y;
  if (jump && !player.vy) {
    const support = platforms[firstPlatformAtOrAbove(startY)];
    if (startY === FLOOR || (support?.y === startY && overlapsPlatform(player.x, support))) player.vy = -JUMP_SPEED;
  }
  if (direction) player.facing = direction;
  player.x = clampX(player.x + (direction * WALK_SPEED + knockback) * dt);
  player.vy += 360 * dt;
  const nextY = Math.max(SKY_LIMIT, startY + player.vy * dt);
  let surface;
  if (player.vy >= 0) {
    for (let i = firstPlatformAtOrAbove(nextY); i < platforms.length && platforms[i].y >= startY; i++) {
      const platform = platforms[i];
      if (overlapsPlatform(player.x, platform)) surface = platform.y;
    }
    if (surface === undefined && nextY >= FLOOR) surface = FLOOR;
  }
  player.y = surface ?? nextY;
  if (surface !== undefined || nextY === SKY_LIMIT) player.vy = 0;
  player.grounded = surface !== undefined;
  player.pose = player.grounded ? (direction ? POSE.walk : POSE.idle) : POSE.jump;
}

export function queueInput(player, keys) {
  const pressed = keys & ~player.keys;
  if (pressed & KEY.jump) player.jumpQueued = true;
  if (pressed & KEY.attack) player.attackQueued = true;
  player.keys = keys;
}

function movePlayer(player, now, dt) {
  if (now > player.inputUntil) player.keys = 0;
  const stunned = now < player.stunnedUntil;
  advancePlayer(player, {
    direction: stunned ? 0 : movementDirection(player.keys),
    jump: !stunned && player.jumpQueued,
    knockback: stunned ? player.knockback * 83 : 0,
  }, dt);
  player.jumpQueued = false;
}

function hit(player, side, now, impacts) {
  player.hitUntil = now + 230;
  player.stunnedUntil = player.hitUntil;
  player.knockback = side;
  player.x = clampX(player.x + side * 4);
  impacts.push({ slot: player.slot, side: -side });
}

function hitHazard(player, hazards, now, impacts) {
  if (now < player.stunnedUntil) return;
  for (const spike of hazards.spikes) {
    if (spike.state !== "up" || player.x + 8 <= spike.x || player.x - 8 >= spike.x + spike.width ||
        player.y < spike.y - 10 || player.y - HEAD_HEIGHT >= spike.y) continue;
    hit(player, player.x < spike.x + spike.width / 2 ? -1 : 1, now, impacts);
    player.vy = -80;
    player.grounded = false;
    return;
  }
  for (const bird of hazards.birds) {
    if (Math.abs(player.x - bird.x) >= 18 || player.y < bird.y - 5 || player.y - HEAD_HEIGHT > bird.y + 5) continue;
    hit(player, bird.facing, now, impacts);
    player.vy = Math.max(player.vy, 65);
    player.grounded = false;
    return;
  }
}

export function stepPlayers(players, now, dt, phase = worldPhase(now)) {
  const previousHeights = players.map((player) => player.y);
  const strikes = [];
  const impacts = [];
  const hazards = towerHazards(phase);
  for (const player of players) {
    movePlayer(player, now, dt);
    hitHazard(player, hazards, now, impacts);
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
      jumper.grounded = false;
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
      hit(target, attacker.facing, now, impacts);
    }
  }

  for (const player of players) {
    if (player.grounded) player.stompedPlayers = undefined;
    player.cameraLift = climbCamera(player.cameraLift, player.y);
    if (belowCamera(player.y, player.cameraLift)) {
      Object.assign(player, {
        x: player.spawnX, y: FLOOR, vy: 0, grounded: true, cameraLift: 0, pose: POSE.idle,
        descent: ((player.descent ?? 0) + 1) & 255,
        stompedPlayers: undefined, strikeAt: undefined, attackUntil: 0, punchUntil: 0,
        hitUntil: 0, squashUntil: 0, stunnedUntil: 0,
      });
    }
    player.effects = (now < player.attackUntil ? EFFECT.attack : 0) |
      (now < player.punchUntil ? EFFECT.punch : 0) |
      (now < player.hitUntil ? EFFECT.hit : 0) |
      (now < player.squashUntil ? EFFECT.squash : 0);
  }
  return impacts;
}
