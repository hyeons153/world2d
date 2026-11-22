import { GifReader } from "./gif-reader.mjs";
import { expandGifPixels, MAX_GIF_DELAY, MAX_GIF_FRAMES, PIXELS } from "./protocol.mjs";

const MAX_SCREEN_PIXELS = 4_194_304;
const MAX_DECODE_PIXELS = 128_000_000;

function sampleFrames(frames) {
  const count = Math.min(frames.length, MAX_GIF_FRAMES);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * frames.length / count);
    const end = Math.floor((index + 1) * frames.length / count);
    const delay = frames.slice(start, end).reduce((sum, frame) => sum + (frame.delay < 2 ? 100 : frame.delay * 10), 0);
    // Alternate the sampling offset to avoid always picking the same phase of a repeating walk cycle.
    const source = start + (index % 2 ? Math.min(1, end - start - 1) : 0);
    return { source, delay: Math.min(MAX_GIF_DELAY, delay) };
  });
}

function background(data, frames) {
  if (!(data[10] & 0x80) || frames.some((frame) => frame.transparent_index !== null)) return [0, 0, 0, 0];
  const offset = 13 + data[11] * 3;
  return [data[offset], data[offset + 1], data[offset + 2], 255];
}

function fillFrame(screen, screenWidth, frame, color) {
  for (let y = frame.y; y < frame.y + frame.height; y++) {
    for (let x = frame.x; x < frame.x + frame.width; x++) screen.set(color, (y * screenWidth + x) * 4);
  }
}

function copyTile(screen, width, height, atlas, column, columns) {
  const scale = PIXELS / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const left = Math.floor((PIXELS - w) / 2);
  const top = PIXELS - h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const source = (Math.floor((y + 0.5) * height / h) * width + Math.floor((x + 0.5) * width / w)) * 4;
      if (screen[source + 3] < 128) continue;
      // Zero is transparent. Other indices encode the 6 × 7 × 6 color cube.
      const r = Math.round(screen[source] / 51);
      const g = Math.round(screen[source + 1] * 6 / 255);
      const b = Math.round(screen[source + 2] / 51);
      atlas[(top + y) * columns * PIXELS + column * PIXELS + left + x] = 1 + r * 42 + g * 6 + b;
    }
  }
}

export function normalizeGif(buffer) {
  const data = new Uint8Array(buffer);
  const gif = new GifReader(data);
  const { width, height } = gif;
  if (!width || !height || width * height > MAX_SCREEN_PIXELS || !gif.numFrames()) {
    throw new Error("GIF 해상도는 420만 픽셀 이하여야 해요.");
  }

  const frames = Array.from({ length: gif.numFrames() }, (_, index) => gif.frameInfo(index));
  let decodePixels = 0;
  for (const frame of frames) {
    if (!frame.width || !frame.height || frame.x + frame.width > width || frame.y + frame.height > height ||
        frame.palette_offset === null || frame.palette_offset + frame.palette_size * 3 > data.length ||
        data[frame.data_offset] < 2 || data[frame.data_offset] > 8) throw new Error("GIF 프레임을 읽을 수 없어요.");
    decodePixels += frame.disposal === 3 ? width * height : frame.width * frame.height;
  }
  if (decodePixels > MAX_DECODE_PIXELS) throw new Error("GIF가 너무 길거나 커요. 해상도나 재생 길이를 줄여 주세요.");

  const samples = sampleFrames(frames);
  const atlas = new Uint8Array(samples.length * PIXELS * PIXELS);
  const screen = new Uint8ClampedArray(width * height * 4);
  const color = background(data, frames);
  if (color[3]) fillFrame(screen, width, { x: 0, y: 0, width, height }, color);

  let nextSample = 0;
  for (let index = 0; index <= samples.at(-1).source; index++) {
    const frame = frames[index];
    const previous = frame.disposal === 3 ? screen.slice() : undefined;
    gif.decodeAndBlitFrameRGBA(index, screen);
    if (samples[nextSample]?.source === index) copyTile(screen, width, height, atlas, nextSample++, samples.length);
    if (frame.disposal === 2) fillFrame(screen, width, frame, color);
    else if (previous) screen.set(previous);
  }
  if (!atlas.some(Boolean)) throw new Error("투명 픽셀만 있는 이미지는 사용할 수 없어요.");

  const firstTile = new Uint8Array(PIXELS * PIXELS);
  for (let y = 0; y < PIXELS; y++) {
    const start = y * PIXELS * samples.length;
    firstTile.set(atlas.subarray(start, start + PIXELS), y * PIXELS);
  }
  const sprite = { frames: 1, pixels: btoa(String.fromCharCode(...expandGifPixels(firstTile))) };
  if (samples.length > 1) {
    sprite.animation = { delays: samples.map(({ delay }) => delay), pixels: btoa(String.fromCharCode(...atlas)) };
  }
  return sprite;
}
