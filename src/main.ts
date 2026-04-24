// ── OH-YUM BLASTER 3D — Main Entry Point ────────────────
// Full game loop: title → charSelect → levelIntro → arena → highScore

import * as THREE from 'three';
import { createRenderer, handleRendererResize, type RendererBundle } from './renderer/SetupRenderer';
import { createSpaceEnvironment, type SpaceEnvironment } from './renderer/Environment';
import { SceneManager, type SceneState } from './state/SceneManager';
import { createArenaState, updateArena, cleanupArena, type ArenaState } from './scenes/ArenaLoop';
import { HUD3D } from './ui/HUD3D';
import { setDifficulty, type DifficultyLevel } from './state/Difficulty';
import { resetLevelState, currentLevelIndex, advanceLevel, getCurrentLevel, totalScore } from './state/LevelState';
import { setCharacter, currentCharacter, CHARACTERS, type CharacterName, type CharacterConfig } from './state/Character';
import { addHighScore, getHighScores } from './state/HighScores';
import { currentDifficulty } from './state/Difficulty';
import { COLORS } from './config';
import { SoundSystem } from './systems/SoundSystem';
import { getSpawnTaunt, getWinTaunt } from './config/VillainTaunts';
import { createCinematic, updateCinematic, cleanupCinematic, type CinematicState } from './scenes/TakeoffCinematic';
import { createMarsLaunch, updateMarsLaunch, cleanupMarsLaunch, type MarsLaunchState } from './scenes/MarsLaunch';
import { createMarsLanding, updateMarsLanding, isMarsLandingComplete, cleanupMarsLanding, type MarsLandingState } from './scenes/MarsLanding';
import { setMissionPhase } from './state/LevelState';
import { checkCelestialCollisions } from './systems/EnvironmentLoader';
// import { preloadShipModels } from './ships/ShipGeometry'; // disabled — using procedural ships

// ── Globals ──
let bundle: RendererBundle;
let clock: THREE.Clock;
let sceneManager: SceneManager;
let arena: ArenaState | null = null;
let hud: HUD3D | null = null;
let cinematic: CinematicState | null = null;
let marsLaunch: MarsLaunchState | null = null;
let marsLanding: MarsLandingState | null = null;
let spaceEnv: SpaceEnvironment;
let globalSound: import('./systems/SoundSystem').SoundSystem | null = null;
const keys: Record<string, boolean> = {};

// ── Overlay elements ──
let overlayEl: HTMLDivElement;
let crosshairEl: HTMLElement;
let pauseOverlay: HTMLDivElement | null = null;

function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Missing #game-canvas element');

  overlayEl = document.getElementById('ui-overlay') as HTMLDivElement;
  crosshairEl = document.getElementById('crosshair') as HTMLElement;

  // ── Renderer + environment ──
  bundle = createRenderer(canvas);
  spaceEnv = createSpaceEnvironment(bundle.scene, bundle.renderer, bundle.camera);

  // Start camera in a cinematic position
  bundle.camera.position.set(0, 10, 30);
  bundle.camera.lookAt(0, 0, 0);

  // ── Input ──
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape' && sceneManager.current === 'arena' && arena) {
      togglePause();
    }
  });
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

  // Start music on first click (browser autoplay policy requires user gesture)
  const startGlobalMusic = () => {
    if (!globalSound) {
      globalSound = SoundSystem.getInstance();
      globalSound.init();
      globalSound.startMusic();
    }
    document.removeEventListener('click', startGlobalMusic);
    document.removeEventListener('touchstart', startGlobalMusic);
  };
  document.addEventListener('click', startGlobalMusic);
  document.addEventListener('touchstart', startGlobalMusic);

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
      crosshairEl.style.display = 'none';
      showLevelIntroOverlay();
      break;
    case 'cinematic':
      startCinematic();
      break;
    case 'marsLaunch':
      startMarsLaunch();
      break;
    case 'marsLanding':
      // Mars landing removed — skip to high score
      sceneManager.transition('highScore');
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
  removePauseOverlay();
  if (state === 'arena' && arena) {
    cleanupArena(arena, bundle.scene);
    hud?.destroy();
    hud = null;
    arena = null;
    crosshairEl.style.display = 'none';
  }
  if (state === 'cinematic' && cinematic) {
    cleanupCinematic(cinematic, bundle.scene);
    cinematic = null;
  }
  if (state === 'marsLaunch' && marsLaunch) {
    cleanupMarsLaunch(marsLaunch, bundle.scene);
    marsLaunch = null;
  }
  if (state === 'marsLanding' && marsLanding) {
    marsLanding = null;
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
  // Force-remove any lingering death-fx elements (spawned by setTimeout during player death)
  document.querySelectorAll('.death-fx, .explosion-fx').forEach(el => el.remove());
}

