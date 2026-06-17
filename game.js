// Banana Chilanga — Platanus Hack 26
const W = 800, H = 600;
const CABINET_KEYS = {
  P1_U: ['w'], P1_D: ['s'], P1_L: ['a'], P1_R: ['d'],
  P1_1: ['u'], P1_2: ['i'], P1_3: ['o'], P1_4: ['j'], P1_5: ['k'], P1_6: ['l'],
  P2_U: ['ArrowUp'], P2_D: ['ArrowDown'], P2_L: ['ArrowLeft'], P2_R: ['ArrowRight'],
  P2_1: ['r'], P2_2: ['t'], P2_3: ['y'], P2_4: ['f'], P2_5: ['g'], P2_6: ['h'],
  START1: ['Enter', '1'], START2: ['2']
};
// Control remapping: W=jump, A=left, D=right, B1(u)=fireball, Enter=start/pause
// P1_U ('w') → saltar | P1_L ('a') → izq | P1_R ('d') → der | P1_1 ('u') → fireball

const GameState = {
  score: 0, highScore: 0, lives: 3,
  level: 0, powerState: 'plain', paused: false
};

// --- MOTOR DE SPRITES PIXEL ART ---
// 0: Transparente, 1: Negro (Bordes), 2: Amarillo, 3: Amarillo Claro (Brillo)
// 4: Blanco (Ojos), 5: Rojo (Tenis), 6: Café (Puntas)
const BANANA_PAL = [null, 0x000000, 0xFFCC00, 0xFFEE88, 0xFFFFFF, 0xE62222, 0x553311];

// Frame: Quieto (Idle)
const P_IDLE = [
  "00001110000",
  "00013331000",
  "00132222100",
  "00124124100", // Ojos
  "00122222100",
  "01121112110", // Brazos y boca
  "12122222121", // Manos
  "00122222100",
  "00122222100",
  "00016661000", // Base café
  "00010001000", // Piernas
  "00151015100"  // Tenis rojos
];

// Frame: Corriendo 1 (Piernas abiertas)
const P_RUN1 = [
  "00001110000",
  "00013331000",
  "00132222100",
  "00124124100",
  "00122222100",
  "01121112100", 
  "12122222110",
  "00122222121", 
  "00122222100",
  "00016661000",
  "00100001000", // Piernas separadas
  "01510001510"
];

// Frame: Corriendo 2 (Piernas cruzadas)
const P_RUN2 = [
  "00001110000",
  "00013331000",
  "00132222100",
  "00124124100",
  "00122222100",
  "00121112110", 
  "01122222121",
  "12122222100",
  "00122222100",
  "00016661000",
  "00010010000", // Piernas juntas/cruzadas
  "00015151000"
];

// ── Pure functions ──────────────────────────────────────────────────────────
function applyTransition(state, event) {
  if (event === 'powerup-sombrero') return 'sombrero';
  if (event === 'powerup-salsa') return 'salsa';
  if (state === 'salsa') return 'sombrero';
  if (state === 'sombrero') return 'plain';
  return 'plain';
}
function addScore(score, action) {
  const d = {coin:50, stomp:100, fireball:200, checkpoint:500};
  return Math.max(0, score + (d[action] || 0));
}
function isGameOver(lives) { return lives <= 0; }
function hitBlock(block) {
  if (block.used) return null;
  block.used = true;
  return block.contentType;
}
function damageBoss(boss) {
  if (boss.invulTimer > 0) return boss;
  boss.hp -= 1;
  boss.invulTimer = 1000;
  return boss;
}
function getBossSpeed(hp) { return hp <= 2 ? 250 : 150; }
function validateHighScore(v) {
  return (Number.isInteger(v) && v >= 0) ? v : 0;
}
function genTex(scene, key, map, palette, pxSize = 3) {
  const g = scene.make.graphics({x: 0, y: 0}, false);
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const c = parseInt(map[y][x]);
      if (c > 0) {
        g.fillStyle(palette[c]);
        g.fillRect(x * pxSize, y * pxSize, pxSize, pxSize);
      }
    }
  }
  g.generateTexture(key, map[0].length * pxSize, map.length * pxSize);
  g.destroy();
}

// ── StorageAdapter ──────────────────────────────────────────────────────────
// Req 8.6, 8.7, 10.7, 10.8: load persisted highScore; returns 0 on any error or invalid value
async function loadHighScore() {
  try {
    if (!window.platanusArcadeStorage) return 0;
    const r = await window.platanusArcadeStorage.get('banana-chilanga/highscore');
    if (r && r.found) return validateHighScore(r.value);
    return 0;
  } catch(e) { return 0; }
}
// Req 8.5, 10.7: update highScore in memory first, then persist; never throws
async function saveHighScore(score) {
  GameState.highScore = score;
  try {
    if (!window.platanusArcadeStorage) return;
    await window.platanusArcadeStorage.set('banana-chilanga/highscore', score);
  } catch(e) {}
}

// ── AudioManager ────────────────────────────────────────────────────────────
const _AC = new (window.AudioContext || window.webkitAudioContext)();
function _tone(f, t, d, v) {
  if (_AC.state === 'suspended') _AC.resume();
  const o = _AC.createOscillator(), g = _AC.createGain();
  o.type = t; o.frequency.setValueAtTime(f, _AC.currentTime);
  g.gain.setValueAtTime(v || 0.1, _AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, _AC.currentTime + d);
  o.connect(g); g.connect(_AC.destination);
  o.start(); o.stop(_AC.currentTime + d);
}
function playJump()    { _tone(400,'square',0.15,0.05); }
function playCoin()    { _tone(800,'sine',0.1,0.1); }
function playPowerUp() { _tone(600,'triangle',0.1); setTimeout(()=>_tone(1000,'triangle',0.2),100); }
function playDamage()  { _tone(150,'sawtooth',0.3,0.2); }
function playKill()    { _tone(600,'sawtooth',0.08,0.15); setTimeout(()=>_tone(200,'sawtooth',0.15,0.1),80); }
function playFireball(){ _tone(300,'sine',0.08,0.12); }
function playWin()     { [500,600,700,900].forEach((f,i)=>setTimeout(()=>_tone(f,'triangle',0.2),i*120)); }
function playDefeat()  { _tone(200,'sawtooth',0.5,0.25); setTimeout(()=>_tone(100,'sawtooth',0.5,0.25),300); }

// ── LEVELS data ─────────────────────────────────────────────────────────────
// Niveles remasterizados con plataformas tipo Mario - dinámicas y balanceadas
const LEVELS = [
  {
    id: 1, name: 'Cerca del Angel', width: 3200,
    bgKey: 'bg-tiles-1', bgTheme: 'streets',
    // Escalera progresiva al inicio, luego saltos dinámicos tipo Mario
    platforms: [
      { x: 1600, y: 572, w: 3200, h: 32, isGround: true }, // ground grueso
      // Escalera inicio - cada plataforma 60px más alta
      { x: 200,  y: 500, w: 160 }, { x: 400,  y: 440, w: 160 },
      { x: 600,  y: 380, w: 160 }, { x: 800,  y: 320, w: 160 },
      // Zona media - saltos horizontales con variación de altura
      { x: 1050, y: 280, w: 200 }, { x: 1350, y: 340, w: 160 },
      { x: 1600, y: 300, w: 180 }, { x: 1900, y: 360, w: 160 },
      // Sección desafiante
      { x: 2150, y: 280, w: 140 }, { x: 2400, y: 320, w: 160 },
      { x: 2650, y: 280, w: 120 }, { x: 2900, y: 360, w: 200 },
      // Plataforma bonus en altura
      { x: 1200, y: 180, w: 120 }
    ],
    enemies: [
      { type: 'taxi',      x: 400,  y: 420 }, { type: 'taxi', x: 750,  y: 300 },
      { type: 'policia',   x: 1200, y: 260 }, { type: 'taxi', x: 1600, y: 280 },
      { type: 'vendedor',  x: 2000, y: 340 }, { type: 'taxi', x: 2400, y: 300 },
      { type: 'policia',   x: 2800, y: 340 }
    ],
    coins: [
      { x: 200,  y: 470 }, { x: 400,  y: 410 }, { x: 600,  y: 350 }, { x: 800,  y: 290 },
      { x: 1050, y: 250 }, { x: 1350, y: 310 }, { x: 1600, y: 270 }, { x: 1900, y: 330 },
      { x: 2400, y: 290 }, { x: 2900, y: 330 }, { x: 1200, y: 150 }
    ],
    qblocks: [
      // ~130px encima del tope de su plataforma — requiere saltar para golpear
      { x: 300,  y: 380, content: 'coin' },             // sobre suelo (ground top=556, bloque a 376)
      { x: 600,  y: 248, content: 'powerup-sombrero' }, // sobre plataforma y=380
      { x: 1000, y: 148, content: 'coin' },             // sobre plataforma y=280
      { x: 1700, y: 168, content: 'powerup-salsa' },    // sobre plataforma y=300
      { x: 2150, y: 148, content: 'coin' },             // sobre plataforma y=280
      { x: 2650, y: 148, content: 'powerup-sombrero' }  // sobre plataforma y=280
    ],
    checkpointX: 3050
  },
  {
    id: 2, name: 'Mercado de Tepito', width: 3200,
    bgKey: 'bg-tiles-2', bgTheme: 'market',
    // Plataformas agrupadas tipo "puestos" con escalera central
    platforms: [
      { x: 1600, y: 572, w: 3200, h: 32, isGround: true }, // ground grueso
      // Cluster bajo izquierdo (puestos iniciales)
      { x: 250,  y: 480, w: 160 }, { x: 480,  y: 480, w: 160 }, { x: 710,  y: 480, w: 160 },
      // Escalera central subiendo
      { x: 350,  y: 400, w: 160 }, { x: 550,  y: 340, w: 160 }, { x: 750,  y: 280, w: 160 },
      // Cima - plataformas altas
      { x: 1000, y: 240, w: 180 }, { x: 1300, y: 200, w: 160 }, { x: 1600, y: 240, w: 180 },
      // Descenso en espejo hacia la derecha
      { x: 1850, y: 280, w: 160 }, { x: 2050, y: 340, w: 160 }, { x: 2250, y: 400, w: 160 },
      // Plataformas finales
      { x: 2500, y: 360, w: 180 }, { x: 2800, y: 320, w: 160 }
    ],
    enemies: [
      { type: 'vendedor', x: 350,  y: 460 }, { type: 'taxi',      x: 600,  y: 460 },
      { type: 'policia',  x: 850,  y: 460 }, { type: 'vendedor',  x: 500,  y: 320 },
      { type: 'taxi',     x: 1200, y: 220 }, { type: 'policia',   x: 1600, y: 220 },
      { type: 'vendedor', x: 2000, y: 320 }, { type: 'taxi',      x: 2700, y: 300 }
    ],
    coins: [
      { x: 250,  y: 450 }, { x: 480,  y: 450 }, { x: 710,  y: 450 }, { x: 350,  y: 370 },
      { x: 550,  y: 310 }, { x: 750,  y: 250 }, { x: 1000, y: 210 }, { x: 1600, y: 210 },
      { x: 2050, y: 310 }, { x: 2800, y: 290 }
    ],
    qblocks: [
      { x: 350,  y: 268, content: 'coin' },             // sobre plataforma y=400
      { x: 600,  y: 208, content: 'powerup-sombrero' }, // sobre plataforma y=340
      { x: 1000, y: 108, content: 'coin' },             // sobre plataforma y=240
      { x: 1300, y:  68, content: 'powerup-salsa' },    // sobre plataforma y=200 (alta)
      { x: 1850, y: 148, content: 'coin' },             // sobre plataforma y=280
      { x: 2500, y: 228, content: 'powerup-sombrero' }  // sobre plataforma y=360
    ],
    checkpointX: 3050
  },
  {
    id: 3, name: 'Metro Copilco', width: 3200,
    bgKey: 'bg-tiles-3', bgTheme: 'metro',
    // Vagones del metro con saltos precisos (más difícil)
    platforms: [
      { x: 1600, y: 572, w: 3200, h: 32, isGround: true }, // ground grueso/andén
      // Primera línea de vagones
      { x: 200,  y: 480, w: 150 }, { x: 420,  y: 420, w: 150 }, { x: 640,  y: 360, w: 150 },
      // Segunda línea alternada
      { x: 310,  y: 340, w: 130 }, { x: 530,  y: 300, w: 130 }, { x: 750,  y: 260, w: 130 },
      // Zona central de transbordo
      { x: 920,  y: 240, w: 160 }, { x: 1150, y: 280, w: 160 }, { x: 1380, y: 240, w: 160 },
      // Tercera línea
      { x: 1600, y: 300, w: 130 }, { x: 1820, y: 260, w: 130 }, { x: 2040, y: 300, w: 130 },
      // Cuarta línea
      { x: 1700, y: 400, w: 150 }, { x: 1920, y: 360, w: 150 }, { x: 2140, y: 320, w: 150 },
      // Plataformas finales
      { x: 2450, y: 280, w: 170 }, { x: 2750, y: 340, w: 170 }
    ],
    enemies: [
      { type: 'policia',   x: 350,  y: 400 }, { type: 'taxi',      x: 550,  y: 340 },
      { type: 'vendedor',  x: 800,  y: 240 }, { type: 'policia',   x: 1100, y: 260 },
      { type: 'taxi',      x: 1400, y: 220 }, { type: 'vendedor',  x: 1750, y: 380 },
      { type: 'policia',   x: 2050, y: 280 }, { type: 'taxi',      x: 2400, y: 260 },
      { type: 'vendedor',  x: 2800, y: 320 }
    ],
    coins: [
      { x: 200,  y: 450 }, { x: 420,  y: 390 }, { x: 640,  y: 330 }, { x: 310,  y: 310 },
      { x: 530,  y: 270 }, { x: 920,  y: 210 }, { x: 1600, y: 270 }, { x: 2040, y: 270 },
      { x: 2450, y: 250 }, { x: 2750, y: 310 }
    ],
    qblocks: [
      { x: 420,  y: 288, content: 'coin' },             // sobre plataforma y=420
      { x: 750,  y: 128, content: 'powerup-sombrero' }, // sobre plataforma y=260
      { x: 1150, y: 148, content: 'coin' },             // sobre plataforma y=280
      { x: 1500, y: 108, content: 'powerup-salsa' },    // sobre plataforma y=240
      { x: 2040, y: 168, content: 'coin' },             // sobre plataforma y=300
      { x: 2450, y: 148, content: 'powerup-sombrero' }  // sobre plataforma y=280
    ],
    checkpointX: 3050
  }
];

