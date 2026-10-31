"use strict";

(() => {
  const WIDTH = 960;
  const HEIGHT = 500;
  const SCORE_PER_SECOND = 1000;
  const BONUS_SECONDS = 3;
  const MISSION_SECONDS = 10;
  const BEST_SCORE_KEY = "underground-rocket-best-score";

  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const scoreElement = document.querySelector("#score");
  const bestScoreElement = document.querySelector("#best-score");
  const bonusBadge = document.querySelector("#bonus-badge");
  const bonusTime = document.querySelector("#bonus-time");
  const startScreen = document.querySelector("#start-screen");
  const startButton = document.querySelector("#start-button");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const missionPrompt = document.querySelector("#mission-prompt");
  const missionButton = document.querySelector("#mission-button");
  const missionTime = document.querySelector("#mission-time");
  const missionTimerBar = document.querySelector("#mission-timer-bar");
  const gameShell = document.querySelector("#game-shell");

  const player = { x: 150, y: HEIGHT / 2, radius: 21, speed: 430 };
  const worms = [];
  const keys = new Set();
  let state = "ready";
  let previousFrame = 0;
  let elapsed = 0;
  let score = 0;
  let bestScore = loadBestScore();
  let spawnTimer = 0;
  let nextWormIn = 1.1;
  let nextMissionAt = 8;
  let missionRemaining = 0;
  let bonusRemaining = 0;
  let worldTime = 0;

  bestScoreElement.textContent = formatScore(bestScore);

  function loadBestScore() {
    try {
      return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore(value) {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }

  function formatScore(value) {
    return Math.max(0, Math.floor(value)).toString().padStart(6, "0");
  }

  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * pixelRatio);
    canvas.height = Math.round(bounds.height * pixelRatio);
    context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    drawScene();
  }

  function startGame() {
    state = "running";
    elapsed = 0;
    score = 0;
    spawnTimer = 0;
    nextWormIn = 1.1;
    nextMissionAt = 8;
    missionRemaining = 0;
    bonusRemaining = 0;
    player.x = 150;
    worms.length = 0;
    keys.clear();
    scoreElement.textContent = formatScore(0);
    bonusBadge.hidden = true;
    missionPrompt.hidden = true;
    startScreen.hidden = true;
    previousFrame = performance.now();
    requestAnimationFrame(gameLoop);
  }

  function finishGame() {
    if (state !== "running") return;
    state = "over";
    keys.clear();
    missionPrompt.hidden = true;
    bonusBadge.hidden = true;
    const finalScore = Math.floor(score);
    const newRecord = finalScore > bestScore;
    if (newRecord) {
      bestScore = finalScore;
      bestScoreElement.textContent = formatScore(bestScore);
      saveBestScore(bestScore);
    }

    overlayKicker.textContent = newRecord ? "새로운 최고 기록!" : "생존 종료";
    overlayTitle.innerHTML = newRecord ? "대단해요!<br>최고 기록 달성!" : "다시 도전해<br>볼까요?";
    overlayCopy.innerHTML = `최종 점수 <b>${formatScore(finalScore)}</b><br>한 번 더 도전해서 기록을 세워 봐요.`;
    startButton.innerHTML = '다시 시작 <span aria-hidden="true">→</span>';
    startScreen.hidden = false;
    drawScene();
  }

  function spawnWorm() {
    const margin = 52;
    const x = margin + Math.random() * (WIDTH - margin * 2);
    const difficulty = Math.min(elapsed * 4, 170);
    worms.push({
      x,
      y: -56,
      speed: 170 + difficulty + Math.random() * 45,
      phase: Math.random() * Math.PI * 2,
      width: 54 + Math.random() * 20,
    });
  }

  function activateMission() {
    if (state !== "running" || missionRemaining <= 0) return;
    missionRemaining = 0;
    nextMissionAt = elapsed + 13 + Math.random() * 6;
    missionPrompt.hidden = true;
    bonusRemaining = BONUS_SECONDS;
    bonusBadge.hidden = false;
    bonusTime.textContent = BONUS_SECONDS.toFixed(1);
  }

  function update(delta) {
    const step = Math.min(delta, 0.05);
    elapsed += step;
    worldTime += step;

    const direction = (keys.has("ArrowRight") || keys.has("KeyD") || keys.has("right") ? 1 : 0)
      - (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("left") ? 1 : 0);
    player.x = Math.max(player.radius + 10, Math.min(WIDTH - player.radius - 10, player.x + direction * player.speed * step));

    const multiplier = bonusRemaining > 0 ? 1.5 : 1;
    score += SCORE_PER_SECOND * step * multiplier;
    scoreElement.textContent = formatScore(score);

    if (bonusRemaining > 0) {
      bonusRemaining = Math.max(0, bonusRemaining - step);
      bonusTime.textContent = bonusRemaining.toFixed(1);
      bonusBadge.hidden = bonusRemaining <= 0;
    }

    if (missionRemaining > 0) {
      missionRemaining = Math.max(0, missionRemaining - step);
      missionTime.textContent = Math.ceil(missionRemaining).toString();
      missionTimerBar.style.width = `${(missionRemaining / MISSION_SECONDS) * 100}%`;
      if (missionRemaining <= 0) {
        missionPrompt.hidden = true;
        nextMissionAt = elapsed + 13 + Math.random() * 6;
      }
    } else if (elapsed >= nextMissionAt) {
      missionRemaining = MISSION_SECONDS;
      missionPrompt.hidden = false;
      missionTime.textContent = MISSION_SECONDS.toString();
      missionTimerBar.style.width = "100%";
    }

    spawnTimer += step;
    const spawnInterval = Math.max(0.58, 1.15 - elapsed * 0.006);
    if (spawnTimer >= nextWormIn) {
      spawnWorm();
      spawnTimer = 0;
      nextWormIn = spawnInterval * (0.78 + Math.random() * 0.5);
    }

    for (let index = worms.length - 1; index >= 0; index -= 1) {
      const worm = worms[index];
      worm.y += worm.speed * step;
      worm.phase += step * 4;
      if (worm.y > HEIGHT + 70) {
        worms.splice(index, 1);
        continue;
      }
      if (Math.abs(player.x - worm.x) < worm.width * 0.5 + player.radius * 0.7
        && Math.abs(player.y - worm.y) < 30) {
        finishGame();
        return;
      }
    }
  }

  function drawScene() {
    if (!context) return;
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#182638");
    gradient.addColorStop(0.52, "#1c2a38");
    gradient.addColorStop(1, "#101c2a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    drawCave();
    drawDust();
    for (const worm of worms) drawWorm(worm);
    drawPlayer();
  }

  function drawCave() {
    context.fillStyle = "#141d2a";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(WIDTH, 0);
    context.lineTo(WIDTH, 54);
    for (let x = WIDTH; x >= 0; x -= 30) {
      const wave = Math.sin(x * 0.018 + worldTime * 0.25) * 8 + Math.sin(x * 0.043) * 4;
      context.lineTo(x, 58 + wave);
    }
    context.closePath();
    context.fill();

    context.fillStyle = "#131d29";
    context.beginPath();
    context.moveTo(0, HEIGHT);
    context.lineTo(WIDTH, HEIGHT);
    context.lineTo(WIDTH, HEIGHT - 43);
    for (let x = WIDTH; x >= 0; x -= 30) {
      const wave = Math.sin(x * 0.02 + worldTime * 0.22) * 7 + Math.sin(x * 0.04) * 4;
      context.lineTo(x, HEIGHT - 47 + wave);
    }
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(151, 181, 190, 0.12)";
    context.lineWidth = 2;
    for (let x = 25; x < WIDTH; x += 116) {
      const y = 110 + Math.sin(x * 0.034) * 105;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 24, y + 20);
      context.lineTo(x + 40, y + 52);
      context.stroke();
    }

    context.strokeStyle = "rgba(192, 220, 187, 0.12)";
    context.lineWidth = 1;
    context.setLineDash([3, 10]);
    context.beginPath();
    context.moveTo(24, HEIGHT / 2);
    context.lineTo(WIDTH - 24, HEIGHT / 2);
    context.stroke();
    context.setLineDash([]);

    for (let x = 36; x < WIDTH; x += 130) {
      const glow = 0.4 + (Math.sin(worldTime * 2 + x) + 1) * 0.18;
      context.fillStyle = `rgba(205, 250, 113, ${glow})`;
      context.beginPath();
      context.arc(x, 84 + Math.sin(x) * 9, 2.2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawDust() {
    for (let index = 0; index < 38; index += 1) {
      const x = (index * 167 + Math.sin(index * 9.4) * 24) % WIDTH;
      const drift = (worldTime * (8 + index % 7) + index * 31) % HEIGHT;
      const y = 80 + drift * 0.72;
      context.fillStyle = `rgba(209, 226, 218, ${0.08 + (index % 4) * 0.025})`;
      context.beginPath();
      context.arc(x, y, 1 + (index % 3) * 0.35, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawWorm(worm) {
    const wiggle = Math.sin(worm.phase) * 3;
    const segments = 6;
    const startX = worm.x - worm.width / 2;
    for (let segment = segments - 1; segment >= 0; segment -= 1) {
      const t = segment / (segments - 1);
      const x = startX + t * worm.width;
      const y = worm.y + Math.sin(worm.phase + t * 5) * 5 + wiggle * (1 - t);
      context.fillStyle = segment === 0 ? "#d99069" : segment % 2 ? "#bd785d" : "#c98465";
      context.beginPath();
      context.ellipse(x, y, 8.5 - t * 1.2, 10 - t, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(69, 39, 39, 0.34)";
      context.lineWidth = 1;
      context.stroke();
      if (segment === 0) {
        context.fillStyle = "#242532";
        context.beginPath();
        context.arc(x - 2, y - 2, 1.5, 0, Math.PI * 2);
        context.arc(x + 3, y - 2, 1.5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const bob = state === "running" ? Math.sin(worldTime * 8) * 2 : 0;

    context.save();
    context.translate(x, y + bob);

    context.fillStyle = "rgba(4, 10, 18, 0.34)";
    context.beginPath();
    context.ellipse(0, 24, 23, 7, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f4dfb2";
    context.beginPath();
    context.roundRect(-14, -2, 28, 29, 9);
    context.fill();

    context.fillStyle = "#d6c49c";
    context.beginPath();
    context.roundRect(-20, 1, 8, 18, 4);
    context.roundRect(12, 1, 8, 18, 4);
    context.fill();

    context.fillStyle = "#ffe4b2";
    context.beginPath();
    context.arc(0, -13, 16, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#fff1d2";
    context.lineWidth = 3;
    context.stroke();

    context.fillStyle = "#637d83";
    context.beginPath();
    context.ellipse(0, -12, 10.5, 8, -0.15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(203, 249, 242, 0.78)";
    context.beginPath();
    context.ellipse(-3, -15, 3.5, 2, -0.3, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#c9f270";
    context.beginPath();
    context.arc(0, 7, 3, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#e9c88f";
    context.beginPath();
    context.roundRect(-11, 23, 9, 7, 3);
    context.roundRect(2, 23, 9, 7, 3);
    context.fill();
    context.restore();
  }

  function gameLoop(timestamp) {
    if (state !== "running") return;
    const delta = (timestamp - previousFrame) / 1000;
    previousFrame = timestamp;
    update(delta);
    drawScene();
    if (state === "running") requestAnimationFrame(gameLoop);
  }

  function press(key) {
    keys.add(key);
  }

  function release(key) {
    keys.delete(key);
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight"].includes(event.code)
      || (event.code === "Space" && (state === "running" || document.activeElement !== startButton))) {
      event.preventDefault();
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "KeyA" || event.code === "KeyD") {
      press(event.code);
    }
    if (event.code === "Space" && state === "running" && missionRemaining > 0) activateMission();
    if ((event.code === "Enter" || event.code === "Space") && state !== "running" && document.activeElement !== startButton) {
      startGame();
    }
  });

  window.addEventListener("keyup", (event) => release(event.code));
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) keys.clear();
  });

  startButton.addEventListener("click", startGame);
  missionButton.addEventListener("click", activateMission);

  for (const [id, key] of [["move-left", "left"], ["move-right", "right"]]) {
    const button = document.querySelector(`#${id}`);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      press(key);
    });
    button.addEventListener("pointerup", () => release(key));
    button.addEventListener("pointercancel", () => release(key));
    button.addEventListener("lostpointercapture", () => release(key));
  }

  new ResizeObserver(resizeCanvas).observe(gameShell);
  resizeCanvas();
})();
