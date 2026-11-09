// [ext-04 E4] D-283/D-285: one globe look, the Linoryt print. The satellite (D-170), Mapa (D-172), diorama and the DEV
// comparison looks were removed after the flip (step U5 of PLAN-LINORYT.md).
// [night-70a R1] D-323: `earth` is the realistic NASA globe, a DEV-only preview (`?look=earth`) until the flip (R5);
// a release build folds its chunk away, so the shipped look stays the print.
// [night-79a R4] D-334: `earth` is in the release build (lazy chunks, textures in dist/) behind this constant, as the
// print was in E3 (D-300); the flip R5 sets it to 'earth' once the owner has accepted the preview.
// [night-81a R5] D-336: the owner accepted it (9.11): `earth` is the shipped look. 'linoryt' stays a DEV-only
// `?look=linoryt` exception until R6 removes the print.
export type GlobeLook = 'linoryt' | 'earth';
/** The look every renderer draws unless a DEV preview asks for another (kept explicit at the call sites). */
export const DEFAULT_GLOBE_LOOK: GlobeLook = 'earth';