function createOverlayPanel(cssClass = 'game-overlay'): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = cssClass;
  overlayEl.appendChild(panel);
  return panel;
}

function showTitleOverlay(): void {
  const panel = createOverlayPanel();

  // Prodigy logo — large and prominent
  const logo = document.createElement('img');
  logo.src = '/portraits/prodigy-logo.png';
  logo.alt = 'Prodigy Promos';
  logo.style.cssText = 'width:clamp(40px,15vw,200px);height:auto;max-height:clamp(40px,10vh,200px);object-fit:contain;margin-bottom:clamp(4px,1vh,24px);filter:drop-shadow(0 0 30px rgba(0,200,255,0.2));animation:fadeIn 0.4s ease-out both;';
  panel.appendChild(logo);

  const title = document.createElement('div');
  title.textContent = 'PRODIGY BLASTER';
  title.className = 'title-hero';
  panel.appendChild(title);

  const spacer = document.createElement('div');
  spacer.style.cssText = 'margin-bottom:clamp(2px,1vh,20px);';
  panel.appendChild(spacer);

  const selectLabel = document.createElement('div');
  selectLabel.textContent = 'SELECT DIFFICULTY';
  selectLabel.className = 'section-label';
  selectLabel.style.marginBottom = '16px';
  panel.appendChild(selectLabel);

  const difficulties: { key: DifficultyLevel; label: string; color: string; desc: string }[] = [
    { key: 'beginner', label: 'BEGINNER', color: '#44ff44', desc: 'Slow enemy • Extra shields • Relaxed pace' },
    { key: 'intermediate', label: 'INTERMEDIATE', color: '#ffcc00', desc: 'Balanced combat • Standard loadout' },
    { key: 'expert', label: 'EXPERT', color: '#ff4444', desc: 'Fast & aggressive • Tough enemy • Less armor' },
  ];

  for (const d of difficulties) {
    const btn = document.createElement('button');
    btn.className = 'overlay-btn';
    btn.style.borderColor = d.color;
    btn.style.color = d.color;
    btn.textContent = d.label;

    const desc = document.createElement('div');
    desc.textContent = d.desc;
    desc.className = 'btn-desc';
    btn.appendChild(desc);

    btn.addEventListener('click', () => {
      setDifficulty(d.key);
      resetLevelState();
      sceneManager.transition('charSelect');
    });
    panel.appendChild(btn);
  }

  // High scores
  const scores = getHighScores();
  if (scores.length > 0) {
    const hsTitle = document.createElement('div');
    hsTitle.textContent = 'HIGH SCORES';
    hsTitle.className = 'hs-title';
    panel.appendChild(hsTitle);

    for (const entry of scores.slice(0, 5)) {
      const row = document.createElement('div');
      row.textContent = `${entry.name} — ${entry.score.toLocaleString()}`;
      row.className = 'hs-row';
      panel.appendChild(row);
    }
  }

}

