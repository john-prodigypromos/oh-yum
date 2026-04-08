// ── Atmosphere System ─────────────────────────────────────
// Shared altitude-based atmosphere modifiers and visuals used
// by both Mars launch and Earth landing scenes.

import * as THREE from 'three';

// ── Interfaces ────────────────────────────────────────────

export interface AtmosphereModifiers {
  gravity: number;
  drag: number;
  speedCap: number;
}

export interface AtmosphereVisuals {
  skyColor: THREE.Color;
  fogDensity: number;
  fogColor: THREE.Color;
  particleDensity: number;
  particleType: 'dust' | 'ice' | 'none';
}

export interface SkyColorStop {
  altitude: number; // 0..1 (normalized fraction of maxAltitude)
  color: THREE.Color;
}

export interface AtmosphereConfig {
  maxAltitude: number;
  surfaceGravity: number;
  surfaceDrag: number;
  surfaceSpeedCap: number;
  spaceSpeedCap: number;
  skyColors: SkyColorStop[];       // sorted ascending by altitude
  fogColorSurface: THREE.Color;
  fogColorHigh: THREE.Color;
  dustCeiling: number;             // absolute altitude — dust particles below this
  iceBand: [number, number];       // [min, max] absolute altitude — ice particles here
}

// ── Mars Configuration ────────────────────────────────────

export const MARS_ATMOSPHERE: AtmosphereConfig = {
  maxAltitude: 20000,
  surfaceGravity: 0.3,
  surfaceDrag: 0.01,
  surfaceSpeedCap: 50000,
  spaceSpeedCap: 50000,

  skyColors: [
    { altitude: 0.00, color: new THREE.Color(0xcc2200) }, // vivid Mars red
    { altitude: 0.15, color: new THREE.Color(0xaa1800) }, // bright crimson
    { altitude: 0.35, color: new THREE.Color(0x6a0e00) }, // deep red
    { altitude: 0.55, color: new THREE.Color(0x350600) }, // dark red
    { altitude: 0.80, color: new THREE.Color(0x120200) }, // near black red
    { altitude: 1.00, color: new THREE.Color(0x010208) }, // space black
  ],

  fogColorSurface: new THREE.Color(0xcc2200),
  fogColorHigh:    new THREE.Color(0x010208),

  dustCeiling: 3000,
  iceBand: [6000, 14000],
};

// ── Earth Configuration ───────────────────────────────────

export const EARTH_ATMOSPHERE: AtmosphereConfig = {
  maxAltitude: 3000,
  surfaceGravity: 9.8,
  surfaceDrag: 0.7,
  surfaceSpeedCap: 40,
  spaceSpeedCap: 100,

  skyColors: [
    { altitude: 0.00, color: new THREE.Color(0x5588cc) }, // surface blue
    { altitude: 0.30, color: new THREE.Color(0x2244aa) }, // dark blue
    { altitude: 0.60, color: new THREE.Color(0x080a18) }, // near black
    { altitude: 1.00, color: new THREE.Color(0x010208) }, // space black
  ],

  fogColorSurface: new THREE.Color(0x7aaad0),
  fogColorHigh:    new THREE.Color(0x010208),

  dustCeiling: 100,
  iceBand: [1500, 2500],
};

// ── Helpers ───────────────────────────────────────────────

/** Quadratic ease-out: starts fast, decelerates toward 1. */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Linear interpolate between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── getAtmosphereModifiers ────────────────────────────────
/**
 * Returns gravity, drag, and speed cap for the given altitude.
 * Uses quadratic ease-out so values drop off quickly near the
 * surface and approach space values asymptotically.
 *
 * At altitude = 0           → full surface values
 * At altitude = maxAltitude → gravity/drag = 0, speedCap = spaceSpeedCap
 */
export function getAtmosphereModifiers(
  config: AtmosphereConfig,
  altitude: number,
): AtmosphereModifiers {
  const t = Math.max(0, Math.min(1, altitude / config.maxAltitude));
  const eased = easeOutQuad(t);

  return {
    gravity:  lerp(config.surfaceGravity,   0, eased),
    drag:     lerp(config.surfaceDrag,      0, eased),
    speedCap: lerp(config.surfaceSpeedCap, config.spaceSpeedCap, eased),
  };
}

// ── getAtmosphereVisuals ──────────────────────────────────
/**
 * Returns sky color, fog density/color, particle type and density
 * for the given altitude.
 *
 * Sky color interpolates along the gradient stops defined in the config.
 * Fog density starts at 0.02 at the surface and fades to 50% by
 * altitude = maxAltitude / 2, reaching near-zero at maxAltitude.
 * Particle type is 'dust' below dustCeiling, 'ice' inside iceBand,
 * and 'none' elsewhere; density scales 0→1 within each band.
 */
export function getAtmosphereVisuals(
  config: AtmosphereConfig,
  altitude: number,
): AtmosphereVisuals {
  const clampedAlt = Math.max(0, Math.min(config.maxAltitude, altitude));
  const tNorm = clampedAlt / config.maxAltitude; // 0..1

  // ── Sky color ─────────────────────────────────────────
  const stops = config.skyColors;
  let skyColor: THREE.Color;

  if (tNorm <= stops[0].altitude) {
    skyColor = stops[0].color.clone();
  } else if (tNorm >= stops[stops.length - 1].altitude) {
    skyColor = stops[stops.length - 1].color.clone();
  } else {
    // Find the two surrounding stops and interpolate
    skyColor = new THREE.Color();
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i];
      const hi = stops[i + 1];
      if (tNorm >= lo.altitude && tNorm <= hi.altitude) {
        const span = hi.altitude - lo.altitude;
        const localT = span > 0 ? (tNorm - lo.altitude) / span : 0;
        skyColor.lerpColors(lo.color, hi.color, localT);
        break;
      }
    }
  }

  // ── Fog ───────────────────────────────────────────────
  // Density decays exponentially: halves by midpoint, near-zero at top.
  const MAX_FOG = 0.02;
  const halfAlt = config.maxAltitude * 0.5;
  const fogDensity = MAX_FOG * Math.pow(0.5, clampedAlt / halfAlt);

  const fogColor = new THREE.Color().lerpColors(
    config.fogColorSurface,
    config.fogColorHigh,
    tNorm,
  );

  // ── Particles ─────────────────────────────────────────
  let particleType: 'dust' | 'ice' | 'none' = 'none';
  let particleDensity = 0;

  const [iceMin, iceMax] = config.iceBand;

  if (clampedAlt < config.dustCeiling) {
    particleType = 'dust';
    // Full density at 0, fades to 0 at dustCeiling
    particleDensity = 1 - clampedAlt / config.dustCeiling;
  } else if (clampedAlt >= iceMin && clampedAlt <= iceMax) {
    particleType = 'ice';
    // Ramps up from iceMin, peaks at midpoint, ramps back to 0 at iceMax
    const iceMid = (iceMin + iceMax) / 2;
    const iceHalf = (iceMax - iceMin) / 2;
    particleDensity = iceHalf > 0
      ? 1 - Math.abs(clampedAlt - iceMid) / iceHalf
      : 1;
  }

  return {
    skyColor,
    fogDensity,
    fogColor,
    particleDensity,
    particleType,
  };
}
