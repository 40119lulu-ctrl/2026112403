const assets = {};
const pressed = {};
const lastTap = {};
const questions = ["+", "-", "×"];
const BG_REPEAT = 9;

// 走到 fih 前的路段分成 4 等分，每段顯示一句話，離開該路段即消失
const introSegments = [
  "今天是個好日子",
  "所以來練習數學吧",
  "等等的題目將會越來越難",
  "看看你可以達到第幾題吧!"
];

let player;
let fish = [];
let apples = [];
let score = 0;
let cameraX = 0;
let startX = 150;
let attackTime = 0;
let attackDirection = 1;
let attackFired = false;
let runDirection = null;
let flying = false;
let quizFish = null;
let quizData = null;
let pendingQuizData = null;
let questionLevel = 1;
let lastHudUpdate = 0;

function preload() {
  // 修正：指向 back 資料夾中的 BG2.png
  assets.bg = loadImage("back/BG2.png");
  assets.walk = loadImage("kirby/walk/all(walk).png");
  assets.run = loadImage("kirby/run/all(run).png");
  assets.jump = loadImage("kirby/jump/all(jump).png");
  assets.fly = loadImage("kirby/fly/all(fly).png");
  assets.hit = loadImage("kirby/hit/hit(all).png");
  assets.apple = loadImage("apple/apple(all).png");
  assets.fish = loadImage("fih/stop/stop(all).png");
  assets.happy = loadImage("fih/happy/happy(all).png");
  assets.sadge = loadImage("fih/sadge/sadge(all).png");
}

function setup() {
  const stage = document.getElementById("game-stage");
  if (!stage) return;
  const canvas = createCanvas(stage.clientWidth, stage.clientHeight);
  canvas.parent(stage);
  canvas.elt.setAttribute("aria-label", "淺藍天空中的 Kirby 數學冒險畫面");
  pixelDensity(1);
  drawingContext.imageSmoothingEnabled = false;
  player = { x: startX, y: height * 0.75, vy: 0, facing: 1, walkClock: 0, onGround: true };
  bindControls();
  resizeGame();
  spawnFinalFish();
}

function spawnFinalFish() {
  fish = [
    {
      x: width * (BG_REPEAT - 0.35),
      state: "stop",
      stateTime: 0,
      animFrameDuration: 0.19,
      animCycles: 3
    }
  ];
}

function draw() {
  const dt = Math.min(deltaTime / 1000, 0.04);
  const groundY = height * 0.75;
  updateGame(dt, groundY);
  drawWorld(groundY);
  drawSegmentText(groundY);
  drawFish(groundY);
  drawApples(dt, groundY);
  drawPlayer(groundY);
  updateHud();
}

function updateGame(dt, groundY) {
  if (!player || quizFish) return;

  const worldWidth = width * BG_REPEAT;
  const direction = (pressed.ArrowRight ? 1 : 0) - (pressed.ArrowLeft ? 1 : 0);
  const running = runDirection !== null && direction === runDirection;
  if (direction) {
    player.facing = direction;
    player.x += direction * (running ? 420 : 245) * dt;
    player.x = constrain(player.x, 40, worldWidth - 40);
    player.walkClock += dt * (running ? 16 : 9);
  }

  if (flying && !player.onGround) {
    if (pressed.ArrowUp) player.vy = Math.max(player.vy - 900 * dt, -245);
    else player.vy = Math.min(player.vy + 230 * dt, 150);
    if (pressed.ArrowDown) player.vy = 265;
  } else {
    player.vy += 1120 * dt;
  }
  player.y += player.vy * dt;
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
    flying = false;
  } else {
    player.onGround = false;
  }

  if (attackTime > 0) {
    attackTime = Math.max(0, attackTime - dt);
    if (!attackTime && !attackFired) {
      launchApple();
      attackFired = true;
    }
  }

  const maxCameraX = Math.max(0, worldWidth - width);
  cameraX = constrain(player.x - width * 0.42, 0, maxCameraX);

  // 動畫循環三次後重置狀態
  for (const enemy of fish) {
    if (enemy.state === "happy" || enemy.state === "sadge") {
      enemy.stateTime += dt;
      const frameCount = enemy.state === "happy" ? 2 : 4;
      const totalDuration = frameCount * enemy.animFrameDuration * enemy.animCycles;
      if (enemy.stateTime >= totalDuration) {
        enemy.state = "stop";
        enemy.stateTime = 0;
      }
    }
  }
}

