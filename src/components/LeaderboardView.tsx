import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Award, 
  Flame, 
  TrendingUp, 
  UserCheck, 
  Compass, 
  ShieldAlert, 
  Cpu, 
  Zap, 
  CheckCircle,
  ShoppingBag,
  Sparkles,
  Search,
  CheckCircle2,
  Bookmark,
  Lock,
  X,
  PartyPopper,
  Check
} from 'lucide-react';
import { Leader, Challenge, Badge, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../data/translations';
import { playCoinSound, playLockAndLoadCoins, triggerHaptic } from '../utils/audio';

interface LeaderboardViewProps {
  leaders: Leader[];
  challenges: Challenge[];
  badges: Badge[];
  userProfile: UserProfile;
  lang: 'ar' | 'fr' | 'en';
  onUnlockBadge: (badgeId: string, cost: number) => void;
  onClaimChallengePoints: (challengeId: string, reward: number) => void;
  onSimulateActivity: () => void;
  onUpdateProfile?: (newProfile: UserProfile) => void;
}

const BADGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UserCheck: UserCheck,
  Compass: Compass,
  ShieldAlert: ShieldAlert,
  Cpu: Cpu,
  Zap: Zap,
  Trophy: Trophy,
  Award: Award,
  Flame: Flame,
  TrendingUp: TrendingUp,
  Sparkles: Sparkles,
  Search: Search,
  CheckCircle: CheckCircle,
  Bookmark: Bookmark,
};

const isBadgeUnlocked = (badgeId: string, profile: UserProfile): boolean => {
  if (profile.unlockedBadgeIds?.includes(badgeId) || badgeId === 'b1') return true;

  if (badgeId === 'b2') return profile.questsCompleted >= 1;
  if (badgeId === 'b3') return profile.questsCompleted >= 5;
  if (badgeId === 'b4') return profile.questsCompleted >= 3;
  if (badgeId === 'b5') return profile.questsCompleted >= 1;
  if (badgeId === 'b6') return true;
  if (badgeId === 'b7') return !!profile.name && !!profile.avatar && !!profile.phone;
  if (badgeId === 'b8') return profile.questsCreated >= 1;
  if (badgeId === 'b9') return true;
  if (badgeId === 'b10') return (profile.checkInStreak || 0) >= 3;

  if (badgeId.startsWith('b')) {
    const num = parseInt(badgeId.substring(1));
    if (num >= 11 && num <= 20) {
      const requiredQuests = num - 11 + 6;
      return profile.questsCompleted >= requiredQuests;
    }
  }

  if (badgeId.startsWith('s')) {
    const num = parseInt(badgeId.substring(1));
    if (num >= 21 && num <= 35) {
      const idx = num - 21;
      const requiredXP = 200 + (idx * 100);
      return profile.totalPoints >= requiredXP && profile.rating >= 4.5;
    }
  }

  if (badgeId.startsWith('g')) {
    const num = parseInt(badgeId.substring(1));
    if (num >= 36 && num <= 45) {
      const idx = num - 36;
      const requiredQuests = 20 + (idx * 5);
      return profile.questsCompleted >= requiredQuests;
    }
  }

  if (badgeId === 'r46') return profile.questsCompleted >= 500;
  if (badgeId === 'r47') return profile.questsCompleted >= 100 && profile.rating >= 5.0;
  if (badgeId === 'r48') return profile.totalPoints >= 3000;
  if (badgeId === 'r49') return profile.questsCompleted >= 50;
  if (badgeId === 'r50') return profile.level >= 50 || profile.totalPoints >= 10000;

  return false;
};

