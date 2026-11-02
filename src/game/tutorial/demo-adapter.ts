import type { TutorialAction, TutorialPort } from './controller';

/** [task-23] Temporary deterministic demonstration port until tasks 07/12/13 are merged.
 *  Does not mutate the authoritative simulation; replace via mountTutorial's `port` option.
 */
export class DemoTutorialPort implements TutorialPort {
  readonly accepted: TutorialAction[] = [];
  paused = false;
  perform(action: TutorialAction): boolean {
    this.accepted.push(action);
    return true;
  }
  setPaused(paused: boolean): void { this.paused = paused; }
  reset(): void { this.accepted.length = 0; this.paused = true; }
}
