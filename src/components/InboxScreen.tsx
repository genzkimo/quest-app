import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { 
  X, 
  MessageSquare, 
  Send, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Briefcase, 
  ExternalLink,
  Clock,
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../utils/firebase';
import { doc, updateDoc, arrayUnion, onSnapshot, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface InboxScreenProps {
  userChats: any[];
  quests?: any[];
  currentUserId: string;
  onClose: () => void;
  lang?: 'ar' | 'fr' | 'en';
  onOpenChat?: (chatId: string) => void;
  isFullPageView?: boolean;
  userProfile?: any;
  onInspectUser?: (userId: string) => void;
  initialChatId?: string | null;
  onClearInitialChatId?: () => void;
  setUserChats?: (chats: any[]) => void;
  onSendPushNotification?: (recipientId: string, title: string, body: string, data?: Record<string, string>) => void;
}

const LOCALES = {
  ar: {
    inboxTitle: 'الرسائل والمحادثات 💬',
    searchPlaceholder: 'ابحث عن اسم، أو عنوان مهمة...',
    emptyState: 'صندوقك فارغ تماماً 💨',
    emptyDesc: 'عندما تقدم على كويست أو تراسل كباتن، ستظهر المحادثات الحية هنا.',
    roleEmployer: 'صاحب العمل 💼',
    roleCaptain: 'منفذ المهمة 🏃',
    questLabel: 'كويست: ',
    all: 'الكل',
    unread: 'غير مقروءة',
    asEmployer: 'كصاحب عمل',
    asCaptain: 'كمنفذ',
    placeholderTitle: 'اختر محادثة لبدء الدردشة 💬',
    placeholderDesc: 'تواصل مباشرة مع الكباتن أو أصحاب العمل للاتفاق على التفاصيل واللوازم الحية وتأكيد العقود.',
    typeMessage: 'اكتب رسالتك هنا...',
    viewQuest: 'تفاصيل الكويست 📋',
    manageContract: 'لوحة التحكم وإدارة العقد الكامل ⚙️',
    loading: 'جاري تحميل المحادثة...',
    back: 'الرجوع للقائمة',
    systemMsg: 'تنبيه النظام 📢',
    notAssignedError: 'عذراً، لا يمكنك إرسال رسائل لأن العقد لم يتم قبوله أو تعيينه لك بشكل رسمي بعد 🔒',
    activeContractsLabel: 'الدردشات النشطة ⚡',
    activeTag: 'نشط',
    noFilteredChats: 'لا توجد محادثات تطابق الفلتر المختار 🔍',
    activeOnline: 'نشط الآن',
    archive: 'الأرشيف 📁',
    archivedNotice: '🔒 هذه الدردشة مؤرشفة لأن المهمة قد اكتملت بنجاح.'
  },
  fr: {
    inboxTitle: 'Messages 💬',
    searchPlaceholder: 'Rechercher un nom ou un titre...',
    emptyState: 'Boîte de réception vide 💨',
    emptyDesc: 'Vos conversations actives apparaîtront ici.',
    roleEmployer: 'Client 💼',
    roleCaptain: 'Captain 🏃',
    questLabel: 'Quest: ',
    all: 'Tous',
    unread: 'Non lus',
    asEmployer: 'Comme Client',
    asCaptain: 'Comme Captain',
    placeholderTitle: 'Sélectionnez une conversation 💬',
    placeholderDesc: 'Discutez directement pour convenir des détails, du matériel et finaliser les contrats.',
    typeMessage: 'Écrivez votre message...',
    viewQuest: 'Détails de la Quest 📋',
    manageContract: 'Gérer le contrat complet ⚙️',
    loading: 'Chargement...',
    back: 'Retour',
    systemMsg: 'Notification Système 📢',
    notAssignedError: "Désolé, vous ne pouvez pas envoyer de messages car le contrat n'est pas encore attribué 🔒",
    activeContractsLabel: 'Discussions actives ⚡',
    activeTag: 'Actif',
    noFilteredChats: 'Aucune discussion ne correspond à ce filtre 🔍',
    activeOnline: 'En ligne',
    archive: 'Archive 📁',
    archivedNotice: '🔒 Cette discussion est archivée car la tâche est terminée.'
  },
  en: {
    inboxTitle: 'Messages 💬',
    searchPlaceholder: 'Search name or quest...',
    emptyState: 'Inbox is empty 💨',
    emptyDesc: 'Your active conversations will appear here.',
    roleEmployer: 'Employer 💼',
    roleCaptain: 'Captain 🏃',
    questLabel: 'Quest: ',
    all: 'All',
    unread: 'Unread',
    asEmployer: 'As Employer',
    asCaptain: 'As Captain',
    placeholderTitle: 'Select a Conversation 💬',
    placeholderDesc: 'Chat directly to coordinate details, gear, requirements, and finalize agreements.',
    typeMessage: 'Type message...',
    viewQuest: 'Quest Details 📋',
    manageContract: 'Manage Full Contract ⚙️',
    loading: 'Loading conversation...',
    back: 'Back to list',
    systemMsg: 'System Alert 📢',
    notAssignedError: 'Sorry, you cannot send messages because the contract is not assigned to you yet 🔒',
    activeContractsLabel: 'Active Chats ⚡',
    activeTag: 'Active',
    noFilteredChats: 'No conversations match this filter 🔍',
    activeOnline: 'Online',
    archive: 'Archive 📁',
    archivedNotice: '🔒 This chat is archived because the quest is completed.'
  }
};

export default function InboxScreen({ 
  userChats, 
  quests = [], 
  currentUserId, 
  onClose, 
  lang = 'ar', 
  onOpenChat, 
  isFullPageView = false,
  userProfile = null,
  onInspectUser,
  initialChatId,
  onClearInitialChatId,
  setUserChats,
  onSendPushNotification
}: InboxScreenProps) {
  const isRtl = lang === 'ar';
  const t = LOCALES[lang] || LOCALES.ar;

  const handleRefresh = async () => {
    try {
      if (!currentUserId) return;
      const qOwnerChats = query(collection(db, 'chats'), where('ownerId', '==', currentUserId));
      const qApplicantChats = query(collection(db, 'chats'), where('applicantId', '==', currentUserId));
      
      const [ownerSnap, applicantSnap] = await Promise.all([
        getDocs(qOwnerChats),
        getDocs(qApplicantChats)
      ]);

      const allChatsMap: Record<string, any> = {};
      ownerSnap.forEach((doc) => {
        allChatsMap[doc.id] = { ...doc.data(), id: doc.id };
      });
      applicantSnap.forEach((doc) => {
        allChatsMap[doc.id] = { ...doc.data(), id: doc.id };
      });

      const merged = Object.values(allChatsMap).sort((a, b) => {
        const aMsgs = (a as any).messages || [];
        const bMsgs = (b as any).messages || [];
        const aTime = aMsgs.length > 0 ? aMsgs[aMsgs.length - 1].createdAt : "";
        const bTime = bMsgs.length > 0 ? bMsgs[bMsgs.length - 1].createdAt : "";
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      if (setUserChats) {
        setUserChats(merged);
      }
    } catch (err) {
      console.error("Failed to manual refresh chats:", err);
    }
  };

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'employer' | 'captain' | 'archive'>('all');

  // Selected chat details
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<any[]>([]);
  const [activeChatLoading, setActiveChatLoading] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Handle initialChatId auto-selection
  useEffect(() => {
    if (initialChatId && userChats.length > 0) {
      const match = userChats.find(c => c.id === initialChatId);
      if (match) {
        setSelectedChat(match);
      }
      if (onClearInitialChatId) {
        onClearInitialChatId();
      }
    }
  }, [initialChatId, userChats, onClearInitialChatId]);

  // Group and sort chats by participant
  const groupedChats = useMemo(() => {
    const groups: { [participantId: string]: any } = {};

    userChats.forEach((chat) => {
      const isCurrentUserOwner = currentUserId === chat.ownerId;
      const participantId = isCurrentUserOwner ? chat.applicantId : chat.ownerId;
      
      if (!participantId) {
        groups[chat.id] = chat;
        return;
      }

      const existing = groups[participantId];
      if (!existing) {
        groups[participantId] = chat;
      } else {
        const existingMessages = existing.messages || [];
        const existingLast = existingMessages[existingMessages.length - 1];
        const existingTime = existingLast?.createdAt ? new Date(existingLast.createdAt).getTime() : 0;

        const currentMessages = chat.messages || [];
        const currentLast = currentMessages[currentMessages.length - 1];
        const currentTime = currentLast?.createdAt ? new Date(currentLast.createdAt).getTime() : 0;

        if (currentTime > existingTime) {
          groups[participantId] = chat;
        }
      }
    });

    return Object.values(groups).sort((a: any, b: any) => {
      const aMessages = a.messages || [];
      const aLast = aMessages[aMessages.length - 1];
      const aTime = aLast?.createdAt ? new Date(aLast.createdAt).getTime() : 0;

      const bMessages = b.messages || [];
      const bLast = bMessages[bMessages.length - 1];
      const bTime = bLast?.createdAt ? new Date(bLast.createdAt).getTime() : 0;

      return bTime - aTime;
    });
  }, [userChats, currentUserId]);

  // Recipient info retriever
  const getInboxItemDetails = (chat: any) => {
    if (!chat) return { recipientName: '', recipientAvatar: '', recipientId: '' };
    const isCurrentUserOwner = currentUserId === chat.ownerId;
    let recipientId = isCurrentUserOwner ? chat.applicantId : chat.ownerId;
    let recipientName = isCurrentUserOwner ? chat.applicantName : (chat.ownerName || t.roleEmployer);
    let recipientAvatar = isCurrentUserOwner ? chat.applicantAvatar : (chat.ownerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');

    // Dynamic self-repair fallback using quest details
    if (!isCurrentUserOwner && (!chat.ownerName || !chat.ownerAvatar)) {
      const targetQuest = quests.find(q => q.id === chat.questId);
      if (targetQuest) {
        if (targetQuest.creatorName) recipientName = targetQuest.creatorName;
        if (targetQuest.creatorAvatar) recipientAvatar = targetQuest.creatorAvatar;
        if (targetQuest.creatorId) recipientId = targetQuest.creatorId;
      }
    }

    return { recipientName, recipientAvatar, recipientId };
  };

  // Check if unread
  const isChatUnread = (chat: any) => {
    const messages = chat.messages || [];
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.senderId === 'system' || lastMsg.senderId === currentUserId) return false;
    const readBy = chat.readBy || [];
    return !readBy.includes(currentUserId);
  };

  // Check if archived
  const isChatArchived = (chat: any) => {
    if (!chat) return false;
    if (chat.isArchived === true) return true;
    const qId = chat.id.split('_')[0] || chat.questId;
    if (qId) {
      const q = quests.find(item => item.id === qId);
      if (q && q.status === 'completed') {
        return true;
      }
    }
    return false;
  };

  // Check if chat is locked (pending booking acceptance)
  const isChatPendingBooking = (chat: any) => {
    if (!chat) return false;
    const chatParts = chat.id.split('_');
    const qId = chatParts[0] || chat.questId;
    const applicantId = chatParts[2] || chat.applicantId;
    const relatedQuest = quests.find(q => q.id === qId);
    if (!relatedQuest) return false;
    
    // If worker is not assigned/accepted on this quest yet
    const isAssigned = (
      relatedQuest.helperId === applicantId ||
      relatedQuest.assignedRunnerId === applicantId ||
      relatedQuest.assignedRunnerIds?.includes(applicantId)
    );

    return !isAssigned;
  };

  // Local/real-time synchronization for the selected chat messages
  useEffect(() => {
    if (!selectedChat) {
      setActiveChatMessages([]);
      setActiveChatLoading(false);
      return;
    }

    setActiveChatMessages([]);
    setActiveChatLoading(true);

    if (auth.currentUser) {
      const chatDocRef = doc(db, 'chats', selectedChat.id);
      const unsubscribe = onSnapshot(chatDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setActiveChatMessages(data.messages || []);
          
          // Mark as read automatically when focusing/updating active chat
          const readBy = data.readBy || [];
          if (!readBy.includes(currentUserId)) {
            updateDoc(chatDocRef, {
              readBy: arrayUnion(currentUserId)
            }).catch(e => console.error("Error setting readBy: ", e));
          }
        } else {
          setActiveChatMessages([]);
        }
        setActiveChatLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `chats/${selectedChat.id}`);
        setActiveChatLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Local Fallback
      try {
        const stored = localStorage.getItem(`local_chat_${selectedChat.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setActiveChatMessages(parsed.messages || []);
        } else {
          setActiveChatMessages([]);
        }
        setActiveChatLoading(false);
      } catch (e) {
        console.error("Local load fail", e);
        setActiveChatLoading(false);
      }
    }
  }, [selectedChat, currentUserId]);

  // Handle send message inside selected chat
  const handleSendChatMessage = async () => {
    if (!chatInputText.trim() || !selectedChat) return;

    const chatParts = selectedChat.id.split('_');
    const qId = chatParts[0];
    const creatorId = chatParts[1];

    // Assignment and contract state checking
    if (isChatPendingBooking(selectedChat)) {
      alert(lang === 'ar'
        ? '🔒 التواصل بالدردشة مغلق حالياً، وسيتم تفعيله تلقائياً فور قبول صاحب المهمة لطلب الحجز.'
        : '🔒 Chat is locked until the creator accepts the booking request.'
      );
      return;
    }

    if (currentUserId !== creatorId) {
      const relatedQuest = quests.find(q => q.id === qId);
      const isAssigned = relatedQuest && relatedQuest.helperId === currentUserId && (
        relatedQuest.status === 'booked' ||
        relatedQuest.status === 'active' ||
        relatedQuest.status === 'arrived' ||
        relatedQuest.status === 'pending_verification' ||
        relatedQuest.status === 'completed' ||
        relatedQuest.status === 'disputed'
      );
      if (!isAssigned) {
        alert(t.notAssignedError);
        return;
      }
    }

    const newMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      senderName: userProfile?.name || auth.currentUser?.displayName || 'مستخدم كويست',
      text: chatInputText.trim(),
      createdAt: new Date().toISOString()
    };

    if (auth.currentUser) {
      const chatDocRef = doc(db, 'chats', selectedChat.id);
      try {
        const snap = await getDoc(chatDocRef);
        let messagesToSave = [newMessage];
        let ownerId = '';
        let applicantId = '';
        let questId = '';

        if (snap.exists()) {
          const chatData = snap.data();
          messagesToSave = [...(chatData.messages || []), newMessage];
          ownerId = chatData.ownerId || '';
          applicantId = chatData.applicantId || '';
          questId = chatData.questId || '';
        } else {
          const parts = selectedChat.id.split('_');
          questId = parts[0] || '';
          ownerId = parts[1] || '';
          applicantId = parts[2] || '';
        }

        await setDoc(chatDocRef, {
          id: selectedChat.id,
          messages: messagesToSave,
          readBy: [currentUserId]
        }, { merge: true });

        // Trigger context notification
        const recipientUserId = (currentUserId === ownerId) ? applicantId : ownerId;
        if (recipientUserId) {
          try {
            const senderName = newMessage.senderName || 'مستخدم كويست';
            const notifText = lang === 'ar'
              ? `رسالة جديدة من ${senderName}: ${newMessage.text} 💬`
              : lang === 'fr'
              ? `Nouveau message de ${senderName}: ${newMessage.text} 💬`
              : `New message from ${senderName}: ${newMessage.text} 💬`;

            const notifDocRef = doc(collection(db, 'notifications'));
            await setDoc(notifDocRef, {
              id: notifDocRef.id,
              userId: recipientUserId,
              text: notifText,
              questId: questId,
              createdAt: new Date().toISOString(),
              read: false,
              type: 'message'
            });

            // Also dispatch push notification
            if (onSendPushNotification) {
              const pushTitle = lang === 'ar'
                ? `💬 رسالة جديدة من ${senderName}`
                : lang === 'fr'
                ? `💬 Nouveau message de ${senderName}`
                : `💬 New message from ${senderName}`;
              
              const pushBody = newMessage.text;
              
              onSendPushNotification(recipientUserId, pushTitle, pushBody, { questId, chatId: selectedChat.id });
            }
          } catch (notifErr) {
            console.error("Cloud notification create failed", notifErr);
          }
        }

        setChatInputText('');
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `chats/${selectedChat.id}`);
      }
    } else {
      // Local fallback send
      try {
        const key = `local_chat_${selectedChat.id}`;
        const stored = localStorage.getItem(key);
        let messagesToSave = [newMessage];
        if (stored) {
          const parsed = JSON.parse(stored);
          messagesToSave = [...(parsed.messages || []), newMessage];
        }
        localStorage.setItem(key, JSON.stringify({ id: selectedChat.id, messages: messagesToSave }));
        setActiveChatMessages(messagesToSave);
        setChatInputText('');
      } catch (e) {
        console.error("Local fallback send error", e);
      }
    }
  };

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChatMessages]);

  // Format date helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  const handleOpenChatRoom = async (chat: any) => {
    const { recipientName, recipientAvatar } = getInboxItemDetails(chat);
    
    // Mark as read in Firestore
    if (auth.currentUser) {
      try {
        const chatDocRef = doc(db, 'chats', chat.id);
        await updateDoc(chatDocRef, {
          readBy: arrayUnion(currentUserId)
        });
      } catch (e) {
        console.error("Failed to mark chat as read in DB:", e);
        handleFirestoreError(e, OperationType.WRITE, `chats/${chat.id}`);
      }
    }

    if (onOpenChat) {
      onOpenChat(chat.id);
    } else {
      // Trigger global CustomEvent
      window.dispatchEvent(new CustomEvent('open-chat', {
        detail: {
          chatId: chat.id,
          questTitle: chat.questTitle,
          recipientName: recipientName,
          recipientAvatar: recipientAvatar
        }
      }));
    }

    onClose();
  };

  // Filters logic
  const filteredChats = useMemo(() => {
    return groupedChats.filter((chat) => {
      const archived = isChatArchived(chat);
      if (activeFilter === 'archive') {
        if (!archived) return false;
      } else {
        if (archived) return false;
      }

      const { recipientName } = getInboxItemDetails(chat);
      const matchesSearch = 
        recipientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (chat.questTitle || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const isUnread = isChatUnread(chat);
      const isEmployer = currentUserId !== chat.ownerId;
      const isCaptain = currentUserId === chat.ownerId;

      if (activeFilter === 'unread') return isUnread;
      if (activeFilter === 'employer') return isEmployer;
      if (activeFilter === 'captain') return isCaptain;

      return true;
    });
  }, [groupedChats, searchTerm, activeFilter, currentUserId, quests]);

  const activeQuestInfo = useMemo(() => {
    if (!selectedChat) return null;
    const qId = selectedChat.id.split('_')[0];
    return quests.find(q => q.id === qId) || null;
  }, [selectedChat, quests]);

  // Full Screen View redone entirely to be a beautiful dual-pane dashboard
  return (
    <div 
      id="full_inbox_container"
        className="w-full bg-slate-50 flex h-[calc(100vh-136px)] font-sans relative overflow-hidden"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        {/* SIDEBAR: Conversation List Panel */}
        <div 
          id="inbox_sidebar"
          className={`w-full md:w-[360px] lg:w-[400px] shrink-0 border-r border-slate-150 flex flex-col h-full bg-white ${
            selectedChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 bg-white border-b border-slate-100 text-slate-800 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#1F2A44]" />
              <h2 className="text-base font-black tracking-tight text-slate-850">{t.inboxTitle}</h2>
            </div>
            {groupedChats.some(isChatUnread) && (
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-2xl outline-none focus:border-[#1F2A44] text-slate-800 font-medium transition-all"
              />
              <Search className={`w-4 h-4 text-slate-400 absolute top-2.5 ${isRtl ? 'left-3' : 'right-3'}`} />
            </div>
          </div>

          {/* Category Tabs / Filters */}
          <div className="p-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0 border-b border-slate-100 scrollbar-none bg-slate-50/30">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                activeFilter === 'all'
                  ? 'bg-[#1F2A44] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.all}
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all flex items-center gap-1 ${
                activeFilter === 'unread'
                  ? 'bg-red-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.unread}
              {groupedChats.filter(isChatUnread).length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              )}
            </button>
            <button
              onClick={() => setActiveFilter('employer')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                activeFilter === 'employer'
                  ? 'bg-[#1F2A44] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.asEmployer}
            </button>
            <button
              onClick={() => setActiveFilter('captain')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                activeFilter === 'captain'
                  ? 'bg-[#1F2A44] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.asCaptain}
            </button>
            <button
              onClick={() => setActiveFilter('archive')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all ${
                activeFilter === 'archive'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.archive}
            </button>
          </div>

          {/* List Section */}
          <div className="flex-1 overflow-hidden bg-white select-none relative h-full">
            <PullToRefresh
              onRefresh={handleRefresh}
              lang={lang}
              audioEffectsEnabled={userProfile?.audioEffectsEnabled !== false}
              hapticFeedbackEnabled={userProfile?.hapticFeedbackEnabled !== false}
            >
              <div className="p-3 bg-white space-y-2 scrollbar-thin">
                {filteredChats.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <MessageSquare className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-xs font-bold text-slate-500">
                      {searchTerm ? t.noFilteredChats : t.emptyState}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                      {searchTerm ? '' : t.emptyDesc}
                    </p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const { recipientName, recipientAvatar } = getInboxItemDetails(chat);
                    const isUnread = isChatUnread(chat);
                    const isSelected = selectedChat?.id === chat.id;
                    const messages = chat.messages || [];
                    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

                    const isCurrentUserOwner = currentUserId === chat.ownerId;
                    const userRoleLabel = isCurrentUserOwner ? t.roleCaptain : t.roleEmployer;
                    const userRoleColor = isCurrentUserOwner
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                      : 'bg-[#1F2A44]/10 text-[#1F2A44]/90 border-[#1F2A44]/20';

                    return (
                      <div
                        key={chat.id}
                        onClick={() => setSelectedChat(chat)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex items-center gap-3 ${
                          isSelected
                            ? 'bg-slate-50 border-slate-200 shadow-xs ring-1 ring-slate-200'
                            : isUnread
                            ? 'bg-blue-50/40 border-blue-150 hover:border-slate-200'
                            : 'bg-white border-slate-100 hover:bg-slate-50/50'
                        }`}
                      >
                        {isUnread && (
                          <span className={`absolute top-0 bottom-0 ${isRtl ? 'right-0 rounded-r-2xl' : 'left-0 rounded-l-2xl'} w-1 bg-blue-500`}></span>
                        )}

                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            const details = getInboxItemDetails(chat);
                            if (details.recipientId && onInspectUser) {
                              onInspectUser(details.recipientId);
                            }
                          }}
                          className="w-10 h-10 rounded-full relative overflow-hidden bg-slate-150 shrink-0 border border-slate-200 font-sans cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          <img src={recipientAvatar} alt={recipientName} className="w-full h-full object-cover" />
                          {isUnread && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full animate-ping"></span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5 gap-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <h3 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const details = getInboxItemDetails(chat);
                                  if (details.recipientId && onInspectUser) {
                                    onInspectUser(details.recipientId);
                                  }
                                }}
                                className="text-xs font-black text-slate-800 truncate cursor-pointer hover:text-blue-600 hover:underline"
                              >
                                {recipientName}
                              </h3>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border shrink-0 scale-90 ${userRoleColor}`}>
                                {userRoleLabel}
                              </span>
                            </div>
                            <span className="text-[8.5px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                              {formatTime(lastMessage?.createdAt)}
                            </span>
                          </div>

                          <p className="text-[9px] font-extrabold text-slate-400 truncate mb-1">
                            {t.questLabel}<span className="text-[#1F2A44] font-black">{chat.questTitle}</span>
                          </p>

                          <p className={`text-[11px] truncate ${isUnread ? 'font-black text-slate-900' : 'text-slate-500'}`}>
                            {lastMessage ? lastMessage.text : '...'}
                          </p>
                        </div>

                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </PullToRefresh>
          </div>
        </div>

        {/* MAIN PANEL: Chat View Area */}
        <div 
          id="inbox_chat_window"
          className={`flex-1 bg-slate-50 flex flex-col h-full ${
            !selectedChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedChat ? (
            <div className="flex-1 flex flex-col h-full">
              {/* Active Chat Header */}
              <div className="p-4 bg-white text-slate-850 flex justify-between items-center border-b border-slate-150 shrink-0 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button 
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-1 rounded-full hover:bg-slate-100 text-slate-600 shrink-0"
                    title={t.back}
                  >
                    <ArrowRight className={`w-5 h-5 ${isRtl ? '' : 'rotate-180'}`} />
                  </button>

                  {/* Avatar */}
                  <div 
                    onClick={() => {
                      const details = getInboxItemDetails(selectedChat);
                      if (details.recipientId && onInspectUser) {
                        onInspectUser(details.recipientId);
                      }
                    }}
                    className="w-10 h-10 rounded-full overflow-hidden border border-slate-100 bg-slate-100 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                  >
                    <img 
                      src={getInboxItemDetails(selectedChat).recipientAvatar} 
                      alt={getInboxItemDetails(selectedChat).recipientName} 
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  {/* Recipient Details */}
                  <div className="min-w-0">
                    <h4 
                      onClick={() => {
                        const details = getInboxItemDetails(selectedChat);
                        if (details.recipientId && onInspectUser) {
                          onInspectUser(details.recipientId);
                        }
                      }}
                      className="font-extrabold text-xs text-slate-800 truncate cursor-pointer hover:text-blue-600 hover:underline transition-all"
                    >
                      {getInboxItemDetails(selectedChat).recipientName}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isChatArchived(selectedChat) ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          <span className="text-[9px] text-amber-600 font-bold tracking-tight">
                            {lang === 'ar' ? 'مؤرشف 📁' : 'Archived 📁'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="text-[9px] text-emerald-600 font-bold tracking-tight">
                            {t.activeOnline}
                          </span>
                        </>
                      )}
                      <span className="text-[9px] text-slate-300">|</span>
                      <span className="text-[9px] text-blue-600 font-extrabold truncate max-w-[140px] md:max-w-xs">
                        {selectedChat.questTitle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Header Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* View Details Event Button */}
                  <button
                    onClick={() => {
                      if (onOpenChat) {
                        onOpenChat(selectedChat.id);
                      } else {
                        window.dispatchEvent(new CustomEvent('open-chat', {
                          detail: {
                            chatId: selectedChat.id,
                            questId: selectedChat.id.split('_')[0]
                          }
                        }));
                      }
                      onClose();
                    }}
                    className="bg-[#1F2A44] hover:bg-[#1E2E4E] text-white text-[10px] font-black px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 leading-none shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.viewQuest}</span>
                  </button>
                </div>
              </div>



              {/* Chat Messages List Container */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 bg-slate-50 space-y-3.5 flex flex-col scrollbar-thin select-text">
                {activeChatLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="flex justify-center items-center gap-1.5">
                      <div className="w-2 h-2 bg-[#1F2A44] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-[#1F2A44] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-[#1F2A44] rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {t.loading}
                    </span>
                  </div>
                ) : activeChatMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                      <MessageSquare className="w-5 h-5 text-slate-300 animate-pulse" />
                    </div>
                    <span className="text-xs text-slate-400 font-bold leading-normal">
                      {lang === 'ar' ? 'أرسل أول رسالة للاتفاق على شروط الكويست!' : 'Send the first message to sync on Quest requirements!'}
                    </span>
                  </div>
                ) : (
                  activeChatMessages.map((msg, index) => {
                    const isMe = msg.senderId === currentUserId;
                    const isSys = msg.senderId === 'system';

                    if (isSys) {
                      return (
                        <div key={index} className="mx-auto w-full max-w-sm text-center py-2 px-3 bg-blue-50 border border-blue-100 rounded-2xl text-[10px] text-blue-700 font-bold leading-normal flex items-center justify-center gap-1">
                          <span>{msg.text}</span>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={index} 
                        className={`flex flex-col max-w-[80%] ${
                          isMe 
                            ? 'self-end bg-[#1F2A44] text-white rounded-2xl rounded-tr-none p-3 shadow-xs' 
                            : 'self-start bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-none p-3 shadow-xs'
                        }`}
                      >
                        <span 
                          onClick={() => {
                            if (!isMe && msg.senderId && onInspectUser) {
                              onInspectUser(msg.senderId);
                            }
                          }}
                          className={`text-[8px] font-black block mb-0.5 ${isMe ? 'text-white/80' : 'text-slate-400'} ${!isMe && onInspectUser ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
                        >
                          {msg.senderName}
                        </span>
                        <p className="text-[11.5px] font-medium leading-relaxed break-words">{msg.text}</p>
                        <span className={`text-[7.5px] text-right mt-1 font-mono leading-none block ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
                {/* Scroll Anchor */}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Dock */}
              {isChatArchived(selectedChat) ? (
                <div className="p-4 bg-slate-100 border-t border-slate-200 text-center text-slate-500 text-xs font-black flex items-center justify-center gap-2 shrink-0">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{t.archivedNotice || 'هذه الدردشة مؤرشفة لانتهاء المهمة 🔒'}</span>
                </div>
              ) : isChatPendingBooking(selectedChat) ? (
                <div className="p-4 bg-amber-50 border-t border-amber-200 text-center text-amber-900 text-xs font-black flex items-center justify-center gap-2 shrink-0">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{lang === 'ar' ? '🔒 التواصل بالدردشة مغلق حالياً، وسيتم تفعيله فور قبول صاحب المهمة لطلب الحجز 🤝' : '🔒 Chat is locked until the creator accepts the booking request 🤝'}</span>
                </div>
              ) : (
                <div className="p-3 bg-white border-t border-slate-150 flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder={t.typeMessage}
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChatMessage();
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 outline-none rounded-2xl px-4 py-2.5 text-xs font-semibold focus:border-[#1F2A44] text-slate-800 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSendChatMessage}
                    className="bg-[#1F2A44] hover:bg-[#1E2E4E] text-white p-2.5 rounded-xl transition-all active:scale-90 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Blank state when no chat selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-slate-50">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 border border-slate-150 shadow-xs">
                <MessageSquare className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-sm font-black text-slate-700 mb-1">
                {t.placeholderTitle}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                {t.placeholderDesc}
              </p>
            </div>
          )}
        </div>
      </div>
    );
}
