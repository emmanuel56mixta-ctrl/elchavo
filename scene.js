const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle");
const gameOverPanel = document.getElementById("game-over");
const finalScore = document.getElementById("final-score");

const VIEW = { width: 960, height: 540, groundY: 422 };
const OUTLINE = "#183653";
const CHUNK_WIDTH = 420;
const PLAYER_X = 218;
const keys = new Set();
const images = {
  panorama: loadImage("assets/guadalajara-panorama.png"),
  clouds: loadImage("assets/gdl-clouds.png"),
  rubin: loadImage("assets/rubin-player.png")
};
const PANORAMA_STEP = 870;
const PANORAMA_TILE_WIDTH = 1120;
let panoramaTile;
let cloudTile;

const state = {
  cameraX: 0, speed: 150, autoRun: true, paused: false, muted: false,
  facing: 1, frameClock: 0, score: 0, cells: 0, highScore: readHighScore(),
  collected: new Set(), gameOver: false,
  player: { feetY: VIEW.groundY, velocityY: 0, crouching: false, invincible: 0 }
};
let audioContext;

function loadImage(src) { const image = new Image(); image.src = src; return image; }
function readHighScore() { try { return Number(localStorage.getItem("rubin-gdl-max") || 0); } catch { return 0; } }
function saveHighScore() { try { localStorage.setItem("rubin-gdl-max", String(state.highScore)); } catch { /* storage may be unavailable */ } }
function randomAt(value) { const number = Math.sin(value * 12.9898 + 78.233) * 43758.5453123; return number - Math.floor(number); }

function sound(frequency, endFrequency, duration, type = "square", volume = 0.045, delay = 0) {
  if (state.muted) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start); oscillator.stop(start + duration + 0.02);
}
function sfxJump() { sound(320, 690, 0.15, "square", 0.045); }
function sfxCell() { sound(610, 1020, 0.1, "triangle", 0.04); sound(880, 1450, 0.1, "triangle", 0.03, 0.07); }
function sfxHit() { sound(180, 42, 0.28, "sawtooth", 0.06); }
function sfxPause() { sound(state.paused ? 250 : 520, state.paused ? 180 : 720, 0.08, "square", 0.03); }

function loopTiles(width, parallax, draw) {
  const scroll = state.cameraX * parallax;
  const start = Math.floor(scroll / width) - 2;
  const end = Math.ceil((scroll + VIEW.width) / width) + 2;
  for (let index = start; index <= end; index += 1) draw(index * width - scroll, index);
}
function roundedRect(x, y, width, height, radius, fill, stroke = OUTLINE, lineWidth = 3) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function circle(x, y, radius, fill, stroke = OUTLINE, lineWidth = 3) {
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// Layer 1: blue tapatío sky.
function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, "#57b8ef"); sky.addColorStop(0.62, "#b9e8fa"); sky.addColorStop(1, "#f7dfae");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function makeFeatheredTile(image, kind) {
  if (!image.complete || image.naturalWidth === 0) return null;
  const tile = document.createElement("canvas");
  tile.width = PANORAMA_TILE_WIDTH;
  tile.height = kind === "cloud" ? 300 : VIEW.groundY;
  const tileCtx = tile.getContext("2d");
  if (kind === "cloud") {
    tileCtx.drawImage(image, -50, -78, 1220, 687);
  } else {
    tileCtx.drawImage(image, 10, -20, 1100, 619);
  }
  tileCtx.globalCompositeOperation = "destination-in";
  const fade = tileCtx.createLinearGradient(0, 0, tile.width, 0);
  fade.addColorStop(0, "rgba(0, 0, 0, 0)");
  // The fully opaque span and fade widths match the 250px tile overlap.
  fade.addColorStop(0.223, "rgba(0, 0, 0, 1)");
  fade.addColorStop(0.777, "rgba(0, 0, 0, 1)");
  fade.addColorStop(1, "rgba(0, 0, 0, 0)");
  tileCtx.fillStyle = fade;
  tileCtx.fillRect(0, 0, tile.width, tile.height);
  return tile;
}

