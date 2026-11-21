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
