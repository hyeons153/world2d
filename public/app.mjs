import { characters, drawCharacter, readPng } from "./characters.mjs";
import { Connection, roomAvailable } from "./connection.mjs";
import { advancePlayer, movementDirection, WALK_SPEED } from "./movement.mjs";
import { decodeSnapshot, FLOOR, HEIGHT, KEY, nickname, POSE, validSprite, WIDTH } from "./protocol.mjs";
import { drawScene, previewPlayers } from "./scene.mjs";

const $ = (id) => document.getElementById(id);
const scene = $("scene");
const form = $("entry");
const pipButton = $("pip");
const savedKey = "pixel-clearing.profile.v1";
const identityKey = "pixel-clearing.identity.v1";
const supportsTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
const supportsPip = typeof window.documentPictureInPicture?.requestWindow === "function";
const roomUnavailable = "실시간 공터 서버가 아직 연결되지 않았어요.";

let saved;
try { saved = JSON.parse(localStorage.getItem(savedKey)); } catch {}
$("nickname").value = nickname(saved?.name);
let sprite = validSprite(saved?.sprite) ? saved.sprite : undefined;
let selected = Object.hasOwn(characters, saved?.character) || (sprite && saved?.character === "custom") ? saved.character : "sprout";
let currentFile;
let reading = 0;
let loadingImage = false;
let starting = false;
let fallbackIdentity;
let playing = false;
let localPlayer;
let ownSlot = -1;
let connection;
let state;
let pipWindow;
let pipCanvas;
let stopPipKeys;
let lastPaint = 0;
let scheduled;
const players = new Map();

function message(id, value) {
  const target = $(id);
  target.textContent = value;
  target.hidden = !value;
}

const profileButtons = new Map();
function renderCharacters() {
  const entries = Object.entries(characters);
  if (sprite) entries.push(["custom", { name: "내 PNG" }]);
  for (const [id, details] of entries) {
    let button = profileButtons.get(id);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "character";
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      canvas.setAttribute("aria-hidden", "true");
      button.append(canvas, document.createTextNode(details.name));
      $("characters").append(button);
      profileButtons.set(id, button);
      button.addEventListener("click", () => {
        selected = id;
        selectCharacter();
      });
    }
    const ctx = button.firstChild.getContext("2d");
    ctx.clearRect(0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;
    drawCharacter(ctx, id, sprite, 16, 31, POSE.idle, 1, 0);
  }
  selectCharacter();
}

function selectCharacter() {
  for (const [id, button] of profileButtons) button.setAttribute("aria-pressed", String(id === selected));
}

function joinButton() {
  const busy = loadingImage || starting;
  $("join").disabled = busy;
  $("join").setAttribute("aria-busy", String(busy));
}

async function loadFile() {
  if (!currentFile) return;
  const turn = ++reading;
  loadingImage = true;
  joinButton();
  message("entry-message", "");
  try {
    const image = await readPng(currentFile, $("sprite-sheet").checked ? 4 : 1);
    if (turn !== reading) return;
    sprite = image;
    selected = "custom";
    renderCharacters();
    persist(nickname($("nickname").value));
  } catch (error) {
    if (turn === reading) message("entry-message", error.message || "이미지를 열 수 없어요.");
  } finally {
    if (turn === reading) {
      loadingImage = false;
      joinButton();
    }
  }
}

$("choose-file").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", () => {
  if (!$("file").files[0]) return;
  currentFile = $("file").files[0];
  $("file").value = "";
  void loadFile();
});
$("sprite-sheet").checked = sprite?.frames === 4;
$("sprite-sheet").addEventListener("change", loadFile);
renderCharacters();
joinButton();

function persist(name) {
  try {
    localStorage.setItem(savedKey, JSON.stringify({ name, character: selected, sprite }));
  } catch {}
}

function browserIdentity() {
  function getOrCreate() {
    try {
      const token = localStorage.getItem(identityKey);
      if (/^[a-f0-9]{32}$/.test(token ?? "")) return token;
    } catch {}
    fallbackIdentity ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(identityKey, fallbackIdentity); } catch {}
    return fallbackIdentity;
  }
  return navigator.locks ? navigator.locks.request(identityKey, getOrCreate) : getOrCreate();
}

