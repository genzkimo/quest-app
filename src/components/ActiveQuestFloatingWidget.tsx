import React, { useState, useRef } from 'react';
import { Quest, UserProfile } from '../types';

import { 
  MapPin, 
  Eye, 
  ListTodo, 
  Phone, 
  X, 
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Zap,
  User
} from 'lucide-react';

interface ActiveQuestFloatingWidgetProps {
  userProfile: UserProfile | null;
  quests: Quest[];
  lang?: 'ar' | 'fr' | 'en';
  onOpenQuestDetail: (questId: string) => void;
  onOpenChat: (quest: Quest) => void;
  onNavigateToMap: (quest: Quest) => void;
  onOpenMyQuests: (tab: 'obligations' | 'created') => void;
}

export default function ActiveQuestFloatingWidget({
  userProfile,
  quests,
  lang = 'ar',
  onOpenQuestDetail,
  onOpenChat,
  onNavigateToMap,
  onOpenMyQuests
}: ActiveQuestFloatingWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!userProfile) return null;

  // Filter all active reserved quests for current user (either as worker/runner or creator/godfather)
  const activeReservedQuests = quests.filter(q => {
    const isReservedStatus = ['booked', 'active', 'arrived', 'pending_verification'].includes(q.status);
    if (!isReservedStatus) return false;

    const isCreator = q.creatorId === userProfile.id;
    const isRunner = 
      q.helperId === userProfile.id || 
      q.assignedRunnerId === userProfile.id || 
      (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id));

    return isCreator || isRunner;
  });

  if (activeReservedQuests.length === 0) return null;

  const currentQuest = activeReservedQuests[currentIndex] || activeReservedQuests[0];
  const isCreator = currentQuest ? currentQuest.creatorId === userProfile.id : false;
  const isRunner = !isCreator;

  // Counterpart information
  const counterpartName = isCreator 
    ? (currentQuest.helperName || 'الكابتن المنفذ') 
    : (currentQuest.creatorName || 'صاحب العمل');
  const counterpartPhone = isCreator ? currentQuest.helperPhone : currentQuest.creatorPhone;

  // Status labels in Arabic/English
  const getStatusBadge = (status: Quest['status']) => {
    switch (status) {
      case 'booked':
      case 'active':
        return {
          label: lang === 'ar' ? 'قيد التنفيذ النشط' : 'In Progress',
          bg: 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
        };
      case 'arrived':
        return {
          label: lang === 'ar' ? 'وصل للموقع' : 'Arrived at Site',
          bg: 'bg-sky-100 dark:bg-sky-500/20 text-sky-900 dark:text-sky-500 border-sky-300 dark:border-sky-500/40'
        };
      case 'pending_verification':
        return {
          label: lang === 'ar' ? 'في انتظار التوثيق' : 'Awaiting Review',
          bg: 'bg-sky-100 dark:bg-cyan-500/20 text-sky-900 dark:text-cyan-300 border-sky-300 dark:border-cyan-500/40'
        };
      default:
        return {
          label: lang === 'ar' ? 'محجوزة' : 'Booked',
          bg: 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-500/40'
        };
    }
  };

  const statusBadge = currentQuest ? getStatusBadge(currentQuest.status) : null;

  return (
    <>
      {/* Floating Trigger Button without heavy spring animations */}
      <div 
        className="fixed bottom-24 right-4 z-[100000] font-sans pointer-events-auto"
        style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative flex items-center justify-center w-12 h-12 bg-[#FF3B7C] text-white rounded-full shadow-lg shadow-[#FF3B7C]/40 cursor-pointer hover:bg-[#e02d6b] transition-all"
          title={lang === 'ar' ? 'المهمة المحجوزة النشطة' : 'Active Reserved Task'}
        >
          <Zap className="w-6 h-6 text-white fill-white shrink-0" />

          {activeReservedQuests.length > 1 && (
            <span className="absolute -top-1 -right-1 bg-white text-[#FF3B7C] font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#FF3B7C] shadow-md">
              {activeReservedQuests.length}
            </span>
          )}
        </button>
      </div>

      {/* Interactive Essential Options Modal */}
      {isOpen && currentQuest && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[100001] font-sans">
          <div
            className="bg-white dark:bg-[#0A1128] text-slate-900 dark:text-white border-2 border-[#FF3B7C] rounded-[2.2rem] p-6 max-w-md w-full shadow-2xl relative overflow-hidden text-right space-y-5"
            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
          >
            {/* Top Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF3B7C] via-[#FFD34D] to-[#4FC3F7] p-0.5 text-[#1F2A44] flex items-center justify-center font-black text-xl shadow-md">
                  <div className="w-full h-full bg-white dark:bg-[#0A1128] rounded-2xl flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#FF3B7C]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                    {lang === 'ar' ? 'المهمة المحجوزة الحالية' : 'Active Reserved Task'}
                  </h3>
                  <p className="text-[11px] text-[#FF3B7C] dark:text-[#FFD34D] font-black">
                    {isRunner 
                      ? (lang === 'ar' ? 'أنت المنفذ' : 'You are the Worker')
                      : (lang === 'ar' ? 'أنت صاحب العمل' : 'You are the Employer')
                    }
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer select-none border border-slate-200 dark:border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Multiple Quests Navigation Bar if count > 1 */}
            {activeReservedQuests.length > 1 && (
              <div className="flex items-center justify-between bg-slate-100 dark:bg-[#162035] p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-300 font-bold">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-900 dark:text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span>
                  {lang === 'ar' ? `المهمة ${currentIndex + 1} من ${activeReservedQuests.length}` : `Task ${currentIndex + 1} of ${activeReservedQuests.length}`}
                </span>
                <button
                  type="button"
                  disabled={currentIndex === activeReservedQuests.length - 1}
                  onClick={() => setCurrentIndex(prev => Math.min(activeReservedQuests.length - 1, prev + 1))}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-900 dark:text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quest Overview Box */}
            <div className="bg-slate-50 dark:bg-[#162035] border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${statusBadge?.bg}`}>
                  {statusBadge?.label}
                </span>
                <span className="text-xs font-black text-amber-900 dark:text-[#FFD34D] bg-amber-50 dark:bg-transparent px-2.5 py-1 rounded-lg border border-amber-200 dark:border-none">
                  {currentQuest.cashReward} {lang === 'ar' ? 'د.ج' : 'DA'}
                </span>
              </div>

              <div>
                <h4 className="text-base font-black text-sky-500 dark:text-sky-400 leading-snug">
                  {currentQuest.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                  {currentQuest.description}
                </p>

                {/* Quest Images if present */}
                {(() => {
                  const questImages: string[] = [];
                  if (currentQuest.images && Array.isArray(currentQuest.images)) {
                    questImages.push(...currentQuest.images.filter(Boolean));
                  }
                  if (currentQuest.imageUrls && Array.isArray(currentQuest.imageUrls)) {
                    currentQuest.imageUrls.filter(Boolean).forEach(img => {
                      if (!questImages.includes(img)) questImages.push(img);
                    });
                  }
                  if (currentQuest.imageUrl && typeof currentQuest.imageUrl === 'string' && currentQuest.imageUrl.trim() !== '') {
                    if (!questImages.includes(currentQuest.imageUrl)) questImages.push(currentQuest.imageUrl);
                  }
                  const proofImgWidget = (currentQuest as any).proofImage || currentQuest.proofImageUrl;
                  if (proofImgWidget && typeof proofImgWidget === 'string' && !questImages.includes(proofImgWidget)) {
                    questImages.push(proofImgWidget);
                  }

                  if (questImages.length === 0) return null;

                  return (
                    <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1">
                      {questImages.map((imgUrl, idx) => (
                        <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
                          <img src={imgUrl} alt={`Quest asset ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Counterpart profile row */}
              <div className="flex flex-col gap-2.5 bg-white dark:bg-[#1F2A44] p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 mt-2 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-black text-sm border border-slate-200 dark:border-slate-600 shrink-0">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold block">
                      {isCreator 
                        ? (lang === 'ar' ? 'الكابتن المنفذ:' : 'Assigned Worker:') 
                        : (lang === 'ar' ? 'صاحب المهمة:' : 'Task Owner:')}
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      {counterpartName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenChat(currentQuest);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white rounded-xl text-xs font-black transition-colors shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span>{lang === 'ar' ? 'دردشة' : 'Chat'}</span>
                  </button>

                  {counterpartPhone && (
                    <a
                      href={`tel:${counterpartPhone}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition-colors shadow-2xs text-center"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'ar' ? 'اتصال' : 'Call'}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Quick Action Buttons Row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                {/* 1. Details */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenQuestDetail(currentQuest.id);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
                  <span>{lang === 'ar' ? 'التفاصيل' : 'Details'}</span>
                </button>

                {/* 2. Live Map / Navigation */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToMap(currentQuest);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl text-xs font-black border border-sky-200 dark:border-sky-800 transition-all cursor-pointer whitespace-nowrap"
                >
                  {isCreator ? <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" /> : <Navigation className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                  <span>{isCreator ? (lang === 'ar' ? 'الخريطة' : 'Map') : (lang === 'ar' ? 'الملاحة' : 'Navigate')}</span>
                </button>

                {/* 3. Manage */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenMyQuests(isCreator ? 'created' : 'obligations');
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-black border border-rose-200 dark:border-rose-800 transition-all cursor-pointer whitespace-nowrap"
                >
                  <ListTodo className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{lang === 'ar' ? 'إدارة' : 'Manage'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
