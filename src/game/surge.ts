// [night-12bb] R2i, D-249: what the overlay and the pause sheet show of the announced demand surge. Pure: reads the
// sim's SurgeView (null when nothing is announced) and formats the airport's local clock; no DOM, no Sim.
import type { SurgeView } from '../sim';

export type SurgePhaseShown = 'announced' | 'active';
/** The tag's surge stub: hollow pennant + "+N HH:00" while announced, filled pennant + "+N to HH:00" while running. */
export interface SurgeMark {
  readonly phase: SurgePhaseShown;
  readonly passengers: number;
  /** Local start time while announced, local end time while running ("14:00"). */
  readonly time: string;
}

export function localClock(hour: number): string {
  return `${String(((hour % 24) + 24) % 24).padStart(2, '0')}:00`;
}

export function surgeMark(view: SurgeView | null): { readonly cityId: string; readonly mark: SurgeMark } | null {
  if (!view) return null;
  return {
    cityId: view.cityId,
    mark: {
      phase: view.active ? 'active' : 'announced', passengers: view.passengers,
      time: localClock(view.active ? view.endLocalHour : view.startLocalHour),
    },
  };
}

/** Stable key so the session touches the overlay only when the mark changes. */
export function surgeKey(shown: ReturnType<typeof surgeMark>): string {
  return shown ? `${shown.cityId}/${shown.mark.phase}/${shown.mark.passengers}/${shown.mark.time}` : '';
}