function showCharSelectOverlay(): void {
  const panel = createOverlayPanel();

  const title = document.createElement('div');
  title.textContent = 'CHOOSE YOUR PILOT';
  title.style.cssText = 'font-family:var(--font-display);font-size:clamp(16px,4vw,24px);font-weight:700;letter-spacing:4px;margin-bottom:clamp(8px,2vh,24px);text-align:center;color:var(--text-dim);animation:fadeIn 0.5s ease-out both;';
  panel.appendChild(title);

  // Pull pilots from Character config
  const charEntries = Object.entries(CHARACTERS) as [CharacterName, CharacterConfig][];

  const grid = document.createElement('div');
  grid.className = 'char-grid-mobile';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(6px,2vw,16px);justify-items:center;max-width:min(900px,95vw);width:95vw;';

  for (const [id, cfg] of charEntries) {
    const hex = '#' + cfg.color.toString(16).padStart(6, '0');
    const card = document.createElement('button');
    card.className = 'char-card';
    card.style.borderColor = hex;
    card.style.width = '100%';
    card.style.maxWidth = '210px';
    card.style.padding = 'clamp(6px, 1.5vw, 14px) clamp(4px, 1vw, 12px)';

    // Portrait wrapper — fixed-size circle that clips the image inside
    const portraitWrap = document.createElement('div');
    const portraitSize = 'clamp(55px,16vw,165px)';
    portraitWrap.style.cssText = `width:${portraitSize};height:${portraitSize};border-radius:50%;overflow:hidden;margin:0 auto 8px;border:2px solid ${hex};flex-shrink:0;`;

    const portrait = document.createElement('img');
    portrait.src = `/portraits/${id}.jpg`;
    portrait.alt = cfg.label;
    // Per-character zoom: scale controls crop tightness, position centers the face
    // scale > 1 = zoom in on face, scale < 1 = zoom out to show more
    const cropOverrides: Record<string, { scale: number; pos: string }> = {
      owen: { scale: 1.15, pos: '50% 35%' },
      william: { scale: 1.1, pos: '50% 40%' },
      ethan: { scale: 1.1, pos: '50% 35%' },
      austin: { scale: 1, pos: '50% 45%' },
    };
    const crop = cropOverrides[id] || { scale: 1, pos: '50% 40%' };
    portrait.style.cssText = `width:100%;height:100%;object-fit:cover;object-position:${crop.pos};transform:scale(${crop.scale});`;
    portraitWrap.appendChild(portrait);
    card.appendChild(portraitWrap);

    const name = document.createElement('div');
    name.textContent = cfg.label;
    name.style.cssText = 'font-family:var(--font-display);font-size:clamp(11px,2.5vw,14px);font-weight:700;margin-bottom:4px;letter-spacing:2px;';
    card.appendChild(name);

    const tag = document.createElement('div');
    tag.textContent = cfg.tagline;
    tag.style.cssText = 'font-size:clamp(9px,2vw,11px);color:rgba(200,215,230,0.85);letter-spacing:0.5px;';
    card.appendChild(tag);

    card.addEventListener('click', () => {
      setCharacter(id);
      sceneManager.transition('levelIntro');
    });
    grid.appendChild(card);
  }

  panel.appendChild(grid);
}

// Villain intro data — portrait, name, and taunt per level
const VILLAIN_INTROS = [
  { name: 'BOLO TIE', portrait: 'bolo-tie.jpg', taunt: 'Wo unto the liar...' },
  { name: 'BOW TIE', portrait: 'bow-tie.jpg', taunt: 'Are you a thug nasty?' },
  { name: 'BISHOP', portrait: 'bishop.jpg', taunt: 'I find you deplorable!' },
];

function showLevelIntroOverlay(): void {
  const panel = createOverlayPanel();
  const level = getCurrentLevel();

  // Level number
  const levelText = document.createElement('div');
  levelText.textContent = `LEVEL ${level.level}`;
  levelText.style.cssText = `
    font-family:var(--font-display);font-size:clamp(32px,10vw,64px);font-weight:900;letter-spacing:6px;
    background:linear-gradient(180deg, #fff 10%, var(--cyan) 100%);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
    filter:drop-shadow(0 0 30px var(--cyan-glow));animation:scaleIn 0.5s ease-out;
  `;
  panel.appendChild(levelText);

  const subtitle = document.createElement('div');
  subtitle.textContent = level.subtitle;
  subtitle.style.cssText = 'font-size:18px;color:var(--gold);margin-top:12px;letter-spacing:3px;opacity:0;animation:fadeIn 0.5s 0.3s forwards;';
  panel.appendChild(subtitle);

  // ── Villain intro cards — show new enemies for this level ──
  const villainRow = document.createElement('div');
  villainRow.style.cssText = 'display:flex;gap:clamp(10px,3vw,30px);margin-top:clamp(12px,3vh,30px);opacity:0;animation:fadeIn 0.6s 0.8s forwards;flex-wrap:wrap;justify-content:center;';

  // Show villains up to current level (Level 1 = index 0, Level 2 = 0+1, etc.)
  for (let i = 0; i < level.level && i < VILLAIN_INTROS.length; i++) {
    const villain = VILLAIN_INTROS[i];
    const isNew = i === level.level - 1; // highlight the newest enemy

    const card = document.createElement('div');
    card.className = isNew ? 'villain-card new-threat' : 'villain-card';

    // Portrait
    const img = document.createElement('img');
    img.src = `/portraits/${villain.portrait}?v=2`;
    img.alt = villain.name;
    img.loading = 'eager';
    img.className = 'portrait-villain';
    card.appendChild(img);

    // Name
    const name = document.createElement('div');
    name.textContent = villain.name;
    name.style.cssText = `
      font-family:var(--font-display);font-size:14px;font-weight:700;
      color:${isNew ? 'var(--red)' : '#664444'};
      letter-spacing:2px;margin-bottom:6px;
      ${isNew ? 'text-shadow:0 0 10px var(--red-glow);' : ''}
    `;
    card.appendChild(name);

    villainRow.appendChild(card);
  }

  panel.appendChild(villainRow);

  // Inject animations
  if (!document.getElementById('level-intro-css')) {
    const style = document.createElement('style');
    style.id = 'level-intro-css';
    style.textContent = `
      @keyframes scaleIn { from { transform:scale(0.3);opacity:0; } to { transform:scale(1);opacity:1; } }
      @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      @keyframes villainPulse { from { border-color:#ff4444;box-shadow:0 0 15px rgba(255,50,0,0.3); } to { border-color:#ff6644;box-shadow:0 0 30px rgba(255,50,0,0.5); } }
    `;
    document.head.appendChild(style);
  }

  // Brief pause to register level + villain — 2.5s
  setTimeout(() => {
    if (sceneManager.current === 'levelIntro') {
      sceneManager.transition('arena');
    }
  }, 2500);
}

