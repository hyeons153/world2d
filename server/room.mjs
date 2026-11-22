import { movePlayer, setAutoMove } from "../public/movement.mjs";
import { builtinCharacter, encodeSnapshot, FLOOR, INPUT_LEASE, KEY, LIMIT, MAX_MESSAGE, nickname, POSE, validSprite } from "../public/protocol.mjs";

const PULSE = 50;
const EXPIRE = 38_000;
const GRACE = 14_000;
const SPAWN = [141, 254, 190, 114, 265, 214, 163, 240, 125, 202];
const between = (min, max) => min + Math.random() * (max - min);

export class Room {
  peers = new Map();
  players = new Map();
  timer;
  lastStep = 0;
  lastSnapshot = 0;

  accept(socket) {
    if (this.peers.size >= LIMIT + 20) {
      socket.close(4003, "busy");
      return;
    }
    const now = Date.now();
    this.peers.set(socket, { joined: now, lastSeen: now, window: now, messages: 0 });
    if (!this.timer) {
      this.lastStep = now;
      this.timer = setInterval(() => this.tick(), PULSE);
    }
  }

  receive(socket, raw) {
    const peer = this.peers.get(socket);
    if (!peer) return;
    const now = Date.now();
    if (now - peer.window >= 1_000) {
      peer.window = now;
      peer.messages = 0;
    }
    if (++peer.messages > 30) return this.close(socket, 1008, "rate");
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return this.close(socket, 1009, "size");
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return this.close(socket, 1008, "invalid");
    }
    if (!message || typeof message !== "object") return this.close(socket, 1008, "invalid");
    if (!peer.player) {
      if (message.t !== "join") return this.close(socket, 1008, "join required");
      this.join(socket, peer, message, now);
      return;
    }
    peer.lastSeen = now;
    if (message.t === "ping") {
      this.send(socket, { t: "pong" });
    } else if (message.t === "auto-move" && typeof message.enabled === "boolean") {
      setAutoMove(peer.player, message.enabled, now);
    } else if (message.t === "input" && Number.isInteger(message.keys) && message.keys >= 0 && message.keys <= 7) {
      const player = peer.player;
      if (message.keys & KEY.jump && !(player.keys & KEY.jump)) player.jumpQueued = true;
      player.keys = message.keys;
      player.inputUntil = now + INPUT_LEASE;
      // An idle player can resume automatic movement on the next tick.
      if (!player.keys) player.nextAction = now;
    }
  }

  join(socket, peer, message, now) {
    const name = nickname(message.name);
    const custom = message.character === "custom";
    const character = message.character;
    if (typeof message.token !== "string" || !/^[a-f0-9]{32}$/.test(message.token) || !name ||
        (custom ? !validSprite(message.sprite) : !builtinCharacter(character))) {
      return this.close(socket, 4004, "profile");
    }
    let player = this.players.get(message.token);
    const oldSocket = player?.socket;
    const active = this.active();
    if (!oldSocket && active.length >= LIMIT) return this.close(socket, 4003, "full");
    if (!player && this.players.size >= 120) {
      const inactive = Array.from(this.players).find(([, member]) => !member.socket);
      if (inactive) this.players.delete(inactive[0]);
    }
    const used = new Set(active.filter((other) => other !== player).map((other) => other.slot));
    const slot = player && !used.has(player.slot)
      ? player.slot
      : Array.from({ length: LIMIT }, (_, index) => index).find((index) => !used.has(index));
    player ??= {
      slot, x: SPAWN[slot % SPAWN.length] + between(-9, 9), y: FLOOR, vy: 0,
      facing: slot % 2 ? -1 : 1, pose: POSE.idle, nextAction: now + between(250, 950),
      autoMove: message.autoMove !== false,
    };
    const sprite = custom ? { frames: message.sprite.frames, pixels: message.sprite.pixels } : undefined;
    const announce = !oldSocket || player.name !== name || player.character !== character || player.sprite?.pixels !== sprite?.pixels;
    Object.assign(player, { slot, name, character, sprite, socket, keys: 0, inputUntil: 0, jumpQueued: false });
    setAutoMove(player, message.autoMove !== false, now);
    this.players.set(message.token, player);
    peer.player = player;
    if (oldSocket) this.close(oldSocket, 4001, "replaced");

    this.send(socket, { t: "welcome", slot });
    for (const member of this.active()) this.send(socket, this.profile(member));
    if (announce) this.broadcast(this.profile(player), socket);
    this.snapshot();
  }

  profile({ slot, name, character, sprite }) {
    return { t: "player", slot, name, character, sprite };
  }

  active() {
    return Array.from(this.players.values()).filter((player) => player.socket);
  }

  send(socket, message) {
    try {
      socket.send(typeof message === "string" || message instanceof Uint8Array ? message : JSON.stringify(message));
    } catch {
      this.close(socket, 1011, "send failed");
    }
  }

  broadcast(message, except) {
    const payload = typeof message === "object" && !(message instanceof Uint8Array) ? JSON.stringify(message) : message;
    for (const [socket, peer] of this.peers) {
      if (socket !== except && peer.player) this.send(socket, payload);
    }
  }

  snapshot() {
    this.broadcast(encodeSnapshot(this.active()));
    this.lastSnapshot = Date.now();
  }

  close(socket, code, reason) {
    this.disconnect(socket);
    try { socket.close(code, reason); } catch {}
  }

  disconnect(socket) {
    const peer = this.peers.get(socket);
    if (!peer) return;
    this.peers.delete(socket);
    if (peer.player?.socket === socket) {
      const player = peer.player;
      player.socket = undefined;
      player.keys = 0;
      player.jumpQueued = false;
      player.disconnectedAt = Date.now();
      this.broadcast({ t: "left", slot: player.slot });
    }
  }

  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastStep) / 1000, 0.09);
    this.lastStep = now;
    for (const [socket, peer] of this.peers) {
      if (now - peer.lastSeen > (peer.player ? EXPIRE : 5_000)) this.close(socket, 4000, "timeout");
    }
    for (const [token, player] of this.players) {
      if (!player.socket && now - player.disconnectedAt > GRACE) this.players.delete(token);
    }
    const players = this.active();
    for (const player of players) movePlayer(player, players, now, dt);
    if (players.length && now - this.lastSnapshot >= 95) this.snapshot();
    if (!this.peers.size && !this.players.size) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
