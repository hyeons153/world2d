import { PIXELS } from "./protocol.mjs";

// Original 32-pixel drawing based on the supplied illustration.
const pixels = [
  "................................",
  ".........xxxxxxxxxx.............",
  "........xbhhhhhhhhbxxx..........",
  ".......xbhhhhhhhhmmhhbx.........",
  ".......xhhhhhhhhhhhhhhhx........",
  "......xmmmmmmmmmmmmmmmmmx.......",
  "......xmmmmmmmmmmmmmmmmmbx......",
  "...xxxmmmmmmmmmmmmmmmmmmbbx.....",
  "...xbbxxmmmmmmmmmmmmmmmmxxx.....",
  "...xbbbbxxmmmmmmmmmmmmmxxx......",
  "...xbbbbbmxxxmmmmmmmmxxxbx......",
  "..xbbbbbbbbbmxxxxxxxbbbbbbx.....",
  "..xbbbbbbbxbbbbbbbxxbbbbbbx.....",
  ".xbbbbbbbbbbbbbbbbxxbbbbbbx.....",
  ".xbbbbbbbbxxbbbbbxwxxbbbbbbx....",
  ".xbbbbbbbxwxxbbbbxxxxpppbbbx....",
  ".xbbbbpppxxxxbbbbbxxppappbbx....",
  ".xbbbppappxxbbxbbbbbbpppbbbx....",
  ".xbbbbpppbbbxbxbxbbbbbbbbbbxxx..",
  ".xbbbbbbbbbbbxxxbxbbbbbbbbxxxxx.",
  "..xbbbbbbbbbbbbbbbbbbbbbbbxlllx.",
  "..xbbbbbbbbbbbxabbbbbbbbbbxrrrx.",
  "...xbbbbbbbbbbbbbbbbbbbbbbxrrrx.",
  "...xbxbbbbbbbbbbbbbbbbbbbbxqqqx.",
  "....xaxbbbbbbbbbbbbbbbbbbxxqqqx.",
  "....xxbbbbbbbbbbbbbbbbbbsxxlllx.",
  ".....xbbbbbbbbbbbbbbbbbssx.xxx..",
  ".....xbbbbbbbbbbbbbbbbssx.......",
  "......xbbbbbbbbbbbbbssxx........",
  "......xbbbxxbbbbxxxbsxx.........",
  ".......xxxx.xxxx...xxxx.........",
  "................................",
];

const palette = {
  x: "#38292b", b: "#ffdfa9", s: "#eebc83", m: "#956750", h: "#a8775c",
  p: "#f5b2b5", a: "#dc8d88", w: "#fff9e9", l: "#beb6bd", r: "#d87553", q: "#f5d8c9",
};

export function createKurimanjuTile() {
  const tile = document.createElement("canvas");
  tile.width = tile.height = PIXELS;
  const ctx = tile.getContext("2d");
  for (const [y, row] of pixels.entries()) {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return tile;
}
