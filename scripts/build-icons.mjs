#!/usr/bin/env node
// [night-78a] Z, D-333: regenerate the source SVGs of the app mark and every committed icon / launch image
// (Play 512 icon, iOS icon set and launch image). Android PNGs come from `npm run android:assets` (git-ignored).
// Output is byte-for-byte deterministic; `npm run test:icons` fails when a committed file is stale.
import { sourceSvgs, committedAssets, write } from './icon-assets.mjs';

const svgs = sourceSvgs();
const count = write(svgs) + write(committedAssets());
console.log('SUMMARY icons seed=0xA1A1 generated=' + count + ' failed=0');
