/**
 * Advertising boundary. D-16: no ad SDK, tracking, or ad permissions ship.
 * Rewarded ads may be requested only voluntarily, and interstitials only
 * between runs, if a later owner decision permits them.
 */
export interface AdService {
  isEnabled(): boolean;
  /** True only if the player actually earned a voluntarily requested reward. */
  showRewarded?(): Promise<boolean>;
  /** True only if an ad was actually shown; never call during gameplay. */
  showInterstitialBetweenRuns?(): Promise<boolean>;
}

/** Safe default even if a future caller accidentally invokes an ad method. */
export const disabledAds: Readonly<AdService> = Object.freeze({
  isEnabled: (): boolean => false,
  showRewarded: async (): Promise<boolean> => false,
  showInterstitialBetweenRuns: async (): Promise<boolean> => false,
});
