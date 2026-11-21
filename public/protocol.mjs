export const WIDTH = 384;
export const HEIGHT = 216;
export const FLOOR = 170;
export const LIMIT = 20;
export const PIXELS = 32;
export const MAX_MESSAGE = 23_000;
export const DEFAULTS = ["sprout", "toast", "plum", "puddle", "moth", "ember"];
export const POSE = { idle: 0, walk: 1, run: 2, jump: 3, sit: 4, wave: 5 };
export const KEY = { left: 1, right: 2, jump: 4 };
export const KEEPALIVE = 10_000;
export const INPUT_LEASE = 3_000;

export function nickname(value) {
  return typeof value === "string"
    ? Array.from(value.normalize("NFC").trim().replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/gu, " ")).slice(0, 12).join("").trim()
    : "";
}

export function validSprite(sprite) {
  if (!sprite || ![1, 4].includes(sprite.frames) || typeof sprite.pixels !== "string") return false;
  const bytes = PIXELS * PIXELS * 4 * sprite.frames;
  if (sprite.pixels.length !== 4 * Math.ceil(bytes / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(sprite.pixels)) return false;
  try {
    return atob(sprite.pixels).length === bytes;
  } catch {
    return false;
  }
}

export function encodeSnapshot(players) {
  const bytes = new Uint8Array(players.length * 5);
  const view = new DataView(bytes.buffer);
  players.forEach((player, index) => {
    const offset = index * 5;
    bytes[offset] = player.slot;
    view.setUint16(offset + 1, Math.round(player.x * 4), true);
    bytes[offset + 3] = Math.round(player.y);
    bytes[offset + 4] = player.pose | (player.facing < 0 ? 8 : 0);
  });
  return bytes;
}

export function decodeSnapshot(buffer) {
  if (buffer.byteLength % 5 !== 0 || buffer.byteLength > LIMIT * 5) return [];
  const view = new DataView(buffer);
  const players = [];
  for (let offset = 0; offset < view.byteLength; offset += 5) {
    const flags = view.getUint8(offset + 4);
    players.push({
      slot: view.getUint8(offset),
      x: view.getUint16(offset + 1, true) / 4,
      y: view.getUint8(offset + 3),
      pose: flags & 7,
      facing: flags & 8 ? -1 : 1,
    });
  }
  return players;
}
