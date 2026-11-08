// [ext-04 E4] D-283/D-285: one globe look, the Linoryt print. The satellite (D-170), Mapa (D-172), diorama and the DEV
// comparison looks were removed after the flip (step U5 of PLAN-LINORYT.md).
// [night-70a R1] D-323: `earth` is the realistic NASA globe, a DEV-only preview (`?look=earth`) until the flip (R5);
// a release build folds its chunk away, so the shipped look stays the print.
export type GlobeLook = 'linoryt' | 'earth';
/** The look every renderer draws unless a DEV preview asks for another (kept explicit at the call sites). */
export const DEFAULT_GLOBE_LOOK: GlobeLook = 'linoryt';
