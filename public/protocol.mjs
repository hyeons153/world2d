export const WIDTH = 384;
export const HEIGHT = 216;
export const FLOOR = 170;
export const LIMIT = 20;
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

export function encodeSnapshot(players) {
  const bytes = new Uint8Array(players.length * 5);
  const view = new DataView(bytes.buffer);
  players.forEach((player, index) => {
    const offset = index * 5;
    bytes[offset] = player.slot;
    view.setUint16(offset + 1, Math.round(player.x * 4), true);
    bytes[offset + 3] = Math.round(player.y);
    bytes[offset + 4] = player.pose | (player.facing < 0 ? 8 : 0) | (player.effects & EFFECT_MASK);
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
      effects: flags & EFFECT_MASK,
    });
  }
  return players;
}