// ── PlayerController ────────────────────────────────────────────────────────

// 6.1 — Create player sprite with full Arcade physics config (Req 3.1, 4.1, 4.2, 4.4)
function createPlayer(scene, x, y) {
  const p = scene.physics.add.sprite(x, y, 'banana');
  p.setOrigin(0.5, 1);
  p.setCollideWorldBounds(true);
  p.setDisplaySize(28, 46);
  // Physics body: slightly narrower than display, no vertical offset to avoid tunneling
  p.body.setSize(22, 45);
  p.body.setOffset(3, 3);
  // Cap vertical speed to prevent tunneling through thin platforms
  p.body.setMaxVelocity(200, 550);
  // Use checkCollision.up = true so hitting blocks from below works
  p.body.checkCollision.up = true;
  p.setDragX(1200);
  p.setBounceY(0);
  p.powerState = 'plain';
  p.lastDir = 'right';
  p.invulTimer = 0;
  p.fireballCount = 0;
  p._wasOnGround = false;
  p._stretchTween = null;
  p._squashTween = null;
  return p;
}

function _keyDown(keys) {
  for (const k in keys) { if (keys[k].isDown) return true; }
  return false;
}
function _keyJustDown(keys) {
  for (const k in keys) { if (Phaser.Input.Keyboard.JustDown(keys[k])) return true; }
  return false;
}

// Helper: restores exact physics body to match current power state after tween
function _restorePlayerBody(player) {
  const s = player.powerState || 'plain';
  if (s === 'sombrero') {
    player.setDisplaySize(32, 52);
    player.body.setSize(24, 56);
    player.body.setOffset(4, 4);
  } else if (s === 'salsa') {
    player.setDisplaySize(40, 62);
    player.body.setSize(24, 56);
    player.body.setOffset(10, 10);
  } else {
    player.setDisplaySize(28, 46);
    player.body.setSize(22, 45);
    player.body.setOffset(3, 3);
  }
}

// 6.2 — Handle horizontal movement, jump, stretch and squash animations (Req 4.1–4.3, 4.5–4.7)
function handleInput(scene, player, keys, delta) {
  // Use blocked.down — more reliable than touching.down in arcade physics
  const onGround = player.body.blocked.down;
  let jumped = false;

  // Horizontal movement: accel 2000 px/s², max 200 px/s via body.setMaxVelocity
  if (_keyDown(keys.left)) {
    player.setAccelerationX(-2000);
    player.setFlipX(true);
    player.lastDir = 'left';
  } else if (_keyDown(keys.right)) {
    player.setAccelerationX(2000);
    player.setFlipX(false);
    player.lastDir = 'right';
  } else {
    player.setAccelerationX(0);
  }

  // ── INICIO LÓGICA DE ANIMACIÓN (PIXEL ART) ──
    const state = player.powerState || 'plain';
  if (onGround) {
    if (Math.abs(player.body.velocity.x) > 15) {
      player.anims.play('run_' + state, true);
    } else {
      player.anims.play('idle_' + state, true);
    }
  } else {
    player.anims.stop();
    player.setTexture(state === 'plain' ? 'banana_r1' : 'banana-' + state + '_r1');
  }
  // ── FIN LÓGICA DE ANIMACIÓN ──

  // Jump from ground
  if (onGround && _keyJustDown(keys.jump)) {
    player.setVelocityY(-450);
    if (player._stretchTween) { player._stretchTween.stop(); _restorePlayerBody(player); }
    const bw = player.powerState === 'salsa' ? 40 : (player.powerState === 'sombrero' ? 32 : 28);
    const bh = player.powerState === 'salsa' ? 62 : (player.powerState === 'sombrero' ? 52 : 46);
    player._stretchTween = scene.tweens.add({
      targets: player,
      displayWidth: bw * 0.8, displayHeight: bh * 1.15,
      duration: 70, ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => { _restorePlayerBody(player); }
    });
    playJump();
    jumped = true;
  }

  // Squash on landing
  if (onGround && !player._wasOnGround) {
    if (player._squashTween) { player._squashTween.stop(); _restorePlayerBody(player); }
    const bw = player.powerState === 'salsa' ? 40 : (player.powerState === 'sombrero' ? 32 : 28);
    const bh = player.powerState === 'salsa' ? 62 : (player.powerState === 'sombrero' ? 52 : 46);
    player._squashTween = scene.tweens.add({
      targets: player,
      displayWidth: bw * 1.25, displayHeight: bh * 0.8,
      duration: 80, ease: 'Sine.easeOut',
      yoyo: true,
      onComplete: () => { _restorePlayerBody(player); }
    });
  }

  player._wasOnGround = onGround;
  return { jumped };
}
// 6.3 — Adjust visual size and texture per PowerState (Req 2.2, 3.1, 3.2, 3.4, 3.7, 3.8)
// Textures already embed the sombrero/bigote (banana-sombrero) and aura roja (banana-salsa)
// generated in BootScene — switching texture is sufficient for procedural visuals.
function applyPowerState(scene, player, state) {
  player.powerState = state;
  GameState.powerState = state;
  if (state === 'plain') {
    player.setTexture('banana');
    player.setDisplaySize(28, 46);
    player.body.setSize(22, 45);
    player.body.setOffset(3, 3);
  } else if (state === 'sombrero') {
    player.setTexture('banana-sombrero');
    player.setDisplaySize(32, 52);
    player.body.setSize(24, 56);
    player.body.setOffset(4, 4);
  } else if (state === 'salsa') {
    player.setTexture('banana-salsa');
    player.setDisplaySize(40, 62);
    player.body.setSize(24, 56);
    player.body.setOffset(10, 10);
  }
}

// 6.4 — Damage: downgrade PowerState; plain → lose 1 life + 2s invul at 8 Hz blink (Req 3.7–3.9, 8.8)
function takeDamage(scene, player) {
  if (player.invulTimer > 0) return { lostLife: false, newState: player.powerState };
  const prevState = player.powerState;
  const newState = applyTransition(prevState, 'damage');
  let lostLife = false;

  if (prevState === 'plain') {
    // plain → lose 1 life, 2s invulnerability, blink at 8 Hz (8 full cycles/s = 16 half-cycles)
    lostLife = true;
    player.invulTimer = 2000;
    // Each half-cycle: 2000ms / 32 half-steps = 62.5ms → 8 full cycles per second
    scene.tweens.add({
      targets: player,
      alpha: 0,
      duration: 62,
      yoyo: true,
      repeat: 15,
      onComplete: () => { player.clearTint(); player.alpha = 1; }
    });
    player.setTint(0xFF4444);
  } else {
    // sombrero/salsa → downgrade, brief invul to prevent chain damage
    applyPowerState(scene, player, newState);
    player.invulTimer = 1500;
    // Flash red briefly to signal damage
    player.setTint(0xFF4444);
    scene.time.delayedCall(300, () => { if (player.active) player.clearTint(); });
  }

  playDamage();
  return { lostLife, newState };
}

// 6.5 — Spawn fireball sprite; count bounces; destroy on 3rd bounce or wall hit (Req 3.5, 3.6, 3.10)
function spawnFireballSprite(scene, player) {
  if ((player.fireballCount || 0) >= 3) return null;
  if (!scene._fireballs) scene._fireballs = scene.physics.add.group();
  
  const fb = scene._fireballs.create(player.x, player.y - 25, 'fireball');
  fb.setVelocityX(player.lastDir === 'right' ? 300 : -300);
  fb.setBounce(1, 0.6);
  fb.setGravityY(300);
  fb.setCollideWorldBounds(true);
  fb.bounceCount = 0;
  fb._destroyed = false;
  player.fireballCount = (player.fireballCount || 0) + 1;
  if (scene._platforms) scene.physics.add.collider(fb, scene._platforms);

  const fbUpdate = scene.time.addEvent({
    delay: 16, loop: true,
    callback: () => {
      if (!fb || !fb.active || fb._destroyed) { fbUpdate.remove(); return; }
      const bod = fb.body;
      const hitWall = bod.blocked.left || bod.blocked.right || bod.touching.left || bod.touching.right;
      const hitFloor = bod.blocked.down || bod.touching.down;

      if (hitWall) {
        fb._destroyed = true; fb.destroy(); player.fireballCount--; fbUpdate.remove(); return;
      }
      if (hitFloor && !fb._prevOnFloor) {
        fb.bounceCount++;
        if (fb.bounceCount >= 3) {
          fb._destroyed = true; fb.destroy(); player.fireballCount--; fbUpdate.remove(); return;
        }
      }
      fb._prevOnFloor = !!hitFloor;
      if (fb.y > scene.physics.world.bounds.height + 50) {
        fb._destroyed = true; fb.destroy(); player.fireballCount--; fbUpdate.remove();
      }
    }
  });
  return fb;
}

// ── LevelBuilder ────────────────────────────────────────────────────────────

