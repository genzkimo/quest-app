import React from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Bell, 
  CheckCheck, 
  Trash2, 
  UserPlus, 
  MapPin, 
  PartyPopper, 
  AlertTriangle, 
  MessageSquareCode
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../utils/firebase';
import { doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';

export interface NotificationDoc {
  id: string;
  userId: string;
  text: string;
  questId?: string;
  createdAt: string;
  read: boolean;
  type: string; // 'applicant' | 'arrival' | 'approved' | 'dismissed' | 'message'
}

interface NotificationScreenProps {
  notifications: NotificationDoc[];
  onClose: () => void;
  lang?: 'ar' | 'fr' | 'en';
  onViewQuest?: (questId: string) => void;
  onNotificationClick?: (notif: NotificationDoc) => void;
}

export default function NotificationScreen({ notifications, onClose, lang = 'ar', onViewQuest, onNotificationClick }: NotificationScreenProps) {
  const isRtl = lang === 'ar';

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

  const getIcon = (type: string) => {
    switch (type) {
      case 'applicant':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'arrival':
        return <MapPin className="w-5 h-5 text-emerald-500 animate-bounce" />;
      case 'approved':
        return <PartyPopper className="w-5 h-5 text-amber-500" />;
      case 'dismissed':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'message':
        return <MessageSquareCode className="w-5 h-5 text-sky-500" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(isRtl ? 'ar-DZ' : 'fr-DZ', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1F2A44]/60 backdrop-blur-xs flex justify-end">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      <motion.div 
        initial={{ x: isRtl ? -400 : 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: isRtl ? -400 : 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col z-10 border-l border-slate-100 font-sans"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        {/* Header */}
        <div className="p-5 bg-[#1F2A44] text-white flex justify-between items-center border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#FFD34D]" />
            <h2 className="text-base font-black">
              {isRtl ? 'مركز الإشعارات الميدانية 🔔' : 'Tactical Notification Center 🔔'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Toolbar */}
        {notifications.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs text-slate-500 shrink-0">
            <span>
              {isRtl 
                ? `لديك ${notifications.filter(n => !n.read).length} إشعار غير مقروء` 
                : `${notifications.filter(n => !n.read).length} unread notifications`}
            </span>
            <button 
              onClick={markAllAsRead}
              className="font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{isRtl ? 'قراءة الكل' : 'Mark all read'}</span>
            </button>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-550">
                {isRtl ? 'لا توجد إشعارات حالياً 📭' : 'No notifications yet 📭'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isRtl ? 'سيظهر هنا كل ما يخص كويستاتك وتفاعلات الكباتن.' : 'All quest updates and field operations alerts appear here.'}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
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
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex gap-3.5 ${
                  notif.read 
                    ? 'bg-white border-slate-100 opacity-75' 
                    : 'bg-blue-50/20 border-blue-150/55 shadow-xs ring-1 ring-blue-500/10'
                }`}
              >
                {/* Visual Unread Left Accent Bar */}
                {!notif.read && (
                  <span className="absolute top-0 bottom-0 right-0 w-1.5 bg-blue-500 rounded-r-2xl"></span>
                )}

                {/* Left/Right Icon */}
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  {getIcon(notif.type)}
                </div>

                {/* Body details */}
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-[12.5px] leading-relaxed text-slate-800 font-extrabold whitespace-pre-line">
                    {notif.text}
                  </p>
                  <span className="text-[9.5px] font-bold text-slate-400 mt-1.5 block">
                    ⏱️ {formatTime(notif.createdAt)}
                  </span>
                </div>

                {/* Trash/Delete Action */}
                <button
                  onClick={(e) => handleDeleteNotif(e, notif.id)}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-500 text-slate-400 flex items-center justify-center transition-all cursor-pointer self-start"
                  title="مسح"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
