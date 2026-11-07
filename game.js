"use strict";

(() => {
  const WIDTH = 960;
  const HEIGHT = 500;
  const LANE_COUNT = 3;
  const LANE_WIDTH = WIDTH / LANE_COUNT;
  const SCORE_PER_SECOND = 1000;
  const BONUS_SECONDS = 3;
  const MISSION_SECONDS = 10;
  const BEST_SCORE_KEY = "underground-rocket-best-score";
  const LANE_CHANGE_SECONDS = 0.22;
  const WORLD_SPEED = 240;

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
  const sprites = {
    left: loadImage("./assets/player-left.png"),
    right: loadImage("./assets/player-right.png"),
    front: loadImage("./assets/player-front.png"),
  };
  const soilImage = loadImage("./assets/soil.png?v=soil-original-20261107");

  const player = {
    lane: 1,
    fromLane: 1,
    targetLane: 1,
    transition: 1,
    facing: "front",
    y: 245,
  };
  const worms = [];
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
  let soilOffset = 0;

  bestScoreElement.textContent = formatScore(bestScore);

  function loadImage(source) {
    const image = new Image();
    image.addEventListener("load", drawScene);
    image.addEventListener("error", () => console.error(`Unable to load game image: ${source}`));
    image.src = source;
    return image;
  }

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
    player.lane = 1;
    player.fromLane = 1;
    player.targetLane = 1;
    player.transition = 1;
    player.facing = "front";
    player.y = 245;
    soilOffset = 0;
    worms.length = 0;
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
    const difficulty = Math.min(elapsed * 4, 170);
    worms.push({
      lane: Math.floor(Math.random() * LANE_COUNT),
      y: HEIGHT + 64,
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
    const soilTileHeight = soilImage.naturalHeight * WIDTH / soilImage.naturalWidth || HEIGHT;
    soilOffset = (soilOffset - WORLD_SPEED * step) % soilTileHeight;

    player.y = Math.min(HEIGHT * 0.68, player.y + 70 * step);
    if (player.transition < 1) {
      player.transition = Math.min(1, player.transition + step / LANE_CHANGE_SECONDS);
      if (player.transition >= 1) {
        player.lane = player.targetLane;
        player.fromLane = player.targetLane;
        player.facing = "front";
      }
    }

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
      worm.y -= worm.speed * step;
      worm.phase += step * 4;
      if (worm.y < -70) {
        worms.splice(index, 1);
        continue;
      }
      if (Math.abs(playerX() - laneCenter(worm.lane)) < worm.width * 0.5 + 24
        && Math.abs(player.y - worm.y) < 30) {
        finishGame();
        return;
      }
    }
  }

  function drawScene() {
    if (!context) return;
    drawSoil();
    drawLanes();
    for (const worm of worms) drawWorm(worm);
    drawPlayer();
  }

  function drawSoil() {
    if (soilImage.complete && soilImage.naturalWidth > 0) {
      const tileHeight = soilImage.naturalHeight * WIDTH / soilImage.naturalWidth;
      for (let y = soilOffset - tileHeight; y < HEIGHT; y += tileHeight) {
        context.drawImage(soilImage, 0, y, WIDTH, tileHeight);
      }
    }
  }

  function drawLanes() {
    context.strokeStyle = "rgba(255, 231, 195, 0.78)";
    context.lineWidth = 3;
    for (let lane = 1; lane < LANE_COUNT; lane += 1) {
      const x = lane * LANE_WIDTH;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, HEIGHT);
      context.stroke();
    }
  }

  function drawWorm(worm) {
    const wiggle = Math.sin(worm.phase) * 3;
    const segments = 6;
    const centerX = laneCenter(worm.lane);
    const startX = centerX - worm.width / 2;
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
    const x = playerX();
    const y = player.y;
    const sprite = sprites[player.facing];
    const spriteHeight = 190;
    const bob = state === "running" && player.transition >= 1 ? Math.sin(worldTime * 8) * 2 : 0;

    context.save();
    context.fillStyle = "rgba(25, 13, 7, 0.45)";
    context.beginPath();
    context.ellipse(x, y + 8, 24, 8, 0, 0, Math.PI * 2);
    context.fill();
    if (sprite.complete && sprite.naturalWidth > 0) {
      const spriteWidth = spriteHeight * sprite.naturalWidth / sprite.naturalHeight;
      context.drawImage(sprite, x - spriteWidth / 2, y - spriteHeight + bob, spriteWidth, spriteHeight);
    } else {
      context.fillStyle = "#ffe4b2";
      context.beginPath();
      context.arc(x, y - 146 + bob, 16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#c9f270";
      context.fillRect(x - 12, y - 124 + bob, 24, 52);
    }
    context.restore();
  }

  function laneCenter(lane) {
    return (lane + 0.5) * LANE_WIDTH;
  }

  function playerX() {
    const progress = player.transition >= 1
      ? 1
      : player.transition * player.transition * (3 - 2 * player.transition);
    const lane = player.fromLane + (player.targetLane - player.fromLane) * progress;
    return laneCenter(lane);
  }

  function moveLane(direction) {
    if (state !== "running" || player.transition < 1) return;
    const targetLane = Math.max(0, Math.min(LANE_COUNT - 1, player.lane + direction));
    if (targetLane === player.lane) return;
    player.fromLane = player.lane;
    player.targetLane = targetLane;
    player.transition = 0;
    player.facing = direction < 0 ? "left" : "right";
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
    if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat && (event.code === "ArrowLeft" || event.code === "KeyA")) {
      moveLane(-1);
    } else if (!event.repeat && (event.code === "ArrowRight" || event.code === "KeyD")) {
      moveLane(1);
    }
    if (event.code === "Space" && state === "running" && missionRemaining > 0) activateMission();
    if (event.code === "Enter" && state !== "running" && document.activeElement !== startButton) {
      startGame();
    }
  });

  startButton.addEventListener("click", startGame);
  missionButton.addEventListener("click", activateMission);

  for (const [id, direction] of [["move-left", -1], ["move-right", 1]]) {
    const button = document.querySelector(`#${id}`);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      moveLane(direction);
    });
  }

  new ResizeObserver(resizeCanvas).observe(gameShell);
  resizeCanvas();
})();
