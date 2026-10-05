import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Search, Clock } from 'lucide-react';
import { Quest, UserProfile } from '../types';
import UnifiedQuestCard from './UnifiedQuestCard';
import { isQuestExpired } from '../utils/questExpiry';

interface QuestDetailScreenProps {
 questId: string;
 quests: Quest[];
 userProfile: UserProfile;
 userLoc?: { lat: number; lng: number } | null;
 onBack: () => void;
 onBookQuest: (questId: string, tokenFee: number) => void;
 onStartNavigation: (quest: Quest) => void;
 onOpenChat: (chatParams: any) => void;
 onManageQuest?: (questId: string) => void;
 onViewPublicProfile?: (userId: string) => void;
 onExtendPendingQuest?: (questId: string) => void;
 onExtendActiveContract?: (questId: string) => void;
 onRequestEndWork?: (questId: string, reason?: string) => void;
 onConfirmEndWork?: (questId: string) => void;
 onRejectEndWork?: (questId: string) => void;
 showToast?: (msg: string) => void;
}

export default function QuestDetailScreen({
 questId,
 quests,
 userProfile,
 userLoc,
 onBack,
 onBookQuest,
 onStartNavigation,
 onOpenChat,
 onManageQuest,
 onViewPublicProfile,
 onExtendPendingQuest,
 onExtendActiveContract,
 onRequestEndWork,
 onConfirmEndWork,
 onRejectEndWork,
 showToast
}: QuestDetailScreenProps) {
 const quest = quests.find((q) => q.id === questId);
 const lang = userProfile.language;
 const isRTL = lang === 'ar';

 if (!quest || (isQuestExpired(quest) && quest.status !== 'completed' && quest.status !== 'terminated')) {
 return (
 <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 font-sans px-4">
 <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center border border-amber-200">
 <Clock className="w-8 h-8" />
 </div>
 <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
 {isRTL ? 'انتهت صلاحية هذه المهمة' : 'This Quest Has Expired'}
 </h3>
 <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
 {isRTL 
   ? 'تم سحب هذه المهمة تلقائياً من المنصة لتجاوزها مهلة النشر (8 ساعات) دون حجز.'
   : 'This quest was automatically withdrawn after reaching the 8-hour publication timeout.'}
 </p>
 <button
 onClick={onBack}
 className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-md"
 >
 {isRTL ? 'الرجوع للخلف' : 'Go Back'}
 </button>
 </div>
 );
 }

  return (
    <div
      className="w-full max-w-lg mx-auto font-sans pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-32"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
 {/* Top Breadcrumb Navigation Header */}
 <div className="flex items-center justify-between mb-4 px-2">
 <button
 onClick={onBack}
 className="flex items-center gap-1.5 text-xs font-black text-[#1F2A44] dark:text-slate-100 hover:text-[#1F2A44]/80 py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-full transition-all active:scale-95 cursor-pointer shadow-xs border border-slate-200/60 dark:border-slate-700/80"
 >
 {isRTL ? (
 <>
 <ArrowRight className="w-4 h-4" />
 <span>رجوع للخلف</span>
 </>
 ) : (
 <>
 <ArrowLeft className="w-4 h-4" />
 <span>Go Back</span>
 </>
 )}
 </button>
 
 <span className="text-[10px] font-black font-mono text-slate-400 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-100 dark:border-slate-700">
 {isRTL ? 'تفاصيل الكويست' : 'Quest details'}
 </span>
 </div>

 {/* Standalone card rendering without dialog backdrop */}
 <div className="w-full relative">
 <UnifiedQuestCard
 quest={quest}
 userProfile={userProfile}
 userLoc={userLoc}
 lang={lang}
 isModal={false}
 onClose={onBack}
 onBookQuest={(qId, tokenFee) => {
 onBookQuest(qId, tokenFee);
 }}
 onStartNavigation={(q) => {
 onStartNavigation(q);
 }}
 onOpenChat={(chatParams) => {
 onOpenChat(chatParams);
 }}
 onManageQuest={onManageQuest}
 onViewPublicProfile={onViewPublicProfile}
 onExtendPendingQuest={onExtendPendingQuest}
 onExtendActiveContract={onExtendActiveContract}
 onRequestEndWork={onRequestEndWork}
 onConfirmEndWork={onConfirmEndWork}
 onRejectEndWork={onRejectEndWork}
 showToast={showToast}
 />
 </div>
 </div>
 );
}
