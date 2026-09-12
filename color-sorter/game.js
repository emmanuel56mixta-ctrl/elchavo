const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const pauseButton = document.getElementById("pause");

const VIEW = { width: 960, height: 540, floorY: 438 };
const COLORS = [
  { id: "red", name: "roja", fill: "#f15a50", dark: "#a92d42", light: "#ffb3a6" },
  { id: "blue", name: "azul", fill: "#2c9fe8", dark: "#1760aa", light: "#aee9ff" },
  { id: "yellow", name: "amarilla", fill: "#ffd43d", dark: "#c58a18", light: "#fff3a1" },
  { id: "purple", name: "morada", fill: "#a867dc", dark: "#653d9c", light: "#e6c2ff" }
];
const TARGET_X = [130, 350, 610, 830];
const keys = new Set();
let audioContext;

const state = {
  level: 1,
  score: 0,
  robot: { x: 480, headAngle: 0, blink: 0, blinkClock: 0, mood: "idle" },
  spheres: [],
  targets: [],
  carrying: null,
  paused: false,
  muted: false,
  message: "Busca una esfera y llévala al recipiente de su color.",
  messageTimer: 5,
  completeTimer: 0,
  particles: []
};

function sound(frequency, endFrequency, duration, type = "triangle", volume = 0.04, delay = 0) {
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
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function sfxGrab() { sound(370, 610, 0.1, "square", 0.04); }
function sfxCorrect() { sound(620, 1040, 0.13, "triangle", 0.05); sound(900, 1450, 0.14, "triangle", 0.035, 0.09); }
function sfxWrong() { sound(160, 95, 0.22, "sawtooth", 0.045); }
function sfxPause() { sound(state.paused ? 250 : 540, state.paused ? 170 : 760, 0.08, "square", 0.03); }

function roundedRect(x, y, width, height, radius, fill, stroke = null, lineWidth = 0) {
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
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function circle(x, y, radius, fill, stroke = null, lineWidth = 0) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function startLevel() {
  const positions = shuffled([92, 263, 505, 744]);
  state.targets = COLORS.map((color, index) => ({ ...color, x: TARGET_X[index], filled: false }));
  state.spheres = COLORS.map((color, index) => ({
    color, x: positions[index], y: 336 + (index % 2) * 32, radius: 23, held: false, placed: false, bob: Math.random() * Math.PI * 2
  }));
  state.carrying = null;
  state.robot.x = 480;
  state.robot.mood = "idle";
  state.message = `Nivel ${state.level}: clasifica las cuatro esferas.`;
  state.messageTimer = 3.4;
  state.completeTimer = 0;
}

function nearestSphere() {
  const options = state.spheres.filter((sphere) => !sphere.held && !sphere.placed && Math.abs(sphere.x - state.robot.x) < 96);
  return options.sort((a, b) => Math.abs(a.x - state.robot.x) - Math.abs(b.x - state.robot.x))[0];
}

function nearestTarget() {
  return state.targets.slice().sort((a, b) => Math.abs(a.x - state.robot.x) - Math.abs(b.x - state.robot.x))[0];
}

function setMessage(message, time = 2.4) {
  state.message = message;
  state.messageTimer = time;
}

function makeParticles(color, x, y) {
  for (let index = 0; index < 20; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 120;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 55, life: 0.75 + Math.random() * 0.35, color: color.light });
  }
}