function drawSegmentText(groundY) {
  if (!player || fish.length === 0) return;

  const targetX = fish[0].x;
  const totalSpan = Math.max(1, targetX - startX);
  const segmentLength = totalSpan / introSegments.length;

  // 只在起點到 fih 前的 4 等分路段內顯示對應句子，超過或不在該段則消失
  if (player.x < startX || player.x >= targetX) return;

  const segmentIndex = Math.floor((player.x - startX) / segmentLength);
  const message = introSegments[segmentIndex];
  if (!message) return;

  push();
  textAlign(CENTER, CENTER);
  textSize(Math.max(18, Math.min(28, width * 0.025)));
  const boxWidth = Math.min(width * 0.72, 680);
  const boxHeight = 54;
  const boxX = width / 2 - boxWidth / 2;
  const boxY = groundY * 0.24;

  fill(20, 32, 48, 195);
  noStroke();
  rect(boxX, boxY, boxWidth, boxHeight, 14);

  fill("#ffffff");
  text(message, width / 2, boxY + boxHeight / 2);
  pop();
}

function drawWorld(groundY) {
  background("#a8e1f4");

  if (assets.bg && assets.bg.width > 0) {
    for (let i = 0; i < BG_REPEAT; i++) {
      const drawX = i * width - cameraX;
      if (drawX + width >= 0 && drawX <= width) {
        image(assets.bg, drawX, 0, width, height);
      }
    }
  }
}

function drawFish(groundY) {
  for (const enemy of fish) {
    const imageSheet = enemy.state === "happy" ? assets.happy : enemy.state === "sadge" ? assets.sadge : assets.fish;
    if (!imageSheet || !imageSheet.width) continue;
    const frameCount = enemy.state === "happy" ? 2 : enemy.state === "sadge" ? 4 : 5;
    const frame = enemy.state === "stop"
      ? Math.floor(millis() / 150) % frameCount
      : Math.floor(enemy.stateTime / enemy.animFrameDuration) % frameCount;
    const sourceWidth = imageSheet.width / frameCount;
    const sourceHeight = imageSheet.height;
    const scale = playerScale() * 0.78;
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const x = enemy.x - cameraX;
    image(imageSheet, x - drawWidth / 2, groundY - drawHeight, drawWidth, drawHeight,
      frame * sourceWidth, 0, sourceWidth, sourceHeight);
  }
}

function drawApples(dt, groundY) {
  for (const apple of apples) {
    apple.x += apple.vx * dt;
    apple.y += apple.vy * dt;
    apple.vy += 600 * dt;

    const size = appleSize();
    if (assets.apple && assets.apple.width) {
      image(assets.apple, apple.x - cameraX - size.width / 2, apple.y - size.height / 2, size.width, size.height);
    }

    for (const enemy of fish) {
      if (enemy.state !== "stop" || Math.abs(apple.x - enemy.x) > size.width * 0.55 + playerSize().width * 0.36) continue;
      if (Math.abs(apple.y - (groundY - playerSize().height * 0.25)) > size.height + playerSize().height * 0.34) continue;
      apple.remove = true;
      openQuiz(enemy);
      break;
    }
    if (apple.y > groundY || apple.x < cameraX - 100 || apple.x > cameraX + width + 100) apple.remove = true;
  }
  apples = apples.filter((apple) => !apple.remove);
}

