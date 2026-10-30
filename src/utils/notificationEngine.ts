import { Quest, QuestCategory, UserProfile } from '../types';

/**
 * Calculates distance between two GPS coordinates using the Haversine formula (km).
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Extracts GPS coordinates from a Quest object.
 */
export function getQuestCoordinates(quest: Quest): { lat: number; lng: number } | null {
  if (quest.gpsCoords && typeof quest.gpsCoords.lat === 'number' && typeof quest.gpsCoords.lng === 'number') {
    return { lat: quest.gpsCoords.lat, lng: quest.gpsCoords.lng };
  }
  if (quest.locationCoords && typeof quest.locationCoords.lat === 'number' && typeof quest.locationCoords.lng === 'number') {
    return { lat: quest.locationCoords.lat, lng: quest.locationCoords.lng };
  }
  if (typeof quest.lat === 'number' && typeof quest.lng === 'number' && quest.lat !== 0 && quest.lng !== 0) {
    return { lat: quest.lat, lng: quest.lng };
  }
  return null;
}

/**
 * Checks if a new quest is nearby and matches the user's category interests.
 */
export function checkNearbyQuestMatch(
  quest: Quest,
  userProfile: UserProfile,
  userLoc: { lat: number; lng: number } | null
): { isMatch: boolean; distanceKm?: number; reason?: string } {
  // If user disabled notifications or nearby alerts specifically
  if (userProfile.enableNotifications === false || userProfile.notifyOnNearbyQuests === false) {
    return { isMatch: false };
  }

  // Never notify user of their own created quest
  if (quest.creatorId === userProfile.id) {
    return { isMatch: false };
  }

  // Filter 1: Category interest check
  // If user selected specific interests, check that the quest matches one of them
  const userInterests = userProfile.interests;
  if (userInterests && userInterests.length > 0) {
    const hasCategoryMatch = userInterests.includes(quest.category);
    if (!hasCategoryMatch) {
      return { isMatch: false, reason: 'category_mismatch' };
    }
  }

  // Filter 2: Proximity / Distance radius check
  const maxRadiusKm = userProfile.notificationRadiusKm !== undefined ? userProfile.notificationRadiusKm : 25;
  // If maxRadiusKm is 0 or >= 100, consider distance filter unbounded
  if (maxRadiusKm <= 0 || maxRadiusKm >= 100) {
    return { isMatch: true, distanceKm: undefined };
  }

  const questCoords = getQuestCoordinates(quest);
  if (userLoc && questCoords) {
    const dist = calculateDistanceKm(userLoc.lat, userLoc.lng, questCoords.lat, questCoords.lng);
    if (dist <= maxRadiusKm) {
      return { isMatch: true, distanceKm: dist };
    } else {
      return { isMatch: false, distanceKm: dist, reason: 'outside_radius' };
    }
  }

  // Fallback: If no coordinates but user has city registered and quest location mentions that city
  if (userProfile.city && quest.location) {
    const normCity = userProfile.city.toLowerCase().trim();
    const normLoc = quest.location.toLowerCase().trim();
    if (normLoc.includes(normCity) || normCity.includes(normLoc)) {
      return { isMatch: true, distanceKm: undefined };
    }
  }

  // If user coordinates aren't available, match by interest
  return { isMatch: true, distanceKm: undefined };
}

export interface DeadlineReminderInfo {
  questId: string;
  stage: '2h' | '30m' | '1h_open' | '24h_job';
  dedupKey: string;
  title: string;
  body: string;
  minutesLeft: number;
}

/**
 * Inspects a quest to see if an upcoming deadline reminder is due for the given user.
 */