function togglePause(): void {
  if (!arena) return;
  arena.paused = !arena.paused;

  if (arena.paused) {
    // Show pause overlay
    pauseOverlay = document.createElement('div');
    pauseOverlay.id = 'pause-overlay';
    pauseOverlay.className = 'pause-overlay';

    const title = document.createElement('div');
    title.textContent = 'PAUSED';
    title.className = 'title-hero';
    title.style.marginBottom = '24px';
    pauseOverlay.appendChild(title);

    const hint = document.createElement('div');
    hint.textContent = 'Press ESC to resume';
    hint.style.cssText = 'font-size:15px;color:var(--text-dim);letter-spacing:2px;margin-bottom:32px;';
    pauseOverlay.appendChild(hint);

    const quitBtn = document.createElement('button');
    quitBtn.textContent = 'QUIT TO TITLE';
    quitBtn.className = 'overlay-btn';
    quitBtn.style.borderColor = 'var(--red)';
    quitBtn.style.color = 'var(--red)';
    quitBtn.style.width = 'auto';
    quitBtn.style.padding = '12px 32px';
    quitBtn.addEventListener('click', () => {
      arena!.paused = false;
      removePauseOverlay();
      sceneManager.transition('title');
    });
    pauseOverlay.appendChild(quitBtn);

    overlayEl.appendChild(pauseOverlay);
  } else {
    removePauseOverlay();
  }
}

function removePauseOverlay(): void {
  if (pauseOverlay) {
    pauseOverlay.remove();
    pauseOverlay = null;
  }
}

function startCinematic(): void {
  crosshairEl.style.display = 'none';
  cinematic = createCinematic(bundle.scene, bundle.camera);
}

function startMarsLaunch(): void {
  crosshairEl.style.display = 'block';
  setMissionPhase('launch');
  // Ensure globalSound exists and its AudioContext is active
  if (!globalSound) {
    globalSound = SoundSystem.getInstance();
    globalSound.init();
  }
  globalSound.stopMusic(); // silence music so engine roar is clear
  marsLaunch = createMarsLaunch(bundle.scene, bundle.camera);
}

function startMarsLanding(): void {
  crosshairEl.style.display = 'block';
  setMissionPhase('landing');
  marsLanding = createMarsLanding(bundle.scene, bundle.camera);
}

function startArena(): void {
  const charConfig = CHARACTERS[currentCharacter];
  const playerColor = charConfig?.color ?? COLORS.player;

  arena = createArenaState(
    bundle.scene,
    bundle.camera,
    currentLevelIndex + 1,
    totalScore,
    playerColor,
  );

  // Pre-compile all materials now visible in the scene. Avoids 50-250ms
  // synchronous shader-compile stalls the first time each material is drawn
  // (which is what causes the periodic "freeze" feel during combat).
  bundle.renderer.compile(bundle.scene, bundle.camera);

  hud = new HUD3D();
  crosshairEl.style.display = 'block';

  // Level start sound
  arena.sound.levelStart();
}

