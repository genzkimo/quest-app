/**
 * Calculates the platform booking fee.
 * Commission: 5% of applicable cash reward.
 * For long-term jobs ('long_term'), fee is calculated on 15 days of salary (i.e. cashReward / 2) to lighten the fee.
 * Minimum limit: 35 DZD (so small tasks are not free).
 * Maximum limit: 2000 DZD (so large tasks are not overly charged).
 */
export function calculateBookingFee(
 cashRewardOrQuest: number | { cashReward?: number; questType?: string },
 questTypeArg?: string
): number {
 let cashReward = 0;
 let questType = questTypeArg;

 if (typeof cashRewardOrQuest === 'object' && cashRewardOrQuest !== null) {
 cashReward = cashRewardOrQuest.cashReward || 0;
 questType = questType || cashRewardOrQuest.questType;
 } else if (typeof cashRewardOrQuest === 'number') {
 cashReward = cashRewardOrQuest;
 }

 // For long_term jobs, calculate fee based on 15 days of salary (half of monthly salary)
 const baseReward = questType === 'long_term' ? (cashReward / 2) : cashReward;
 const rawFee = Math.round(baseReward * 0.05);
 return Math.min(2000, Math.max(35, rawFee));
}
