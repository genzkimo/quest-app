import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
 Wrench, 
 Truck, 
 BookOpen, 
 ShoppingCart, 
 Laptop, 
 Home as HomeIcon, 
 Heart, 
 HelpCircle, 
 Clock, 
 MapPin, 
 Share2, 
 AlertTriangle,
 BadgeAlert,
 Check,
 Zap,
 Search,
 SlidersHorizontal,
 X,
 MessageCircle,
 MessageSquare,
 Award,
 Sparkles,
 PartyPopper,
 Shield,
 Send,
 Upload,
 Image as ImageIcon,
 Camera,
 Trash,
 Eye,
 Plus,
 Lock,
 ChevronDown,
 Compass,
 Navigation,
 RefreshCw,
 LayoutGrid,
 Briefcase
} from 'lucide-react';
import { Quest, QuestCategory, UserProfile } from '../types';
import { Geolocator } from '../utils/geolocator';
import { formatArabicDate } from '../utils/dateFormatter';
import { cleanLocationName } from '../utils/locationFormatter';
import { Capacitor } from '@capacitor/core';
import { calculateBookingFee } from '../utils/fee';
import { db } from '../utils/firebase';
import { doc, updateDoc, arrayUnion, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { translations } from '../data/translations';
import { playCoinSound, playConfirmSound, triggerHaptic, playLockAndLoadCoins } from '../utils/audio';

interface HomeViewProps {
 quests: Quest[];
 userProfile: UserProfile;
 lang: 'ar' | 'fr' | 'en';
 onBookQuest: (questId: string, bookingFee: number) => void;
 onFlagQuest: (questId: string) => void;
 showToast: (msg: string) => void;
 onViewPublicProfile: (userId: string) => void;
 setQuests?: (quests: Quest[]) => void;
 initialSelectedQuestId?: string | null;
 onClearInitialSelectedQuest?: () => void;
 onViewQuestDetail?: (id: string) => void;
 onUpdateProfile?: (updated: UserProfile) => void;
 onTriggerCreateQuest?: () => void;
 onViewChange?: (view: any) => void;
 onStartNavigation?: (quest: Quest) => void;
}

const CATEGORIES_MAP: Record<QuestCategory, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
 'صيانة': { icon: Wrench, color: 'text-[#FFD34D]' },
 'توصيل': { icon: Truck, color: 'text-[#FF3B7C]' },
 'تعليم': { icon: BookOpen, color: 'text-[#38BDF8]' },
 'تسوق': { icon: ShoppingCart, color: 'text-[#FFD34D]' },
 'تقنية': { icon: Laptop, color: 'text-[#38BDF8]' },
 'مساعدة منزلية': { icon: HomeIcon, color: 'text-[#38BDF8]' },
 'رعاية أليفة': { icon: Heart, color: 'text-[#FF3B7C]' },
 'أخرى': { icon: HelpCircle, color: 'text-slate-400' },
};

