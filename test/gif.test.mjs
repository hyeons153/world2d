import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeGif } from "../public/gif-image.mjs";
import { expandGifPixels, MAX_GIF_FRAMES, MAX_MESSAGE, PIXELS, validSprite, ROOM_VERSION } from "../public/protocol.mjs";
import { Room } from "../server/room.mjs";

function twoColorGif(frameCount) {
  const bytes = [...Buffer.from("GIF89a"), 2, 0, 1, 0, 0x81, 0, 0, 0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 255];
  for (let index = 0; index < frameCount; index++) {
    const left = index % 2 ? 0 : 1;
    const right = index % 2 ? 2 : 0;
    const codes = 4 | (left << 3) | (right << 6) | (5 << 9);
    bytes.push(0x21, 0xf9, 4, 9, 5, 0, 0, 0, 0x2c, 0, 0, 0, 0, 2, 0, 1, 0, 0, 2, 2, codes & 255, codes >> 8, 0);
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}

test("GIF registration keeps a compatible still frame and a transparent animated sprite", () => {
  const sprite = normalizeGif(twoColorGif(2));
  assert.ok(validSprite(sprite));
  assert.equal(sprite.frames, 1);
  assert.deepEqual(sprite.animation.delays, [50, 50]);
  const still = Buffer.from(sprite.pixels, "base64");
  assert.deepEqual([...still.subarray(16 * PIXELS * 4, 16 * PIXELS * 4 + 4)], [255, 0, 0, 255]);
  const moving = expandGifPixels(Buffer.from(sprite.animation.pixels, "base64"));
  const secondFrame = 16 * PIXELS * 2 + PIXELS;
  assert.equal(moving[secondFrame * 4 + 3], 0);
  assert.deepEqual([...moving.slice((secondFrame + 16) * 4, (secondFrame + 17) * 4)], [0, 255, 0, 255]);
});

test("long GIFs are sampled and fit within the multiplayer message budget", () => {
  const sprite = normalizeGif(twoColorGif(24));
  assert.equal(sprite.animation.delays.length, MAX_GIF_FRAMES);
  assert.ok(sprite.animation.delays.every((delay) => delay === 100));
  const indices = new Set(Buffer.from(sprite.animation.pixels, "base64"));
  assert.equal(indices.size, 3);
  const message = JSON.stringify({ t: "join", version: ROOM_VERSION, token: "1".repeat(32), name: "친구😀".repeat(4), character: "custom", sprite });
  assert.ok(Buffer.byteLength(message) < MAX_MESSAGE);
  assert.equal(validSprite({ ...sprite, animation: { ...sprite.animation, delays: [0] } }), false);
});

test("the room shares normalized GIF data with other players", (t) => {
  const room = new Room();
  t.after(() => clearInterval(room.timer));
  const received = [];
  const friend = {
    send(data) { if (typeof data === "string") received.push(JSON.parse(data)); },
    close() {},
  };
  const owner = { send() {}, close() {} };
  room.accept(friend);
  room.accept(owner);
  room.receive(friend, JSON.stringify({ t: "join", version: ROOM_VERSION, name: "친구", token: "1".repeat(32), character: "anoko" }));
  const sprite = normalizeGif(twoColorGif(2));
  room.receive(owner, JSON.stringify({ t: "join", version: ROOM_VERSION, name: "내 GIF", token: "2".repeat(32), character: "custom", sprite }));
  const custom = received.find((message) => message.t === "player" && message.character === "custom");
  assert.deepEqual(custom?.sprite, sprite);
});
