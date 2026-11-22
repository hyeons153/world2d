import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Room } from "./room.mjs";
import { MAX_MESSAGE } from "../public/protocol.mjs";

const root = new URL("../public/", import.meta.url);
const mime = { html: "text/html", mjs: "text/javascript", css: "text/css", svg: "image/svg+xml" };
const utf8 = new TextDecoder("utf-8", { fatal: true });

function frame(opcode, payload) {
  const header = Buffer.alloc(payload.length < 126 ? 2 : 4);
  header[0] = 0x80 | opcode;
  if (header.length === 2) header[1] = payload.length;
  else {
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  }
  return Buffer.concat([header, payload]);
}

function attachSocket(stream, room, head) {
  let pending = Buffer.alloc(0);
  let fragments = [];
  let length = 0;
  let opcode = 0;
  const peer = {
    send(message) {
      if (stream.destroyed || stream.writableEnded || stream.writableLength > 512_000) throw new Error("Socket unavailable");
      stream.write(frame(typeof message === "string" ? 1 : 2, Buffer.from(message)));
    },
    close(code, reason) {
      if (stream.writableEnded) return;
      const body = Buffer.alloc(2 + Buffer.byteLength(reason));
      body.writeUInt16BE(code);
      body.write(reason, 2);
      stream.end(frame(8, body));
    },
  };
  const parse = (chunk) => {
    if (stream.writableEnded) return;
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 2 && !stream.writableEnded) {
      const flag = pending[0];
      const final = Boolean(flag & 0x80);
      const type = flag & 0x0f;
      const size = pending[1] & 0x7f;
      const control = type >= 8;
      if (!(pending[1] & 0x80) || flag & 0x70 || ![0, 1, 2, 8, 9, 10].includes(type) ||
          (control && (!final || size > 125))) return room.close(peer, 1002, "frame");
      if (size === 127) return room.close(peer, 1009, "size");
      const offset = size === 126 ? 4 : 2;
      if (pending.length < offset + 4) return;
      const bytes = size === 126 ? pending.readUInt16BE(2) : size;
      if (!control && length + bytes > MAX_MESSAGE) return room.close(peer, 1009, "size");
      const end = offset + 4 + bytes;
      if (pending.length < end) return;
      const data = Buffer.alloc(bytes);
      for (let index = 0; index < bytes; index++) data[index] = pending[offset + 4 + index] ^ pending[offset + (index % 4)];
      pending = pending.subarray(end);
      if (type === 8) {
        room.disconnect(peer);
        stream.end(frame(8, data.length === 1 ? Buffer.alloc(0) : data));
        return;
      }
      if (type === 9) stream.write(frame(10, data));
      if (control) continue;
      if (type ? opcode : !opcode) return room.close(peer, 1002, "fragment");
      if (type) opcode = type;
      fragments.push(data);
      length += bytes;
      if (!final) {
        if (fragments.length > 128) return room.close(peer, 1009, "fragment limit");
        continue;
      }
      const message = Buffer.concat(fragments, length);
      fragments = [];
      length = 0;
      if (opcode !== 1) return room.close(peer, 1003, "text required");
      opcode = 0;
      try { room.receive(peer, utf8.decode(message)); }
      catch { return room.close(peer, 1007, "invalid text"); }
    }
  };
  stream.on("close", () => room.disconnect(peer));
  stream.on("error", () => room.disconnect(peer));
  stream.on("data", parse);
  room.accept(peer);
  if (head.length) parse(head);
}

export function createPlayground(options) {
  const room = new Room(options);
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    const file = path === "/" ? "index.html" : path.slice(1);
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const extension = file.split(".").at(-1);
    if (!/^[a-zA-Z0-9.-]+$/.test(file) || !Object.hasOwn(mime, extension)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const data = await readFile(fileURLToPath(new URL(file, root)));
      response.writeHead(200, {
        "Content-Type": mime[extension] + "; charset=utf-8",
        "Content-Length": data.length,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      }).end(request.method === "HEAD" ? undefined : data);
    } catch {
      response.writeHead(404).end();
    }
  });
  server.on("upgrade", (request, stream, head) => {
    const key = request.headers["sec-websocket-key"];
    const origin = request.headers.origin;
    if (!/^\/ws(?:\?|$)/.test(request.url) || request.headers.upgrade?.toLowerCase() !== "websocket" ||
        request.headers["sec-websocket-version"] !== "13" || !/^[A-Za-z0-9+/]{22}==$/.test(key ?? "") ||
        (origin && origin !== "http://" + request.headers.host && origin !== "https://" + request.headers.host)) {
      stream.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    stream.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
    stream.setNoDelay();
    attachSocket(stream, room, head);
  });
  return { server, room };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createPlayground({ practiceNpc: process.env.PRACTICE_NPC !== "0" });
  server.listen(port, "0.0.0.0", () => console.log("Pixel Clearing: http://localhost:" + port));
}
