// ── HUD Overlay (HTML/CSS) ───────────────────────────────
// DOM-based HUD rendered over the 3D scene.
// Shield bar, hull bar, score, targets, level indicator.
// All content is static/hardcoded — no user input rendered as HTML.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { currentCharacter } from '../state/Character';

/** Villain names — mapped by enemy index across all levels. */
const ENEMY_NAMES = ['BOLO TIE', 'BOW TIE', 'BISHOP'];

/** Villain portrait filenames in public/portraits/ — mapped by enemy index. */
const ENEMY_PORTRAITS = ['bolo-tie.jpg', 'bow-tie.jpg', 'bishop.jpg'];

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'id') e.id = v;
    else e.style.setProperty(k, v);
  }
  if (text) e.textContent = text;
  return e;
}

export class HUD3D {
  private container: HTMLDivElement;
  private shieldBar: HTMLDivElement;
  private hullBar: HTMLDivElement;
  private scoreEl: HTMLSpanElement;
  private targetsEl: HTMLSpanElement;
  private levelEl: HTMLSpanElement;
  private speedLinesEl: HTMLDivElement;
  private tauntEl: HTMLDivElement;
  private tauntTextEl: HTMLSpanElement;
  private tauntTimer = 0;
  private tauntCooldown = 0;
  private tauntTypewriterText = '';
  private tauntTypewriterIdx = 0;
  private tauntTypewriterTimer = 0;
  private altitudeEl: HTMLDivElement;
  private descentRateEl: HTMLDivElement;
  private landingStatusEl: HTMLDivElement;
  private landingStatusTimer = 0;
  private lastStatusText = '';
  private missionPhase: 'launch' | 'combat' | 'landing' | null = null;

