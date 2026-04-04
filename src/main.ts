// ── OH-YUM BLASTER 3D — Main Entry Point ────────────────
// Full game loop: title → charSelect → levelIntro → arena → highScore

import * as THREE from 'three';
import { createRenderer, handleRendererResize, type RendererBundle } from './renderer/SetupRenderer';
import { createSpaceEnvironment } from './renderer/Environment';
import { SceneManager, type SceneState } from './state/SceneManager';
import { createArenaState, updateArena, cleanupArena, type ArenaState } from './scenes/ArenaLoop';
import { HUD3D } from './ui/HUD3D';
import { setDifficulty, type DifficultyLevel } from './state/Difficulty';
import { resetLevelState, currentLevelIndex, advanceLevel, getCurrentLevel, totalScore } from './state/LevelState';
import { setCharacter, currentCharacter } from './state/Character';
import { addHighScore, getHighScores } from './state/HighScores';
import { currentDifficulty } from './state/Difficulty';
import { COLORS } from './config';

// ── Globals ──
let bundle: RendererBundle;
let clock: THREE.Clock;
let sceneManager: SceneManager;
let arena: ArenaState | null = null;
let hud: HUD3D | null = null;
const keys: Record<string, boolean> = {};

// ── Overlay elements ──
let overlayEl: HTMLDivElement;
let crosshairEl: HTMLElement;

function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Missing #game-canvas element');

  overlayEl = document.getElementById('ui-overlay') as HTMLDivElement;
  crosshairEl = document.getElementById('crosshair') as HTMLElement;

  // ── Renderer + environment ──
  bundle = createRenderer(canvas);
  createSpaceEnvironment(bundle.scene, bundle.renderer, bundle.camera);

  // Start camera in a cinematic position
  bundle.camera.position.set(0, 10, 30);
  bundle.camera.lookAt(0, 0, 0);

  // ── Input ──
  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // ── Resize ──
  const onResize = () => handleRendererResize(bundle);
  window.addEventListener('resize', onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onResize);
  }

  clock = new THREE.Clock();

  // ── Scene Manager ──
  sceneManager = new SceneManager({
    onEnter: handleSceneEnter,
    onExit: handleSceneExit,
  });
  sceneManager.start('title');

  animate();
}

// ── Scene Transitions ──

function handleSceneEnter(state: SceneState, _prev: SceneState | null): void {
  switch (state) {
    case 'title':
      showTitleOverlay();
      crosshairEl.style.display = 'none';
      break;
    case 'charSelect':
      showCharSelectOverlay();
      break;
    case 'levelIntro':
      showLevelIntroOverlay();
      break;
    case 'arena':
      startArena();
      break;
    case 'highScore':
      showHighScoreOverlay();
      break;
    case 'gameOver':
      showGameOverOverlay();
      break;
  }
}

function handleSceneExit(state: SceneState, _next: SceneState): void {
  clearOverlay();
  if (state === 'arena' && arena) {
    cleanupArena(arena, bundle.scene);
    hud?.destroy();
    hud = null;
    arena = null;
    crosshairEl.style.display = 'none';
  }
}

// ── Overlays ──

function clearOverlay(): void {
  // Remove all overlay children except the HUD
  const children = Array.from(overlayEl.children);
  for (const child of children) {
    if ((child as HTMLElement).id !== 'hud') {
      child.remove();
    }
  }
}

