// [m2] Composition of the contextual hints for one live run: queue (hints.ts) + ATC strip view
// (ui/tutorial/hintStrip.ts) + i18n copy. session.ts only reports events.
import { t } from '../../i18n';
import { mountHintStrip } from '../../ui/tutorial/hintStrip';
import { browserTutorialStorage } from './controller';
import { HINT_VISIBLE_MS, HintQueue, type HintContext, type HintStorage } from './hints';
import { slotHintContent } from './slot-hint';

export interface RunHints {
  /** First hub-jam countdown (overload warning, before game over). */
  jam(airport: string, stillJammed: () => boolean): void;
  /** First airport closed for the night curfew. */
  curfew(airport: string): void;
  /** First aircraft held for a departure slot (task 32 "SLOTS 07"). */
  slots(airport: string, limit: number, minutesToSlot: number): void;
  /** First weekly board. */
  board(): void;
  setContext(context: HintContext): void;
  readonly visible: string | null;
  dispose(): void;
}

/** DEV store screenshots (`?storeShot`) never show training strips. */
function storeShot(): boolean {
  try { return import.meta.env.DEV && new URLSearchParams(location.search).has('storeShot'); } catch { return false; }
}
/** DEV/QA only: `window.__awHintMs` holds strips longer for slow SwiftShader screenshots. */
function visibleMs(): number {
  const hold = import.meta.env.DEV ? (globalThis as { __awHintMs?: unknown }).__awHintMs : undefined;
  return typeof hold === 'number' && hold > 0 ? hold : HINT_VISIBLE_MS;
}

export function mountRunHints(host: HTMLElement, enabled: () => boolean,
  storage: HintStorage | null = browserTutorialStorage()): RunHints {
  const view = mountHintStrip(host, () => queue.hide());
  const queue = new HintQueue({ storage, view, enabled: () => !storeShot() && enabled(), visibleMs });
  return {
    jam(airport, stillJammed) {
      queue.request('jam', { valid: stillJammed, content: () => ({
        step: t('tutorial.step.jam'), tag: t('tutorial.jam.tag', { airport }), text: t('tutorial.jam.hint', { airport }),
      }) });
    },
    curfew(airport) {
      queue.request('curfew', { content: () => ({
        step: t('tutorial.step.curfew'), tag: t('tutorial.curfew.tag', { airport }), text: t('tutorial.curfew.hint', { airport }),
      }) });
    },
    slots(airport, limit, minutesToSlot) {
      queue.request('slots', { content: () => slotHintContent(airport, limit, minutesToSlot) });
    },
    board() {
      queue.request('upgrade', { content: () => ({
        // The yellow sign already names the week; the strip keeps only the rule.
        step: t('tutorial.step.weekly'), tag: '', text: t('tutorial.weekly.hint'),
      }) });
    },
    setContext: (context) => queue.setContext(context),
    get visible() { return queue.visible; },
    dispose() { queue.dispose(); view.dispose(); },
  };
}
