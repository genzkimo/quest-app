export type ViewState = 'home' | 'map' | 'my-quests' | 'leaderboard' | 'profile' | 'admin' | 'messages';

export type QuestCategory = 'صيانة' | 'توصيل' | 'تعليم' | 'تسوق' | 'تقنية' | 'مساعدة منزلية' | 'رعاية أليفة' | 'أخرى';

export interface Applicant {
  userId: string;
  name: string;
  avatar: string;
  rating?: number;
  questsCompleted?: number;
  phone?: string;
}

export interface QuestComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  location: string;
  lat: number; 
  lng: number; 
  category: QuestCategory;
  cashReward: number; // Cash payment in DZD (DA)
  pointsReward: number; // Experience points reward
  bookingFeeDA: number; // Platform booking fee: 5% of cashReward (minimum 35 DA, maximum 2000 DA)
  requiredDA?: number; // Raw required token amount
  status: 'open' | 'booked' | 'active' | 'arrived' | 'pending_verification' | 'completed' | 'disputed' | 'cancelled_by_timeout' | 'cancelled' | 'stale_cleared';
  urgency: 'normal' | 'urgent' | 'featured';
  createdAt: string;
  assignedAt?: string;
  extensionRequestedBy?: string | null;
  extensionApprovedBy?: string | null;
  creatorId: string;
  creatorName: string;
  creatorPhone: string;
  creatorAvatar: string;
  helperId?: string;
  helperName?: string;
  helperPhone?: string;
  flagsCount: number; // For "Scam Shield"
  flaggers: string[]; // List of user IDs who flagged this
  proofImageUrl?: string; // Loaded upon submission of proof
  imageUrls?: string[]; // Multiple high-res task photos for swipable carousel
  images?: string[]; // Multiple compressed or uploaded preview images or Base64 data strings
  imageUrl?: string; // Securely saved uploaded image download URL
  locationCoords?: { lat: number; lng: number }; // GPS coordinates nested structure
  gpsCoords?: { lat: number; lng: number }; // Hardware GPS coordinates captured at creation
  applicants?: Applicant[];
  assignedRunnerId?: string;
  assignedRunnerIds?: string[]; // Multi-slot runner IDs
  requiredWorkerCount?: number; // Total number of workers required for this quest
  comments?: QuestComment[];
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  city: string;
  avatar: string;
  questsCompleted: number;
  questsCreated: number;
  totalPoints: number; // Experience Points (XP)
  tokenBalance: number; // Local gold tokens balance (starts with 3000 bonus)
  rating: number;
  level: number;
  idVerificationStatus: 'unverified' | 'pending' | 'verified'; // KYC Status
  kycRewardClaimed?: boolean; // Flag to check if KYC reward was already claimed
  idDocumentUrl?: string; // Simulated link to uploaded identity document
  idCardUrl?: string; // secure ID Card display URL thumbnail
  idFrontUrl?: string; // Front side of National ID (Base64/URL)
  idBackUrl?: string; // Back side of National ID (Base64/URL)
  completedQuestsIds: string[];
  createdQuestsIds: string[];
  unlockedBadgeIds: string[];
  language: 'ar' | 'fr' | 'en'; // Active selected locale
  enableNotifications: boolean;
  privacyEnabled: boolean;
  audioEffectsEnabled?: boolean;
  hapticFeedbackEnabled?: boolean;
  lowPerformanceModeEnabled?: boolean;
  isBanned?: boolean; // Fraud control
  bio?: string; // Short bio text sentence
  isAdmin?: boolean; // Toggle dashboard access
  role?: 'admin' | 'user'; // Auth-centralized Access control
  email?: string; // Connected Google Account Verification address
  shortId?: string; // Short alphanumeric ID code
  isAvailable?: boolean; // Multi-booking control constraint
  hasActiveQuest?: boolean; // Custom constraint for active publishing lock
  lastCheckInDate?: string; // "YYYY-MM-DD" format of last check-in
  checkInStreak?: number; // 0 to 7 streak multiplier
  verifiedName?: string; // Extracted verified name from ID Card
  verifiedNid?: string; // Extracted verified national identification number (NIN)
  referredBy?: string; // The shortId of the user who invited them
  referredUsersCount?: number; // Total number of people invited with this user's code
  referralRewardClaimed?: boolean; // Whether the user claimed their +100 tokens as an invitee
  preBanTokenBalance?: number; // Banned user's tokens preserved before ban
  createdAt?: string; // Account registration / joined date
  termsAccepted?: boolean; // Whether terms of service and privacy consent was accepted
  hasCompletedOnboarding?: boolean; // First time onboarding completed
  lastActiveAt?: string; // ISO string of user's last activity timestamp
}

