/**
 * In-app purchase boundary. D-16: the current game is fully unlocked and free.
 * The native StoreKit / Play Billing adapter belongs to a future, owner-approved task.
 */
export type PurchaseResult = 'already-unlocked' | 'purchased' | 'cancelled' | 'unavailable';
export type RestoreResult = 'not-required' | 'restored' | 'nothing-to-restore' | 'unavailable';

export interface Entitlements {
  /** Cached, synchronous access decision; never performs a network request. */
  isUnlocked(entitlementId: string): boolean;
  /** A completed store transaction is distinct from already-free access. */
  purchase(entitlementId: string): Promise<PurchaseResult>;
  /** Restores a previous purchase without initiating a new transaction. */
  restore(): Promise<RestoreResult>;
}

/**
 * The only shipping adapter. It never invokes a store, creates a purchase,
 * stores an identifier, or restricts content.
 */
export const freeEntitlements: Readonly<Entitlements> = Object.freeze({
  isUnlocked: (_entitlementId: string): boolean => true,
  purchase: async (_entitlementId: string): Promise<PurchaseResult> => 'already-unlocked',
  restore: async (): Promise<RestoreResult> => 'not-required',
});
