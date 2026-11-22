const outline = [
  ".....#####.....",
  "...##bbbbb##...",
  "..#bbbbbbbbb#..",
  ".#bbbbbbbbbbb#.",
  ".#bbbbbbbbbbb#.",
  "#bbbbbbbbbbbbb#",
  "#bbbbbbbbbbbbb#",
  "#bbbbbbbbbbbbb#",
  "#bbbbbbbbbbbbb#",
  "#bbbbbbbbbbbbb#",
  ".#bbbbbbbbbbb#.",
  ".#bbbbbbbbbbb#.",
  "..#sssssssss#..",
  "...##sssss##...",
  ".....#####.....",
];

const faces = {
  1: [
    ".d.......d.",
    "..d.....d..",
    ".dd.....dd.",
    "...........",
    ".s.......s.",
    "..ddddddd..",
    "...dwwwd...",
    "....ddd....",
  ],
  2: [
    "..ffffff...",
    ".fffffffff.",
    ".df.....fd.",
    "..dd...dd..",
    "..d.....d..",
    "....ddd....",
    "...d...d...",
  ],
  3: [
    "rr.rr.rr.rr",
    "rrrrr.rrrrr",
    ".rrr...rrr.",
    "..r.....r..",
    "...........",
    "..ddddddd..",
    "...dwwwd...",
    "....ddd....",
  ],
  4: [
    "..dd...dd..",
    ".d.......d.",
    "..d.....d..",
    "..d.....d..",
    "..t.....t..",
    "..t.ddd.t..",
    "..td...dt..",
    "...d...d...",
    "....ddd....",
  ],
};

const colors = {
  "#": "#352a25", b: "#f7bf77", s: "#e29a58", d: "#513424",
  w: "#fff4d9", f: "#e88258", r: "#cf4e58", t: "#a7cee2",
};

export const EMOTE_SIZE = 15;

const sprites = Object.fromEntries(Object.entries(faces).map(([emote, expression]) => {
  const runs = [];
  for (let y = 0; y < EMOTE_SIZE; y++) {
    const face = expression[y - 3];
    const row = [...outline[y]].map((pixel, x) => {
      const detail = face?.[x - 2];
      return detail && detail !== "." ? detail : pixel;
    }).join("");
    for (const match of row.matchAll(/([^.])\1*/g)) {
      runs.push({ x: match.index, y, width: match[0].length, color: colors[match[1]] });
    }
  }
  return [emote, runs];
}));

export function drawEmote(ctx, emote, x, y) {
  for (const run of sprites[emote]) {
    ctx.fillStyle = run.color;
    ctx.fillRect(x + run.x, y + run.y, run.width, 1);
  }
}
