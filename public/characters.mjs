import { PIXELS, POSE } from "./protocol.mjs";

export const characters = {
  sprout: { name: "새싹", ink: "#253b32", light: "#d2e995", main: "#a6cb6a", dark: "#689d56", trim: "#f0d38b", ears: "leaf" },
  toast: { name: "토스트", ink: "#583827", light: "#fff0b6", main: "#e7ac68", dark: "#bb7651", trim: "#f5d188", ears: "round" },
  plum: { name: "자두", ink: "#3b2e51", light: "#f7c2de", main: "#b491cc", dark: "#8269aa", trim: "#f0b4b5", ears: "cat" },
  puddle: { name: "방울", ink: "#254857", light: "#c7f4e9", main: "#79c7cd", dark: "#50999e", trim: "#deeb9a", ears: "round" },
  moth: { name: "나비", ink: "#453948", light: "#f6e2fa", main: "#d9b2ca", dark: "#a783a9", trim: "#f5b98d", ears: "moth" },
  ember: { name: "불씨", ink: "#5c342d", light: "#ffe1ae", main: "#ed8a63", dark: "#b86351", trim: "#f1ca68", ears: "cat" },
};

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
  const step = Math.floor(time / (pose === POSE.run ? 105 : 155) + phase) % 2;
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
    const colors = characters[character] ?? characters.sprout;
    drawBuiltin(ctx, colors, [moving ? step : 0, pose, time]);
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

function drawBuiltin(ctx, color, [step, pose, time]) {
  const { ink, light, main, dark, trim, ears } = color;
  const movement = pose === POSE.walk || pose === POSE.run;
  const sit = pose === POSE.sit;
  const jump = pose === POSE.jump;
  const bob = sit ? 3 : movement ? step : 0;
  function px(fill, x, y, w, h) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y + bob, w, h);
  }
  px(ink, -7, -15, 14, 12);
  px(main, -6, -13, 12, 8);
  px(dark, -6, -6, 12, 2);
  px(light, -3, -10, 6, 4);
  if (sit) px(ink, -8, -4, 16, 1);
  else {
    px(ink, step && movement ? -8 : -6, -4, 5, jump ? 2 : 4 - bob);
    px(ink, step && movement ? 1 : 3, -4, 5, jump ? 3 : 4 - bob);
    px(dark, step && movement ? -7 : -5, -4, 3, 2);
    px(trim, step && movement ? 2 : 4, -4, 3, 2);
  }
  if (ears === "leaf") {
    px(ink, -1, -27, 2, 8); px(ink, 0, -28, 7, 5);
    px(dark, 1, -27, 5, 2); px(light, 1, -26, 3, 1);
  } else if (ears === "cat") {
    px(ink, -8, -26, 4, 7); px(ink, 3, -27, 5, 8);
    px(main, -7, -24, 3, 4); px(trim, 4, -25, 3, 4);
  } else if (ears === "moth") {
    px(ink, -6, -27, 2, 7); px(ink, 4, -27, 2, 7);
    px(trim, -7, -28, 2, 2); px(trim, 5, -28, 2, 2);
    px(ink, -10, -15, 20, 8); px(dark, -9, -14, 18, 6);
    px(light, -8, -13, 2, 2); px(light, 6, -12, 2, 2);
  } else {
    px(ink, -8, -24, 5, 6); px(ink, 4, -24, 5, 6);
    px(main, -7, -23, 3, 4); px(main, 5, -23, 3, 4);
  }
  px(ink, -7, -23, 14, 13);
  px(ink, -10, -20, 20, 7);
  px(main, -8, -20, 16, 7);
  px(main, -6, -22, 12, 10);
  px(light, -5, -20, 12, 7);
  px(light, -4, -14, 10, 2);
  px(trim, -5, -14, 2, 1); px(trim, 5, -14, 2, 1);
  const blink = Math.floor(time + main.charCodeAt(2) * 113) % 4100 > 3980;
  px(ink, -3, blink ? -16 : -18, 2, blink ? 1 : 3);
  px(ink, 3, blink ? -16 : -18, 2, blink ? 1 : 3);
  px(ink, 0, -14, 2, 1);
  if (!sit && ears !== "moth") {
    const waving = pose === POSE.wave;
    px(ink, 6, waving ? -15 : -10, 4, 4);
    px(light, 7, waving ? -14 : -9, 2, 2);
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
