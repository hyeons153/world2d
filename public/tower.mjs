import { FLOOR, HEIGHT, LIMIT, PIXELS, WIDTH } from "./protocol.mjs";

export const METRE = 16;
export const TOWER_HEIGHT = 30;
export const SUMMIT_Y = FLOOR - TOWER_HEIGHT * METRE;
export const SKY_LIMIT = SUMMIT_Y - 36;
export const BODY_HEIGHT = PIXELS + 2;
export const WORLD_CYCLE = 24_000;
const CAMERA_FOLLOW_Y = 108;

// Heights are in world pixels above the clearing. Platforms collide only from above.
export const platforms = [
  [24, 44, 58], [45, 78, 62], [67, 113, 62], [89, 151, 62],
  [111, 189, 62], [134, 228, 60], [158, 268, 66], [181, 238, 58],
  [205, 199, 58], [230, 158, 65], [254, 118, 57], [279, 77, 56],
  [304, 42, 65], [329, 79, 58], [354, 120, 64], [379, 163, 57],
  [405, 204, 62], [431, 246, 65], [457, 275, 57], [480, 299, 55],
].map(([height, x, width]) => ({ x, y: FLOOR - height, width }));

const spikes = [
  [8, 34, 900], [12, 2, 2_700], [14, 41, 1_750], [16, 1, 610], [17, 43, 3_000],
].map(([index, left, offset]) => ({
  x: platforms[index].x + left, y: platforms[index].y, width: 20, offset,
}));
const birds = [
  { min: 37, max: 148, y: FLOOR - 288, period: 4_000, offset: 1_050 },
  { min: 103, max: 248, y: FLOOR - 370, period: 4_800, offset: 2_520 },
  { min: 230, max: 348, y: FLOOR - 415, period: 4_000, offset: 530 },
];

export function worldPhase(time) {
  return ((time % WORLD_CYCLE) + WORLD_CYCLE) % WORLD_CYCLE;
}

export function towerHazards(phase) {
  return {
    spikes: spikes.map((spike) => {
      const elapsed = (phase + spike.offset) % 4_000;
      const state = elapsed < 2_300 ? "down" : elapsed < 2_850 ? "warning" : "up";
      return { ...spike, state };
    }),
    birds: birds.map(({ min, max, y, period, offset }) => {
      const progress = (phase + offset) % period / (period / 2);
      return { x: min + (max - min) * (1 - Math.abs(1 - progress)), y, facing: progress < 1 ? 1 : -1 };
    }),
  };
}

export function climbCamera(lift, y) {
  return Math.max(lift ?? 0, CAMERA_FOLLOW_Y - y);
}

export function belowCamera(y, lift) {
  return y - BODY_HEIGHT >= HEIGHT - lift;
}

export function heightMetres(y) {
  return Math.min(TOWER_HEIGHT, Math.max(0, (FLOOR - y) / METRE));
}

export function currentLeader(players) {
  let leader;
  for (const player of players) {
    if (player.slot < 0 || player.slot >= LIMIT) continue;
    const height = heightMetres(player.y);
    const leadingHeight = leader ? heightMetres(leader.y) : -1;
    if (height > leadingHeight || (height === leadingHeight && player.slot < leader.slot)) leader = player;
  }
  return leader;
}

export function offscreenPlayers(players, own, lift) {
  const top = -lift;
  const bottom = top + HEIGHT;
  const markers = { above: [], below: [] };
  for (const player of players) {
    if (player.slot === own.slot || player.slot >= LIMIT || !player.name) continue;
    const list = player.y <= top ? markers.above : player.y - BODY_HEIGHT >= bottom ? markers.below : null;
    if (!list) continue;
    list.push({ ...player, distance: Math.abs(player.y - own.y) / METRE });
  }
  for (const list of Object.values(markers)) list.sort((a, b) => a.distance - b.distance || a.slot - b.slot);
  return markers;
}

export function clampX(x) {
  return Math.max(20, Math.min(WIDTH - 20, x));
}
