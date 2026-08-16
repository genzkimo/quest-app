import React, { useState, useRef } from 'react';
import { Quest, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  MessageSquare, 
  Eye, 
  ListTodo, 
  Phone, 
  X, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Navigation
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
  const dragContainerRef = useRef<HTMLDivElement>(null);

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
          label: lang === 'ar' ? 'قيد التنفيذ النشط ⏱️' : 'In Progress ⏱️',
          bg: 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
        };
      case 'arrived':
        return {
          label: lang === 'ar' ? 'وصل للموقع 📍' : 'Arrived at Site 📍',
          bg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
        };
      case 'pending_verification':
        return {
          label: lang === 'ar' ? 'في انتظار التوثيق ⏳' : 'Awaiting Review ⏳',
          bg: 'bg-sky-100 dark:bg-cyan-500/20 text-sky-900 dark:text-cyan-300 border-sky-300 dark:border-cyan-500/40'
        };
      default:
        return {
          label: lang === 'ar' ? 'محجوزة 🔒' : 'Booked 🔒',
          bg: 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-500/40'
        };
    }
  };

  const statusBadge = currentQuest ? getStatusBadge(currentQuest.status) : null;

  return (
    <>
      {/* Screen constraint container preventing dragging off-screen */}
      <div ref={dragContainerRef} className="fixed inset-0 pointer-events-none z-[100000] overflow-hidden" />

      {/* 🚀 Smart Draggable Floating Trigger Button */}
      <motion.div 
        drag
        dragConstraints={dragContainerRef}
        dragMomentum={false}
        dragElastic={0}
        className="fixed bottom-24 right-4 z-[100000] font-sans touch-none select-none pointer-events-auto"
        style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
      >
        <motion.button
          onClick={() => setIsOpen(true)}
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative flex items-center justify-center gap-1.5 p-2.5 bg-white dark:bg-[#0A1128] hover:bg-slate-50 dark:hover:bg-[#162035] text-slate-900 dark:text-white border-2 border-[#FF3B7C] rounded-full shadow-2xl shadow-[#FF3B7C]/25 cursor-grab active:cursor-grabbing overflow-visible group transition-all duration-200"
          title={lang === 'ar' ? 'المهمة المحجوزة النشطة' : 'Active Reserved Task'}
        >
          {/* Pulsating Ping Aura */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B7C] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF3B7C] border-2 border-white dark:border-[#0A1128]"></span>
          </span>

          <div className="w-7.5 h-7.5 rounded-full bg-gradient-to-tr from-[#FF3B7C] via-[#FFD34D] to-[#4FC3F7] p-0.5 shrink-0 shadow-md">
            <div className="w-full h-full bg-white dark:bg-[#0A1128] rounded-full flex items-center justify-center text-xs font-black">
              ⚡
            </div>
          </div>

          {activeReservedQuests.length > 1 && (
            <span className="bg-[#FF3B7C] text-white font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-sm ml-0.5">
              {activeReservedQuests.length}
            </span>
          )}
        </motion.button>
      </motion.div>

      {/* 🔮 Interactive Essential Options Modal */}
      <AnimatePresence>
        {isOpen && currentQuest && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[100001] font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-[#0A1128] text-slate-900 dark:text-white border-2 border-[#FF3B7C] rounded-[2.2rem] p-6 max-w-md w-full shadow-2xl relative overflow-hidden text-right space-y-5"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              {/* Top Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF3B7C] via-[#FFD34D] to-[#4FC3F7] p-0.5 text-[#1F2A44] flex items-center justify-center font-black text-xl shadow-md">
                    <div className="w-full h-full bg-white dark:bg-[#0A1128] rounded-2xl flex items-center justify-center">
                      📌
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      {lang === 'ar' ? 'المهمة المحجوزة الحالية' : 'Active Reserved Task'}
                    </h3>
                    <p className="text-[11px] text-[#FF3B7C] dark:text-[#FFD34D] font-black">
                      {isRunner 
                        ? (lang === 'ar' ? 'أنت المنفذ (الكابتن 🏃)' : 'You are the Worker 🏃')
                        : (lang === 'ar' ? 'أنت صاحب العمل 💼' : 'You are the Employer 💼')
                      }
                    </p>
                  </div>
                </div>

                <button
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
                    💰 {currentQuest.cashReward} {lang === 'ar' ? 'د.ج' : 'DA'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                    {currentQuest.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                    {currentQuest.description}
                  </p>
                </div>

                {/* Counterpart profile row */}
                <div className="flex items-center justify-between bg-white dark:bg-[#1F2A44] p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 mt-2 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-black text-sm border border-slate-200 dark:border-slate-600">
                      {isCreator ? '🏃' : '👤'}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold block">
                        {isCreator 
                          ? (lang === 'ar' ? 'الكابتن المنفذ:' : 'Assigned Worker:') 
                          : (lang === 'ar' ? 'صاحب المهمة:' : 'Task Owner:')}
                      </span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {counterpartName}
                      </span>
                    </div>
                  </div>

                  {counterpartPhone && (
                    <a
                      href={`tel:${counterpartPhone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors shadow-2xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'اتصال' : 'Call'}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* 🎯 Essential Primary Options Grid (الخيارات الأساسية) */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                  {lang === 'ar' ? '⚡ الخيارات الأساسية السريعة:' : '⚡ Essential Quick Actions:'}
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* 1. View Full Details */}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenQuestDetail(currentQuest.id);
                    }}
                    className="flex items-center justify-center gap-2 p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/90 text-slate-900 dark:text-white rounded-2xl text-xs font-black border border-slate-200 dark:border-slate-700 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#FF3B7C] dark:text-[#FFD34D]" />
                    <span>{lang === 'ar' ? 'التفاصيل الكاملة' : 'Full Details'}</span>
                  </button>

                  {/* 2. Direct Chat */}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenChat(currentQuest);
                    }}
                    className="flex items-center justify-center gap-2 p-3 bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white rounded-2xl text-xs font-black shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 fill-white text-white" />
                    <span>{lang === 'ar' ? 'المحادثة المباشرة' : 'Direct Chat'}</span>
                  </button>

                  {/* 3. Live Map */}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onNavigateToMap(currentQuest);
                    }}
                    className="flex items-center justify-center gap-2 p-3 bg-sky-100 hover:bg-sky-200 dark:bg-cyan-600/30 dark:hover:bg-cyan-600/40 text-sky-900 dark:text-cyan-200 border border-sky-300 dark:border-cyan-500/40 rounded-2xl text-xs font-black transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {isCreator ? <MapPin className="w-4 h-4 text-sky-600 dark:text-cyan-300" /> : <Navigation className="w-4 h-4 text-sky-600 dark:text-cyan-300" />}
                    <span>{isCreator ? (lang === 'ar' ? 'الخريطة المباشرة' : 'Live Map') : (lang === 'ar' ? 'الخريطة والتتبع' : 'Live Map & Navigation')}</span>
                  </button>

                  {/* 4. Manage in My Quests */}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenMyQuests(isCreator ? 'created' : 'obligations');
                    }}
                    className="flex items-center justify-center gap-2 p-3 bg-purple-100 hover:bg-purple-200 dark:bg-purple-600/30 dark:hover:bg-purple-600/40 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-500/40 rounded-2xl text-xs font-black transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <ListTodo className="w-4 h-4 text-purple-600 dark:text-purple-300" />
                    <span>{lang === 'ar' ? 'إدارة في مهامي' : 'My Quests Tab'}</span>
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