export class UserModel {
  static toFirestore(profile: UserProfile): Record<string, any> {
    return {
      id: profile.id,
      name: profile.name || '',
      phone: profile.phone || '',
      city: profile.city || '',
      avatar: profile.avatar || '',
      questsCompleted: Number(profile.questsCompleted) || 0,
      questsCreated: Number(profile.questsCreated) || 0,
      totalPoints: Number(profile.totalPoints) || 0,
      tokenBalance: Number(profile.tokenBalance) || 0,
      rating: Number(profile.rating) || 5.0,
      level: Number(profile.level) || 1,
      idVerificationStatus: profile.idVerificationStatus || 'unverified',
      kycRewardClaimed: !!profile.kycRewardClaimed,
      idDocumentUrl: profile.idDocumentUrl || '',
      idCardUrl: profile.idCardUrl || '',
      completedQuestsIds: profile.completedQuestsIds || [],
      createdQuestsIds: profile.createdQuestsIds || [],
      unlockedBadgeIds: profile.unlockedBadgeIds || [],
      language: profile.language || 'ar',
      enableNotifications: profile.enableNotifications !== false,
      privacyEnabled: !!profile.privacyEnabled,
      audioEffectsEnabled: profile.audioEffectsEnabled !== false,
      hapticFeedbackEnabled: profile.hapticFeedbackEnabled !== false,
      lowPerformanceModeEnabled: !!profile.lowPerformanceModeEnabled,
      isBanned: !!profile.isBanned,
      bio: profile.bio || '',
      isAdmin: !!profile.isAdmin,
      role: profile.role || 'user',
      email: profile.email || '',
      shortId: profile.shortId || '',
      isAvailable: profile.isAvailable !== false,
      hasActiveQuest: !!profile.hasActiveQuest,
      lastCheckInDate: profile.lastCheckInDate || '',
      checkInStreak: Number(profile.checkInStreak) || 0,
      verifiedName: profile.verifiedName || '',
      verifiedNid: profile.verifiedNid || '',
      referredBy: profile.referredBy || '',
      referredUsersCount: Number(profile.referredUsersCount) || 0,
      referralRewardClaimed: !!profile.referralRewardClaimed,
      preBanTokenBalance: profile.preBanTokenBalance !== undefined ? Number(profile.preBanTokenBalance) : 0,
      createdAt: profile.createdAt || new Date().toISOString(),
      termsAccepted: profile.termsAccepted !== undefined ? !!profile.termsAccepted : true,
      hasCompletedOnboarding: !!profile.hasCompletedOnboarding,
      lastActiveAt: profile.lastActiveAt || new Date().toISOString(),
    };
  }