function interact() {
  if (state.paused || state.completeTimer > 0) return;
  if (!state.carrying) {
    const sphere = nearestSphere();
    if (!sphere) {
      state.robot.mood = "search";
      setMessage("Acércate a una esfera para tomarla.");
      return;
    }
    sphere.held = true;
    state.carrying = sphere;
    state.robot.mood = "focus";
    setMessage(`¡Esfera ${sphere.color.name}! Busca su recipiente.`);
    sfxGrab();
    return;
  }

  const target = nearestTarget();
  if (!target || Math.abs(target.x - state.robot.x) > 102) {
    state.robot.mood = "search";
    setMessage("Acércate al recipiente del mismo color.");
    return;
  }
  if (target.id !== state.carrying.color.id) {
    state.robot.mood = "wrong";
    setMessage(`Ese recipiente no es ${state.carrying.color.name}.`, 2.8);
    sfxWrong();
    return;
  }
  target.filled = true;
  state.carrying.held = false;
  state.carrying.placed = true;
  state.score += 250;
  makeParticles(target, target.x, VIEW.floorY - 86);
  state.carrying = null;
  state.robot.mood = "happy";
  setMessage("¡Perfecto! Energía ordenada.", 2);
  sfxCorrect();
  if (state.targets.every((item) => item.filled)) {
    state.completeTimer = 1.7;
    state.score += 500;
    state.robot.mood = "celebrate";
    setMessage("¡Nivel completado! Rubín está feliz.", 2.4);
    makeParticles({ light: "#fff4a6" }, state.robot.x, 160);
  }
}

function drawBackground() {
  const background = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  background.addColorStop(0, "#5b438c");
  background.addColorStop(0.64, "#a659a3");
  background.addColorStop(1, "#e78086");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  for (let index = 0; index < 9; index += 1) {
    const x = 34 + index * 120;
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    roundedRect(x, 148 + (index % 2) * 15, 82, 178, 28, "rgba(255, 255, 255, 0.055)");
    circle(x + 41, 180, 20, "rgba(255, 255, 255, 0.06)");
  }

  roundedRect(-18, 54, 996, 72, 28, "#1d8d6c", "#24325f", 5);
  roundedRect(-12, 60, 984, 58, 22, "#f4bd12", null);
  for (let x = -4; x < VIEW.width; x += 170) drawGear(x, 89, 26);
  ctx.fillStyle = "rgba(255, 245, 170, 0.45)";
  ctx.fillRect(0, 63, VIEW.width, 7);

  const floor = ctx.createLinearGradient(0, VIEW.floorY, 0, VIEW.height);
  floor.addColorStop(0, "#81443d");
  floor.addColorStop(1, "#3b263c");
  ctx.fillStyle = floor;
  ctx.fillRect(0, VIEW.floorY, VIEW.width, VIEW.height - VIEW.floorY);
  ctx.fillStyle = "#f6d690";
  ctx.fillRect(0, VIEW.floorY - 6, VIEW.width, 8);
}

function drawGear(x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#47475d";
  for (let index = 0; index < 12; index += 1) {
    ctx.rotate(Math.PI / 6);
    ctx.fillRect(radius - 2, -5, 11, 10);
  }
  circle(0, 0, radius, "#4e4a5d", "#322d42", 3);
  circle(0, 0, radius * 0.4, "#ff6a20", "#c73b14", 2);
  ctx.restore();
}

function drawTarget(target) {
  const x = target.x;
  const y = VIEW.floorY - 75;
  ctx.save();
  if (target.filled) ctx.shadowColor = target.fill;
  if (target.filled) ctx.shadowBlur = 22;
  roundedRect(x - 68, y, 136, 66, 16, target.dark, "#27314f", 4);
  roundedRect(x - 59, y + 10, 118, 44, 12, target.fill, "rgba(255,255,255,.5)", 2);
  ctx.fillStyle = "rgba(255,255,255,.24)";
  ctx.fillRect(x - 47, y + 16, 28, 7);
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 45, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#25304a";
  ctx.fill();
  if (target.filled) drawSphere({ color: target, x, y: y - 11, radius: 21, bob: 0 });
  ctx.restore();
}

function drawSphere(sphere) {
  const y = sphere.y + (sphere.held ? 0 : Math.sin(performance.now() * 0.003 + sphere.bob) * 3);
  const gradient = ctx.createRadialGradient(sphere.x - sphere.radius * 0.35, y - sphere.radius * 0.42, 2, sphere.x, y, sphere.radius);
  gradient.addColorStop(0, sphere.color.light);
  gradient.addColorStop(0.4, sphere.color.fill);
  gradient.addColorStop(1, sphere.color.dark);
  ctx.save();
  ctx.shadowColor = sphere.color.fill;
  ctx.shadowBlur = 10;
  circle(sphere.x, y, sphere.radius, gradient, "#3c3557", 3);
  ctx.restore();
  circle(sphere.x - sphere.radius * 0.3, y - sphere.radius * 0.34, sphere.radius * 0.18, "rgba(255,255,255,.82)");
}