// 7.2 — Draw themed background with Graphics detail layers on top of the bg texture (Req 6.2)
// The base bg textures (bg-tiles-1/2/3) are generated in BootScene.
// This function adds per-level parallax detail via Graphics objects.
function _buildBackground(scene, ld) {
  const lw = ld.width;

  // Base scrolling background tile (800×600 texture repeats seamlessly)
  scene.add.tileSprite(lw / 2, H / 2, lw, H, ld.bgKey).setScrollFactor(0.5);

  if (ld.bgTheme === 'streets') {
    // Ángel de la Independencia — silueta grande y detallada (scrollFactor 0.3)
    const ax = lw * 0.35;
    const angel = scene.add.graphics().setScrollFactor(0.3).setDepth(-1);
    const af=(c,a=1)=>angel.fillStyle(c,a), ar=(x,y,w,h)=>angel.fillRect(x,y,w,h), ac=(x,y,rad)=>angel.fillCircle(x,y,rad), at=(x1,y1,x2,y2,x3,y3)=>angel.fillTriangle(x1,y1,x2,y2,x3,y3);
    
    // Base escalonada y columna (Día)
    af(0xC8A966); ar(ax-78, 546, 156, 8);
    af(0xD4B872); ar(ax-62, 538, 124, 8);
    af(0xDEC47C); ar(ax-48, 530, 96, 8);
    af(0xD0AA55); ar(ax-30, 490, 60, 40);
    af(0xBB9944); ar(ax-30, 490, 5, 40);
    af(0xD4AA4A); ar(ax-11, 320, 22, 170);
    af(0xC49A3A); ar(ax-11, 320, 5, 170);
    af(0xE4BA5A); ar(ax+6, 320, 5, 170);
    af(0xEAC060); ar(ax-20, 308, 40, 14);
    af(0xF0D060); ac(ax, 280, 14);
    at(ax-18, 310, ax+18, 310, ax, 274);
    af(0xFFE070,0.95);
    at(ax-56, 285, ax-13, 294, ax-8, 312);
    at(ax+56, 285, ax+13, 294, ax+8, 312);
    af(0xFFFF44,0.95); ac(ax, 263, 7);
    af(0xFFFFAA,0.75); ac(ax, 253, 4);

    // Estadio Azteca — al fondo derecho (scrollFactor 0.25)
    const sx = lw * 0.72;
    const estadio = scene.add.graphics().setScrollFactor(0.25).setDepth(-2);
    const ef=(c,a=1)=>estadio.fillStyle(c,a), er=(x,y,w,h)=>estadio.fillRect(x,y,w,h);
    
    // Bowl/graderías — arcos simulados con rectángulos (Día)
    ef(0xA0B0C0,0.9); // Color claro concreto
    for(let i=0;i<10;i++){
      const rx=sx-90+i*20;
      const rh=20+Math.sin((i/9)*Math.PI)*50;
      er(rx, 530-rh, 16, rh);
    }
    // Interior del estadio
    ef(0x4A8C4A,0.8); // Verde pasto
    er(sx-70, 530, 140, 18);
    // Borde superior (techo parcial)
    ef(0x8090A0,0.9);
    er(sx-95, 528, 190, 6);
    // Base / estacionamiento
    ef(0x708090,0.8);
    er(sx-85, 548, 170, 14);
    // Letrero "AZTECA"
    ef(0x3B72B8,0.8); // Letras azules
    er(sx-20, 534, 40, 6);
  } else if (ld.bgTheme === 'market') {
    // Mercado parallax layer: toldos gigantes con depth negativo para evitar traslapes
    const g = scene.add.graphics().setScrollFactor(0.85).setDepth(-2);
    const f=(c,a=1)=>g.fillStyle(c,a), tr=(x1,y1,x2,y2,x3,y3)=>g.fillTriangle(x1,y1,x2,y2,x3,y3);
    const tc = [0x00B050, 0xFFCC00, 0x0066FF, 0xFF3366];
    for(let tx = -200; tx < lw+200; tx += 300) {
      f(tc[Math.abs((tx/300)|0) % tc.length], 0.95);
      tr(tx, 650, tx+400, 450, tx+200, 800);
      f(0x000000, 0.15);
      tr(tx+200, 450, tx+400, 450, tx+200, 800);
    }
    // Sun glow
    g.fillStyle(0xFFDD00,0.15); g.fillCircle(lw/2, 80, 100);

  } else if (ld.bgTheme === 'metro') {
    // Metro: vagón naranja pasando por enfrente del mural (pero detrás del nivel para no interferir)
    const g = scene.add.graphics().setScrollFactor(0.6).setDepth(-2);
    const f=(c,a=1)=>g.fillStyle(c,a), r=(x,y,w,h)=>g.fillRect(x,y,w,h);
    
    // Dibujar varios vagones unidos
    for(let cx = -100; cx < lw + 800; cx += 400) {
      // Cuerpo del vagón naranja
      f(0xDD5511); r(cx, 440, 380, 200);
      f(0xCC4400); r(cx, 440, 380, 15); // Borde superior del vagón
      // Ventanas oscuras
      f(0x111111);
      r(cx+20, 480, 60, 60); r(cx+100, 480, 60, 60);
      r(cx+220, 480, 60, 60); r(cx+300, 480, 60, 60);
      // Puertas
      f(0x222222); r(cx+170, 470, 40, 130);
      f(0x888888); r(cx+188, 470, 4, 130); // División puerta
    }

    // Pilares adicionales del metro (scrollFactor diferente para más profundidad)
    const p = scene.add.graphics().setScrollFactor(0.8).setDepth(-1);
    const pf=(c,a=1)=>p.fillStyle(c,a), pr=(x,y,w,h)=>p.fillRect(x,y,w,h);
    pf(0x111111);
    for(let px = 200; px < lw; px += 350) {
      pr(px, 100, 40, 340);
      pf(0x333333); pr(px+2, 100, 36, 10); pr(px+2, 430, 36, 10);
      pf(0x111111);
    }
    
    // Luces de neón intermitentes en el techo
    scene._neonLights = [];
    for(let lx = 120; lx < lw; lx += 180) {
      const nl = scene.add.rectangle(lx, 50, 60, 8, 0xFFFFCC, 0.8)
        .setScrollFactor(0.8).setDepth(-1);
      scene._neonLights.push(nl);
    }
  }
}

// Called from GameScene.update to animate beam reflectors (streets theme)
function _updateBeams(scene, time) {
  if (!scene._beams) return;
  const t = time * 0.001; // convert ms to seconds
  scene._beams.forEach(b=>{
    const angle = Math.PI * 0.5 + Math.sin(t * b.speed * 1000 + b.phase) * 0.55;
    b.gfx.clear();
    const len = 600;
    const ex = b.x + Math.cos(angle) * len;
    const ey = H    - Math.sin(angle) * len;
    b.gfx.fillStyle(b.color, 0.07);
    b.gfx.fillTriangle(b.x-5, H, b.x+5, H, ex, ey);
    b.gfx.fillStyle(b.color, 0.04);
    b.gfx.fillTriangle(b.x-12, H, b.x+12, H, ex-8, ey);
  });
}

// 7.3 — Build level: static platforms, coins, QBlocks, Checkpoint,
//        world bounds, and camera follow if player provided (Req 6.3, 6.4, 6.7, 6.8)
function _buildLevel(scene, ld, player) {
  // Platforms (static group) — use ground texture for ground, platform for the rest
  const platforms = scene.physics.add.staticGroup();
  ld.platforms.forEach(p => {
    const texKey = p.isGround ? 'ground' : 'platform';
    const sp = platforms.create(p.x, p.y, texKey);
    sp.setDisplaySize(p.w || 80, p.h || 20);
    sp.setImmovable(true);
    sp.refreshBody();
  });

  // Coins (≥ 8 per level, static group)
  const coins = scene.physics.add.staticGroup();
  ld.coins.forEach(c => { coins.create(c.x, c.y, 'coin'); });

  // QuestionBlocks — bigger (26×26) and tagged with used flag and contentType
  const qblocks = scene.physics.add.staticGroup();
  ld.qblocks.forEach(q => {
    const b = qblocks.create(q.x, q.y, 'qblock').setDisplaySize(26, 26);
    b.used = false;
    b.contentType = q.content;
    b.setImmovable(true);
    b.refreshBody();
  });

  // Checkpoint (single parada de microbús at end of level)
  const checkpoint = scene.physics.add.staticGroup();
  checkpoint.create(ld.checkpointX, 545, 'checkpoint');

  // World and camera bounds set to full level width
  scene.physics.world.setBounds(0, 0, ld.width, H);
  scene.cameras.main.setBounds(0, 0, ld.width, H);

  // Increase physics tile bias to prevent tunneling at high speeds
  scene.physics.world.TILE_BIAS = 32;

  // Camera follows player if provided (Req 6.7)
  if (player) {
    scene.cameras.main.startFollow(player, true, 0.1, 0.1);
  }

  return { platforms, coins, qblocks, checkpoint };
}

// ── EnemyManager ────────────────────────────────────────────────────────────
// Improved enemy system with taxi, policía, vendedor types
function _spawnEnemies(scene, ld, platforms) {
  const enemies = scene.physics.add.group();
  function _platformBounds(ex) {
    let best = null, bestDist = Infinity;
    ld.platforms.forEach(p => {
      const hw = (p.w || 80) / 2;
      const pl = p.x - hw, pr = p.x + hw;
      if (ex >= pl - 40 && ex <= pr + 40) {
        const d = Math.abs(ex - p.x);
        if (d < bestDist) { bestDist = d; best = { left: pl, right: pr }; }
      }
    });
    return best || { left: 0, right: ld.width };
  }
  ld.enemies.forEach(ed => {
    const e = scene.physics.add.sprite(ed.x, ed.y, ed.type);
    e.setCollideWorldBounds(true);
    e.eType = ed.type;
    e.eDir = Math.random() > 0.5 ? 1 : -1;
    scene.physics.add.collider(e, platforms, () => {
      if (e.body.blocked.right && e.eDir > 0) e.eDir = -1;
      if (e.body.blocked.left  && e.eDir < 0) e.eDir =  1;
    });

    if (ed.type === 'taxi' || ed.type === 'microbus') {
      e.eSpeed = Phaser.Math.Between(ed.type==='taxi'?120:100, 150);
      const b = _platformBounds(ed.x);
      e.ePlatLeft = b.left + (ed.type==='taxi'?25:28);
      e.ePlatRight = b.right - (ed.type==='taxi'?25:28);
    } else if (ed.type === 'policia') {
      e.eSpeed = 110;
      e.eWanderTimer = Phaser.Math.Between(1200, 2200);
      e.eChaseTimer = 0;
    } else if (ed.type === 'vendedor') {
      e.eSpeed = Phaser.Math.Between(60, 90);
      e.eWanderTimer = Phaser.Math.Between(1500, 2500);
    } else { // chilango
      e.eSpeed = 110;
      e.eWanderTimer = Phaser.Math.Between(1000, 2000);
    }
    enemies.add(e);
  });
  return enemies;
}

function _emitKillParticles(scene, x, y) {
  const em = scene.add.particles(x, y, 'particle', {
    speed:{min:50,max:150}, scale:{start:1.5,end:0}, alpha:{start:1,end:0},
    tint:0xFFD700, lifespan:400, quantity:10
  });
  scene.time.delayedCall(500, () => { if(em && em.active) em.destroy(); });
}

// 8.3 — Collision callbacks (Req 5.5, 5.6, 5.7, 5.8)
function _onEnemyStomp(scene, player, enemy) {
  if (!enemy.active) return;
  // Req 5.5: player velocity.y >= 0 (falling or zero) + contact from above
  enemy.disableBody(true, true);
  GameState.score = addScore(GameState.score, 'stomp');
  player.setVelocityY(-300);
  playKill();
  _emitKillParticles(scene, enemy.x, enemy.y);
}

function _onFireballHit(scene, fireball, enemy, player) {
  if (!enemy.active || !fireball.active || fireball._destroyed) return;
  _emitKillParticles(scene, enemy.x, enemy.y);
  enemy.disableBody(true, true);
  fireball._destroyed = true;
  fireball.destroy();
  player.fireballCount--;
  GameState.score = addScore(GameState.score, 'fireball');
  playKill();
}

