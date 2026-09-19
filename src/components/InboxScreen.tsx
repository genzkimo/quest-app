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
 Lock,
 FolderArchive,
 UserCheck,
 Handshake,
 MoreVertical,
 Trash2,
 Bell,
 BellOff
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
 isNavVisible?: boolean;
 onActiveChatChange?: (hasActiveChat: boolean) => void;
}

const LOCALES = {
 ar: {
 inboxTitle: 'الرسائل والمحادثات ',
 searchPlaceholder: 'ابحث عن اسم، أو عنوان مهمة...',
 emptyState: 'تظهر رسائلك هنا',
 emptyDesc: '',
 roleEmployer: 'صاحب العمل ',
 roleCaptain: 'منفذ المهمة ',
 questLabel: 'كويست: ',
 all: 'الكل',
 unread: 'غير مقروءة',
 asEmployer: 'كصاحب عمل',
 asCaptain: 'كمنفذ',
 placeholderTitle: 'اختر محادثة لبدء الدردشة ',
 placeholderDesc: 'تواصل مع الكباتن أو أصحاب العمل للاتفاق على التفاصيل واللوازم الحية وتأكيد العقود.',
 typeMessage: 'اكتب رسالتك هنا...',
 viewQuest: 'تفاصيل الكويست ',
 manageContract: 'لوحة التحكم وإدارة العقد الكامل ',
 loading: 'جاري تحميل المحادثة...',
 back: 'الرجوع للقائمة',
 systemMsg: 'تنبيه النظام ',
 notAssignedError: 'عذراً، لا يمكنك إرسال رسائل لأن العقد لم يتم قبوله أو تعيينه لك بشكل رسمي بعد ',
 activeContractsLabel: 'الدردشات النشطة ',
 activeTag: 'نشط',
 noFilteredChats: 'لا توجد محادثات تطابق الفلتر المختار ',
 activeOnline: 'نشط الآن',
 archive: 'الأرشيف ',
 archivedNotice: ' هذه الدردشة مؤرشفة لأن المهمة قد اكتملت بنجاح.'
 },
 fr: {
 inboxTitle: 'Messages ',
 searchPlaceholder: 'Rechercher un nom ou un titre...',
 emptyState: 'Boîte de réception vide ',
 emptyDesc: 'Vos conversations actives apparaîtront ici.',
 roleEmployer: 'Client ',
 roleCaptain: 'Captain ',
 questLabel: 'Quest: ',
 all: 'Tous',
 unread: 'Non lus',
 asEmployer: 'Comme Client',
 asCaptain: 'Comme Captain',
 placeholderTitle: 'Sélectionnez une conversation ',
 placeholderDesc: 'Discutez directement pour convenir des détails, du matériel et finaliser les contrats.',
 typeMessage: 'Écrivez votre message...',
 viewQuest: 'Détails de la Quest ',
 manageContract: 'Gérer le contrat complet ',
 loading: 'Chargement...',
 back: 'Retour',
 systemMsg: 'Notification Système ',
 notAssignedError: "Désolé, vous ne pouvez pas envoyer de messages car le contrat n'est pas encore attribué ",
 activeContractsLabel: 'Discussions actives ',
 activeTag: 'Actif',
 noFilteredChats: 'Aucune discussion ne correspond à ce filtre ',
 activeOnline: 'En ligne',
 archive: 'Archive ',
 archivedNotice: ' Cette discussion est archivée car la tâche est terminée.'
 },
 en: {
 inboxTitle: 'Messages ',
 searchPlaceholder: 'Search name or quest...',
 emptyState: 'Inbox is empty ',
 emptyDesc: 'Your active conversations will appear here.',
 roleEmployer: 'Employer ',
 roleCaptain: 'Captain ',
 questLabel: 'Quest: ',
 all: 'All',
 unread: 'Unread',
 asEmployer: 'As Employer',
 asCaptain: 'As Captain',
 placeholderTitle: 'Select a Conversation ',
 placeholderDesc: 'Chat directly to coordinate details, gear, requirements, and finalize agreements.',
 typeMessage: 'Type message...',
 viewQuest: 'Quest Details ',
 manageContract: 'Manage Full Contract ',
 loading: 'Loading conversation...',
 back: 'Back to list',
 systemMsg: 'System Alert ',
 notAssignedError: 'Sorry, you cannot send messages because the contract is not assigned to you yet ',
 activeContractsLabel: 'Active Chats ',
 activeTag: 'Active',
 noFilteredChats: 'No conversations match this filter ',
 activeOnline: 'Online',
 archive: 'Archive ',
 archivedNotice: ' This chat is archived because the quest is completed.'
 }
};