export function checkQuestDeadlineStatus(
  quest: Quest,
  userProfile: UserProfile
): DeadlineReminderInfo | null {
  if (userProfile.enableNotifications === false || userProfile.notifyOnDeadlines === false) {
    return null;
  }

  const now = Date.now();
  const lang = userProfile.language || 'ar';
  const isCreator = quest.creatorId === userProfile.id;
  const isAssignedWorker =
    quest.helperId === userProfile.id ||
    quest.assignedRunnerId === userProfile.id ||
    quest.employeeId === userProfile.id ||
    (quest.assignedRunnerIds && quest.assignedRunnerIds.includes(userProfile.id));

  // Only check quests where user is involved
  if (!isCreator && !isAssignedWorker) {
    return null;
  }

  // Case 1: Active/booked quick task (24 hour execution limit)
  if (quest.status === 'active' || quest.status === 'booked' || quest.status === 'arrived' || quest.status === 'pending_verification') {
    if (quest.questType !== 'long_term') {
      const assignTime = quest.assignedAt ? new Date(quest.assignedAt).getTime() : new Date(quest.createdAt).getTime();
      const deadlineMs = assignTime + 24 * 60 * 60 * 1000;
      const timeLeftMs = deadlineMs - now;
      const minutesLeft = Math.round(timeLeftMs / 60000);

      // 30-minute urgent reminder (between 0 and 35 mins)
      if (timeLeftMs > 0 && timeLeftMs <= 35 * 60 * 1000) {
        const title = lang === 'ar' ? '⚠️ تنبيه عاجل: اقتراب الموعد النهائي!' : '⚠️ Urgent: Deadline Approaching!';
        const body = lang === 'ar'
          ? `يتبقى قرابة ${minutesLeft} دقيقة فقط على مهلة إنجاز مهمة "${quest.title}". يُرجى سرعة الإتمام!`
          : `About ${minutesLeft} mins remaining to finish quest "${quest.title}". Please finalize promptly!`;
        return {
          questId: quest.id,
          stage: '30m',
          dedupKey: `${quest.id}_30m_${userProfile.id}`,
          title,
          body,
          minutesLeft
        };
      }

      // 2-hour reminder (between 1h50m and 2h10m)
      if (timeLeftMs > 35 * 60 * 1000 && timeLeftMs <= 130 * 60 * 1000) {
        const title = lang === 'ar' ? '⏳ تذكير بالموعد النهائي للمهمة' : '⏳ Quest Deadline Reminder';
        const hoursLeft = Math.round(minutesLeft / 60);
        const body = lang === 'ar'
          ? `يتبقى ساعتان تقريباً على مهلة إنجاز مهمة "${quest.title}". تأكد من تسليم الإثبات في الوقت المحدد.`
          : `Around 2 hours remaining on quest "${quest.title}". Ensure proof of completion is submitted on time.`;
        return {
          questId: quest.id,
          stage: '2h',
          dedupKey: `${quest.id}_2h_${userProfile.id}`,
          title,
          body,
          minutesLeft
        };
      }
    }
  }

  // Case 2: Open publication 8-hour timeout (for creator)
  if ((quest.status === 'open' || (quest.status as any) === 'pending') && isCreator) {
    const createdAtMs = quest.createdAt ? new Date(quest.createdAt).getTime() : 0;
    if (createdAtMs > 0) {
      const deadlineMs = createdAtMs + 8 * 60 * 60 * 1000;
      const timeLeftMs = deadlineMs - now;
      const minutesLeft = Math.round(timeLeftMs / 60000);

      // 1 hour left on open publication
      if (timeLeftMs > 0 && timeLeftMs <= 65 * 60 * 1000) {
        const title = lang === 'ar' ? '⏰ اقتراب انتهاء نشر المهمة' : '⏰ Quest Publication Expiring Soon';
        const body = lang === 'ar'
          ? `يتبقى ساعة واحدة على انتهاء فترة عرض مهمتك "${quest.title}". يمكنك قبول أحد المتقدمين أو تمديدها.`
          : `1 hour remaining on your published quest "${quest.title}". Accept an applicant or renew.`;
        return {
          questId: quest.id,
          stage: '1h_open',
          dedupKey: `${quest.id}_1h_open_${userProfile.id}`,
          title,
          body,
          minutesLeft
        };
      }
    }
  }

  // Case 3: Fixed duration long term job ending
  if (quest.questType === 'long_term' && quest.durationType === 'fixed' && quest.endDate) {
    const endMs = new Date(quest.endDate).getTime();
    if (!isNaN(endMs)) {
      const timeLeftMs = endMs - now;
      const hoursLeft = Math.round(timeLeftMs / (60 * 60 * 1000));
      if (timeLeftMs > 0 && timeLeftMs <= 25 * 60 * 60 * 1000) {
        const title = lang === 'ar' ? '📅 اقتراب انتهاء عقد العمل' : '📅 Employment Contract Ending';
        const body = lang === 'ar'
          ? `ينتهي عقد العمل المحدد لمهمة "${quest.title}" خلال 24 ساعة (${hoursLeft} س متبقية).`
          : `The fixed-term contract for "${quest.title}" ends in 24 hours (${hoursLeft}h left).`;
        return {
          questId: quest.id,
          stage: '24h_job',
          dedupKey: `${quest.id}_24h_job_${userProfile.id}`,
          title,
          body,
          minutesLeft: Math.round(timeLeftMs / 60000)
        };
      }
    }
  }

  return null;
}

/**
 * Formats a localized message for a nearby quest alert.
 */
export function formatNearbyAlertText(quest: Quest, distanceKm: number | undefined, lang: 'ar' | 'fr' | 'en' = 'ar'): { title: string; body: string } {
  const distText = distanceKm !== undefined
    ? (lang === 'ar' ? `على بعد ${distanceKm} كم` : lang === 'fr' ? `à ${distanceKm} km` : `${distanceKm} km away`)
    : (quest.location || (lang === 'ar' ? 'بالقرب منك' : 'near you'));

  const rewardText = quest.cashReward ? `${quest.cashReward.toLocaleString()} د.ج` : `${quest.pointsReward || 0} نقطة`;

  const title = lang === 'ar' 
    ? `📍 مهمة ${quest.category} جديدة بالقرب منك!`
    : lang === 'fr'
    ? `📍 Nouvelle quête ${quest.category} à proximité !`
    : `📍 New ${quest.category} quest nearby!`;

  const body = lang === 'ar'
    ? `"${quest.title}" (${distText}) — المكافأة: ${rewardText}`
    : lang === 'fr'
    ? `"${quest.title}" (${distText}) — Récompense: ${rewardText}`
    : `"${quest.title}" (${distText}) — Reward: ${rewardText}`;

  return { title, body };
}