function createOverlayPanel(cssClass = 'overlay-panel'): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = cssClass;
  panel.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(2,5,8,0.85);z-index:30;
    font-family:Arial,sans-serif;color:#fff;
    pointer-events:auto;
  `;
  overlayEl.appendChild(panel);
  return panel;
}

function showTitleOverlay(): void {
  const panel = createOverlayPanel();

  const title = document.createElement('div');
  title.textContent = 'OH-YUM BLASTER';
  title.style.cssText = 'font-size:48px;font-weight:bold;letter-spacing:4px;margin-bottom:8px;';
  panel.appendChild(title);

  const sub = document.createElement('div');
  sub.textContent = 'オー・ヤム ブラスター';
  sub.style.cssText = 'font-size:24px;color:#aaa;margin-bottom:40px;';
  panel.appendChild(sub);

  const selectLabel = document.createElement('div');
  selectLabel.textContent = 'SELECT DIFFICULTY';
  selectLabel.style.cssText = 'font-size:18px;letter-spacing:2px;margin-bottom:20px;';
  panel.appendChild(selectLabel);

  const difficulties: { key: DifficultyLevel; label: string; color: string; desc: string }[] = [
    { key: 'beginner', label: 'BEGINNER', color: '#44ff44', desc: 'Slow enemy • Extra shields • Relaxed pace' },
    { key: 'intermediate', label: 'INTERMEDIATE', color: '#ffcc00', desc: 'Balanced combat • Standard loadout' },
    { key: 'expert', label: 'EXPERT', color: '#ff4444', desc: 'Fast & aggressive • Tough enemy • Less armor' },
  ];

  for (const d of difficulties) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display:block;width:360px;padding:14px 20px;margin:8px 0;
      background:rgba(17,24,34,0.9);border:2px solid ${d.color};
      color:${d.color};font-size:18px;font-weight:bold;font-family:Arial,sans-serif;
      cursor:pointer;border-radius:4px;text-align:center;
    `;
    btn.textContent = d.label;

    const desc = document.createElement('div');
    desc.textContent = d.desc;
    desc.style.cssText = 'font-size:11px;color:#ccc;font-weight:normal;margin-top:4px;';
    btn.appendChild(desc);

    btn.addEventListener('click', () => {
      setDifficulty(d.key);
      resetLevelState();
      sceneManager.transition('charSelect');
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(26,40,56,0.95)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(17,24,34,0.9)'; });
    panel.appendChild(btn);
  }

  // High scores
  const scores = getHighScores();
  if (scores.length > 0) {
    const hsTitle = document.createElement('div');
    hsTitle.textContent = 'HIGH SCORES';
    hsTitle.style.cssText = 'font-size:14px;color:#ffcc00;margin-top:30px;letter-spacing:2px;';
    panel.appendChild(hsTitle);

    for (const entry of scores.slice(0, 5)) {
      const row = document.createElement('div');
      row.textContent = `${entry.name} — ${entry.score.toLocaleString()}`;
      row.style.cssText = 'font-size:12px;color:#aaa;margin-top:4px;';
      panel.appendChild(row);
    }
  }

  const footer = document.createElement('div');
  footer.textContent = 'PRIDAY LABS';
  footer.style.cssText = 'position:absolute;bottom:16px;right:16px;font-size:16px;font-weight:bold;color:#00ff66;';
  panel.appendChild(footer);
}

function showCharSelectOverlay(): void {
  const panel = createOverlayPanel();

  const title = document.createElement('div');
  title.textContent = 'CHOOSE YOUR PILOT';
  title.style.cssText = 'font-size:28px;font-weight:bold;letter-spacing:3px;margin-bottom:30px;';
  panel.appendChild(title);

  const chars = [
    { id: 'owen', name: 'OWEN', tagline: 'Precision striker', color: 0x88aacc },
    { id: 'william', name: 'WILLIAM', tagline: 'Aggressive brawler', color: 0xccaa44 },
  ];

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:30px;';

  for (const c of chars) {
    const card = document.createElement('button');
    card.style.cssText = `
      width:200px;padding:16px 20px;background:rgba(17,24,34,0.9);
      border:2px solid #${c.color.toString(16).padStart(6, '0')};
      color:#fff;font-family:Arial,sans-serif;cursor:pointer;border-radius:6px;
      text-align:center;
    `;

    // Portrait image
    const portrait = document.createElement('img');
    portrait.src = `/portraits/${c.id}.jpg`;
    portrait.alt = c.name;
    portrait.style.cssText = 'width:140px;height:140px;border-radius:50%;object-fit:cover;margin-bottom:12px;border:3px solid #' + c.color.toString(16).padStart(6, '0') + ';';
    card.appendChild(portrait);

    const name = document.createElement('div');
    name.textContent = c.name;
    name.style.cssText = 'font-size:22px;font-weight:bold;margin-bottom:8px;';
    card.appendChild(name);

    const tag = document.createElement('div');
    tag.textContent = c.tagline;
    tag.style.cssText = 'font-size:12px;color:#aaa;';
    card.appendChild(tag);

    card.addEventListener('click', () => {
      setCharacter(c.id as 'owen' | 'william');
      sceneManager.transition('levelIntro');
    });
    card.addEventListener('mouseenter', () => { card.style.background = 'rgba(26,40,56,0.95)'; });
    card.addEventListener('mouseleave', () => { card.style.background = 'rgba(17,24,34,0.9)'; });
    row.appendChild(card);
  }

  panel.appendChild(row);
}

