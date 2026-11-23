import { FLOOR, HEIGHT, LIMIT, PIXELS, WIDTH } from "./protocol.mjs";

export const METRE = 16;
export const TOWER_HEIGHT = 100;
export const SUMMIT_Y = FLOOR - TOWER_HEIGHT * METRE;
export const SKY_LIMIT = SUMMIT_Y - 36;
export const BODY_HEIGHT = PIXELS + 2;
export const WORLD_CYCLE = 24_000;
const CAMERA_FOLLOW_Y = 108;

// Each entry is [height above the clearing, centre x, width] in world pixels.
// Keep these sorted by height so collision checks can start near each player.
export const platforms = [
  [24, 73, 58], [45, 109, 62], [67, 144, 62], [89, 182, 62],
  [111, 220, 62], [134, 258, 60], [158, 301, 66],
  [184, 264, 50], [209, 222, 44], [235, 184, 40], [261, 151, 36],
  [287, 119, 38], [313, 79, 54],
  [339, 106, 38], [366, 147, 34], [391, 190, 36], [418, 223, 34],
  [444, 255, 32], [470, 297, 44], [497, 331, 54],
  [524, 297, 34], [551, 252, 32], [578, 216, 32], [605, 182, 30],
  [631, 143, 30], [658, 108, 30], [685, 72, 46],
  [713, 113, 32], [740, 151, 28], [767, 187, 28], [794, 151, 30],
  [821, 115, 28], [848, 83, 32], [875, 122, 30], [902, 166, 28],
  [929, 202, 28], [956, 246, 52],
  [983, 285, 30], [1010, 325, 28], [1037, 294, 28], [1064, 254, 28],
  [1091, 213, 28], [1118, 179, 26], [1145, 142, 30], [1172, 99, 28],
  [1199, 58, 48],
  [1226, 96, 30], [1253, 136, 26], [1281, 170, 24], [1308, 208, 26],
  [1335, 247, 24], [1362, 285, 28], [1388, 326, 32], [1415, 289, 26],
  [1442, 253, 24], [1469, 218, 24], [1496, 177, 26], [1523, 139, 26],
  [1550, 101, 28], [1576, 65, 28], [TOWER_HEIGHT * METRE, 99, 62],
].map(([height, centre, width]) => ({ x: centre - width / 2, y: FLOOR - height, width }));

export function firstPlatformAtOrAbove(y) {
  let start = 0;
  let end = platforms.length;
  while (start < end) {
    const mid = Math.floor((start + end) / 2);
    if (platforms[mid].y > y) start = mid + 1;
    else end = mid;
  }
  return start;
}

const spikes = [
  [209, 24, 15, 900], [313, 4, 20, 2_700], [418, 18, 15, 1_750],
  [551, 2, 15, 610], [658, 14, 15, 3_000], [767, 11, 15, 1_200],
  [875, 3, 15, 2_160], [956, 32, 20, 330], [1037, 2, 15, 1_390],
  [1118, 9, 15, 2_910], [1253, 9, 15, 1_300], [1335, 1, 15, 3_000],
  [1442, 8, 15, 1_660], [1523, 3, 15, 740],
].map(([height, left, width, offset]) => {
  const platform = platforms[firstPlatformAtOrAbove(FLOOR - height)];
  return { x: platform.x + left, y: platform.y, width, offset };
});
const birds = [
  [352, 36, 174, 4_000, 1_050], [470, 214, 352, 4_800, 2_520],
  [612, 96, 246, 4_000, 530], [754, 57, 210, 4_800, 1_180],
  [908, 95, 261, 4_000, 1_730], [1044, 220, 358, 4_800, 440],
  [1165, 30, 179, 4_000, 2_330], [1291, 90, 238, 4_800, 1_420],
  [1405, 212, 362, 4_000, 3_120], [1510, 64, 225, 4_800, 1_370],
].map(([height, min, max, period, offset]) => ({ y: FLOOR - height, min, max, period, offset }));

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