// ── GLOBAL PAUSE MENU ───────────────────────────────────────────────────────
function togglePauseMenu(scene) {
  if (!scene._paused) {
    scene._paused = true; GameState.paused = true; scene.physics.pause();
    scene._pSel = 0;
    scene._po = scene.add.rectangle(400,300,800,600,0,.7).setScrollFactor(0).setDepth(50);
    const ts = (y,t,s,c) => scene.add.text(400,y,t,{fontSize:s+'px',fill:c,stroke:'#000',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0).setDepth(51);
    scene._pt = ts(240,'PAUSA',48,'#FFD700');
    scene._po0 = ts(310,'REANUDAR',28,'#FFF');
    scene._po1 = ts(360,'SALIR AL MENU',28,'#FFF');
    updatePauseMenu(scene);
  } else {
    scene._paused = false; GameState.paused = false; scene.physics.resume();
    [scene._po, scene._pt, scene._po0, scene._po1].forEach(e => { if(e) e.destroy(); });
  }
}
function updatePauseMenu(scene) {
  if (!scene._paused) return;
  scene._po0.setText(scene._pSel===0 ? '> REANUDAR <' : '  REANUDAR  ').setFill(scene._pSel===0 ? '#FFD700' : '#FFF');
  scene._po1.setText(scene._pSel===1 ? '> SALIR AL MENU <' : '  SALIR AL MENU  ').setFill(scene._pSel===1 ? '#FFD700' : '#FFF');
}
function handlePauseInput(scene) {
  const k = scene._keys;
  if (_keyJustDown(k.jump) || _keyJustDown(k.down) || _keyJustDown(k.left) || _keyJustDown(k.right)) {
    scene._pSel = 1 - scene._pSel; updatePauseMenu(scene);
  }
  if (_keyJustDown(k.fire) || _keyJustDown(scene._sk1)) {
    if (scene._pSel === 0) togglePauseMenu(scene);
    else { scene.physics.resume(); GameState.score=0; GameState.lives=3; GameState.powerState='plain'; scene.scene.start('Menu'); }
  }
}

// ── HUD ─────────────────────────────────────────────────────────────────────
function _buildHUD(scene) {
  scene.add.rectangle(0, 0, 800, 50, 0x000000, 0.7).setOrigin(0,0).setScrollFactor(0).setDepth(9);
  const st = {fontSize:'24px', fontStyle: 'bold', fill:'#FFD700', stroke:'#222', strokeThickness:5, shadow: {offsetX: 2, offsetY: 2, color: '#000', blur: 0, fill: true}};
  const stWhite = { ...st, fill: '#FFFFFF' };
  
  scene.add.text(20, 12, 'P1', st).setScrollFactor(0).setDepth(10);
  scene._hudLifeIcons = [];
  for (let i = 0; i < 3; i++) {
    const icon = scene.add.image(70 + i * 28, 25, 'banana')
      .setDisplaySize(20, 26)
      .setScrollFactor(0)
      .setDepth(10)
      .setOrigin(0.5, 0.5);
    scene._hudLifeIcons.push(icon);
  }
  
  scene._hudScore = scene.add.text(400, 12, 'SCORE: 0', stWhite).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10);
  scene._hudHigh  = scene.add.text(780, 12, 'BEST: 0', st).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
}

function _updateHUD(scene) {
  scene._hudScore.setText('SCORE: ' + String(GameState.score).padStart(5, '0'));
  if (scene._hudLifeIcons) {
    scene._hudLifeIcons.forEach((icon, i) => { icon.setVisible(i < GameState.lives); });
  }
  scene._hudHigh.setText('BEST: ' + String(GameState.highScore).padStart(5, '0'));
}

