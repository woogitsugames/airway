// [night-86b] D-344 (playtest P-1, owner's answer): the camera follows the network, gently and rarely.
// When an airport opens outside the frame, or an airport of the network sits at the frame's edge (where the overlay
// fades its sign to 20–40 %), the camera eases out once to the whole network: at most once a game day, never while the
// player drags a route, a plane or the globe, and not while the player has moved the camera lately. The dock's
// "whole network" key uses the same framing on demand. Pure and allocation-light: the session hands in the projection.
import { framingPoints, type FramePoint } from './framing';

/** Wall-clock quiet time (ms) after the player's own camera move before the camera may move by itself. */
export const AUTO_FRAME_QUIET_MS = 15_000;
/** An airport closer than this (CSS px) to the free frame's edge counts as "at the edge". */
export const AUTO_FRAME_EDGE_PX = 40;
/** Duration (s) of the eased move; 0 with "Reduce motion" (D-88: the view cuts instead). */
export const AUTO_FRAME_SECONDS = 1.2;
/** Game minutes in a day (the once-a-day gate). */
const DAY_MINUTES = 1440;
/** Zoom the run plays at (session opens at 3); the whole-network key never frames closer than this. */
export const NETWORK_FRAME_MAX_ZOOM = 3;
/** Each step of the zoom search pulls back by this factor. */
const ZOOM_STEP = 0.9;

/** The free frame (CSS px): the screen minus the HUD bands and the dock. */
export interface FrameRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

/** One airport as the camera sees it now. */
export interface FramedAirport {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  /** On a route of the network. */
  readonly connected: boolean;
  /** Opened since the last check (the first sync after a CitySpawned). */
  readonly fresh: boolean;
}

function inside(point: { x: number; y: number; visible: boolean }, rect: FrameRect, margin: number): boolean {
  return point.visible && point.x >= rect.left + margin && point.x <= rect.right - margin &&
    point.y >= rect.top + margin && point.y <= rect.bottom - margin;
}

/** Why the camera should pull back, or null: a new airport outside the frame, or a network airport at its edge. */
export function framingReason(airports: readonly FramedAirport[], rect: FrameRect, edge = AUTO_FRAME_EDGE_PX): 'new' | 'edge' | null {
  for (const a of airports) if (a.fresh && !inside(a, rect, 0)) return 'new';
  for (const a of airports) if (a.connected && !inside(a, rect, edge)) return 'edge';
  return null;
}

/**
 * The gate: once a game day, never during a gesture or drag, never soon after the player's own camera move.
 * `day` is `Math.floor(clockMinute / 1440)`; the run's opening day counts as framed (the session opens on the network).
 */
export class AutoFrameGate {
  private lastDay: number;
  private lastUserMs = Number.NEGATIVE_INFINITY;

  constructor(openingMinute: number) { this.lastDay = gameDay(openingMinute); }

  /** The player turned, zoomed or tapped the camera somewhere (gesture, wheel, keys, a direction sign, the dock key). */
  noteUserCamera(nowMs: number): void { this.lastUserMs = nowMs; }

  allowed(clockMinute: number, nowMs: number, busy: boolean): boolean {
    return !busy && gameDay(clockMinute) !== this.lastDay && nowMs - this.lastUserMs >= AUTO_FRAME_QUIET_MS;
  }

  /** Records the move (the day is used up). */
  fired(clockMinute: number): void { this.lastDay = gameDay(clockMinute); }

  /** An undo can take the clock back a day: the gate follows it so the next day may frame again. */
  rewind(clockMinute: number): void { this.lastDay = Math.min(this.lastDay, gameDay(clockMinute)); }
}

function arcDeg(a: FramePoint, b: FramePoint): number {
  const DEG = Math.PI / 180;
  const cos = Math.sin(a.lat * DEG) * Math.sin(b.lat * DEG) + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((a.lon - b.lon) * DEG);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
}

export function gameDay(clockMinute: number): number {
  return Math.floor(clockMinute / DAY_MINUTES);
}

/** A camera the planner may try out (set, project, restore): `GlobeOrbitCamera` plus the session's projection. */
export interface FramingProbe {
  /** Puts the camera at the centre and zoom (no easing) and says whether every one of `points` lies in the frame. */
  fits(lon: number, lat: number, zoom: number, points: readonly FramePoint[]): boolean;
}

/**
 * Airports farther than this (degrees of arc) from the framing's centre cannot stand in a readable frame with the rest
 * (they are on the globe's rim or behind it): they keep their direction sign instead of pulling the camera to zoom 1.
 */
export const FRAME_CAP_DEG = 70;

export interface FrameTarget { readonly lon: number; readonly lat: number; readonly zoom: number }

/** Spherical mean (degrees), as `GlobeOrbitCamera.fitNetwork` centres. */
export function sphericalMean(points: readonly FramePoint[]): { lon: number; lat: number } | null {
  let x = 0;
  let y = 0;
  let z = 0;
  const DEG = Math.PI / 180;
  for (const p of points) {
    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
    const c = Math.cos(p.lat * DEG);
    x += c * Math.sin(p.lon * DEG);
    y += Math.sin(p.lat * DEG);
    z += c * Math.cos(p.lon * DEG);
  }
  if (Math.hypot(x, y, z) < 1e-4) return null;
  return { lon: Math.atan2(x, z) / DEG, lat: Math.atan2(y, Math.hypot(x, z)) / DEG };
}

/**
 * The framing: the centre of the points (`cluster` = the densest cluster when they span several continents, as the
 * opening view), and the closest zoom ≤ `maxZoom` at which every framed point lies in the frame (down to 1).
 */
export function planNetworkFrame(points: readonly FramePoint[], maxZoom: number, probe: FramingProbe, cluster = true): FrameTarget | null {
  const chosen = cluster ? framingPoints(points) : points;
  const rough = sphericalMean(chosen);
  if (!rough) return null;
  // The far ones would only drag the centre into the ocean: drop them and centre on the rest.
  const framed = chosen.filter((p) => arcDeg(p, rough) <= FRAME_CAP_DEG);
  const centre = sphericalMean(framed) ?? rough;
  let zoom = Math.max(1, maxZoom);
  for (;;) {
    if (probe.fits(centre.lon, centre.lat, zoom, framed)) return { lon: centre.lon, lat: centre.lat, zoom };
    if (zoom <= 1) return { lon: centre.lon, lat: centre.lat, zoom: 1 };
    zoom = Math.max(1, zoom * ZOOM_STEP);
  }
}
