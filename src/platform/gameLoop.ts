/**
 * [night-12ay] R3i (D-245): the native side of a Firebase Test Lab game-loop run. Android's MainActivity registers
 * the `AirwayGameLoop` plugin (GameLoopPlugin.java): `launch()` says whether the activity was started with
 * `com.google.intent.action.TEST_LOOP` and which scenario; `finish({ report })` writes the JSON to the result file
 * URI Test Lab passed and finishes the activity. Everywhere else (web, iOS, a normal Android launch) there is no
 * game loop and nothing changes.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export const GAME_LOOP_PLUGIN = 'AirwayGameLoop';

export interface GameLoopLaunch {
  readonly scenario: number;
}

/** Structural plugin port (keeps the logic testable in Node). */
export interface GameLoopPluginPort {
  launch(): Promise<{ active: boolean; scenario?: number }>;
  finish(options: { report: string }): Promise<void>;
}

export interface GameLoopBridge {
  readonly launch: GameLoopLaunch;
  /** Writes the report to Test Lab's result file and ends the activity. Never throws. */
  finish(report: string): Promise<void>;
}

/** Reads the launch through a plugin port; null when the app was not started as a game loop. Never throws. */
export async function readGameLoop(port: GameLoopPluginPort | null): Promise<GameLoopBridge | null> {
  if (!port) return null;
  try {
    const launch = await port.launch();
    if (!launch?.active) return null;
    const scenario = Number.isInteger(launch.scenario) && (launch.scenario ?? 0) > 0 ? launch.scenario! : 1;
    return {
      launch: { scenario },
      finish: async (report) => {
        try { await port.finish({ report }); } catch { /* The activity times itself out (GameLoopPlugin). */ }
      },
    };
  } catch {
    return null;
  }
}

/** The Android plugin, or null on the web, on iOS and in builds without it. */
export function nativeGameLoopPort(): GameLoopPluginPort | null {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;
    if (!Capacitor.isPluginAvailable(GAME_LOOP_PLUGIN)) return null;
    return registerPlugin<GameLoopPluginPort>(GAME_LOOP_PLUGIN);
  } catch {
    return null;
  }
}