// ── BootScene ───────────────────────────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  
  // 1. Tu función original para vectores (fondos, items, enemigos simples)
  _t(key,w,h,fn){ const g=this.add.graphics(); const f=(c,a=1)=>g.fillStyle(c,a), r=(x,y,w,h)=>g.fillRect(x,y,w,h), c=(x,y,rad)=>g.fillCircle(x,y,rad), t=(x1,y1,x2,y2,x3,y3)=>g.fillTriangle(x1,y1,x2,y2,x3,y3); fn(g,f,r,c,t); g.generateTexture(key,w,h); g.destroy(); }
  
  // 2. NUEVA: Función de Pixel Art para personajes detallados
  _px(key, map, pal) {
    const px = 3; // Tamaño del "pixel"
    const w = map[0].length * px;
    const h = map.length * px;
    const g = this.add.graphics();
    map.forEach((row, y) => {
      for(let x=0; x<row.length; x++) {
        const cVal = parseInt(row[x], 16);
        if(cVal > 0) { g.fillStyle(pal[cVal]); g.fillRect(x*px, y*px, px, px); }
      }
    });
    g.generateTexture(key, w, h);
    g.destroy();
  }

  create() {
    const t = this._t.bind(this);
    const px = this._px.bind(this);
    
    // ── 1. BANANA PIXEL ART Y ANIMACIONES ─────────────────────────────────
    const PAL = [null, 0x000000, 0xFFCC00, 0xDDAA00, 0xFFFFFF, 0x55AA33, 0x8B4513, 0xFF0000, 0xFF8800, 0xEEDD88, 0x00AA00];
    const M_IDLE = [
      "00000001110000000",
      "00000016551000000",
      "00000122225100000",
      "00001222223100000",
      "00001212213100000",
      "00001242243100000",
      "00011000000110000",
      "00111111111111000",
      "00011111111110000",
      "01221222223122100",
      "01221222223122100",
      "00110122233101100",
      "00000125533100000",
      "00000011111000000",
      "00000121012100000",
      "00001221012210000",
      "00001111011110000"
    ];
    const M_RUN1 = [
      "00000001110000000",
      "00000016551000000",
      "00000122225100000",
      "00001222223100000",
      "00001212213100000",
      "00001242243100000",
      "00011000000110000",
      "00111111111111000",
      "00011111111110000",
      "01221222223122100",
      "01221222223122100",
      "00110122233101100",
      "00000125533100000",
      "00000011111000000",
      "00000121000000000",
      "00001221000000000",
      "00001111000000000"
    ];
    const M_RUN2 = [
      "00000001110000000",
      "00000016551000000",
      "00000122225100000",
      "00001222223100000",
      "00001212213100000",
      "00001242243100000",
      "00011000000110000",
      "00111111111111000",
      "00011111111110000",
      "01221222223122100",
      "01221222223122100",
      "00110122233101100",
      "00000125533100000",
      "00000011111000000",
      "00000000012100000",
      "00000000122100000",
      "00000000111100000"
    ];
    const M_SOMB = [
      "00000011111000000",
      "00000199999100000",
      "00000199999100000",
      "00111177777111100",
      "014A74A74A74A7410",
      "11111111111111111",
      "00001222223100000",
      "00001212213100000",
      "00001242243100000",
      "00011000000110000",
      "00111111111111000",
      "00011111111110000",
      "01221222223122100",
      "01221222223122100",
      "00110122233101100",
      "00000125533100000",
      "00000011111000000",
      "00000121012100000",
      "00001221012210000",
      "00001111011110000"
    ];
    const M_SALSA = [
      "000000800800880000000",
      "000000077777778800000",
      "000008771111177800000",
      "008000719999917080800",
      "088877719999917777880",
      "887711117777711117708",
      "08814A74A74A74A741770",
      "871111111111111111188",
      "877777122222317778778",
      "008007121221317088008",
      "000877124224317708000",
      "008771177777811770000",
      "088711111111111178000",
      "087771111111111787800",
      "007122122222312217800",
      "007122122222312217000",
      "087711712223318117000",
      "008777712553317777800",
      "000800871111177800800",
      "000087712171217780000",
      "000007122171221800000",
      "000087111171111780000",
      "000008777877777800000",
      "000080800088080800000"
    ];
    const M_SOMB_R1 = [
      "00000011111000000",
      "00000199999100000",
      "00000199999100000",
      "00111177777111100",
      "014A74A74A74A7410",
      "11111111111111111",
      "00001222223100000",
      "00001212213100000",
      "00001242243100000",
      "00011000000110000",
      "00111111111111000",
      "00011111111110000",
      "01221222223122100",
      "01221222223122100",
      "00110122233101100",
      "00000125533100000",
      "00000011111000000",
      "00000121000000000",
      "00001221000000000",
      "00001111000000000"
    ];
    const M_SOMB_R2 = [
      "00000011111000000",
      "00000199999100000",
      "00000199999100000",
      "00111177777111100",
      "014A74A74A74A7410",
      "11111111111111111",
      "00001222223100000",
      "00001212213100000",
      "00001242243100000",
      "00011000000110000",
      "00111111111111000",
      "00011111111110000",
      "01221222223122100",
      "01221222223122100",
      "00110122233101100",
      "00000125533100000",
      "00000011111000000",
      "00000000012100000",
      "00000000122100000",
      "00000000111100000"
    ];
    const M_SALSA_R1 = [
      "000000888880800000000",
      "000008878777778000000",
      "000000771111177000000",
      "000008719999917808000",
      "088777719999918777800",
      "807711117777711117780",
      "87714A74A74A74A741888",
      "071111111111111111170",
      "877877122222317877878",
      "888087121221317888808",
      "000078124224317808000",
      "000871177777711780000",
      "008711111111111178800",
      "008771111111111777000",
      "007122122222312217000",
      "088122122222312217000",
      "087711712223317117000",
      "088788712553317777000",
      "008800781111177800800",
      "000087812177770800000",
      "000087122170888000000",
      "000007111178000000000",
      "000087787778000000000",
      "000008080880000000000"
    ];
    const M_SALSA_R2 = [
      "000000000808088000000",
      "000008877777778800000",
      "000008781111187800000",
      "000080719999917808000",
      "088778819999918777000",
      "087711117777711117700",
      "87714A74A74A74A741888",
      "881111111111111111178",
      "077777122222317787770",
      "808807121221317080880",
      "008877124224317788000",
      "000771188887711770000",
      "080711111111111188800",
      "087771111111111778800",
      "007122122222312217000",
      "087122122222312218000",
      "008711712223317117800",
      "000777712553317777000",
      "008088771111177008000",
      "000000887781217000000",
      "000000000712217000000",
      "000000000711117000000",
      "000000000777787800000",
      "000000008080808000000"
    ];

    px('banana', M_IDLE, PAL);
    px('banana_r1', M_RUN1, PAL);
    px('banana_r2', M_RUN2, PAL);
    px('banana-sombrero', M_SOMB, PAL);
    px('banana-sombrero_r1', M_SOMB_R1, PAL);
    px('banana-sombrero_r2', M_SOMB_R2, PAL);
    px('banana-salsa', M_SALSA, PAL);
    px('banana-salsa_r1', M_SALSA_R1, PAL);
    px('banana-salsa_r2', M_SALSA_R2, PAL);

    this.anims.create({ key: 'run_plain', frames: [ {key:'banana_r1'}, {key:'banana'}, {key:'banana_r2'}, {key:'banana'} ], frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'idle_plain', frames: [ {key:'banana'} ], frameRate: 1 });
    this.anims.create({ key: 'run_sombrero', frames: [ {key:'banana-sombrero_r1'}, {key:'banana-sombrero'}, {key:'banana-sombrero_r2'}, {key:'banana-sombrero'} ], frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'idle_sombrero', frames: [ {key:'banana-sombrero'} ], frameRate: 1 });
    this.anims.create({ key: 'run_salsa', frames: [ {key:'banana-salsa_r1'}, {key:'banana-salsa'}, {key:'banana-salsa_r2'}, {key:'banana-salsa'} ], frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'idle_salsa', frames: [ {key:'banana-salsa'} ], frameRate: 1 });

    // ── 2. ENEMIGOS E ÍTEMS (Usando tu diseño original vectorial) ─────────
    t('taxi',44,26,(g,f,r,c,t)=>{
      f(0xFFDD00); r(0,5,44,16);
      f(0xFFCC00); r(0,5,44,3);
      f(0x87CEEB); r(4,8,12,8); r(20,8,12,8);
      f(0x222222); r(0,17,44,2);
      f(0x000000); c(8,25,4); c(36,25,4);
      f(0xFF0000); r(16,12,8,4);
    });
    
    t('policia',22,40,(g,f,r,c,t)=>{
      f(0xFFBB99); c(11,8,6);
      f(0x000000); c(9,7,1); c(13,7,1);
      f(0x0033CC); r(3,14,16,18);
      f(0xFFDD00); r(9,16,4,2); r(9,20,4,2); r(9,24,4,2);
      f(0x111111); r(4,32,14,6);
      f(0x222222); r(4,38,4,2); r(14,38,4,2);
      f(0x0033CC); r(5,1,12,4); f(0x222222); r(5,1,12,2);
    });
    
    t('vendedor',24,38,(g,f,r,c,t)=>{
      f(0xFF8866); c(12,16,8);
      f(0xFFBB99); c(12,6,5);
      f(0x000000); c(10,5,1); c(14,5,1);
      f(0x333333); r(8,7,8,1);
      f(0xCC3333); r(4,12,16,10);
      f(0x8B6F47); r(5,22,14,10);
      f(0xCC5533); r(6,1,12,4);
      f(0x333333); r(6,32,4,6); r(14,32,4,6);
    });
    
    t('microbus',48,28,(g,f,r,c,t)=>{
      f(0xFF1493); r(2,3,44,18);
      f(0x87CEEB); r(6,7,10,10); r(24,7,10,10); r(42,7,4,6);
      f(0x222222); c(10,27,5); c(42,27,5);
      f(0xFF6600); r(44,5,4,10);
    });
    
    t('chilango',24,38,(g,f,r,c,t)=>{
      f(0xFFBB77); c(12,8,7);
      f(0x000000); c(9,7,2); c(15,7,2);
      f(0x333333); r(10,9,4,2);
      f(0x3366CC); r(4,16,16,14);
      f(0x8B4513); r(4,30,5,8); r(15,30,5,8);
      f(0x222222); c(6,38,2); c(17,38,2);
    });
    
    t('boss',120,80,(g,f,r,c,t)=>{
      f(0x222222); c(30,70,12); c(90,70,12); f(0x888888); c(30,70,6); c(90,70,6);
      f(0x0088CC); r(70,45,40,25); r(45,60,30,8); r(40,35,15,30); t(25,55,45,55,45,35);
      f(0x664422); r(70,40,35,8); f(0x111111); r(42,25,5,10); r(35,25,15,4); f(0xFFFF00); c(35,28,4);
      f(0xEEEEEE); r(75,20,20,25); f(0xFFCCAA); r(60,25,20,6); r(55,25,8,8);
      f(0x444444); r(80,40,15,25); r(70,50,15,10); f(0x111111); r(65,58,12,6);
      f(0xFFCCAA); c(85,12,12); f(0x554433); r(75,15,8,10); r(80,20,10,4);
      f(0x111111); r(73,8,12,5); r(75,8,20,2);
    });
    
    t('powerup-sombrero',20,20,(g,f,r,c,t)=>{f(0x8B4513);r(0,12,20,5);r(5,6,10,8);f(0xFFD700);r(4,10,12,3);});
    t('powerup-salsa',12,24,(g,f,r,c,t)=>{f(0xFF0000);r(2,6,8,16);f(0x00AA00);r(3,0,6,6);f(0xFFFFFF,0.4);r(4,8,2,8);});
    t('coin',12,12,(g,f,r,c,t)=>{f(0xFFD700);c(6,6,6);f(0xFFAA00);c(6,6,4);f(0xFFFF88);c(4,4,1);});
    // qblock — 26×26, dorado con signo ?
    t('qblock',26,26,(g,f,r,c,t)=>{f(0xFFCC00);r(0,0,26,26);f(0xDD9900);r(0,0,26,3);r(0,23,26,3);r(0,0,3,26);r(23,0,3,26);f(0xFFEE44);r(3,3,20,3);r(3,3,3,20);f(0x000000);r(10,6,6,3);r(14,9,3,4);r(12,13,3,3);r(12,18,3,3);});
    t('bg-tiles-1',800,600,(g,f,r,c,t)=>{
      // Cielo
      f(0x4B9FE1); r(0,0,800,200);
      f(0x6BB8F0); r(0,200,800,160);
      f(0x9DD0F8); r(0,360,800,100);
      f(0xBBDDEE); r(0,460,800,140);
      // Nubes
      [[105,58,32,40,28],[215,40,20,25,17],[558,50,26,33,22],[694,68,18,24,16]].forEach(([cx,cy,r1,r2,r3])=>{
        f(0xFFFFFF,0.93);
        c(cx,cy,r1); c(cx+Math.round(r1*0.8),cy-5,r2); c(cx+Math.round(r1*1.6),cy,r3);
        r(cx,cy,Math.round(r1*1.6+r3),Math.round(r1*0.55));
      });
      // Skyline CDMX
      [{x:0,w:55,h:190,c:0x3B72B8},{x:50,w:42,h:230,c:0x2E5EA0},{x:87,w:60,h:170,c:0xC55A28},
       {x:142,w:38,h:215,c:0x4A8C4A},{x:175,w:68,h:255,c:0x2E88C4},{x:238,w:46,h:195,c:0xB85030},{x:279,w:52,h:165,c:0x4A8C4A},
       {x:490,w:50,h:195,c:0xC55A28},{x:535,w:68,h:250,c:0x2E5EA0},{x:598,w:46,h:205,c:0x4A8C4A},
       {x:639,w:58,h:175,c:0x3B72B8},{x:692,w:72,h:230,c:0xC55A28},{x:740,w:60,h:190,c:0x2E88C4}
      ].forEach(b=>{
        const by=600-50-b.h;
        f(b.c); r(b.x,by,b.w,b.h);
        f(0xFFFFFF,0.18); r(b.x,by,b.w,4);
        for(let wy=by+10;wy<600-56;wy+=16)
          for(let wx=b.x+6;wx<b.x+b.w-6;wx+=13){
             const lit=((wx*5+wy*7)%11)>5;
             f(lit?0xFFEE88:0x0A1028,lit?0.85:0.4); r(wx,wy,7,9);
          }
      });
    });
    t('qblock-used',26,26,(g,f,r,c,t)=>{f(0x888888);r(0,0,26,26);f(0x666666);r(0,0,26,3);r(0,23,26,3);r(0,0,3,26);r(23,0,3,26);f(0x999999);r(3,3,20,3);r(3,3,3,20);f(0x555555);r(10,10,6,6);});
    t('platform',80,20,(g,f,r,c,t)=>{f(0x7a7a7a);r(0,0,80,20);f(0x5a5a5a);r(0,0,80,4);f(0x9a9a9a);r(1,1,78,2);f(0x686868);r(0,4,80,1);f(0x505050);r(0,18,80,2);for(let bx=4;bx<80;bx+=20){f(0x606060);r(bx,5,1,14);}});
    t('ground',80,32,(g,f,r,c,t)=>{f(0x636363);r(0,0,80,32);f(0x4a4a4a);r(0,0,80,5);f(0x8a8a8a);r(1,1,78,3);f(0x575757);r(0,5,80,1);f(0x3d3d3d);r(0,28,80,4);for(let bx=0;bx<80;bx+=20){f(0x505050);r(bx,6,1,22);f(0x7a7a7a);r(bx+2,8,16,4);f(0x5e5e5e);r(bx+2,14,16,2);}});
    t('checkpoint',30,50,(g,f,r,c,t)=>{f(0x888888);r(13,20,4,30);f(0xFFFFFF);r(0,0,30,20);f(0x0000CC);r(2,2,26,16);f(0xFFFFFF);r(5,4,2,10);r(7,4,4,2);r(7,9,4,2);r(11,5,2,4);r(14,4,2,10);r(18,4,2,10);r(14,4,6,2);r(14,9,6,2);});
    t('fireball',8,8,(g,f,r,c,t)=>{f(0xFF6600);c(4,4,4);f(0xFFDD00);c(4,4,2);});
    t('particle',4,4,(g,f,r,c,t)=>{f(0xFFFFFF);r(0,0,4,4);});
    
    // ── 3. FONDOS CDMX ─────────────────────────────────────────
    
    t('bg-tiles-2',800,600,(g,f,r,c,t)=>{
      f(0x87CEEB); r(0,0,800,600); // Cielo
      // Muro del mercado
      f(0xEAB588); r(0,180,800,280); 
      // Arcos de entrada
      for (let ax = 120; ax <= 720; ax += 280) {
        f(0x8B3A3A); c(ax, 360, 70); r(ax-70, 360, 140, 100);
        f(0x2A1A1A); c(ax, 360, 55); r(ax-55, 360, 110, 100);
        f(0x8B3A3A); r(ax-80, 330, 160, 10); // Ladrillo detalle
      }
      // Techo curvado (lámina blanca/gris)
      f(0xF0F0F0);
      for (let wx = 40; wx <= 800; wx += 80) c(wx, 180, 45);
      f(0xCCCCCC); r(0, 180, 800, 35);
      f(0xAAAAAA);
      for (let wx = 0; wx < 800; wx += 8) r(wx, 180, 2, 35);
      // Toldos del tianguis (Sea of tarps)
      const tc = [0x00B050, 0xFFCC00, 0x0066FF, 0xFF3366, 0x00DDAA];
      for(let layer=0; layer<3; layer++) {
        let yBase = 380 + layer*60;
        for(let tx = -100; tx < 900; tx += 140 + layer*20) {
          f(tc[(Math.abs(tx)+layer)%tc.length], 0.9);
          t(tx, yBase, tx+200, yBase-40, tx+100, yBase+120);
          f(0x000000, 0.1); t(tx+100, yBase-40, tx+200, yBase-40, tx+100, yBase+120); // Sombra
        }
      }
      // Sombrillas
      for(let sx = 60; sx < 800; sx += 180) {
        f(tc[(sx/60)%tc.length]);
        g.fillEllipse(sx, 560, 100, 50);
        f(0xFFFFFF, 0.3); g.fillEllipse(sx, 560, 40, 50);
      }
    });
    
    t('bg-tiles-3',800,600,(g,f,r,c,t)=>{
      f(0x0A0A0A); r(0,0,800,600); // Fondo negro
      // Techo oscuro ranurado
      f(0x222222); r(0,0,800,100); 
      f(0x111111); for(let wx=0; wx<800; wx+=20) r(wx,0,2,100);
      f(0xFFFFCC, 0.6); for(let lx=40; lx<800; lx+=160) c(lx,40,15); // Lámparas

      // Mural de Copilco (y=100 a y=400)
      f(0x5588AA); r(0,100,800,300); // Cielo del mural
      
      // Cara olmeca/totem (izquierda)
      f(0xAA4433); r(20, 150, 180, 250); 
      f(0xEEDD88); r(40, 180, 140, 220); 
      f(0x222222); c(80, 240, 20); c(140, 240, 20);
      f(0xFFFFFF); c(80, 240, 10); c(140, 240, 10);
      t(110, 270, 80, 310, 140, 310);
      r(60, 330, 100, 40); f(0xFFFFFF); r(70, 340, 30, 20); r(120, 340, 30, 20);

      // Moai central (piedra gris)
      f(0x888888); r(250, 150, 200, 250); c(350, 150, 100); 
      f(0x555555); r(320, 220, 60, 100); r(280, 340, 140, 20); 
      f(0x222222); r(280, 220, 40, 10); r(380, 220, 40, 10); 

      // Rostro azteca dorado (derecha)
      f(0xCCAA22); r(550, 150, 250, 250);
      f(0x222222); c(650, 240, 30); f(0xFFFFFF); c(650, 240, 15);
      f(0xAA8811); c(600, 350, 40); f(0xCCAA22); c(600, 350, 25); 

      // Franja amarilla COPILCO
      f(0x99AA22); r(0,400,800,40);
      f(0x778811); r(0,400,800,4); r(0,436,800,4);
      f(0xFFFFFF);
      r(300, 412, 15, 16); r(305, 416, 10, 8, f(0x99AA22)); f(0xFFFFFF); // C
      r(325, 412, 15, 16); r(329, 416, 7, 8, f(0x99AA22)); f(0xFFFFFF); // O
      r(350, 412, 15, 16); r(354, 416, 11, 4, f(0x99AA22)); r(354, 424, 11, 4, f(0x99AA22)); f(0xFFFFFF); // P
      r(375, 412, 5, 16); // I
      r(390, 412, 5, 16); r(390, 423, 15, 5); // L
      r(415, 412, 15, 16); r(420, 416, 10, 8, f(0x99AA22)); f(0xFFFFFF); // C
      r(440, 412, 15, 16); r(444, 416, 7, 8, f(0x99AA22)); f(0xFFFFFF); // O

      // Muro inferior negro con textura
      f(0x181818); r(0,440,800,160);
      f(0x222222); 
      for(let i=0; i<800; i+=15) r(i, 440+((i*37)%160), 4, 4);
    });
    
    t('bg-boss',800,600,(g,f,r,c,t)=>{f(0x330000);r(0,0,800,600);f(0x550000);r(0,300,800,300);f(0xFF2200,0.6);r(50,250,180,60);r(300,220,140,55);r(520,260,160,55);r(120,330,150,50);r(420,310,170,55);f(0xFFFF00,0.4);c(200,150,30);c(500,130,25);c(700,170,20);});
    
    // ── 4. ARRANQUE DEL JUEGO ─────────────────────────────────────────────
    this.registry.set('gs', GameState);
    loadHighScore().then(hs => { GameState.highScore = hs; this.scene.start('Menu'); });
  }
}
// ── MenuScene ───────────────────────────────────────────────────────────────
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    GameState.score=0; GameState.lives=3; GameState.level=0;
    GameState.powerState='plain'; GameState.paused=false;
    const g = this.add.graphics();
    const f=(c,a=1)=>g.fillStyle(c,a), r=(x,y,w,h)=>g.fillRect(x,y,w,h), c=(x,y,rad)=>g.fillCircle(x,y,rad), t=(x1,y1,x2,y2,x3,y3)=>g.fillTriangle(x1,y1,x2,y2,x3,y3);
    // Cielo
    f(0x4B9FE1); r(0,0,W,200);
    f(0x6BB8F0); r(0,200,W,160);
    f(0x9DD0F8); r(0,360,W,100);
    f(0xBBDDEE); r(0,460,W,140);
    // Nubes
    [[105,58,32,40,28],[215,40,20,25,17],[558,50,26,33,22],[694,68,18,24,16]].forEach(([cx,cy,r1,r2,r3])=>{
      f(0xFFFFFF,0.93);
      c(cx,cy,r1); c(cx+Math.round(r1*0.8),cy-5,r2); c(cx+Math.round(r1*1.6),cy,r3);
      r(cx,cy,Math.round(r1*1.6+r3),Math.round(r1*0.55));
    });
    // Skyline CDMX
    [{x:0,w:55,h:190,c:0x3B72B8},{x:50,w:42,h:230,c:0x2E5EA0},{x:87,w:60,h:170,c:0xC55A28},
     {x:142,w:38,h:215,c:0x4A8C4A},{x:175,w:68,h:255,c:0x2E88C4},{x:238,w:46,h:195,c:0xB85030},{x:279,w:52,h:165,c:0x4A8C4A},
     {x:490,w:50,h:195,c:0xC55A28},{x:535,w:68,h:250,c:0x2E5EA0},{x:598,w:46,h:205,c:0x4A8C4A},
     {x:639,w:58,h:175,c:0x3B72B8},{x:692,w:72,h:230,c:0xC55A28},{x:740,w:60,h:190,c:0x2E88C4}
    ].forEach(b=>{
      const by=H-50-b.h;
      f(b.c); r(b.x,by,b.w,b.h);
      f(0xFFFFFF,0.18); r(b.x,by,b.w,4);
      for(let wy=by+10;wy<H-56;wy+=16)
        for(let wx=b.x+6;wx<b.x+b.w-6;wx+=13){
          const lit=((wx*5+wy*7)%11)>5;
          f(lit?0xFFEE88:0x0A1028,lit?0.85:0.4); r(wx,wy,7,9);
        }
    });
    // Piso / avenida
    f(0x8B7B5A); r(0,H-52,W,52);
    f(0x555555); r(0,H-40,W,16);
    f(0xFFFFFF,0.55); for(let rx=10;rx<W;rx+=55) r(rx,H-35,30,4);
    // Arboles
    [65,150,390,460,570,660,745].forEach(tx=>{
      f(0x2A5A2A); c(tx,H-68,24);
      f(0x357035); c(tx-10,H-74,16);
      f(0x46924A); c(tx+8,H-76,14);
      f(0x5B3820); r(tx-5,H-52,10,22);
    });
    // Angel de la Independencia
    const ax=W/2;
    f(0xC8A966); r(ax-78,H-54,156,8);
    f(0xD4B872); r(ax-62,H-62,124,8);
    f(0xDEC47C); r(ax-48,H-70,96,8);
    f(0xD0AA55); r(ax-30,H-110,60,40);
    f(0xBB9944); r(ax-30,H-110,5,40);
    f(0xD4AA4A); r(ax-11,H-280,22,170);
    f(0xC49A3A); r(ax-11,H-280,5,170);
    f(0xE4BA5A); r(ax+6,H-280,5,170);
    f(0xEAC060); r(ax-20,H-292,40,14);
    f(0xF0D060); c(ax,H-320,14);
    t(ax-18,H-290,ax+18,H-290,ax,H-326);
    f(0xFFE070,0.95);
    t(ax-56,H-315,ax-13,H-306,ax-8,H-288);
    t(ax+56,H-315,ax+13,H-306,ax+8,H-288);
    f(0xFFFF44,0.95); c(ax,H-337,7);
    f(0xFFFFAA,0.75); c(ax,H-347,4);
    // Overlays texto
    f(0x000008,0.62); r(0,0,W,148);
    f(0x000820,0.52); r(80,360,640,210);
    g.lineStyle(2,0xFFD700,0.4); g.strokeRect(80,360,640,210);
    // Titulo
    this.add.text(W/2,30,'BANANA CHILANGA',
      {fontSize:'44px',fill:'#FFD700',stroke:'#000',strokeThickness:7,fontStyle:'bold'}).setOrigin(0.5);
    this.add.text(W/2,88,'Regresa a casa despues del partido',
      {fontSize:'20px',fill:'#FFE566',stroke:'#000',strokeThickness:4}).setOrigin(0.5);
    this.add.text(W/2,124,'¡No pierdas tu camion!',
      {fontSize:'17px',fill:'#FF9955',stroke:'#000',strokeThickness:3}).setOrigin(0.5);
    // Score
    this.add.text(W/2,385,'MEJOR: '+GameState.highScore,
      {fontSize:'26px',fill:'#FFD700',stroke:'#000',strokeThickness:4}).setOrigin(0.5);
    // START parpadeante
    const st=this.add.text(W/2,438,'-- Presiona START para jugar --',
      {fontSize:'24px',fill:'#FFFFFF',stroke:'#111',strokeThickness:4}).setOrigin(0.5);
    this.tweens.add({targets:st,alpha:0.08,duration:480,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
    // Controles
    this.add.text(W/2,492,'A/D = moverse  |  W = saltar  |  U = fireball',
      {fontSize:'13px',fill:'#AACCFF',stroke:'#000',strokeThickness:2}).setOrigin(0.5);
    this.add.text(W/2,520,'1 = start / pausa',
      {fontSize:'13px',fill:'#AACCFF',stroke:'#000',strokeThickness:2}).setOrigin(0.5);
    this._sk = this.input.keyboard.addKeys(CABINET_KEYS.START1.join(','));
  }
  update() {
    for(const k in this._sk) {
      if(Phaser.Input.Keyboard.JustDown(this._sk[k])) { GameState.level=1; this.scene.start('Game'); return; }
    }
  }
}

