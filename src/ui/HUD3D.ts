// ── HUD Overlay (HTML/CSS) ───────────────────────────────
// DOM-based HUD rendered over the 3D scene.
// Shield bar, hull bar, score, targets, level indicator.
// All content is static/hardcoded — no user input rendered as HTML.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { currentCharacter } from '../state/Character';
import { WEAPONS } from '../config';

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
  // Lock bracket overlay — persistent element wrapping portrait + brackets
  private lockOverlay: HTMLDivElement = null!;
  private lockScaler: HTMLDivElement = null!;
  private lockRing: HTMLDivElement = null!;
  private lockText: HTMLDivElement = null!;
  private lockPortrait: HTMLImageElement = null!;
  private lockBarFill: HTMLDivElement = null!;
  private lockBarBg: HTMLDivElement = null!;
  private lockInfo: HTMLDivElement = null!;
  private lockFlash: HTMLDivElement = null!;
  private wasInLockZone = false;
  private lockedEnemyIdx = -1;
  private altitudeEl: HTMLDivElement;
  private descentRateEl: HTMLDivElement;
  private landingStatusEl: HTMLDivElement;
  private landingStatusTimer = 0;
  private lastStatusText = '';
  private missionPhase: 'launch' | 'combat' | 'landing' | null = null;
  // Pre-allocated to avoid per-frame Vector3 garbage in the project calls
  private _projTmp = new THREE.Vector3();
  // Pitch ladder HUD
  private ladderContainer: HTMLDivElement = null!;
  private ladderInner: HTMLDivElement = null!;
  private invertedLabel: HTMLDivElement = null!;
  private _euler = new THREE.Euler();

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

      /* Desktop only — 2x larger taunt for readability on big screens */
      @media (min-width: 601px) {
        .taunt-popup {
          max-width:840px;padding:24px 44px;
          font-size:36px;border-radius:10px;
        }
      }

      /* ── Lock bracket overlay ── */
      .lock-overlay {
        position:fixed;pointer-events:none;z-index:23;
        transform:translate(-50%,-50%);
      }
      .lock-scaler {
        transition:transform 0.25s ease-out, opacity 0.25s ease-out;
      }
      .lock-ring {
        position:relative;
        animation:lockSpin 8s linear infinite;
      }
      .lock-corner {
        position:absolute;width:30%;height:30%;
        border-color:#00ff66;border-style:solid;
        filter:drop-shadow(0 0 6px rgba(0,255,102,0.8));
      }
      .lock-corner.tl { top:0;left:0;border-width:2px 0 0 2px; }
      .lock-corner.tr { top:0;right:0;border-width:2px 2px 0 0; }
      .lock-corner.bl { bottom:0;left:0;border-width:0 0 2px 2px; }
      .lock-corner.br { bottom:0;right:0;border-width:0 2px 2px 0; }
      .lock-portrait {
        position:absolute;top:50%;left:50%;
        transform:translate(-50%,-50%);
        border-radius:50%;object-fit:cover;
        border:2px solid #00ff66;
        filter:drop-shadow(0 0 8px rgba(0,255,102,0.6));
      }
      .lock-text {
        text-align:center;margin-bottom:4px;
        font-family:var(--font-display);font-size:10px;font-weight:700;
        color:#00ff66;letter-spacing:3px;
        text-shadow:0 0 8px rgba(0,255,102,0.6);
        animation:lockPulse 1.5s ease-in-out infinite;
      }
      .lock-bar-bg {
        background:rgba(0,0,0,0.7);border:1px solid #00ff66;
        border-radius:2px;overflow:hidden;margin:4px auto 0;
      }
      .lock-bar-fill {
        height:100%;
        background:linear-gradient(90deg, #008844, #00ff66);
        transition:width 0.15s ease-out;
      }
      .lock-info {
        text-align:center;margin-top:2px;
        font-size:10px;font-weight:bold;color:#00ff66;
        font-family:var(--font-body);letter-spacing:1px;
        text-shadow:0 0 4px rgba(0,255,102,0.6);
      }
      .lock-flash {
        position:fixed;top:0;left:0;width:100%;height:100%;
        pointer-events:none;z-index:21;
        border:3px solid rgba(0,255,102,0.5);
        box-shadow:inset 0 0 80px rgba(0,255,102,0.15);
        opacity:0;transition:opacity 0.4s ease-out;
      }
      @keyframes lockSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes lockPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }

      /* ── Pitch ladder HUD ── */
      .ladder-container {
        position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
        width:360px;height:280px;
        pointer-events:none;z-index:22;
        overflow:hidden;
      }
      .ladder-inner {
        position:absolute;left:50%;top:50%;
        width:100%;
        transform-origin:center center;
      }
      .ladder-rung {
        position:absolute;left:50%;transform:translateX(-50%);
        display:flex;align-items:center;justify-content:center;gap:0;
      }
      .ladder-rung .rung-line {
        height:0;border-top:1px solid rgba(0,220,255,0.35);
      }
      .ladder-rung .rung-line.solid { width:60px; }
      .ladder-rung .rung-line.dashed { width:60px;border-top-style:dashed;border-top-color:rgba(0,220,255,0.25); }
      .ladder-rung .rung-gap { width:80px; }
      .ladder-rung .rung-label {
        position:absolute;
        font-size:10px;font-weight:600;letter-spacing:1px;
        color:rgba(0,220,255,0.4);font-family:var(--font-display);
      }
      .ladder-rung .rung-label.left { right:calc(50% + 72px); }
      .ladder-rung .rung-label.right { left:calc(50% + 72px); }
      .ladder-rung-zero .rung-line { border-top-width:2px;border-top-color:rgba(0,220,255,0.5); }
      .ladder-rung-zero .rung-label { color:rgba(0,220,255,0.55); }
      /* Mobile — shrink pitch ladder to take up less of the small screen */
      @media (max-width: 430px), (max-height: 430px) {
        .ladder-container {
          transform: translate(-50%, -50%) scale(0.6);
        }
        .ladder-wings {
          transform: translate(-50%, -50%) scale(0.7);
        }
      }
      /* Fixed center wings marker */
      .ladder-wings {
        position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        pointer-events:none;z-index:23;
        width:44px;height:2px;
        display:flex;align-items:center;gap:0;
      }
      .ladder-wings::before, .ladder-wings::after {
        content:'';display:block;width:16px;height:2px;
        background:rgba(0,220,255,0.7);
      }
      .ladder-wings .wing-dot {
        width:6px;height:6px;border-radius:50%;flex-shrink:0;
        border:1.5px solid rgba(0,220,255,0.7);background:transparent;
        margin:0 1px;
      }
      .inverted-label {
        position:fixed;top:calc(50% + 160px);left:50%;transform:translateX(-50%);
        font-size:12px;font-weight:700;letter-spacing:3px;
        color:rgba(255,100,50,0.9);font-family:var(--font-display);
        text-shadow:0 0 8px rgba(255,80,30,0.6);
        pointer-events:none;z-index:23;
        opacity:0;transition:opacity 0.3s ease;
      }

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
    this.container.appendChild(el('div', { class: 'hud-top-center' }, 'PRODIGY BLASTER'));

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

    // ── Pitch ladder HUD — fighter jet style ──
    this.ladderContainer = document.createElement('div');
    this.ladderContainer.className = 'ladder-container';
    this.ladderInner = document.createElement('div');
    this.ladderInner.className = 'ladder-inner';

    // Build rungs: -40, -30, -20, -10, 0, 10, 20, 30, 40 degrees
    const rungs = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
    const pxPerDeg = 3.2; // pixels per degree of pitch
    for (const deg of rungs) {
      const rung = document.createElement('div');
      rung.className = `ladder-rung${deg === 0 ? ' ladder-rung-zero' : ''}`;
      rung.style.top = `${-deg * pxPerDeg}px`;

      const lineClass = deg >= 0 ? 'solid' : 'dashed';
      const lineL = document.createElement('div');
      lineL.className = `rung-line ${lineClass}`;
      const gap = document.createElement('div');
      gap.className = 'rung-gap';
      const lineR = document.createElement('div');
      lineR.className = `rung-line ${lineClass}`;
      rung.appendChild(lineL);
      rung.appendChild(gap);
      rung.appendChild(lineR);

      if (deg !== 0) {
        const labelL = document.createElement('div');
        labelL.className = 'rung-label left';
        labelL.textContent = String(Math.abs(deg));
        const labelR = document.createElement('div');
        labelR.className = 'rung-label right';
        labelR.textContent = String(Math.abs(deg));
        rung.appendChild(labelL);
        rung.appendChild(labelR);
      }

      this.ladderInner.appendChild(rung);
    }

    this.ladderContainer.appendChild(this.ladderInner);
    this.container.appendChild(this.ladderContainer);

    // Fixed center wings marker — does not rotate
    const wings = document.createElement('div');
    wings.className = 'ladder-wings';
    const wingDot = document.createElement('div');
    wingDot.className = 'wing-dot';
    wings.appendChild(wingDot);
    this.container.appendChild(wings);

    // Inverted warning
    this.invertedLabel = document.createElement('div');
    this.invertedLabel.className = 'inverted-label';
    this.invertedLabel.textContent = 'INVERTED';
    this.container.appendChild(this.invertedLabel);

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

    // ── Lock bracket overlay — portrait + brackets + info, all persistent ──
    this.lockOverlay = document.createElement('div');
    this.lockOverlay.className = 'lock-overlay';
    this.lockOverlay.style.display = 'none';

    this.lockScaler = document.createElement('div');
    this.lockScaler.className = 'lock-scaler';

    // "LOCK" label above everything
    this.lockText = document.createElement('div');
    this.lockText.className = 'lock-text';
    this.lockText.textContent = 'LOCK';
    this.lockScaler.appendChild(this.lockText);

    // Frame container — brackets rotate around the portrait
    const lockFrame = document.createElement('div');
    lockFrame.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;';

    // Rotating bracket ring
    this.lockRing = document.createElement('div');
    this.lockRing.className = 'lock-ring';
    for (const pos of ['tl', 'tr', 'bl', 'br']) {
      const corner = document.createElement('div');
      corner.className = `lock-corner ${pos}`;
      this.lockRing.appendChild(corner);
    }
    lockFrame.appendChild(this.lockRing);

    // Portrait — centered inside the brackets, does NOT rotate
    this.lockPortrait = document.createElement('img');
    this.lockPortrait.className = 'lock-portrait';
    lockFrame.appendChild(this.lockPortrait);

    this.lockScaler.appendChild(lockFrame);

    // Health bar below
    this.lockBarBg = document.createElement('div');
    this.lockBarBg.className = 'lock-bar-bg';
    this.lockBarFill = document.createElement('div');
    this.lockBarFill.className = 'lock-bar-fill';
    this.lockBarBg.appendChild(this.lockBarFill);
    this.lockScaler.appendChild(this.lockBarBg);

    // Name + distance
    this.lockInfo = document.createElement('div');
    this.lockInfo.className = 'lock-info';
    this.lockScaler.appendChild(this.lockInfo);

    this.lockOverlay.appendChild(this.lockScaler);
    this.container.appendChild(this.lockOverlay);

    // Green flash on lock acquire
    this.lockFlash = document.createElement('div');
    this.lockFlash.className = 'lock-flash';
    this.container.appendChild(this.lockFlash);

    // Altitude indicator (visible during launch/landing phases)
    this.altitudeEl = document.createElement('div');
    this.altitudeEl.style.cssText = `
      position:absolute;top:25%;right:20px;transform:translateY(-50%);
      font-family:var(--font-display);font-size:14px;color:var(--cyan);
      letter-spacing:2px;text-align:right;display:none;
    `;
    this.container.appendChild(this.altitudeEl);

    // Descent rate indicator (below altitude, visible during landing)
    this.descentRateEl = document.createElement('div');
    this.descentRateEl.style.cssText = `
      position:absolute;top:calc(25% + 22px);right:20px;
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

    // ── Pitch ladder — update roll and pitch from player ship orientation ──
    if (camera) {
      this._euler.setFromQuaternion(player.group.quaternion, 'ZXY');
      const roll = this._euler.z;   // radians, 0 = level
      const pitch = this._euler.x;  // radians, negative = nose up
      const pitchDeg = pitch * (180 / Math.PI);
      const pxPerDeg = 3.2;
      const pitchOffset = pitchDeg * pxPerDeg;
      this.ladderInner.style.transform = `translate(-50%, ${pitchOffset}px) rotate(${-roll}rad)`;
      // Show INVERTED label when rolled past ~120 degrees
      const inverted = Math.abs(roll) > Math.PI * 0.65;
      this.invertedLabel.style.opacity = inverted ? '1' : '0';
    }

    if (player.damagePct > 0.75) {
      this.hullBar.style.background = 'linear-gradient(90deg, #882222, #ff4444)';
    } else if (player.damagePct > 0.5) {
      this.hullBar.style.background = 'linear-gradient(90deg, #886622, #ffaa44)';
    } else {
      this.hullBar.style.background = 'linear-gradient(90deg, #226622, #44ff44)';
    }

    this.scoreEl.textContent = score.toLocaleString();

    let alive = 0;
    for (const e of enemies) if (e.alive) alive++;
    const total = enemies.length;
    this.targetsEl.textContent = `${total - alive}/${total}`;
    this.levelEl.textContent = String(level);

    // Lock bracket overlay — every frame for smooth tracking
    this.updateLockOverlay(player, enemies, camera, lockedTargetIndex);

    // ── Target indicators — throttle to every 3rd frame for performance ──
    if (this.updateCounter % 3 === 0) {
      this.updateTargetIndicators(player, enemies, camera, lockedTargetIndex);
    }
  }

  /** Pooled enemy HUD slots — create DOM once per slot, update properties each frame. */
  private enemySlots: {
    outer: HTMLDivElement;
    arrow: HTMLDivElement;
    portrait: HTMLImageElement | null;
    barBg: HTMLDivElement;
    barFill: HTMLDivElement;
    label: HTMLDivElement;
    marker: HTMLDivElement;
  }[] = [];

  private ensureEnemySlot(i: number): HUD3D['enemySlots'][number] {
    while (this.enemySlots.length <= i) {
      const idx = this.enemySlots.length;
      const outer = document.createElement('div');
      outer.style.cssText = 'position:fixed;pointer-events:none;z-index:22;text-align:center;display:none;';

      const arrow = document.createElement('div');
      arrow.style.cssText = 'width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:18px solid #ff4444;filter:drop-shadow(0 0 4px rgba(255,0,0,0.6));margin:0 auto;display:none;';
      outer.appendChild(arrow);

      let portrait: HTMLImageElement | null = null;
      const portraitFile = ENEMY_PORTRAITS[idx];
      if (portraitFile) {
        portrait = document.createElement('img');
        portrait.src = `/portraits/${portraitFile}`;
        portrait.style.cssText = 'object-fit:cover;border-radius:50%;display:none;margin:2px auto 0;';
        outer.appendChild(portrait);
      }

      const barBg = document.createElement('div');
      barBg.style.cssText = 'background:rgba(0,0,0,0.7);border-radius:2px;overflow:hidden;margin:4px auto 0;display:none;';
      const barFill = document.createElement('div');
      barFill.style.cssText = 'height:100%;';
      barBg.appendChild(barFill);
      outer.appendChild(barBg);

      const label = document.createElement('div');
      label.style.cssText = 'font-family:var(--font-body);white-space:nowrap;letter-spacing:1px;margin-top:2px;display:none;';
      outer.appendChild(label);

      const marker = document.createElement('div');
      marker.style.cssText = 'width:8px;height:8px;transform:rotate(45deg);margin:0 auto;display:none;';
      outer.appendChild(marker);

      this.container.appendChild(outer);
      this.enemySlots.push({ outer, arrow, portrait, barBg, barFill, label, marker });
    }
    return this.enemySlots[i];
  }

  private updateTargetIndicators(player: Ship3D, enemies: Ship3D[], camera?: THREE.PerspectiveCamera, lockedTargetIndex = -1): void {
    if (!camera) {
      for (const s of this.enemySlots) s.outer.style.display = 'none';
      return;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Hide any slots beyond the current enemy count (e.g. if a level had fewer enemies)
    for (let j = enemies.length; j < this.enemySlots.length; j++) {
      this.enemySlots[j].outer.style.display = 'none';
    }

    for (let i = 0; i < enemies.length; i++) {
      const slot = this.ensureEnemySlot(i);
      const enemy = enemies[i];

      if (!enemy.alive || (this.wasInLockZone && i === this.lockedEnemyIdx)) {
        slot.outer.style.display = 'none';
        continue;
      }

      const pos = this._projTmp.copy(enemy.position).project(camera);
      const sx = (pos.x * 0.5 + 0.5) * w;
      const sy = (-pos.y * 0.5 + 0.5) * h - 70;
      const behind = pos.z > 1;
      const onScreen = !behind && sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30;

      slot.outer.style.display = 'block';
      slot.outer.style.transform = 'translate(-50%,-50%)';

      if (!onScreen) {
        // Off-screen: arrow at edge + small portrait + label
        let dirX = sx - w / 2;
        let dirY = sy - h / 2;
        if (behind) { dirX = -dirX; dirY = -dirY; }
        if (Math.abs(dirX) < 1 && Math.abs(dirY) < 1) dirX = 1;

        const margin = 60;
        const halfW = w / 2 - margin;
        const halfH = h / 2 - margin;
        const scaleX = Math.abs(dirX) > 0.01 ? halfW / Math.abs(dirX) : 9999;
        const scaleY = Math.abs(dirY) > 0.01 ? halfH / Math.abs(dirY) : 9999;
        const scale = Math.min(scaleX, scaleY);
        const edgeX = w / 2 + dirX * scale;
        const edgeY = h / 2 + dirY * scale;
        const angle = Math.atan2(dirY, dirX);

        slot.outer.style.left = edgeX + 'px';
        slot.outer.style.top = edgeY + 'px';

        slot.arrow.style.display = 'block';
        slot.arrow.style.transform = `rotate(${angle - Math.PI / 2}rad)`;
        slot.arrow.style.borderBottomColor = '#ff4444';

        if (slot.portrait) {
          slot.portrait.style.display = 'block';
          slot.portrait.style.width = '75px';
          slot.portrait.style.height = '75px';
          slot.portrait.style.border = '2px solid #ff4444';
          slot.portrait.style.filter = 'drop-shadow(0 0 3px rgba(255,0,0,0.4))';
        }

        slot.barBg.style.display = 'none';
        slot.marker.style.display = 'none';

        const dist = Math.round(enemy.position.distanceTo(player.position));
        slot.label.style.display = 'block';
        slot.label.style.fontSize = '16px';
        slot.label.style.fontWeight = 'normal';
        slot.label.style.color = '#ff4444';
        slot.label.style.textShadow = 'none';
        slot.label.textContent = `${ENEMY_NAMES[i] ?? `ENEMY ${i + 1}`} [${dist}m]`;
        continue;
      }

      // On-screen
      const isLocked = i === lockedTargetIndex;
      const inLockZone = isLocked && Math.abs(pos.x) < 0.45 && Math.abs(pos.y) < 0.45;
      const borderColor = inLockZone ? '#00ff66' : '#ff4444';
      const glowColor = inLockZone ? 'rgba(0,255,102,0.6)' : 'rgba(255,0,0,0.5)';
      const textColor = inLockZone ? '#00ff66' : '#ff4444';

      const onScreenDist = Math.round(enemy.position.distanceTo(player.position));
      const distScale = Math.max(0.3, Math.min(1.0, 60 / Math.max(onScreenDist, 1)));
      const showDetails = distScale > 0.4;

      slot.outer.style.left = sx + 'px';
      slot.outer.style.top = sy + 'px';
      slot.arrow.style.display = 'none';

      if (showDetails) {
        const portraitSize = Math.round(106 * distScale);
        const barWidth = Math.round(106 * distScale);
        const barH = Math.max(5, Math.round(10 * distScale));
        const fontSize = Math.max(11, Math.round(18 * distScale));
        const dropShadowPx = Math.round(10 * distScale);

        if (slot.portrait) {
          slot.portrait.style.display = 'block';
          slot.portrait.style.width = portraitSize + 'px';
          slot.portrait.style.height = portraitSize + 'px';
          slot.portrait.style.border = `2px solid ${borderColor}`;
          slot.portrait.style.filter = `drop-shadow(0 0 ${dropShadowPx}px ${glowColor})`;
        }

        slot.barBg.style.display = 'block';
        slot.barBg.style.width = barWidth + 'px';
        slot.barBg.style.height = barH + 'px';
        slot.barBg.style.border = `1px solid ${borderColor}`;
        slot.barBg.style.margin = `${Math.round(4 * distScale)}px auto 0`;

        const hpPct = Math.max(0, (1 - enemy.damagePct) * 100);
        slot.barFill.style.width = `${hpPct}%`;
        slot.barFill.style.background = `linear-gradient(90deg, ${inLockZone ? '#008844' : '#cc0000'}, ${inLockZone ? '#00ff66' : '#ff4444'})`;

        slot.label.style.display = 'block';
        slot.label.style.fontSize = fontSize + 'px';
        slot.label.style.fontWeight = 'bold';
        slot.label.style.color = textColor;
        slot.label.style.textShadow = `0 0 4px ${glowColor}`;
        slot.label.textContent = `${ENEMY_NAMES[i] ?? `ENEMY ${i + 1}`} [${onScreenDist}m]`;

        slot.marker.style.display = 'none';
      } else {
        // Tiny distant marker — everything else off
        if (slot.portrait) slot.portrait.style.display = 'none';
        slot.barBg.style.display = 'none';
        slot.label.style.display = 'none';
        slot.marker.style.display = 'block';
        slot.marker.style.background = borderColor;
        slot.marker.style.boxShadow = `0 0 6px ${glowColor}`;
      }
    }
  }

  private updateLockOverlay(player: Ship3D, enemies: Ship3D[], camera?: THREE.PerspectiveCamera, lockedTargetIndex = -1): void {
    // No camera or no lock target — hide
    if (!camera || lockedTargetIndex < 0 || lockedTargetIndex >= enemies.length) {
      this.hideLock();
      return;
    }

    const enemy = enemies[lockedTargetIndex];
    if (!enemy.alive) {
      this.hideLock();
      return;
    }
    // Out of lock range — invalidate the lock visually
    if (enemy.position.distanceTo(player.position) > WEAPONS.LOCK_RANGE) {
      this.hideLock();
      return;
    }

    // Project enemy to screen — same offset as enemy HUD portrait (70px above center)
    const pos = this._projTmp.copy(enemy.position).project(camera);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const sx = (pos.x * 0.5 + 0.5) * w;
    const sy = (-pos.y * 0.5 + 0.5) * h - 70;
    const behind = pos.z > 1;

    const inLockZone = !behind && Math.abs(pos.x) < 0.45 && Math.abs(pos.y) < 0.45;
    const onScreen = !behind && sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30;

    if (inLockZone && onScreen) {
      const dist = enemy.position.distanceTo(player.position);
      const distScale = Math.max(0.3, Math.min(1.0, 60 / Math.max(dist, 1)));
      const portraitSize = Math.round(106 * distScale);
      const boxSize = portraitSize + Math.round(30 * distScale);

      // Position and size
      this.lockOverlay.style.left = sx + 'px';
      this.lockOverlay.style.top = sy + 'px';
      this.lockRing.style.width = boxSize + 'px';
      this.lockRing.style.height = boxSize + 'px';
      this.lockPortrait.style.width = portraitSize + 'px';
      this.lockPortrait.style.height = portraitSize + 'px';
      this.lockText.style.fontSize = Math.max(11, Math.round(18 * distScale)) + 'px';
      this.lockBarBg.style.width = Math.round(106 * distScale) + 'px';
      this.lockBarBg.style.height = Math.max(4, Math.round(8 * distScale)) + 'px';
      this.lockInfo.style.fontSize = Math.max(11, Math.round(18 * distScale)) + 'px';

      // Update portrait src if enemy changed
      const portraitFile = ENEMY_PORTRAITS[lockedTargetIndex];
      if (this.lockedEnemyIdx !== lockedTargetIndex && portraitFile) {
        this.lockPortrait.src = `/portraits/${portraitFile}`;
        this.lockedEnemyIdx = lockedTargetIndex;
      }

      // Update health bar
      const hpPct = Math.max(0, (1 - enemy.damagePct) * 100);
      this.lockBarFill.style.width = `${hpPct}%`;

      // Update name + distance
      const onScreenDist = Math.round(dist);
      this.lockInfo.textContent = `${ENEMY_NAMES[lockedTargetIndex] ?? `ENEMY ${lockedTargetIndex + 1}`} [${onScreenDist}m]`;

      if (!this.wasInLockZone) {
        // ── ACQUIRE — snap in + green flash ──
        this.lockOverlay.style.display = 'block';
        this.lockScaler.style.transform = 'scale(1.8)';
        this.lockScaler.style.opacity = '0';
        void this.lockScaler.offsetWidth;
        this.lockScaler.style.transform = 'scale(1)';
        this.lockScaler.style.opacity = '1';

        // Green edge flash
        this.lockFlash.style.transition = 'none';
        this.lockFlash.style.opacity = '0.7';
        void this.lockFlash.offsetWidth;
        this.lockFlash.style.transition = 'opacity 0.4s ease-out';
        this.lockFlash.style.opacity = '0';

        this.wasInLockZone = true;
      }
    } else {
      this.hideLock();
    }
  }

  private hideLock(): void {
    if (this.wasInLockZone) {
      // ── LOSE — collapse out ──
      this.lockScaler.style.transform = 'scale(0.3)';
      this.lockScaler.style.opacity = '0';
      setTimeout(() => {
        if (!this.wasInLockZone) {
          this.lockOverlay.style.display = 'none';
        }
      }, 250);
      this.wasInLockZone = false;
      this.lockedEnemyIdx = -1;
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
