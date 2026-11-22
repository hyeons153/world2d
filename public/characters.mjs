import { MASCOT_ATLAS_URL } from "./mascot-atlas.mjs";
import { builtinCharacter, DEFAULT_CHARACTER, EFFECT, expandGifPixels, PIXELS, POSE } from "./protocol.mjs";

export const characters = {
  chiikawa: { name: "치이카와", tile: 0 },
  usagi: { name: "우사기", tile: 1 },
  hachiware: { name: "하치와레", tile: 2 },
  rakko: { name: "랏코", tile: 3 },
  shisa: { name: "시사", tile: 4 },
  kani: { name: "카니", tile: 5 },
  dekatsuyo: { name: "데카츠요", tile: 6 },
  anoko: { name: "아노코", tile: 7 },
};

const atlas = typeof Image === "function" ? new Image() : undefined;
export const RENDER_SCALE = 2;
const ATLAS_PIXELS = PIXELS * RENDER_SCALE;
if (atlas) {
  atlas.src = MASCOT_ATLAS_URL;
  await atlas.decode();
}

const customSprites = new WeakMap();

// The shoulder sits at the edge of each sprite. The arm is drawn on top at native pixel scale.
const punchArms = {
  chiikawa: [8, -12, "#f9f5ed"],
  usagi: [7, -12, "#fbefd0"],
  hachiware: [8, -13, "#f9f5ed"],
  rakko: [9, -13, "#fbefd0"],
  shisa: [9, -12, "#fbefd0"],
  kani: [9, -12, "#ffe6d6"],
  dekatsuyo: [11, -13, "#fbed99"],
  anoko: [9, -12, "#f9f5ed"],
  custom: [10, -13, "#f9f5ed"],
};

function getCustom(sprite) {
  if (customSprites.has(sprite)) return customSprites.get(sprite);
  const canvas = document.createElement("canvas");
  const animation = sprite.animation;
  canvas.width = PIXELS * (animation?.delays.length ?? sprite.frames);
  canvas.height = PIXELS;
  const ctx = canvas.getContext("2d");
  const data = animation
    ? expandGifPixels(Uint8Array.from(atob(animation.pixels), (byte) => byte.charCodeAt(0)))
    : Uint8ClampedArray.from(atob(sprite.pixels), (byte) => byte.charCodeAt(0));
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
  customSprites.set(sprite, canvas);
  return canvas;
}

function gifFrame(delays, time) {
  let remaining = time % delays.reduce((total, delay) => total + delay, 0);
  for (let frame = 0; frame < delays.length; frame++) {
    if (remaining < delays[frame]) return frame;
    remaining -= delays[frame];
  }
  return 0;
}

export function drawCharacter(ctx, character, sprite, x, y, pose, facing, time, phase = 0, effects = 0) {
  const moving = pose === POSE.walk || pose === POSE.run;
  const step = Math.floor(time / (pose === POSE.run ? 105 : 155) + phase) & 1;
  const squashed = Boolean(effects & EFFECT.squash);
  const id = character === "custom" && sprite ? "custom" : builtinCharacter(character) ?? DEFAULT_CHARACTER;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing * (squashed ? 1.18 : 1), squashed ? 0.58 : 1);
  if (id === "custom") {
    const frame = sprite.animation
      ? gifFrame(sprite.animation.delays, time)
      : sprite.frames === 1 ? 0 : pose === POSE.jump ? 3 : moving ? 1 + step : 0;
    const source = getCustom(sprite);
    const height = pose === POSE.sit ? 20 : 28;
    const bob = moving && sprite.frames === 1 ? step : 0;
    ctx.drawImage(source, frame * PIXELS, 0, PIXELS, PIXELS, -14, -height - bob, 28, height);
  } else {
    drawBuiltin(ctx, id, moving ? step : 0, pose);
  }
  if ((effects & EFFECT.attack) && !squashed) {
    const armBob = moving && (id !== "custom" || sprite.frames === 1) ? step : 0;
    drawPunchArm(ctx, id, pose, armBob, Boolean(effects & EFFECT.punch));
  } else if (pose === POSE.wave) {
    const bob = Math.floor(time / 190) % 2;
    ctx.fillStyle = "#ffda9e";
    ctx.fillRect(12, -22 - bob, 2, 2);
    ctx.fillRect(15, -26 - bob, 1, 4);
    ctx.fillRect(14, -25 - bob, 3, 1);
  }
  ctx.restore();
}

