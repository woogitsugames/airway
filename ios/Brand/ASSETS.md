## iOS native art — task 25

- `ios/Brand/app-icon.svg`: byte-identical copy of task 24 `resources/icon.svg` from draft PR #12, original black/yellow Airway airport wayfinding mark.
- `ios/Brand/splash.svg`: byte-identical copy of task 24 `resources/splash.svg`; the opaque iOS PNG composites this mark over a black launch background matching Android.
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`: opaque 1024×1024 rendering of the original icon SVG.
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png`: opaque 2732×2732 compositing of the shared transparent splash SVG over Android's black launch background, same PNG bytes across scale slots.

No external images or fonts were used. Sources match task 24 PR #12 as of this commit. After merging task 24, generate from one shared SVG source to avoid drift.
