// Single back-navigation entry point for Android hardware/gesture back, Escape and browser history.

/**
 * Event dispatched by android/app/src/main/java/pl/samsufi/airway/MainActivity.java.
 * It is cancelable: a handler that consumes back calls preventDefault(), otherwise
 * the activity moves the task to the background (the OS owns app exit).
 */
export const ANDROID_BACK_EVENT = 'airway:android-back';

export type RemoveBackListener = () => void;
/** Optional extra native source (e.g. another shell); receives the same handler. */
export type RegisterNativeBack = (callback: () => boolean) => RemoveBackListener;

export interface BackOptions {
  registerNativeBack?: RegisterNativeBack;
  /** Also treat browser history popstate as back (web builds only). */
  browserHistory?: boolean;
}

/**
 * `onBack` returns true when the screen router consumed the event (closed a
 * sheet, left settings, paused the run). Returning false on the root menu lets
 * Android background the app. Only one handler should be installed at a time.
 */
export function installBackHandler(onBack: () => boolean, options: BackOptions = {}): RemoveBackListener {
  if (typeof window === 'undefined') return () => {};
  const consume = (event: Event): void => { if (onBack()) event.preventDefault(); };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'BrowserBack') consume(event);
  };
  const onPop = (): void => { void onBack(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener(ANDROID_BACK_EVENT, consume);
  if (typeof document !== 'undefined') document.addEventListener('backbutton', consume);
  if (options.browserHistory) window.addEventListener('popstate', onPop);
  const detachNative = options.registerNativeBack?.(onBack);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener(ANDROID_BACK_EVENT, consume);
    if (typeof document !== 'undefined') document.removeEventListener('backbutton', consume);
    if (options.browserHistory) window.removeEventListener('popstate', onPop);
    detachNative?.();
  };
}
