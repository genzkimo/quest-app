import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Quest, UserProfile } from '../types';
import { 
  MapPin, 
  Phone, 
  X, 
  MessageSquare,
  Navigation,
  Zap,
  User,
  ChevronLeft,
  ChevronRight,
  ExternalLink
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

  const boundaryRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);

  if (!userProfile) return null;

  // Filter all active reserved quests for current user
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

  const counterpartName = isCreator 
    ? (currentQuest.helperName || (lang === 'ar' ? 'العامل' : 'Assigned Worker')) 
    : (currentQuest.creatorName || (lang === 'ar' ? 'صاحب العمل' : 'Task Owner'));
  const counterpartPhone = isCreator ? currentQuest.helperPhone : currentQuest.creatorPhone;

  // Status badge
  const getStatusBadge = (status: Quest['status']) => {
    switch (status) {
      case 'booked':
      case 'active':
        return {
          label: lang === 'ar' ? 'قيد التنفيذ' : 'In Progress',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
        };
      case 'arrived':
        return {
          label: lang === 'ar' ? 'وصل للموقع' : 'Arrived',
          color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800'
        };
      case 'pending_verification':
        return {
          label: lang === 'ar' ? 'بانتظار التوثيق' : 'Reviewing',
          color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800'
        };
      default:
        return {
          label: lang === 'ar' ? 'محجوزة' : 'Booked',
          color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
        };
    }
  };

  const statusBadge = currentQuest ? getStatusBadge(currentQuest.status) : null;

  const handleBubbleDragStart = () => {
    isDraggingRef.current = false;
    dragStartTimeRef.current = Date.now();
  };

  const handleBubbleDrag = () => {
    isDraggingRef.current = true;
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current && Date.now() - dragStartTimeRef.current > 150) {
      isDraggingRef.current = false;
      return;
    }
    isDraggingRef.current = false;
    setIsOpen(true);
  };

  return (
    <>
      {/* Viewport boundary */}
      <div 
        ref={boundaryRef} 
        className="fixed inset-0 pointer-events-none z-[99990] overflow-hidden"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          paddingLeft: '16px',
          paddingRight: '16px'
        }}
      />

      {/* 1. Floating Bubble */}
      {!isOpen && (
        <motion.div
          drag
          dragConstraints={boundaryRef}
          dragMomentum={false}
          dragElastic={0.12}
          onDragStart={handleBubbleDragStart}
          onDrag={handleBubbleDrag}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-[99995] font-sans pointer-events-auto cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
        >
          <div
            onClick={handleBubbleClick}
            className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-[#FF3B7C] via-[#e02d6b] to-[#FF3B7C] text-white rounded-full shadow-xl shadow-[#FF3B7C]/40 hover:shadow-[#FF3B7C]/60 ring-2 ring-white/40 dark:ring-white/20 transition-all duration-200 active:scale-95 group"
            title={lang === 'ar' ? 'المهمة المحجوزة النشطة (اسحب للتحريك)' : 'Active Reserved Task (Drag to move)'}
          >
            <span className="absolute -inset-1 rounded-full bg-[#FF3B7C] opacity-35 animate-ping pointer-events-none" />
            <Zap className="w-5 h-5 text-white fill-white shrink-0 drop-shadow-md group-hover:scale-110 transition-transform" />

            {activeReservedQuests.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-white dark:bg-slate-900 text-[#FF3B7C] font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#FF3B7C] shadow-md pointer-events-none">
                {activeReservedQuests.length}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* 2. Streamlined Floating Window (Flat, Zero-Nesting, Clear Primary Action) */}
      <AnimatePresence>
        {isOpen && currentQuest && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-[99998] font-sans">
            <motion.div
              drag
              dragConstraints={boundaryRef}
              dragMomentum={false}
              dragElastic={0.12}
              initial={{ scale: 0.94, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-[330px] w-full shadow-2xl p-4 space-y-3 pointer-events-auto select-none"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
            >
              {/* Top Header: Clean, balanced, no nested topbars */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1 text-start">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${statusBadge?.color}`}>
                      {statusBadge?.label}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">
                      {isRunner 
                        ? (lang === 'ar' ? 'أنت العامل' : 'You are Worker') 
                        : (lang === 'ar' ? 'أنت صاحب العمل' : 'You are Employer')}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                    {currentQuest.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs sm:text-sm font-black text-[#FF3B7C] font-mono bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 px-2 py-1 rounded-xl">
                    {currentQuest.cashReward} DA
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                    title={lang === 'ar' ? 'إغلاق' : 'Close'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Multiple Quests Navigation Bar if count > 1 */}
              {activeReservedQuests.length > 1 && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
                    {lang === 'ar' ? `المهمة ${currentIndex + 1} من ${activeReservedQuests.length}` : `Task ${currentIndex + 1} of ${activeReservedQuests.length}`}
                  </span>
                  <button
                    type="button"
                    disabled={currentIndex === activeReservedQuests.length - 1}
                    onClick={() => setCurrentIndex(prev => Math.min(activeReservedQuests.length - 1, prev + 1))}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-900 dark:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Counterpart Inline Row: Clean, flat, unified */}
              <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center gap-2 min-w-0 flex-1 text-start">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs shrink-0 border border-slate-300 dark:border-slate-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold block truncate">
                      {isCreator ? (lang === 'ar' ? 'العامل' : 'Worker') : (lang === 'ar' ? 'صاحب العمل' : 'Employer')}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {counterpartName}
                    </h4>
                  </div>
                </div>

                {/* Compact Quick Action Icons: Map Location (Bright Yellow #FFD34D), Chat (Pink #FF3B7C), Call (App Blue #1F2A44) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Map Location Button (Bright Yellow) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigateToMap(currentQuest);
                    }}
                    className="w-8 h-8 rounded-xl bg-[#FFD34D] hover:bg-[#FFD34D]/90 text-[#1F2A44] flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer"
                    title={lang === 'ar' ? 'عرض الموقع على الخريطة' : 'View Location on Map'}
                  >
                    <MapPin className="w-4 h-4" />
                  </button>

                  {/* Chat Button (Pink) */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenChat(currentQuest);
                    }}
                    className="w-8 h-8 rounded-xl bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white flex items-center justify-center shadow-xs transition-transform active:scale-90 cursor-pointer"
                    title={lang === 'ar' ? 'مراسلة' : 'Chat'}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Call Button (App Blue #1F2A44) */}
                  {counterpartPhone ? (
                    <a
                      href={`tel:${counterpartPhone}`}
                      className="w-8 h-8 rounded-xl bg-[#1F2A44] hover:bg-[#1F2A44]/90 text-white flex items-center justify-center shadow-xs transition-transform active:scale-90"
                      title={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons: 1 CLEAR PRIMARY ACTION + 1 Subtitle secondary action */}
              <div className="space-y-2 pt-1">
                {/* CLEAR PRIMARY BUTTON */}
                {isRunner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onNavigateToMap(currentQuest);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Navigation className="w-4 h-4 text-white" />
                    <span>{lang === 'ar' ? 'فتح الملاحة والخريطة 📍' : 'Start Navigation 📍'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenQuestDetail(currentQuest.id);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-[#FF3B7C] to-[#e02d6b] hover:opacity-95 text-white font-black text-xs rounded-xl shadow-md shadow-[#FF3B7C]/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <ExternalLink className="w-4 h-4 text-white" />
                    <span>{lang === 'ar' ? 'متابعة تفاصيل المهمة 📋' : 'View Task Details 📋'}</span>
                  </button>
                )}

                {/* Subdued Secondary Action Link */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenMyQuests(isCreator ? 'created' : 'obligations');
                  }}
                  className="w-full py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer text-center"
                >
                  {lang === 'ar' ? 'إدارة في قائمة مهامي وعقودي' : 'Manage in My Quests'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
