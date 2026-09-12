const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggle");
const gameOverPanel = document.getElementById("game-over");
const finalScore = document.getElementById("final-score");

const VIEW = { width: 960, height: 540, groundY: 398 };
const OUTLINE = "#15374b";
const CHUNK_WIDTH = 420;
const PLAYER_X = 220;
const keys = new Set();
const images = {
  walk: loadImage("assets/player-walk-right.png"),
  idle: loadImage("assets/player-idle-right.png"),
  jump: loadImage("assets/player-jump-right.png"),
  crouch: loadImage("assets/player-crouch-right.png"),
  hurt: loadImage("assets/player-hurt-right.png")
};

const state = {
  cameraX: 0,
  speed: 150,
  autoRun: true,
  paused: false,
  muted: false,
  facing: 1,
  frameClock: 0,
  score: 0,
  coins: 0,
  highScore: readHighScore(),
  collected: new Set(),
  gameOver: false,
  player: { feetY: VIEW.groundY, velocityY: 0, crouching: false, invincible: 0 }
};

let audioContext;

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function readHighScore() {
  try { return Number(localStorage.getItem("ruta-infinita-max") || 0); } catch { return 0; }
}

function saveHighScore() {
  try { localStorage.setItem("ruta-infinita-max", String(state.highScore)); } catch { /* storage may be unavailable */ }
}

function randomAt(value) {
  const number = Math.sin(value * 12.9898 + 78.233) * 43758.5453123;
  return number - Math.floor(number);
}

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
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function sfxJump() { sound(420, 740, 0.12, "square", 0.045); }
function sfxCoin() { sound(740, 1100, 0.09, "triangle", 0.04); sound(990, 1450, 0.09, "triangle", 0.032, 0.07); }
function sfxHit() { sound(170, 45, 0.26, "sawtooth", 0.06); }
function sfxPause() { sound(state.paused ? 250 : 520, state.paused ? 180 : 720, 0.08, "square", 0.03); }

function loopTiles(width, parallax, draw) {
  const scroll = state.cameraX * parallax;
  const start = Math.floor(scroll / width) - 2;
  const end = Math.ceil((scroll + VIEW.width) / width) + 2;
  for (let index = start; index <= end; index += 1) draw(index * width - scroll, index);
}

function roundedRect(x, y, width, height, radius, fill, stroke = OUTLINE, lineWidth = 3) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function circle(x, y, radius, fill, stroke = OUTLINE, lineWidth = 3) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// Layer 1: sky and very slow clouds.
function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, "#a9e0ff");
  sky.addColorStop(1, "#e8f8ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  loopTiles(250, 0.035, (x, index) => drawCloud(x + 20, 56 + randomAt(index + 7) * 112, 0.7 + randomAt(index + 8) * 0.55));
}

function drawCloud(x, y, scale) {
  for (const [offsetX, offsetY, radius] of [[0, 10, 18], [24, 0, 26], [52, 12, 19], [76, 17, 14]]) {
    circle(x + offsetX * scale, y + offsetY * scale, radius * scale, "#f9feff", "#6fb9e8", 3 * scale);
  }
  roundedRect(x - 4 * scale, y + 14 * scale, 92 * scale, 23 * scale, 12 * scale, "#f9feff", "#6fb9e8", 3 * scale);
}

// Layer 2: distant buildings.
function drawBuildings() {
  loopTiles(150, 0.13, (x, index) => {
    const density = randomAt(index + 91);
    const height = 62 + density * 120;
    const width = 58 + randomAt(index + 92) * 48;
    const topY = VIEW.groundY - 58 - height;
    const fill = density > 0.5 ? "#78c5ee" : "#9bd8f4";
    roundedRect(x + 18, topY, width, height, 10, fill, "#5daee0", 3);
    circle(x + 18 + width / 2, topY + 5, width * 0.28, "#d7f4ff", "#5daee0", 3);
    ctx.fillStyle = "#dff7ff";
    for (let row = 0; row < 3; row += 1) {
      ctx.fillRect(x + 32, topY + 34 + row * 28, 10, 15);
      ctx.fillRect(x + width - 4, topY + 34 + row * 28, 10, 15);
    }
  });
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#78c5ee";
  ctx.fillRect(0, VIEW.groundY - 65, VIEW.width, 65);
  ctx.globalAlpha = 1;
}