function drawPlayer(groundY) {
  let sheet = assets.walk;
  let frameCount = 4;
  let frame = player.onGround ? Math.floor(player.walkClock) % frameCount : 0;

  if (attackTime > 0) {
    sheet = assets.hit;
    frameCount = 5;
    frame = Math.min(frameCount - 1, Math.floor((0.42 - attackTime) / 0.084));
  } else if (flying && !player.onGround) {
    sheet = assets.fly;
    frameCount = 7;
    frame = Math.floor(millis() / 100) % frameCount;
  } else if (!player.onGround) {
    sheet = assets.jump;
    frameCount = 7;
    frame = Math.min(frameCount - 1, Math.floor((1 - Math.abs(player.vy) / 510) * frameCount));
  } else if (runDirection !== null && pressed[runDirection < 0 ? "ArrowLeft" : "ArrowRight"]) {
    sheet = assets.run;
    frameCount = 8;
    frame = Math.floor(player.walkClock) % frameCount;
  }

  if (!sheet || !sheet.width) return;

  const frameWidth = sheet.width / frameCount;
  const frameHeight = sheet.height;
  const size = playerSize(frameWidth, frameHeight);
  const screenX = player.x - cameraX;
  const screenY = player.y - size.height / 2;

  push();
  translate(screenX, screenY);
  scale(attackTime > 0 ? -player.facing : player.facing, 1);
  image(sheet, -size.width / 2, -size.height / 2, size.width, size.height,
    frame * frameWidth, 0, frameWidth, frameHeight);
  pop();
}

function playerScale() {
  if (!assets.walk || !assets.walk.width) return 1;
  const frameWidth = assets.walk.width / 4;
  const frameHeight = assets.walk.height;
  return Math.sqrt((width * height / 20) / (frameWidth * frameHeight));
}

function playerSize(frameWidth = 40, frameHeight = 40) {
  if (assets.walk && assets.walk.width) {
    frameWidth = assets.walk.width / 4;
    frameHeight = assets.walk.height;
  }
  const area = width * height / 20;
  const scale = Math.sqrt(area / (frameWidth * frameHeight));
  return { width: frameWidth * scale, height: frameHeight * scale };
}

function appleSize() {
  const scale = playerScale() * 0.66;
  const w = assets.apple?.width || 30;
  const h = assets.apple?.height || 30;
  return { width: w * scale, height: h * scale };
}

function launchApple() {
  const size = playerSize();
  apples.push({
    x: player.x + attackDirection * size.width * 0.45,
    y: player.y - size.height * 0.48,
    vx: attackDirection * 570,
    vy: -290,
    remove: false
  });
}

function beginAttack() {
  if (quizFish || attackTime > 0 || !assets.hit || !assets.hit.width) return;
  attackDirection = player.facing;
  attackTime = 0.42;
  attackFired = false;
}

function jumpOrFly() {
  const now = performance.now();
  if (now - (lastTap.ArrowUp || 0) < 330) {
    flying = true;
    if (player.onGround) player.vy = -260;
  } else if (player.onGround) {
    player.vy = -510;
  }
  lastTap.ArrowUp = now;
}

function pressControl(control) {
  if (control === "attack") {
    beginAttack();
    return;
  }
  if (quizFish || pressed[control]) return;

  const now = performance.now();
  if ((control === "ArrowLeft" || control === "ArrowRight") && now - (lastTap[control] || 0) < 330) {
    runDirection = control === "ArrowLeft" ? -1 : 1;
  }
  if (control === "ArrowUp") jumpOrFly();
  pressed[control] = true;
  lastTap[control] = now;
}

function releaseControl(control) {
  pressed[control] = false;
  if ((control === "ArrowLeft" && runDirection === -1) || (control === "ArrowRight" && runDirection === 1)) {
    runDirection = null;
  }
}