// Layer 2: soft cloud PNGs, feathered so their scroll never reveals a seam.
function drawCloudLayer() {
  cloudTile ||= makeFeatheredTile(images.clouds, "cloud");
  if (!cloudTile) return;
  loopTiles(PANORAMA_STEP, 0.055, (x) => ctx.drawImage(cloudTile, x - 125, 0));
}

// Layer 2: far hills and city blocks.
function drawDistantCity() {
  ctx.fillStyle = "rgba(81, 132, 142, 0.28)";
  ctx.beginPath(); ctx.moveTo(0, 302);
  for (let x = 0; x <= VIEW.width; x += 80) ctx.lineTo(x, 280 + Math.sin((x + state.cameraX * 0.04) * 0.014) * 20);
  ctx.lineTo(VIEW.width, VIEW.groundY); ctx.lineTo(0, VIEW.groundY); ctx.closePath(); ctx.fill();
  loopTiles(116, 0.1, (x, index) => {
    const width = 44 + randomAt(index + 90) * 52;
    const height = 42 + randomAt(index + 91) * 92;
    const top = VIEW.groundY - 74 - height;
    const warm = randomAt(index + 92) > 0.48;
    roundedRect(x + 12, top, width, height, 8, warm ? "#d9b280" : "#79b9cf", warm ? "#c7935d" : "#4c97b4", 2);
    ctx.fillStyle = warm ? "#fff0bd" : "#d9f6ff";
    for (let row = 0; row < 3; row += 1) { ctx.fillRect(x + 22, top + 22 + row * 23, 8, 12); ctx.fillRect(x + width - 1, top + 22 + row * 23, 8, 12); }
  });
}

// Layer 4: generated Guadalajara panorama with the Cathedral, Hospicio Cabañas,
// La Minerva and Arcos del Milenio in Rubín's friendly 3D visual world.
function drawLandmarks() {
  panoramaTile ||= makeFeatheredTile(images.panorama, "city");
  if (!panoramaTile) return;
  loopTiles(PANORAMA_STEP, 0.18, (x) => ctx.drawImage(panoramaTile, x - 125, 0));
}

// Layer 5: tiled paseo repeated forever.
function drawGround() {
  const surface = VIEW.groundY;
  ctx.fillStyle = "#b96f43"; ctx.fillRect(0, surface, VIEW.width, VIEW.height - surface);
  ctx.fillStyle = "#f6d28b"; ctx.fillRect(0, surface, VIEW.width, 26);
  ctx.fillStyle = "#f9e5b4"; ctx.fillRect(0, surface - 8, VIEW.width, 17);
  loopTiles(96, 1, (x, index) => {
    ctx.fillStyle = index % 2 === 0 ? "#e8b878" : "#dca664"; ctx.fillRect(x, surface + 28, 94, VIEW.height - surface - 28);
    ctx.strokeStyle = "rgba(111, 68, 42, 0.28)"; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x, surface + 28); ctx.lineTo(x, VIEW.height); ctx.moveTo(x, surface + 76); ctx.lineTo(x + 96, surface + 76); ctx.stroke();
  });
  ctx.fillStyle = "#2c6b69"; ctx.fillRect(0, surface - 6, VIEW.width, 8);
}

