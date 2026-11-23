export const WIDTH = 384;
export const HEIGHT = 216;
export const FLOOR = 170;
export const LIMIT = 20;
// Static collision geometry is shared by the browser and room, so a new layout needs a matching version.
export const ROOM_VERSION = 3;
export const PIXELS = 32;
export const MAX_MESSAGE = 23_000;
export const MAX_GIF_FRAMES = 12;
export const MAX_GIF_DELAY = 5000;
export const DEFAULT_CHARACTER = "chiikawa";
export const DEFAULTS = [DEFAULT_CHARACTER, "usagi", "hachiware", "rakko", "shisa", "kani", "dekatsuyo", "anoko"];
export const POSE = { idle: 0, walk: 1, run: 2, jump: 3, sit: 4, wave: 5 };
export const KEY = { left: 1, right: 2, jump: 4, attack: 8 };
export const INPUT_MASK = KEY.left | KEY.right | KEY.jump | KEY.attack;
export const EFFECT = { attack: 16, hit: 32, squash: 64, punch: 128 };
export const EFFECT_MASK = EFFECT.attack | EFFECT.hit | EFFECT.squash | EFFECT.punch;
export const KEEPALIVE = 10_000;
export const INPUT_LEASE = 3_000;
export const EMOTE_DURATION = 1_650;
export const EMOTE_COOLDOWN = 400;

export function validEmote(value) {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}

const legacyCharacters = {
  sprout: DEFAULT_CHARACTER,
  toast: "usagi",
  plum: "hachiware",
  puddle: "rakko",
  moth: "shisa",
  ember: "kani",
};

export function builtinCharacter(value) {
  if (typeof value !== "string") return undefined;
  if (DEFAULTS.includes(value)) return value;
  return Object.hasOwn(legacyCharacters, value) ? legacyCharacters[value] : undefined;
}

export function nickname(value) {
  return typeof value === "string"
    ? Array.from(value.normalize("NFC").trim().replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/gu, " ")).slice(0, 12).join("").trim()
    : "";
}

function validPixels(pixels, bytes) {
  if (typeof pixels !== "string" || pixels.length !== 4 * Math.ceil(bytes / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(pixels)) return false;
  try {
    return atob(pixels).length === bytes;
  } catch {
    return false;
  }
}

export function validSprite(sprite) {
  if (!sprite || ![1, 4].includes(sprite.frames) || !validPixels(sprite.pixels, PIXELS * PIXELS * 4 * sprite.frames)) return false;
  if (sprite.animation === undefined) return true;
  const animation = sprite.animation;
  if (sprite.frames !== 1 || !animation || !Array.isArray(animation.delays)) return false;
  const count = animation.delays.length;
  return count >= 2 && count <= MAX_GIF_FRAMES &&
    animation.delays.every((delay) => Number.isInteger(delay) && delay >= 20 && delay <= MAX_GIF_DELAY) &&
    validPixels(animation.pixels, PIXELS * PIXELS * count);
}

export function expandGifPixels(pixels) {
  const rgba = new Uint8ClampedArray(pixels.length * 4);
  for (let index = 0; index < pixels.length; index++) {
    const color = pixels[index] - 1;
    if (color < 0 || color > 251) continue;
    const offset = index * 4;
    rgba[offset] = Math.floor(color / 42) * 51;
    rgba[offset + 1] = Math.round((Math.floor(color / 6) % 7) * 255 / 6);
    rgba[offset + 2] = (color % 6) * 51;
    rgba[offset + 3] = 255;
  }
  return rgba;
}

const SNAPSHOT_TAG = 254;
const SNAPSHOT_HEADER = 4;
const SNAPSHOT_PLAYER = 9;

export function encodeSnapshot(players, phase, leader) {
  const bytes = new Uint8Array(SNAPSHOT_HEADER + players.length * SNAPSHOT_PLAYER);
  const view = new DataView(bytes.buffer);
  bytes[0] = SNAPSHOT_TAG;
  bytes[1] = leader ?? 255;
  view.setUint16(2, phase, true);
  players.forEach((player, index) => {
    const offset = SNAPSHOT_HEADER + index * SNAPSHOT_PLAYER;
    bytes[offset] = player.slot;
    view.setUint16(offset + 1, Math.round(player.x * 4), true);
    view.setInt16(offset + 3, Math.round(player.y * 4), true);
    view.setUint16(offset + 5, Math.round((player.cameraLift ?? 0) * 4), true);
    bytes[offset + 7] = player.pose | (player.facing < 0 ? 8 : 0) | (player.effects & EFFECT_MASK);
    bytes[offset + 8] = player.descent ?? 0;
  });
  return bytes;
}

export function decodeSnapshot(buffer) {
  const payload = buffer.byteLength - SNAPSHOT_HEADER;
  if (payload < 0 || payload % SNAPSHOT_PLAYER !== 0 || payload > (LIMIT + 1) * SNAPSHOT_PLAYER) return null;
  const view = new DataView(buffer);
  if (view.getUint8(0) !== SNAPSHOT_TAG) return null;
  const players = [];
  for (let offset = SNAPSHOT_HEADER; offset < view.byteLength; offset += SNAPSHOT_PLAYER) {
    const flags = view.getUint8(offset + 7);
    players.push({
      slot: view.getUint8(offset),
      x: view.getUint16(offset + 1, true) / 4,
      y: view.getInt16(offset + 3, true) / 4,
      cameraLift: view.getUint16(offset + 5, true) / 4,
      pose: flags & 7,
      facing: flags & 8 ? -1 : 1,
      effects: flags & EFFECT_MASK,
      descent: view.getUint8(offset + 8),
    });
  }
  const leader = view.getUint8(1);
  return { players, phase: view.getUint16(2, true), leader: leader < LIMIT ? leader : undefined };
}
