/**
 * [night-12bd] R2j: the weather front (runs whose GameConfig carries `weatherFront`; off in shipped Endless).
 *
 * From WEATHER_FIRST_WEEK on, every week has one front: a cloud band WEATHER_HEIGHT_TENTHS of latitude tall that forms
 * a few game hours after the weekly board at a drawn longitude and drifts east at a fixed speed, sweeping the whole
 * circle once before the next board. Its eastern edge leads; behind it the deck is WEATHER_WIDTH_TENTHS wide (narrower
 * while it forms and while it thins out over its starting longitude). An airport inside the band's latitudes is under
 * the deck for WEATHER_WIDTH_TENTHS / speed minutes and loses WEATHER_SLOT_PENALTY hourly departure slot meanwhile.
 *
 * The path is a pure function of the seed and the week: `new Rng(seed).fork('weather/<week>')` (its own branch; no
 * kernel stream moves and nothing is added to the snapshot). Integer tenths of a degree and game minutes only, no
 * transcendentals (D-13). The world (world.ts) asks it per minute; render only draws what it returns.
 */
import { Rng } from '../core/rng.ts';
import {
  SIM_MINUTES_PER_WEEK, WEATHER_FIRST_WEEK, WEATHER_FORECAST_MINUTES, WEATHER_FORM_HOURS, WEATHER_HEIGHT_TENTHS,
  WEATHER_SOUTH_TENTHS, WEATHER_SPEED_TENTHS_PER_MINUTE, WEATHER_START_STEP_TENTHS, WEATHER_WIDTH_TENTHS,
} from './params.ts';

/** A full turn of longitude in tenths of a degree. */
export const TURN_TENTHS = 3600;
/** Minutes the leading edge needs for a full turn, and minutes an airport stays under the deck. */
const TURN_MINUTES = TURN_TENTHS / WEATHER_SPEED_TENTHS_PER_MINUTE;
const UNDER_MINUTES = WEATHER_WIDTH_TENTHS / WEATHER_SPEED_TENTHS_PER_MINUTE;
/** The front lives until its trailing edge has passed its starting longitude. */
export const WEATHER_LIFE_MINUTES = TURN_MINUTES + UNDER_MINUTES;

export interface WeatherFront {
  readonly week: number;
  /** Game minute the band forms (zero width) at `startLon10`. */
  readonly formTick: number;
  /** First minute the front is gone: formTick + WEATHER_LIFE_MINUTES. */
  readonly endTick: number;
  /** Longitude (tenths of a degree, −1800…1799) where the band forms; its eastern edge moves east from here. */
  readonly startLon10: number;
  /** Latitude span [southLat10, northLat10) in tenths of a degree. */
  readonly southLat10: number;
  readonly northLat10: number;
}

/** The band at one minute (tenths of a degree): from `westLon10` east to `eastLon10` (may cross ±180°, unwrapped). */
export interface WeatherBand {
  readonly westLon10: number;
  readonly eastLon10: number;
  readonly southLat10: number;
  readonly northLat10: number;
}

/** One airport's front: under the deck in [fromTick, toTick). */
export interface AirportFront {
  readonly fromTick: number;
  readonly toTick: number;
}
export type AirportFrontPhase = 'ahead' | 'under';

const mod = (value: number, by: number): number => ((value % by) + by) % by;

/** The week a minute belongs to for the weather (the board minute already shows the coming week's front). */
export function weatherWeekAt(minute: number): number {
  if (!Number.isSafeInteger(minute) || minute < 0) throw new RangeError('Invalid minute');
  return Math.floor(minute / SIM_MINUTES_PER_WEEK) + 1;
}

/** The front of `week` (null before WEATHER_FIRST_WEEK). Same seed and week, same front. */
export function drawFront(seed: number, week: number): WeatherFront | null {
  if (!Number.isSafeInteger(week) || week < 1) throw new RangeError('Invalid week');
  if (week < WEATHER_FIRST_WEEK) return null;
  const rng = new Rng(seed >>> 0).fork(`weather/${week}`);
  const formTick = (week - 1) * SIM_MINUTES_PER_WEEK + WEATHER_FORM_HOURS[rng.int(WEATHER_FORM_HOURS.length)]! * 60;
  const startLon10 = -1800 + rng.int(TURN_TENTHS / WEATHER_START_STEP_TENTHS) * WEATHER_START_STEP_TENTHS;
  const southLat10 = WEATHER_SOUTH_TENTHS[rng.int(WEATHER_SOUTH_TENTHS.length)]!;
  return { week, formTick, endTick: formTick + WEATHER_LIFE_MINUTES, startLon10, southLat10, northLat10: southLat10 + WEATHER_HEIGHT_TENTHS };
}

/** When the front covers a point (tenths of a degree), or null when the point lies outside its latitudes. */
export function frontOver(front: WeatherFront, lon10: number, lat10: number): AirportFront | null {
  if (lat10 < front.southLat10 || lat10 >= front.northLat10) return null;
  const fromTick = front.formTick + mod(lon10 - front.startLon10, TURN_TENTHS) / WEATHER_SPEED_TENTHS_PER_MINUTE;
  return { fromTick, toTick: fromTick + UNDER_MINUTES };
}

/** Is the point under the deck at `minute`? */
export function frontCovers(front: WeatherFront, lon10: number, lat10: number, minute: number): boolean {
  const over = frontOver(front, lon10, lat10);
  return over !== null && minute >= over.fromTick && minute < over.toTick;
}

/**
 * What an airport shows at `minute`: 'under' while covered, 'ahead' within WEATHER_FORECAST_MINUTES before the deck
 * arrives (only from the week's board on), otherwise null.
 */
export function airportFrontPhase(front: WeatherFront, over: AirportFront | null, minute: number): AirportFrontPhase | null {
  if (!over) return null;
  if (minute >= over.fromTick && minute < over.toTick) return 'under';
  const weekStart = (front.week - 1) * SIM_MINUTES_PER_WEEK;
  return minute < over.fromTick && minute >= weekStart && over.fromTick - minute <= WEATHER_FORECAST_MINUTES ? 'ahead' : null;
}

/** The band at `minute`, or null before it forms and after it is gone. */
export function frontBand(front: WeatherFront, minute: number): WeatherBand | null {
  const elapsed = minute - front.formTick;
  if (elapsed < 0 || minute >= front.endTick) return null;
  const lead = Math.min(elapsed, TURN_MINUTES) * WEATHER_SPEED_TENTHS_PER_MINUTE;
  const trail = Math.max(0, elapsed - UNDER_MINUTES) * WEATHER_SPEED_TENTHS_PER_MINUTE;
  return { westLon10: front.startLon10 + trail, eastLon10: front.startLon10 + lead,
    southLat10: front.southLat10, northLat10: front.northLat10 };
}