function getChunkItems(chunk) {
  const obstacleChance = randomAt(chunk + 501);
  let obstacle = null;
  if (chunk >= 2 && obstacleChance >= 0.3) {
    const kind = Math.floor(randomAt(chunk + 503) * 3);
    const x = chunk * CHUNK_WIDTH + 112 + randomAt(chunk + 502) * 184;
    if (kind === 0) obstacle = { kind: "planter", x, width: 76, height: 53, solid: true };
    if (kind === 1) obstacle = { kind: "case", x, width: 58, height: 58, solid: true };
    if (kind === 2) obstacle = { kind: "marker", x, width: 40, height: 72, solid: false };
  }
  const cells = [];
  if (randomAt(chunk + 610) > 0.27) {
    const amount = 2 + Math.floor(randomAt(chunk + 611) * 3);
    const baseX = chunk * CHUNK_WIDTH + 54 + randomAt(chunk + 612) * 130;
    for (let index = 0; index < amount; index += 1) cells.push({ id: `${chunk}:${index}`, x: baseX + index * 36, y: VIEW.groundY - 73 - (index % 2) * 18 });
  }
  return { obstacle, cells };
}
function visibleChunks(draw) {
  const start = Math.floor(state.cameraX / CHUNK_WIDTH) - 1;
  const end = Math.ceil((state.cameraX + VIEW.width) / CHUNK_WIDTH) + 1;
  for (let chunk = start; chunk <= end; chunk += 1) draw(chunk, getChunkItems(chunk));
}
function drawObjects() {
  visibleChunks((chunk, items) => {
    if (items.obstacle) drawObstacle(items.obstacle, items.obstacle.x - state.cameraX);
    for (const cell of items.cells) if (!state.collected.has(cell.id)) drawEnergyCell(cell.x - state.cameraX, cell.y);
  });
}
function drawEnergyCell(x, y) {
  const glow = 0.82 + Math.sin(state.frameClock * 7 + x * 0.035) * 0.18;
  ctx.save(); ctx.globalAlpha = 0.2 * glow; circle(x, y, 22, "#fff37a", null); ctx.globalAlpha = 1;
  ctx.translate(x, y); ctx.scale(0.82 + Math.abs(Math.sin(state.frameClock * 6 + x * 0.03)) * 0.18, 1);
  circle(0, -3, 11, "#fff18a", "#c78923", 2); roundedRect(-7, 7, 14, 8, 3, "#b9becb", "#506078", 2);
  ctx.fillStyle = "#fffdf3"; ctx.fillRect(-3, -9, 5, 8); ctx.restore();
}
function drawObstacle(obstacle, x) {
  if (obstacle.kind === "planter") return drawAgavePlanter(x, VIEW.groundY - 6);
  if (obstacle.kind === "case") return drawMariachiCase(x, VIEW.groundY - 7);
  drawLandmarkMarker(x, VIEW.groundY - 6);
}
function drawAgavePlanter(x, y) {
  const gradient = ctx.createLinearGradient(x, y - 46, x, y); gradient.addColorStop(0, "#4f9fc0"); gradient.addColorStop(1, "#1d5d90");
  roundedRect(x + 4, y - 39, 68, 39, 13, gradient, OUTLINE, 3); ctx.fillStyle = "#70462d"; ctx.fillRect(x + 13, y - 39, 51, 9);
  for (let leaf = 0; leaf < 6; leaf += 1) {
    const originX = x + 39; const endX = originX + (leaf - 2.5) * 9; const endY = y - 65 + Math.abs(leaf - 2.5) * 6;
    ctx.strokeStyle = leaf % 2 ? "#4c8c75" : "#66aa83"; ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(originX, y - 37); ctx.lineTo(endX, endY); ctx.stroke();
  }
  ctx.lineCap = "butt";
}
function drawMariachiCase(x, y) {
  roundedRect(x + 3, y - 52, 52, 52, 16, "#2d4167", OUTLINE, 4); roundedRect(x + 11, y - 43, 36, 8, 4, "#536b94", null);
  circle(x + 29, y - 21, 7, "#f3c84e", "#8a6420", 2); ctx.fillStyle = "#c9973c"; ctx.fillRect(x + 23, y - 50, 12, 5);
}
function drawLandmarkMarker(x, y) {
  ctx.strokeStyle = "#2c4358"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y - 72); ctx.stroke();
  roundedRect(x - 6, y - 72, 72, 31, 8, "#f3c64d", OUTLINE, 3); ctx.fillStyle = OUTLINE; ctx.font = "800 13px system-ui"; ctx.fillText("GDL", x + 10, y - 51);
}

