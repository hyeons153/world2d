import { MASCOT_ATLAS_URL } from "./mascot-atlas.mjs";
import { builtinCharacter, DEFAULT_CHARACTER, PIXELS, POSE } from "./protocol.mjs";

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
if (atlas) {
  atlas.src = MASCOT_ATLAS_URL;
  await atlas.decode();
}

const customSprites = new WeakMap();

function getCustom(sprite) {
  if (customSprites.has(sprite)) return customSprites.get(sprite);
  const canvas = document.createElement("canvas");
  canvas.width = PIXELS * sprite.frames;
  canvas.height = PIXELS;
  const ctx = canvas.getContext("2d");
  const data = Uint8ClampedArray.from(atob(sprite.pixels), (byte) => byte.charCodeAt(0));
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
  customSprites.set(sprite, canvas);
  return canvas;
}

export function drawCharacter(ctx, character, sprite, x, y, pose, facing, time, phase = 0) {
  const moving = pose === POSE.walk || pose === POSE.run;
  const step = Math.floor(time / (pose === POSE.run ? 105 : 155) + phase) & 1;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  if (character === "custom" && sprite) {
    const frame = sprite.frames === 1 ? 0 : pose === POSE.jump ? 3 : moving ? 1 + step : 0;
    const source = getCustom(sprite);
    const height = pose === POSE.sit ? 20 : 28;
    const bob = moving && sprite.frames === 1 ? step : 0;
    ctx.drawImage(source, frame * PIXELS, 0, PIXELS, PIXELS, -14, -height - bob, 28, height);
  } else {
    drawBuiltin(ctx, builtinCharacter(character) ?? DEFAULT_CHARACTER, moving ? step : 0, pose);
  }
  if (pose === POSE.wave) {
    const bob = Math.floor(time / 190) % 2;
    ctx.fillStyle = "#ffda9e";
    ctx.fillRect(12, -22 - bob, 2, 2);
    ctx.fillRect(15, -26 - bob, 1, 4);
    ctx.fillRect(14, -25 - bob, 3, 1);
  }
  ctx.restore();
}

function drawBuiltin(ctx, id, step, pose) {
  if (!atlas) return;
  const { tile } = characters[id];
  const height = pose === POSE.sit ? 28 : pose === POSE.jump ? 31 : PIXELS;
  if (id === "hachiware") {
    ctx.fillStyle = "#352c37";
    ctx.fillRect(10, -7 - step, 5, 4);
    ctx.fillRect(13, -8 - step, 3, 3);
    ctx.fillStyle = "#86acca";
    ctx.fillRect(11, -6 - step, 4, 2);
    ctx.fillRect(14, -7 - step, 1, 1);
  }
  ctx.drawImage(atlas, tile * PIXELS, 0, PIXELS, PIXELS, -PIXELS / 2, -height - step, PIXELS, height);
  if (id === "kani" && (pose === POSE.idle || pose === POSE.sit)) {
    ctx.fillStyle = "#504049";
    ctx.fillRect(-6, -8, 12, 6);
    ctx.fillRect(-6, -9, 5, 1);
    ctx.fillRect(1, -9, 5, 1);
    ctx.fillStyle = "#ecedb1";
    ctx.fillRect(-5, -8, 4, 5);
    ctx.fillRect(1, -8, 4, 5);
    ctx.fillStyle = "#b1a578";
    ctx.fillRect(-4, -6, 2, 1);
    ctx.fillRect(2, -6, 2, 1);
  }
}

export async function readPng(file, frames) {
  if (!file || ![1, 4].includes(frames)) throw new Error("PNG 파일을 선택해 주세요.");
  if (file.size < 33 || file.size > 512 * 1024) throw new Error("PNG는 512KB 이하로 선택해 주세요.");
  const header = new DataView(await file.slice(0, 33).arrayBuffer());
  if (header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a ||
      header.getUint32(8) !== 13 || header.getUint32(12) !== 0x49484452) {
    throw new Error("PNG 형식의 이미지가 필요해요.");
  }
  const width = header.getUint32(16);
  const height = header.getUint32(20);
  if (!width || !height || width > 512 || height > 512) throw new Error("이미지는 최대 512×512픽셀까지 등록할 수 있어요.");
  if (frames === 4 && width !== height * 4) throw new Error("스프라이트는 정사각형 4칸을 가로로 붙인 PNG여야 해요.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
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
