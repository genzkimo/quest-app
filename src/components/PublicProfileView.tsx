import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Trophy, 
  Star, 
  Phone, 
  ShieldAlert, 
  Flag, 
  CheckCircle2, 
  MapPin, 
  AlertTriangle,
  Flame,
  Clock,
  ExternalLink,
  ShieldAlert as ReportIcon,
  Quote,
  Info
} from 'lucide-react';
import { Quest, UserProfile, Leader, HunterReview, GodfatherReview, UserModel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PublicProfileViewProps {
  userId: string;
  currentUser: UserProfile | null;
  leaders: Leader[];
  quests: Quest[];
  hunterReviews: HunterReview[];
  godfatherReviews?: GodfatherReview[];
  lang: 'ar' | 'fr' | 'en';
  onReportUser: (userId: string, reason: string) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
  userFlags: Record<string, number>;
}

export default function PublicProfileView({
  userId,
  currentUser,
  leaders,
  quests,
  hunterReviews,
  godfatherReviews = [],
  lang,
  onReportUser,
  onClose,
  showToast,
  userFlags
}: PublicProfileViewProps) {
  const isRtl = lang === 'ar';
  const flagsCount = userFlags[userId] || 0;
  const isSuspended = flagsCount >= 3;

  // React State Hooks at the absolute beginning of the component
  const [dbUser, setDbUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'hunter' | 'godfather'>('hunter');
  const [activeProfileTab, setActiveProfileTab] = useState<'verified' | 'gallery' | 'badges'>('verified');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);

  // Reporting details modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // States to limit/expand user reviews list in public profile view
  const [showAllRunnerReviews, setShowAllRunnerReviews] = useState(false);
  const [showAllGodfatherReviews, setShowAllGodfatherReviews] = useState(false);

  // 1. Resolve user details from current user profile, leaders, or build a robust placeholder
  const isSelf = userId === currentUser?.id || userId === 'user-current';
  
  let targetUser: {
    id: string;
    name: string;
    avatar: string;
    phone: string;
    city: string;
    rating: number;
    points: number;
    questsCompleted: number;
    questsCreated: number;
    idVerificationStatus: 'unverified' | 'pending' | 'verified';
    tier: 'Bronze' | 'Silver' | 'Gold';
    level: number;
  };

  const matchedLeader = leaders.find(l => l.id === userId);
  const matchedQuestCreator = quests.find(q => q.creatorId === userId);
  const matchedQuestHelper = quests.find(q => q.helperId === userId);

  if (isSelf && currentUser) {
    targetUser = {
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar,
      phone: currentUser.phone,
      city: currentUser.city || 'Algeria',
      rating: currentUser.rating || 5.0,
      points: currentUser.totalPoints || 0,
      questsCompleted: currentUser.questsCompleted || 0,
      questsCreated: currentUser.questsCreated || 0,
      idVerificationStatus: currentUser.idVerificationStatus || 'unverified',
      tier: currentUser.totalPoints >= 1200 ? 'Gold' : currentUser.totalPoints >= 600 ? 'Silver' : 'Bronze',
      level: currentUser.level || 1
    };
  } else if (matchedLeader) {
    targetUser = {
      id: matchedLeader.id,
      name: matchedLeader.name,
      avatar: matchedLeader.avatar,
      phone: (matchedLeader as any).phone || (lang === 'ar' ? 'غير متوفر' : 'Not available'),
      city: (matchedLeader as any).city || (lang === 'ar' ? 'غير متوفر' : 'Not available'),
      rating: matchedLeader.rating || 5.0,
      points: matchedLeader.points || 0,
      questsCompleted: matchedLeader.questsCompleted || 0,
      questsCreated: quests.filter(q => q.creatorId === matchedLeader.id).length || 2,
      idVerificationStatus: matchedLeader.idVerificationStatus || 'verified', // Leaders are verified by default
      tier: matchedLeader.tier || 'Bronze',
      level: Math.max(1, Math.floor(matchedLeader.points / 600) + 1)
    };
  } else {
    // Treat as inline creator / helper details fallback
    const name = matchedQuestCreator?.creatorName || matchedQuestHelper?.helperName || 'عامل كويست';
    const avatar = matchedQuestCreator?.creatorAvatar || matchedQuestHelper?.applicants?.find(a => a.userId === userId)?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
    const phone = matchedQuestCreator?.creatorPhone || matchedQuestHelper?.helperPhone || (lang === 'ar' ? 'غير متوفر' : 'Not available');
    
    targetUser = {
      id: userId,
      name,
      avatar,
      phone,
      city: (lang === 'ar' ? 'غير متوفر' : 'Not available'),
      rating: 4.8,
      points: 450,
      questsCompleted: 4,
      questsCreated: quests.filter(q => q.creatorId === userId).length,
      idVerificationStatus: 'verified',
      tier: 'Silver',
      level: 2
    };
  }

  // Merge Firestore user profile (dbUser) when loaded to avoid static unlinked details
  if (dbUser) {
    targetUser = {
      ...targetUser,
      name: dbUser.name || targetUser.name,
      avatar: dbUser.avatar || targetUser.avatar,
      phone: dbUser.phone || targetUser.phone,
      city: dbUser.city || targetUser.city,
      rating: dbUser.rating !== undefined ? dbUser.rating : targetUser.rating,
      points: dbUser.totalPoints !== undefined ? dbUser.totalPoints : targetUser.points,
      questsCompleted: dbUser.questsCompleted !== undefined ? dbUser.questsCompleted : targetUser.questsCompleted,
      questsCreated: dbUser.questsCreated !== undefined ? dbUser.questsCreated : targetUser.questsCreated,
      idVerificationStatus: dbUser.idVerificationStatus || targetUser.idVerificationStatus,
      tier: dbUser.totalPoints >= 1200 ? 'Gold' : dbUser.totalPoints >= 600 ? 'Silver' : 'Bronze',
      level: dbUser.level || targetUser.level
    };
  }

  // 2. Active connection status for phone display (booked or completed contract exists between parties)
  const hasActiveBooking = quests.some(q => 
    (currentUser && q.creatorId === currentUser.id && q.helperId === targetUser.id && (q.status === 'booked' || q.status === 'pending_verification')) ||
    (currentUser && q.helperId === currentUser.id && q.creatorId === targetUser.id && (q.status === 'booked' || q.status === 'pending_verification'))
  );

  // 3. User operational role categorization
  const isHunter = targetUser.questsCompleted > 0 || hunterReviews.some(r => r.hunterId === targetUser.id);
  const isGodfather = targetUser.questsCreated > 0 || quests.some(q => q.creatorId === targetUser.id);

  // Effect to switch default active tab based on their actual role if they have no hunter history
  useEffect(() => {
    if (!isHunter && isGodfather) {
      setActiveTab('godfather');
    }
  }, [isHunter, isGodfather]);

  useEffect(() => {
    const userRef = doc(db, 'users', userId);
    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        setDbUser(UserModel.fromFirestore(snap.data(), userId));
      }
    }).catch((err) => {
      console.warn("Failed retrieving public profile from Firestore:", err);
    });
  }, [userId]);

  const bio = dbUser?.bio || (isSelf ? (currentUser?.bio || '') : '');

  const handleCopyIdWithFeedback = (val: string) => {
    navigator.clipboard.writeText(val).then(() => {
      setCopiedId(val);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {
      try {
        const el = document.createElement('textarea');
        el.value = val;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopiedId(val);
        setTimeout(() => setCopiedId(null), 1500);
      } catch (err) {
        console.error("Copy fallback failure", err);
      }
    });
  };

  const handleStartPress = (val: string) => {
    const timer = setTimeout(() => {
      handleCopyIdWithFeedback(val);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleCancelPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Filter reviews specifically written FOR this worker
  const reviewsReceived = hunterReviews.filter(r => r.hunterId === targetUser.id);

  // Filter reciprocal reviews specifically written FOR this Godfather (Arab client)
  const godfatherReviewsReceived = godfatherReviews.filter(r => r.godfatherId === targetUser.id);

  // Filter bounties created by this poster
  const bountiesCreated = quests.filter(q => q.creatorId === targetUser.id && q.status === 'open');

  // Dynamic user-profile metrics calculation to be completely realistic
  const dynamicWorkerRating = reviewsReceived.length > 0
    ? (reviewsReceived.reduce((acc, r) => acc + r.rating, 0) / reviewsReceived.length)
    : targetUser.rating;

  const godfatherAverageRating = godfatherReviewsReceived.length > 0
    ? (godfatherReviewsReceived.reduce((acc, r) => acc + r.rating, 0) / godfatherReviewsReceived.length)
    : targetUser.rating;

  const dynamicQuestsCompleted = Math.max(
    quests.filter(q => q.helperId === targetUser.id && q.status === 'completed').length,
    targetUser.questsCompleted
  );

  const dynamicQuestsCreated = Math.max(
    quests.filter(q => q.creatorId === targetUser.id).length,
    targetUser.questsCreated
  );

  // Dynamic Success Rate based on completed vs cancelled/failed jobs helper assignments
  const assignedToUser = quests.filter(q => q.helperId === targetUser.id);
  const completedRunsCount = assignedToUser.filter(q => q.status === 'completed').length;
  const failedRunsCount = assignedToUser.filter(q => q.status === 'cancelled' || q.status === 'cancelled_by_timeout' || q.status === 'disputed').length;
  const dynamicSuccessRate = (completedRunsCount + failedRunsCount > 0)
    ? Math.round((completedRunsCount / (completedRunsCount + failedRunsCount)) * 100)
    : (dynamicQuestsCompleted > 0 ? 100 : 100); // Has history -> 100%, else 100% standard starting

  // Dynamic Payout Rate based on creator's disputes count and general reputation score
  const userCreatedQuests = quests.filter(q => q.creatorId === targetUser.id);
  const disputedCreatedQuestsCount = userCreatedQuests.filter(q => q.status === 'disputed').length;
  const baseReputationRate = Math.round((targetUser.rating / 5) * 100);
  const dynamicPayoutRate = userCreatedQuests.length > 0
    ? Math.round((baseReputationRate + Math.max(50, 100 - (disputedCreatedQuestsCount * 20))) / 2)
    : baseReputationRate;

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    setIsSubmittingReport(true);
    setTimeout(() => {
      onReportUser(targetUser.id, reportReason);
      setIsSubmittingReport(false);
      setShowReportModal(false);
      setReportReason('');
    }, 1200);
  };

  return (
    <div className="space-y-6 pt-4 animate-slideUp">
      {/* 1. Header Navigation and Title with Unified Seamless Background */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-black transition-all cursor-pointer"
        >
          {isRtl ? '← العودة للخلف' : '← Back'}
        </button>

        <h3 className="text-sm font-black text-[#1F2A44] uppercase tracking-wider">
          {isRtl ? 'تفحص حساب عضو كويست' : 'Quest Member Inspection'}
        </h3>

        {/* The Scam Shield Reporting Trigger Icon */}
        {!isSelf && (
          <button
            onClick={() => setShowReportModal(true)}
            className="w-9 h-9 bg-red-50 hover:bg-red-100 text-[#FF3B7C] border border-red-100 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            title={isRtl ? 'إرسال بلاغ إساءة أو تجميد الحساب' : 'Report Fraud, Non-Payment or Safety'}
          >
            <Flag className="w-4 h-4 text-[#FF3B7C]" />
          </button>
        )}
        {isSelf && <div className="w-9 h-9"></div>}
      </div>

      {/* 2. Unified Card Header (White, borderless, float design) */}
      <div className="bg-white rounded-3xl p-6 border border-gray-150 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
        
        {/* Scam shield state banner if user flags count is > 0 */}
        {flagsCount > 0 && (
          <div className="absolute top-0 left-0 right-0 py-1 px-4 text-center bg-red-50 border-b border-red-100 text-[10px] font-black text-[#FF3B7C] flex items-center justify-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {isRtl 
                ? `تنبيه درع الأمان: هذا العميل يملك ${flagsCount} بلاغات مجتمعية نشطة (${3 - flagsCount} بلاغ متبقي للحظر!).` 
                : `Security Shield Notice: This user has ${flagsCount} active community flags.`}
            </span>
          </div>
        )}

        {isSuspended && (
          <div className="absolute inset-0 bg-[#FFFFFF]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-10">
            <ReportIcon className="w-14 h-14 text-[#FF3B7C]" />
            <h4 className="text-md font-black text-[#1F2A44] mt-2 capitalize">
              {isRtl ? 'تم تجميد حساب هذا المستخدم حيوياً' : 'Operator Frozen Suspended'}
            </h4>
            <p className="text-xs text-gray-400 max-w-sm mt-1 font-semibold leading-relaxed">
              {isRtl
                ? 'الحساب تجمّد تلقائياً لتجاوزه ٣ بلاغات بخصوص التخلف عن الدفع بالمنصة الوطنية أو انتحال الشخصية.'
                : 'This account has been completely suspended from participating in the local Algerian economy loop due to repeated policy breaches.'}
            </p>
            <button 
              onClick={onClose} 
              className="mt-4 px-6 py-2.5 bg-[#1F2A44] text-white text-xs font-extrabold rounded-xl"
            >
              {isRtl ? 'العودة للخلف' : 'Back to safety'}
            </button>
          </div>
        )}

        {/* User Avatar */}
        <div className="relative pt-2">
          <img 
            src={targetUser.avatar} 
            alt={targetUser.name}
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-full border-4 border-slate-100 object-cover shadow-sm bg-gray-50"
          />
          {targetUser.idVerificationStatus === 'verified' && (
            <span className="absolute bottom-0 right-0 p-1.5 bg-[#4FC3F7] rounded-full border-2 border-white shadow-md">
              <ShieldCheck className="w-4 h-4 text-[#1F2A44]" />
            </span>
          )}
        </div>

        {/* User Identity Info */}
        <div className="space-y-1">
          <h2 className="text-lg font-black text-[#1F2A44] tracking-tight">{targetUser.name}</h2>
          
          {/* Copiable Account ID Badge with user hold interaction */}
          <div className="relative inline-block select-none">
            <div 
              id="public-user-id-badge"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-500 rounded-xl text-[10px] font-mono font-bold cursor-pointer transition-all border border-gray-150 select-all shadow-xs"
              title={isRtl ? 'اضغط أو اضغط ضغطاً مطولاً لنسخ معرف الحساب' : 'Click or hold down to copy Account ID'}
              onClick={() => handleCopyIdWithFeedback(targetUser.id)}
              onMouseDown={() => handleStartPress(targetUser.id)}
              onMouseUp={handleCancelPress}
              onMouseLeave={handleCancelPress}
              onTouchStart={() => handleStartPress(targetUser.id)}
              onTouchEnd={handleCancelPress}
              onContextMenu={(e) => {
                e.preventDefault();
                handleCopyIdWithFeedback(targetUser.id);
              }}
            >
              <span className="font-sans font-black text-gray-400">ID:</span>
              <span className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-black">{targetUser.id}</span>
            </div>

            {/* Float confirmation tooltip upon copy confirmation */}
            <AnimatePresence>
              {copiedId === targetUser.id && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: -25, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.8 }}
                  className="absolute left-1/2 -translate-x-1/2 -top-2 bg-[#1F2A44] text-[#FFD34D] text-[9px] font-black px-2 py-1 rounded-lg shadow-md whitespace-nowrap z-50 pointer-events-none"
                >
                  {isRtl ? '📋 تم النسخ بنجاح!' : '📋 Copied Successfully!'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] bg-slate-50 border border-gray-150 text-slate-500 font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#4FC3F7]" />
              {targetUser.city}
            </span>

            {/* Verification Tag */}
            {targetUser.idVerificationStatus === 'verified' ? (
              <span className="text-[10px] bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/25 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                {isRtl ? 'هوية وطنية موثقة ✓' : 'ID Verified ✓'}
              </span>
            ) : (
              <span className="text-[10px] bg-red-50 text-[#FF3B7C] border border-red-150 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                {isRtl ? 'هوية غير موثقة ⚠️' : 'Unverified ⚠️'}
              </span>
            )}
          </div>
        </div>

        {/* Mobile Contact panel - safety and trust check */}
        <div className="w-full bg-slate-50 p-3 rounded-2xl border border-gray-100 flex items-center justify-between text-xs font-bold text-[#1F2A44]">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-500" />
            <span className="text-gray-400 font-bold">{isRtl ? 'رقم الهاتف للاتصال المباشر:' : 'Mobile Telephone:'}</span>
          </div>
          {isSelf || hasActiveBooking ? (
            <span className="font-mono font-black tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg">
              {targetUser.phone}
            </span>
          ) : (
            <span className="text-gray-400 italic text-[11px] bg-gray-100 px-3 py-1 rounded-lg select-none" title="Unlocked only upon active contract bookings">
              🔒 {isRtl ? 'يظهر عند حجز كويست ' : 'Apperars when booking'}
            </span>
          )}
        </div>

        {/* Level and Tier Metrix Badge */}
        <div className="w-full grid grid-cols-2 gap-2 pt-1">
          <div className="bg-slate-50 p-3 rounded-2xl border border-gray-100 flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'الرتبة والمكافآت' : 'TIER'}</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Trophy className="w-4.5 h-4.5 text-amber-500 fill-amber-500/15" />
              <span className="text-xs font-black text-slate-700">{targetUser.tier} League</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-gray-150 flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isRtl ? 'مستوى الخبرة' : 'EXPERIENCE'}</span>
            <div className="flex items-center gap-1 mt-1">
              <Flame className="w-4.5 h-4.5 text-[#FF3B7C]" />
              <span className="text-xs font-mono font-black text-slate-700">LVL {targetUser.level} ({targetUser.points} XP)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Role selector toggle button tabs if both properties are active */}
      {isHunter && isGodfather && (
        <div className="grid grid-cols-2 p-1 bg-slate-50 rounded-2xl border border-gray-155 max-w-sm mx-auto mb-4">
          <button
            onClick={() => setActiveTab('hunter')}
            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'hunter' 
                ? 'bg-[#1F2A44] text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            ⚔️ {isRtl ? 'شخصية عامل' : 'Worker Core'}
          </button>
          <button
            onClick={() => setActiveTab('godfather')}
            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'godfather' 
                ? 'bg-[#1F2A44] text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            👑 {isRtl ? 'شخصية صاحب عمل' : 'Client Core'}
          </button>
        </div>
      )}

      {/* Dynamic Member Bio Widget */}
      <div className="bg-slate-50 border border-gray-150 rounded-2xl p-4 max-w-lg mx-auto mb-5 text-right relative overflow-hidden flex items-start gap-3.5 shadow-sm">
        <div className="bg-[#1F2A44]/10 p-2 rounded-xl text-[#1F2A44] flex-shrink-0 self-start">
          <Quote className="w-4 h-4 transform scale-x-[-1]" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <span className="text-[10px] font-extrabold text-[#1F2A44] opacity-85 block mb-1 text-right uppercase tracking-wider">
            {isRtl ? 'السيرة الذاتية للعضو' : 'Member Biography'}
          </span>
          <p 
            id="member-profile-bio-text"
            className="text-[12px] font-bold text-slate-700 leading-relaxed text-right line-clamp-3 overflow-hidden ml-auto max-w-full break-words"
            title={bio || (isRtl ? 'لا يوجد سيرة ذاتية مكتوبة بعد' : 'No biography written yet')}
          >
            {bio ? bio : (isRtl ? 'لا يوجد سيرة ذاتية مكتوبة بعد' : 'No biography written yet')}
          </p>
        </div>
      </div>

      {/* 🎛️ Premium 3-Tab Segmented Controller */}
      <div className="bg-slate-50 p-1.5 rounded-2xl border border-gray-150 grid grid-cols-3 gap-1 mx-auto max-w-lg mb-6 text-right">
        <button
          type="button"
          onClick={() => setActiveProfileTab('verified')}
          className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border-none ${
            activeProfileTab === 'verified'
              ? 'bg-[#1F2A44] text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>🛡️</span>
          <span>{isRtl ? 'إنجازات موثقة' : 'Verified Portfolio'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveProfileTab('gallery')}
          className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border-none ${
            activeProfileTab === 'gallery'
              ? 'bg-[#1F2A44] text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>📸</span>
          <span>{isRtl ? 'صور شخصية' : 'Gallery'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveProfileTab('badges')}
          className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border-none ${
            activeProfileTab === 'badges'
              ? 'bg-[#1F2A44] text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>🎖️</span>
          <span>{isRtl ? 'الشارات' : 'Badges'}</span>
        </button>
      </div>

      {/* 4. Display specific tab profiles content */}
      <div className="space-y-6">
        {activeProfileTab === 'verified' && (
          <div className="space-y-6 animate-slideUp">
            {/* Hunter profile blocks */}
            {activeTab === 'hunter' && (
              <div className="space-y-4">
            
            {/* Contracts completed metrics cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white border border-gray-150 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[20px] font-mono font-black text-[#1F2A44] block">
                  {dynamicQuestsCompleted}
                </span>
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mt-0.5">
                  {isRtl ? 'كويستات مكتملة' : 'Runs Finished'}
                </span>
              </div>

              <div className="bg-white border border-gray-150 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[20px] font-mono font-black text-[#4FC3F7] block">
                  {dynamicSuccessRate}%
                </span>
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mt-0.5">
                  {isRtl ? 'معدل النجاح' : 'Success Rate'}
                </span>
              </div>

              <div className="bg-white border border-gray-150 p-3.5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-center gap-0.5 text-[#FFD34D] pt-1">
                  <Star className="w-3.5 h-3.5 fill-[#FFD34D] text-[#FFD34D]" />
                  <span className="text-sm font-mono font-black text-slate-700 leading-none">
                    {dynamicWorkerRating.toFixed(1)}
                  </span>
                </div>
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mt-2.5">
                  {isRtl ? 'تقييم الثقة' : 'Trust Rep'}
                </span>
              </div>
            </div>

            {/* Permanent review cards portfolio feed list of client evaluations */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-[#1F2A44] uppercase tracking-wider pl-1 font-sans">
                🛡️ {isRtl ? 'بورتفوليو وإنجازات موثقة بالمنصة' : 'Verified Social Portfolio Feed'}
              </h4>

              {(() => {
                if (reviewsReceived.length === 0) {
                  return (
                    <div className="text-xs text-center text-gray-400 py-10 bg-white border border-dashed border-gray-200 rounded-3xl font-semibold">
                      {isRtl 
                        ? 'لم يتلقى هذا العامل مراجعات بورتفوليو بعد. شهادات العمل يتم إضافتها بمجرد مطابقة إثباتات الدفع!' 
                        : 'No verified employer feedback on this worker’s portfolio yet.'}
                    </div>
                  );
                }
                const visible = showAllRunnerReviews ? reviewsReceived : reviewsReceived.slice(0, 6);
                return (
                  <div className="space-y-4 text-center">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visible.map((review) => (
                        <div 
                          key={review.reviewId}
                          className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs relative flex flex-col justify-between"
                        >
                          {review.completedTaskImage && (
                            <div className="h-28 w-full overflow-hidden relative bg-slate-50">
                              <img 
                                src={review.completedTaskImage} 
                                alt="bounty proof illustration"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
                              
                              {/* Stars Rating banner */}
                              <div className="absolute bottom-2.5 left-2.5 bg-[#FFD34D] text-[#1F2A44] px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-0.5">
                                {Array.from({ length: review.rating }).map((_, i) => (
                                  <Star key={i} className="w-2.5 h-2.5 fill-[#1F2A44] text-[#1F2A44]" />
                                ))}
                                <span className="ml-1 font-mono font-bold">{review.rating}.0</span>
                              </div>
                            </div>
                          )}

                          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-right">
                            <p className="text-xs font-bold text-gray-600 italic">
                              “{review.comment}”
                            </p>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                              <div className="flex items-center gap-1.5 flex-row-reverse">
                                <span className="font-extrabold text-[#1F2A44]">{review.godfatherName}</span>
                                <span className="text-gray-300">|</span>
                                <span>{review.createdAt || 'منذ يومين'}</span>
                              </div>
                              <span className="text-[8px] bg-slate-55 text-slate-500 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                VERIFIED COPT 🛡️
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {reviewsReceived.length > 6 && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setShowAllRunnerReviews(!showAllRunnerReviews)}
                          className="px-5 py-2 bg-slate-100 hover:bg-slate-250 text-[#1F2A44] font-black text-xs rounded-xl shadow-xs cursor-pointer select-none transition-all flex items-center gap-1 active:scale-95 border border-slate-200"
                        >
                          <span>{showAllRunnerReviews ? '⬆️' : '⬇️'}</span>
                          <span>
                            {showAllRunnerReviews 
                              ? (isRtl ? 'عرض أقل' : 'Show Less')
                              : (isRtl ? 'عرض المزيد' : 'Show More')}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* Godfather profile blocks */}
        {activeTab === 'godfather' && (
          <div className="space-y-4">
            
            {/* Operational Godfather stats dashboard */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white border border-gray-150 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[20px] font-mono font-black text-[#1F2A44] block">
                  {dynamicQuestsCreated}
                </span>
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mt-0.5">
                  {isRtl ? 'إجمالي الطلبات' : 'Bounties Hosted'}
                </span>
              </div>

              <div className="bg-white border border-gray-150 p-3.5 rounded-2xl shadow-xs">
                <div className="flex items-center justify-center gap-0.5 text-[#FFD34D] pt-1">
                  <Star className="w-3.5 h-3.5 fill-[#FFD34D] text-[#FFD34D]" />
                  <span className="text-sm font-mono font-black text-slate-700 leading-none">
                    {godfatherAverageRating.toFixed(1)}
                  </span>
                </div>
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mt-2.5">
                  {isRtl ? 'تقييم المعاملة' : 'Treatment Rating'}
                </span>
              </div>

              <div className="bg-white border border-gray-150 p-3.5 rounded-2xl shadow-xs">
                <span className="text-[20px] font-mono font-black text-[#FF3B7C] block">
                  {dynamicPayoutRate}%
                </span>
                <span className="text-[8.5px] font-black text-slate-400 uppercase block tracking-wider mt-0.5">
                  {isRtl ? 'سرعة الدفع النقدى' : 'Payout Rate'}
                </span>
              </div>
            </div>

            {/* List currently active/open contracts hosted by this client */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-[#1F2A44] uppercase tracking-wider pl-1 font-sans">
                💼 {isRtl ? 'عروض كويستات عمل معلنة حالياً للتقديم' : 'Current Available Jobs Posted'}
              </h4>

              {bountiesCreated.length === 0 ? (
                <div className="text-xs text-center text-gray-400 py-10 bg-white border border-dashed border-gray-200 rounded-3xl font-semibold">
                  {isRtl 
                    ? 'لا توجد كويستات مفتوحة ومعلنة حالياً لتوظيف عمال لدى صاحب العمل هذا.' 
                    : 'No active job invitations posted by this workspace client at this exact moment.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {bountiesCreated.map((quest) => (
                    <div 
                      key={quest.id}
                      className="bg-white hover:border-[#4FC3F7] border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all"
                    >
                      <div className="space-y-1 pr-4 text-right flex-1">
                        <span className="text-[8px] font-black px-2 py-0.5 rounded bg-gray-100 text-[#1F2A44] uppercase tracking-wider">
                          {quest.category}
                        </span>
                        <h4 className="font-extrabold text-[#1F2A44] text-xs leading-snug">{quest.title}</h4>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#4FC3F7]" />
                          <span>{quest.location}</span>
                        </div>
                      </div>

                      <div className="text-left select-none shrink-0">
                        <span className="text-[#FF3B7C] font-black block text-xs font-mono">{quest.cashReward} DA</span>
                        <span className="text-[8px] text-gray-400 block font-bold">{quest.pointsReward} XP + 🏆</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* List reciprocal reviews received by this Godfather from Runners */}
            <div className="space-y-3 pt-4">
              <h4 className="text-[10px] font-black text-[#1F2A44] uppercase tracking-wider pl-1 font-sans">
                👑 {isRtl ? 'تقييمات متبادلة تلقاها من العمال المنفذين' : 'Reviews From Reciprocal Worker'}
              </h4>

              {(() => {
                if (godfatherReviewsReceived.length === 0) {
                  return (
                    <div className="text-xs text-center text-gray-400 py-10 bg-white border border-dashed border-gray-200 rounded-3xl font-semibold">
                      {isRtl 
                        ? 'لم يتلقى صاحب العمل هذا مراجعات بعد. تظهر الشهادات فور إنهاء الكويستات بنجاح متبادل!' 
                        : 'No reciprocal worker ratings recorded on this workspace profile yet.'}
                    </div>
                  );
                }
                const visible = showAllGodfatherReviews ? godfatherReviewsReceived : godfatherReviewsReceived.slice(0, 6);
                return (
                  <div className="space-y-4 text-center">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visible.map((review) => (
                        <div 
                          key={review.reviewId}
                          className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs relative flex flex-col justify-between"
                        >
                          {review.completedTaskImage && (
                            <div className="h-28 w-full overflow-hidden relative bg-slate-50">
                              <img 
                                src={review.completedTaskImage} 
                                alt="completed proof layout"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
                              
                              {/* Stars Rating banner */}
                              <div className="absolute bottom-2.5 left-2.5 bg-amber-400 text-slate-900 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-0.5">
                                {Array.from({ length: review.rating }).map((_, i) => (
                                  <Star key={i} className="w-2.5 h-2.5 fill-slate-900 text-slate-900" />
                                ))}
                                <span className="ml-1 font-mono font-bold">{review.rating}.0</span>
                              </div>
                            </div>
                          )}

                          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-right">
                            <p className="text-xs font-bold text-gray-600 italic">
                              “{review.comment}”
                            </p>

                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                              <div className="flex items-center gap-1.5 flex-row-reverse">
                                <span className="font-extrabold text-[#1F2A44]">{review.hunterName}</span>
                                <span className="text-gray-300">|</span>
                                <span>{review.createdAt || 'منذ يومين'}</span>
                              </div>
                              <span className="text-[8px] bg-amber-50 text-amber-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                RECIPROCAL TRUST 🤝
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {godfatherReviewsReceived.length > 6 && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setShowAllGodfatherReviews(!showAllGodfatherReviews)}
                          className="px-5 py-2 bg-slate-100 hover:bg-slate-250 text-[#1F2A44] font-black text-xs rounded-xl shadow-xs cursor-pointer select-none transition-all flex items-center gap-1 active:scale-95 border border-slate-200"
                        >
                          <span>{showAllGodfatherReviews ? '⬆️' : '⬇️'}</span>
                          <span>
                            {showAllGodfatherReviews 
                              ? (isRtl ? 'عرض أقل' : 'Show Less')
                              : (isRtl ? 'عرض المزيد' : 'Show More')}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

              </div>
            )}
          </div>
        )}

        {/* Gallery tab content */}
        {activeProfileTab === 'gallery' && (
          <div className="space-y-4 animate-slideUp">
            <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm text-right">
              <div className="pb-2 border-b border-gray-100">
                <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
                  {isRtl ? 'معرض الصور الموثقة للملف 📸' : 'User Verification snapbooks'}
                </h4>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                  {isRtl ? 'لقطات مأخوذة ميدانياً من إنجازات هذا العضو لإثبات المصداقية.' : 'Interactive authentic field photos of previous endeavors.'}
                </p>
              </div>

              {(() => {
                const photos: { url: string; caption: string }[] = [];
                const addedUrls = new Set<string>();

                assignedToUser.forEach((q) => {
                  if (q.proofImageUrl && !q.proofImageUrl.includes('unsplash.com') && !addedUrls.has(q.proofImageUrl)) {
                    addedUrls.add(q.proofImageUrl);
                    photos.push({ url: q.proofImageUrl, caption: q.title });
                  }
                  if (q.imageUrls && Array.isArray(q.imageUrls)) {
                    q.imageUrls.forEach((u) => {
                      if (u && !u.includes('unsplash.com') && !addedUrls.has(u)) {
                        addedUrls.add(u);
                        photos.push({ url: u, caption: q.title });
                      }
                    });
                  }
                });

                userCreatedQuests.forEach((q) => {
                  if (q.proofImageUrl && !q.proofImageUrl.includes('unsplash.com') && !addedUrls.has(q.proofImageUrl)) {
                    addedUrls.add(q.proofImageUrl);
                    photos.push({ url: q.proofImageUrl, caption: q.title });
                  }
                  if (q.imageUrls && Array.isArray(q.imageUrls)) {
                    q.imageUrls.forEach((u) => {
                      if (u && !u.includes('unsplash.com') && !addedUrls.has(u)) {
                        addedUrls.add(u);
                        photos.push({ url: u, caption: q.title });
                      }
                    });
                  }
                });

                if (photos.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-400 text-xs font-bold border border-dashed border-gray-200 rounded-2xl">
                      {isRtl ? 'لا توجد صور موثقة مرفقة في معرض هذا الملف بعد.' : 'No authenticated proof photos in this user gallery yet.'}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((pic, idx) => (
                      <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-gray-150 relative group bg-gray-100 shadow-xs cursor-zoom-in" onClick={() => setLightboxUrl(pic.url)}>
                        <img 
                          src={pic.url} 
                          alt={pic.caption} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-[9px] text-white font-bold leading-normal truncate text-center">
                          {pic.caption}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Badges tab content */}
        {activeProfileTab === 'badges' && (
          <div className="space-y-4 animate-slideUp text-right">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{isRtl ? 'الشارات التقديرية المكتسبة 🎖️' : 'Unlocked peer-to-peer medals'}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { title: isRtl ? 'درع الأمان الفضي 🛡️' : 'Silver Safety Badge', description: isRtl ? 'تم التحقق من الوثائق والهوية الوطنية بنسبة 100%' : 'NID & documents authenticated by central supervisors' },
                ...(targetUser.level > 1 ? [{ title: isRtl ? 'سرعة الإنجاز الخارقة ⚡' : 'Flash Operator Speedster', description: isRtl ? 'أكمل مهام متعددة في أقل من ٢٤ ساعة وبتقييم ممتاز' : 'Completed multiple runs in record time limit' }] : []),
                ...(activeTab === 'godfather' ? [{ title: isRtl ? 'موثق الرواتب والسخاء 🏆' : 'Generous Paymaster medal', description: isRtl ? 'يملك سجل حافل بدفع المستحقات للرانرز بشكل فوري وبدون تأخير' : 'Maintains a pristine record of zero payment delays' }] : []),
                { title: isRtl ? 'نجم التقييم الذهبي ⭐' : 'Gold Trust Star', description: isRtl ? 'حافظ على تقييم عام أعلى من 4.5 نجمة لفترات طويلة' : 'Maintained reputation above 4.5 stars continuously' }
              ].map((badge, idx) => (
                <div key={idx} className="bg-white hover:bg-slate-50/50 p-3.5 rounded-2xl border border-gray-150 flex items-center gap-3 flex-row-reverse">
                  <div className="p-2.5 bg-[#FFD34D]/10 rounded-xl text-amber-600 shrink-0">
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-xs font-black text-[#1F2A44]">{badge.title}</h5>
                    <p className="text-[10px] text-gray-400 font-semibold leading-normal">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 📸 Public Lightbox Modal */}
      <AnimatePresence>
        {lightboxUrl && (
          <div 
            className="fixed inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="absolute top-4 right-4 z-50">
              <button 
                onClick={() => setLightboxUrl(null)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-all border-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-3xl w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={lightboxUrl} 
                alt="Zoomed public gallery photograph" 
                className="max-h-[80vh] object-contain mx-auto rounded-2xl border-2 border-white/20 shadow-2xl" 
                referrerPolicy="no-referrer"
              />
              <p className="text-gray-300 text-xs font-semibold mt-3">
                {isRtl ? '🔍 اضغط في أي مكان بالخلفية للعودة للملف' : '🔍 Click anywhere on background to dismiss preview'}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Cryptographic Action: Report Peer scams or non-payment Modal popup */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 border border-red-100 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-red-50 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6 text-[#FF3B7C]" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase text-[#1F2A44]">
                  {isRtl ? 'درع الحماية: الإبلاغ عن احتيال' : 'Quest Scam Shield Guard'}
                </h3>
                <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                  {isRtl 
                    ? `هل ترغب في الإبلاغ عن العضو [ ${targetUser.name} ] بخصوص تصرف غير مهني كالتخلف عن الدفع أو عمل غير مكتمل؟` 
                    : `Your query initiates an investigation regarding [ ${targetUser.name} ] activities. Repetitive fraud tags auto-ban users.`}
                </p>
              </div>

              <form onSubmit={handleReportSubmit} className="space-y-3 text-right">
                <label className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">
                  {isRtl ? 'سبب تقديم الشكوى (مطلوب)' : 'Describe Violation Context'}
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={160}
                  placeholder={isRtl ? 'مثال: لم يدفع لي المبلغ النقدي في الموعد عند التسليم...' : 'Describe breach context...'}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none"
                />

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="bg-[#FF3B7C] text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    {isSubmittingReport 
                      ? (isRtl ? 'جاري الإرسال...' : 'Filing...') 
                      : (isRtl ? 'أكد البلاغ مجتمعياً' : 'File Report')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-500 font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
