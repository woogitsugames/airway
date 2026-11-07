// [night-12bd] R2j: what the overlay and the pause sheet show of the weather front. Pure: reads the sim's per-airport
// front views (null when none is near) and formats the airport's local clock; no DOM, no Sim.
import type { AirportWeatherView } from '../sim';
import { WEATHER_GROUND_HOLD_MINUTES } from '../sim/params';

/** The front stub shows hold duration and local arrival or clearing time. */
export interface FrontMark {
  readonly phase: 'ahead' | 'under';
  /** Ground-hold duration in game minutes. */
  readonly minutes: number;
  /** Local arrival time while ahead, local clearing time while under ("14:20"). */
  readonly time: string;
}

export function localClockMinute(minuteOfDay: number): string {
  const minute = ((Math.floor(minuteOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function frontMark(view: AirportWeatherView | null, minutes = WEATHER_GROUND_HOLD_MINUTES): FrontMark | null {
  if (!view) return null;
  return { phase: view.phase, minutes, time: localClockMinute(view.phase === 'under' ? view.toLocalMinute : view.fromLocalMinute) };
}

/** Marks for every airport the front is over or forecast for, keyed by airport id (stable order of `ids`). */
export function frontMarks(ids: readonly string[], weatherOf: (id: string) => AirportWeatherView | null): Map<string, FrontMark> {
  const out = new Map<string, FrontMark>();
  for (const id of ids) {
    const mark = frontMark(weatherOf(id));
    if (mark) out.set(id, mark);
  }
  return out;
}

/** Stable key so the session touches the overlay only when a mark changes. */
export function frontKey(mark: FrontMark | null | undefined): string {
  return mark ? `${mark.phase}/${mark.minutes}/${mark.time}` : '';
}

/** The pause sheet's line: airports under the deck now, else the next airport it reaches, else "away". */
export interface FrontSummary {
  readonly under: readonly string[];
  /** Local clearing time of the first airport under the deck. */
  readonly until: string | null;
  readonly next: { readonly airport: string; readonly time: string } | null;
}

export function frontSummary(ids: readonly string[], weatherOf: (id: string) => AirportWeatherView | null,
    label: (id: string) => string): FrontSummary {
  const under: string[] = [];
  let until: string | null = null;
  let next: { airport: string; time: string; at: number } | null = null;
  for (const id of ids) {
    const view = weatherOf(id);
    if (!view) continue;
    if (view.phase === 'under') {
      under.push(label(id));
      until ??= localClockMinute(view.toLocalMinute);
    } else if (!next || view.fromTick < next.at) {
      next = { airport: label(id), time: localClockMinute(view.fromLocalMinute), at: view.fromTick };
    }
  }
  return { under, until, next: next ? { airport: next.airport, time: next.time } : null };
}
