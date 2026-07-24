/**
 * Calculates the platform booking fee.
 * Commission: 5% of cashReward.
 * Minimum limit: 35 DZD (so small tasks are not free).
 * Maximum limit: 2000 DZD (so large tasks are not overly charged).
 */
export function calculateBookingFee(cashReward: number): number {
  const rawFee = Math.round(cashReward * 0.05);
  return Math.min(2000, Math.max(35, rawFee));
}