function drawRobot() {
  const { robot } = state;
  const baseY = VIEW.floorY;
  const walking = keys.has("ArrowLeft") || keys.has("ArrowRight");
  const bob = walking ? Math.sin(performance.now() * 0.015) * 3 : Math.sin(performance.now() * 0.0024) * 1.5;
  const shoulderY = baseY - 132 + bob;
  const armWiggle = walking ? Math.sin(performance.now() * 0.014) * 0.18 : 0;
  const target = state.carrying ? nearestTarget() : nearestSphere();
  const side = target && target.x < robot.x ? -1 : 1;

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#291d48";
  ctx.beginPath(); ctx.ellipse(robot.x, baseY + 3, 63, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Los resortes nacen detrás de la barra del torso, como en el modelo original.
  drawSpringArm(robot.x - 58, shoulderY, -2.75 + armWiggle, state.carrying && side < 0);
  drawSpringArm(robot.x + 58, shoulderY, -0.39 - armWiggle, state.carrying && side > 0);

  ctx.save();
  ctx.translate(robot.x, baseY + bob);
  drawRobotWheel();
  ctx.restore();

  // El torso inferior es un cono suave que continúa visualmente la cabeza.
  ctx.save();
  ctx.translate(robot.x, baseY + bob);
  ctx.beginPath();
  ctx.moveTo(-57, -149); ctx.lineTo(57, -149);
  ctx.lineTo(31, -78); ctx.quadraticCurveTo(0, -55, -31, -78);
  ctx.closePath();
  const body = ctx.createLinearGradient(-45, -152, 38, -54);
  body.addColorStop(0, "#ffe04a"); body.addColorStop(0.58, "#f8c21b"); body.addColorStop(1, "#dc9510");
  ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#34405e"; ctx.stroke();
  // Base amarilla que conecta el cuerpo con la rueda dentada.
  ctx.beginPath(); ctx.ellipse(0, -68, 25, 17, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#edaf13"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#34405e"; ctx.stroke();
  roundedRect(-63, -158, 126, 15, 8, "#353c58", "#26304b", 2);
  for (let index = 0; index < 4; index += 1) {
    circle(-19 + index * 13, -128, 4.4, index === 0 ? "#19b7d2" : "#ffe342", "#b37d13", 1);
  }
  ctx.restore();

  drawRobotHead(robot.x, baseY - 211 + bob, robot.headAngle);

  if (state.carrying) {
    const heldX = robot.x + side * 94;
    state.carrying.x = heldX;
    state.carrying.y = baseY - 186 + bob;
    drawSphere(state.carrying);
  }
}

function drawRobotWheel() {
  // Rueda dentada grande y su guardabarros: el ancla visual de Rubín.
  ctx.save();
  ctx.translate(0, -25);
  ctx.fillStyle = "#252739";
  for (let index = 0; index < 12; index += 1) {
    ctx.save(); ctx.rotate(index * Math.PI / 6); ctx.fillRect(-4.5, -34, 9, 11); ctx.restore();
  }
  circle(0, 0, 30, "#27293a", "#15203a", 4);
  circle(0, 0, 21, "#4d4b50", "#282a38", 3);
  circle(0, 0, 10, "#f15339", "#a93435", 2);
  ctx.restore();
  ctx.fillStyle = "#2d3a5a";
  ctx.beginPath();
  ctx.moveTo(-37, -51); ctx.quadraticCurveTo(0, -78, 37, -51);
  ctx.lineTo(31, -43); ctx.quadraticCurveTo(0, -60, -31, -43);
  ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#19243f"; ctx.stroke();
}

function drawSpringArm(x, y, angle, holding) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#f3f3fb";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(62, 0); ctx.stroke();
  for (let index = 0; index < 7; index += 1) {
    ctx.strokeStyle = index % 2 ? "#8891aa" : "#dfe1ee";
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(7 + index * 8, -7); ctx.lineTo(12 + index * 8, 7); ctx.stroke();
  }
  ctx.translate(72, 0);
  ctx.strokeStyle = "#26304f";
  ctx.lineWidth = 17;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(0, 0, 18, holding ? -2.06 : -2.5, holding ? 2.06 : 2.5); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.restore();
}

function drawRobotHead(x, y, angle) {
  const mood = state.robot.mood;
  const eyeClosed = state.robot.blink > 0 || mood === "celebrate";
  const gaze = mood === "search" ? Math.sin(performance.now() * 0.005) * 4 : Math.sin(angle) * 9;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.save(); ctx.shadowColor = "#fff57e"; ctx.shadowBlur = 12;
  circle(0, -87, 14, "#fff37c", "#f4d84d", 2); ctx.restore();
  roundedRect(-7, -75, 14, 17, 4, "#d6d8e3", "#65708b", 2);
  ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.5; circle(-4, -92, 4, "#ffffff"); ctx.globalAlpha = 1;

  // Cabeza: una cúpula amplia de una pieza, no una esfera separada.
  ctx.beginPath();
  ctx.moveTo(-72, 34); ctx.quadraticCurveTo(-78, -19, -51, -61);
  ctx.quadraticCurveTo(-28, -84, 0, -85); ctx.quadraticCurveTo(28, -84, 51, -61);
  ctx.quadraticCurveTo(78, -19, 72, 34); ctx.quadraticCurveTo(62, 61, 0, 70);
  ctx.quadraticCurveTo(-62, 61, -72, 34); ctx.closePath();
  const head = ctx.createLinearGradient(-62, -68, 58, 66);
  head.addColorStop(0, "#ffe754"); head.addColorStop(0.58, "#f6c41c"); head.addColorStop(1, "#db9410");
  ctx.fillStyle = head; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#35405e"; ctx.stroke();

  ctx.strokeStyle = "#33415f"; ctx.lineWidth = 12; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-61, 36); ctx.lineTo(61, 36); ctx.stroke(); ctx.lineCap = "butt";
  ctx.fillStyle = "#33415f"; ctx.fillRect(-51, -41, 23, 9); ctx.fillRect(28, -41, 23, 9);

  if (eyeClosed) {
    ctx.strokeStyle = "#563a8c"; ctx.lineWidth = 5;
    for (const eyeX of [-31, 31]) { ctx.beginPath(); ctx.arc(eyeX, -9, 17, 0.2, Math.PI - 0.2); ctx.stroke(); }
  } else {
    drawEye(-31, -9, gaze, mood === "wrong");
    drawEye(31, -9, gaze, mood === "wrong");
  }

  ctx.lineWidth = 6; ctx.strokeStyle = mood === "wrong" ? "#7a3c97" : "#9c32c2"; ctx.lineCap = "round";
  ctx.beginPath();
  if (mood === "wrong") { ctx.arc(0, 31, 17, Math.PI + 0.35, -0.35); }
  else if (mood === "celebrate") { ctx.arc(0, 18, 25, 0.2, Math.PI - 0.2); }
  else { ctx.arc(0, 17, 20, 0.18, Math.PI - 0.18); }
  ctx.stroke(); ctx.lineCap = "butt";
  ctx.restore();
}