function showHighScoreOverlay(): void {
  const panel = createOverlayPanel();
  const finalScore = arena?.score ?? totalScore;

  // Pilot portrait — victory celebration
  const pilotImg = document.createElement('img');
  pilotImg.src = `/portraits/${currentCharacter}.jpg`;
  pilotImg.alt = currentCharacter;
  pilotImg.style.cssText = `
    width:clamp(80px,20vw,160px);height:clamp(80px,20vw,160px);border-radius:50%;object-fit:cover;
    border:3px solid var(--gold);margin-bottom:12px;
    animation:heroGlow 1.5s ease-in-out infinite alternate;
  `;
  panel.appendChild(pilotImg);

  const title = document.createElement('div');
  title.textContent = 'YOU SAVED HUMANITY FROM EVIL!';
  title.style.cssText = `
    font-family:var(--font-display);font-size:clamp(16px,4vw,26px);font-weight:700;color:var(--gold);
    letter-spacing:3px;margin-bottom:8px;text-align:center;
    text-shadow:0 0 20px var(--gold-glow);
    animation:heroGlow 1.5s ease-in-out infinite alternate;
  `;
  panel.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.textContent = 'GREAT JOB!';
  subtitle.style.cssText = 'font-size:20px;color:var(--green);margin-bottom:8px;font-weight:700;letter-spacing:4px;';
  panel.appendChild(subtitle);

  const scoreText = document.createElement('div');
  scoreText.textContent = `FINAL SCORE: ${finalScore.toLocaleString()}`;
  scoreText.className = 'score-display';
  scoreText.style.marginBottom = '24px';
  panel.appendChild(scoreText);

  // Play victory sounds
  if (arena?.sound) {
    arena.sound.victory();
    setTimeout(() => arena?.sound.yay(), 800);
  }

  // Name entry
  const nameLabel = document.createElement('div');
  nameLabel.textContent = 'ENTER YOUR NAME:';
  nameLabel.className = 'section-label';
  nameLabel.style.marginBottom = '8px';
  panel.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 12;
  nameInput.placeholder = 'YOUR NAME';
  nameInput.style.cssText = `
    width:220px;padding:12px 16px;background:var(--panel-bg);
    border:1px solid var(--gold);color:var(--text-bright);font-size:18px;font-family:var(--font-body);
    text-align:center;border-radius:4px;outline:none;letter-spacing:2px;
  `;
  nameInput.addEventListener('input', () => {
    nameInput.value = nameInput.value.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 12);
  });
  panel.appendChild(nameInput);

  const submitScore = () => {
    const name = nameInput.value.trim() || 'ANON';
    addHighScore({
      name,
      score: finalScore,
      level: currentLevelIndex + 1,
      difficulty: currentDifficulty,
      date: new Date().toISOString(),
    });
    sceneManager.transition('title');
  };

  // Submit on Enter/Return key
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitScore();
  });

  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'SAVE SCORE';
  submitBtn.className = 'overlay-btn';
  submitBtn.style.cssText = 'margin-top:16px;width:auto;padding:12px 32px;border-color:var(--gold);color:var(--gold);text-align:center;display:block;margin-left:auto;margin-right:auto;';
  submitBtn.addEventListener('click', submitScore);
  panel.appendChild(submitBtn);

  setTimeout(() => nameInput.focus(), 100);
}