function showLevelIntroOverlay(): void {
  const panel = createOverlayPanel();
  const level = getCurrentLevel();

  const levelText = document.createElement('div');
  levelText.textContent = `LEVEL ${level.level}`;
  levelText.style.cssText = `
    font-size:64px;font-weight:bold;letter-spacing:6px;
    animation: scaleIn 0.5s ease-out;
  `;
  panel.appendChild(levelText);

  const subtitle = document.createElement('div');
  subtitle.textContent = level.subtitle;
  subtitle.style.cssText = 'font-size:20px;color:#ffcc00;margin-top:12px;letter-spacing:2px;opacity:0;animation:fadeIn 0.5s 0.3s forwards;';
  panel.appendChild(subtitle);

  const enemies = document.createElement('div');
  enemies.textContent = `${level.enemyCount} ${level.enemyCount === 1 ? 'ENEMY' : 'ENEMIES'}`;
  enemies.style.cssText = 'font-size:14px;color:#aaa;margin-top:16px;opacity:0;animation:fadeIn 0.5s 0.5s forwards;';
  panel.appendChild(enemies);

  // Inject animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes scaleIn { from { transform:scale(0.3);opacity:0; } to { transform:scale(1);opacity:1; } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  `;
  document.head.appendChild(style);

  // Auto-advance after 2.5s
  setTimeout(() => {
    if (sceneManager.current === 'levelIntro') {
      sceneManager.transition('arena');
    }
  }, 2500);
}

function startArena(): void {
  const char = currentCharacter;
  const playerColor = char === 'william' ? 0xccaa44 : COLORS.player;

  arena = createArenaState(
    bundle.scene,
    bundle.camera,
    currentLevelIndex + 1,
    totalScore,
    playerColor,
  );

  hud = new HUD3D();
  crosshairEl.style.display = 'block';

  // Explosions confirmed working — DOM-based, projected to screen space
}