  constructor() {
    const overlay = document.getElementById('ui-overlay')!;

    // Inject scoped styles
    const style = document.createElement('style');
    style.textContent = `
      #hud { position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20;font-family:var(--font-body); }
      .hud-top-left { position:absolute;top:16px;left:16px; }
      .hud-bar-container { width:clamp(140px,25vw,200px);height:12px;background:rgba(0,0,0,0.5);border:1px solid rgba(60,100,160,0.15);border-radius:2px;margin-bottom:6px;overflow:hidden; }
      .hud-bar-fill { height:100%;transition:width 0.15s ease-out;border-radius:1px; }
      .hud-bar-label { font-size:clamp(9px,1.5vw,10px);color:var(--text-dim,#5a6e86);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px;font-weight:500; }
      .hud-shield-fill { background:linear-gradient(90deg,#005577,#00bbee); }
      .hud-hull-fill { background:linear-gradient(90deg,#1a6622,#36ff6e); }
      .hud-top-center { position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:13px;font-weight:700;color:rgba(180,200,220,0.25);letter-spacing:5px;font-family:var(--font-display); }
      .hud-bottom-left { position:absolute;bottom:clamp(8px,3vh,20px);left:16px;font-size:14px;color:#fff;z-index:25; }
      .hud-score { font-size:17px;font-weight:700;color:#ffd042;text-shadow:0 0 8px rgba(255,208,66,0.6),0 0 16px rgba(255,180,0,0.2);font-family:var(--font-display);letter-spacing:1px; }
      .hud-targets { font-size:13px;color:var(--text-primary,#d0dae8);margin-top:4px;text-shadow:0 0 4px rgba(200,200,200,0.3); }
      .hud-level { font-size:15px;font-weight:600;color:rgba(140,180,220,0.8);margin-top:4px;text-shadow:0 0 4px rgba(140,180,220,0.3);letter-spacing:1px; }
      .hud-bottom-right { position:absolute;bottom:clamp(8px,3vh,20px);right:16px;font-size:12px;font-weight:700;color:#36ff6e;letter-spacing:3px;text-shadow:0 0 8px rgba(54,255,110,0.4);z-index:25;font-family:var(--font-display);opacity:0.6; }

      /* ── Cockpit frame overlay ── */
      .cockpit-frame {
        position:fixed;
        bottom:0;left:0;right:0;
        height:22vh;
        pointer-events:none;
        z-index:19;
        background:linear-gradient(
          to top,
          rgba(8,12,18,0.95) 0%,
          rgba(12,18,28,0.85) 30%,
          rgba(18,26,38,0.5) 65%,
          transparent 100%
        );
        border-top:1px solid rgba(40,80,140,0.08);
      }
      .cockpit-frame::before {
        content:'';
        position:absolute;
        top:0;left:0;right:0;
        height:1px;
        background:linear-gradient(90deg, transparent 10%, rgba(60,120,200,0.08) 30%, rgba(60,120,200,0.12) 50%, rgba(60,120,200,0.08) 70%, transparent 90%);
      }
      .cockpit-frame::after {
        content:'';
        position:absolute;
        bottom:0;left:50%;
        transform:translateX(-50%);
        width:40%;height:60%;
        background:radial-gradient(ellipse at center bottom, rgba(0,100,180,0.06) 0%, transparent 70%);
      }
      .cockpit-strut {
        position:absolute;
        bottom:0;
        width:2px;
        height:100%;
        background:linear-gradient(to top, rgba(60,100,140,0.3), transparent);
      }
      .cockpit-strut.left { left:20%; transform:rotate(8deg); transform-origin:bottom center; }
      .cockpit-strut.right { right:20%; transform:rotate(-8deg); transform-origin:bottom center; }
      .cockpit-strut.center { left:50%; transform:translateX(-50%); width:1px; background:linear-gradient(to top, rgba(60,100,140,0.15), transparent 70%); }

      /* ── Villain taunt popup ── */
      .taunt-popup {
        position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
        max-width:420px;padding:12px 22px;
        background:rgba(30,6,6,0.8);
        border:1px solid rgba(255,59,59,0.3);border-radius:6px;
        color:#ff8866;font-size:18px;font-style:italic;
        font-family:var(--font-body);letter-spacing:0.5px;
        z-index:25;pointer-events:none;
        opacity:0;transition:opacity 0.3s ease-out;
        text-shadow:0 0 6px rgba(255,50,0,0.2);
        line-height:1.4;text-align:center;
        backdrop-filter:blur(8px);
      }
      .taunt-popup.visible { opacity:1; }

      /* ── Speed lines overlay ── */
      .speed-lines {
        position:fixed;top:0;left:0;width:100%;height:100%;
        pointer-events:none;z-index:18;opacity:0;
        transition:opacity 0.3s ease-out;
        background:
          linear-gradient(175deg, transparent 45%, rgba(255,255,255,0.04) 47%, transparent 49%),
          linear-gradient(185deg, transparent 45%, rgba(255,255,255,0.03) 47%, transparent 49%),
          linear-gradient(170deg, transparent 44%, rgba(200,220,255,0.04) 46%, transparent 48%),
          linear-gradient(190deg, transparent 44%, rgba(200,220,255,0.03) 46%, transparent 48%),
          linear-gradient(178deg, transparent 43%, rgba(255,255,255,0.02) 45%, transparent 47%),
          linear-gradient(182deg, transparent 43%, rgba(255,255,255,0.02) 45%, transparent 47%);
        mask-image:radial-gradient(ellipse at center, transparent 30%, black 70%);
        -webkit-mask-image:radial-gradient(ellipse at center, transparent 30%, black 70%);
      }
    `;
    document.head.appendChild(style);

    this.container = document.createElement('div');
    this.container.id = 'hud';

    // Top-left: bars
    const topLeft = el('div', { class: 'hud-top-left' });

    topLeft.appendChild(el('div', { class: 'hud-bar-label' }, 'DEFLECTOR'));
    const shieldContainer = el('div', { class: 'hud-bar-container' });
    this.shieldBar = el('div', { class: 'hud-bar-fill hud-shield-fill' }) as HTMLDivElement;
    this.shieldBar.style.width = '100%';
    shieldContainer.appendChild(this.shieldBar);
    topLeft.appendChild(shieldContainer);

    topLeft.appendChild(el('div', { class: 'hud-bar-label' }, 'HULL'));
    const hullContainer = el('div', { class: 'hud-bar-container' });
    this.hullBar = el('div', { class: 'hud-bar-fill hud-hull-fill' }) as HTMLDivElement;
    this.hullBar.style.width = '100%';
    hullContainer.appendChild(this.hullBar);
    topLeft.appendChild(hullContainer);

    // Pilot portrait + logo/name column
    const pilotRow = document.createElement('div');
    pilotRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px;';
    const pilotImg = document.createElement('img');
    pilotImg.src = `/portraits/${currentCharacter}.jpg`;
    pilotImg.alt = currentCharacter;
    pilotImg.style.cssText = 'width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid rgba(100,150,200,0.3);';
    pilotRow.appendChild(pilotImg);
    // Stacked column: logo above name
    const pilotInfo = document.createElement('div');
    pilotInfo.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;';
    const prodigyLogo = document.createElement('img');
    prodigyLogo.src = '/portraits/prodigy-logo.png';
    prodigyLogo.alt = 'Prodigy';
    prodigyLogo.style.cssText = 'width:22px;height:22px;object-fit:contain;';
    pilotInfo.appendChild(prodigyLogo);
    const pilotName = document.createElement('div');
    pilotName.textContent = currentCharacter.toUpperCase();
    pilotName.style.cssText = 'font-size:11px;font-weight:600;color:rgba(136,170,204,0.7);letter-spacing:2px;';
    pilotInfo.appendChild(pilotName);
    pilotRow.appendChild(pilotInfo);
    topLeft.appendChild(pilotRow);

    this.container.appendChild(topLeft);

    // Top-center: title
    this.container.appendChild(el('div', { class: 'hud-top-center' }, 'OH-YUM BLASTER'));

    // Bottom-left: score + targets + level
    const bottomLeft = el('div', { class: 'hud-bottom-left' });

    const scoreDiv = el('div', { class: 'hud-score' });
    scoreDiv.appendChild(document.createTextNode('SCORE: '));
    this.scoreEl = document.createElement('span');
    this.scoreEl.textContent = '0';
    scoreDiv.appendChild(this.scoreEl);
    bottomLeft.appendChild(scoreDiv);

    const targetsDiv = el('div', { class: 'hud-targets' });
    targetsDiv.appendChild(document.createTextNode('TARGETS: '));
    this.targetsEl = document.createElement('span');
    this.targetsEl.textContent = '0/0';
    targetsDiv.appendChild(this.targetsEl);
    bottomLeft.appendChild(targetsDiv);

    const levelDiv = el('div', { class: 'hud-level' });
    levelDiv.appendChild(document.createTextNode('LEVEL '));
    this.levelEl = document.createElement('span');
    this.levelEl.textContent = '1';
    levelDiv.appendChild(this.levelEl);
    levelDiv.appendChild(document.createTextNode('/3'));
    bottomLeft.appendChild(levelDiv);

    this.container.appendChild(bottomLeft);

    // Bottom-right: branding
    this.container.appendChild(el('div', { class: 'hud-bottom-right' }, 'PRIDAY LABS'));

    // Desktop controls hint (hidden on touch devices)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) {
      const controls = el('div', {
        'position': 'absolute',
        'bottom': 'clamp(8px,3vh,20px)',
        'left': '50%',
        'transform': 'translateX(-50%)',
        'font-size': '14px',
        'color': 'rgba(160,190,220,0.5)',
        'letter-spacing': '1.5px',
        'white-space': 'nowrap',
        'z-index': '25',
        'font-family': 'var(--font-body)',
        'font-weight': '500',
      }, 'E = Thruster  /  D = Reverse  /  F = Toggle Enemy');
      this.container.appendChild(controls);
    }

