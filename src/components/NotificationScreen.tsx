import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  Trash2, 
  UserPlus, 
  MapPin, 
  PartyPopper, 
  AlertTriangle, 
  MessageSquareCode,
  Compass,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { db } from '../utils/firebase';
import { doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { NotificationDoc } from '../types';

export type { NotificationDoc };

interface NotificationScreenProps {
  notifications: NotificationDoc[];
  onClose: () => void;
  lang?: 'ar' | 'fr' | 'en';
  onViewQuest?: (questId: string) => void;
  onNotificationClick?: (notif: NotificationDoc) => void;
}

type TabFilter = 'all' | 'nearby' | 'status' | 'deadlines';

export default function NotificationScreen({
  notifications,
  onClose,
  lang = 'ar',
  onViewQuest,
  onNotificationClick
}: NotificationScreenProps) {
  const isRtl = lang === 'ar';
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((notif) => {
        if (!notif.read) {
          const ref = doc(db, 'notifications', notif.id);
          batch.update(ref, { read: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error marking all read:", e);
    }
  };

  const handleMarkSingleRead = async (id: string, currentRead: boolean) => {
    if (currentRead) return;
    try {
      const ref = doc(db, 'notifications', id);
      await updateDoc(ref, { read: true });
    } catch (e) {
      console.error("Error marking read:", e);
    }
  };

  const handleDeleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const ref = doc(db, 'notifications', id);
      await deleteDoc(ref);
    } catch (e) {
      console.error("Error deleting notification:", e);
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'nearby_quest':
        return {
          label: isRtl ? 'مهمة قريبة' : 'Nearby Quest',
          bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        };
      case 'status_update':
        return {
          label: isRtl ? 'تحديث حالة' : 'Status Update',
          bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20'
        };
      case 'deadline_reminder':
        return {
          label: isRtl ? 'تذكير موعد' : 'Deadline Alert',
          bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
        };
      case 'arrival':
        return {
          label: isRtl ? 'وصول ميداني' : 'Arrival',
          bg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20'
        };
      case 'approved':
        return {
          label: isRtl ? 'قبول طلب' : 'Approved',
          bg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20'
        };
      case 'applicant':
        return {
          label: isRtl ? 'طلب جديد' : 'New Applicant',
          bg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
        };
      default:
        return null;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'nearby_quest':
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/50 shadow-xs">
            <Compass className="w-5 h-5 text-emerald-500 animate-pulse" />
          </div>
        );
      case 'status_update':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-800/50 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
          </div>
        );
      case 'deadline_reminder':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/50 shadow-xs">
            <Clock className="w-5 h-5 text-amber-500 animate-bounce" />
          </div>
        );
      case 'applicant':
        return (
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0 border border-indigo-200/50 dark:border-indigo-800/50">
            <UserPlus className="w-5 h-5 text-indigo-500" />
          </div>
        );
      case 'arrival':
        return (
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center shrink-0 border border-sky-200/50 dark:border-sky-800/50">
            <MapPin className="w-5 h-5 text-sky-500 animate-bounce" />
          </div>
        );
      case 'approved':
        return (
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center shrink-0 border border-purple-200/50 dark:border-purple-800/50">
            <PartyPopper className="w-5 h-5 text-purple-500" />
          </div>
        );
      case 'dismissed':
        return (
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0 border border-rose-200/50 dark:border-rose-800/50">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
        );
      case 'message':
        return (
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 flex items-center justify-center shrink-0 border border-cyan-200/50 dark:border-cyan-800/50">
            <MessageSquareCode className="w-5 h-5 text-cyan-500" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
            <Bell className="w-5 h-5 text-slate-400" />
          </div>
        );
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = Date.now();
      const diffMs = now - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      if (diffMins < 1) {
        return isRtl ? 'الآن' : 'just now';
      }
      if (diffMins < 60) {
        return isRtl ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
      }
      if (diffHours < 24) {
        return isRtl ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      }
      return date.toLocaleTimeString(isRtl ? 'ar-DZ' : 'fr-DZ', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Filtered items based on active tab
  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'nearby') return notif.type === 'nearby_quest';
    if (activeTab === 'status') {
      return ['status_update', 'approved', 'arrival', 'dismissed'].includes(notif.type);
    }
    if (activeTab === 'deadlines') return notif.type === 'deadline_reminder';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const nearbyCount = notifications.filter((n) => n.type === 'nearby_quest' && !n.read).length;
  const statusCount = notifications.filter((n) => ['status_update', 'approved', 'arrival'].includes(n.type) && !n.read).length;
  const deadlineCount = notifications.filter((n) => n.type === 'deadline_reminder' && !n.read).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex justify-end overflow-hidden"
    >
      {/* Crisp dark backdrop */}
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />

      <motion.div
        initial={{ x: isRtl ? -380 : 380 }}
        animate={{ x: 0 }}
        exit={{ x: isRtl ? -380 : 380 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-white dark:bg-[#151F32] w-full max-w-md h-full shadow-2xl flex flex-col z-10 border-l border-slate-100 dark:border-slate-800 font-sans"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        {/* Header */}
        <div className="px-5 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+1rem))] pb-4 bg-[#1F2A44] dark:bg-[#0B1120] text-white flex justify-between items-center border-b border-slate-700/50 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bell className="w-5 h-5 text-[#FFD34D]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <h2 className="text-base font-black">
                {isRtl ? 'مركز الإشعارات المباشرة' : 'Live Notifications'}
              </h2>
              <p className="text-[10px] text-slate-300 font-medium">
                {isRtl ? 'تنبيهات المهام القريبة، الحالات، والمواعيد' : 'Nearby quests, status changes & deadlines'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="px-4 py-2.5 bg-slate-100/90 dark:bg-[#0E1626] border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            <span>{isRtl ? 'الكل' : 'All'}</span>
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                activeTab === 'all' ? 'bg-white/25 text-white' : 'bg-blue-500 text-white'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('nearby')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'nearby'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isRtl ? 'مهام قريبة' : 'Nearby'}</span>
            {nearbyCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                activeTab === 'nearby' ? 'bg-white/25 text-white' : 'bg-emerald-500 text-white'
              }`}>
                {nearbyCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'status'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'حالة المهام' : 'Status'}</span>
            {statusCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                activeTab === 'status' ? 'bg-white/25 text-white' : 'bg-blue-500 text-white'
              }`}>
                {statusCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('deadlines')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'deadlines'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isRtl ? 'المواعيد' : 'Deadlines'}</span>
            {deadlineCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                activeTab === 'deadlines' ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'
              }`}>
                {deadlineCount}
              </span>
            )}
          </button>
        </div>

        {/* Toolbar */}
        {notifications.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-[#0F172A] border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <span>
              {isRtl 
                ? `${filteredNotifications.length} إشعار (${unreadCount} غير مقروء)` 
                : `${filteredNotifications.length} notifications (${unreadCount} unread)`}
            </span>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="font-extrabold text-blue-600 dark:text-sky-400 hover:text-blue-800 dark:hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
              >
                <CheckCheck className="w-4 h-4" />
                <span>{isRtl ? 'قراءة الكل' : 'Mark all read'}</span>
              </button>
            )}
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-[#0B1120]">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                {activeTab === 'nearby' ? (
                  <Compass className="w-8 h-8 text-emerald-400" />
                ) : activeTab === 'deadlines' ? (
                  <Clock className="w-8 h-8 text-amber-400" />
                ) : activeTab === 'status' ? (
                  <CheckCircle2 className="w-8 h-8 text-blue-400" />
                ) : (
                  <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {activeTab === 'nearby'
                  ? (isRtl ? 'لا توجد مهام قريبة جديدة حالياً' : 'No new nearby quests yet')
                  : activeTab === 'deadlines'
                  ? (isRtl ? 'لا توجد تنبيهات مواعيد نهائية حالياً' : 'No deadline alerts right now')
                  : activeTab === 'status'
                  ? (isRtl ? 'لا توجد تحديثات في حالة المهام' : 'No quest status updates yet')
                  : (isRtl ? 'لا توجد إشعارات حالياً' : 'No notifications yet')}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                {isRtl 
                  ? 'ستتلقى إشعارات فورية عند نشر مهام تناسب اهتماماتك أو عند تحديثات كويستاتك النشطة ومواعيدها.' 
                  : 'You will receive instant alerts for quests matching your interests, status changes, and deadlines.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const badge = getNotificationBadge(notif.type);
              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    handleMarkSingleRead(notif.id, notif.read);
                    if (onNotificationClick) {
                      onNotificationClick(notif);
                    } else if (onViewQuest && notif.questId) {
                      onViewQuest(notif.questId);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex gap-3 group active:scale-[0.99] ${
                    notif.read 
                      ? 'bg-white dark:bg-[#151F32] border-slate-150 dark:border-slate-800 opacity-80 hover:opacity-100 shadow-xs' 
                      : notif.type === 'nearby_quest'
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300/60 dark:border-emerald-800/50 shadow-xs ring-1 ring-emerald-500/10'
                      : notif.type === 'deadline_reminder'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300/60 dark:border-amber-800/50 shadow-xs ring-1 ring-amber-500/10'
                      : 'bg-blue-50/40 dark:bg-blue-950/25 border-blue-200/60 dark:border-blue-900/40 shadow-xs ring-1 ring-blue-500/10'
                  }`}
                >
                  {/* Visual Unread Left Accent Bar */}
                  {!notif.read && (
                    <span className={`absolute top-0 bottom-0 ${isRtl ? 'right-0 rounded-r-2xl' : 'left-0 rounded-l-2xl'} w-1.5 ${
                      notif.type === 'nearby_quest'
                        ? 'bg-emerald-500'
                        : notif.type === 'deadline_reminder'
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`} />
                  )}

                  {/* Left Icon */}
                  {getIcon(notif.type)}

                  {/* Body details */}
                  <div className="flex-1 min-w-0 pr-0.5">
                    {/* Badge & Time header */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      {badge ? (
                        <span className={`px-2 py-0.5 rounded-md text-[9.5px] font-extrabold border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold">
                          {isRtl ? 'إشعار' : 'Notice'}
                        </span>
                      )}

                      <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                        {formatTime(notif.createdAt)}
                      </span>
                    </div>

                    {/* Notification Text */}
                    <p className="text-[12.5px] leading-relaxed text-slate-800 dark:text-slate-100 font-bold break-words whitespace-normal text-start">
                      {notif.text}
                    </p>

                    {/* Optional extra chips (Reward / Category / Action link) */}
                    {(notif.category || notif.cashReward || notif.questId) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {notif.category && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            {notif.category}
                          </span>
                        )}
                        {notif.cashReward !== undefined && notif.cashReward > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                            {notif.cashReward.toLocaleString()} د.ج
                          </span>
                        )}
                        {notif.questId && (
                          <span className="text-[10px] font-extrabold text-blue-600 dark:text-sky-400 group-hover:underline flex items-center gap-0.5 mr-auto">
                            <span>{isRtl ? 'عرض المهمة' : 'View Quest'}</span>
                            <ArrowRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Trash/Delete Action */}
                  <button
                    onClick={(e) => handleDeleteNotif(e, notif.id)}
                    className="w-7 h-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 text-slate-300 dark:text-slate-600 flex items-center justify-center transition-all cursor-pointer self-start shrink-0"
                    title={isRtl ? 'مسح' : 'Delete'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