function showHighScoreOverlay(): void {
  const panel = createOverlayPanel();
  const finalScore = arena?.score ?? totalScore;

  // Pilot portrait — victory celebration
  const pilotImg = document.createElement('img');
  pilotImg.src = `/portraits/${currentCharacter}.jpg`;
  pilotImg.alt = currentCharacter;
  pilotImg.style.cssText = `
    width:160px;height:160px;border-radius:50%;object-fit:cover;
    border:4px solid #ffcc00;margin-bottom:16px;
    animation: heroGlow 1.5s ease-in-out infinite alternate;
  `;
  panel.appendChild(pilotImg);

  const title = document.createElement('div');
  title.textContent = 'YOU SAVED HUMANITY FROM EVIL!';
  title.style.cssText = `
    font-size:32px;font-weight:bold;color:#ffcc00;letter-spacing:3px;
    margin-bottom:8px;text-align:center;
    text-shadow:0 0 20px rgba(255,204,0,0.5);
    animation: heroGlow 1.5s ease-in-out infinite alternate;
  `;
  panel.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.textContent = 'GREAT JOB!';
  subtitle.style.cssText = 'font-size:22px;color:#44ff44;margin-bottom:8px;font-weight:bold;letter-spacing:4px;';
  panel.appendChild(subtitle);

  const scoreText = document.createElement('div');
  scoreText.textContent = `FINAL SCORE: ${finalScore.toLocaleString()}`;
  scoreText.style.cssText = 'font-size:20px;margin-bottom:24px;color:#fff;';
  panel.appendChild(scoreText);

  // Inject glow animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes heroGlow { from { filter:brightness(1); } to { filter:brightness(1.2); } }
  `;
  document.head.appendChild(style);

  // Play yay sound
  if (arena?.sound) {
    arena.sound.yay();
  }

  // Name entry
  const nameLabel = document.createElement('div');
  nameLabel.textContent = 'ENTER YOUR NAME:';
  nameLabel.style.cssText = 'font-size:14px;color:#aaa;margin-bottom:8px;';
  panel.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 12;
  nameInput.value = 'PILOT';
  nameInput.style.cssText = `
    width:200px;padding:10px;background:rgba(17,24,34,0.9);
    border:2px solid #ffcc00;color:#fff;font-size:18px;font-family:Arial,sans-serif;
    text-align:center;border-radius:4px;outline:none;
  `;
  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 12);
  });
  panel.appendChild(nameInput);

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'SAVE SCORE';
  submitBtn.style.cssText = `
    margin-top:16px;padding:12px 32px;background:#ffcc00;color:#000;
    font-size:16px;font-weight:bold;border:none;border-radius:4px;
    cursor:pointer;font-family:Arial,sans-serif;
  `;
  submitBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'PILOT';
    addHighScore({
      name,
      score: finalScore,
      level: currentLevelIndex + 1,
      difficulty: currentDifficulty,
      date: new Date().toISOString(),
    });
    sceneManager.transition('title');
  });
  panel.appendChild(submitBtn);

  setTimeout(() => nameInput.focus(), 100);
}

function showGameOverOverlay(): void {
  const panel = createOverlayPanel();

  // Villain portrait — big, menacing, centered
  const villainImg = document.createElement('img');
  villainImg.src = '/portraits/villain.jpg';
  villainImg.alt = 'Villain';
  villainImg.style.cssText = `
    width:180px;height:180px;border-radius:50%;object-fit:cover;
    border:4px solid #ff4444;margin-bottom:16px;
    animation: villainBounce 0.5s ease-out;
  `;
  panel.appendChild(villainImg);

  const taunt = document.createElement('div');
  taunt.textContent = 'TRY AGAIN LOSER!';
  taunt.style.cssText = `
    font-size:42px;font-weight:bold;color:#ff4444;letter-spacing:3px;
    margin-bottom:8px;text-shadow:0 0 20px rgba(255,68,68,0.5);
    animation: villainBounce 0.5s ease-out;
  `;
  panel.appendChild(taunt);

  const subtitle = document.createElement('div');
  subtitle.textContent = 'MWAHAHAHA!';
  subtitle.style.cssText = 'font-size:20px;color:#ff8844;margin-bottom:8px;font-style:italic;letter-spacing:4px;';
  panel.appendChild(subtitle);

  const scoreText = document.createElement('div');
  scoreText.textContent = `SCORE: ${(arena?.score ?? 0).toLocaleString()}`;
  scoreText.style.cssText = 'font-size:20px;margin-bottom:28px;color:#aaa;';
  panel.appendChild(scoreText);

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'PLAY AGAIN';
  retryBtn.style.cssText = `
    padding:14px 40px;background:rgba(17,24,34,0.9);border:2px solid #ff4444;
    color:#ff4444;font-size:18px;font-weight:bold;font-family:Arial,sans-serif;
    cursor:pointer;border-radius:4px;
  `;
  retryBtn.addEventListener('click', () => {
    sceneManager.transition('title');
  });
  panel.appendChild(retryBtn);

  // Inject animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes villainBounce { from { transform:scale(1.3);opacity:0; } to { transform:scale(1);opacity:1; } }
  `;
  document.head.appendChild(style);

  // Play evil laugh sound
  if (arena?.sound) {
    arena.sound.evilLaugh();
  }
}

// ── Animation Loop ──

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  if (sceneManager.current === 'arena' && arena) {
    updateArena(arena, keys, dt, now);

    // Update HUD
    if (hud) {
      hud.update(arena.player, arena.enemies, arena.score, currentLevelIndex + 1, bundle.camera);
    }

    // Check win/lose — wait 2.5s for explosions to play out
    const TRANSITION_DELAY = 4000; // wait for 3s explosion to finish

    if (arena.victory && now - arena.victoryTime > TRANSITION_DELAY) {
      const hasNext = advanceLevel(
        arena.player.hull,
        arena.player.maxHull,
        arena.player.maxShield,
        arena.score - totalScore,
      );
      if (hasNext) {
        sceneManager.transition('levelIntro');
      } else {
        sceneManager.transition('highScore');
      }
    } else if (arena.gameOver && now - arena.gameOverTime > TRANSITION_DELAY) {
      sceneManager.transition('gameOver');
    }
  } else if (sceneManager.current === 'title') {
    // Slowly rotate camera for cinematic idle
    const t = clock.elapsedTime * 0.1;
    bundle.camera.position.set(Math.sin(t) * 30, 10, Math.cos(t) * 30);
    bundle.camera.lookAt(0, 0, 0);
  }

  bundle.composer.render();
}

// ── Bootstrap ──
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}

export { bundle };
