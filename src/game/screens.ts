// The single screen router (task 14): menu, settings, licences and every mode screen that the
// composition root registers. Back/Escape is handled once here via src/platform/back.
import { installBackHandler, type BackOptions } from '../platform';
import { createMenu, type MenuData, type MenuHandle, type MenuMode } from '../ui/menu/menu';
import { createSettings, createLicenses, createPrivacy } from '../ui/settings/settings';
import { createLogbook, type LogbookData } from '../ui/logbook/logbook';

export type ScreenName = 'menu' | 'settings' | 'licenses' | 'privacy' | 'logbook' | 'puzzles' | 'tutorial' | 'game';
export type ModeScreen = Exclude<ScreenName, 'menu' | 'settings' | 'licenses' | 'privacy' | 'logbook'>;
type RouterScreen = 'menu' | 'settings' | 'licenses' | 'privacy' | 'logbook';

/** A registered screen. back() returns true when it consumed the press (e.g. closed a sheet). */
export interface ScreenView {
  readonly element: HTMLElement;
  readonly focus?: HTMLElement | null;
  back?(): boolean;
  dispose?(): void;
}

export interface ScreensOptions {
  readonly getMenuData?: () => MenuData;
  /** [night-10n] Local stores for the logbook screen, read each time it opens. */
  readonly getLogbookData?: () => LogbookData;
  readonly onMode?: (mode: MenuMode) => void;
  readonly onScreen?: (screen: ScreenName) => void;
  readonly onLanguageChanged?: () => void;
  readonly onReplayTutorial?: () => void;
  readonly back?: BackOptions;
}
export interface ScreensHandle {
  readonly current: () => ScreenName;
  show(screen: RouterScreen): void;
  /** Replace the active screen with a mode screen built by the caller. */
  open(screen: ModeScreen, view: ScreenView): void;
  refresh(): void;
  dispose(): void;
}

export function mountScreens(host: HTMLElement, options: ScreensOptions = {}): ScreensHandle {
  const layer = document.createElement('div');
  layer.className = 'airway-screen-root';
  host.append(layer);
  let name: ScreenName = 'menu';
  let menu: MenuHandle | null = null;
  let active: ScreenView = buildMenu();
  layer.append(active.element);
  let menuFocus: HTMLElement | null = null;

  function buildMenu(): ScreenView {
    menu = createMenu((mode) => {
      if (mode === 'settings' || mode === 'logbook') show(mode);
      else options.onMode?.(mode);
    }, options.getMenuData?.());
    const handle = menu;
    return { element: handle.element, dispose: () => handle.dispose() };
  }
  function replace(next: ScreenName, view: ScreenView): void {
    if (name === 'menu') menuFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    active.element.remove();
    active.dispose?.();
    if (name === 'menu') menu = null;
    name = next;
    active = view;
    layer.dataset.screen = next;
    layer.append(view.element);
    const focus = view.focus ?? view.element.querySelector<HTMLElement>('.airway-settings__back');
    if (next === 'menu') {
      const target = menuFocus && document.contains(menuFocus) ? menuFocus
        : view.element.querySelector<HTMLElement>('button');
      target?.focus({ preventScroll: true });
    } else focus?.focus({ preventScroll: true });
    options.onScreen?.(next);
  }
  function show(screen: RouterScreen, force = false): void {
    if (screen === name && !force) return;
    if (screen === 'menu') replace('menu', buildMenu());
    else if (screen === 'settings') {
      replace('settings', createSettings(() => show('menu'), () => show('licenses'), () => {
        options.onLanguageChanged?.();
        show('settings', true);
      }, options.onReplayTutorial, () => show('privacy')));
    } else if (screen === 'logbook') {
      const data = options.getLogbookData?.();
      if (!data) return;
      replace('logbook', createLogbook(() => show('menu'), data));
    } else if (screen === 'privacy') replace('privacy', createPrivacy(() => show('settings'))); // [night-11e]
    else replace('licenses', createLicenses(() => show('settings')));
  }
  const back = (): boolean => {
    if (active.back?.()) return true;
    if (name === 'licenses' || name === 'privacy') { show('settings'); return true; }
    if (name !== 'menu') { show('menu'); return true; }
    // On the root menu the OS owns app exit.
    return false;
  };
  const removeBack = installBackHandler(back, options.back);
  layer.dataset.screen = name;
  return {
    current: () => name,
    show,
    open: (screen, view) => replace(screen, view),
    refresh: () => menu?.refresh(options.getMenuData?.()),
    dispose: () => { removeBack(); active.dispose?.(); layer.remove(); },
  };
}