function showGameOverOverlay(): void {
  const panel = createOverlayPanel();

  // Villain portrait — show the enemy from the current level
  const enemyPortraits = ['bolo-tie.jpg', 'bow-tie.jpg', 'bishop.jpg'];
  const villainFile = enemyPortraits[Math.min(currentLevelIndex, enemyPortraits.length - 1)];
  const villainImg = document.createElement('img');
  villainImg.src = `/portraits/${villainFile}`;
  villainImg.alt = 'Villain';
  villainImg.style.cssText = `
    width:clamp(80px,18vw,180px);height:clamp(80px,18vw,180px);border-radius:50%;object-fit:cover;
    border:3px solid var(--red);margin-bottom:clamp(6px,1.5vh,12px);
    filter:drop-shadow(0 0 20px var(--red-glow));
    animation:villainBounce 0.5s ease-out;
  `;
  panel.appendChild(villainImg);

  // Villain monologue — pull from VillainTaunts config
  const villainKeys = ['bolo_tie', 'bow_tie', 'bishop'];
  const villainKey = villainKeys[Math.min(currentLevelIndex, villainKeys.length - 1)];
  const winLine = getWinTaunt(villainKey) ?? 'You lose!';
  const monologue = document.createElement('div');
  monologue.textContent = winLine;
  monologue.style.cssText = `
    font-size:clamp(16px,4vw,36px);font-weight:700;color:var(--red);font-style:italic;
    letter-spacing:2px;margin-bottom:clamp(8px,1.5vh,16px);text-align:center;
    text-shadow:0 0 20px var(--red-glow);
    animation:villainBounce 0.5s ease-out;
  `;
  panel.appendChild(monologue);

  const scoreText = document.createElement('div');
  scoreText.textContent = `SCORE: ${(arena?.score ?? 0).toLocaleString()}`;
  scoreText.className = 'score-display';
  scoreText.style.cssText = 'margin-bottom:28px;opacity:0.7;';
  panel.appendChild(scoreText);

  const retryBtn = document.createElement('button');
  retryBtn.textContent = 'PLAY AGAIN';
  retryBtn.className = 'overlay-btn';
  retryBtn.style.cssText = 'width:auto;padding:14px 40px;border-color:var(--red);color:var(--red);';
  retryBtn.addEventListener('click', () => {
    sceneManager.transition('title');
  });
  panel.appendChild(retryBtn);

  // villainBounce animation defined in index.html theme CSS

  // Play defeat + evil laugh sounds
  if (arena?.sound) {
    arena.sound.defeat();
    setTimeout(() => arena?.sound.evilLaugh(), 400);
  }
}

// ── Animation Loop ──

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  if (sceneManager.current === 'arena' && arena) {
    // Taunt callback — only spawn taunts now
    const tauntCb = (villainId: string, _event: string) => {
      const text = getSpawnTaunt(villainId);
      if (text && hud) hud.showTaunt(text);
    };
    updateArena(arena, keys, dt, now, tauntCb);

    // Check planet/moon collisions (high speed = instant death)
    if (spaceEnv && arena.player.alive) {
      checkCelestialCollisions(
        arena.player,
        [
          { group: spaceEnv.planet, radius: spaceEnv.planetRadius },
          { group: spaceEnv.moon, radius: spaceEnv.moonRadius },
        ],
        arena.explosions,
        bundle.camera,
      );
    }

    // Update HUD
    if (hud) {
      const isThrusting = keys['KeyE'] || arena.touchControls.getInput().thrust > 0;
      const playerSpeed = arena.player.velocity.length();
      hud.update(arena.player, arena.enemies, arena.score, currentLevelIndex + 1, bundle.camera, isThrusting, playerSpeed, arena.lockedTargetIndex);
      hud.updateTaunts(dt);
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
  } else if (sceneManager.current === 'cinematic' && cinematic) {
    updateCinematic(cinematic, bundle.camera, dt);
    if (cinematic.done) {
      sceneManager.transition('arena');
    }
  } else if (sceneManager.current === 'marsLaunch' && marsLaunch) {
    updateMarsLaunch(marsLaunch, keys, dt, now, bundle.scene);
    if (marsLaunch.crashed && now - marsLaunch.crashTime > 2000) {
      sceneManager.transition('title');
    } else if (marsLaunch.orbitReached && now - marsLaunch.orbitTimer > 2000) {
      sceneManager.transition('levelIntro');
    }
  } else if (sceneManager.current === 'title') {
    // Slowly rotate camera for cinematic idle
    const t = clock.elapsedTime * 0.1;
    bundle.camera.position.set(Math.sin(t) * 30, 10, Math.cos(t) * 30);
    bundle.camera.lookAt(0, 0, 0);
  }

  // Slow planet/moon rotation for realism + keep skybox centered on camera
  if (spaceEnv) {
    spaceEnv.planet.rotation.y += dt * 0.02;
    spaceEnv.moon.rotation.y += dt * 0.05;

    // Lock skybox + starfield + nebulae to camera so you never fly past the sky
    const camPos = bundle.camera.position;
    spaceEnv.skybox.position.copy(camPos);
    spaceEnv.stars.position.copy(camPos);
    spaceEnv.nebulae.position.copy(camPos);
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