export function formatLastActive(
  lastActiveTime: string | number | undefined,
  lang: "ar" | "fr" | "en" = "ar"
): { text: string; isOnline: boolean; dotColor: string } {
  if (!lastActiveTime) {
    if (lang === "ar") return { text: "منذ وقت طويل", isOnline: false, dotColor: "bg-rose-500" };
    if (lang === "fr") return { text: "Depuis longtemps", isOnline: false, dotColor: "bg-rose-500" };
    return { text: "A long time ago", isOnline: false, dotColor: "bg-rose-500" };
  }

  const timestamp = typeof lastActiveTime === "number" ? lastActiveTime : new Date(lastActiveTime).getTime();
  if (isNaN(timestamp) || timestamp <= 0) {
    if (lang === "ar") return { text: "منذ وقت طويل", isOnline: false, dotColor: "bg-rose-500" };
    if (lang === "fr") return { text: "Depuis longtemps", isOnline: false, dotColor: "bg-rose-500" };
    return { text: "A long time ago", isOnline: false, dotColor: "bg-rose-500" };
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  // Active within last 5 minutes -> Green dot, NO text at all
  if (diffMins < 5) {
    return { text: "", isOnline: true, dotColor: "bg-emerald-500" };
  }

  // Less than 60 minutes -> Yellow dot, e.g. "منذ 15 دقيقة"
  if (diffMins < 60) {
    if (lang === "ar") return { text: "منذ " + diffMins + " دقيقة", isOnline: false, dotColor: "bg-amber-500" };
    if (lang === "fr") return { text: "Il y a " + diffMins + " min", isOnline: false, dotColor: "bg-amber-500" };
    return { text: diffMins + "m ago", isOnline: false, dotColor: "bg-amber-500" };
  }

  // Today / Less than 24 hours -> Yellow dot, e.g. "منذ 3 ساعات"
  if (diffHours < 24) {
    if (lang === "ar") {
      const hText = diffHours === 1 ? "ساعة" : diffHours === 2 ? "ساعتين" : diffHours <= 10 ? diffHours + " ساعات" : diffHours + " ساعة";
      return { text: "منذ " + hText, isOnline: false, dotColor: "bg-amber-500" };
    }
    if (lang === "fr") return { text: "Il y a " + diffHours + "h", isOnline: false, dotColor: "bg-amber-500" };
    return { text: diffHours + "h ago", isOnline: false, dotColor: "bg-amber-500" };
  }

  // Less than 7 days -> Red dot, e.g. "منذ 3 أيام"
  if (diffDays < 7) {
    if (lang === "ar") {
      const dText = diffDays === 1 ? "يوم" : diffDays === 2 ? "يومين" : diffDays <= 10 ? diffDays + " أيام" : diffDays + " يوماً";
      return { text: "منذ " + dText, isOnline: false, dotColor: "bg-rose-500" };
    }
    if (lang === "fr") return { text: "Il y a " + diffDays + " j", isOnline: false, dotColor: "bg-rose-500" };
    return { text: diffDays + "d ago", isOnline: false, dotColor: "bg-rose-500" };
  }

  // Less than 30 days -> Red dot, e.g. "منذ أسبوع"
  if (diffDays < 30) {
    const weeks = Math.max(1, diffWeeks);
    if (lang === "ar") {
      const wText = weeks === 1 ? "أسبوع" : weeks === 2 ? "أسبوعين" : weeks + " أسابيع";
      return { text: "منذ " + wText, isOnline: false, dotColor: "bg-rose-500" };
    }
    if (lang === "fr") return { text: "Il y a " + weeks + " sem", isOnline: false, dotColor: "bg-rose-500" };
    return { text: weeks + "w ago", isOnline: false, dotColor: "bg-rose-500" };
  }

  // More than a month -> Red dot, "منذ وقت طويل"
  if (lang === "ar") return { text: "منذ وقت طويل", isOnline: false, dotColor: "bg-rose-500" };
  if (lang === "fr") return { text: "Depuis longtemps", isOnline: false, dotColor: "bg-rose-500" };
  return { text: "A long time ago", isOnline: false, dotColor: "bg-rose-500" };
}

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
 onSendPushNotification,
 isNavVisible = false,
 onActiveChatChange
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

 // Soft Delete / Hidden Chats & Muted Chats state
 const [hiddenChatTimes, setHiddenChatTimes] = useState<Record<string, number>>(() => {
 try {
 const saved = localStorage.getItem(`cleared_chats_${currentUserId}`);
 return saved ? JSON.parse(saved) : {};
 } catch {
 return {};
 }
 });

 const [mutedChats, setMutedChats] = useState<Record<string, boolean>>(() => {
 try {
 const saved = localStorage.getItem(`muted_chats_${currentUserId}`);
 return saved ? JSON.parse(saved) : {};
 } catch {
 return {};
 }
 });

 const [contextMenuChat, setContextMenuChat] = useState<any | null>(null);
 const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
 const isLongPressActiveRef = useRef(false);

 const handleTouchStart = (chat: any) => {
 isLongPressActiveRef.current = false;
 if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
 longPressTimerRef.current = setTimeout(() => {
 isLongPressActiveRef.current = true;
 if (navigator.vibrate) navigator.vibrate(40);
 setContextMenuChat(chat);
 }, 500);
 };

 const handleTouchEnd = () => {
 if (longPressTimerRef.current) {
 clearTimeout(longPressTimerRef.current);
 longPressTimerRef.current = null;
 }
 };

 const handleHideConversation = (chat: any) => {
 if (!chat) return;
 const msgs = chat.messages || [];
 const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
 const lastMsgTime = lastMsg?.createdAt ? new Date(lastMsg.createdAt).getTime() : Date.now();

 const updatedTimes = { ...hiddenChatTimes, [chat.id]: lastMsgTime };
 setHiddenChatTimes(updatedTimes);
 try {
 localStorage.setItem(`cleared_chats_${currentUserId}`, JSON.stringify(updatedTimes));
 } catch (e) {
 console.error(e);
 }

 if (selectedChat?.id === chat.id) {
 setSelectedChat(null);
 }
 setContextMenuChat(null);
 };

 // Selected chat details
 const [selectedChat, setSelectedChat] = useState<any | null>(null);

 useEffect(() => {
 if (onActiveChatChange) {
 onActiveChatChange(!!selectedChat);
 }
 return () => {
 if (onActiveChatChange) {
 onActiveChatChange(false);
 }
 };
 }, [selectedChat, onActiveChatChange]);
 const [activeChatMessages, setActiveChatMessages] = useState<any[]>([]);
 const [activeChatLoading, setActiveChatLoading] = useState(false);
 const [chatInputText, setChatInputText] = useState('');
 
 const chatEndRef = useRef<HTMLDivElement>(null);

 // Handle initialChatId auto-selection & synthetic fallback creation
 useEffect(() => {
 if (!initialChatId) return;

 // 1. Try exact match in existing userChats
 let match = userChats.find(c => c.id === initialChatId);

 // 2. Fallback match by questId or prefix
 if (!match) {
 const qId = initialChatId.split('_')[0];
 if (qId) {
 match = userChats.find(c => c.questId === qId || (c.id && c.id.startsWith(qId)));
 }
 }

 if (match) {
 setSelectedChat(match);
 if (onClearInitialChatId) onClearInitialChatId();
 } else {
 // 3. Synthetic chat creation if doc doesn't exist yet or userChats hasn't populated
 const parts = initialChatId.split('_');
 const qId = parts[0];
 const ownerId = parts[1];
 const applicantId = parts[2];

 if (qId && ownerId && applicantId) {
 const relatedQuest = quests.find(q => q.id === qId);
 const isOwner = currentUserId === ownerId;
 const syntheticChat = {
 id: initialChatId,
 questId: qId,
 questTitle: relatedQuest?.title || (lang === 'ar' ? 'مهمة ميدانية' : 'Quest'),
 ownerId: ownerId,
 ownerName: relatedQuest?.creatorName || (isOwner ? (userProfile?.name || 'صاحب المهمة') : 'صاحب المهمة'),
 ownerAvatar: relatedQuest?.creatorAvatar || (isOwner ? (userProfile?.avatar || '') : ''),
 applicantId: applicantId,
 applicantName: isOwner ? (relatedQuest?.helperName || 'المساعد الميداني') : (userProfile?.name || 'المساعد الميداني'),
 applicantAvatar: isOwner ? (relatedQuest?.helperAvatar || '') : (userProfile?.avatar || ''),
 messages: [],
 createdAt: new Date().toISOString()
 };
 setSelectedChat(syntheticChat);
 if (onClearInitialChatId) onClearInitialChatId();
 }
 }
 }, [initialChatId, userChats, quests, currentUserId, userProfile, lang, onClearInitialChatId]);

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

 // Track recipient presence profiles
 const [recipientProfiles, setRecipientProfiles] = useState<Record<string, { lastActiveAt?: string }>>({});

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

 // Collect unique recipient IDs
 const recipientIdsKey = useMemo(() => {
 const ids = new Set<string>();
 userChats.forEach(chat => {
 const details = getInboxItemDetails(chat);
 if (details.recipientId) ids.add(details.recipientId);
 });
 return Array.from(ids).sort().join(',');
 }, [userChats, currentUserId, quests]);

 useEffect(() => {
 if (!recipientIdsKey) return;
 const ids = recipientIdsKey.split(',').filter(Boolean);
 const unsubs: (() => void)[] = [];

 ids.forEach(id => {
 try {
 const unsub = onSnapshot(doc(db, 'users', id), (snap) => {
 if (snap.exists()) {
 const data = snap.data();
 setRecipientProfiles(prev => ({
 ...prev,
 [id]: {
 lastActiveAt: data.lastActiveAt || data.updatedAt || ''
 }
 }));
 }
 }, (err) => console.warn(`Recipient presence error for ${id}:`, err));
 unsubs.push(unsub);
 } catch (err) {
 console.warn("Presence snapshot error:", err);
 }
 });

 return () => {
 unsubs.forEach(unsub => unsub());
 };
 }, [recipientIdsKey]);

 const getRecipientLastActiveTime = (chat: any, recipientId: string): string | number | undefined => {
 if (!recipientId) return undefined;
 const profileLastActive = recipientProfiles[recipientId]?.lastActiveAt;
 if (profileLastActive) return profileLastActive;

 // Fallback to last message sent by recipient in this chat
 const messages = chat?.messages || [];
 for (let i = messages.length - 1; i >= 0; i--) {
 const msg = messages[i];
 if (msg.senderId === recipientId && msg.createdAt) {
 return msg.createdAt;
 }
 }
 return undefined;
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
    if (chat.isArchived === true || chat.isArchived === 'true') return true;
    const qId = chat.questId || (chat.id ? chat.id.split('_')[0] : null);
    if (!qId) return true;
    const q = quests.find(item => item.id === qId);
    if (!q) return true;
    if (
      q.archived === true ||
      (q as any).archived === 'true' ||
      ['completed', 'cancelled', 'expired', 'cancelled_by_timeout', 'stale_cleared', 'terminated', 'archived', 'withdrawn'].includes(q.status)
    ) {
      return true;
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
 
 // If quest status is active/booked/arrived or if applicantId/currentUserId is assigned
 const isContractActive = (
 relatedQuest.status === 'booked' ||
 relatedQuest.status === 'active' ||
 relatedQuest.status === 'arrived' ||
 relatedQuest.status === 'pending_verification' ||
 relatedQuest.status === 'completed' ||
 relatedQuest.status === 'disputed'
 );

 const isApplicantAssigned = (
 relatedQuest.helperId === applicantId ||
 relatedQuest.assignedRunnerId === applicantId ||
 relatedQuest.assignedRunnerIds?.includes(applicantId) ||
 relatedQuest.helperId === currentUserId ||
 relatedQuest.assignedRunnerId === currentUserId ||
 relatedQuest.assignedRunnerIds?.includes(currentUserId) ||
 relatedQuest.creatorId === currentUserId
 );

 return !(isContractActive || isApplicantAssigned);
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
 ? ' التواصل بالدردشة مغلق حالياً، وسيتم تفعيله تلقائياً فور قبول صاحب المهمة لطلب الحجز.'
 : ' Chat is locked until the creator accepts the booking request.'
 );
 return;
 }

 if (currentUserId !== creatorId) {
 const relatedQuest = quests.find(q => q.id === qId);
 const isAssigned = relatedQuest && (
 relatedQuest.helperId === currentUserId ||
 relatedQuest.assignedRunnerId === currentUserId ||
 relatedQuest.assignedRunnerIds?.includes(currentUserId)
 ) && (
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
 questId = parts[0] || selectedChat.questId || '';
 ownerId = parts[1] || selectedChat.ownerId || '';
 applicantId = parts[2] || selectedChat.applicantId || '';
 }

 const relatedQuest = quests.find(q => q.id === questId);

 await setDoc(chatDocRef, {
 id: selectedChat.id,
 questId: questId,
 ownerId: ownerId || selectedChat.ownerId || '',
 applicantId: applicantId || selectedChat.applicantId || '',
 ownerName: selectedChat.ownerName || relatedQuest?.creatorName || 'صاحب المهمة',
 ownerAvatar: selectedChat.ownerAvatar || relatedQuest?.creatorAvatar || '',
 applicantName: selectedChat.applicantName || relatedQuest?.helperName || 'المساعد الميداني',
 applicantAvatar: selectedChat.applicantAvatar || relatedQuest?.helperAvatar || '',
 questTitle: selectedChat.questTitle || relatedQuest?.title || '',
 messages: messagesToSave,
 readBy: [currentUserId]
 }, { merge: true });

 // Trigger context notification
 const recipientUserId = (currentUserId === ownerId) ? applicantId : ownerId;
 if (recipientUserId) {
 try {
 const senderName = newMessage.senderName || 'مستخدم كويست';
 const notifText = lang === 'ar'
 ? `رسالة جديدة من ${senderName}: ${newMessage.text} `
 : lang === 'fr'
 ? `Nouveau message de ${senderName}: ${newMessage.text} `
 : `New message from ${senderName}: ${newMessage.text} `;

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
 ? ` رسالة جديدة من ${senderName}`
 : lang === 'fr'
 ? ` Nouveau message de ${senderName}`
 : ` New message from ${senderName}`;
 
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
 // Soft-delete check: if chat was cleared/hidden locally, check if a new message has arrived since
 const hideTime = hiddenChatTimes[chat.id];
 if (hideTime) {
 const msgs = chat.messages || [];
 const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
 const lastMsgTime = lastMsg?.createdAt ? new Date(lastMsg.createdAt).getTime() : 0;
 if (lastMsgTime <= hideTime) {
 return false;
 }
 }

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
 }, [groupedChats, searchTerm, activeFilter, currentUserId, quests, hiddenChatTimes]);

 const activeQuestInfo = useMemo(() => {
 if (!selectedChat) return null;
 const qId = selectedChat.id.split('_')[0];
 return quests.find(q => q.id === qId) || null;
 }, [selectedChat, quests]);

 // Full Screen View redone entirely to be a beautiful dual-pane dashboard
 return (
 <div 
 id="full_inbox_container"
 className={`w-full bg-slate-50 flex h-[100dvh] font-sans relative overflow-hidden  ${selectedChat ? 'pt-0' : 'pt-16'} pb-0`}
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
 <div className="p-4 bg-white border-b border-slate-100/40 text-slate-800 flex justify-between items-center shrink-0">
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
 <div className="p-3 border-b border-slate-100/40 bg-slate-50/50 shrink-0">
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
 <div className="p-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0 border-b border-slate-100/40 scrollbar-none bg-slate-50/30">
 <button
 onClick={() => setActiveFilter('all')}
 className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
 activeFilter === 'all'
 ? 'bg-[#1F2A44] text-white shadow-xs'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 {t.all}
 </button>
 <button
 onClick={() => setActiveFilter('unread')}
 className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
 activeFilter === 'unread'
 ? 'bg-red-500 text-white shadow-xs'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 <span>{t.unread}</span>
 {groupedChats.filter(isChatUnread).length > 0 && (
 <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
 )}
 </button>
 <button
 onClick={() => setActiveFilter('employer')}
 className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
 activeFilter === 'employer'
 ? 'bg-[#1F2A44] text-white shadow-xs'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 <Briefcase className="w-3 h-3 text-sky-400 shrink-0" />
 <span className="whitespace-nowrap">{t.asEmployer}</span>
 </button>
 <button
 onClick={() => setActiveFilter('captain')}
 className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
 activeFilter === 'captain'
 ? 'bg-[#1F2A44] text-white shadow-xs'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 <UserCheck className="w-3 h-3 text-sky-400 shrink-0" />
 <span className="whitespace-nowrap">{t.asCaptain}</span>
 </button>
 <button
 onClick={() => setActiveFilter('archive')}
 className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
 activeFilter === 'archive'
 ? 'bg-amber-600 text-white shadow-xs'
 : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
 }`}
 >
 <FolderArchive className="w-3 h-3 text-amber-400 shrink-0" />
 <span className="whitespace-nowrap">{t.archive}</span>
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
 <div className="py-12 px-4 text-center space-y-3">
 <div className="mx-auto flex justify-center">
 <svg className="w-24 h-24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
 <circle cx="60" cy="60" r="50" className="fill-blue-50/80" />
 <circle cx="60" cy="60" r="38" className="fill-indigo-50/60" />
 <path d="M40 42C40 37.5817 43.5817 34 48 34H72C76.4183 34 80 37.5817 80 42V62C80 66.4183 76.4183 70 72 70H56L44 78V70H48C43.5817 70 40 66.4183 40 62V42Z" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="3" strokeLinejoin="round" />
 <path d="M70 66H76C79.3137 66 82 68.6863 82 72V80L76 76H70C66.6863 76 64 73.3137 64 70C64 67.7893 65.7893 66 68 66H70Z" fill="#3B82F6" />
 <circle cx="52" cy="52" r="3" fill="#60A5FA" />
 <circle cx="60" cy="52" r="3" fill="#3B82F6" />
 <circle cx="68" cy="52" r="3" fill="#1D4ED8" />
 <circle cx="92" cy="40" r="2.5" fill="#93C5FD" />
 <circle cx="28" cy="74" r="2" fill="#93C5FD" />
 </svg>
 </div>
 <p className="font-extrabold text-sm text-slate-700">
 {searchTerm ? t.noFilteredChats : (isRtl ? 'تظهر رسائلك هنا' : t.emptyState)}
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
 ? 'bg-sky-50 text-sky-700 border-sky-200/50'
 : 'bg-[#1F2A44]/10 text-[#1F2A44]/90 border-[#1F2A44]/20';

 return (
 <div
 key={chat.id}
 onTouchStart={() => handleTouchStart(chat)}
 onTouchEnd={handleTouchEnd}
 onTouchMove={handleTouchEnd}
 onMouseDown={() => handleTouchStart(chat)}
 onMouseUp={handleTouchEnd}
 onMouseLeave={handleTouchEnd}
 onClick={(e) => {
 if (isLongPressActiveRef.current) {
 e.preventDefault();
 e.stopPropagation();
 isLongPressActiveRef.current = false;
 return;
 }
 setSelectedChat(chat);
 }}
 className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex items-center gap-3 group ${
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
 className="relative w-10 h-10 shrink-0 font-sans cursor-pointer"
 >
 <div className="w-full h-full rounded-full overflow-hidden bg-slate-150 border border-slate-200 hover:opacity-85 transition-opacity">
 <img 
 src={recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
 alt={recipientName} 
 className="w-full h-full object-cover" 
 referrerPolicy="no-referrer"
 onError={(e) => {
 (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
 }}
 />
 </div>
 {isUnread ? (
 <span className={`absolute -bottom-0.5 ${isRtl ? '-left-0.5' : '-right-0.5'} z-30 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full shadow-xs`}></span>
 ) : (() => {
 const details = getInboxItemDetails(chat);
 const lastActiveTime = getRecipientLastActiveTime(chat, details.recipientId);
 const status = formatLastActive(lastActiveTime, lang);
 return (
 <span className={`absolute -bottom-0.5 ${isRtl ? '-left-0.5' : '-right-0.5'} z-30 w-3.5 h-3.5 border-2 border-white rounded-full shadow-xs ${status.dotColor}`}></span>
 );
 })()}
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
         <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md border shrink-0 whitespace-nowrap inline-flex items-center justify-center ${userRoleColor}`}>
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

   <div className="flex items-center gap-1 shrink-0">
     {isUnread && (
       <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
     )}
     <button
       type="button"
       onClick={(e) => {
         e.stopPropagation();
         setContextMenuChat(chat);
       }}
       className="p-1.5 rounded-full hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition-all cursor-pointer shrink-0"
       title={isRtl ? 'خيارات المحادثة' : 'Chat Options'}
     >
       <MoreVertical className="w-4 h-4" />
     </button>
   </div>
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
       <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] bg-white text-slate-850 flex justify-between items-center shrink-0 border-none">
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
               src={getInboxItemDetails(selectedChat).recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
               alt={getInboxItemDetails(selectedChat).recipientName} 
               className="w-full h-full object-cover" 
               referrerPolicy="no-referrer"
               onError={(e) => {
                 (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
               }}
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
                   <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                   <span className="text-[9.5px] text-amber-600 font-bold tracking-tight">
                     {lang === 'ar' ? 'مؤرشف ' : 'Archived '}
                   </span>
                 </>
               ) : (() => {
                 const recipientInfo = getInboxItemDetails(selectedChat);
                 const lastActiveTime = getRecipientLastActiveTime(selectedChat, recipientInfo.recipientId);
                 const status = formatLastActive(lastActiveTime, lang);
                 return (
                   <div className="flex items-center gap-1.5">
                     <span className={`w-2 h-2 rounded-full ${status.dotColor} shrink-0`}></span>
                     {status.text ? (
                       <span className="text-[9.5px] font-bold text-slate-500 tracking-tight">
                         {status.text}
                       </span>
                     ) : null}
                   </div>
                 );
               })()}
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
  return null;
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
    <div className={`p-4 bg-amber-50/80 text-center text-amber-800 text-xs font-black flex items-center justify-center gap-2 shrink-0 border-t border-amber-200/60 ${isNavVisible ? "pb-20 md:pb-4" : "pb-4"}`}>
      <FolderArchive className="w-4 h-4 text-amber-600 shrink-0" />
      <span>
        {lang === "ar" 
          ? "المحادثة مغلقة ومؤرشفة لعدم وجود مهمة نشطة تربط بين الطرفين" 
          : lang === "fr"
          ? "Discussion fermée et archivée (aucune mission active)"
          : "Conversation closed & archived (no active quest links both parties)"}
      </span>
    </div>
  ) : isChatPendingBooking(selectedChat) ? (
    <div className={`p-4 bg-amber-50 text-center text-amber-900 text-xs font-black flex items-center justify-center gap-2 shrink-0 ${isNavVisible ? "pb-20 md:pb-4" : "pb-4"}`}>
      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
      <span>{lang === "ar" ? " التواصل بالدردشة مغلق حالياً، وسيتم تفعيله فور قبول صاحب المهمة لطلب الحجز " : " Chat is locked until the creator accepts the booking request "}</span>
    </div>
  ) : (
    <div className={`p-3 bg-white/95 backdrop-blur-md flex items-center gap-2 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] ${isNavVisible ? "mb-16 md:mb-0" : "mb-0"}`}>
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

 {/* Long Press Context Menu Action Sheet Modal */}
 <AnimatePresence>
 {contextMenuChat && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setContextMenuChat(null)}
 className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4 font-sans"
 >
 <motion.div
 initial={{ y: 50, scale: 0.95 }}
 animate={{ y: 0, scale: 1 }}
 exit={{ y: 50, scale: 0.95 }}
 onClick={(e) => e.stopPropagation()}
 className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl border border-slate-150 text-right"
 style={{ direction: isRtl ? 'rtl' : 'ltr' }}
 >
 <div className="flex items-center justify-between border-b border-slate-100 pb-3">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-slate-150 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0 overflow-hidden">
 <img 
 src={getInboxItemDetails(contextMenuChat).recipientAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
 alt="" 
 className="w-full h-full object-cover" 
 />
 </div>
 <div className="min-w-0">
 <h4 className="font-extrabold text-xs text-slate-800 truncate">
 {getInboxItemDetails(contextMenuChat).recipientName}
 </h4>
 <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
 {contextMenuChat.questTitle || (isRtl ? 'محادثة مباشرة' : 'Direct Chat')}
 </p>
 </div>
 </div>
 <button
 onClick={() => setContextMenuChat(null)}
 className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="space-y-1.5 pt-1">
 {/* Soft Delete / Hide Conversation */}
 <button
 onClick={() => handleHideConversation(contextMenuChat)}
 className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-rose-50 text-rose-600 transition-colors group cursor-pointer"
 >
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-xl bg-rose-100/70 group-hover:bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
 <Trash2 className="w-4 h-4" />
 </div>
 <div className="text-right">
 <span className="text-xs font-black block">
 {isRtl ? 'حذف المحادثة' : 'Hide Conversation'}
 </span>
 <span className="text-[9.5px] text-rose-400 block font-normal">
 {isRtl ? 'ستختفي المحادثة وتظهر مجدداً فور وصول رسالة جديدة' : 'Hides until a new message arrives'}
 </span>
 </div>
 </div>
 </button>

 {/* Mute/Unmute Notifications */}
 <button
 onClick={() => {
 const chat = contextMenuChat;
 const newMuted = { ...mutedChats, [chat.id]: !mutedChats[chat.id] };
 setMutedChats(newMuted);
 try {
 localStorage.setItem(`muted_chats_${currentUserId}`, JSON.stringify(newMuted));
 } catch (e) {}
 setContextMenuChat(null);
 }}
 className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
 >
 <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
 {mutedChats[contextMenuChat.id] ? <Bell className="w-4 h-4 text-emerald-600" /> : <BellOff className="w-4 h-4" />}
 </div>
 <span className="text-xs font-bold">
 {mutedChats[contextMenuChat.id] 
 ? (isRtl ? 'إلغاء كتم الإشعارات' : 'Unmute Notifications')
 : (isRtl ? 'كتم الإشعارات' : 'Mute Notifications')}
 </span>
 </button>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}