// ── GameScene ───────────────────────────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    if (data && data.level) GameState.level = data.level;
    this._cpReached = false;
    // fireball reset
    this._paused = false;
    this._pauseOverlay = null;
    this._pauseTxt = null;
    this._dyingFlag = false;
  }

  create() {
    const ld = LEVELS[GameState.level - 1] || LEVELS[0];
    GameState.paused = false;
    _buildBackground(this, ld);
    // Spawn player above the ground (ground y=572, h=32 → top=556) with margin
    this._player = createPlayer(this, 100, 530);
    applyPowerState(this, this._player, 'plain');
    const {platforms, coins, qblocks, checkpoint} = _buildLevel(this, ld, this._player);
    this._platforms = platforms;
    this._enemies = _spawnEnemies(this, ld, platforms);
    _buildHUD(this);

    const kb = this.input.keyboard;
    this._keys = {
      left:  kb.addKeys(CABINET_KEYS.P1_L.join(',')),
      right: kb.addKeys(CABINET_KEYS.P1_R.join(',')),
      jump:  kb.addKeys(CABINET_KEYS.P1_U.join(',')),
      down:  kb.addKeys(CABINET_KEYS.P1_D.join(',')),
      fire:  kb.addKeys(CABINET_KEYS.P1_1.join(','))
    };
    this._sk1 = kb.addKeys(CABINET_KEYS.START1.join(','));
    this._sk2 = kb.addKeys(CABINET_KEYS.START2.join(','));

    this.physics.add.collider(this._player, platforms);
    this.physics.add.overlap(this._player, this._enemies, (pl, en) => {
      if (!en.active) return;
      // Req 5.5: stomp = player falling (vy >= 0) and above enemy center
      if (pl.body.velocity.y >= 0 && pl.y < en.y) { _onEnemyStomp(this, pl, en); }
      else { this._onPlayerDamage(); }
    });
    this.physics.add.overlap(this._player, coins, (pl, coin) => {
      coin.disableBody(true,true);
      GameState.score = addScore(GameState.score,'coin'); playCoin();
    });
    this.physics.add.collider(this._player, qblocks, (pl, block) => {
      if (pl.body.touching.up && !block.used) this._onBlockHit(block);
    });
    this.physics.add.overlap(this._player, checkpoint, () => {
      if (!this._cpReached) this._onCheckpointReach();
    });
    this._fireballs = this.physics.add.group();
    this.physics.add.overlap(this._fireballs, this._enemies, (fb, en) => _onFireballHit(this, fb, en, this._player));

    const nm = this.add.text(W/2,H/2-60,'Nivel '+GameState.level+': '+ld.name,
      {fontSize:'36px',fill:'#FFD700',stroke:'#000',strokeThickness:5}).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.tweens.add({targets:nm, alpha:0, delay:1500, duration:800, onComplete:()=>nm.destroy()});
  }

  _onBlockHit(block) {
    const item = hitBlock(block);
    if (!item) return;
    // Cambiar a textura de bloque usado (gris), mantener tamaño, no regenerar estructura
    block.setTexture('qblock-used');
    block.setDisplaySize(26, 26);
    block.refreshBody();
    if (item === 'coin') {
      GameState.score = addScore(GameState.score,'coin'); playCoin();
      const ct = this.add.text(block.x,block.y-20,'+50',{fontSize:'18px',fill:'#FFD700',stroke:'#000',strokeThickness:3}).setDepth(15);
      this.tweens.add({targets:ct, y:ct.y-30, alpha:0, duration:600, onComplete:()=>ct.destroy()});
    } else {
      const pu = this.physics.add.sprite(block.x, block.y-24, item);
      pu.powerType = item;
      pu.setVelocityY(-120);
      pu.setCollideWorldBounds(true);
      this.physics.add.collider(pu, this._platforms);
      // Overlap: collect power-up and apply correct PowerState transition
      this.physics.add.overlap(this._player, pu, (pl, p) => {
        if (!p.active) return;
        const pt = p.powerType;
        p.disableBody(true, true);
        const newState = applyTransition(pl.powerState, pt);
        applyPowerState(this, pl, newState);
        playPowerUp();
        // Visual flash to confirm power-up collected
        this.cameras.main.flash(200, 255, 220, 0);
      });
    }
  }

  _onPlayerDamage() {
    // Bug fix: Allow immediate respawn if already dying (prevents being stuck)
    if (this._dyingFlag && this._player.y <= H + 30) return;
    
    const res = takeDamage(this, this._player);
    if (res.lostLife) {
      GameState.lives--;
      this._dyingFlag = true;
      // Freeze player immediately
      this._player.setVelocity(0, 0);
      this._player.body.setEnable(false);
      // Death flash: tint red + alpha oscillation for ~900ms
      this._player.setTint(0xFF0000);
      this.tweens.add({
        targets: this._player,
        alpha: 0.2,
        duration: 80,
        yoyo: true,
        repeat: 5,
        onComplete: () => { if (this._player.active) { this._player.alpha = 1; this._player.clearTint(); } }
      });
      if (isGameOver(GameState.lives)) {
        if (GameState.score > GameState.highScore) saveHighScore(GameState.score);
        this.time.delayedCall(950, () => this.scene.start('GameOver'));
      } else {
        this._player.fireballCount = 0;
        if (this._fireballs) this._fireballs.clear(true, true);
        this.time.delayedCall(950, () => {
          if (this._player.active) {
            this._dyingFlag = false;
            this._player.body.setEnable(true);
            // Respawn above the ground so physics settles correctly
            this._player.setPosition(100, 530);
            this._player.setVelocity(0, 0);
            this._player.alpha = 1;
            this._player.clearTint();
            applyPowerState(this, this._player, 'plain');
          }
        });
      }
    }
  }

  _onCheckpointReach() {
    this._cpReached = true;
    this._dyingFlag = true; // prevent damage during transition celebration
    GameState.score = addScore(GameState.score,'checkpoint');
    playWin();
    let jumps = 0;
    const dj = () => { this._player.setVelocityY(-350); jumps++; if(jumps<3) this.time.delayedCall(350,dj); };
    dj();
    this.time.delayedCall(1300, () => {
      if (GameState.level < 3) { GameState.level++; this.scene.restart(); }
      else { this.scene.start('Boss'); }
    });
  }

  update(time, delta) {
    if (this._paused) {
      handlePauseInput(this);
      return;
    }
    if (_keyJustDown(this._sk1)) { togglePauseMenu(this); return; }
    // Animate beam reflectors for streets theme
    _updateBeams(this, time);
    handleInput(this, this._player, this._keys, delta);
    // fireball: dedicated fire key (P1_1 = 'u') while in salsa state
    if (this._player.powerState === 'salsa' && _keyJustDown(this._keys.fire)) { spawnFireballSprite(this, this._player); }
    if (this._player.invulTimer > 0) {
      this._player.invulTimer -= delta;
      if (this._player.invulTimer <= 0) { this._player.invulTimer=0; this._player.clearTint(); this._player.alpha=1; }
    }
    const ld = LEVELS[GameState.level-1] || LEVELS[0];
    this._enemies.children.iterate(e => {
      if (!e || !e.active) return;
      
      let chasing = false;
      if (e.eType === 'microbus' || e.eType === 'taxi') {
        if (e.ePlatLeft !== undefined && e.x <= e.ePlatLeft) e.eDir = 1;
        if (e.ePlatRight !== undefined && e.x >= e.ePlatRight) e.eDir = -1;
      } else {
        const dx = this._player.x - e.x;
        const dist = Math.abs(dx);
        if (e.eType === 'policia' && dist < 250) chasing = true;
        else if (e.eType === 'chilango' && dist < 200) chasing = true;

        if (chasing) {
          e.eDir = dx > 0 ? 1 : -1;
          if (e.eType === 'policia') e.eChaseTimer = 500;
        } else {
          if (e.eType === 'policia') e.eChaseTimer -= delta;
          e.eWanderTimer -= delta;
          if (e.eWanderTimer <= 0) {
            e.eDir *= (e.eType === 'vendedor' && Math.random() > 0.6) ? 1 : -1;
            e.eWanderTimer = Phaser.Math.Between(e.eType==='vendedor'?1500:1000, e.eType==='vendedor'?2500:2200);
          }
        }
        if (e.x < 20 || e.x > ld.width - 20) e.eDir *= -1;
      }
      e.setVelocityX((chasing ? (e.eType==='policia'?130:110) : e.eSpeed) * e.eDir);
      e.setFlipX(e.eDir < 0);
      
      if (e.y > this.physics.world.bounds.height + 50) e.destroy();
    });
    
    // Pit/void detection: player fell below screen → lose a life and respawn
    if (this._player.y > H + 10 && !this._dyingFlag) this._onPlayerDamage();
    
    // SAFETY CHECK: Si el jugador está en posición de respawn pero body está deshabilitado, habilítalo
    if (this._player.y <= 560 && !this._player.body.enabled && !this._dyingFlag) {
      this._player.body.setEnable(true);
    }
    // Animate metro neon lights (flicker)
    if (this._neonLights) {
      this._neonLights.forEach((nl, i) => {
        nl.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(time * 0.003 + i * 0.7)));
      });
    }
    _updateHUD(this);
  }
}

