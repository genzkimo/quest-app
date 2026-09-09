import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { Quest, UserProfile } from '../types';
import UnifiedQuestCard from './UnifiedQuestCard';

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

 if (!quest) {
 return (
 <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 font-sans">
 <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
 <Search className="w-8 h-8 text-slate-400" />
 </div>
 <h3 className="text-xl font-black text-slate-800">
 {isRTL ? 'المهمة غير موجودة' : 'Quest Not Found'}
 </h3>
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
      className="w-full max-w-lg mx-auto font-sans pb-32"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
 {/* Top Breadcrumb Navigation Header */}
 <div className="flex items-center justify-between mb-4 px-2">
 <button
 onClick={onBack}
 className="flex items-center gap-1.5 text-xs font-black text-[#1F2A44] hover:text-[#1F2A44]/80 py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 rounded-full transition-all active:scale-95 cursor-pointer shadow-xs"
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
 
 <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
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