    // ── Cockpit frame — cinematic dark gradient with subtle struts ──
    const frame = document.createElement('div');
    frame.className = 'cockpit-frame';
    const strutL = document.createElement('div');
    strutL.className = 'cockpit-strut left';
    const strutR = document.createElement('div');
    strutR.className = 'cockpit-strut right';
    const strutC = document.createElement('div');
    strutC.className = 'cockpit-strut center';
    frame.appendChild(strutL);
    frame.appendChild(strutR);
    frame.appendChild(strutC);
    this.container.appendChild(frame);

    // Speed lines overlay
    this.speedLinesEl = document.createElement('div');
    this.speedLinesEl.className = 'speed-lines';
    this.container.appendChild(this.speedLinesEl);

    // Taunt popup
    this.tauntEl = document.createElement('div');
    this.tauntEl.className = 'taunt-popup';
    this.tauntTextEl = document.createElement('span');
    this.tauntEl.appendChild(this.tauntTextEl);
    this.container.appendChild(this.tauntEl);

    // Altitude indicator (visible during launch/landing phases)
    this.altitudeEl = document.createElement('div');
    this.altitudeEl.style.cssText = `
      position:absolute;top:50%;right:20px;transform:translateY(-50%);
      font-family:var(--font-display);font-size:14px;color:var(--cyan);
      letter-spacing:2px;text-align:right;display:none;
    `;
    this.container.appendChild(this.altitudeEl);

    // Descent rate indicator (below altitude, visible during landing)
    this.descentRateEl = document.createElement('div');
    this.descentRateEl.style.cssText = `
      position:absolute;top:calc(50% + 22px);right:20px;
      font-family:var(--font-display);font-size:13px;
      letter-spacing:2px;text-align:right;display:none;
    `;
    this.container.appendChild(this.descentRateEl);

