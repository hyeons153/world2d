import { cp, writeFile } from "node:fs/promises";

const source = new URL("../public/", import.meta.url);
const output = new URL("../dist/", import.meta.url);
const room = process.env.ROOM_WS_URL?.trim() || "";

if (room) {
  const url = new URL(room);
  if (url.protocol !== "wss:" || url.pathname !== "/ws" || url.username || url.password || url.search || url.hash) {
    throw new Error("ROOM_WS_URL must be a wss:// URL with the /ws path");
  }
}
await cp(source, output, { recursive: true });
await writeFile(new URL("config.mjs", output), "export const roomUrl = " + JSON.stringify(room) + ";\nexport const hosted = true;\n");