/**
 * Formats a status transition notification text.
 */
export function formatStatusTransitionText(
  quest: Quest,
  newStatus: string,
  lang: 'ar' | 'fr' | 'en' = 'ar',
  recipientRole: 'creator' | 'worker'
): { title: string; body: string } {
  if (recipientRole === 'worker') {
    switch (newStatus) {
      case 'active':
      case 'booked':
      case 'hired':
      case 'active_employment':
        return {
          title: lang === 'ar' ? '🎉 تم قبولك لتنفيذ المهمة!' : '🎉 You have been accepted!',
          body: lang === 'ar'
            ? `وافق صاحب المهمة على طلبك لمهمة "${quest.title}". ابدأ التنفيذ الآن!`
            : `The employer approved your application for "${quest.title}". Begin execution now!`
        };
      case 'completed':
        return {
          title: lang === 'ar' ? '💰 تم إتمام المهمة والإفراج عن المكافأة!' : '💰 Quest Completed & Reward Released!',
          body: lang === 'ar'
            ? `تم تأكيد إنجاز "${quest.title}" بنجاح وصرف المكافأة ${quest.cashReward || 0} د.ج إلى حسابك.`
            : `"${quest.title}" verified successfully! ${quest.cashReward || 0} DA released to your wallet.`
        };
      case 'cancelled':
      case 'cancelled_by_timeout':
        return {
          title: lang === 'ar' ? '❌ تم إلغاء المهمة' : '❌ Quest Cancelled',
          body: lang === 'ar'
            ? `تم إلغاء مهمة "${quest.title}". تم تحرير حسابك وتحديث حالتك.`
            : `Quest "${quest.title}" has been cancelled.`
        };
      case 'disputed':
        return {
          title: lang === 'ar' ? '⚖️ تم تسجيل نزاع على المهمة' : '⚖️ Dispute Filed on Quest',
          body: lang === 'ar'
            ? `تم فتح نزاع رسمي لمهمة "${quest.title}". فريق الدعم يراجع تفاصيل العمل.`
            : `A dispute has been opened for "${quest.title}". Support team is reviewing.`
        };
      default:
        return {
          title: lang === 'ar' ? '📋 تحديث في حالة المهمة' : '📋 Quest Status Updated',
          body: lang === 'ar'
            ? `تم تحديث حالة مهمة "${quest.title}" إلى: ${newStatus}`
            : `Status for quest "${quest.title}" changed to: ${newStatus}`
        };
    }
  } else {
    // Recipient is Creator
    switch (newStatus) {
      case 'arrived':
        return {
          title: lang === 'ar' ? '📍 وصل العامل إلى الموقع!' : '📍 Worker Arrived at Location!',
          body: lang === 'ar'
            ? `أكد المنفذ ${quest.helperName || 'العامل'} وصوله الميداني لموقع مهمة "${quest.title}".`
            : `Worker ${quest.helperName || ''} confirmed arrival at "${quest.title}" location.`
        };
      case 'pending_verification':
        return {
          title: lang === 'ar' ? '📸 تم رفع إثبات إنجاز المهمة!' : '📸 Proof of Completion Uploaded!',
          body: lang === 'ar'
            ? `قام المنفذ برفع صورة إثبات العمل لمهمة "${quest.title}". يُرجى المراجعة والتأكيد.`
            : `Proof of work uploaded for "${quest.title}". Please review and confirm completion.`
        };
      case 'completed':
        return {
          title: lang === 'ar' ? '✅ تم إغلاق المهمة بنجاح' : '✅ Quest Closed Successfully',
          body: lang === 'ar'
            ? `تم إتمام مهمتك "${quest.title}" وصرف مستحقات المنفذ.`
            : `Quest "${quest.title}" marked completed and payment settled.`
        };
      case 'disputed':
        return {
          title: lang === 'ar' ? '⚖️ تم رفع نزاع على المهمة' : '⚖️ Dispute Raised',
          body: lang === 'ar'
            ? `تم تسجيل نزاع لمهمة "${quest.title}".`
            : `A dispute was raised for "${quest.title}".`
        };
      default:
        return {
          title: lang === 'ar' ? '📋 تحديث في حالة المهمة' : '📋 Quest Status Updated',
          body: lang === 'ar'
            ? `تم تحديث حالة مهمتك "${quest.title}" إلى: ${newStatus}`
            : `Status of "${quest.title}" is now ${newStatus}`
        };
    }
  }
}