    // Landing status callout (centered, below mid-screen)
    this.landingStatusEl = document.createElement('div');
    this.landingStatusEl.style.cssText = `
      position:absolute;top:65%;left:50%;transform:translateX(-50%);
      font-family:var(--font-display);font-size:clamp(13px,2.5vw,18px);font-weight:700;
      letter-spacing:3px;text-align:center;pointer-events:none;
      text-shadow:0 0 10px currentColor;
      transition:opacity 0.5s;opacity:0;display:none;
    `;
    this.container.appendChild(this.landingStatusEl);

    overlay.appendChild(this.container);
  }

  private updateCounter = 0;

  update(player: Ship3D, enemies: Ship3D[], score: number, level: number, camera?: THREE.PerspectiveCamera, thrusting = false, speed = 0, lockedTargetIndex = -1): void {
    this.updateCounter++;
    this.shieldBar.style.width = `${player.shieldPct * 100}%`;
    this.hullBar.style.width = `${(1 - player.damagePct) * 100}%`;

    // Speed lines — intensity scales with velocity while thrusting
    if (thrusting && speed > 20) {
      const intensity = Math.min(0.8, (speed - 20) / 80);
      this.speedLinesEl.style.opacity = String(intensity);
    } else {
      this.speedLinesEl.style.opacity = '0';
    }

    if (player.damagePct > 0.75) {
      this.hullBar.style.background = 'linear-gradient(90deg, #882222, #ff4444)';
    } else if (player.damagePct > 0.5) {
      this.hullBar.style.background = 'linear-gradient(90deg, #886622, #ffaa44)';
    } else {
      this.hullBar.style.background = 'linear-gradient(90deg, #226622, #44ff44)';
    }

    this.scoreEl.textContent = score.toLocaleString();

    const alive = enemies.filter(e => e.alive).length;
    const total = enemies.length;
    this.targetsEl.textContent = `${total - alive}/${total}`;
    this.levelEl.textContent = String(level);

    // ── Target indicators — throttle to every 3rd frame for performance ──
    if (this.updateCounter % 3 === 0) {
      this.updateTargetIndicators(player, enemies, camera, lockedTargetIndex);
    }
  }

  private enemyHUDs: HTMLDivElement[] = [];

  private updateTargetIndicators(player: Ship3D, enemies: Ship3D[], camera?: THREE.PerspectiveCamera, lockedTargetIndex = -1): void {
    // Remove old HUDs
    for (const m of this.enemyHUDs) m.remove();
    this.enemyHUDs = [];

    if (!camera) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive) continue;

      // Project enemy position to screen (offset well above ship)
      const labelPos = enemy.position.clone();
      labelPos.y += 38; // above the ship — close enough to associate, clear enough to read
      const pos = labelPos.project(camera);

      const sx = (pos.x * 0.5 + 0.5) * w;
      const sy = (-pos.y * 0.5 + 0.5) * h;
      const behind = pos.z > 1;

      const onScreen = !behind && sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30;

      if (!onScreen) {
        // ── Off-screen tracker — always pinned to screen EDGE ──
        const tracker = document.createElement('div');
        tracker.style.cssText = 'position:fixed;pointer-events:none;z-index:22;text-align:center;';

        // Get direction from screen center to projected position
        let dirX = sx - w / 2;
        let dirY = sy - h / 2;
        // If enemy is behind camera, flip the direction
        if (behind) { dirX = -dirX; dirY = -dirY; }
        // Avoid zero vector
        if (Math.abs(dirX) < 1 && Math.abs(dirY) < 1) dirX = 1;

        // Project direction onto screen edge using line-box intersection
        const margin = 60;
        const halfW = w / 2 - margin;
        const halfH = h / 2 - margin;

        // Scale factor to reach the edge
        const scaleX = Math.abs(dirX) > 0.01 ? halfW / Math.abs(dirX) : 9999;
        const scaleY = Math.abs(dirY) > 0.01 ? halfH / Math.abs(dirY) : 9999;
        const scale = Math.min(scaleX, scaleY);

        const edgeX = w / 2 + dirX * scale;
        const edgeY = h / 2 + dirY * scale;

        // Arrow angle pointing toward the enemy
        const angle = Math.atan2(dirY, dirX);

        tracker.style.left = edgeX + 'px';
        tracker.style.top = edgeY + 'px';
        tracker.style.transform = 'translate(-50%,-50%)';

        // Arrow triangle
        const arrow = document.createElement('div');
        arrow.style.cssText = `
          width:0;height:0;
          border-left:10px solid transparent;border-right:10px solid transparent;
          border-bottom:18px solid #ff4444;
          transform:rotate(${angle - Math.PI / 2}rad);
          filter:drop-shadow(0 0 4px rgba(255,0,0,0.6));
          margin:0 auto;
        `;
        tracker.appendChild(arrow);

        // Portrait + label row
        const dist = Math.round(enemy.position.distanceTo(player.position));
        const labelRow = document.createElement('div');
        labelRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:2px;justify-content:center;';

        const portraitFile = ENEMY_PORTRAITS[i];
        if (portraitFile) {
          const img = document.createElement('img');
          img.src = `/portraits/${portraitFile}`;
          img.style.cssText = 'width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #ff4444;filter:drop-shadow(0 0 3px rgba(255,0,0,0.4));';
          labelRow.appendChild(img);
        }

        const label = document.createElement('div');
        label.textContent = `${ENEMY_NAMES[i] ?? `ENEMY ${i + 1}`} [${dist}m]`;
        label.style.cssText = 'font-size:10px;color:#ff4444;font-family:var(--font-body);white-space:nowrap;';
        labelRow.appendChild(label);
        tracker.appendChild(labelRow);

        this.container.appendChild(tracker);
        this.enemyHUDs.push(tracker);
        continue;
      }

      const isLocked = i === lockedTargetIndex;
      const borderColor = isLocked ? '#00d4ff' : '#ff4444';
      const glowColor = isLocked ? 'rgba(0,212,255,0.6)' : 'rgba(255,0,0,0.5)';
      const textColor = isLocked ? '#00d4ff' : '#ff4444';

      const hud = document.createElement('div');
      hud.style.cssText = `
        position:fixed;pointer-events:none;z-index:22;text-align:center;
        left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);
      `;

      // Portrait (centered, stacked vertically)
      const portraitFile = ENEMY_PORTRAITS[i];
      if (portraitFile) {
        const img = document.createElement('img');
        img.src = `/portraits/${portraitFile}`;
        img.style.cssText = `width:54px;height:54px;border-radius:50%;object-fit:cover;border:2px solid ${borderColor};filter:drop-shadow(0 0 6px ${glowColor});display:block;margin:0 auto;`;
        hud.appendChild(img);
      }

      // Lock indicator bracket
      if (isLocked) {
        const lockTag = document.createElement('div');
        lockTag.textContent = 'LOCKED';
        lockTag.style.cssText = `
          font-size:9px;font-weight:700;color:#00d4ff;font-family:var(--font-display);
          letter-spacing:2px;margin-bottom:2px;
          text-shadow:0 0 6px rgba(0,212,255,0.5);
        `;
        hud.insertBefore(lockTag, hud.firstChild);
      }

      // Health bar directly under portrait
      const barBg = document.createElement('div');
      barBg.style.cssText = `
        width:54px;height:6px;background:rgba(0,0,0,0.7);
        border:1px solid ${borderColor};border-radius:2px;overflow:hidden;
        margin:4px auto 0;
      `;
      const barFill = document.createElement('div');
      const hpPct = Math.max(0, (1 - enemy.damagePct) * 100);
      barFill.style.cssText = `
        width:${hpPct}%;height:100%;
        background:linear-gradient(90deg, ${isLocked ? '#0088aa' : '#cc0000'}, ${isLocked ? '#00d4ff' : '#ff4444'});
        transition:width 0.1s ease-out;
      `;
      barBg.appendChild(barFill);
      hud.appendChild(barBg);

      // Name + distance label
      const onScreenDist = Math.round(enemy.position.distanceTo(player.position));
      const label = document.createElement('div');
      label.textContent = `${ENEMY_NAMES[i] ?? `ENEMY ${i + 1}`} [${onScreenDist}m]`;
      label.style.cssText = `
        font-size:10px;font-weight:bold;color:${textColor};font-family:var(--font-body);
        letter-spacing:1px;margin-top:2px;
        text-shadow:0 0 4px ${glowColor};
      `;
      hud.appendChild(label);

      this.container.appendChild(hud);
      this.enemyHUDs.push(hud);
    }
  }

  /** Show a villain taunt with typewriter effect. Respects 5s cooldown. */
  showTaunt(text: string): void {
    if (this.tauntCooldown > 0) return;
    this.tauntTypewriterText = text;
    this.tauntTypewriterIdx = 0;
    this.tauntTypewriterTimer = 0;
    this.tauntTimer = 3; // visible for 3 seconds
    this.tauntCooldown = 5; // 5 second cooldown
    this.tauntTextEl.textContent = '';
    this.tauntEl.classList.add('visible');
  }

  /** Call each frame with dt to tick typewriter and timers. */
  updateTaunts(dt: number): void {
    if (this.tauntCooldown > 0) this.tauntCooldown -= dt;

    if (this.tauntTimer > 0) {
      this.tauntTimer -= dt;

      // Typewriter effect
      if (this.tauntTypewriterIdx < this.tauntTypewriterText.length) {
        this.tauntTypewriterTimer += dt;
        const charsPerSec = 30;
        while (this.tauntTypewriterTimer > 1 / charsPerSec && this.tauntTypewriterIdx < this.tauntTypewriterText.length) {
          this.tauntTypewriterTimer -= 1 / charsPerSec;
          this.tauntTypewriterIdx++;
          this.tauntTextEl.textContent = this.tauntTypewriterText.substring(0, this.tauntTypewriterIdx);
        }
      }

      if (this.tauntTimer <= 0) {
        this.tauntEl.classList.remove('visible');
      }
    }
  }

  setMissionPhase(phase: 'launch' | 'combat' | 'landing' | null): void {
    this.missionPhase = phase;
    const isAtmo = phase === 'launch' || phase === 'landing';
    this.altitudeEl.style.display = isAtmo ? 'block' : 'none';
    this.descentRateEl.style.display = phase === 'landing' ? 'block' : 'none';
    this.landingStatusEl.style.display = phase === 'landing' ? 'block' : 'none';
  }

  updateAltitude(altitude: number): void {
    if (this.missionPhase === 'launch' || this.missionPhase === 'landing') {
      const alt = Math.max(0, Math.round(altitude));
      this.altitudeEl.textContent = `ALT ${alt.toLocaleString()}m`;
    }
  }

  updateDescentRate(vSpeed: number): void {
    if (this.missionPhase !== 'landing') return;
    const rate = Math.abs(Math.round(vSpeed));
    const descending = vSpeed < -0.5;
    this.descentRateEl.textContent = descending ? `▼ ${rate} m/s` : `${rate} m/s`;
    // Color: green < 15, yellow 15-40, red > 40
    if (rate < 15) {
      this.descentRateEl.style.color = '#44ff44';
    } else if (rate < 40) {
      this.descentRateEl.style.color = '#ffcc00';
    } else {
      this.descentRateEl.style.color = '#ff4444';
    }
  }

  updateLandingStatus(altitude: number, vSpeed: number, padDist: number, phase: string): void {
    if (this.missionPhase !== 'landing') return;
    let text = '';
    let color = '#00ffff';
    const rate = Math.abs(vSpeed);

    if (phase === 'landing' || phase === 'canyon') {
      if (padDist < 500 && altitude < 300) {
        text = 'LANDING ZONE AHEAD';
        color = '#44ff44';
      } else if (rate > 40 && altitude < 1000) {
        text = 'TOO FAST — BRAKE';
        color = '#ff4444';
      } else if (rate > 25 && altitude < 2000) {
        text = 'REDUCE SPEED';
        color = '#ffcc00';
      } else if (altitude < 2000) {
        text = 'ON APPROACH';
        color = '#00ffff';
      }
    } else if (phase === 'atmosphere' && rate > 30) {
      text = 'REDUCE SPEED';
      color = '#ffcc00';
    }

    if (text !== this.lastStatusText) {
      this.lastStatusText = text;
      this.landingStatusTimer = 3;
      this.landingStatusEl.textContent = text;
      this.landingStatusEl.style.color = color;
      this.landingStatusEl.style.opacity = text ? '1' : '0';
    }
  }

  updateLandingStatusTimer(dt: number): void {
    if (this.landingStatusTimer > 0) {
      this.landingStatusTimer -= dt;
      if (this.landingStatusTimer <= 0.5) {
        this.landingStatusEl.style.opacity = String(Math.max(0, this.landingStatusTimer / 0.5));
      }
      if (this.landingStatusTimer <= 0) {
        this.lastStatusText = '';
      }
    }
  }

  show(): void { this.container.style.display = 'block'; }
  hide(): void { this.container.style.display = 'none'; }
  destroy(): void { this.container.remove(); }
}
