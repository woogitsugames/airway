# Task 07 — route drawing gestures

## Touch interaction

1. Touch within 28 dp of a visible airport and drag; otherwise the camera gesture handler can rotate the globe.
2. A projected airport snaps within 36 dp. Passing several airports in one gesture builds a route with stops. Moving back over the previous airport removes the last stop.
3. Releasing over a snapped airport submits `AddRoute`; starting from a 48 dp end handle, offset 20 dp from an airport, submits `ExtendRoute`. Release in empty space cancels the edit.
4. Every leg is checked against the active aircraft range. The 3D ghost turns red beyond the maximum leg distance; an ATC paper strip explains that another stop is needed. Invalid edits are never submitted.
5. Long-press a route for its Remove/Shorten actions. The dock luggage tag calls the simulation undo hook. All editing temporarily uses speed 0.25x (or stays paused when already at speed 0).
6. Selection and acceptance call optional native haptic hooks; browser implementation does nothing.

## Screenshot status

No in-game PNG was produced in this isolated task branch: tasks 04 (camera/gestures), 06 (airport positions), 08 (route simulation) and the production globe are not yet merged into `dev`. The current game root only renders the empty sky, so screenshots would misleadingly depict a feature that cannot be mounted yet. Once dependencies merge, run `npm run shots` with the integrated scene and save inspected 412x915 and 915x412 screenshots here.

This is an adapter-based implementation, not a claim of end-to-end playability. The owner should verify touch affordances on a device after integration.
