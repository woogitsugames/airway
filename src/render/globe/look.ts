// [ext-04 E4] D-283/D-285: one globe look, the Linoryt print. The satellite (D-170), Mapa (D-172), diorama and the DEV
// comparison looks were removed after the flip (step U5 of PLAN-LINORYT.md).
export type GlobeLook = 'linoryt';
/** The look every renderer draws (kept as a constant so the type and the call sites stay explicit). */
export const DEFAULT_GLOBE_LOOK: GlobeLook = 'linoryt';