export default function LeaderboardView({ 
  leaders, 
  challenges, 
  badges, 
  userProfile,
  lang,
  onUnlockBadge,
  onClaimChallengePoints,
  onSimulateActivity,
  onUpdateProfile
}: LeaderboardViewProps) {
  const [activeTab, setActiveTab ] = useState<'leaders' | 'challenges' | 'badges'>('leaders');
  const [currentCadenceFilter, setCurrentCadenceFilter] = useState<'all' | 'daily' | 'weekly'>('all');
  const [claimedBonusList, setClaimedBonusList] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const dict = translations[lang];
  const isRtl = lang === 'ar';

  // --- Dynamic 7-Day Daily Check-in System (Token Economy matrix) ---
  const DAILY_REWARDS = [1, 2, 3, 5, 7, 10, 50];

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysDifference = (dateStr1: string, dateStr2: string) => {
    if (!dateStr1 || !dateStr2) return 999;
    const d1 = new Date(dateStr1 + 'T00:00:00');
    const d2 = new Date(dateStr2 + 'T00:00:00');
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const [secondsUntilMidnight, setSecondsUntilMidnight] = useState(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      setSecondsUntilMidnight(Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const lastCheckIn = userProfile.lastCheckInDate || '';
  const currentStreak = userProfile.checkInStreak || 0;
  const todayStr = getLocalDateString();
  const daysDiff = getDaysDifference(lastCheckIn, todayStr);

  const alreadyCheckedInToday = !!(lastCheckIn && daysDiff === 0);
  const isConsecutive = !!(lastCheckIn && daysDiff === 1);
  const isStreakBroken = !!(lastCheckIn && daysDiff > 1);

  // Determine active check-in highlight index in the matrix (1-based: 1..7)
  let activeClaimDay = 1;
  if (lastCheckIn) {
    if (alreadyCheckedInToday) {
      activeClaimDay = currentStreak === 7 ? 1 : currentStreak;
    } else if (isConsecutive) {
      activeClaimDay = currentStreak === 7 ? 1 : currentStreak + 1;
    } else {
      activeClaimDay = 1; // broken streak
    }
  } else {
    activeClaimDay = 1;
  }

  const claimDailyReward = () => {
    const today = getLocalDateString();
    const lastCheck = userProfile.lastCheckInDate || '';
    const streak = userProfile.checkInStreak || 0;
    const diff = getDaysDifference(lastCheck, today);

    let newStreak = 1;
    let reward = 1;

    if (!lastCheck) {
      newStreak = 1;
      reward = DAILY_REWARDS[0];
    } else if (diff === 0) {
      setToastMessage(lang === 'ar' ? 'لقد سجلت حضورك اليوم بالفعل! عد غداً.' : 'Already checked-in today! Come back tomorrow.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    } else if (diff === 1) {
      if (streak >= 7) {
        newStreak = 1;
        reward = DAILY_REWARDS[0];
      } else {
        newStreak = streak + 1;
        reward = DAILY_REWARDS[newStreak - 1];
      }
    } else {
      newStreak = 1;
      reward = DAILY_REWARDS[0];
    }

    const newBalance = userProfile.tokenBalance + reward;

    if (onUpdateProfile) {
      onUpdateProfile({
        ...userProfile,
        tokenBalance: newBalance,
        lastCheckInDate: today,
        checkInStreak: newStreak,
      });

      const audioEnabled = userProfile.audioEffectsEnabled !== false;
      const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
      playCoinSound(audioEnabled);
      if (newStreak === 7) {
        setTimeout(() => playLockAndLoadCoins(audioEnabled), 150);
      }
      triggerHaptic('sharp', hapticEnabled);

      if (newStreak === 7) {
        setToastMessage(lang === 'ar'
          ? `🎉 رائع وممتاز! لقد حصلت على الجائزة الكبرى لليوم السابع: +50 ذخيرة ذهبية!`
          : `🎉 Grand achievement! Credited Day 7 Jackpot: +50 Gold Ammo!`
        );
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage(lang === 'ar'
          ? `🔥 تم تسجيل حضورك لليوم ${newStreak}! وحصلت على +${reward} ذخيرة ذهبية.`
          : `🔥 Success! Day ${newStreak} check-in recorded: +${reward} Gold Ammo added.`
        );
        setTimeout(() => setToastMessage(null), 3500);
      }
    }
  };

  const sortedLeaders = [...leaders].sort((a, b) => b.points - a.points).map((l, idx) => ({
    ...l,
    rank: idx + 1
  }));

  // Podium Star ranks
  const podium1 = sortedLeaders.find(l => l.rank === 1);
  const podium2 = sortedLeaders.find(l => l.rank === 2);
  const podium3 = sortedLeaders.find(l => l.rank === 3);
  const restLeaders = sortedLeaders.filter(l => l.rank > 3);

  const handleClaimPoints = (ch: Challenge) => {
    if (ch.currentCount >= ch.targetCount && !claimedBonusList.includes(ch.id)) {
      onClaimChallengePoints(ch.id, ch.pointsReward);
      setClaimedBonusList(prev => [...prev, ch.id]);
      setToastMessage(lang === 'ar' ? `🎉 مبروك! مـكافأة +${ch.pointsReward} نـقطة شـرفية!` : `🎉 Success! Claimed +${ch.pointsReward} honor points!`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleUnlockBadgeInView = (badge: Badge) => {
    const cost = badge.pointsCost || 0;
    if (userProfile.totalPoints < cost) {
      setToastMessage(lang === 'ar' ? `⚠️ رصيد نقاط غير كافٍ لفتح [${badge.title}]` : `⚠️ Insufficient points to unlock [${badge.title}]`);
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    
    onUnlockBadge(badge.id, cost);
    setToastMessage(lang === 'ar' ? `🛡️ تم فتح شارة [${badge.title}] بنجاح!` : `🛡️ Badge [${badge.title}] is now unlocked in your gallery!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-[#1F2A44]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {/* Dynamic Activity Simulation Overlay */}
      {toastMessage && (
        <div className="fixed bottom-24 left-4 right-4 z-50 bg-slate-900 text-white border border-[#FFD34D] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slideUp">
          <div className="w-10 h-10 bg-[#FFD34D] rounded-full flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-[#1F2A44] fill-[#1F2A44]" />
          </div>
          <p className="text-xs font-black leading-snug">{toastMessage}</p>
        </div>
      )}

      {/* Hero Badge Level Status Banner */}
      <div className="bg-white border border-gray-150 rounded-3xl p-5 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#FFD34D]/10 rounded-2xl flex items-center justify-center text-[#FFD34D]">
            <Flame className="w-7 h-7 fill-current text-[#FFD34D]" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">{dict.profileLvl}</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-black">Level {userProfile.level}</span>
              <span className="bg-[#4FC3F7]/10 text-[#4FC3F7] text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-0.5 uppercase">
                <TrendingUp className="w-3 h-3" />
                Rank: #{sortedLeaders.find(l => l.isCurrentUser)?.rank || 4}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-[10px] text-gray-400 font-extrabold block uppercase tracking-wide">Honor Balance</span>
          <span className="text-lg font-black text-[#1F2A44] font-mono block">
            ⚡ {userProfile.totalPoints} <span className="text-xs text-slate-400">Pts</span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
        <button
          onClick={() => setActiveTab('leaders')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'leaders' ? 'bg-[#1F2A44] text-[#FFD34D] shadow' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {dict.leaderboard}
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'challenges' ? 'bg-[#1F2A44] text-[#FFD34D] shadow' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {dict.challenges}
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'badges' ? 'bg-[#1F2A44] text-[#FFD34D] shadow' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {lang === 'ar' ? 'متجر الشارات' : 'Badges'}
        </button>
      </div>

      {/* Tab Content: Leaderboard */}
      {activeTab === 'leaders' && (
        <div className="space-y-6">
          
          {/* 
            Top 3 Podium Component
            Rank 1 features avatar in Bright Gold (#FFD34D) container, 
            Rank 2 in Silver accents, Rank 3 in Bronze accents.
          */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 flex justify-center items-end gap-3 md:gap-6 shadow-sm">
            
            {/* Rank 2 (Silver) */}
            {podium2 && (
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-800 text-[9px] font-black px-2 py-0.5 rounded-lg border border-white uppercase tracking-wider">
                    #2 Runner
                  </div>
                  <img 
                    src={podium2.avatar} 
                    alt={podium2.name}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-slate-300 object-cover shadow-md"
                  />
                </div>
                <div className="text-center mt-2.5 w-full">
                  <h4 className="text-xs font-black truncate">{podium2.name}</h4>
                  <p className="text-[10px] text-[#FF3B7C] font-extrabold font-mono mt-0.5">{podium2.points} XP</p>
                </div>
                <div className="w-full bg-slate-50/70 rounded-t-2xl h-16 mt-3.5 flex items-center justify-center border border-b-0 border-gray-100">
                  <Award className="text-slate-400 w-5 h-5" />
                </div>
              </div>
            )}

            {/* Rank 1 (Gold Winner) */}
            {podium1 && (
              <div className="flex flex-col items-center flex-1 scale-110 -translate-y-2">
                <div className="relative">
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FFD34D] text-[#1F2A44] text-[8px] font-black px-2 py-0.5 rounded-lg border border-white uppercase tracking-widest">
                    Champion
                  </div>
                  <img 
                    src={podium1.avatar} 
                    alt={podium1.name}
                    className="w-17 h-17 rounded-full border-4 border-[#FFD34D] object-cover shadow-lg"
                  />
                </div>
                <div className="text-center mt-2 w-full">
                  <h4 className="text-xs font-black truncate text-[#1F2A44]">{podium1.name}</h4>
                  <p className="text-[10px] text-[#FF3B7C] font-black font-mono mt-0.5">{podium1.points} XP</p>
                </div>
                {/* Gold Podium Pedestal */}
                <div className="w-full bg-[#FFD34D]/25 rounded-t-2xl h-24 mt-3 flex items-center justify-center border border-b-0 border-[#FFD34D]/30 relative overflow-hidden">
                  <Trophy className="text-[#FFD34D] w-7 h-7 fill-current animate-pulse" />
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {podium3 && (
              <div className="flex flex-col items-center flex-1">
                <div className="relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded-lg border border-white uppercase tracking-wider">
                    #3 Runner
                  </div>
                  <img 
                    src={podium3.avatar} 
                    alt={podium3.name}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-amber-600 object-cover shadow-md"
                  />
                </div>
                <div className="text-center mt-2.5 w-full">
                  <h4 className="text-xs font-black truncate">{podium3.name}</h4>
                  <p className="text-[10px] text-[#FF3B7C] font-extrabold font-mono mt-0.5">{podium3.points} XP</p>
                </div>
                <div className="w-full bg-orange-50/50 rounded-t-2xl h-12 mt-3.5 flex items-center justify-center border border-b-0 border-gray-100">
                  <Award className="text-amber-700/60 w-5 h-5" />
                </div>
              </div>
            )}

          </div>

          {/* Standings list */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{lang === 'ar' ? 'قائمة بقية المتنافسين' : 'M\'sila community league standings'}</h3>
            
            <div className="space-y-2">
              {restLeaders.map((leader) => (
                <div 
                  key={leader.id}
                  className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
                    leader.isCurrentUser 
                      ? 'bg-[#FFD34D]/5 border-[#FFD34D] shadow-sm' 
                      : 'bg-white border-gray-150 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-gray-400 w-5 text-center text-xs">
                      #{leader.rank}
                    </span>
                    <img 
                      src={leader.avatar} 
                      alt={leader.name}
                      className="w-10 h-10 rounded-full object-cover border border-[#1F2A44]" 
                    />
                    <div>
                      <h4 className="text-xs font-black text-[#1F2A44] flex items-center gap-1.5">
                        <span>{leader.name}</span>
                        {leader.isCurrentUser && (
                          <span className="bg-[#1F2A44] text-[#FFD34D] text-[8px] px-1.5 py-0.5 rounded uppercase font-black">You</span>
                        )}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-extrabold">Completed Chores: {leader.questsCompleted}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-[#FF3B7C] bg-red-50 px-2.5 py-1 rounded-xl">
                      {leader.points} XP
                    </span>
                    <span className="text-xs text-yellow-500 font-black">★ {leader.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Challenges */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          
          {/* 
            Global Challenge Card per requirements:
            "The Algeria National Sprint: Complete 4 local tasks this week to secure 150 XP Bonus reward!"
          */}
          <div className="bg-gradient-to-r from-[#1F2A44] to-[#1E2E4E] border-2 border-[#FFD34D] text-white p-5 rounded-3xl space-y-2 relative overflow-hidden">
            <span className="absolute -top-3 -right-3 w-20 h-20 bg-[#FFD34D]/15 rounded-full blur-xl"></span>
            
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FFD34D] fill-[#FFD34D]" />
              <span className="text-[10px] text-[#FFD34D] font-black uppercase tracking-widest">{lang === 'ar' ? 'التحدي الكلي المعمم' : 'Active Territory Objective'}</span>
            </div>
            
            <h3 className="font-extrabold text-sm sm:text-md text-[#FFD34D]">
              {lang === 'ar' ? 'سباق كويست الجزائر: أكمل 4 مهام تبريدية هذا الأسبوع للحصول على 150 نقطة خبرة شرفية (XP)!' : 'The Algeria National Sprint: Complete 4 local tasks this week to secure 150 Honor XP Bonus reward!'}
            </h3>
            
            <p className="text-xs text-gray-300 font-medium leading-relaxed">
              {lang === 'ar' ? 'بادر بحل طلبات الشارع ومساعدة جيراننا في المجتمع، وسيتم ضخ التوفر تلقائياً عند التأكيد.' : 'Get rewards after posters verify completion screenshots.'}
            </p>
          </div>



          {/* Cadence Filters with Fluid Sliding Tab Animation */}
          <div className="flex bg-gray-150 p-1 rounded-2xl border border-gray-200 w-full sm:w-fit relative select-none">
            <button
              onClick={() => setCurrentCadenceFilter('all')}
              className={`relative px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer z-10 flex-1 sm:flex-initial text-center ${
                currentCadenceFilter === 'all' ? 'text-[#FFD34D]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {currentCadenceFilter === 'all' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-slate-800 rounded-xl -z-10 shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {lang === 'ar' ? 'الكل (١٤)' : 'All (14)'}
            </button>
            <button
              onClick={() => setCurrentCadenceFilter('daily')}
              className={`relative px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer z-10 flex-1 sm:flex-initial text-center ${
                currentCadenceFilter === 'daily' ? 'text-[#FFD34D]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {currentCadenceFilter === 'daily' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-slate-800 rounded-xl -z-10 shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {lang === 'ar' ? 'اليومية (٧)' : 'Daily (7)'}
            </button>
            <button
              onClick={() => setCurrentCadenceFilter('weekly')}
              className={`relative px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer z-10 flex-1 sm:flex-initial text-center ${
                currentCadenceFilter === 'weekly' ? 'text-[#FFD34D]' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {currentCadenceFilter === 'weekly' && (
                <motion.div
                  layoutId="activeSubTabIndicator"
                  className="absolute inset-0 bg-slate-800 rounded-xl -z-10 shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {lang === 'ar' ? 'الأسبوعية (٧)' : 'Weekly (7)'}
            </button>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="popLayout animate-fadeIn">
              {challenges
                .filter((ch) => {
                  const cadenceValue = (ch as any).cadence || 'weekly';
                  if (currentCadenceFilter === 'all') return true;
                  return cadenceValue === currentCadenceFilter;
                })
                .map((ch) => {
                  const isEligibleToClaim = ch.currentCount >= ch.targetCount;
                  const alreadyClaimed = claimedBonusList.includes(ch.id);
                  const progressPercentage = Math.min(100, Math.round((ch.currentCount / ch.targetCount) * 100));
                  const titleText = typeof ch.title === 'string' ? ch.title : ((ch.title as any)[lang] || (ch.title as any)['ar'] || (ch.title as any)['en']);
                  const descriptionText = typeof ch.description === 'string' ? ch.description : ((ch.description as any)[lang] || (ch.description as any)['ar'] || (ch.description as any)['en']);
                  const timeLeftText = typeof ch.timeLeft === 'string' ? ch.timeLeft : ((ch.timeLeft as any)[lang] || (ch.timeLeft as any)['ar'] || (ch.timeLeft as any)['en']);
                  const cadenceValue = (ch as any).cadence || 'weekly';

                  return (
                    <motion.div 
                      key={ch.id}
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white border border-gray-150 p-4 rounded-2xl space-y-3 shadow-sm transition-all duration-200"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-black text-sm text-[#1F2A44]">{titleText}</h4>
                            <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${cadenceValue === 'daily' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                              {cadenceValue === 'daily' ? (lang === 'ar' ? 'تحدي يومي' : 'Daily') : (lang === 'ar' ? 'تحدي أسبوعي' : 'Weekly')}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium">{descriptionText}</p>
                        </div>
                        <span className="text-[9px] text-gray-400 bg-gray-50 px-2.5 py-1 rounded-md font-bold shrink-0">
                          ⏱️ {timeLeftText}
                        </span>
                      </div>

                      {/* Progress Line */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 font-bold font-mono">
                          <span>Completed: {ch.currentCount} / {ch.targetCount}</span>
                          <span>{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-350 ${
                              isEligibleToClaim ? 'bg-emerald-500' : 'bg-[#FF3B7C]'
                            }`}
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-gray-50 flex-wrap sm:flex-nowrap gap-2">
                        <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                          🎁 +{ch.pointsReward} XP / Honor
                        </span>

                        {alreadyClaimed ? (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Bonus Unlocked
                          </span>
                        ) : isEligibleToClaim ? (
                          <button
                            onClick={() => handleClaimPoints(ch)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl cursor-pointer transition-all"
                          >
                            Claim Reward Payout! ⭐
                          </button>
                        ) : (
                          <span className="text-[9px] text-gray-400 font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            Work in progress
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Tab Content: Badges */}
      {activeTab === 'badges' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-gray-150 space-y-1.5 shadow-sm">
            <h3 className="font-extrabold text-sm uppercase text-[#1F2A44]">{lang === 'ar' ? 'معرض شارات الرتب للجزائر (٥٠ شارة)' : 'Honor Rank Badges Store (50 Badges)'}</h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              {lang === 'ar' ? 'انقر على الشارات لمعاينة تفاصيل المتطلبات الرياضية وإلغاء القفل. تظهر الشارات المقفلة باللون الرمادي مع رمز قفل بوضوح.' : 'Tap any badge to display its precise mathematical unlock requirements and purchase status. Locked badges are grayed out with a lock icon.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {badges.map((badge) => {
              const Icon = BADGE_ICONS[badge.iconName] || Award;
              const hasUnlockedInProfile = isBadgeUnlocked(badge.id, userProfile);

              const displayTitle = badge.name || (typeof badge.title === 'string' ? badge.title : ((badge.title as any)[lang] || (badge.title as any)['ar'] || (badge.title as any)['en']));
              const displayDescription = typeof badge.description === 'string' ? badge.description : ((badge.description as any)[lang] || (badge.description as any)['ar'] || (badge.description as any)['en']);

              const isRuby = badge.tier === 'Ruby' || badge.tier === 'RUBY';
              const isGold = badge.tier === 'Gold' || badge.tier === 'GOLD';
              const isSilver = badge.tier === 'Silver' || badge.tier === 'SILVER';

              return (
                <div 
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`p-4 rounded-3xl border transition-all duration-200 flex items-start gap-4 relative overflow-hidden cursor-pointer hover:scale-[1.01] hover:shadow-sm ${
                    hasUnlockedInProfile 
                      ? (isRuby ? 'bg-red-50/60 border-red-200 hover:bg-red-50/80 text-red-950' :
                         isGold ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50/80 text-amber-950' :
                         isSilver ? 'bg-slate-100/60 border-slate-350 hover:bg-slate-100/80 text-slate-900' :
                         'bg-orange-50/60 border-orange-200 hover:bg-orange-50/80 text-orange-950')
                      : 'bg-slate-50/50 border-gray-150 grayscale opacity-60 hover:grayscale-[50%] hover:opacity-80'
                  }`}
                >
                  {/* Lock Indicator Watermark */}
                  {!hasUnlockedInProfile && (
                    <div className="absolute top-2.5 right-2.5 bg-slate-900/10 p-1 rounded-lg">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}

                  <div className={`p-3 rounded-2xl shrink-0 ${
                    hasUnlockedInProfile 
                      ? (isRuby ? 'bg-red-100 text-red-700' :
                         isGold ? 'bg-amber-100 text-amber-700' :
                         isSilver ? 'bg-slate-100 text-slate-700' :
                         'bg-orange-100 text-orange-700')
                      : 'bg-gray-200/80 text-gray-400'
                  }`}>
                    <Icon className="w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-1 flex-1 text-left min-w-0">
                    <div className="flex gap-1.5 items-center flex-wrap">
                      <h4 className="font-black text-[#1F2A44] text-xs uppercase truncate max-w-[130px] sm:max-w-none">
                        {displayTitle}
                      </h4>
                      <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${
                        isRuby ? 'bg-red-150 text-red-800 border border-red-300' :
                        isGold ? 'bg-amber-150 text-amber-800 border border-amber-300' :
                        isSilver ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                        'bg-orange-150 text-orange-750 border border-orange-300'
                      }`}>
                        {badge.tier || 'Bronze'}
                      </span>
                      {hasUnlockedInProfile && (
                        <span className="text-[7px] bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">OWNED</span>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-gray-500 leading-normal font-medium line-clamp-1">
                      {displayDescription}
                    </p>
                    
                    <div className="flex items-center justify-between pt-1">
                      {badge.requirement ? (
                        <span className="text-[9px] text-[#42A5F5] font-extrabold max-w-[150px] truncate" title={badge.requirement}>
                          🎯 {badge.requirement}
                        </span>
                      ) : badge.pointsCost ? (
                        <span className="text-[10px] font-bold text-slate-700">
                          ⚡ {badge.pointsCost} Pts
                        </span>
                      ) : (
                        <span className="text-[9px] text-[#FF3B7C] font-extrabold max-w-[120px] truncate">
                          🎯 {lang === 'ar' ? 'مهمة خاصة' : 'Milestone Task'}
                        </span>
                      )}
                      
                      <span className="text-[9px] text-[#4FC3F7] hover:underline font-black uppercase shrink-0">
                        {lang === 'ar' ? 'التفاصيل 🔎' : 'Details 🔎'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Precise Mathematical Requirements Dialog Popup */}
          <AnimatePresence>
            {selectedBadge && (() => {
              const Icon = BADGE_ICONS[selectedBadge.iconName] || Award;
              const hasUnlocked = userProfile.unlockedBadgeIds.includes(selectedBadge.id) || selectedBadge.unlocked;
              const cost = selectedBadge.pointsCost || 0;
              const hasEnoughPoints = userProfile.totalPoints >= cost;
              const progressPct = cost > 0 ? Math.min(100, Math.round((userProfile.totalPoints / cost) * 100)) : 100;

              const titleText = typeof selectedBadge.title === 'string' ? selectedBadge.title : ((selectedBadge.title as any)[lang] || (selectedBadge.title as any)['ar'] || (selectedBadge.title as any)['en']);
              const descriptionText = typeof selectedBadge.description === 'string' ? selectedBadge.description : ((selectedBadge.description as any)[lang] || (selectedBadge.description as any)['ar'] || (selectedBadge.description as any)['en']);

              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-white rounded-3xl border border-gray-150 p-6 w-full max-w-sm shadow-2xl relative space-y-4 text-center max-h-[90vh] overflow-y-auto"
                  >
                    {/* Close button */}
                    <button 
                      onClick={() => setSelectedBadge(null)}
                      className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-all cursor-pointer text-gray-400 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {/* Header tier and icon */}
                    <div className="flex flex-col items-center space-y-2 pt-2">
                      <div className={`p-4 rounded-full ${
                        hasUnlocked 
                          ? 'bg-amber-100 text-amber-600 animate-bounce' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Icon className="w-12 h-12" />
                      </div>
                      
                      <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                        selectedBadge.tier === 'Ruby' ? 'bg-red-100 text-red-800 border border-red-200' :
                        selectedBadge.tier === 'Gold' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        selectedBadge.tier === 'Silver' ? 'bg-slate-100 text-slate-800 border border-slate-200' :
                        'bg-orange-100 text-orange-700 border border-orange-200'
                      }`}>
                        {selectedBadge.tier} Badge Rank
                      </span>
                    </div>

                    {/* Title and details */}
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-md text-[#1F2A44] uppercase">{titleText}</h3>
                      <p className="text-xs text-gray-500 font-medium leading-relaxed px-2">
                        {descriptionText}
                      </p>
                    </div>

                    {/* Requirements Display */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-150 text-left space-y-3">
                      <h5 className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                        {lang === 'ar' ? 'المتطلبات الدقيقة لتعديل الرتبة والشارة' : 'Precise Rank Requirements'}
                      </h5>

                      {selectedBadge.requirement ? (
                        <div className="space-y-1.5 font-bold text-xs">
                          <span className="text-gray-500 block">{lang === 'ar' ? 'شرط إنجاز الشارة الميداني:' : 'Field Requirement:'}</span>
                          <span className="text-rose-600 block bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-center text-xs font-black">
                            {selectedBadge.requirement}
                          </span>
                        </div>
                      ) : cost > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-gray-600">{lang === 'ar' ? 'رصيد نقاط الشرف (XP) المطلوب' : 'Required Honor Points (XP)'}</span>
                            <span className="font-black text-[#1F2A44] font-mono">{cost} XP</span>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1 pt-1">
                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  hasUnlocked ? 'bg-amber-500' : hasEnoughPoints ? 'bg-emerald-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-bold text-gray-400 font-mono">
                              <span>{lang === 'ar' ? 'رصيدك الحالي' : 'Holding'}: {userProfile.totalPoints} XP</span>
                              <span>{progressPct}%</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <span className="text-xs font-black text-[#FF3B7C] block bg-red-50 border border-red-100 p-2 rounded-xl text-center">
                            {lang === 'ar' ? 'لا يمكن شراؤها - تفتح بحضور المناسبات والفعاليات في الميدان!' : 'Non-Purchaseable - Earned strictly by completing special geographic tasks!'}
                          </span>
                        </div>
                      )}

                      <div className="text-[10px] text-gray-500 font-semibold space-y-1 pt-1 border-t border-gray-200/60 font-black">
                        <div className="flex justify-between">
                          <span>{lang === 'ar' ? 'الحالة الحالية للشارة' : 'Current Status'}:</span>
                          <span className={`font-black uppercase ${hasUnlocked ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {hasUnlocked ? (lang === 'ar' ? '✓ تـم إلغـاء القـفل' : '✓ UNLOCKED') : (lang === 'ar' ? '🔒 مــقفولة' : '🔒 LOCKED')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setSelectedBadge(null)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all"
                      >
                        {lang === 'ar' ? 'إغلاق' : 'Close Details'}
                      </button>

                      {!hasUnlocked && cost > 0 && (
                        <button
                          onClick={() => {
                            handleUnlockBadgeInView(selectedBadge);
                            setSelectedBadge(null);
                          }}
                          disabled={!hasEnoughPoints}
                          className={`flex-1 font-black text-xs py-2.5 rounded-xl cursor-pointer transition-all ${
                            hasEnoughPoints 
                              ? 'bg-slate-950 hover:bg-slate-800 text-[#FFD34D] shadow-md' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {lang === 'ar' ? 'شراء الشارة' : 'Buy Now'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })()}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