function drawEye(x, y, gaze, worried) {
  circle(x, y, 22, "#83bd32", "#4d6940", 3);
  circle(x, y, 17, "#36506d", null);
  circle(x + gaze * 0.28, y - 1, 11.5, worried ? "#4b325d" : "#1c2b48", null);
  circle(x + gaze * 0.28 - 3.5, y - 7, 4.8, "#fff", null);
}

function drawHud() {
  roundedRect(17, 17, 249, 63, 16, "rgba(255, 255, 255, .91)", "#2e3a68", 3);
  ctx.fillStyle = "#293555"; ctx.font = "800 14px system-ui"; ctx.fillText("RUBÍN · ESFERAS DE COLOR", 35, 41);
  ctx.font = "800 27px system-ui"; ctx.fillText(String(state.score).padStart(5, "0"), 33, 69);
  ctx.font = "800 14px system-ui"; ctx.fillStyle = "#8c529e"; ctx.fillText(`NIVEL ${state.level}`, 186, 69);
  roundedRect(754, 17, 188, 39, 13, "rgba(255, 255, 255, .91)", "#2e3a68", 3);
  ctx.fillStyle = "#293555"; ctx.font = "800 13px system-ui"; ctx.fillText(state.paused ? "PAUSA" : state.muted ? "SIN SONIDO" : "ESPACIO: ACCIÓN", 774, 42);
}

