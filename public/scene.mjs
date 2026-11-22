import { characters, drawCharacter } from "./characters.mjs";
import { WIDTH, HEIGHT, FLOOR, POSE } from "./protocol.mjs";

function pixels(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function shape(ctx, color, coords) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(coords[0], coords[1]);
  for (let index = 2; index < coords.length; index += 2) ctx.lineTo(coords[index], coords[index + 1]);
  ctx.closePath();
  ctx.fill();
}

function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function tree(ctx, x, base, span, color, shade, light) {
  const unit = span / 16;
  const draw = (fill, left, top, width, height) => pixels(ctx, fill,
    Math.round(x + left * unit), Math.round(base + top * unit), Math.round(width * unit), Math.round(height * unit));
  draw(shade, -1, -15, 3, 15);
  for (let level = 0; level < 4; level++) {
    const y = -26 + level * 5;
    const size = 2 + level * 2;
    draw(color, -size + 1, y, size * 2 - 1, 2);
    draw(color, -size, y + 2, size * 2 + 1, 3);
    draw(shade, 2, y + 2, size - 1, 3);
    draw(light, -size + 1, y + 2, 2, 1);
  }
}

function cloud(ctx, x, y, width, color, shade) {
  pixels(ctx, shade, x, y + 4, width, 4);
  pixels(ctx, color, x + 4, y + 2, width - 9, 4);
  pixels(ctx, color, x + 9, y, Math.round(width * 0.48), 3);
  pixels(ctx, shade, x + 6, y + 8, width - 14, 2);
}

function makeBackdrop() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  const rand = random(29);
  ["#9095bb", "#a8a1c0", "#bcaec7", "#c9b5c9", "#d9bdc9", "#e7c6c7", "#f0cfca", "#f2d5c3"]
    .forEach((color, index) => pixels(ctx, color, 0, index * 17, WIDTH, 17));
  for (const [x, y, width] of [[28, 29, 43], [94, 47, 63], [280, 34, 59], [332, 57, 43], [232, 66, 43], [48, 74, 30]]) {
    cloud(ctx, x, y, width, "#f4dcd1", "#e5c8cd");
  }
  for (const [x, y] of [[15, 16], [52, 16], [85, 35], [136, 25], [291, 16], [331, 25], [367, 17], [249, 21]]) {
    pixels(ctx, "#f5e5d2", x, y, 2, 2);
  }
  for (let y = -23; y <= 23; y++) {
    const span = Math.floor(Math.sqrt(24 * 24 - y * y));
    pixels(ctx, y > 10 ? "#f8d7a3" : "#ffe6b0", 194 - span, 56 + y, span * 2, 1);
  }
  for (const y of [66, 72, 76]) pixels(ctx, "#edc4aa", 170, y, 48, 1);

  shape(ctx, "#a7a0b6", [0, 105, 27, 91, 46, 96, 76, 74, 93, 80, 104, 76, 138, 107, 170, 118, 205, 111, 222, 95, 245, 90, 271, 64, 286, 76, 297, 75, 314, 94, 334, 84, 361, 97, 384, 86, 384, 170, 0, 170]);
  shape(ctx, "#bcb0c0", [54, 91, 76, 74, 93, 80, 104, 76, 125, 96, 102, 88, 95, 90, 79, 81, 75, 86, 67, 85]);
  shape(ctx, "#cbb9c5", [246, 89, 271, 64, 286, 76, 297, 75, 314, 94, 292, 83, 288, 85, 276, 76, 272, 79, 267, 74, 258, 86]);
  shape(ctx, "#8588a1", [0, 122, 29, 107, 61, 119, 93, 106, 124, 115, 159, 128, 206, 125, 235, 115, 262, 121, 308, 99, 343, 115, 384, 103, 384, 166, 0, 166]);
  shape(ctx, "#687e87", [0, 132, 37, 126, 59, 133, 104, 121, 150, 134, 183, 141, 226, 134, 263, 139, 299, 128, 344, 132, 384, 120, 384, 168, 0, 168]);
  for (let x = -2; x < WIDTH; x += 5) {
    const height = 8 + rand() * 10;
    tree(ctx, x, 148 + Math.sin(x / 28) * 3 + rand() * 4, height, "#60767b", "#576b74", "#728786");
  }
  shape(ctx, "#849893", [0, 150, 51, 147, 87, 149, 109, 145, 152, 148, 192, 144, 226, 144, 262, 150, 304, 144, 342, 149, 384, 144, 384, 177, 0, 177]);
  shape(ctx, "#a4aba0", [44, 157, 97, 151, 140, 153, 182, 147, 232, 147, 272, 152, 333, 150, 380, 155, 384, 165, 21, 165]);
  for (let index = 0; index < 70; index++) {
    const x = 59 + rand() * 280;
    const y = 149 + rand() * 16;
    pixels(ctx, index % 4 === 0 ? "#d1c9a1" : "#bdba9e", Math.floor(x), Math.floor(y), 1 + Math.floor(rand() * 9), 1);
  }
  for (const [x, base, width] of [[9, 167, 31], [26, 167, 23], [45, 166, 12], [363, 166, 19], [379, 168, 29], [348, 166, 11]]) {
    tree(ctx, x, base, width, "#426a64", "#365a58", "#62917a");
  }
  for (const x of [8, 19, 33, 49, 366, 382]) {
    pixels(ctx, "#507c66", x - 7, 161, 14, 7);
    pixels(ctx, "#719174", x - 4, 159, 8, 3);
  }
  // The strip at FLOOR is the same ground line used by the server.
  pixels(ctx, "#886f6b", 0, FLOOR + 5, WIDTH, 41);
  pixels(ctx, "#776260", 0, FLOOR + 25, WIDTH, 21);
  pixels(ctx, "#aa846f", 0, FLOOR + 5, WIDTH, 8);
  pixels(ctx, "#516c49", 0, FLOOR + 2, WIDTH, 5);
  pixels(ctx, "#7e9757", 0, FLOOR - 1, WIDTH, 4);
  pixels(ctx, "#aabd71", 0, FLOOR - 2, WIDTH, 2);
  for (let index = 0; index < 250; index++) {
    const x = Math.floor(rand() * WIDTH);
    const y = FLOOR + 6 + Math.floor(rand() * 40);
    const palette = ["#927b6b", "#6c6060", "#a08773", "#7b6964"];
    pixels(ctx, palette[index % 4], x, y, 2 + Math.floor(rand() * 5), 1 + (index % 3 === 0));
    if (index < 77) {
      pixels(ctx, "#646f46", x, FLOOR + 3, 2 + index % 5, 2 + index % 4);
      pixels(ctx, "#c2cc7a", x, FLOOR - 2 - (index % 5 === 0 ? 1 : 0), 2 + index % 4, 1);
    }
  }
  for (const x of [18, 45, 61, 317, 332, 355, 372]) {
    pixels(ctx, "#557351", x, FLOOR - 7, 2, 6);
    pixels(ctx, "#fae09a", x - 1, FLOOR - 9, 4, 3);
    pixels(ctx, "#f7b98f", x, FLOOR - 8, 2, 1);
  }
  return canvas;
}

