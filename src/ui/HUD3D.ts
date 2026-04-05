// ── HUD Overlay (HTML/CSS) ───────────────────────────────
// DOM-based HUD rendered over the 3D scene.
// Shield bar, hull bar, score, targets, level indicator.
// All content is static/hardcoded — no user input rendered as HTML.

import * as THREE from 'three';
import { Ship3D } from '../entities/Ship3D';
import { currentCharacter } from '../state/Character';

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

  constructor() {
    const overlay = document.getElementById('ui-overlay')!;

    // Inject scoped styles
    const style = document.createElement('style');
    style.textContent = `
      #hud { position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:20;font-family:Arial,sans-serif; }
      .hud-top-left { position:absolute;top:16px;left:16px; }
      .hud-bar-container { width:200px;height:14px;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);border-radius:2px;margin-bottom:6px;overflow:hidden; }
      .hud-bar-fill { height:100%;transition:width 0.15s ease-out; }
      .hud-bar-label { font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px; }
      .hud-shield-fill { background:linear-gradient(90deg,#006688,#00ccff); }
      .hud-hull-fill { background:linear-gradient(90deg,#226622,#44ff44); }
      .hud-top-center { position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:14px;font-weight:bold;color:rgba(255,255,255,0.4);letter-spacing:3px; }
      .hud-bottom-left { position:absolute;bottom:16px;left:16px;font-size:14px;color:#fff; }
      .hud-score { font-size:18px;font-weight:bold;color:#ffcc00; }
      .hud-targets { font-size:13px;color:#aaa;margin-top:4px; }
      .hud-level { font-size:12px;color:#88aacc;margin-top:4px; }
      .hud-bottom-right { position:absolute;bottom:12px;right:16px;font-size:14px;font-weight:bold;color:#00ff66;letter-spacing:1px; }
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

    // Prodigy logo + Pilot portrait
    const pilotRow = document.createElement('div');
    pilotRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;';
    const prodigyLogo = document.createElement('img');
    prodigyLogo.src = '/portraits/prodigy-logo.png';
    prodigyLogo.alt = 'Prodigy';
    prodigyLogo.style.cssText = 'width:24px;height:24px;object-fit:contain;';
    pilotRow.appendChild(prodigyLogo);
    const pilotImg = document.createElement('img');
    pilotImg.src = `/portraits/${currentCharacter}.jpg`;
    pilotImg.alt = currentCharacter;
    pilotImg.style.cssText = 'width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #88aacc;';
    pilotRow.appendChild(pilotImg);
    const pilotName = document.createElement('div');
    pilotName.textContent = currentCharacter.toUpperCase();
    pilotName.style.cssText = 'font-size:12px;font-weight:bold;color:#88aacc;letter-spacing:1px;';
    pilotRow.appendChild(pilotName);
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

    overlay.appendChild(this.container);
  }

  update(player: Ship3D, enemies: Ship3D[], score: number, level: number, camera?: THREE.PerspectiveCamera): void {
    this.shieldBar.style.width = `${player.shieldPct * 100}%`;
    this.hullBar.style.width = `${(1 - player.damagePct) * 100}%`;

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

    // ── Target indicators — show arrow + distance for each enemy ──
    this.updateTargetIndicators(enemies, camera);
  }

  private enemyHUDs: HTMLDivElement[] = [];

  private updateTargetIndicators(enemies: Ship3D[], camera?: THREE.PerspectiveCamera): void {
    // Remove old HUDs
    for (const m of this.enemyHUDs) m.remove();
    this.enemyHUDs = [];

    if (!camera) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive) continue;

      // Project enemy position to screen (offset upward for label above ship)
      const labelPos = enemy.position.clone();
      labelPos.y += 8; // above the ship
      const pos = labelPos.project(camera);

      const sx = (pos.x * 0.5 + 0.5) * w;
      const sy = (-pos.y * 0.5 + 0.5) * h;
      const behind = pos.z > 1;

      const onScreen = !behind && sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30;

      if (!onScreen) {
        // ── Off-screen tracker arrow at screen edge ──
        const tracker = document.createElement('div');
        tracker.style.cssText = 'position:fixed;pointer-events:none;z-index:22;text-align:center;';

        // Calculate edge position — clamp to screen border with margin
        let edgeX = sx;
        let edgeY = sy;
        if (behind) { edgeX = w - edgeX; edgeY = h - edgeY; }
        const margin = 40;
        edgeX = Math.max(margin, Math.min(w - margin, edgeX));
        edgeY = Math.max(margin, Math.min(h - margin, edgeY));

        // Arrow pointing toward enemy
        const angle = Math.atan2(sy - h / 2, sx - w / 2) + (behind ? Math.PI : 0);

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

        // Label
        const dist = Math.round(enemy.position.distanceTo(camera.position));
        const label = document.createElement('div');
        label.textContent = `VOX ${i + 1} [${dist}m]`;
        label.style.cssText = 'font-size:10px;color:#ff4444;font-family:Arial;white-space:nowrap;margin-top:2px;';
        tracker.appendChild(label);

        this.container.appendChild(tracker);
        this.enemyHUDs.push(tracker);
        continue;
      }

      const hud = document.createElement('div');
      hud.style.cssText = `
        position:fixed;pointer-events:none;z-index:22;text-align:center;
        left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);
      `;

      const label = document.createElement('div');
      label.textContent = `VOX ${i + 1}`;
      label.style.cssText = `
        font-size:13px;font-weight:bold;color:#ff4444;font-family:Arial,sans-serif;
        letter-spacing:2px;margin-bottom:4px;
        text-shadow:0 0 6px rgba(255,0,0,0.5);
      `;
      hud.appendChild(label);

      // Health bar background
      const barBg = document.createElement('div');
      barBg.style.cssText = `
        width:100px;height:8px;background:rgba(0,0,0,0.7);
        border:1px solid #ff4444;border-radius:2px;overflow:hidden;
        margin:0 auto;
      `;

      // Health bar fill
      const barFill = document.createElement('div');
      const hpPct = Math.max(0, (1 - enemy.damagePct) * 100);
      barFill.style.cssText = `
        width:${hpPct}%;height:100%;
        background:linear-gradient(90deg, #cc0000, #ff4444);
        transition:width 0.1s ease-out;
      `;
      barBg.appendChild(barFill);
      hud.appendChild(barBg);

      // HP text
      const hpText = document.createElement('div');
      hpText.textContent = `${Math.ceil(enemy.hull)}/${enemy.maxHull}`;
      hpText.style.cssText = 'font-size:10px;color:#ff8888;font-family:Arial;margin-top:2px;';
      hud.appendChild(hpText);

      this.container.appendChild(hud);
      this.enemyHUDs.push(hud);
    }
  }

  show(): void { this.container.style.display = 'block'; }
  hide(): void { this.container.style.display = 'none'; }
  destroy(): void { this.container.remove(); }
}