function setPlaying(next) {
  playing = next;
  document.body.toggleAttribute("data-playing", next);
  form.hidden = next;
  $("touch").hidden = !next || !supportsTouch;
  pipButton.hidden = !next || !supportsPip;
  if (next) {
    window.scrollTo(0, 0);
  } else {
    localPlayer = undefined;
    ownSlot = -1;
    state = undefined;
    message("connection-message", "");
    message("play-message", "");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loadingImage || starting || playing) return;
  const name = nickname($("nickname").value);
  if (!name) {
    message("entry-message", "닉네임을 입력해 주세요.");
    $("nickname").focus();
    return;
  }
  starting = true;
  joinButton();
  try {
    persist(name);
    $("nickname").value = name;
    message("entry-message", "");
    message("play-message", "");
    const profile = { name, character: selected, sprite: selected === "custom" ? sprite : undefined };
    localPlayer = { ...profile, slot: -1, x: WIDTH / 2, y: FLOOR, vy: 0, facing: 1, pose: POSE.idle };
    setPlaying(true);
    showConnection(roomAvailable ? "connecting" : "offline");
    if (!roomAvailable) return;

    const token = await browserIdentity();
    connection = new Connection({ token, ...profile }, {
      state: showConnection,
      welcome(slot) {
        ownSlot = slot;
        localPlayer.slot = slot;
        localPlayer.jumpQueued = false;
        players.clear();
        if (sent) connection.input(sent);
      },
      roster(entry) {
        if (entry.t === "left") players.delete(entry.slot);
        else players.set(entry.slot, { ...players.get(entry.slot), ...entry });
      },
      snapshot(buffer) {
        const now = performance.now();
        for (const sample of decodeSnapshot(buffer)) {
          const player = players.get(sample.slot);
          if (!player) continue;
          player.from = player.point ? interpolate(player, now) : sample;
          player.point = sample;
          player.at = now;
        }
        if (pipWindow && now - lastPaint > 100) paint();
      },
      ended(code) {
        resetInput();
        pipWindow?.close();
        players.clear();
        setPlaying(false);
        const errors = {
          0: roomUnavailable,
          4001: "이 브라우저의 다른 탭에서 입장했어요.",
          4003: "공터가 가득 찼거나 연결이 몰렸어요. 잠시 후 다시 들어와 주세요.",
          4004: "닉네임이나 캐릭터를 확인한 뒤 다시 입장해 주세요.",
        };
        message("entry-message", errors[code] ?? "연결할 수 없었어요. 다시 입장해 주세요.");
      },
    });
    connection.start();
  } catch {
    resetInput();
    connection?.stop();
    pipWindow?.close();
    setPlaying(false);
    message("entry-message", "입장을 시작할 수 없어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    starting = false;
    joinButton();
  }
});

function showConnection(next) {
  if (state === "online" && next !== "online") {
    const player = players.get(ownSlot);
    if (player?.point) Object.assign(localPlayer, player.point, interpolate(player, performance.now()), { vy: 0 });
    players.clear();
    resetInput();
  }
  state = next;
  const notices = { retrying: "공용 공터에 다시 연결 중", offline: roomUnavailable };
  message("connection-message", notices[state] ?? "");
}

function interpolate(player, now) {
  const t = Math.max(0, Math.min(1, (now - player.at) / 105));
  return {
    x: player.from.x + (player.point.x - player.from.x) * t,
    y: player.from.y + (player.point.y - player.from.y) * t,
  };
}

function paint() {
  const now = performance.now();
  const dt = Math.min((now - lastPaint) / 1000, 0.09);
  lastPaint = now;
  let visible;
  if (playing) {
    visible = [];
    for (const player of players.values()) {
      if (player.point) visible.push({ ...player, ...player.point, ...interpolate(player, now) });
    }
    if (!players.get(ownSlot)?.point) {
      const direction = movementDirection(sent);
      advancePlayer(localPlayer, {
        direction, speed: WALK_SPEED, jump: localPlayer.jumpQueued, pose: direction ? POSE.walk : POSE.idle,
      }, dt);
      localPlayer.jumpQueued = false;
      visible.push(localPlayer);
    }
  } else {
    visible = previewPlayers(now);
  }
  if (!document.hidden || !pipCanvas) drawScene(scene, visible, now, playing ? ownSlot : -1);
  if (pipCanvas) drawScene(pipCanvas, visible, now, ownSlot);
}

function queuePaint() {
  const host = pipWindow && !pipWindow.closed ? pipWindow : window;
  scheduled = { host, handle: host.requestAnimationFrame(() => { paint(); queuePaint(); }) };
}

