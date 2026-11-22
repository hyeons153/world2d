import { hosted, roomUrl } from "./config.mjs";
import { KEEPALIVE } from "./protocol.mjs";

export const roomAvailable = !hosted || Boolean(roomUrl);

export class Connection {
  socket;
  retry;
  heartbeat;
  attempt = 0;
  active = false;
  joined = false;
  lastPacket = 0;

  constructor(profile, events) {
    this.profile = profile;
    this.events = events;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.open();
  }

  open() {
    if (!this.active) return;
    if (!roomAvailable) {
      this.stop();
      this.events.ended(0);
      return;
    }
    const url = roomUrl || (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
    this.events.state(this.attempt ? "retrying" : "connecting");
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.binaryType = "arraybuffer";
    this.lastPacket = Date.now();
    const current = () => this.active && this.socket === socket;
    socket.addEventListener("open", () => {
      if (current()) this.send({ t: "join", ...this.profile });
    });
    socket.addEventListener("message", (event) => {
      if (!current()) return;
      this.lastPacket = Date.now();
      if (typeof event.data !== "string") {
        if (this.joined) this.events.snapshot(event.data);
        return;
      }
      const message = JSON.parse(event.data);
      if (message.t === "welcome") {
        this.joined = true;
        this.attempt = 0;
        this.events.welcome(message.slot);
        this.events.state("online");
      } else if (message.t === "player" || message.t === "left") {
        this.events.roster(message);
      }
    });
    socket.addEventListener("close", (event) => {
      if (!current()) return;
      clearInterval(this.heartbeat);
      this.joined = false;
      this.socket = undefined;
      if ([4001, 4003, 4004].includes(event.code)) {
        this.stop();
        this.events.ended(event.code);
        return;
      }
      this.events.state("retrying");
      const delay = Math.min(12_000, 550 * 2 ** this.attempt++) + Math.random() * 350;
      this.retry = setTimeout(() => this.open(), delay);
    });
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastPacket > (this.joined ? 24_000 : 13_000)) {
        socket.close();
        return;
      }
      if (this.joined) this.send({ t: "ping" });
    }, KEEPALIVE);
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN && this.socket.bufferedAmount < 100_000) {
      this.socket.send(JSON.stringify(message));
    }
  }

  input(keys) {
    if (this.joined) this.send({ t: "input", keys });
  }

  setAutoMove(enabled) {
    this.profile.autoMove = enabled;
    if (this.joined) this.send({ t: "auto-move", enabled });
  }

  stop() {
    this.active = false;
    this.joined = false;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = undefined;
    this.attempt = 0;
  }
}