function drawMessage() {
  if (state.messageTimer <= 0) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, state.messageTimer * 2);
  roundedRect(170, 145, 620, 40, 18, "rgba(39, 29, 80, .7)", "rgba(255,255,255,.32)", 2);
  ctx.fillStyle = "#fff9df"; ctx.font = "700 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(state.message, VIEW.width / 2, 171); ctx.textAlign = "start";
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.save(); ctx.globalAlpha = Math.max(0, particle.life); circle(particle.x, particle.y, 4, particle.color); ctx.restore();
  }
}

function update(delta) {
  if (state.paused) return;
  const movingLeft = keys.has("ArrowLeft") || keys.has("KeyA");
  const movingRight = keys.has("ArrowRight") || keys.has("KeyD");
  const speed = keys.has("ShiftLeft") ? 360 : 230;
  if (movingLeft) state.robot.x -= speed * delta;
  if (movingRight) state.robot.x += speed * delta;
  state.robot.x = Math.max(50, Math.min(VIEW.width - 50, state.robot.x));

  const headIntent = keys.has("ArrowUp") || keys.has("KeyW") ? -0.52 : keys.has("ArrowDown") || keys.has("KeyS") ? 0.52 : movingLeft ? -0.2 : movingRight ? 0.2 : state.carrying ? (nearestTarget().x < state.robot.x ? -0.24 : 0.24) : Math.sin(performance.now() * 0.0016) * 0.08;
  state.robot.headAngle += (headIntent - state.robot.headAngle) * Math.min(1, delta * 7);
  if (movingLeft || movingRight) state.robot.mood = state.carrying ? "focus" : "idle";

  state.robot.blinkClock += delta;
  if (state.robot.blinkClock > 3.3) { state.robot.blink = 0.16; state.robot.blinkClock = 0; }
  state.robot.blink = Math.max(0, state.robot.blink - delta);
  state.messageTimer = Math.max(0, state.messageTimer - delta);

  for (const particle of state.particles) { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 220 * delta; particle.life -= delta; }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  if (state.completeTimer > 0) {
    state.completeTimer -= delta;
    if (state.completeTimer <= 0) { state.level += 1; startLevel(); }
  }
}

function render() {
  drawBackground();
  for (const target of state.targets) drawTarget(target);
  for (const sphere of state.spheres) if (!sphere.held && !sphere.placed) drawSphere(sphere);
  drawRobot();
  drawParticles();
  drawHud();
  drawMessage();
}

function togglePause() {
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Reanudar" : "Pausar";
  pauseButton.setAttribute("aria-pressed", String(state.paused));
  sfxPause();
}

function restart() {
  state.level = 1; state.score = 0; state.particles = []; startLevel();
}

let previous = performance.now();
function tick(now) {
  const delta = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  update(delta); render(); requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const controlled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab", "KeyM", "KeyR"];
  if (controlled.includes(event.code)) event.preventDefault();
  if (event.code === "Tab" && !event.repeat) return togglePause();
  if (event.code === "Space" && !event.repeat) return interact();
  if (event.code === "KeyM" && !event.repeat) { state.muted = !state.muted; return; }
  if (event.code === "KeyR" && !event.repeat) return restart();
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));
document.querySelectorAll("[data-key]").forEach((button) => {
  const code = button.dataset.key;
  button.addEventListener("pointerdown", (event) => { event.preventDefault(); canvas.focus(); keys.add(code); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => button.addEventListener(type, () => keys.delete(code)));
});
document.querySelector("[data-action='grab']").addEventListener("click", () => { canvas.focus(); interact(); });
pauseButton.addEventListener("click", togglePause);
canvas.addEventListener("pointerdown", () => canvas.focus());

startLevel();
requestAnimationFrame(tick);
