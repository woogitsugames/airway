import type { TutorialAction, TutorialPort } from './controller';

/** Port for the isolated three-city training vignette (task 23). It deliberately never touches
 *  a real run: the tutorial is a self-contained illustrated flight before the first Endless game.
 */
export class VignetteTutorialPort implements TutorialPort {
  readonly accepted: TutorialAction[] = [];
  paused = false;
  perform(action: TutorialAction): boolean {
    this.accepted.push(action);
    return true;
  }
  setPaused(paused: boolean): void { this.paused = paused; }
  reset(): void { this.accepted.length = 0; this.paused = true; }
}