// Layer 3: bushes.
function drawBushes() {
  loopTiles(168, 0.31, (x, index) => {
    const baseY = VIEW.groundY - 4;
    const color = randomAt(index + 33) > 0.5 ? "#16966f" : "#23ad75";
    const back = randomAt(index + 34) > 0.5 ? "#0b775f" : "#117e63";
    circle(x + 16, baseY - 34, 36, back, OUTLINE, 3);
    circle(x + 53, baseY - 53, 49, back, OUTLINE, 3);
    circle(x + 102, baseY - 36, 40, color, OUTLINE, 3);
    circle(x + 142, baseY - 48, 34, color, OUTLINE, 3);
    drawLeaf(x + 82, baseY - 42, "#58c873");
  });
}

function drawLeaf(x, y, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y + 11);
  ctx.quadraticCurveTo(x - 17, y - 4, x - 11, y - 17);
  ctx.quadraticCurveTo(x, y - 9, x, y + 11);
  ctx.quadraticCurveTo(x + 15, y - 4, x + 11, y - 17);
  ctx.quadraticCurveTo(x + 1, y - 9, x, y + 11);
  ctx.fillStyle = fill;
  ctx.fill();
}

// Layer 4: ground; its chunks meet at fixed boundaries.
function drawGround() {
  const surface = VIEW.groundY;
  ctx.fillStyle = "#8b4b32";
  ctx.fillRect(0, surface, VIEW.width, VIEW.height - surface);
  loopTiles(128, 1, (x, index) => {
    ctx.fillStyle = index % 2 === 0 ? "#a95f3b" : "#9d5638";
    ctx.fillRect(x, surface + 28, 128, VIEW.height - surface - 28);
    ctx.fillStyle = "#f4b868";
    ctx.fillRect(x, surface + 12, 128, 22);
    roundedRect(x - 3, surface - 8, 134, 27, 12, "#9be347", OUTLINE, 3);
    ctx.fillStyle = "#57bd3f";
    ctx.fillRect(x, surface + 7, 128, 9);
    for (let dot = 0; dot < 3; dot += 1) {
      const dotX = x + 18 + randomAt(index * 10 + dot) * 96;
      const dotY = surface + 54 + randomAt(index * 20 + dot) * 76;
      circle(dotX, dotY, 5 + randomAt(index * 30 + dot) * 6, "#75432f", "#75432f", 0);
    }
  });
}

// Layer 5: every obstacle and coin belongs to a deterministic world chunk.
function getChunkItems(chunk) {
  const obstacleChance = randomAt(chunk + 501);
  let obstacle = null;
  if (chunk >= 2 && obstacleChance >= 0.3) {
    const kind = Math.floor(randomAt(chunk + 503) * 3);
    const x = chunk * CHUNK_WIDTH + 112 + randomAt(chunk + 502) * 184;
    if (kind === 0) obstacle = { kind: "rock", x, width: 78, height: 48, solid: true };
    if (kind === 1) {
      const tall = randomAt(chunk + 504) > 0.72;
      obstacle = { kind: "crate", x, width: 50, height: tall ? 100 : 50, tall, solid: true };
    }
    if (kind === 2) obstacle = { kind: "sign", x, width: 30, height: 82, solid: false };
  }

  const coins = [];
  if (randomAt(chunk + 610) > 0.27) {
    const amount = 2 + Math.floor(randomAt(chunk + 611) * 3);
    const baseX = chunk * CHUNK_WIDTH + 54 + randomAt(chunk + 612) * 130;
    for (let index = 0; index < amount; index += 1) {
      coins.push({ id: `${chunk}:${index}`, x: baseX + index * 36, y: VIEW.groundY - 72 - (index % 2) * 18 });
    }
  }
  return { obstacle, coins };
}

function visibleChunks(draw) {
  const start = Math.floor(state.cameraX / CHUNK_WIDTH) - 1;
  const end = Math.ceil((state.cameraX + VIEW.width) / CHUNK_WIDTH) + 1;
  for (let chunk = start; chunk <= end; chunk += 1) draw(chunk, getChunkItems(chunk));
}

function drawObjects() {
  visibleChunks((chunk, items) => {
    if (items.obstacle) drawObstacle(items.obstacle, items.obstacle.x - state.cameraX);
    for (const coin of items.coins) {
      if (!state.collected.has(coin.id)) drawCoin(coin.x - state.cameraX, coin.y);
    }
  });
}

function drawCoin(x, y) {
  const squish = 0.72 + Math.abs(Math.sin(state.frameClock * 6 + x * 0.03)) * 0.28;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squish, 1);
  circle(0, 0, 12, "#ffd84f", "#9a6720", 3);
  ctx.fillStyle = "#fff5af";
  ctx.fillRect(-2, -6, 4, 12);
  ctx.restore();
}

