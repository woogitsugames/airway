// [night-03] Run events and hourly hub readings → read-only audio cues ("Resonant hubs", D-30/D-71).
// Presentation only: reads EndlessRun views, never writes run state, allocates nothing per tick
// except on the game-hour boundary.
import type { AudioCue } from '../audio/events';
import { GAME_TICKS_PER_HOUR } from '../sim/params';
import type { EndlessRun, RunCity, RunEvent } from './run';

/** Hubs above this load get a drone update; below it a droning hub is released once. */
const LOAD_REPORT_RATIO = 0.6;
const MAX_LOAD_REPORTS = 4;
const MAX_DAWN_BLOOMS = 2;
const DAWN_HOUR = 6;

export interface CueRun {
  readonly tick: number;
  readonly clockMinute: number;
  cityList(): RunCity[];
  localHour(cityId: string): number;
}

/** Adapter from the real run; kept separate so the mapper is testable without a Sim. */
export function cueRun(run: EndlessRun): CueRun {
  return {
    get tick() { return run.tick; },
    get clockMinute() { return run.clockMinute; },
    cityList: () => run.cityList(),
    localHour: (cityId) => run.sim.world.cityView(cityId).localHour,
  };
}

/**
 * [night-12t] D-153: the audio engine places a cue `cue.tick - clock` ticks ahead, and every cue carries `run.tick`,
 * so the engine clock must be the sim tick too. The world minute stands still while a weekly offer command takes its
 * tick (hub pick, CancelUpgradePick), and main.ts passed the minute: each such tick pushed every later chime 0.1 s
 * (at 1x) further into the future.
 */
export function audioClockTick(run: Pick<CueRun, 'tick'>): number { return run.tick; }

/** [night-11af] The game hour a reading belongs to; shared by the drone readings and the fill trend (R4c). */
export function gameHour(clockMinute: number): number { return Math.floor(clockMinute / GAME_TICKS_PER_HOUR); }

function isNight(hour: number): boolean { return hour < DAWN_HOUR || hour >= 22; }

export class AudioCueMapper {
  private hour = -1;
  private readonly droning = new Set<string>();
  private readonly slotWaitHour = new Map<string, number>();

  constructor(private readonly cue: (cue: AudioCue) => void) {}

  /** Map drained run events. */
  events(events: readonly RunEvent[], run: CueRun): void {
    if (!events.length) return;
    let cities: RunCity[] | null = null;
    const city = (id: string): RunCity | undefined => (cities ??= run.cityList()).find((item) => item.id === id);
    for (const event of events) {
      if (event.type === 'arrival' || event.type === 'transfer') {
        const at = city(event.cityId);
        this.cue({ type: event.type, tick: run.tick, hubId: event.cityId, latitude: at?.lat ?? 0,
          regionId: at?.region, capacity: at?.capacity, night: isNight(run.localHour(event.cityId)),
          loadRatio: at && at.capacity > 0 ? at.waiting.length / at.capacity : 0 });
      } else if (event.type === 'jam' && event.jammed) {
        const at = city(event.cityId);
        if (!at) continue;
        this.droning.add(event.cityId);
        this.cue({ type: 'hub-load', tick: run.tick, hubId: event.cityId, latitude: at.lat, regionId: at.region,
          loadRatio: 1, capacity: at.capacity });
      } else if (event.type === 'week') {
        this.cue({ type: 'week', tick: run.tick, week: event.week });
      } else if (event.type === 'slot-held') {
        // One wait cue per airport per game hour; a held bank would otherwise tick every minute.
        const hour = Math.floor(run.clockMinute / GAME_TICKS_PER_HOUR);
        if (this.slotWaitHour.get(event.cityId) === hour) continue;
        this.slotWaitHour.set(event.cityId, hour);
        this.cue({ type: 'slot-wait', tick: run.tick });
      } else if (event.type === 'new-city') {
        const at = city(event.cityId);
        this.cue({ type: 'new-city', tick: run.tick, latitude: at?.lat ?? 0, regionId: at?.region });
      }
    }
  }

  /** Once per game hour: graded hub load (tension drones) and dawn blooms at hubs. */
  hourly(run: CueRun): void {
    const hour = gameHour(run.clockMinute);
    if (hour === this.hour) return;
    this.hour = hour;
    const hubs = run.cityList().filter((city) => city.hub || this.droning.has(city.id));
    const loads = hubs.map((city) => ({ city, ratio: city.capacity > 0 ? city.waiting.length / city.capacity : 0 }))
      .sort((a, b) => b.ratio - a.ratio || (a.city.id < b.city.id ? -1 : 1));
    let reported = 0;
    for (const { city, ratio } of loads) {
      const loud = ratio >= LOAD_REPORT_RATIO && reported < MAX_LOAD_REPORTS;
      if (!loud && !this.droning.has(city.id)) continue;
      if (loud) { reported++; this.droning.add(city.id); } else this.droning.delete(city.id);
      this.cue({ type: 'hub-load', tick: run.tick, hubId: city.id, latitude: city.lat, regionId: city.region,
        loadRatio: loud ? ratio : 0, capacity: city.capacity, night: isNight(run.localHour(city.id)) });
    }
    let blooms = 0;
    for (const city of hubs) {
      if (blooms >= MAX_DAWN_BLOOMS || !city.hub || run.localHour(city.id) !== DAWN_HOUR) continue;
      blooms++;
      this.cue({ type: 'dawn', tick: run.tick, hubId: city.id, latitude: city.lat, regionId: city.region });
    }
  }

  /** Player actions that land: tag for a new or longer route, paper for a removal, stamp for an upgrade. */
  command(type: string): void {
    if (type === 'AddRoute' || type === 'ExtendRoute') this.cue({ type: 'tag' });
    else if (type === 'RemoveRoute' || type === 'ShortenRoute') this.cue({ type: 'paper' });
    else if (type === 'ChooseUpgrade') this.cue({ type: 'stamp' });
  }
}