function drawPlayer() {
  if (!images.rubin.complete || images.rubin.naturalWidth === 0) return;
  const airborne = state.player.feetY < VIEW.groundY - 0.5;
  const moving = Math.abs(state.speed) > 18 && !airborne && !state.player.crouching;
  const height = state.player.crouching ? 140 : 177;
  const width = state.player.crouching ? 112 : 142;
  const bob = airborne ? 0 : moving ? Math.sin(state.frameClock * 15) * 3 : Math.sin(state.frameClock * 2.2) * 1.4;
  const angle = state.gameOver ? 0.35 : airborne ? -state.player.velocityY * 0.00042 : moving ? Math.sin(state.frameClock * 15) * 0.035 : 0;
  ctx.save(); ctx.translate(PLAYER_X + width / 2, state.player.feetY + bob);
  if (state.facing < 0) ctx.scale(-1, 1); ctx.rotate(angle); ctx.globalAlpha = state.gameOver ? 0.74 : 1;
  ctx.drawImage(images.rubin, -width / 2, -height, width, height); ctx.restore();
}
function drawHud() {
  roundedRect(16, 16, 254, 65, 16, "rgba(255, 253, 240, 0.94)", "#225a93", 3);
  ctx.fillStyle = OUTLINE; ctx.font = "800 13px system-ui"; ctx.fillText("RUBÍN · GUADALAJARA", 34, 39);
  ctx.font = "800 27px system-ui"; ctx.fillText(String(state.score).padStart(5, "0"), 32, 67);
  ctx.fillStyle = "#a96a17"; ctx.font = "800 15px system-ui"; ctx.fillText(`⚡ ${state.cells}`, 181, 65);
  roundedRect(724, 16, 220, 39, 13, "rgba(255, 253, 240, 0.94)", "#225a93", 3);
  ctx.fillStyle = OUTLINE; ctx.font = "800 13px system-ui";
  ctx.fillText(state.paused ? "PAUSA" : state.muted ? "SIN SONIDO" : "TAB: PAUSA", 746, 42);
}

