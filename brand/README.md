# Airway Android mark

The original terminal wayfinding sign pairs the yellow `#FFC72C` with black `#1C1E20` from Diorama D-11.
The plane is a top-down silhouette, not a stock icon or an emoji. No third-party art is used.

- `wayfinding.svg`: editable logo/sign for brand use (Overpass 800, SIL OFL, already listed in docs/ASSETS.md).
- `../resources/icon.svg`: opaque store/legacy launcher icon.
- `../resources/icon-foreground.svg`: adaptive foreground within the launcher safe zone.
- `../resources/splash.svg`: transparent centred splash graphic.
- `npm run android:assets` regenerates native PNGs from these SVG shapes with a dependency-free Node rasterizer.
