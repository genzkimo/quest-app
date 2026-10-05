import React, { useState, useEffect } from 'react';
import { playSoftClick } from '../utils/audio';
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
  Info,
  Briefcase,
  Frown,
  Camera,
  UserCheck,
  Crown,
  FileText,
  IdCard,
  Lock,
  Copy
} from 'lucide-react';
import { Quest, UserProfile, Leader, HunterReview, GodfatherReview, UserModel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatJoinedDate, formatReviewDate } from '../utils/dateFormatter';
import { formatDisplayId12 } from '../utils/userIdFormatter';
import InfoButton from './InfoButton';
import { lockBodyScroll } from '../utils/scrollLock';

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
 const [activeProfileTab, setActiveProfileTab] = useState<'gallery' | 'badges'>('gallery');
 const [showReviewsModal, setShowReviewsModal] = useState(false);
 const [modalReviewRoleTab, setModalReviewRoleTab] = useState<'hunter' | 'godfather'>('hunter');
 const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
 const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
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

 // Lock body scroll and prevent background scroll leakage when modals are open
  useEffect(() => {
    if (showReviewsModal || showContactInfoModal || showReportModal || !!lightboxUrl) {
      return lockBodyScroll();
    }
  }, [showReviewsModal, showContactInfoModal, showReportModal, lightboxUrl]);

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
 const bountiesCreated = quests.filter(q => q.creatorId === targetUser.id && (q.status === 'open' || q.status === 'applications'));

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
 <div className="space-y-4 pb-32 font-sans text-[#1F2A44] dark:text-white min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* 1. Dynamic Public Profile Header with adaptive banner filling screen edge-to-edge */}
        {/* Scam shield warning banner if flagsCount > 0 */}
        {flagsCount > 0 && (
          <div className="w-full py-1.5 px-4 text-center bg-red-600 text-white text-[11px] font-black flex items-center justify-center gap-1 z-30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              {isRtl 
                ? `تنبيه درع الأمان: هذا العضو يملك ${flagsCount} بلاغات نشطة (${3 - flagsCount} بلاغ متبقي للحظر).` 
                : `Security Shield Notice: This user has ${flagsCount} active community flags.`}
            </span>
          </div>
        )}

        {isSuspended && (
          <div className="absolute inset-0 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 z-30">
            <ReportIcon className="w-14 h-14 text-[#FF3B7C]" />
            <h4 className="text-md font-black text-[#1F2A44] dark:text-white mt-2 capitalize">
              {isRtl ? 'تم تجميد حساب هذا المستخدم حيوياً' : 'Operator Frozen Suspended'}
            </h4>
            <p className="text-xs text-gray-400 max-w-sm mt-1 font-semibold leading-relaxed text-center">
              {isRtl
                ? 'الحساب تجمّد تلقائياً لتجاوزه ٣ بلاغات بخصوص التخلف عن الدفع بالمنصة الوطنية أو انتحال الشخصية.'
                : 'This account has been completely suspended from participating due to repeated policy breaches.'}
            </p>
            <button 
              onClick={onClose} 
              className="mt-4 px-6 py-2.5 bg-[#1F2A44] text-white text-xs font-extrabold rounded-xl"
            >
              {isRtl ? 'العودة للخلف' : 'Back to safety'}
            </button>
          </div>
        )}

        {/* Full-width Edge-to-Edge Banner */}
        <div className="w-full min-h-[9rem] sm:min-h-[10.5rem] pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] px-4 pb-4 bg-gradient-to-r from-[#1F2A44] via-[#1A2640] to-[#1E2E4E] relative flex items-start justify-between">
          {/* Back button on banner */}
          <button 
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-full text-xs font-black transition-all cursor-pointer border border-white/20 shadow-xs active:scale-95 z-20"
          >
            {isRtl ? '← العودة للخلف' : '← Back'}
          </button>

          {/* Title on banner */}
          <span className="text-xs font-black text-white/80 uppercase tracking-wider hidden sm:inline-block pt-1.5">
            {isRtl ? 'تفحص حساب عضو كويست' : 'Quest Member Inspection'}
          </span>

          {/* Scam Shield Reporting Trigger Icon on banner */}
          {!isSelf ? (
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="w-9 h-9 bg-white/10 hover:bg-red-500/80 text-white border border-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-md active:scale-95 z-20"
              title={isRtl ? 'إرسال بلاغ إساءة أو تجميد الحساب' : 'Report Fraud, Non-Payment or Safety'}
            >
              <Flag className="w-4 h-4 text-white" />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}
        </div>

      {/* Main Single Flow Container: Avatar, Name, 4 Buttons, Bio, Jobs, Gallery - ZERO separation */}
      <div className="max-w-2xl mx-auto px-3.5 sm:px-6 space-y-3 pb-32">
        {/* Avatar & Name */}
        <div className="relative -mt-16 sm:-mt-20 flex flex-col items-center text-center">
          {/* Avatar with Red or Blue Badge depending on verification status */}
          <div className="relative mb-2">
            <img 
              src={targetUser.avatar} 
              alt={targetUser.name}
              referrerPolicy="no-referrer"
              className="w-22 h-22 sm:w-26 sm:h-26 rounded-full border-4 border-white object-cover shadow-md bg-white"
            />
            {targetUser.idVerificationStatus === 'verified' ? (
              <span 
                className="absolute bottom-0 right-0 p-1 bg-[#4FC3F7] rounded-full border-2 border-white shadow-md flex items-center justify-center"
                title={isRtl ? 'هوية موثقة' : 'Verified ID'}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </span>
            ) : (
              <span 
                className="absolute bottom-0 right-0 p-1 bg-rose-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"
                title={isRtl ? 'هوية غير موثقة' : 'Unverified ID'}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-white" />
              </span>
            )}
          </div>

          {/* User Identity Info */}
          <div className="text-center space-y-1 w-full max-w-sm">
            <h2 className="text-xl font-black text-[#1F2A44] dark:text-white tracking-tight">{targetUser.name}</h2>
          </div>
        </div>

        {/* Symmetrical 4-Card Stats Grid */}
          <div className="w-full grid grid-cols-4 gap-1.5 sm:gap-2.5 text-center mt-4">
            {/* 1. التقييمات */}
            <button
              id="public-rating-badge-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playSoftClick(currentUser?.audioEffectsEnabled !== false);
                setModalReviewRoleTab(activeTab);
                setShowReviewsModal(true);
              }}
              className="relative overflow-hidden bg-gradient-to-b from-amber-50 to-amber-100/50 hover:from-amber-100 hover:to-amber-200/50 dark:from-amber-950/30 dark:to-amber-900/20 dark:hover:from-amber-900/40 dark:hover:to-amber-900/30 border-2 border-amber-300/80 hover:border-amber-400 dark:border-amber-600/40 p-2 sm:p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-xs hover:shadow-md cursor-pointer active:scale-92 active:shadow-inner transition-all group ring-1 ring-amber-400/20 select-none"
              title={isRtl ? 'انقر لعرض جميع التقييمات' : 'Click to view all reviews'}
            >
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono flex items-center justify-center gap-0.5 leading-none group-hover:scale-105 transition-transform">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                {(activeTab === 'hunter' ? dynamicWorkerRating : godfatherAverageRating).toFixed(1)}
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-amber-800 dark:text-amber-300 font-extrabold uppercase tracking-wide block mt-1">
                {isRtl ? 'التقييمات' : 'Reviews'}
              </span>
            </button>

            {/* 2. عدد المهام المنجزة */}
            <div className="bg-slate-50 dark:bg-[#1A2640] border border-gray-150 dark:border-slate-800 p-2 sm:p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-2xs">
              <span className="text-sm sm:text-base font-black font-mono flex items-center justify-center gap-0.5 text-slate-900 dark:text-white leading-none">
                <Briefcase className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                {dynamicQuestsCompleted}
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-500 dark:text-slate-300 font-extrabold uppercase tracking-wide block mt-1 truncate max-w-full">
                {isRtl ? 'المنجزة' : 'Finished'}
              </span>
            </div>

            {/* 3. عدد المهام المنشورة */}
            <div className="bg-slate-50 dark:bg-[#1A2640] border border-gray-150 dark:border-slate-800 p-2 sm:p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-2xs">
              <span className="text-sm sm:text-base font-black font-mono flex items-center justify-center gap-0.5 text-slate-900 dark:text-white leading-none">
                <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                {dynamicQuestsCreated}
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-slate-500 dark:text-slate-300 font-extrabold uppercase tracking-wide block mt-1">
                {isRtl ? 'المنشورة' : 'Posted'}
              </span>
            </div>

            {/* 4. بطاقة معلومات الحساب والهوية */}
            <button
              id="public-info-modal-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playSoftClick(currentUser?.audioEffectsEnabled !== false);
                setShowContactInfoModal(true);
              }}
              className="relative overflow-hidden bg-gradient-to-b from-sky-50 to-sky-100/50 hover:from-sky-100 hover:to-sky-200/50 dark:from-sky-950/30 dark:to-sky-900/20 dark:hover:from-sky-900/40 dark:hover:to-sky-900/30 border-2 border-sky-300/80 hover:border-sky-400 dark:border-sky-600/40 p-2 sm:p-2.5 rounded-2xl flex flex-col items-center justify-center shadow-xs hover:shadow-md cursor-pointer active:scale-92 active:shadow-inner transition-all group ring-1 ring-sky-400/20 select-none"
              title={isRtl ? 'عرض تفاصيل الحساب والمعلومات' : 'View account info'}
            >
              <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-1.5 h-1.5 rounded-full bg-[#4FC3F7] animate-pulse"></span>
              <span className="text-sm sm:text-base font-black font-mono flex items-center justify-center gap-1 text-slate-900 dark:text-white leading-none group-hover:scale-105 transition-transform">
                <IdCard className="w-3.5 h-3.5 text-[#4FC3F7] shrink-0" />
                <span className="text-xs sm:text-sm font-black font-mono tracking-tight">ID</span>
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] text-sky-800 dark:text-sky-300 font-extrabold uppercase tracking-wide block mt-1">
                {targetUser.idVerificationStatus === 'verified' 
                  ? (isRtl ? 'موثق' : 'Verified') 
                  : (isRtl ? 'معلومات' : 'Info')}
              </span>
            </button>
        </div>

        {/* Dynamic Member Bio Widget - directly below the 4 buttons */}
        <div className="bg-white dark:bg-slate-900 border border-gray-150/60 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 w-full text-right relative overflow-hidden flex items-start gap-3 shadow-2xs">
          <div className="bg-[#1F2A44]/10 dark:bg-white/10 p-2 rounded-xl text-[#1F2A44] dark:text-white shrink-0 self-start">
            <Quote className="w-4 h-4 transform scale-x-[-1]" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 mb-1 justify-start">
              <span className="text-[10px] font-extrabold text-[#1F2A44] dark:text-white opacity-85 uppercase tracking-wider">
                {isRtl ? 'السيرة الذاتية (Bio)' : 'Biography'}
              </span>
              <InfoButton 
                title={isRtl ? 'السيرة الذاتية' : 'Biography'} 
                explanation={isRtl ? 'نبذة مختصرة كتبها العضو عن مهاراته وخبراته ومجالات عمله.' : 'A brief description written by the member about their skills and expertise.'} 
              />
            </div>
            <p 
              id="member-profile-bio-text"
              className="text-[12px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed text-right line-clamp-3 overflow-hidden ml-auto max-w-full break-words"
              title={bio || (isRtl ? 'لا يوجد سيرة ذاتية مكتوبة بعد' : 'No biography written yet')}
            >
              {bio ? bio : (isRtl ? 'لا يوجد سيرة ذاتية مكتوبة بعد' : 'No biography written yet')}
            </p>
          </div>
        </div>

  {/* Available Jobs Posted by Employer (if active) */}
  {bountiesCreated.length > 0 && (
    <div className="space-y-3 max-w-lg mx-auto mb-6">
      <h4 className="text-[10px] font-black text-[#1F2A44] uppercase tracking-wider pl-1 font-sans">
        {isRtl ? 'عروض كويستات عمل معلنة حالياً للتقديم' : 'Current Available Jobs Posted'}
      </h4>
      <div className="grid grid-cols-1 gap-2.5">
        {bountiesCreated.map((quest) => (
          <div 
            key={quest.id}
            className="bg-white hover:border-[#4FC3F7] border border-gray-150 p-3.5 rounded-2xl flex items-center justify-between shadow-xs transition-all"
          >
            <div className="space-y-1 pr-3 text-right flex-1">
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
              <span className="text-[8px] text-gray-400 block font-bold">{quest.pointsReward} XP + </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Tab Contents */}
  <div className="space-y-6">
 {/* Gallery tab content */}
 {activeProfileTab === 'gallery' && (
 <div className="space-y-2 animate-slideUp">
 <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-3.5 space-y-2.5 border border-gray-150/60 dark:border-slate-800 shadow-2xs text-right">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <h4 className="font-extrabold text-[#1F2A44] dark:text-white text-xs">
 {isRtl ? 'معرض الصور' : 'Gallery'}
 </h4>
 <InfoButton
   title={isRtl ? 'معرض الصور' : 'Gallery'}
   explanation={isRtl ? 'لقطات مأخوذة ميدانياً من إنجازات هذا العضو لإثبات المصداقية والكفاءة.' : "Field photos demonstrating this member's verified achievements and skills."}
 />
 </div>
 </div>

 {(() => {
 const photos: { url: string; caption: string }[] = [];
 const addedUrls = new Set<string>();

 // 1. User's explicitly uploaded portfolio photos (personal gallery)
 const userPortfolio = (targetUser as any)?.portfolioPhotos || (isSelf ? (() => {
   try {
     const saved = localStorage.getItem('runner_portfolio_photos');
     return saved ? JSON.parse(saved) : [];
   } catch { return []; }
 })() : []);

 if (Array.isArray(userPortfolio)) {
   userPortfolio.forEach((url: string, pIdx: number) => {
     if (url && typeof url === 'string' && !url.includes('unsplash.com') && !addedUrls.has(url)) {
       addedUrls.add(url);
       photos.push({ url, caption: isRtl ? `عمل ميداني #${pIdx + 1}` : `Portfolio item #${pIdx + 1}` });
     }
   });
 }

 // 2. ONLY verified proof photos of successfully completed quests (NOT general quest attachments or items)
 assignedToUser.forEach((q) => {
   if (q.status === 'completed' && q.proofImageUrl && !q.proofImageUrl.includes('unsplash.com') && !addedUrls.has(q.proofImageUrl)) {
     addedUrls.add(q.proofImageUrl);
     photos.push({ url: q.proofImageUrl, caption: q.title });
   }
 });

 userCreatedQuests.forEach((q) => {
   if (q.status === 'completed' && q.proofImageUrl && !q.proofImageUrl.includes('unsplash.com') && !addedUrls.has(q.proofImageUrl)) {
     addedUrls.add(q.proofImageUrl);
     photos.push({ url: q.proofImageUrl, caption: q.title });
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
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
 {photos.map((pic, idx) => (
 <div key={idx} className="aspect-square rounded-xl overflow-hidden shadow-2xs relative group bg-gray-100 shadow-xs cursor-zoom-in" onClick={() => setLightboxUrl(pic.url)}>
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

  </div>

      </div>

 {/* Public Lightbox Modal */}
 <AnimatePresence>
 {lightboxUrl && (
 <div 
 className="fixed inset-0 bg-slate-950/95 z-[9999] flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fadeIn select-none"
 style={{ touchAction: 'none' }}
 onClick={() => setLightboxUrl(null)}
 onTouchMove={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
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
 {isRtl ? ' اضغط في أي مكان بالخلفية للعودة للملف' : ' Click anywhere on background to dismiss preview'}
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

  {/* Contact, Location & 12-symbol ID Details Modal for Public Profile */}
    <AnimatePresence>
      {showContactInfoModal && (
        <div 
          className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overscroll-contain"
          onClick={() => setShowContactInfoModal(false)}
          onTouchMove={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-gray-150 overflow-hidden text-right overscroll-contain"
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-150">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-50 text-[#4FC3F7] rounded-xl">
                  <IdCard className="w-5 h-5 text-[#4FC3F7]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#1F2A44]">
                    {isRtl ? 'معلومات الحساب' : 'Account Details'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    {isRtl ? 'معرّف الحساب (12 رمز)، الهاتف، والموقع' : '12-Symbol Account ID, Phone & Location'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContactInfoModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Items */}
            <div className="py-4 space-y-2.5">
            {/* حالة توثيق الهوية والحساب (بطاقة موحدة واضحة) */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              targetUser.idVerificationStatus === 'verified'
                ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/50'
                : targetUser.idVerificationStatus === 'pending'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50'
                : 'bg-slate-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700/80'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl shrink-0 ${
                  targetUser.idVerificationStatus === 'verified'
                    ? 'bg-[#4FC3F7]/15 text-[#4FC3F7]'
                    : targetUser.idVerificationStatus === 'pending'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-slate-200/80 dark:bg-slate-700 text-slate-500'
                }`}>
                  {targetUser.idVerificationStatus === 'verified' ? (
                    <ShieldCheck className="w-4 h-4 text-[#4FC3F7]" />
                  ) : targetUser.idVerificationStatus === 'pending' ? (
                    <Clock className="w-4 h-4 text-amber-500" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold block">
                    {isRtl ? 'حالة توثيق الهوية والحساب' : 'Identity & Account Verification'}
                  </span>
                  <span className={`text-xs font-black ${
                    targetUser.idVerificationStatus === 'verified'
                      ? 'text-[#4FC3F7]'
                      : targetUser.idVerificationStatus === 'pending'
                      ? 'text-amber-500'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}>
                    {targetUser.idVerificationStatus === 'verified'
                      ? (isRtl ? 'شريك معتمد وموثق 🛡️' : 'Certified & Verified Partner')
                      : targetUser.idVerificationStatus === 'pending'
                      ? (isRtl ? 'طلب التوثيق قيد المراجعة ⏳' : 'Verification Under Review')
                      : (isRtl ? 'حساب غير موثق بعد' : 'Unverified Account')}
                  </span>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                targetUser.idVerificationStatus === 'verified'
                  ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7]/30'
                  : targetUser.idVerificationStatus === 'pending'
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-200 dark:border-slate-600'
              }`}>
                {targetUser.idVerificationStatus === 'verified'
                  ? (isRtl ? 'موثق' : 'Verified')
                  : targetUser.idVerificationStatus === 'pending'
                  ? (isRtl ? 'قيد المراجعة' : 'Pending')
                  : (isRtl ? 'غير موثق' : 'Unverified')}
              </span>
            </div>
              {/* 1. معرّف الحساب (ID) - Exactly 12 symbols */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-gray-150 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl shrink-0">
                    <FileText className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold block">
                      {isRtl ? 'معرّف الحساب (ID)' : 'Account ID'}
                    </span>
                    <span className="font-mono text-xs font-black text-slate-800 select-all">
                      {formatDisplayId12(targetUser)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyIdWithFeedback(formatDisplayId12(targetUser))}
                  className="p-2 bg-white hover:bg-indigo-50 text-indigo-600 rounded-xl border border-gray-200 shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                  title={isRtl ? 'نسخ المعرّف' : 'Copy ID'}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'نسخ' : 'Copy'}</span>
                </button>
              </div>

              {/* 2. رقم الهاتف (Phone) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-gray-150 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-50 text-[#4FC3F7] rounded-xl shrink-0">
                    <Phone className="w-4 h-4 text-[#4FC3F7]" />
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-bold block">
                      {isRtl ? 'رقم الهاتف للاتصال' : 'Mobile Phone'}
                    </span>
                    {isSelf || hasActiveBooking ? (
                      <span className="font-mono text-xs font-black text-sky-600 select-all">
                        {targetUser.phone || (isRtl ? 'غير محدد' : 'Not set')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 italic flex items-center gap-1">
                        <Lock className="w-3 h-3 text-gray-400" />
                        {isRtl ? 'يظهر عند حجز مهمة رسمية' : 'Visible upon booking'}
                      </span>
                    )}
                  </div>
                </div>
                {(isSelf || hasActiveBooking) && targetUser.phone && targetUser.phone !== 'غير محدد' && (
                  <a
                    href={`tel:${targetUser.phone}`}
                    className="p-2 bg-white hover:bg-sky-50 text-[#4FC3F7] rounded-xl border border-gray-200 shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                    title={isRtl ? 'اتصال' : 'Call'}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'اتصال' : 'Call'}</span>
                  </a>
                )}
              </div>

              {/* 3. الموقع الجغرافي (Location) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-gray-150 flex items-center gap-2.5">
                <div className="p-2 bg-pink-50 text-[#FF3B7C] rounded-xl shrink-0">
                  <MapPin className="w-4 h-4 text-[#FF3B7C]" />
                </div>
                <div className="text-right flex-1 min-w-0">
                  <span className="text-[10px] text-gray-400 font-bold block">
                    {isRtl ? 'الموقع والولاية' : 'Location & City'}
                  </span>
                  <span className="text-xs font-black text-slate-800 block truncate">
                    {targetUser.city || (isRtl ? 'الجزائر' : 'Algeria')}
                  </span>
                </div>
              </div>

              {/* 4. تاريخ الانضمام (Joined date) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-gray-150 flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-right flex-1">
                  <span className="text-[10px] text-gray-400 font-bold block">
                    {isRtl ? 'تاريخ الانضمام إلى المنصة' : 'Member Since'}
                  </span>
                  <span className="text-xs font-black text-slate-800">
                    {formatJoinedDate(dbUser?.createdAt || (isSelf ? currentUser?.createdAt : undefined), lang)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowContactInfoModal(false)}
                className="w-full py-2.5 bg-[#1F2A44] hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-98"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Dedicated Reviews Modal Dialog (Triggered by clicking the Rating button) */}
  <AnimatePresence>
    {showReviewsModal && (
      <div 
        className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overscroll-contain select-none"
        style={{ touchAction: 'none' }}
        onClick={() => setShowReviewsModal(false)}
        onTouchMove={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-[#151F32] rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-150 dark:border-slate-800 overflow-hidden text-right overscroll-contain"
          style={{ direction: isRtl ? 'rtl' : 'ltr', touchAction: 'pan-y' }}
        >
          {/* Modal Header with User Score & Stars */}
          <div className="p-4 sm:p-5 border-b border-gray-150 flex items-center justify-between shrink-0 bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-500">
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black font-mono text-slate-800">
                    {(modalReviewRoleTab === 'hunter' ? dynamicWorkerRating : godfatherAverageRating).toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star 
                        key={s} 
                        className={`w-3.5 h-3.5 ${
                          s <= Math.round(modalReviewRoleTab === 'hunter' ? dynamicWorkerRating : godfatherAverageRating)
                            ? 'fill-amber-400 text-amber-400' 
                            : 'text-gray-300'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 font-bold">
                  {modalReviewRoleTab === 'hunter'
                    ? (isRtl ? `بناءً على ${reviewsReceived.length} تقييم كمنفذ مهام` : `Based on ${reviewsReceived.length} runner reviews`)
                    : (isRtl ? `بناءً على ${godfatherReviewsReceived.length} تقييم كصاحب عمل` : `Based on ${godfatherReviewsReceived.length} employer reviews`)
                  }
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowReviewsModal(false)}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-all cursor-pointer select-none active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Tabs inside Modal if user has reviews in both roles */}
          {(reviewsReceived.length > 0 || godfatherReviewsReceived.length > 0) && (
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 border border-gray-150">
                <button
                  type="button"
                  onClick={() => setModalReviewRoleTab('hunter')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none ${
                    modalReviewRoleTab === 'hunter'
                      ? 'bg-[#1F2A44] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isRtl ? 'تقييمات العمل' : 'As Worker'}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    modalReviewRoleTab === 'hunter' ? 'bg-[#FFD34D] text-[#1F2A44]' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {reviewsReceived.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalReviewRoleTab('godfather')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none ${
                    modalReviewRoleTab === 'godfather'
                      ? 'bg-[#1F2A44] text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isRtl ? 'تقييمات التوظيف' : 'As Employer'}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    modalReviewRoleTab === 'godfather' ? 'bg-[#FFD34D] text-[#1F2A44]' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {godfatherReviewsReceived.length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Reviews List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
            {modalReviewRoleTab === 'hunter' ? (
              reviewsReceived.length === 0 ? (
                <div className="text-xs text-center text-gray-400 py-12 bg-slate-50/60 border border-dashed border-gray-200 rounded-3xl font-semibold">
                  {isRtl 
                    ? 'لم يتلقى هذا العامل مراجعات بعد. شهادات العمل تضاف فور مطابقة الدفع!' 
                    : 'No worker reviews on this portfolio yet.'}
                </div>
              ) : (
                reviewsReceived.map((review) => (
                  <div 
                    key={review.reviewId}
                    className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs relative flex flex-col justify-between"
                  >
                    {review.completedTaskImage && (
                      <div className="h-28 w-full overflow-hidden relative bg-slate-50 cursor-pointer" onClick={() => setLightboxUrl(review.completedTaskImage)}>
                        <img 
                          src={review.completedTaskImage} 
                          alt="bounty proof"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
                        <div className="absolute bottom-2.5 left-2.5 bg-[#FFD34D] text-[#1F2A44] px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-0.5">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="w-2.5 h-2.5 fill-[#1F2A44] text-[#1F2A44]" />
                          ))}
                          <span className="ml-1 font-mono font-bold">{review.rating}.0</span>
                        </div>
                      </div>
                    )}

                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between text-right">
                      <p className="text-xs font-bold text-gray-600 italic">
                        “{review.comment}”
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1.5 flex-row-reverse">
                          <span className="font-extrabold text-[#1F2A44]">{review.godfatherName}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-sky-600 font-bold">{formatReviewDate(review.createdAt, lang)}</span>
                        </div>
                        <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 uppercase tracking-wider font-mono">
                          {isRtl ? 'صاحب العمل' : 'Employer'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              godfatherReviewsReceived.length === 0 ? (
                <div className="text-xs text-center text-gray-400 py-12 bg-slate-50/60 border border-dashed border-gray-200 rounded-3xl font-semibold">
                  {isRtl 
                    ? 'لم يتلقى صاحب العمل هذا مراجعات بعد.' 
                    : 'No reciprocal reviews recorded yet.'}
                </div>
              ) : (
                godfatherReviewsReceived.map((review) => (
                  <div 
                    key={review.reviewId}
                    className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-xs relative flex flex-col justify-between"
                  >
                    {review.completedTaskImage && (
                      <div className="h-28 w-full overflow-hidden relative bg-slate-50 cursor-pointer" onClick={() => setLightboxUrl(review.completedTaskImage)}>
                        <img 
                          src={review.completedTaskImage} 
                          alt="completed proof"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"></div>
                        <div className="absolute bottom-2.5 left-2.5 bg-amber-400 text-slate-900 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-0.5">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="w-2.5 h-2.5 fill-slate-900 text-slate-900" />
                          ))}
                          <span className="ml-1 font-mono font-bold">{review.rating}.0</span>
                        </div>
                      </div>
                    )}

                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between text-right">
                      <p className="text-xs font-bold text-gray-600 italic">
                        “{review.comment}”
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1.5 flex-row-reverse">
                          <span className="font-extrabold text-[#1F2A44]">{review.hunterName}</span>
                          <span className="text-gray-300">|</span>
                          <span className="text-sky-600 font-bold">{formatReviewDate(review.createdAt, lang)}</span>
                        </div>
                        <span className="text-[8px] bg-amber-50 text-amber-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                          {isRtl ? 'المنفذ' : 'Runner'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

 </div>
 );
}
