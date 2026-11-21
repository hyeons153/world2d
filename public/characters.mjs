import { builtinCharacter, DEFAULT_CHARACTER, PIXELS, POSE } from "./protocol.mjs";

export const characters = {
  chiikawa: { name: "치이카와", ink: "#4b3d45", main: "#fffaf5", shade: "#e8dce7", blush: "#f4a4b7" },
  usagi: { name: "우사기", ink: "#583d31", main: "#ffe5a1", shade: "#eaba74", blush: "#ed9b87" },
  hachiware: { name: "하치와레", ink: "#3a4561", main: "#fffceb", shade: "#e2e4ee", blush: "#ef9cad", accent: "#719dda" },
  rakko: { name: "랏코", ink: "#4e362d", main: "#faf1de", shade: "#dbc2a4", blush: "#e8a093", accent: "#9d6850" },
  shisa: { name: "시사", ink: "#693a30", main: "#fff1c9", shade: "#f2c985", blush: "#ed8d8f", accent: "#ee9e5e" },
  kani: { name: "카니", ink: "#59404c", main: "#f5bfd8", shade: "#dfa2c0", blush: "#ef7eac", accent: "#e8669c" },
  dekatsuyo: { name: "데카츠요", ink: "#57402e", main: "#ffe6a1", shade: "#e1b66d", blush: "#f588a8", accent: "#f0cd81" },
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
    drawBuiltin(ctx, builtinCharacter(character) ?? DEFAULT_CHARACTER, moving ? step : 0, pose, time);
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

function drawBuiltin(ctx, id, step, pose, time) {
  const { ink, main, shade, blush, accent } = characters[id];
  const sit = pose === POSE.sit;
  const jump = pose === POSE.jump;
  const large = id === "dekatsuyo";
  const bob = sit ? 2 : step;

  function px(fill, x, y, w, h) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y + bob, w, h);
  }

  function rounded(fill, x, y, w, h) {
    px(fill, x + 2, y, w - 4, h);
    px(fill, x + 1, y + 1, w - 2, h - 2);
    px(fill, x, y + 2, w, h - 4);
  }

  function outline(fill, x, y, w, h) {
    rounded(ink, x, y, w, h);
    rounded(fill, x + 1, y + 1, w - 2, h - 2);
  }

  const body = id === "rakko" ? accent : main;
  if (id === "hachiware" || id === "rakko" || id === "shisa") {
    outline(accent, -12, -9, 9, 7);
  }
  if (!sit) {
    const stride = pose === POSE.walk || pose === POSE.run;
    for (const x of stride ? [-7 + step, 3 - step] : [-6, 2]) {
      px(ink, x, -4, 5, jump ? 3 : 4 - bob);
      px(shade, x + 1, -4, 3, jump ? 2 : 3 - bob);
    }
  }
  outline(body, large ? -9 : -7, -14, large ? 18 : 14, sit ? 12 : 13);
  px(shade, -3, -6, 6, 1);
  outline(body, 5, pose === POSE.wave ? -16 : -11, 7, 7);

  switch (id) {
    case "usagi":
      outline(main, -9, -31, 7, 13);
      outline(main, 2, -31, 7, 13);
      px(blush, -7, -29, 2, 6);
      px(blush, 5, -29, 2, 6);
      break;
    case "hachiware":
      for (const x of [-10, 4]) {
        px(ink, x + 1, -28, 4, 9);
        px(ink, x, -25, 6, 7);
        px(accent, x + 1, -25, 4, 7);
        px(blush, x + 2, -26, 2, 3);
      }
      break;
    case "shisa":
      for (const [x, y] of [[-13, -24], [-8, -28], [-3, -29], [2, -28], [7, -24], [-13, -18], [7, -18]]) {
        outline(accent, x, y, 7, 8);
      }
      break;
    case "dekatsuyo":
      for (const [x, y] of [[-15, -24], [-11, -28], [-5, -30], [1, -29], [7, -26], [-15, -17], [6, -18]]) {
        outline(accent, x, y, 9, 10);
      }
      break;
    default:
      outline(accent ?? main, -10, -27, 7, 8);
      outline(accent ?? main, 3, -27, 7, 8);
  }

  const faceWidth = large ? 28 : id === "shisa" ? 20 : 22;
  outline(main, -faceWidth / 2, -24, faceWidth, 17);
  px(shade, -faceWidth / 2 + 3, -9, faceWidth - 6, 1);

  if (id === "hachiware") {
    px(accent, -9, -23, 18, 2);
    px(accent, -9, -21, 7, 2);
    px(accent, 2, -21, 7, 2);
    px(main, -1, -23, 2, 3);
  }
  if (id === "kani") {
    px(ink, -9, -24, 18, 2);
    px(accent, -8, -24, 16, 1);
    for (const x of [-10, 4]) {
      outline(accent, x, -30, 7, 8);
      px(main, x + 3, -30, 1, 3);
    }
  }
  if (id === "shisa") {
    px(accent, -6, -21, 3, 2);
    px(accent, 3, -21, 3, 2);
    px(shade, 0, -22, 1, 3);
  }

  const blink = Math.floor(time + main.charCodeAt(2) * 113) % 4100 > 3980;
  if (large) {
    for (const x of [-8, 3]) {
      px("#fffbef", x, -20, 5, 6);
      px(ink, x + 2, -19, 2, 4);
      px(ink, x, -21, 4, 1);
    }
    px(ink, -3, -14, 7, 4);
    px("#fcf2d2", -2, -14, 5, 1);
    px(blush, -1, -11, 3, 4);
    px(ink, 0, -10, 1, 2);
    return;
  }

  for (const x of [-5, 3]) {
    px(ink, x, blink ? -16 : -18, 2, blink || id === "rakko" ? 1 : 3);
    px(blush, x + (x < 0 ? -2 : 1), -14, 3, 2);
  }
  if (id === "rakko") {
    px(accent, -5, -22, 1, 6);
    px(accent, -7, -20, 5, 1);
    px(ink, -1, -15, 3, 1);
  }
  px(ink, -2, -13, 1, 2);
  px(ink, 2, -13, 1, 2);
  px(ink, -1, -12, 3, 1);
  if (id === "usagi" || id === "shisa") px(blush, 0, -11, 1, 1);
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
