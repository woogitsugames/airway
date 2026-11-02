// [task-24] Minimal native Android back event adapter.
// Task 14/16 owns the actual menu/pause/exit policy and will install a handler here.
export const ANDROID_BACK_EVENT = 'airway:android-back';

export function onAndroidBack(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event): void => {
    event.preventDefault();
    handler();
  };
  window.addEventListener(ANDROID_BACK_EVENT, listener);
  return () => window.removeEventListener(ANDROID_BACK_EVENT, listener);
}
