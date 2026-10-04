import type { Quest } from '../types';

export const PENDING_QUEST_TIMEOUT = 8 * 60 * 60 * 1000; // 8 Hours publication window
export const ACTIVE_CONTRACT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 Hours active work window

/**
 * Evaluates whether an open/pending quest or fixed contract has expired.
 * Any expired quest must NEVER be shown on Home, Map, or Search,
 * and should be automatically expunged from the database.
 */
export function isQuestExpired(quest: Quest | null | undefined, now = Date.now()): boolean {
  if (!quest) return false;

  // 1. Explicit expired / cleared flags
  if (quest.status === 'expired' || quest.status === 'stale_cleared') {
    return true;
  }

  // 2. Open / Pending publication quests: 8-hour publication countdown
  if (quest.status === 'open' || (quest.status as any) === 'pending') {
    const createdMs = quest.createdAt ? new Date(quest.createdAt).getTime() : 0;
    if (!isNaN(createdMs) && createdMs > 0 && (now - createdMs) >= PENDING_QUEST_TIMEOUT) {
      return true;
    }
  }

  // 3. Fixed-term long-term contracts where endDate has lapsed
  if (quest.questType === 'long_term' && quest.durationType === 'fixed' && quest.endDate) {
    const endMs = new Date(quest.endDate).getTime();
    if (!isNaN(endMs) && now >= endMs && quest.status !== 'archived') {
      return true;
    }
  }

  return false;
}

/**
 * Checks if an active/booked contract has exceeded the 24-hour limit without extension.
 */
export function isContractTimedOut(quest: Quest | null | undefined, now = Date.now()): boolean {
  if (!quest) return false;
  if (quest.questType === 'long_term') return false;

  if (quest.status === 'active' || quest.status === 'booked') {
    const assignTime = quest.assignedAt
      ? new Date(quest.assignedAt).getTime()
      : quest.createdAt
      ? new Date(quest.createdAt).getTime()
      : 0;
    if (!isNaN(assignTime) && assignTime > 0 && (now - assignTime) >= ACTIVE_CONTRACT_TIMEOUT) {
      return true;
    }
  }

  return false;
}
