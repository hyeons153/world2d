import { DurableObject } from "cloudflare:workers";
import { Room } from "./room.mjs";

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/ws") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((entry) => entry.trim());
    const origin = request.headers.get("Origin");
    if (!origin || !allowed.includes(origin)) return new Response("Forbidden", { status: 403 });
    return env.ROOM.get(env.ROOM.idFromName("clearing"), { locationHint: "apac" }).fetch(request);
  },
};

export class Playground extends DurableObject {
  room = new Room();
  connections = new Map();

  async fetch(request) {
    const ip = request.headers.get("CF-Connecting-IP");
    const now = Date.now();
    if (ip) {
      for (const [key, usage] of this.connections) {
        if (now - usage.since >= 60_000) this.connections.delete(key);
      }
      if (this.connections.size >= 512 && !this.connections.has(ip)) return new Response("Busy", { status: 429 });
      const usage = this.connections.get(ip) ?? { since: now, count: 0 };
      if (++usage.count > 60) return new Response("Slow down", { status: 429 });
      this.connections.set(ip, usage);
    }
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.room.accept(server);
    server.addEventListener("message", (event) => this.room.receive(server, event.data));
    server.addEventListener("close", (event) => {
      this.room.disconnect(server);
      if (event.code < 1000 || [1004, 1005, 1006, 1015].includes(event.code)) server.close();
      else server.close(event.code, event.reason);
    });
    server.addEventListener("error", () => this.room.close(server, 1011, "connection error"));
    return new Response(null, { status: 101, webSocket: client });
  }
}