function bindControls() {
  window.addEventListener("keydown", (event) => {
    const controls = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (controls.includes(event.key)) {
      event.preventDefault();
      if (!event.repeat) pressControl(event.key);
      return;
    }
    if (quizFish && /^[1-4]$/.test(event.key)) answerQuestion(Number(event.key) - 1);
    if ((event.key === " " || event.key.toLowerCase() === "z") && !event.repeat) beginAttack();
  });

  window.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow")) releaseControl(event.key);
  });
  window.addEventListener("blur", () => {
    Object.keys(pressed).forEach(releaseControl);
    runDirection = null;
  });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-active");
      pressControl(control);
    });
    const release = () => {
      button.classList.remove("is-active");
      if (control !== "attack") releaseControl(control);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  document.getElementById("game-stage").addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button === 0 && !event.target.closest("button")) beginAttack();
  });
}

function openQuiz(enemy) {
  quizFish = enemy;
  quizData = pendingQuizData ? { ...pendingQuizData, choices: [...pendingQuizData.choices] } : createQuestion(questionLevel);

  document.getElementById("question").textContent = `第 ${questionLevel} 題：${quizData.left} ${quizData.operator} ${quizData.right} = ?`;
  document.getElementById("quiz-feedback").textContent = "";
  document.getElementById("quiz-feedback").classList.remove("correct");

  const answers = document.getElementById("answers");
  answers.replaceChildren();
  quizData.choices.forEach((value, index) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.type = "button";
    button.textContent = value;
    button.setAttribute("aria-label", `選項 ${index + 1}：${value}`);
    button.addEventListener("click", () => answerQuestion(index));
    answers.append(button);
  });
  document.getElementById("quiz").hidden = false;
  document.getElementById("status").textContent = `答對數學題，通關冒險！（第 ${questionLevel} 題）`;
}

function createQuestion(level = 1) {
  const operator = random(questions);
  const maxNum = 9 + (level - 1) * 4;
  const minNum = Math.min(2 + Math.floor((level - 1) / 2), maxNum - 1);

  let left = Math.floor(random(minNum, maxNum + 1));
  let right = Math.floor(random(minNum, maxNum + 1));

  if (operator === "-" && right > left) {
    [left, right] = [right, left];
  }
  if (operator === "×") {
    const mulMax = Math.min(20, 9 + (level - 1) * 2);
    left = Math.floor(random(2, mulMax + 1));
    right = Math.floor(random(2, Math.min(12, 6 + level)));
  }

  const answer = operator === "+" ? left + right : operator === "-" ? left - right : left * right;
  const spread = Math.max(5, 4 + level * 2);
  const choices = new Set([answer]);
  while (choices.size < 4) {
    const offset = Math.floor(random(-spread, spread + 1)) || 2;
    choices.add(Math.max(0, answer + offset));
  }
  return { left, right, operator, answer, choices: shuffle([...choices]) };
}

function answerQuestion(index) {
  if (!quizData || !quizFish) return;
  const selected = Number(document.querySelectorAll(".answer-btn")[index]?.textContent);
  const targetFish = quizFish;
  targetFish.stateTime = 0;

  if (selected === quizData.answer) {
    score += 10 * questionLevel;
    questionLevel += 1;
    pendingQuizData = null;
    targetFish.state = "happy";
    document.getElementById("status").textContent = "答對了！恭喜通關！";
  } else {
    pendingQuizData = { ...quizData, choices: [...quizData.choices] };
    targetFish.state = "sadge";
    document.getElementById("status").textContent = "答錯了！";
  }

  quizFish = null;
  quizData = null;
  document.getElementById("quiz").hidden = true;
}

function updateHud() {
  if (frameCount - lastHudUpdate < 8) return;
  lastHudUpdate = frameCount;
  document.getElementById("score").textContent = score;
  document.getElementById("distance").textContent = Math.floor(Math.max(0, player.x - startX) / 100);
}

function resizeGame() {
  const stage = document.getElementById("game-stage");
  if (!stage || !stage.clientWidth || !stage.clientHeight) return;
  resizeCanvas(stage.clientWidth, stage.clientHeight);
  drawingContext.imageSmoothingEnabled = false;
  if (player && player.onGround) player.y = height * 0.75;
  if (fish.length > 0) {
    fish[0].x = width * (BG_REPEAT - 0.35);
  }
}

function windowResized() {
  resizeGame();
}