function collectCells() {
  const playerWorldX = state.cameraX + PLAYER_X + 66;
  const start = Math.floor(playerWorldX / CHUNK_WIDTH) - 1;
  for (let chunk = start; chunk <= start + 2; chunk += 1) {
    for (const cell of getChunkItems(chunk).cells) {
      if (!state.collected.has(cell.id) && Math.abs(cell.x - playerWorldX) < 32 && state.player.feetY < cell.y + 96) {
        state.collected.add(cell.id); state.cells += 1; sfxCell();
      }
    }
  }
  const oldestVisibleChunk = Math.floor(state.cameraX / CHUNK_WIDTH) - 3;
  for (const id of state.collected) if (Number(id.split(":")[0]) < oldestVisibleChunk) state.collected.delete(id);
}
function checkCollision() {
  if (state.cameraX < CHUNK_WIDTH || state.player.invincible > 0 || state.player.feetY < VIEW.groundY - 0.5) return;
  const player = {
    left: state.cameraX + PLAYER_X + 35, right: state.cameraX + PLAYER_X + 98,
    top: state.player.feetY - (state.player.crouching ? 89 : 126), bottom: state.player.feetY - 10
  };
  const chunk = Math.floor((player.left + player.right) / 2 / CHUNK_WIDTH);
  for (let index = chunk - 1; index <= chunk + 1; index += 1) {
    const obstacle = getChunkItems(index).obstacle;
    if (!obstacle?.solid) continue;
    const inset = obstacle.kind === "planter" ? 13 : 7;
    const obstacleBox = { left: obstacle.x + inset, right: obstacle.x + obstacle.width - inset, top: VIEW.groundY - obstacle.height + 7, bottom: VIEW.groundY - 8 };
    const overlaps = player.left < obstacleBox.right && player.right > obstacleBox.left && player.top < obstacleBox.bottom && player.bottom > obstacleBox.top;
    if (overlaps) return endGame();
  }
}
function endGame() {
  if (state.gameOver) return;
  state.gameOver = true; state.autoRun = false; state.speed = 0;
  state.highScore = Math.max(state.highScore, state.score); saveHighScore();
  finalScore.textContent = `Puntos: ${state.score} · Mejor: ${state.highScore}`; gameOverPanel.hidden = false; sfxHit();
}
function update(delta) {
  if (state.paused || state.gameOver) return;
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const left = keys.has("ArrowLeft") || keys.has("KeyA");
  const direction = right ? 1 : left ? -1 : state.autoRun ? 1 : 0;
  const targetSpeed = direction * (keys.has("ShiftLeft") ? 310 : 170);
  state.speed += (targetSpeed - state.speed) * Math.min(1, delta * 8);
  state.cameraX = Math.max(0, state.cameraX + state.speed * delta);
  if (direction !== 0) state.facing = direction;
  state.player.crouching = (keys.has("ArrowDown") || keys.has("KeyS")) && state.player.feetY >= VIEW.groundY - 0.5;
  state.player.velocityY += 1250 * delta; state.player.feetY += state.player.velocityY * delta;
  state.player.invincible = Math.max(0, state.player.invincible - delta);
  if (state.player.feetY > VIEW.groundY) { state.player.feetY = VIEW.groundY; state.player.velocityY = 0; }
  state.frameClock += delta; collectCells(); checkCollision();
  state.score = Math.max(state.score, Math.floor(state.cameraX / 4) + state.cells * 100);
}
function render() { drawSky(); drawCloudLayer(); drawDistantCity(); drawLandmarks(); drawGround(); drawObjects(); drawPlayer(); drawHud(); }
function jump() {
  if (!state.paused && !state.gameOver && state.player.feetY >= VIEW.groundY - 0.5) {
    state.player.velocityY = -560; state.player.invincible = 1.25; state.player.crouching = false; sfxJump();
  }
}
function togglePause() {
  if (state.gameOver) return;
  state.paused = !state.paused; toggleButton.textContent = state.paused ? "Reanudar" : "Pausar";
  toggleButton.setAttribute("aria-pressed", String(state.paused)); sfxPause();
}
function restart() {
  state.cameraX = 0; state.speed = 150; state.autoRun = true; state.paused = false; state.facing = 1; state.frameClock = 0;
  state.score = 0; state.cells = 0; state.collected.clear(); state.gameOver = false;
  state.player = { feetY: VIEW.groundY, velocityY: 0, crouching: false, invincible: 0 };
  gameOverPanel.hidden = true; toggleButton.textContent = "Pausar"; toggleButton.setAttribute("aria-pressed", "false"); canvas.focus();
}

let previous = performance.now();
function tick(now) { const delta = Math.min((now - previous) / 1000, 0.05); previous = now; update(delta); render(); requestAnimationFrame(tick); }
window.addEventListener("keydown", (event) => {
  const controlled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab", "KeyM", "KeyR"];
  if (controlled.includes(event.code)) event.preventDefault();
  if (event.code === "Tab" && !event.repeat) return togglePause();
  if (event.code === "KeyM" && !event.repeat) { state.muted = !state.muted; if (!state.muted) sound(520, 760, 0.08, "triangle", 0.03); return; }
  if (event.code === "KeyR" && !event.repeat && state.gameOver) return restart();
  keys.add(event.code); if ((event.code === "Space" || event.code === "ArrowUp") && !event.repeat) jump();
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  button.addEventListener("pointerdown", (event) => { event.preventDefault(); canvas.focus(); keys.add(code); if (code === "ArrowUp") jump(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => button.addEventListener(type, () => keys.delete(code)));
});
toggleButton.addEventListener("click", togglePause);
document.getElementById("restart").addEventListener("click", restart);
canvas.addEventListener("pointerdown", () => canvas.focus());
requestAnimationFrame(tick);