function drawPunchArm(ctx, id, pose, bob, extended) {
  const [shoulderX, anchorY, fill] = punchArms[id];
  const y = anchorY - bob + (pose === POSE.sit ? 2 : 0);
  const fistX = extended ? 20 : shoulderX + 2;
  const fistY = y - (extended ? 2 : 4);
  ctx.fillStyle = "#24201f";
  ctx.fillRect(shoulderX, y, fistX - shoulderX + 2, 4);
  ctx.fillRect(fistX - 1, fistY, 5, 6);
  ctx.fillRect(fistX, fistY - 1, 3, 8);
  ctx.fillStyle = fill;
  ctx.fillRect(shoulderX, y + 1, fistX - shoulderX + 1, 2);
  ctx.fillRect(fistX, fistY, 3, 6);
}

function drawBuiltin(ctx, id, step, pose) {
  if (!atlas) return;
  const { tile } = characters[id];
  const height = pose === POSE.sit ? 28 : pose === POSE.jump ? 31 : PIXELS;
  ctx.drawImage(atlas, tile * ATLAS_PIXELS, 0, ATLAS_PIXELS, ATLAS_PIXELS, -PIXELS / 2, -height - step, PIXELS, height);
}

export async function readSprite(file, frames, signal) {
  if (!file || file.size < 13) throw new Error("PNG 또는 GIF 파일을 선택해 주세요.");
  if (file.size >= 10_000_000) throw new Error("PNG와 GIF는 10MB 미만으로 올려 주세요.");
  const header = new DataView(await file.slice(0, 33).arrayBuffer());
  signal?.throwIfAborted();
  if (header.getUint32(0) === 0x47494638) return readGif(file, signal);

  if (header.byteLength < 33 || ![1, 4].includes(frames)) throw new Error("PNG 또는 GIF 형식의 이미지가 필요해요.");
  if (header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a ||
      header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452) {
    throw new Error("PNG 또는 GIF 형식의 이미지가 필요해요.");
  }
  const width = header.getUint32(16);
  const height = header.getUint32(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16_777_216) {
    throw new Error("PNG 해상도를 줄여 주세요. 최대 약 1,677만 픽셀이에요.");
  }
  if (frames === 4 && width !== height * 4) throw new Error("스프라이트는 정사각형 4칸을 가로로 붙인 PNG여야 해요.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    signal?.throwIfAborted();
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error("이미지 크기가 올바르지 않아요.");
    const canvas = document.createElement("canvas");
    canvas.width = PIXELS * frames;
    canvas.height = PIXELS;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const cell = width / frames;
    const scale = PIXELS / Math.max(cell, height);
    const drawWidth = Math.max(1, Math.round(cell * scale));
    const drawHeight = Math.max(1, Math.round(height * scale));
    for (let index = 0; index < frames; index++) {
      ctx.drawImage(image, cell * index, 0, cell, height,
        index * PIXELS + Math.floor((PIXELS - drawWidth) / 2), PIXELS - drawHeight, drawWidth, drawHeight);
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data.some((component, index) => index % 4 === 3 && component)) throw new Error("투명 픽셀만 있는 이미지는 사용할 수 없어요.");
    return { frames, pixels: btoa(String.fromCharCode(...data)) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readGif(file, signal) {
  const data = await file.arrayBuffer();
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./gif-worker.mjs", import.meta.url), { type: "module" });
    function finish(error, sprite) {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(sprite);
    }
    const abort = () => finish(signal.reason);
    const timeout = setTimeout(() => finish(new Error("GIF 변환 시간이 초과됐어요. 더 짧은 GIF를 선택해 주세요.")), 15_000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", ({ data: result }) => {
      if (result.error) finish(new Error(result.error));
      else finish(undefined, result.sprite);
    }, { once: true });
    worker.addEventListener("error", () => finish(new Error("GIF 파일을 읽을 수 없어요.")), { once: true });
    worker.postMessage(data, [data]);
  });
}
