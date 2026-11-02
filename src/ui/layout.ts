/** Responsive HUD modes follow the Diorama touch-layout breakpoints. */
export type HudLayout = 'portrait' | 'landscape' | 'foldable';

export function resolveHudLayout(width: number, height: number): HudLayout {
  if (width >= 600 && height >= 600) return 'foldable';
  return width > height ? 'landscape' : 'portrait';
}

/** Observe the actual game surface, rather than relying on initial device orientation. */
export function watchHudLayout(host: HTMLElement, update: (layout: HudLayout) => void): () => void {
  let previous: HudLayout | undefined;
  const measure = (): void => {
    const next = resolveHudLayout(host.getBoundingClientRect().width, host.getBoundingClientRect().height);
    if (next !== previous) {
      previous = next;
      update(next);
    }
  };
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }
  window.addEventListener('resize', measure);
  return () => window.removeEventListener('resize', measure);
}
