/**
 * [night-11au] D-256: the KARTA skin preview (docs/styles/ui-2026-11/KIERUNKI.md), DEV only, pending the owner's choice.
 * src/main.ts turns it on in a DEV build with `?skin=karta` (production never sets it: the shipped UI stays the
 * "Diorama" skin of current.css). While on, the airport overlay names every on-screen airport (chart lettering) and
 * hands src/ui/skin/karta.css the geometry it draws from: leader line to the airport, seat scale, week ruler.
 */
export const skinPreview = { karta: false };

/** Turns the preview on: <html data-skin="karta"> scopes karta.css (call before the HUD and overlay are mounted). */
export function startKartaPreview(): void {
  skinPreview.karta = true;
  document.documentElement.dataset.skin = 'karta';
}