// ── BossScene ───────────────────────────────────────────────────────────────
class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  // 11.1 — Build arena: bg tileSprite + floor + 2 side platforms (Req 7.8)
  _buildArena() {
    this.add.tileSprite(W/2, H/2, W, H, 'bg-boss');
    this._platforms = this.physics.add.staticGroup();
    // Ground grueso
    this._platforms.create(W/2, 580, 'ground').setDisplaySize(W, 32).setImmovable(true).refreshBody();
    // Side platforms más grandes
    this._platforms.create(180, 480, 'platform').setDisplaySize(220, 20).setImmovable(true).refreshBody();
    this._platforms.create(620, 480, 'platform').setDisplaySize(220, 20).setImmovable(true).refreshBody();
    this.physics.world.TILE_BIAS = 32;
  }

  // 11.1 — Spawn boss sprite: 120×80, HP=5, collideWorldBounds (Req 7.1, 7.2)
  _spawnBoss() {
    this._boss = this.physics.add.sprite(600, 460, 'boss');
    this._boss.setCollideWorldBounds(true).setDisplaySize(120, 80);
    this.physics.add.collider(this._boss, this._platforms);
  }

  // 11.1 — Build HUD: shared HUD + boss health bar label and bar graphics (Req 7.2)
  _buildHUDwithBossBar() {
    _buildHUD(this);
    const bst = {fontSize:'16px', fill:'#FFF', stroke:'#000', strokeThickness:3};
    this._bLbl   = this.add.text(W/2, H-50, 'MOTONETA FURIOSA  [5/5]', bst)
                            .setOrigin(0.5).setScrollFactor(0).setDepth(10);
    this._bBarBg = this.add.rectangle(W/2, H-30, 300, 14, 0x440000)
                            .setScrollFactor(0).setDepth(10);
    this._bBar   = this.add.rectangle(W/2-150, H-30, 300, 14, 0xFF0000)
                            .setOrigin(0, 0.5).setScrollFactor(0).setDepth(11);
  }

  create() {
    GameState.paused = false;
    this._paused = false;
    // fireball reset
    this._bossDefeated = false;
    this._bossState = {hp: 5, invulTimer: 0};
    this._bossDir = 1;
    this._bJumpT = 3000;
    this._bFireT = 4000;

    // Build arena (bg + platforms)
    this._buildArena();

    // Create player and apply current power state
    this._player = createPlayer(this, 100, 500);
    applyPowerState(this, this._player, GameState.powerState);

    // Physics colliders for player on platforms
    this.physics.add.collider(this._player, this._platforms);

    // Spawn boss + projectile group
    this._spawnBoss();
    this._projs = this.physics.add.group();

    // Overlaps: player ↔ boss (stomp or contact damage), player ↔ projectiles
    this.physics.add.overlap(this._player, this._boss, (pl) => {
      if (pl.body.velocity.y > 0 && pl.y < this._boss.y - 20) this._onBossStomp();
      else this._onBossProjectileHit(null);
    });
    this.physics.add.overlap(this._player, this._projs, (pl, proj) => {
      this._onBossProjectileHit(proj);
    });
    this._fireballs = this.physics.add.group();
    this.physics.add.overlap(this._fireballs, this._boss, (fb, boss) => this._onFireballBossHit(fb));

    // Keyboard setup
    const kb = this.input.keyboard;
    this._keys = {
      left:  kb.addKeys(CABINET_KEYS.P1_L.join(',')),
      right: kb.addKeys(CABINET_KEYS.P1_R.join(',')),
      jump:  kb.addKeys(CABINET_KEYS.P1_U.join(',')),
      down:  kb.addKeys(CABINET_KEYS.P1_D.join(',')),
      fire:  kb.addKeys(CABINET_KEYS.P1_1.join(','))
    };
    this._sk1 = kb.addKeys(CABINET_KEYS.START1.join(','));
    this._sk2 = kb.addKeys(CABINET_KEYS.START2.join(','));

    // HUD with boss health bar
    this._buildHUDwithBossBar();

    // Entrance animation label
    const lbl = this.add.text(W/2, H/2-80, 'EL MICROBUS MALDITO!',
      {fontSize:'32px', fill:'#FF0000', stroke:'#000', strokeThickness:5})
      .setOrigin(0.5).setScrollFactor(0).setDepth(20);
    this.tweens.add({targets: lbl, alpha: 0, delay: 1800, duration: 800,
                     onComplete: () => lbl.destroy()});
  }

  // 11.1 — Update boss HUD bar width and label (Req 7.2)
  _updateBossHUD() {
    const hp = Math.max(0, this._bossState.hp);
    this._bBar.width = 300 * (hp / 5);
    this._bLbl.setText('MOTONETA FURIOSA  [' + hp + '/5]');
  }

  // 11.3 — Boss jump timer: every 3 s jump with velocityY(-400) (Req 7.3)
  _bossJumpTimer(delta) {
    this._bJumpT -= delta;
    if (this._bJumpT <= 0) {
      this._bJumpT = 3000;
      if (this._boss.body.touching.down) this._boss.setVelocityY(-400);
    }
  }

  // 11.3 — Boss fire timer: every 4 s fire projectile toward player (Req 7.3, 7.9)
  _bossFireTimer(delta) {
    this._bFireT -= delta;
    if (this._bFireT <= 0) {
      this._bFireT = 4000;
      const dir = this._player.x > this._boss.x ? 1 : -1;
      const proj = this._projs.create(this._boss.x, this._boss.y - 10, 'fireball');
      proj.setVelocityX(200 * dir);
      proj.body.allowGravity = false;
      proj.setCollideWorldBounds(true);
      playFireball();
    }
  }

  // 11.4 — Shared boss-damage logic: guard invul/defeated, decrement HP,
  //         flash white 200ms, bounce player up, check defeat (Req 7.4, 7.5)
  _applyBossHit() {
    if (this._bossState.invulTimer > 0 || this._bossDefeated) return;
    damageBoss(this._bossState);
    this._boss.setTint(0xFFFFFF);
    this.time.delayedCall(200, () => { if (this._boss.active) this._boss.clearTint(); });
    this._player.setVelocityY(-300);
    playKill();
    this._updateBossHUD();
    if (this._bossState.hp <= 0) this._onBossDefeated();
  }

  // 11.4 — Stomp: player lands on top of boss (Req 7.4)
  _onBossStomp() {
    this._applyBossHit();
  }

  // 11.4 — Fireball hits boss: destroy fireball, clear fireballActive, apply boss hit (Req 7.5)
  _onFireballBossHit(fireball) {
    if (fireball && !fireball._destroyed) {
      fireball._destroyed = true;
      fireball.destroy();
      this._player.fireballCount = Math.max(0, (this._player.fireballCount || 0) - 1);
      this._applyBossHit();
    }
  }

  // 11.5 — Boss defeated: blink+expand tween ≥2s, then WinScene (Req 7.6)
  _onBossDefeated() {
    if (this._bossDefeated) return;
    this._bossDefeated = true;
    this._boss.setVelocity(0, 0);
    playDefeat();
    this.tweens.add({
      targets: this._boss,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        if (GameState.score > GameState.highScore) saveHighScore(GameState.score);
        this.scene.start('Win');
      }
    });
  }

  // 11.6 — Boss projectile (or contact) hits player: damage player, handle life loss (Req 7.9, 8.9)
  _onBossProjectileHit(proj) {
    if (proj) proj.destroy();
    const player = this._player;
    if (player.invulTimer > 0) return;
    const res = takeDamage(this, player);
    if (res.lostLife) {
      GameState.lives--;
      // Freeze player immediately
      player.setVelocity(0, 0);
      player.body.setEnable(false);
      // Death flash: tint red + alpha oscillation for ~900ms
      player.setTint(0xFF0000);
      this.tweens.add({
        targets: player,
        alpha: 0.2,
        duration: 80,
        yoyo: true,
        repeat: 5,
        onComplete: () => { if (player.active) { player.alpha = 1; player.clearTint(); } }
      });
      if (isGameOver(GameState.lives)) {
        if (GameState.score > GameState.highScore) saveHighScore(GameState.score);
        this.time.delayedCall(950, () => this.scene.start('GameOver'));
      } else {
        player.fireballCount = 0;
        if (this._fireball) {
          this._fireball._destroyed = true;
          this._fireball.destroy();
          // fireball reset
        }
        this.time.delayedCall(950, () => {
          if (player.active) {
            player.body.setEnable(true);
            player.setPosition(100, 500);
            player.setVelocity(0, 0);
            player.alpha = 1;
            player.clearTint();
            applyPowerState(this, player, 'plain');
          }
        });
      }
    }
  }

  // 11.2 — Main update loop (Req 7.3, 7.4, 7.5, 7.7, 9.1, 9.2, 9.3)
  update(time, delta) {
    if (this._bossDefeated) return;
    
    if (this._paused) {
      handlePauseInput(this);
      return;
    }
    
    // Pause / unpause on START1 (not during defeat animation)
    if (_keyJustDown(this._sk1)) { togglePauseMenu(this); return; }

    // Player input
    handleInput(this, this._player, this._keys, delta);

    // Fireball spawn: dedicated fire key (P1_1 = 'u') while in salsa state
    if (this._player.powerState === 'salsa' && _keyJustDown(this._keys.fire)) { spawnFireballSprite(this, this._player); }

    // Player invulnerability tick
    if (this._player.invulTimer > 0) {
      this._player.invulTimer -= delta;
      if (this._player.invulTimer <= 0) {
        this._player.invulTimer = 0;
        this._player.clearTint();
        this._player.alpha = 1;
      }
    }

    // Boss horizontal movement (Req 7.3, 7.7)
    const bs = getBossSpeed(this._bossState.hp);
    this._boss.setVelocityX(bs * this._bossDir);
    this._boss.setFlipX(this._bossDir === 1);
    if (this._boss.x < 80)  this._bossDir =  1;
    if (this._boss.x > 720) this._bossDir = -1;

    // Boss invulnerability tick
    if (this._bossState.invulTimer > 0) {
      this._bossState.invulTimer -= delta;
      if (this._bossState.invulTimer < 0) this._bossState.invulTimer = 0;
    }

    // Boss jump and fire timers (Req 7.3)
    this._bossJumpTimer(delta);
    this._bossFireTimer(delta);

    // Fireball ↔ boss overlap (Req 7.5)
    

    // Clean up stale projectiles that leave the screen (Req 7.9)
    this._projs.children.iterate(p => {
      if (p && (p.x < 0 || p.x > W || p.y > H)) p.destroy();
    });

    // Player falls off the world → contact damage (Req 7.9)
    if (this._player.y > H + 30) this._onBossProjectileHit(null);

    // Refresh HUD
    _updateHUD(this);
    this._updateBossHUD();
  }
}