let backdrop;
const motes = Array.from({ length: 22 }, (_, index) => ({
  x: (index * 71) % WIDTH,
  y: 74 + (index * 43) % 93,
  phase: index * 2.9,
}));

export function drawScene(canvas, players, now, ownSlot = -1, background = "original") {
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  let shadow = "#698353";
  if (background === "white" || background === "black") {
    const white = background === "white";
    pixels(ctx, white ? "#fff" : "#000", 0, 0, WIDTH, HEIGHT);
    shadow = white ? "#dedede" : "#252525";
  } else {
    backdrop ??= makeBackdrop();
    ctx.drawImage(backdrop, 0, 0);
    for (const mote of motes) {
      const glow = Math.sin(now / 730 + mote.phase);
      if (glow < 0.05) continue;
      const x = Math.floor(mote.x + 3 * Math.sin(now / 970 + mote.phase));
      const y = Math.floor(mote.y + 3 * Math.cos(now / 1100 + mote.phase));
      pixels(ctx, glow > 0.58 ? "#fff1bb" : "#cbd2a0", x, y, glow > 0.82 ? 2 : 1, 1);
    }
  }
  const ordered = [...players].sort((a, b) => a.y - b.y || a.slot - b.slot);
  for (const player of ordered) {
    const x = Math.round(player.x);
    pixels(ctx, shadow, x - 10, FLOOR, 20, 2);
    pixels(ctx, shadow, x - 7, FLOOR + 2, 14, 1);
    drawCharacter(ctx, player.character, player.sprite, player.x, player.y, player.pose, player.facing, now, player.slot);
  }
  ctx.font = "bold 9px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const labels = [];
  for (const player of ordered) {
    if (!player.name) continue;
    const width = Math.min(104, Math.ceil(ctx.measureText(player.name).width + 8));
    const x = Math.min(WIDTH - width / 2 - 2, Math.max(width / 2 + 2, Math.round(player.x)));
    const y = Math.round(player.y) - 38;
    let row = y;
    // A few stacked nickname rows keep crowded characters readable without moving them.
    while (row > y - 38 && labels.some((tag) => Math.abs(tag.x - x) * 2 < tag.width + width + 4 && Math.abs(tag.row - row) < 12)) row -= 12;
    labels.push({ x, row, width, player });
  }
  for (const { x, row, width, player } of labels) {
    const mine = player.slot === ownSlot;
    pixels(ctx, mine ? "#eef1ad" : "#344d49", x - width / 2, row - 5, width, 11);
    ctx.fillStyle = mine ? "#324437" : "#fff3d5";
    ctx.fillText(player.name, x, row + 0.5, width - 5);
  }
}

const starters = Object.keys(characters);
export function previewPlayers(time) {
  return starters.map((character, slot) => {
    const phase = time / (1150 + slot * 100) + slot * 1.75;
    const jumping = (time / 1_000 + slot * 2.15) % 7.3;
    return {
      slot, character, name: "", x: 70 + slot * 35 + Math.sin(phase) * 12,
      y: FLOOR - (jumping < 0.75 ? Math.sin(jumping / 0.75 * Math.PI) * 18 : 0),
      pose: jumping < 0.75 ? POSE.jump : Math.abs(Math.cos(phase)) > 0.3 ? POSE.walk : POSE.sit,
      facing: Math.cos(phase) >= 0 ? 1 : -1,
    };
  });
}