  static fromFirestore(data: any, id: string): UserProfile {
    return {
      id: id,
      name: data.name || '',
      phone: data.phone || '',
      city: data.city || '',
      avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      questsCompleted: Number(data.questsCompleted) || 0,
      questsCreated: Number(data.questsCreated) || 0,
      totalPoints: Number(data.totalPoints) || 0,
      tokenBalance: Number(data.tokenBalance) || 0,
      rating: Number(data.rating) || 5.0,
      level: Number(data.level) || 1,
      idVerificationStatus: data.idVerificationStatus || 'unverified',
      kycRewardClaimed: !!data.kycRewardClaimed,
      idDocumentUrl: data.idDocumentUrl || '',
      idCardUrl: data.idCardUrl || '',
      completedQuestsIds: data.completedQuestsIds || [],
      createdQuestsIds: data.createdQuestsIds || [],
      unlockedBadgeIds: data.unlockedBadgeIds || [],
      language: data.language || 'ar',
      enableNotifications: data.enableNotifications !== false,
      privacyEnabled: !!data.privacyEnabled,
      audioEffectsEnabled: data.audioEffectsEnabled !== false,
      hapticFeedbackEnabled: data.hapticFeedbackEnabled !== false,
      lowPerformanceModeEnabled: !!data.lowPerformanceModeEnabled,
      isBanned: !!data.isBanned,
      bio: data.bio || '',
      isAdmin: !!data.isAdmin,
      role: data.role || 'user',
      email: data.email || '',
      shortId: data.shortId || '',
      isAvailable: data.isAvailable !== false,
      hasActiveQuest: !!data.hasActiveQuest,
      lastCheckInDate: data.lastCheckInDate || '',
      checkInStreak: Number(data.checkInStreak) || 0,
      verifiedName: data.verifiedName || '',
      verifiedNid: data.verifiedNid || '',
      referredBy: data.referredBy || '',
      referredUsersCount: Number(data.referredUsersCount) || 0,
      referralRewardClaimed: !!data.referralRewardClaimed,
      preBanTokenBalance: data.preBanTokenBalance !== undefined ? Number(data.preBanTokenBalance) : 0,
      createdAt: data.createdAt || data.joinedAt || new Date().toISOString(),
      termsAccepted: data.termsAccepted !== undefined ? !!data.termsAccepted : true,
      hasCompletedOnboarding: !!data.hasCompletedOnboarding,
      lastActiveAt: data.lastActiveAt || data.updatedAt || '',
    };
  }
}

export interface Leader {
  id: string;
  name: string;
  avatar: string;
  points: number;
  questsCompleted: number;
  rating: number;
  rank: number;
  tier: 'Bronze' | 'Silver' | 'Gold';
  isCurrentUser?: boolean;
  idVerificationStatus?: 'unverified' | 'pending' | 'verified';
  isBanned?: boolean;
  verifiedName?: string;
  verifiedNid?: string;
}

export interface Challenge {
  id: string;
  title: Record<string, string>; // Multi-lingual translations
  description: Record<string, string>;
  pointsReward: number;
  targetCount: number;
  currentCount: number;
  timeLeft: Record<string, string>;
  type: 'complete' | 'create' | 'points' | 'repair';
}

export interface Badge {
  id: string;
  title?: Record<string, string> | string;
  name?: string;
  description: Record<string, string> | string;
  iconName: string; 
  pointsCost?: number;
  unlocked: boolean;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Ruby' | 'BRONZE' | 'SILVER' | 'GOLD' | 'RUBY';
  requirement?: string;
}

export interface WalletTransaction {
  id: string;
  type: 'onboarding_bonus' | 'booking_fee' | 'top_up' | 'refund' | 'commission_income';
  amount: number; // positive or negative
  timestamp: string;
  questTitle?: string;
  referenceId?: string;
}

export interface HunterReview {
  reviewId: string;
  hunterId: string; // Worker UID
  godfatherId: string; // Poster UID
  godfatherName: string;
  godfatherAvatar?: string;
  completedTaskImage: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // formatted date
}

export interface GodfatherReview {
  reviewId: string;
  godfatherId: string; // Poster UID (Arab employer)
  hunterId: string; // Worker UID (Runner helper)
  hunterName: string;
  hunterAvatar?: string;
  completedTaskImage: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // formatted date
}

export interface QuestStory {
  id: string;
  userId: string;
  user: string;
  userAvatar: string;
  image: string;
  proofImage?: string;
  caption: string;
  title?: string;
  description?: string;
  textColor: string;
  textBg: string;
  textPosition: 'top' | 'middle' | 'bottom';
  bgGradient?: string;
  fontSize?: 'sm' | 'md' | 'lg' | 'xl';
  sticker?: string;
  createdAt: string;
  views?: number;
}