// ── GameOverScene ───────────────────────────────────────────────────────────
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  create() {
    this.add.rectangle(W/2,H/2,W,H,0x000000);
    this.add.text(W/2,180,'GAME OVER',{fontSize:'56px',fill:'#FF0000',stroke:'#000',strokeThickness:6}).setOrigin(0.5).setScrollFactor(0);
    this.add.text(W/2,300,'Score: '+(GameState.score||0),{fontSize:'32px',fill:'#FFF',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0);
    this.add.text(W/2,350,'High Score: '+(GameState.highScore||0),{fontSize:'28px',fill:'#FFD700',stroke:'#000',strokeThickness:4}).setOrigin(0.5).setScrollFactor(0);
    this.add.text(W/2,450,'Presiona START',{fontSize:'24px',fill:'#AAA',stroke:'#000',strokeThickness:3}).setOrigin(0.5).setScrollFactor(0);
    playDefeat();
    this._sk = this.input.keyboard.addKeys(CABINET_KEYS.START1.join(','));
  }
  update() {
    for(const k in this._sk) {
      if(Phaser.Input.Keyboard.JustDown(this._sk[k])) {
        GameState.score=0; GameState.lives=3; GameState.powerState='plain';
        GameState.level=1; GameState.paused=false;
        this.scene.start('Menu'); return;
      }
    }
  }
}

// ── WinScene ────────────────────────────────────────────────────────────────
class WinScene extends Phaser.Scene {
  constructor() { super('Win'); }
  create() {
    playWin();
    const g = this.add.graphics();
    const f=(c,a=1)=>g.fillStyle(c,a), r=(x,y,w,h)=>g.fillRect(x,y,w,h), c=(x,y,rad)=>g.fillCircle(x,y,rad), t=(x1,y1,x2,y2,x3,y3)=>g.fillTriangle(x1,y1,x2,y2,x3,y3);

    // ── Fondo azul-morado tipo atardecer/noche festivo ──────────────────────
    f(0x8B9BE4); r(0,0,W,H);
    f(0x9FB0F5); r(0,80,W,200);
    f(0xADC0FF); r(0,200,W,H-200);

    // ── Montañas pixeladas al fondo ──────────────────────────────────────────
    f(0xA8B5ED, 0.6); // Montañas más claras
    for(let mx = 0; mx < W; mx += 80) {
      t(mx, 220, mx+40, 150, mx+80, 220);
      f(0xFFFFFF, 0.4); // Nieve en la cima
      t(mx+20, 185, mx+40, 150, mx+60, 185);
      f(0xA8B5ED, 0.6); // Regresar color
    }

    // ── Estrellas tipo pixel art (+) ─────────────────────────────────────────
    [[120,60],[250,90],[400,45],[600,75],[700,50],[80,140],[320,160],[520,130],[750,150]].forEach(([cx,cy])=>{
      f(0xFFFFAA, 0.9);
      r(cx-2,cy-6,4,12);
      r(cx-6,cy-2,12,4);
    });

    // ── Patrón de rombos decorativos (borde tipo sarape) ─────────────────────
    const sarapeColors=[0xCC2200,0xFFAA00,0x006622,0xFFDD00,0xCC2200];
    for(let bx=0;bx<W;bx+=32){
      f(sarapeColors[((bx/32)|0)%sarapeColors.length],0.7);
      r(bx,0,32,18);
      r(bx,H-18,32,18);
    }
    for(let by=18;by<H-18;by+=32){
      f(sarapeColors[((by/32)|0)%sarapeColors.length],0.7);
      r(0,by,18,32);
      r(W-18,by,18,32);
    }

    // ── Mesa con mantel a cuadros ─────────────────────────────────────────────
    f(0xEEEEDD); r(80,370,640,220); // Mantel claro
    // Patrón zig-zag en el borde
    f(0xAA8866);
    for(let zx=80; zx<720; zx+=20) {
      t(zx,590, zx+10,570, zx+20,590);
    }
    // Sombreado bajo los objetos
    f(0x000000, 0.15); g.fillEllipse(400,410,260,60);
    g.fillEllipse(230,400,60,20); g.fillEllipse(175,395,40,15);

    // ── Plato con tacos ──────────────────────────────────────────────────────
    // Plato color turquesa vibrante
    f(0x00BBDD); g.fillEllipse(450,420,240,50);
    f(0x00E5FF); g.fillEllipse(450,416,210,40);
    f(0x0099BB); g.fillEllipse(450,435,220,15); // Borde inferior
    
    // Taco 1
    f(0xFFAA00); t(370,410,420,410,395,360);
    f(0xDD8800); r(373,407,44,5);
    f(0x448844); c(385,385,6); c(400,378,5); c(410,383,6);
    f(0xFFEEEE); c(390,388,3); c(405,385,3); // Cebolla
    f(0xFF3311); c(390,390,4); c(405,388,4); // Salsa roja
    
    // Taco 2 (Central)
    f(0xFFAA00); t(410,415,470,415,440,355);
    f(0xDD8800); r(413,412,54,6);
    f(0x448844); c(425,385,6); c(440,378,5); c(450,384,6);
    f(0xFFEEEE); c(430,388,3); c(445,385,3); 
    f(0xFF3311); c(430,392,4); c(445,389,4);
    
    // Taco 3
    f(0xFFAA00); t(460,410,510,410,485,360);
    f(0xDD8800); r(463,407,44,5);
    f(0x448844); c(475,385,6); c(490,378,5); c(500,383,6);
    f(0xFFEEEE); c(480,388,3); c(495,385,3); 
    f(0xFF3311); c(480,390,4); c(495,388,4);

    // Lima grande
    f(0x228800); c(525,415,22); // Cáscara oscura
    f(0x55CC22); c(525,415,18); // Interior claro
    f(0xAAFF88); c(525,415,14); // Centro
    // Gajos blancos
    f(0xFFFFFF, 0.8);
    for(let i=0; i<6; i++) {
      const ang = i * Math.PI/3;
      t(525,415, 525+Math.cos(ang-0.3)*12,415+Math.sin(ang-0.3)*12, 525+Math.cos(ang+0.3)*12,415+Math.sin(ang+0.3)*12);
    }

    // ── Bandera mexicana (más grande y detrás) ────────────────────────────────
    // Asta
    f(0xCC8833); r(350,220,6,180);
    f(0xFFCC55); r(352,220,2,180);
    // Tres franjas
    f(0x006847); r(356,230,46,34);
    f(0xFFFFFF); r(402,230,46,34);
    f(0xCE1126); r(448,230,46,34);
    // Borde
    g.lineStyle(2,0x333333,0.8); g.strokeRect(356,230,138,34);
    // Escudo
    f(0x885522); c(425,247,7); // Águila
    f(0x005522); g.fillEllipse(425,253,10,4); // Nopal

    // ── Botella de cerveza grande (Carta Blanca style) ───────────────────────
    // Cuerpo
    f(0x552200); r(200,210,60,180);
    f(0x773300); r(205,210,15,180);
    f(0x331100); r(200,380,60,10);
    f(0xFFFFFF,0.15); r(210,215,8,170); // Brillo
    // Cuello
    f(0x552200); r(215,160,30,50);
    f(0x773300); r(218,160,8,50);
    // Etiqueta amarilla/blanca
    f(0xFFDD33); g.fillRoundedRect(195,270,70,90, 8);
    f(0xFFFFFF); r(205,280,50,70);
    f(0xAA6600); c(230,315,18); // Logo central
    f(0x000000); r(215,290,30,4); // Texto simulado
    r(220,340,20,4);
    // Corcholata
    f(0xCCAA00); r(212,150,36,12);
    f(0xFFFFAA); r(218,150,24,4);

    // ── Botella de salsa picante ──────────────────────────────────────────────
    f(0xEE1111); g.fillRoundedRect(140,310,35,80, 5); // Cuerpo ancho
    f(0xCC0000); r(165,310,10,80); // Sombra
    f(0xFFFFFF); g.fillRoundedRect(145,340,25,35, 3); // Etiqueta blanca
    f(0x00AA00); r(145,345,25,8); // Detalles etiqueta
    f(0xDD0000); r(152,358,10,12); // Chile dibujado
    // Cuello y tapa verde
    f(0xEE1111); r(148,285,19,25);
    f(0x008800); r(148,275,19,10); 

    // ── Dos shots de tequila ─────────────────────────────────────────────────
    // Shot 1
    f(0x333333,0.4); r(278,368,26,42); // Vidrio trasero
    f(0xDD7700,0.9); r(280,378,22,28); // Líquido ambar
    f(0xFFFFFF,0.5); r(276,366,30,44); // Vidrio frente
    f(0xFFFFFF,0.8); r(278,368,4,40); // Brillo
    // Shot 2
    f(0x333333,0.4); r(318,373,26,42);
    f(0xDD7700,0.9); r(320,383,22,28);
    f(0xFFFFFF,0.5); r(316,371,30,44);
    f(0xFFFFFF,0.8); r(318,373,4,40);

    // ── Panel oscuro para texto ───────────────────────────────────────────────
    f(0x000010,0.75); g.fillRoundedRect(120,60,560,220, 16);
    g.lineStyle(4,0xFFD700,0.9); g.strokeRoundedRect(120,60,560,220, 16);
    // Acento interior
    g.lineStyle(2,0xFFAA00,0.5); g.strokeRoundedRect(128,68,544,204, 12);

    // ── Textos ───────────────────────────────────────────────────────────────
    this.add.text(W/2,95,'LO LOGRASTE!',
      {fontSize:'46px',fill:'#FFD700',stroke:'#000',strokeThickness:8,fontStyle:'bold'}).setOrigin(0.5);
    this.add.text(W/2,150,'Regresaste sano y salvo casa',
      {fontSize:'24px',fill:'#FFFFFF',stroke:'#000',strokeThickness:5,fontStyle:'bold'}).setOrigin(0.5);
    
    // Panel interior para puntajes
    g.fillStyle(0xFFFFFF,0.1); g.fillRoundedRect(250,180,300,80, 8);
    
    this.add.text(W/2,200,'Score: '+(GameState.score||0),
      {fontSize:'28px',fill:'#55FF55',stroke:'#000',strokeThickness:5,fontStyle:'bold'}).setOrigin(0.5);
    this.add.text(W/2,238,'High Score: '+(GameState.highScore||0),
      {fontSize:'24px',fill:'#FFD700',stroke:'#000',strokeThickness:4,fontStyle:'bold'}).setOrigin(0.5);

    // START parpadeante
    const st=this.add.text(W/2,310,'-- Presiona START para continuar --',
      {fontSize:'24px',fill:'#FFFFFF',stroke:'#111',strokeThickness:5,fontStyle:'bold'}).setOrigin(0.5);
    this.tweens.add({targets:st,alpha:0.08,duration:480,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});

    this._sk = this.input.keyboard.addKeys(CABINET_KEYS.START1.join(','));
  }
  update() {
    for(const k in this._sk) {
      if(Phaser.Input.Keyboard.JustDown(this._sk[k])) {
        GameState.score=0; GameState.lives=3; GameState.powerState='plain';
        GameState.level=1; GameState.paused=false;
        this.scene.start('Menu'); return;
      }
    }
  }
}

// ── Phaser.Game ─────────────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  parent: 'game-root',
  backgroundColor: '#191970',
  physics: { default:'arcade', arcade:{ gravity:{y:900}, debug:false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, GameScene, BossScene, GameOverScene, WinScene]
});