// Simulated pre-baked comments for quests to make the feed feel incredibly active
const MOCK_QUEST_COMMENTS: Record<string, { author: string; avatar: string; text: string; time: string }[]> = {
 'q-1': [
 { author: 'سليم بلحاج', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80', text: 'صيانة ممتازة، قمت بحجز عمل مع أبو أحمد الأسبوع الماضي وكان سريع ومحترم جداً.', time: 'منذ دقيقة' },
 { author: 'أمينة منصوري', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80', text: 'حي الكدية قريب تفضل يا بطل!', time: 'منذ ١٠ دقائق' }
 ],
 'q-2': [
 { author: 'كمال جربوعة', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80', text: 'ربي ييسر الشفاء للوالدة الكريمة، عسى رانر سريع يتنقل فوراً.', time: 'منذ ٥ دقائق' }
 ],
 'q-3': [
 { author: 'يوسف رفيق', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80', text: 'فكرة رائعة! لغة جافا مهمة جداً للامتحانات استدراكي.', time: 'منذ ساعة' }
 ]
};

const formatTime = (isoString: string, lang: string) => {
 try {
 const date = new Date(isoString);
 const diffMs = Date.now() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 if (diffMins < 1) return lang === 'ar' ? 'الآن' : 'Just now';
 if (diffMins < 60) return lang === 'ar' ? `منذ ${diffMins} د` : `${diffMins}m ago`;
 const diffHours = Math.floor(diffMins / 60);
 if (diffHours < 24) return lang === 'ar' ? `منذ ${diffHours} سا` : `${diffHours}h ago`;
 return date.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'en-US');
 } catch {
 return lang === 'ar' ? 'مؤخراً' : 'Recently';
 }
};

export default function HomeView({ 
 quests, 
 userProfile, 
 lang, 
 onBookQuest, 
 onFlagQuest,
 showToast,
 onViewPublicProfile,
 setQuests,
 initialSelectedQuestId,
 onClearInitialSelectedQuest,
 onViewQuestDetail,
 onUpdateProfile,
 onTriggerCreateQuest,
 onViewChange,
 onStartNavigation
}: HomeViewProps) {
 const dict = translations[lang] || translations.ar;
 const isRtl = lang === 'ar';

 const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
 const [gpsDenied, setGpsDenied] = useState<boolean>(false);
 const [isGpsRequesting, setIsGpsRequesting] = useState<boolean>(false);
 const [visibleCount, setVisibleCount] = useState<number>(30);
 const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

 const requestHomeLocation = async () => {
 setIsGpsRequesting(true);
 try {
 const coords = await Geolocator.getCurrentPhysicalLocation();
 setUserLoc(coords);
 setGpsDenied(false);
 } catch {
 setGpsDenied(true);
 } finally {
 setIsGpsRequesting(false);
 }
 };

 useEffect(() => {
 requestHomeLocation();
 }, []);

 const calculateDistanceKm = (targetLat: number, targetLng: number) => {
 if (!userLoc) return -1;
 const R = 6371;
 const dLat = (targetLat - userLoc.lat) * (Math.PI / 180);
 const dLng = (targetLng - userLoc.lng) * (Math.PI / 180);
 const a =
 Math.sin(dLat / 2) * Math.sin(dLat / 2) +
 Math.cos(userLoc.lat * (Math.PI / 180)) *
 Math.cos(targetLat * (Math.PI / 180)) *
 Math.sin(dLng / 2) *
 Math.sin(dLng / 2);
 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
 return Math.round(R * c);
 };

 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<QuestCategory | 'all'>('all');
 const [selectedQuestTypeFilter, setSelectedQuestTypeFilter] = useState<'all' | 'quick' | 'long_term'>('all');
 const [showGuidance, setShowGuidance] = useState<boolean>(() => {
 try {
 return localStorage.getItem('algeria_quest_guidance_dismissed') !== 'true';
 } catch {
 return true;
 }
 });
 const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
 const [lightboxImage, setLightboxImage] = useState<string | null>(null);
 const [showKycBlocker, setShowKycBlocker] = useState(false);
 const [showFundsBlocker, setShowFundsBlocker] = useState(false);
 const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

 // --- Dynamic 7-Day Daily Check-in System (Token Economy matrix) ---
 const DAILY_REWARDS = [1, 2, 3, 5, 7, 10, 50];

 const getLocalDateString = (d: Date = new Date()) => {
 const year = d.getFullYear();
 const month = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${year}-${month}-${day}`;
 };

 const getDaysDifference = (dateStr1: string, dateStr2: string) => {
 if (!dateStr1 || !dateStr2) return 999;
 const d1 = new Date(dateStr1 + 'T00:00:00');
 const d2 = new Date(dateStr2 + 'T00:00:00');
 const diffTime = d2.getTime() - d1.getTime();
 return Math.round(diffTime / (1000 * 60 * 60 * 24));
 };

 const [secondsUntilMidnight, setSecondsUntilMidnight] = useState(() => {
 const now = new Date();
 const midnight = new Date();
 midnight.setHours(24, 0, 0, 0);
 return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
 });

 useEffect(() => {
 const timer = setInterval(() => {
 const now = new Date();
 const midnight = new Date();
 midnight.setHours(24, 0, 0, 0);
 setSecondsUntilMidnight(Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000)));
 }, 1000);
 return () => clearInterval(timer);
 }, []);

 useEffect(() => {
 if (userProfile?.id) {
 const hasBookedOrCreated = quests.some(
 q => q.creatorId === userProfile.id || 
 q.helperId === userProfile.id || 
 q.assignedRunnerId === userProfile.id || 
 (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id))
 );
 if (!hasBookedOrCreated) {
 setShowGuidance(true);
 }
 }
 }, [quests, userProfile?.id]);

 const formatCountdown = (totalSeconds: number) => {
 const hours = Math.floor(totalSeconds / 3600);
 const minutes = Math.floor((totalSeconds % 3600) / 60);
 const seconds = totalSeconds % 60;
 return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
 };

 const lastCheckIn = userProfile.lastCheckInDate || '';
 const currentStreak = userProfile.checkInStreak || 0;
 const todayStr = getLocalDateString();
 const daysDiff = getDaysDifference(lastCheckIn, todayStr);

 const alreadyCheckedInToday = !!(lastCheckIn && daysDiff === 0);
 const isConsecutive = !!(lastCheckIn && daysDiff === 1);
 const isStreakBroken = !!(lastCheckIn && daysDiff > 1);

 // Determine active check-in highlight index in the matrix (1-based: 1..7)
 let activeClaimDay = 1;
 if (lastCheckIn) {
 if (alreadyCheckedInToday) {
 activeClaimDay = currentStreak === 7 ? 1 : currentStreak;
 } else if (isConsecutive) {
 activeClaimDay = currentStreak === 7 ? 1 : currentStreak + 1;
 } else {
 activeClaimDay = 1; // broken streak
 }
 } else {
 activeClaimDay = 1;
 }

 const claimDailyReward = () => {
 const today = getLocalDateString();
 const lastCheck = userProfile.lastCheckInDate || '';
 const streak = userProfile.checkInStreak || 0;
 const diff = getDaysDifference(lastCheck, today);

 let newStreak = 1;
 let reward = 1;

 if (!lastCheck) {
 newStreak = 1;
 reward = DAILY_REWARDS[0];
 } else if (diff === 0) {
 showToast(lang === 'ar' ? 'لقد سجلت حضورك اليوم بالفعل! عد غداً.' : 'Already checked-in today! Come back tomorrow.');
 return;
 } else if (diff === 1) {
 if (streak >= 7) {
 newStreak = 1;
 reward = DAILY_REWARDS[0];
 } else {
 newStreak = streak + 1;
 reward = DAILY_REWARDS[newStreak - 1];
 }
 } else {
 // Streak Broken penalty: Reset back to Day 1
 newStreak = 1;
 reward = DAILY_REWARDS[0];
 }

 const newBalance = userProfile.tokenBalance + reward;

 if (onUpdateProfile) {
 onUpdateProfile({
 ...userProfile,
 tokenBalance: newBalance,
 lastCheckInDate: today,
 checkInStreak: newStreak,
 });

 const audioEnabled = userProfile.audioEffectsEnabled !== false;
 const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
 playCoinSound(audioEnabled);
 if (newStreak === 7) {
 setTimeout(() => playLockAndLoadCoins(audioEnabled), 150);
 }
 triggerHaptic('sharp', hapticEnabled);

 if (newStreak === 7) {
 showToast(lang === 'ar'
 ? ` رائع وممتاز! لقد حصلت على الجائزة الكبرى لليوم السابع: +50 د.ج رصيد استخدام!`
 : ` Grand achievement! Credited Day 7 Jackpot: +50 DA usage balance!`
 );
 } else {
 showToast(lang === 'ar'
 ? ` تم تسجيل حضورك لليوم ${newStreak}! وحصلت على +${reward} د.ج رصيد استخدام.`
 : ` Success! Day ${newStreak} check-in recorded: +${reward} DA usage balance added.`
 );
 }
 }
 };

 // Trigger selection of a quest from notification or external deep-link
 useEffect(() => {
 if (initialSelectedQuestId) {
 const q = quests.find(item => item.id === initialSelectedQuestId);
 if (q) {
 if (onViewQuestDetail) {
 onViewQuestDetail(q.id);
 } else {
 setSelectedQuest(q);
 }
 }
 if (onClearInitialSelectedQuest) {
 onClearInitialSelectedQuest();
 }
 }
 }, [initialSelectedQuestId, quests, onClearInitialSelectedQuest, onViewQuestDetail]);
 // Community-oriented reactive states on client feed
 const [likedQuests, setLikedQuests] = useState<Record<string, boolean>>({});
 const [likedCounts, setLikedCounts] = useState<Record<string, number>>({
 'q-1': 14,
 'q-2': 8,
 'q-3': 24,
 'q-4': 5
 });
 const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
 const [userComments, setUserComments] = useState<Record<string, { author: string; avatar: string; text: string; time: string }[]>>(MOCK_QUEST_COMMENTS);
 const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});

 const handleBookTaskClick = (quest: Quest, e: React.MouseEvent) => {
 e.stopPropagation();
 
 // Strict GPS Location check: Booking requires active GPS location
 if (gpsDenied || !userLoc) {
 showToast(
 lang === 'ar' 
 ? ' لا يمكن حجز الكويست إلا بعد تفعيل خدمة تحديد الموقع (GPS)' 
 : ' Cannot book quest without enabling GPS location service'
 );
 requestHomeLocation();
 return;
 }

 // Check Token balance (Requires 5%, min 35 tokens, max 2000 tokens)
 const fee = calculateBookingFee(quest.cashReward, quest.questType);
 if (userProfile.tokenBalance < fee) {
 showToast(lang === 'ar' ? ' رصيد غير كافٍ لدفع رسوم الحجز.' : ' Insufficient balance for booking fee.');
 return;
 }

 // Confirm booking to parent
 onBookQuest(quest.id, fee);
 setSelectedQuest(null);

 // Audio effects & haptic vibrator alerts on booking contract
 const audioEnabled = userProfile.audioEffectsEnabled !== false;
 const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
 playLockAndLoadCoins(audioEnabled);
 triggerHaptic('sharp', hapticEnabled);
 };

 const handleFlagClick = (quest: Quest, e: React.MouseEvent) => {
 e.stopPropagation();
 onFlagQuest(quest.id);
 };

 const shareToPlatform = (quest: Quest, e: React.MouseEvent) => {
 e.stopPropagation();
 // Native sharing simulation with dynamic social content
 const shareText = ` ${quest.title} \n ${quest.location} \n المكافأة: ${quest.cashReward} د.ج \n\nانضم لـ كويست الجزائر وساعد الجيران! #كويست_الجزائر`;
 if (navigator.share) {
 navigator.share({
 title: 'کویست الجزائر',
 text: shareText,
 url: window.location.href,
 }).then(() => {
 showToast(' تم استدعاء واجهة مشاركة نظام التشغيل بنجاح!');
 }).catch(() => {
 showShareFeedback();
 });
 } else {
 showShareFeedback();
 }
 };

 const showShareFeedback = () => {
 showToast(lang === 'ar' 
 ? ' تم نسخ رابط العرض بنجاح لمشاركته في فيسبوك / ماسنجر!' 
 : ' Quest link successfully copied to your Clipboard to share in Facebook / Messenger!'
 );
 };

 // Toggle user like status
 const handleLikeToggle = (questId: string, e: React.MouseEvent) => {
 e.stopPropagation();
 const isLiked = !!likedQuests[questId];
 setLikedQuests({
 ...likedQuests,
 [questId]: !isLiked
 });
 setLikedCounts({
 ...likedCounts,
 [questId]: (likedCounts[questId] || 0) + (isLiked ? -1 : 1)
 });
 if (!isLiked) {
 showToast(lang === 'ar' ? ' تم تسجيل إعجابك بالعرض!' : ' Registered like on quest post!');
 }
 };

 // Expand comments section
 const handleToggleComments = (questId: string, e: React.MouseEvent) => {
 e.stopPropagation();
 setExpandedComments({
 ...expandedComments,
 [questId]: !expandedComments[questId]
 });
 };

 // Submit comment inside feed Card
 const handleAddCommentSubmit = (questId: string, e: React.FormEvent) => {
 e.preventDefault();
 const text = newCommentTexts[questId]?.trim();
 if (!text) return;

 const audioEnabled = userProfile?.audioEffectsEnabled !== false;
 const hapticEnabled = userProfile?.hapticFeedbackEnabled !== false;
 playConfirmSound(audioEnabled);
 triggerHaptic('sharp', hapticEnabled);

 const commentId = Math.random().toString(36).substring(2, 9);
 const commentObj = {
 id: commentId,
 authorId: userProfile.id,
 authorName: userProfile.name,
 authorAvatar: userProfile.avatar,
 text: text,
 createdAt: new Date().toISOString()
 };

 // Update local state instantly for supreme responsiveness
 if (setQuests) {
 const updatedQuests = quests.map(q => {
 if (q.id === questId) {
 return {
 ...q,
 comments: [...(q.comments || []), commentObj]
 };
 }
 return q;
 });
 setQuests(updatedQuests);
 }

 const questRef = doc(db, 'quests', questId);
 updateDoc(questRef, {
 comments: arrayUnion(commentObj)
 }).catch(err => {
 console.error("Failed to persist comment in Firestore:", err);
 });

 const targetQuest = quests.find(q => q.id === questId);
 if (targetQuest && targetQuest.creatorId && targetQuest.creatorId !== userProfile.id) {
 const notifRef = doc(collection(db, 'notifications'));
 const notifText = lang === 'ar'
 ? ` علق [${userProfile.name}] على كويستك "${targetQuest.title}": "${text}"`
 : ` [${userProfile.name}] commented on your quest "${targetQuest.title}": "${text}"`;

 setDoc(notifRef, {
 id: notifRef.id,
 userId: targetQuest.creatorId,
 text: notifText,
 questId: questId,
 createdAt: new Date().toISOString(),
 read: false,
 type: 'comment'
 }).catch(err => {
 console.error("Failed to persist notification in Firestore:", err);
 });
 }

 setNewCommentTexts({
 ...newCommentTexts,
 [questId]: ''
 });

 showToast(lang === 'ar' ? ' تم نشر تعليقك على هذا العرض بنجاح!' : ' Posted your comment on this quest!');
 };



 const pinnedActiveQuests = useMemo(() => {
 if (!userProfile) return [];
 const activeStatuses = ['booked', 'active', 'arrived', 'pending_verification', 'disputed'];
 return quests.filter(q => {
 if (q.questType === 'long_term') return false; // Long-term quests are continuous, don't pin on home
 if (!activeStatuses.includes(q.status)) return false;
 const isCreator = q.creatorId === userProfile.id;
 const isRunner = 
 q.helperId === userProfile.id || 
 q.assignedRunnerId === userProfile.id || 
 (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id));
 return isCreator || isRunner;
 });
 }, [quests, userProfile]);

 const filteredQuests = useMemo(() => {
 const qSearch = searchQuery.toLowerCase();
 return quests
 .filter(q => (q.status === 'open' || q.status === 'applications') && !q.archived)
 .filter(q => {
 const matchText = q.title.toLowerCase().includes(qSearch) || 
 q.description.toLowerCase().includes(qSearch) ||
 q.location.toLowerCase().includes(qSearch);
 const matchCat = selectedCategory === 'all' || q.category === selectedCategory;
 const qType = q.questType || 'quick';
 const matchType = selectedQuestTypeFilter === 'all' || qType === selectedQuestTypeFilter;
 return matchText && matchCat && matchType;
 });
 }, [quests, searchQuery, selectedCategory, selectedQuestTypeFilter]);

 const questsWithDistance = useMemo(() => {
 return filteredQuests.map(q => {
 const d = calculateDistanceKm(q.lat, q.lng);
 return {
 ...q,
 distanceKm: d
 };
 });
 }, [filteredQuests, userLoc]);

 const { inRangeQuests, outOfRangeQuests } = useMemo(() => {
 // If userLoc is null, distanceKm will be -1, we want all quests to be visible
 const inRange = questsWithDistance.filter(q => q.distanceKm === -1 || q.distanceKm <= 50);
 const outOfRange = questsWithDistance.filter(q => q.distanceKm !== -1 && q.distanceKm > 50);

 // Sort in-range quests: nearest distance first when distance is calculated
 inRange.sort((a, b) => {
 if (a.distanceKm !== -1 && b.distanceKm !== -1) {
 if (a.distanceKm !== b.distanceKm) {
 return a.distanceKm - b.distanceKm; // Nearest first
 }
 }
 return b.cashReward - a.cashReward;
 });

 outOfRange.sort((a, b) => {
 if (a.distanceKm !== -1 && b.distanceKm !== -1) {
 return a.distanceKm - b.distanceKm;
 }
 return b.cashReward - a.cashReward;
 });

 return { inRangeQuests: inRange, outOfRangeQuests: outOfRange };
 }, [questsWithDistance]);

 const paginatedInRangeQuests = useMemo(() => {
 return inRangeQuests.slice(0, visibleCount);
 }, [inRangeQuests, visibleCount]);

 // Setup IntersectionObserver for smooth smart infinite scrolling
 useEffect(() => {
 const el = loadMoreSentinelRef.current;
 if (!el) return;
 const observer = new IntersectionObserver((entries) => {
 if (entries[0].isIntersecting) {
 setVisibleCount((prev) => {
 if (prev < inRangeQuests.length) {
 return prev + 30;
 }
 return prev;
 });
 }
 }, { threshold: 0.1 });
 observer.observe(el);
 return () => {
 observer.disconnect();
 };
 }, [inRangeQuests.length]);

 const activeQuestCount = userProfile?.hasActiveQuest === false ? 0 : quests.filter(q => q.creatorId === userProfile?.id && q.status !== 'completed' && q.status !== 'cancelled' && q.status !== 'cancelled_by_timeout' && q.status !== 'stale_cleared').length;

 const handleRefresh = async () => {
 try {
 // 1. Fetch latest quests directly from Firestore
 const questsQuery = query(collection(db, 'quests'), orderBy('createdAt', 'desc'), limit(300));
 const questsSnapshot = await getDocs(questsQuery);
 const fetchedQuests: Quest[] = [];
 questsSnapshot.forEach((doc) => {
 fetchedQuests.push({ id: doc.id, ...doc.data() } as any);
 });

 // Update parent global states
 if (setQuests && fetchedQuests.length > 0) {
 setQuests(fetchedQuests);
 }
 
 showToast(lang === 'ar' ? ' تم تحديث قائمة الكويستات بنجاح!' : ' Feed updated successfully!');
 } catch (error) {
 console.error("Failed to refresh feed:", error);
 showToast(lang === 'ar' ? ' فشل تحديث البيانات، يرجى التحقق من اتصال الشبكة.' : ' Failed to update feed. Please check network.');
 }
 };

 return (
 <PullToRefresh
 onRefresh={handleRefresh}
 lang={lang}
 audioEffectsEnabled={userProfile?.audioEffectsEnabled !== false}
 hapticFeedbackEnabled={userProfile?.hapticFeedbackEnabled !== false}
 >
 <div className="space-y-6 pb-32 font-sans text-[#1F2A44]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>

 {/* VERTICAL PREMIUM SOCIAL FEED PLAYGROUND */}
 <div id="social-media-feed-track" className="space-y-6">
 
 {/* SOCIAL MEDIA FEED TRACK */}

 <div className="flex items-center justify-between px-1 flex-wrap gap-2">
 <h2 className="text-sm font-black text-[#1F2A44] flex items-center gap-1.5">
 <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B7C] animate-ping"></span>
 <span>{lang === 'ar' ? 'كويستات وفرص العمل' : 'Live Quest & Jobs Stream'}</span>
 <span className="text-[11px] text-gray-400 font-bold">({filteredQuests.length})</span>
 </h2>

 {/* Opportunity Type Filter Toggle Bar */}
 <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
 <button
 type="button"
 onClick={() => setSelectedQuestTypeFilter('all')}
 className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
 selectedQuestTypeFilter === 'all'
 ? 'bg-[#1F2A44] text-[#FFD34D] shadow-sm'
 : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
 }`}
 >
 <LayoutGrid className="w-3.5 h-3.5" />
 <span>{lang === 'ar' ? 'الكل' : 'All'}</span>
 </button>

 <button
 type="button"
 onClick={() => setSelectedQuestTypeFilter('quick')}
 className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
 selectedQuestTypeFilter === 'quick'
 ? 'bg-[#FF3B7C] text-white shadow-sm'
 : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
 }`}
 >
 <Zap className="w-3.5 h-3.5 text-[#FF3B7C]" />
 <span>{lang === 'ar' ? 'مهام سريعة' : 'Quick Tasks'}</span>
 </button>

 <button
 type="button"
 onClick={() => setSelectedQuestTypeFilter('long_term')}
 className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
 selectedQuestTypeFilter === 'long_term'
 ? 'bg-sky-600 text-white shadow-sm'
 : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
 }`}
 >
 <Briefcase className="w-3.5 h-3.5 text-sky-500" />
 <span>{lang === 'ar' ? 'عقود عمل' : 'Job Contracts'}</span>
 </button>
 </div>
 </div>

 {filteredQuests.length === 0 ? (
 <div className="bg-white py-12 px-4 rounded-3xl border border-gray-100 text-center space-y-4 shadow-xs">
 <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto">
 <SlidersHorizontal className="w-6 h-6 text-gray-300" />
 </div>
 <h3 className="font-extrabold text-xs text-slate-700">{lang === 'ar' ? 'لا توجد كويستات مطابقة لخيارات الفلترة' : 'No local chores match your filters'}</h3>
 <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
 {userLoc && !gpsDenied
 ? (lang === 'ar' ? 'حاول كتابة كلمات أخرى أو تبديل خيار التصنيف.' : 'Try changing search terms or category tags.')
 : (lang === 'ar' ? 'حاول كتابة كلمات أخرى أو تبديل خيار التصنيف أو انقر أسفله لتحديث موقعك وعرض المهام.' : 'Change the categorized tag or clear seek tags, or tap below to update location.')
 }
 </p>
 {(!userLoc || gpsDenied) && (
 <button
 type="button"
 onClick={requestHomeLocation}
 disabled={isGpsRequesting}
 className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
 >
 <MapPin className="w-4 h-4 text-[#FF3B7C]" />
 {isGpsRequesting
 ? (lang === 'ar' ? 'جاري تحديد الموقع... ' : 'Locating... ')
 : (lang === 'ar' ? 'تحديد الموقع وعرض المهام ' : 'Update Location & Show Tasks ')}
 </button>
 )}
 </div>
 ) : (
 <div className="space-y-6 max-w-2xl mx-auto">
 {(() => {
 const renderQuestCard = (quest: typeof quests[0] & { distanceKm?: number }, forcedOutsideRadius?: boolean) => {
 const tokenAmount = calculateBookingFee(quest.cashReward, quest.questType);
 const trueDistanceKm = quest.distanceKm !== undefined ? quest.distanceKm : calculateDistanceKm(quest.lat, quest.lng);
 const cardDistance = trueDistanceKm === -1 ? null : trueDistanceKm.toFixed(1);
 const isOutsideRadius = forcedOutsideRadius !== undefined ? forcedOutsideRadius : (trueDistanceKm !== -1 && trueDistanceKm > 50);
 const isLiked = !!likedQuests[quest.id];
 const likesCount = likedCounts[quest.id] || 0;
 const hasExpandedComments = !!expandedComments[quest.id];
 const questComments = [
 ...(quest.comments || []).map(c => ({
 author: c.authorName,
 avatar: c.authorAvatar,
 text: c.text,
 time: formatTime(c.createdAt, lang)
 })),
 ...((!quest.comments || quest.comments.length === 0) ? (MOCK_QUEST_COMMENTS[quest.id] || []) : [])
 ];

 const galleryImages: string[] = [];
 if (quest.images && Array.isArray(quest.images)) {
 galleryImages.push(...quest.images.filter(Boolean));
 }
 if (quest.imageUrls && Array.isArray(quest.imageUrls)) {
 quest.imageUrls.filter(Boolean).forEach(img => {
 if (!galleryImages.includes(img)) galleryImages.push(img);
 });
 }
 if (quest.imageUrl && typeof quest.imageUrl === 'string' && quest.imageUrl.trim() !== '') {
 if (!galleryImages.includes(quest.imageUrl)) galleryImages.push(quest.imageUrl);
 }
 const proofImgCard = (quest as any).proofImage || quest.proofImageUrl;
 if (proofImgCard && typeof proofImgCard === 'string' && !galleryImages.includes(proofImgCard)) {
 galleryImages.push(proofImgCard);
 }

 return (
 <div
 key={quest.id}
 style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}
 className={`bg-white border rounded-3xl overflow-hidden transition-all flex flex-col justify-between relative cursor-pointer ${
 isOutsideRadius ? 'border-dashed border-gray-300 bg-gray-50/45 opacity-85' : 'border-slate-900 hover:border-[#FF3B7C]'
 }`}
 onClick={() => {
 if (onViewQuestDetail) {
 onViewQuestDetail(quest.id);
 } else {
 setSelectedQuest(quest);
 }
 }}
 >
 
 {/* Glowing urgent indicator at the top banner of card */}
 {quest.urgency === 'urgent' && (
 <div className="bg-[#FF3B7C] text-white text-[9.5px] font-black py-1.5 px-4 uppercase tracking-wider flex items-center justify-between gap-1">
 <span className="flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
 {dict.urgencyUrgent} • {lang === 'ar' ? 'طلب عاجل جداً في ولايتك' : 'Extremely urgent neighbourhood request'}
 </span>
 <button
 onClick={(e) => {
 e.stopPropagation();
 const audioEnabled = userProfile.audioEffectsEnabled !== false;
 const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
 import('../utils/audio').then(m => {
 m.playUrgentRadarSound(audioEnabled);
 m.triggerHaptic('sharp', hapticEnabled);
 });
 showToast(lang === 'ar' ? ' إشارة الرادار: كشف خرق عاجل للحدود!' : ' Sonar Signal: Urgent bounty contract pinged!');
 }}
 className="text-[8.5px] bg-[#FFFFFF]/25 hover:bg-[#FFFFFF]/40 active:scale-95 text-white px-2.5 py-1 rounded-lg font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none border border-white/20 uppercase"
 >
 {lang === 'ar' ? 'مسح الإشارة' : lang === 'fr' ? 'Ping Sonar' : 'Ping Radar'}
 </button>
 </div>
 )}

 {quest.urgency === 'featured' && (
 <div className="bg-[#FFD34D] text-[#1F2A44] text-[9.5px] font-black py-1.5 px-4 uppercase tracking-wider flex items-center justify-between gap-1">
 <span> {dict.urgencyFeatured} • {lang === 'ar' ? 'مهمة مميزة ومثبتة للمجتمع' : 'Highly recommended communities chore'}</span>
 <span className="text-[8px] bg-black/10 text-[#1F2A44] px-2 py-0.5 rounded font-black">Featured</span>
 </div>
 )}

 <div className="p-5 space-y-4">
 
 {/* SOCIAL POST HEADER: Creator avatar, name, Sky Blue checkmark badge and localized timestamp */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="relative">
 {/* Inner glowing effect for Poster Avatar */}
 <div 
 className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-[#1F2A44]/10 to-[#1F2A44]/30 cursor-pointer"
 onClick={(e) => {
 e.stopPropagation();
 onViewPublicProfile(quest.creatorId);
 }}
 >
 <img 
 src={quest.creatorAvatar} 
 alt={quest.creatorName}
 referrerPolicy="no-referrer"
 className="w-full h-full rounded-full object-cover"
 />
 </div>
 {/* Sky Blue verification badge overlay on bottom right */}
 <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-gray-100 flex items-center justify-center">
 <Check className="w-2.5 h-2.5 text-[#4FC3F7] stroke-[4.5px]" />
 </div>
 </div>

 <div>
 <div className="flex items-center gap-1.5 text-start">
 <span 
 className="text-xs font-black text-[#1F2A44] hover:underline cursor-pointer"
 onClick={(e) => {
 e.stopPropagation();
 onViewPublicProfile(quest.creatorId);
 }}
 >
 {quest.creatorName}
 </span>
 {/* Sky Blue checkmark icon inside simple badge */}
 <span className="bg-[#4FC3F7]/15 text-[#4FC3F7] text-[8px] px-1.5 py-0.2 rounded font-black tracking-widest uppercase flex items-center gap-0.5">
 <span>VERIFIED</span>
 <span className="text-[7.5px]"></span>
 </span>
 </div>
 <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
 <Clock className="w-3.5 h-3.5 text-gray-300" />
 <span>{formatArabicDate(quest.createdAt, lang)}</span>
 </div>
 </div>
 </div>

 {/* Flagging alert banner and info */}
 {quest.flagsCount && quest.flagsCount > 0 ? (
 <div className="bg-[#FF3B7C]/10 text-[#FF3B7C] px-3 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 animate-pulse">
 <AlertTriangle className="w-3.5 h-3.5" />
 <span>{quest.flagsCount} FLAGS </span>
 </div>
 ) : null}
 </div>

 {/* SOCIAL POST BODY: Chores descriptions, landmarks, constraints, simulated hashtags */}
 <div className="space-y-4 text-start">
 
 <h4 className="text-lg sm:text-xl font-black text-sky-500 dark:text-sky-400 leading-snug tracking-tight text-start mt-1">
 {quest.title}
 </h4>

 <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line relative text-start mt-2">
 {quest.description}
 </div>

 {/* Standardized, non-stacking Image Grid Gallery */}
 {galleryImages.length > 0 && (
 <div className="space-y-1.5 pt-1">
 {galleryImages.length === 1 && (
 <div 
 className="w-full h-44 sm:h-48 max-h-48 sm:max-h-52 rounded-2xl overflow-hidden shadow-xs cursor-pointer relative bg-gray-50 border border-gray-150/70" 
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(galleryImages[0]);
 }}
 >
 <img src={galleryImages[0]} alt="Quest reference" className="w-full h-full object-cover hover:scale-[1.012] transition duration-300" referrerPolicy="no-referrer" />
 </div>
 )}
 {galleryImages.length === 2 && (
 <div className="grid grid-cols-2 gap-1.5 h-36 sm:h-40 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
 {galleryImages.map((img, idx) => (
 <div 
 key={idx} 
 className="h-full w-full cursor-pointer overflow-hidden relative" 
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(img);
 }}
 >
 <img src={img} alt={`Quest detailed ${idx + 1}`} className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 ))}
 </div>
 )}
 {galleryImages.length === 3 && (
 <div className="grid grid-cols-3 grid-rows-2 gap-1.5 h-36 sm:h-40 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
 <div 
 className="col-span-2 row-span-2 h-full cursor-pointer overflow-hidden relative" 
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(galleryImages[0]);
 }}
 >
 <img src={galleryImages[0]} alt="Quest principal" className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 {galleryImages.slice(1, 3).map((img, idx) => (
 <div 
 key={idx} 
 className="col-span-1 row-span-1 h-full w-full cursor-pointer overflow-hidden relative" 
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(img);
 }}
 >
 <img src={img} alt={`Quest detailed secondary ${idx + 2}`} className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 ))}
 </div>
 )}
 {galleryImages.length >= 4 && (
 <div className="grid grid-cols-3 grid-rows-3 gap-1.5 h-36 sm:h-40 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
 <div 
 className="col-span-2 row-span-3 h-full cursor-pointer overflow-hidden relative" 
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(galleryImages[0]);
 }}
 >
 <img src={galleryImages[0]} alt="Quest reference" className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 {galleryImages.slice(1, 4).map((img, idx) => {
 const isLast = idx === 2;
 const extraCount = galleryImages.length - 4;
 return (
 <div 
 key={idx} 
 className="col-span-1 row-span-1 h-full w-full cursor-pointer overflow-hidden relative" 
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(img);
 }}
 >
 <img src={img} alt={`Quest mini carousel ${idx + 2}`} className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 {isLast && extraCount > 0 && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs select-none">
 +{extraCount + 1}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>

 {/* DYNAMIC VISUAL TRANSACTION CALLOUT BOX - Dark Navy with precise typography */}
 <div className="bg-[#1F2A44] rounded-2xl p-4 border border-[#FFD34D]/20 relative overflow-hidden shadow-inner flex flex-col justify-between gap-3 text-start">
 
 {/* Technical abstract background art lines */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FFD34D]/5 to-transparent rounded-full blur-xl pointer-events-none"></div>
 
 <div className="flex justify-between items-center relative z-10">
 <div>
 <span className="text-[9.5px] text-[#4FC3F7] block font-black uppercase tracking-widest leading-none mb-1 text-start">
 {lang === 'ar' ? 'المكافأة' : 'Payout'}
 </span>
 <span className="text-xl font-black text-white font-mono flex items-baseline gap-1">
 {quest.cashReward} <span className="text-xs font-sans text-gray-300 font-semibold">{lang === 'ar' ? 'د.ج' : 'DZD'}</span>
 </span>
 </div>

 <div className="text-right">
 <span className="text-[9.5px] text-gray-300 block font-black uppercase tracking-widest leading-none mb-1">
 {lang === 'ar' ? 'رسوم الحجز' : 'Booking Fee'}
 </span>
 <span className="text-xs font-black text-[#FFD34D] font-mono flex items-center justify-end gap-1">
 {tokenAmount} 
 </span>
 </div>
 </div>

 {/* Hot Pink central action button or Applicant standby state */}
 {quest.applicants?.some(a => a.userId === userProfile.id) ? (
 <button
 disabled
 className="w-full bg-slate-800 border border-slate-700 text-slate-400 py-3 rounded-2xl font-bold text-[10px] sm:text-xs flex items-center justify-center p-2.5 gap-2"
 >
 <span className="text-center">{lang === 'ar' ? 'تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل ' : 'Application pending.. Awaiting creator selection '}</span>
 </button>
 ) : isOutsideRadius ? (
 <button
 disabled
 className="w-full bg-slate-400/40 border border-slate-300 text-slate-400 py-3.5 rounded-2xl font-bold text-[10px] sm:text-xs flex items-center justify-center p-2.5 gap-2 cursor-not-allowed opacity-75"
 >
 <MapPin className="w-4.5 h-4.5 text-slate-400" />
 <span className="text-center">{lang === 'ar' ? 'هذه المهمة خارج نطاقك الجغرافي المتاح للحجز ' : 'This quest is outside your available geographical booking limit '}</span>
 </button>
 ) : (
 <button
 onClick={(e) => handleBookTaskClick(quest, e)}
 className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white font-black text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF3B7C]/25 active:scale-95 cursor-pointer whitespace-nowrap"
 >
 <Award className="w-4.5 h-4.5" />
 <span>{lang === 'ar' ? 'احجز المهمة الآن ' : 'Book Quest Now '}</span>
 </button>
 )}
 </div>

 </div>

 {/* SOCIAL FEED CARDS ACTIONS PANEL: Hearts, Comments expanders, shares, Scam flags toggle */}
 <div className="bg-gray-50 border-t border-gray-100 flex items-center justify-between px-4 py-2 text-xs font-black">
 <div className="flex items-center gap-4 text-gray-500">
 
 {/* Simulated interactive Like option */}
 <button
 onClick={(e) => handleLikeToggle(quest.id, e)}
 className={`flex items-center gap-1.5 px-1 py-1 rounded-lg transition-colors cursor-pointer select-none group ${
 isLiked ? 'text-[#FF3B7C]' : 'hover:text-[#1F2A44]'
 }`}
 >
 <Heart className={`w-4 h-4 transition-all group-active:scale-150 ${isLiked ? 'fill-[#FF3B7C] text-[#FF3B7C]' : ''}`} />
 <span>{likesCount}</span>
 </button>

 {/* Expandable comments toggle */}
 <button
 onClick={(e) => handleToggleComments(quest.id, e)}
 className={`flex items-center gap-1.5 px-1 py-1 rounded-lg hover:text-[#1F2A44] cursor-pointer transition-colors ${
 hasExpandedComments ? 'text-[#1F2A44]' : ''
 }`}
 >
 <MessageCircle className="w-4 h-4" />
 <span>{questComments.length}</span>
 </button>
 </div>

 <div className="flex items-center gap-2">
 {/* Real-time distance of chore - display-only */}
 {(() => {
 const isRunner = userProfile && (quest.helperId === userProfile.id || quest.assignedRunnerId === userProfile.id || (quest.assignedRunnerIds && quest.assignedRunnerIds.includes(userProfile.id)));
 const isCreator = userProfile && quest.creatorId === userProfile.id;
 const canOpenMap = isRunner || isCreator;
 
 if (canOpenMap) {
 return (
 <div
 onClick={(e) => e.stopPropagation()}
 className="flex items-center gap-1 text-[#4FC3F7] font-mono font-extrabold text-[10px] bg-[#4FC3F7]/10 px-2.5 py-1 rounded-full select-none"
 title={lang === 'ar' ? 'المسافة الفعلية للمهمة' : 'Real-time distance'}
 >
 <MapPin className="w-3 h-3 text-[#4FC3F7]" />
 <span>{cardDistance ? `${cardDistance} km` : (lang === 'ar' ? 'الموقع غير متوفر ' : 'Location unavailable ')}</span>
 </div>
 );
 } else {
 return (
 <div
 onClick={(e) => e.stopPropagation()}
 className="flex items-center gap-1 text-gray-400 font-mono font-bold text-[10px] bg-gray-100 px-2.5 py-1 rounded-full select-none"
 title={lang === 'ar' ? 'الموقع مخفي حتى حجز الكويست' : 'Location hidden until booked'}
 >
 <Lock className="w-3 h-3 text-gray-400" />
 <span>{cardDistance ? `${cardDistance} km` : (lang === 'ar' ? 'الموقع غير متوفر ' : 'Location unavailable ')}</span>
 </div>
 );
 }
 })()}

 {/* Share button */}
 <button
 onClick={(e) => shareToPlatform(quest, e)}
 className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
 title={dict.shareMessenger}
 >
 <Share2 className="w-3.5 h-3.5 text-gray-500" />
 </button>

 {/* Flag Scam Shield button */}
 <button
 onClick={(e) => handleFlagClick(quest, e)}
 className="bg-red-50 text-[#FF3B7C] hover:bg-red-100 p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
 title={lang === 'ar' ? 'تبليغ عن محتوى غير لائق' : 'Flag this post for Scam Shield'}
 >
 <AlertTriangle className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* COMMENTS DRAWER / SECTION INDEED THE FEED CARD */}
 {hasExpandedComments && (
 <div 
 onClick={(e) => e.stopPropagation()} 
 className="bg-slate-50 border-t border-gray-100 p-4 space-y-3.5"
 >
 <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
 {lang === 'ar' ? 'محادثات الجيران والزملاء' : 'Direct Conversation with Neighbors'}
 </div>

 {/* List comments */}
 {questComments.length === 0 ? (
 <p className="text-[11px] text-gray-400 text-center py-2 font-medium">
 {lang === 'ar' ? 'لا توجد رسائل بعد. كن أول من يكتب استفساراً!' : 'No question comments listed yet. Ask a question regarding tools!'}
 </p>
 ) : (
 <div className="space-y-3">
 {questComments.map((cmt, idx) => (
 <div key={idx} className="flex gap-2.5 items-start">
 <img src={cmt.avatar} className="w-7 h-7 rounded-full object-cover border" />
 <div className="bg-white p-2.5 rounded-2xl border border-gray-100 flex-1 space-y-1">
 <div className="flex justify-between items-center">
 <strong className="text-[11px] font-black text-[#1F2A44]">{cmt.author}</strong>
 <span className="text-[9px] text-gray-450 font-mono">{cmt.time}</span>
 </div>
 <p className="text-[11px] font-medium text-gray-600 leading-relaxed">{cmt.text}</p>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Comment Input Form */}
 <form onSubmit={(e) => handleAddCommentSubmit(quest.id, e)} className="flex gap-2 items-center">
 <img src={userProfile.avatar} className="w-7 h-7 rounded-full object-cover border shrink-0" />
 <input
 type="text"
 placeholder={lang === 'ar' ? "اطرح سؤالاً عن أدوات العمل المطلوبة..." : "Ask owner a question regarding coordinates..."}
 value={newCommentTexts[quest.id] || ''}
 onChange={(e) => setNewCommentTexts({
 ...newCommentTexts,
 [quest.id]: e.target.value
 })}
 className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
 />
 <button
 type="submit"
 className="bg-[#1F2A44] text-[#FFD34D] p-2 rounded-xl hover:bg-[#1C283E] transition cursor-pointer"
 >
 <Send className="w-3.5 h-3.5" />
 </button>
 </form>
 </div>
 )}

 </div>
 );
 };

 return (
 <div className="space-y-6">
 {/* Tier 1 (In-Range Quests) */}
 {gpsDenied ? (
 <div className="bg-amber-500/10 border border-amber-500/30 p-8 rounded-3xl text-center space-y-4 shadow-xs animate-in fade-in duration-200">
 <div className="w-12 h-12 bg-amber-500/20 text-amber-900 rounded-full flex items-center justify-center mx-auto animate-pulse">
 <MapPin className="w-6 h-6 animate-bounce text-amber-900" />
 </div>
 <div className="space-y-1.5 max-w-md mx-auto">
 <h4 className="font-extrabold text-xs text-amber-950">
 {lang === 'ar' ? 'تحديد الموقع (GPS) غير مفعّل ' : 'GPS Location Disabled '}
 </h4>
 <p className="text-[11px] font-bold text-amber-900/90 leading-relaxed">
 {lang === 'ar'
 ? 'يرجى تفعيل خدمة تحديد الموقع (GPS) لتحديد موقعك واستعراض المهام القريبة منك.'
 : 'Please enable GPS location services to discover nearby tasks around you.'}
 </p>
 <p className="text-[10px] font-medium text-amber-800/80">
 {lang === 'ar'
 ? 'تنبيه: لن تظهر المهام القريبة منك إلا عند تفعيله والتصريح بموقعك الجغرافي.'
 : 'Notice: Nearby tasks will not appear until GPS is enabled and permitted.'}
 </p>
 </div>
 <button
 type="button"
 onClick={requestHomeLocation}
 disabled={isGpsRequesting}
 className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-2xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
 >
 {isGpsRequesting
 ? (lang === 'ar' ? 'جاري تحديد الموقع... ' : 'Locating... ')
 : (lang === 'ar' ? 'تفعيل الـ GPS وتحديد موقعي ' : 'Enable GPS & Locate Me ')}
 </button>
 </div>
 ) : inRangeQuests.length === 0 ? (
 <div className="bg-white border border-gray-100 p-8 rounded-3xl text-center space-y-3 shadow-xs">
 <div className="w-12 h-12 bg-[#FF3B7C]/10 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto animate-pulse">
 <MapPin className="w-5 h-5 animate-bounce" />
 </div>
 <h4 className="font-extrabold text-xs text-slate-700">
 {lang === 'ar' ? 'لا توجد كويستات قريبة في حيك حالياً ' : 'No nearby quests in your neighborhood currently '}
 </h4>
 <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
 {userLoc && !gpsDenied
 ? (lang === 'ar' ? 'تصفح باقي الكويستات بالأسفل أو عد لاحقاً لرؤية كويستات جديدة!' : 'Inspect available quests below or check back later for new ones!')
 : (lang === 'ar' ? 'انقر على الزر أدناه لتحديث موقعك وعرض المهام القريبة، أو تصفح الكويستات بالأسفل!' : 'Tap the button below to update your location & show nearby tasks, or inspect quests below!')
 }
 </p>
 {(!userLoc || gpsDenied) && (
 <button
 type="button"
 onClick={requestHomeLocation}
 disabled={isGpsRequesting}
 className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-2xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
 >
 <MapPin className="w-4 h-4 text-[#FF3B7C]" />
 {isGpsRequesting
 ? (lang === 'ar' ? 'جاري تحديد الموقع... ' : 'Locating... ')
 : (lang === 'ar' ? 'تحديد الموقع وعرض المهام ' : 'Update Location & Show Tasks ')}
 </button>
 )}
 </div>
 ) : (
 <>
 {paginatedInRangeQuests.map((quest) => renderQuestCard(quest, false))}
 
 {/* Infinite Scroll Load More Sentinel */}
 <div ref={loadMoreSentinelRef} className="pt-4 pb-2 text-center">
 {visibleCount < inRangeQuests.length ? (
 <button
 type="button"
 onClick={() => setVisibleCount((prev) => prev + 30)}
 className="px-6 py-3 bg-[#1F2A44] hover:bg-[#1F2A44]/90 text-white rounded-2xl text-xs font-black shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
 >
 <span>
 {lang === 'ar'
 ? `تحميل 30 كويست إضافية (${paginatedInRangeQuests.length} من ${inRangeQuests.length})`
 : `Load 30 More Quests (${paginatedInRangeQuests.length} of ${inRangeQuests.length})`}
 </span>
 <ChevronDown className="w-4 h-4 animate-bounce" />
 </button>
 ) : (
 inRangeQuests.length > 30 && (
 <span className="text-[10px] font-bold text-slate-400">
 {lang === 'ar' ? ' تم عرض جميع الكويستات القريبة المتوفرة بالكامل' : ' All available nearby quests loaded'}
 </span>
 )
 )}
 </div>
 </>
 )}

 {/* Tier 2 (Out-of-Range Quests) */}
 {outOfRangeQuests.length > 0 && (
 <div className="pt-4 border-t border-gray-150/50 mt-8 space-y-4">
 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
 <MapPin className="w-4 h-4 text-slate-350 shrink-0" />
 <span>
 {lang === 'ar' 
 ? 'كويستات خارج نطاقك الجغرافي المتاح للحجز (أكثر من 50 كم) ' 
 : 'Quests Outside Your Geographical Booking Limit (> 50 km) '}
 </span>
 </h3>
 <div className="space-y-6">
 {outOfRangeQuests.map((quest) => renderQuestCard(quest, true))}
 </div>
 </div>
 )}
 </div>
 );
 })()}
 </div>
 )}
 </div>

 {/* DETAILED BOOKING FLOW PREVIEW DRAWER */}
 <AnimatePresence>
 {selectedQuest && (() => {
 const tokenAmount = calculateBookingFee(selectedQuest.cashReward, selectedQuest.questType);
 
 const galleryImages: string[] = [];
 if (selectedQuest.images && Array.isArray(selectedQuest.images)) {
 galleryImages.push(...selectedQuest.images.filter(Boolean));
 }
 if (selectedQuest.imageUrls && Array.isArray(selectedQuest.imageUrls)) {
 selectedQuest.imageUrls.filter(Boolean).forEach(img => {
 if (!galleryImages.includes(img)) galleryImages.push(img);
 });
 }
 if (selectedQuest.imageUrl && typeof selectedQuest.imageUrl === 'string' && selectedQuest.imageUrl.trim() !== '') {
 if (!galleryImages.includes(selectedQuest.imageUrl)) galleryImages.push(selectedQuest.imageUrl);
 }
 const proofImgSelected = (selectedQuest as any).proofImage || selectedQuest.proofImageUrl;
 if (proofImgSelected && typeof proofImgSelected === 'string' && !galleryImages.includes(proofImgSelected)) {
 galleryImages.push(proofImgSelected);
 }

 const getCategoryEquipment = (category: string) => {
 switch (category) {
 case 'صيانة':
 return [
 lang === 'ar' ? 'حقيبة أدوات الصيانة ومفاتيح الربط' : 'Maintenance tool bag & wrenches',
 lang === 'ar' ? 'مفكات براغي متنوعة وشريط كهربائي واقٍ' : 'Assorted screwdrivers & insulating tape',
 lang === 'ar' ? 'مصباح يدوي وقفازات أمان متينة للعمل الميداني' : 'Flashlight & sturdy work gloves'
 ];
 case 'توصيل':
 return [
 lang === 'ar' ? 'وسيلة نقل مناسبة (دراجة نارية أو سيارة)' : 'Suitable transport vehicle (moto/car)',
 lang === 'ar' ? 'حقيبة ظهر معزولة حرارياً لحماية الطلبات والسلع' : 'Insulated backpack for cargo protection',
 lang === 'ar' ? 'خوذة حماية وهاتف مشحون للتواصل والملاحة' : 'Safety helmet & charged GPS phone'
 ];
 case 'تعليم':
 return [
 lang === 'ar' ? 'جهاز كمبيوتر محمول أو كمبيوتر لوحي للشرح' : 'Laptop or tablet computer for explanation',
 lang === 'ar' ? 'كراس الملاحظات وأقلام ملونة للتوضيح التفاعلي' : 'Notebook & colored explanation markers'
 ];
 case 'تسوق':
 return [
 lang === 'ar' ? 'حقيبة تسوق قماشية صديقة للبيئة ومتينة' : 'Durable eco-friendly grocery bags',
 lang === 'ar' ? 'قائمة الطلبات المكتوبة مسبقاً لمراجعة الأسعار دقيقة' : 'Detailed shopping items index'
 ];
 case 'تقنية':
 return [
 lang === 'ar' ? 'جهاز لابتوب مجهز بأدوات التطوير والتحديث' : 'Developer laptop with specialized setups',
 lang === 'ar' ? 'كابل شبكة RJ45 ومفاتيح تخزين USB' : 'RJ45 network ethernet cables & USB storage keys',
 lang === 'ar' ? 'جهاز فحص الإشارة أو كود التفعيل المتاح' : 'Testing utility signal diagnostic dongles'
 ];
 case 'رعاية أليفة':
 return [
 lang === 'ar' ? 'حزام قيادة متين وطوق مخصص للسلامة' : 'Durable leash & secure safety collar',
 lang === 'ar' ? 'أكياس تجميع المخلفات ومطهر يدين' : 'Waste disposal pouches & hand sanitizers',
 lang === 'ar' ? 'طعام حيوانات جاف ومكافآت تدريبية صغيرة' : 'Pet food treats for behavioral rewarding'
 ];
 default:
 return [
 lang === 'ar' ? 'أدوات مخصصة ومعدات مناسبة لطبيعة الكويست' : 'Specific utility tools optimized for this role',
 lang === 'ar' ? 'هاتف ذكي مفعل به نظام تحديد المواقع العالمي GPS' : 'Active GPS-enabled smartphone'
 ];
 }
 };

 return (
 <div className="fixed inset-0 bg-[#1F2A44]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
 <motion.div
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col"
 >
 {/* 1. Upper Header & Prevention of UI Lockups */}
 <div className="p-6 pb-4 relative flex flex-col items-start border-b border-gray-100 bg-linear-to-b from-gray-50/50 to-white">
 {/* Dedicated, prominent floating "X" close button */}
 <button
 onClick={() => setSelectedQuest(null)}
 className="absolute top-5 right-5 bg-slate-900 hover:bg-slate-800 text-white rounded-full p-2.5 w-10 h-10 shadow-lg flex items-center justify-center transition-all duration-200 active:scale-90 z-20 cursor-pointer text-base focus:outline-none"
 title={lang === 'ar' ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
 >
 <X className="w-5 h-5 font-black shrink-0" />
 </button>

 <div className="flex flex-wrap gap-2 mb-2 pr-12">
 <span className="bg-[#1F2A44] text-[#FFD34D] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
 {selectedQuest.category}
 </span>
 {selectedQuest.urgency === 'urgent' && (
 <span className="bg-[#FF3B7C] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
 {lang === 'ar' ? 'عاجل جداً ' : 'Urgent '}
 </span>
 )}
 </div>

 {/* Created by owner block */}
 <div 
 className="flex items-center gap-2.5 mb-2 mt-1 cursor-pointer bg-slate-50 border border-gray-150/50 py-2 px-3.5 rounded-2xl hover:bg-slate-100 transition duration-150 text-start w-full"
 onClick={(e) => {
 e.stopPropagation();
 setSelectedQuest(null);
 onViewPublicProfile(selectedQuest.creatorId);
 }}
 >
 <img 
 src={selectedQuest.creatorAvatar} 
 alt={selectedQuest.creatorName} 
 className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" 
 referrerPolicy="no-referrer"
 />
 <div className="min-w-0">
 <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block leading-none mb-0.5">
 {lang === 'ar' ? 'صاحب الكويست' : 'Quest Creator'}
 </span>
 <span className="text-xs font-black text-[#1F2A44] hover:underline truncate block">
 {selectedQuest.creatorName}
 </span>
 </div>
 </div>

 <h3 className="text-2xl sm:text-3xl font-black text-sky-500 dark:text-sky-400 leading-snug tracking-tight text-start mt-1.5 pr-10 w-full">
 {selectedQuest.title}
 </h3>
 <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-semibold whitespace-pre-line text-start mt-3 w-full border-0 bg-transparent p-0">
 {selectedQuest.description}
 </p>

 {/* Images Section */}
 {galleryImages.length > 0 && (
 <div className="mt-4 w-full">
 {galleryImages.length === 1 && (
 <div className="w-full h-44 sm:h-48 max-h-48 sm:max-h-52 rounded-2xl overflow-hidden shadow-xs cursor-pointer relative bg-gray-50 border border-gray-150/70" onClick={() => setLightboxImage(galleryImages[0])}>
 <img src={galleryImages[0]} alt="Quest detail cover" className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 )}
 {galleryImages.length === 2 && (
 <div className="grid grid-cols-2 gap-2 h-44 sm:h-48 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
 {galleryImages.map((img, idx) => (
 <div key={idx} className="h-full w-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(img)}>
 <img src={img} alt={`Quest detailed reference ${idx + 1}`} className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 ))}
 </div>
 )}
 {galleryImages.length === 3 && (
 <div className="grid grid-cols-3 grid-rows-2 gap-2 h-40 sm:h-48 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
 <div className="col-span-2 row-span-2 h-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(galleryImages[0])}>
 <img src={galleryImages[0]} alt="Quest principal reference" className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 {galleryImages.slice(1, 3).map((img, idx) => (
 <div key={idx} className="col-span-1 row-span-1 h-full w-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(img)}>
 <img src={img} alt={`Quest detailed secondary ${idx + 2}`} className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 ))}
 </div>
 )}
 {galleryImages.length >= 4 && (
 <div className="grid grid-cols-3 grid-rows-3 gap-2 h-40 sm:h-48 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
 <div className="col-span-2 row-span-3 h-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(galleryImages[0])}>
 <img src={galleryImages[0]} alt="Quest core graphic reference" className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 </div>
 {galleryImages.slice(1, 4).map((img, idx) => {
 const isLast = idx === 2;
 const extraCount = galleryImages.length - 4;
 return (
 <div key={idx} className="col-span-1 row-span-1 h-full w-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(img)}>
 <img src={img} alt={`Quest detailed carousel mini ${idx + 2}`} className="w-full h-full object-cover hover:scale-102 transition duration-300" referrerPolicy="no-referrer" />
 {isLast && extraCount > 0 && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs select-none">
 +{extraCount + 1}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}



 {/* Location Area Details */}
 <div className="border-t border-gray-150 pt-4 text-start">
 <h4 className="text-gray-400 font-bold text-[10px] uppercase mb-1">{lang === 'ar' ? 'موقع المهمة' : 'Quest Location'}</h4>
 {(() => {
 const isApprovedAndActive = (selectedQuest.helperId === userProfile.id || selectedQuest.assignedRunnerId === userProfile.id || selectedQuest.assignedRunnerIds?.includes(userProfile.id)) && selectedQuest.status !== 'completed';
 const isLocationAuthorized = selectedQuest.creatorId === userProfile.id || isApprovedAndActive;
 return (
 <div className="w-full">
 {isLocationAuthorized ? (
 <button
 type="button"
 onClick={() => onStartNavigation(selectedQuest)}
 className="w-full flex items-center justify-center gap-2 bg-[#4FC3F7]/10 text-[#0284C7] hover:bg-[#4FC3F7]/20 p-3 rounded-2xl font-black cursor-pointer transition-all border border-[#4FC3F7]/30 text-xs"
 >
 <Navigation className="w-4 h-4 text-[#0284C7]" />
 <span>{lang === 'ar' ? ' عرض على الخريطة' : ' Open Map'}</span>
 </button>
 ) : (
 <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700 bg-amber-50/80 p-3 rounded-2xl border border-amber-200/60">
 <Lock className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
 <span>
 {lang === 'ar' ? ' الموقع مخفي حتى قبول الحجز' : ' Location hidden until booked'}
 </span>
 </div>
 )}
 </div>
 );
 })()}
 </div>
 </div>

 {/* 3. Bottom Action Card & Token Text Cleanup: Premium dark layout with pure required token labeling */}
 <div className="p-6 bg-[#1F2A44] border-t border-white/10 rounded-b-3xl">
 <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-3">
 <div className="flex justify-between items-center">
 <div>
 <span className="text-[9px] text-[#FFD34D] block font-black uppercase tracking-wider mb-1">
 {lang === 'ar' ? 'المكافأة' : 'Payout'}
 </span>
 <span className="text-xl sm:text-2xl font-black text-white font-mono flex items-baseline gap-1">
 {selectedQuest.cashReward} <span className="text-xs font-sans text-gray-300 font-semibold">{lang === 'ar' ? 'د.ج' : 'DZD'}</span>
 </span>
 </div>

 <div className="text-right">
 <span className="text-[9px] text-gray-300 block font-black uppercase tracking-wider mb-1">
 {lang === 'ar' ? 'رسوم الحجز' : 'Booking Fee'}
 </span>
 <span className="text-sm font-black text-[#FFD34D] font-mono flex items-center justify-end gap-1">
 {tokenAmount} 
 </span>
 </div>
 </div>

 <div className="space-y-2 pt-1">
 {selectedQuest.applicants?.some(a => a.userId === userProfile.id) ? (
 <button
 disabled
 className="w-full bg-white/10 text-gray-300 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2"
 >
 <span className="text-center">{lang === 'ar' ? 'تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل ' : 'Application pending.. Awaiting creator selection '}</span>
 </button>
 ) : (selectedQuest && calculateDistanceKm(selectedQuest.lat, selectedQuest.lng) > 50) ? (
 <button
 disabled
 className="w-full bg-white/10 border border-white/5 text-gray-400 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2 cursor-not-allowed opacity-75"
 >
 <MapPin className="w-4.5 h-4.5 text-gray-400" />
 <span className="text-center text-[10px] sm:text-xs">
 {lang === 'ar' ? 'هذه المهمة خارج نطاقك الجغرافي المتاح للحجز ' : 'This quest is outside your available geographical booking limit '}
 </span>
 </button>
 ) : (
 <button
 onClick={(e) => handleBookTaskClick(selectedQuest, e)}
 className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-[#FF3B7C]/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center"
 >
 <Award className="w-4.5 h-4.5" />
 <span>
 {lang === 'ar' 
 ? 'احجز المهمة الآن ' 
 : 'Book Quest Now '}
 </span>
 </button>
 )}
 <button
 onClick={() => setSelectedQuest(null)}
 className="w-full bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
 >
 {dict.cancelBtn}
 </button>
 </div>
 </div>
 </div>

 </motion.div>
 </div>
 );
 })()}
 </AnimatePresence>

 {/* KYC UNVERIFIED REJECT DIALOG MODAL BLOCKER */}
 <AnimatePresence>
 {showKycBlocker && (
 <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
 <motion.div
 initial={{ scale: 0.9, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.9, opacity: 0 }}
 className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl"
 >
 <div className="w-14 h-14 bg-[#4FC3F7]/10 text-[#4FC3F7] rounded-full flex items-center justify-center mx-auto">
 <BadgeAlert className="w-8 h-8" />
 </div>
 <h3 className="text-md font-black uppercase text-red-600">{lang === 'ar' ? 'درع الأمان: مطلوب التحقق من مراجعة KYC' : 'Scam Shield: KYC Identity Certification Required'}</h3>
 <p className="text-xs text-gray-555 leading-relaxed font-semibold">
 {lang === 'ar' 
 ? ' لحماية جيراننا في المنصة ومنع الاحتيال، يجب عليك رفع بطاقتك الشخصية وتوثيق هويتك لمرة واحدة قبل حجز أي مهمة!' 
 : ' Due to strict community anti-fraud safety measures, workers must provide KYC documentation prior to locking down local requests.'}
 </p>
 <div className="space-y-2 pt-2">
 <button
 onClick={() => {
 setShowKycBlocker(false);
 // Open Profile view directly by triggering programmatic action
 const profItem = document.querySelector('button[key="profile"]') as HTMLElement;
 if (profItem) {
 profItem.click();
 } else {
 showToast(lang === 'ar' ? 'انتقل إلى تبويب "الحساب" بالأعلى أو الأسفل لرفع بطاقة الهوية الوطنية' : 'Navigate into Profile Hub to submit verification.');
 }
 }}
 className="w-full bg-[#1F2A44] hover:bg-[#1f2a44]/90 text-white font-extrabold text-xs py-3.5 rounded-xl transition-all cursor-pointer shadow-md shadow-[#1F2A44]/20"
 >
 {lang === 'ar' ? 'الذهاب فوراً للخطوة والتحقق' : 'Submit My Identity Now'}
 </button>
 <button
 onClick={() => setShowKycBlocker(false)}
 className="w-full text-gray-400 hover:text-gray-650 text-[10px] font-bold cursor-pointer transition-colors"
 >
 {dict.cancelBtn}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 {/* GLORIOUS LIGHTBOX PREVIEW */}
 <AnimatePresence>
 {lightboxImage && (
 <div 
 className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 cursor-zoom-out select-none"
 onClick={() => setLightboxImage(null)}
 >
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 className="relative max-w-5xl max-h-screen flex items-center justify-center"
 >
 <img 
 src={lightboxImage} 
 alt="Enlarged zoom preview" 
 className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10" 
 />
 <button
 onClick={(e) => {
 e.stopPropagation();
 setLightboxImage(null);
 }}
 className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 w-10 h-10 transition z-50 shadow-md cursor-pointer border border-white/15 flex items-center justify-center"
 >
 <X className="w-5 h-5" />
 </button>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 </div>
 </PullToRefresh>
 );
}