function drawObstacle(obstacle, x) {
  if (obstacle.kind === "rock") return drawRock(x, VIEW.groundY - 6);
  if (obstacle.kind === "crate") return drawCrate(x, VIEW.groundY - 8, obstacle.tall);
  drawSignpost(x, VIEW.groundY - 7);
}

function drawRock(x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 13, y - 48, x + 37, y - 43);
  ctx.quadraticCurveTo(x + 66, y - 48, x + 78, y);
  ctx.closePath();
  ctx.fillStyle = "#8fa9bc";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  circle(x + 31, y - 25, 8, "#cce0ec", null);
}

function drawCrate(x, y, tall) {
  const size = 50;
  for (let level = 0; level < (tall ? 2 : 1); level += 1) {
    const top = y - size * (level + 1);
    roundedRect(x, top, size, size, 5, "#d99242", OUTLINE, 4);
    ctx.strokeStyle = "#8f502c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 8, top + 8);
    ctx.lineTo(x + size - 8, top + size - 8);
    ctx.moveTo(x + size - 8, top + 8);
    ctx.lineTo(x + 8, top + size - 8);
    ctx.stroke();
  }
}

function drawSignpost(x, y) {
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(x + 15, y);
  ctx.lineTo(x + 15, y - 82);
  ctx.stroke();
  roundedRect(x - 10, y - 81, 72, 34, 6, "#e6a554", OUTLINE, 4);
  ctx.fillStyle = "#84452b";
  ctx.beginPath();
  ctx.moveTo(x + 50, y - 76);
  ctx.lineTo(x + 67, y - 64);
  ctx.lineTo(x + 50, y - 52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function drawPlayer() {
  const airborne = state.player.feetY < VIEW.groundY - 0.5;
  const moving = Math.abs(state.speed) > 18 && !airborne && !state.player.crouching;
  const mode = state.gameOver ? "hurt" : state.player.crouching ? "crouch" : airborne ? "jump" : moving ? "walk" : "idle";
  const config = {
    walk: { image: images.walk, frames: 8, width: 112, height: 170 },
    idle: { image: images.idle, frames: 1, width: 112, height: 170 },
    jump: { image: images.jump, frames: 1, width: 112, height: 170 },
    crouch: { image: images.crouch, frames: 4, width: 118, height: 138 },
    hurt: { image: images.hurt, frames: 4, width: 112, height: 170 }
  }[mode];
  if (!config.image.complete || config.image.naturalWidth === 0) return;

  const frame = config.frames > 1 ? Math.floor(state.frameClock * (mode === "walk" ? 12 : 5)) % config.frames : 0;
  const x = PLAYER_X;
  const y = state.player.feetY - config.height;
  ctx.save();
  if (state.facing < 0) {
    ctx.translate(x + config.width, 0);
    ctx.scale(-1, 1);
    drawSprite(config.image, frame, 0, y, config.width, config.height, config.frames);
  } else {
    drawSprite(config.image, frame, x, y, config.width, config.height, config.frames);
  }
  ctx.restore();
}

function drawSprite(image, frame, x, y, width, height, frames) {
  const sourceWidth = image.naturalWidth / frames;
  ctx.drawImage(image, frame * sourceWidth, 0, sourceWidth, image.naturalHeight, x, y, width, height);
}

function drawHud() {
  roundedRect(16, 16, 222, 60, 14, "rgba(255,255,255,0.9)", "#5daee0", 3);
  ctx.fillStyle = OUTLINE;
  ctx.font = "700 14px system-ui";
  ctx.fillText("PUNTOS", 34, 40);
  ctx.font = "700 27px system-ui";
  ctx.fillText(String(state.score).padStart(5, "0"), 32, 65);
  ctx.font = "700 16px system-ui";
  ctx.fillStyle = "#9a6720";
  ctx.fillText(`● ${state.coins}`, 168, 63);

  roundedRect(760, 16, 184, 38, 12, "rgba(255,255,255,0.9)", "#5daee0", 3);
  ctx.fillStyle = OUTLINE;
  ctx.font = "700 14px system-ui";
  const label = state.paused ? "PAUSA" : state.muted ? "SIN SONIDO" : "TAB: PAUSA";
  ctx.fillText(label, 785, 41);
}

function collectCoins() {
  const playerWorldX = state.cameraX + PLAYER_X + 55;
  const start = Math.floor(playerWorldX / CHUNK_WIDTH) - 1;
  for (let chunk = start; chunk <= start + 2; chunk += 1) {
    for (const coin of getChunkItems(chunk).coins) {
      if (!state.collected.has(coin.id) && Math.abs(coin.x - playerWorldX) < 30 && state.player.feetY < coin.y + 92) {
        state.collected.add(coin.id);
        state.coins += 1;
        sfxCoin();
      }
    }
  }

  const oldestVisibleChunk = Math.floor(state.cameraX / CHUNK_WIDTH) - 3;
  for (const id of state.collected) {
    if (Number(id.split(":")[0]) < oldestVisibleChunk) state.collected.delete(id);
  }
}

function checkCollision() {
  if (state.cameraX < CHUNK_WIDTH) return;
  const playerWorldX = state.cameraX + PLAYER_X + 58;
  const chunk = Math.floor(playerWorldX / CHUNK_WIDTH);
  for (let index = chunk - 1; index <= chunk + 1; index += 1) {
    const obstacle = getChunkItems(index).obstacle;
    if (!obstacle?.solid) continue;
    const overlapsX = playerWorldX > obstacle.x - 10 && playerWorldX < obstacle.x + obstacle.width + 12;
    const tooLow = state.player.feetY > VIEW.groundY - obstacle.height - 12;
    if (overlapsX && tooLow) return endGame();
  }
}

function endGame() {
  if (state.gameOver) return;
  state.gameOver = true;
  state.autoRun = false;
  state.speed = 0;
  state.highScore = Math.max(state.highScore, state.score);
  saveHighScore();
  finalScore.textContent = `Puntos: ${state.score} · Mejor: ${state.highScore}`;
  gameOverPanel.hidden = false;
  sfxHit();
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

  state.player.velocityY += 1250 * delta;
  state.player.feetY += state.player.velocityY * delta;
  if (state.player.feetY > VIEW.groundY) {
    state.player.feetY = VIEW.groundY;
    state.player.velocityY = 0;
  }
  state.frameClock += delta;
  collectCoins();
  checkCollision();
  state.score = Math.max(state.score, Math.floor(state.cameraX / 4) + state.coins * 100);
}

function render() {
  drawSky();
  drawBuildings();
  drawBushes();
  drawGround();
  drawObjects();
  drawPlayer();
  drawHud();
}

function jump() {
  if (!state.paused && !state.gameOver && state.player.feetY >= VIEW.groundY - 0.5) {
    state.player.velocityY = -560;
    state.player.crouching = false;
    sfxJump();
  }
}

function togglePause() {
  if (state.gameOver) return;
  state.paused = !state.paused;
  toggleButton.textContent = state.paused ? "Reanudar" : "Pausar";
  toggleButton.setAttribute("aria-pressed", String(state.paused));
  sfxPause();
}

function restart() {
  state.cameraX = 0;
  state.speed = 150;
  state.autoRun = true;
  state.paused = false;
  state.facing = 1;
  state.frameClock = 0;
  state.score = 0;
  state.coins = 0;
  state.collected.clear();
  state.gameOver = false;
  state.player = { feetY: VIEW.groundY, velocityY: 0, crouching: false, invincible: 0 };
  gameOverPanel.hidden = true;
  toggleButton.textContent = "Pausar";
  toggleButton.setAttribute("aria-pressed", "false");
  canvas.focus();
}

let previous = performance.now();
function tick(now) {
  const delta = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  update(delta);
  render();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const controlled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab", "KeyM", "KeyR"];
  if (controlled.includes(event.code)) event.preventDefault();
  if (event.code === "Tab" && !event.repeat) return togglePause();
  if (event.code === "KeyM" && !event.repeat) {
    state.muted = !state.muted;
    if (!state.muted) sound(520, 760, 0.08, "triangle", 0.03);
    return;
  }
  if (event.code === "KeyR" && !event.repeat && state.gameOver) return restart();
  keys.add(event.code);
  if ((event.code === "Space" || event.code === "ArrowUp") && !event.repeat) jump();
});

window.addEventListener("keyup", (event) => keys.delete(event.code));

document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.focus();
    keys.add(code);
    if (code === "ArrowUp") jump();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => button.addEventListener(type, () => keys.delete(code)));
});

toggleButton.addEventListener("click", togglePause);
document.getElementById("restart").addEventListener("click", restart);
canvas.addEventListener("pointerdown", () => canvas.focus());
requestAnimationFrame(tick);
