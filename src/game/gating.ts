import type { Entitlements } from '../platform/store';

/** D-16: do not change this without an explicit owner decision. */
export const GATING_ENABLED = false;

/** Maps content IDs (modes, puzzle IDs, etc.) to store entitlement IDs. */
export interface GatingConfig {
  readonly requiredEntitlements: Readonly<Record<string, string>>;
}

/** No content is assigned to a paid entitlement in this release. */
export const DEFAULT_GATING_CONFIG: GatingConfig = Object.freeze({
  requiredEntitlements: Object.freeze({}),
});

/**
 * Use this boundary when content navigation is integrated in a later task.
 * The shipping toggle wins over every provided configuration or store state.
 */
export function canAccessContent(
  contentId: string,
  entitlements: Pick<Entitlements, 'isUnlocked'>,
  config: GatingConfig = DEFAULT_GATING_CONFIG,
): boolean {
  if (!GATING_ENABLED) return true;

  // Own-property lookup prevents inherited object keys from becoming gates.
  if (!Object.hasOwn(config.requiredEntitlements, contentId)) return true;
  const entitlementId = config.requiredEntitlements[contentId];
  return typeof entitlementId === 'string' && entitlementId.length > 0 &&
    entitlements.isUnlocked(entitlementId);
}