function movePaint() {
  if (scheduled) scheduled.host.cancelAnimationFrame(scheduled.handle);
  paint();
  queuePaint();
}
movePaint();

const controls = {
  ArrowLeft: KEY.left, KeyA: KEY.left, ArrowUp: KEY.jump, KeyW: KEY.jump,
  ArrowRight: KEY.right, KeyD: KEY.right, Space: KEY.jump,
};
const pressed = new Map();
const touches = new Map();
let sent = 0;

function submitInput() {
  let mask = 0;
  for (const key of pressed.values()) mask |= key;
  for (const touch of touches.values()) mask |= touch.key;
  if (mask === sent) return;
  if (localPlayer && !players.get(ownSlot)?.point && (mask & KEY.jump) && !(sent & KEY.jump)) {
    localPlayer.jumpQueued = true;
  }
  sent = mask;
  connection?.input(mask);
}

function resetInput() {
  if (localPlayer) localPlayer.jumpQueued = false;
  pressed.clear();
  for (const { button } of touches.values()) delete button.dataset.held;
  touches.clear();
  submitInput();
}

function bindKeys(host) {
  function onKey(event) {
    const key = controls[event.code];
    const target = event.target;
    if (!playing || !key || (pipWindow ? host !== pipWindow : host !== window)) return;
    if (event.type === "keyup" && pressed.delete(event.code)) {
      event.preventDefault();
      submitInput();
      return;
    }
    if (target?.matches?.("input, textarea, [contenteditable], select") ||
        (target?.matches?.("button, a") && event.code === "Space")) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (event.type === "keydown" && !event.repeat) pressed.set(event.code, key);
    submitInput();
  }
  host.addEventListener("keydown", onKey);
  host.addEventListener("keyup", onKey);
  host.addEventListener("blur", resetInput);
  return () => {
    host.removeEventListener("keydown", onKey);
    host.removeEventListener("keyup", onKey);
    host.removeEventListener("blur", resetInput);
  };
}
bindKeys(window);
setInterval(() => { if (sent) connection?.input(sent); }, 900);
document.addEventListener("visibilitychange", () => { if (document.hidden) resetInput(); });
window.addEventListener("pagehide", () => { resetInput(); connection?.stop(); });
window.addEventListener("pageshow", (event) => { if (event.persisted && playing) connection?.start(); });

for (const button of document.querySelectorAll("#touch button")) {
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("pointerdown", (event) => {
    if (!playing || pipWindow || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.dataset.held = "";
    touches.set(event.pointerId, { key: Number(button.dataset.key), button });
    submitInput();
  });
  const release = (event) => {
    touches.delete(event.pointerId);
    if (![...touches.values()].some((entry) => entry.button === button)) delete button.dataset.held;
    submitInput();
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, release);
}

function updatePipButton() {
  const label = pipWindow ? "PiP 닫기" : "PiP 켜기";
  pipButton.setAttribute("aria-label", label);
  pipButton.title = label;
}

pipButton.addEventListener("click", async () => {
  if (pipWindow && !pipWindow.closed) {
    pipWindow.close();
    return;
  }
  if (!supportsPip || !playing) return;
  resetInput();
  pipButton.disabled = true;
  try {
    const host = await window.documentPictureInPicture.requestWindow({ width: 400, height: 225 });
    pipWindow = host;
    host.addEventListener("pagehide", () => {
      resetInput();
      stopPipKeys?.();
      pipWindow = undefined;
      pipCanvas = undefined;
      updatePipButton();
      movePaint();
    }, { once: true });
    if (!playing) {
      host.close();
      return;
    }
    host.document.title = "픽셀 공터";
    const style = host.document.createElement("link");
    style.rel = "stylesheet";
    style.href = new URL("./pip.css", location.href).href;
    host.document.head.append(style);
    pipCanvas = host.document.createElement("canvas");
    pipCanvas.width = WIDTH;
    pipCanvas.height = HEIGHT;
    pipCanvas.setAttribute("aria-label", "픽셀 공터");
    host.document.body.append(pipCanvas);
    stopPipKeys = bindKeys(host);
    updatePipButton();
    message("play-message", "");
    movePaint();
  } catch {
    pipWindow?.close();
    message("play-message", "PiP를 열 수 없어요. 브라우저 설정을 확인한 뒤 다시 시도해 주세요.");
  } finally {
    pipButton.disabled = false;
  }
});
