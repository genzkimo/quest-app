import React, { useState, useEffect, useMemo } from 'react';
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
  Trash,
  Eye,
  Plus,
  Lock
} from 'lucide-react';
import { Quest, QuestCategory, UserProfile, QuestStory } from '../types';
import { calculateBookingFee } from '../utils/fee';
import { db } from '../utils/firebase';
import { doc, updateDoc, arrayUnion, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { translations } from '../data/translations';
import { MOCK_STORIES } from '../data/mockData';
import { playCoinSound, playConfirmSound, triggerHaptic, playLockAndLoadCoins } from '../utils/audio';
import { compressImage } from '../utils/imageCompressor';

interface HomeViewProps {
  quests: Quest[];
  stories?: QuestStory[];
  onPublishStory?: (story: Partial<QuestStory>) => Promise<void>;
  onIncrementStoryView?: (storyId: string) => Promise<void>;
  onDeleteStory?: (storyId: string) => Promise<void>;
  userProfile: UserProfile;
  lang: 'ar' | 'fr' | 'en';
  onBookQuest: (questId: string, bookingFee: number) => void;
  onFlagQuest: (questId: string) => void;
  showToast: (msg: string) => void;
  onViewPublicProfile: (userId: string) => void;
  setQuests?: (quests: Quest[]) => void;
  setStories?: (stories: QuestStory[]) => void;
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
  'تعليم': { icon: BookOpen, color: 'text-[#4FC3F7]' },
  'تسوق': { icon: ShoppingCart, color: 'text-[#FFD34D]' },
  'تقنية': { icon: Laptop, color: 'text-[#4FC3F7]' },
  'مساعدة منزلية': { icon: HomeIcon, color: 'text-emerald-400' },
  'رعاية أليفة': { icon: Heart, color: 'text-[#FF3B7C]' },
  'أخرى': { icon: HelpCircle, color: 'text-gray-400' },
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
  stories = [],
  onPublishStory,
  onIncrementStoryView,
  onDeleteStory,
  userProfile, 
  lang, 
  onBookQuest, 
  onFlagQuest,
  showToast,
  onViewPublicProfile,
  setQuests,
  setStories,
  initialSelectedQuestId,
  onClearInitialSelectedQuest,
  onViewQuestDetail,
  onUpdateProfile,
  onTriggerCreateQuest,
  onViewChange,
  onStartNavigation
}: HomeViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory | 'all'>('all');
  const [showGuidance, setShowGuidance] = useState<boolean>(() => {
    try {
      return localStorage.getItem('algeria_quest_guidance_dismissed') !== 'true';
    } catch {
      return true;
    }
  });
  const [activeStory, setActiveStory] = useState<QuestStory | null>(null);
  const [storyTimer, setStoryTimer] = useState(100);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showKycBlocker, setShowKycBlocker] = useState(false);
  const [showFundsBlocker, setShowFundsBlocker] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  const [storyViewsMap, setStoryViewsMap] = useState<Record<string, number>>({
    's-1': 48,
    's-2': 114,
    's-3': 73
  });
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
          ? `🎉 رائع وممتاز! لقد حصلت على الجائزة الكبرى لليوم السابع: +50 ذخيرة ذهبية!`
          : `🎉 Grand achievement! Credited Day 7 Jackpot: +50 Gold Ammo!`
        );
      } else {
        showToast(lang === 'ar'
          ? `🔥 تم تسجيل حضورك لليوم ${newStreak}! وحصلت على +${reward} ذخيرة ذهبية.`
          : `🔥 Success! Day ${newStreak} check-in recorded: +${reward} Gold Ammo added.`
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
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyUploadProgress, setStoryUploadProgress] = useState(0);

  // States for story customizing wizard
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [storyCaption, setStoryCaption] = useState('');
  const [storySelectedImage, setStorySelectedImage] = useState<string>('');
  const [storyBgGradient, setStoryBgGradient] = useState<string>('linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)');
  const [storyTextColor, setStoryTextColor] = useState('#ffffff');
  const [storyTextBg, setStoryTextBg] = useState('rgba(15, 23, 42, 0.85)');
  const [storyTextPosition, setStoryTextPosition] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [storyFontSize, setStoryFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [storySticker, setStorySticker] = useState<string>('🎯 إثبات عمل');
  const [storyActiveTab, setStoryActiveTab] = useState<'media' | 'style' | 'sticker'>('media');

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
  const [storyReactMsg, setStoryReactMsg] = useState('');

  // Hardware GPS Coordinate Syncing
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDenied, setGpsDenied] = useState<boolean>(false);
  const [isGpsRequesting, setIsGpsRequesting] = useState<boolean>(false);

  const requestHomeLocation = () => {
    if (!navigator.geolocation) {
      setGpsDenied(true);
      return;
    }
    setIsGpsRequesting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsDenied(false);
        setIsGpsRequesting(false);
      },
      (error) => {
        console.warn("HomeView GPS tracking error: ", error);
        setGpsDenied(true);
        setIsGpsRequesting(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  };

  // Run GPS EXACTLY ONCE upon opening the home page
  useEffect(() => {
    requestHomeLocation();
  }, []);

  const calculateDistanceKm = (qLat?: number, qLng?: number) => {
    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') return -1;
    if (typeof qLat !== 'number' || typeof qLng !== 'number') return -1;
    const R = 6371; // Earth major radius in km
    const dLat = (qLat - userLoc.lat) * Math.PI / 180;
    const dLng = (qLng - userLoc.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLoc.lat * Math.PI / 180) * Math.cos(qLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    return parseFloat(dist.toFixed(1));
  };

  const dict = translations[lang];
  const isRtl = lang === 'ar';

  const categoryOptions: { name: QuestCategory; ar: string; fr: string; en: string }[] = [
    { name: 'صيانة', ar: 'صيانة ومقاولات', fr: 'Maintenance', en: 'Maintenance' },
    { name: 'توصيل', ar: 'خدمات توصيل وشحن', fr: 'Livraison', en: 'Delivery & Shipping' },
    { name: 'تعليم', ar: 'دروس تعليمية وتدريب', fr: 'Enseignement', en: 'Education & Tutoring' },
    { name: 'تسوق', ar: 'شراء قضيان وتسوق', fr: 'Courses', en: 'Shopping & Errands' },
    { name: 'تقنية', ar: 'صيانة روتر وبرمجة', fr: 'Technologie', en: 'IT & Software' },
    { name: 'مساعدة منزلية', ar: 'مساعدات تنظيف ومنزلية', fr: 'Aide Ménagère', en: 'Home Support' },
    { name: 'رعاية أليفة', ar: 'حيوانات أليفة', fr: 'Animaux', en: 'Pet Care' },
    { name: 'أخرى', ar: 'تصنيفات أخرى متنوعة', fr: 'Divers', en: 'Other' },
  ];

  // Story disappearing progress simulation
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeStory && !showDeleteConfirm) {
      interval = setInterval(() => {
        setStoryTimer((prev) => {
          if (prev <= 2) {
            clearInterval(interval);
            setTimeout(() => {
              setActiveStory(null);
            }, 0);
            return 100;
          }
          return prev - 2;
        });
      }, 120);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeStory, showDeleteConfirm]);

  React.useEffect(() => {
    if (activeStory) {
      setStoryTimer(100);
      setShowDeleteConfirm(false);
    }
  }, [activeStory]);

  const handleStoryUpload = () => {
    setIsCreatingStory(true);
    setStoryCaption('');
    setStorySelectedImage('');
    setStoryBgGradient('linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)');
    setStoryTextColor('#ffffff');
    setStoryTextBg('rgba(15, 23, 42, 0.85)');
    setStoryTextPosition('middle');
    setStoryFontSize('md');
    setStorySticker('🎯 إثبات عمل');
    setStoryActiveTab('media');
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1500 * 1024) {
        showToast(lang === 'ar' ? '⚠️ حجم الصورة كبير! يرجى اختيار صورة أقل من 1.5 ميغابايت.' : '⚠️ Image is too large! Please choose an image under 1.5MB.');
        return;
      }
      setStoryUploading(true);
      setStoryUploadProgress(15);
      compressImage(file)
        .then((base64) => {
          setStorySelectedImage(base64);
          setStoryUploadProgress(100);
          setStoryUploading(false);
          showToast(lang === 'ar' ? '📸 تم تعيين صورة القصة بنجاح!' : '📸 Story image set successfully!');
        })
        .catch((err) => {
          console.error(err);
          setStoryUploading(false);
          setStoryUploadProgress(0);
          showToast(lang === 'ar' ? '⚠️ فشل في معالجة وتجهيز الصورة' : '⚠️ Image processing failed');
        });
    }
  };

  const executePublishStory = () => {
    setStoryUploading(true);
    setStoryUploadProgress(15);

    const userUploadedStory: Partial<QuestStory> = {
      image: storySelectedImage || '',
      proofImage: storySelectedImage || '',
      bgGradient: storySelectedImage ? undefined : storyBgGradient,
      caption: storyCaption.trim() || (lang === 'ar' ? 'قصة كويست جديدة ✨🇩🇿' : 'New Quest Story ✨🇩🇿'),
      textColor: storyTextColor,
      textBg: storyTextBg,
      textPosition: storyTextPosition as 'top' | 'middle' | 'bottom',
      fontSize: storyFontSize,
      sticker: storySticker,
      createdAt: new Date().toISOString(),
      views: 1
    };

    setStoryUploadProgress(40);

    if (onPublishStory) {
      onPublishStory(userUploadedStory)
        .then(() => {
          setStoryUploadProgress(100);
          setTimeout(() => {
            setStoryUploading(false);
            setStoryUploadProgress(0);
            setIsCreatingStory(false);
            showToast(lang === 'ar' ? '🔥 تم بنجاح نشر قصتك!' : '🔥 Fast Quest Story updated!');
            playConfirmSound(true);
          }, 300);
        })
        .catch((err) => {
          console.error("Story publish failed:", err);
          setStoryUploading(false);
          setStoryUploadProgress(0);
          showToast(lang === 'ar' ? '⚠️ فشل نشر القصة!' : '⚠️ Failed to publish story!');
        });
    } else {
      setStoryUploadProgress(100);
      setTimeout(() => {
        setStoryUploading(false);
        setStoryUploadProgress(0);
        showToast(lang === 'ar' ? '⚠️ ميزة النشر معطلة حالياً.' : '⚠️ Publishing is currently offline.');
      }, 300);
    }
  };

  const handleBookTaskClick = (quest: Quest, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Strict GPS Location check: Booking requires active GPS location
    if (gpsDenied || !userLoc) {
      showToast(
        lang === 'ar' 
          ? '⚠️ لا يمكن حجز الكويست إلا بعد تفعيل خدمة تحديد الموقع (GPS)' 
          : '⚠️ Cannot book quest without enabling GPS location service'
      );
      requestHomeLocation();
      return;
    }

    // Check Token balance (Requires 5%, min 35 tokens, max 2000 tokens)
    const fee = calculateBookingFee(quest.cashReward);
    if (userProfile.tokenBalance < fee) {
      showToast(lang === 'ar' ? '⚡ رصيد غير كافٍ لدفع رسوم الحجز وضمان المنصة (5% من المكافأة، الحد الأدنى 35 د.ج والحد الأقصى 2000 د.ج)' : '⚡ Insufficient token balance for booking & platform safety guarantee (5% fee, min 35 DA, max 2000 DA)');
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
    const shareText = `🔍 ${quest.title} \n📍 ${quest.location} \n💰 المكافأة: ${quest.cashReward} د.ج \n\nانضم لـ كويست الجزائر وساعد الجيران! #كويست_الجزائر`;
    if (navigator.share) {
      navigator.share({
        title: 'کویست الجزائر',
        text: shareText,
        url: window.location.href,
      }).then(() => {
        showToast('📤 تم استدعاء واجهة مشاركة نظام التشغيل بنجاح!');
      }).catch(() => {
        showShareFeedback();
      });
    } else {
      showShareFeedback();
    }
  };

  const showShareFeedback = () => {
    showToast(lang === 'ar' 
      ? '🔗 تم نسخ رابط العرض بنجاح لمشاركته في فيسبوك / ماسنجر!' 
      : '🔗 Quest link successfully copied to your Clipboard to share in Facebook / Messenger!'
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
      showToast(lang === 'ar' ? '❤️ تم تسجيل إعجابك بالعرض!' : '❤️ Registered like on quest post!');
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
        ? `💬 علق [${userProfile.name}] على كويستك "${targetQuest.title}": "${text}"`
        : `💬 [${userProfile.name}] commented on your quest "${targetQuest.title}": "${text}"`;

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

    showToast(lang === 'ar' ? '💬 تم نشر تعليقك على هذا العرض بنجاح!' : '💬 Posted your comment on this quest!');
  };

  // Submit Story reaction
  const handleSendStoryReact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyReactMsg.trim() || !activeStory) return;
    showToast(lang === 'ar' 
      ? `📩 أُرسل تعليقك إلى [${activeStory.user}] بنجاح!` 
      : `📩 Reaction message sent directly to [${activeStory.user}] inbox!`
    );
    setStoryReactMsg('');
    setActiveStory(null);
  };

  const handleStoryEmojiReact = (emoji: string) => {
    if (!activeStory) return;
    showToast(lang === 'ar' 
      ? `📩 تم إرسال تفاعل (${emoji}) للعامل [${activeStory.user}]!` 
      : `📩 Sent (${emoji}) reaction message to runner [${activeStory.user}]!`
    );
    setActiveStory(null);
  };

  const filteredQuests = useMemo(() => {
    const qSearch = searchQuery.toLowerCase();
    return quests
      .filter(q => q.status === 'open')
      .filter(q => {
        const matchText = q.title.toLowerCase().includes(qSearch) || 
                          q.description.toLowerCase().includes(qSearch) ||
                          q.location.toLowerCase().includes(qSearch);
        const matchCat = selectedCategory === 'all' || q.category === selectedCategory;
        return matchText && matchCat;
      });
  }, [quests, searchQuery, selectedCategory]);

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
    inRange.sort((a, b) => b.cashReward - a.cashReward);
    outOfRange.sort((a, b) => b.cashReward - a.cashReward);
    return { inRangeQuests: inRange, outOfRangeQuests: outOfRange };
  }, [questsWithDistance]);

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

      // 2. Fetch latest stories directly from Firestore
      let fetchedStories: QuestStory[] = [];
      try {
        const storiesQuery = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(15));
        const storiesSnapshot = await getDocs(storiesQuery);
        storiesSnapshot.forEach((doc) => {
          fetchedStories.push({ id: doc.id, ...doc.data() } as any);
        });
      } catch (err) {
        console.warn("Could not fetch stories on refresh:", err);
      }

      // 3. Seamlessly update GPS location in the background without blocking or prompting
      if (navigator.geolocation) {
        try {
          let canQuery = false;
          let isGranted = true;
          try {
            if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
              canQuery = true;
              const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
              isGranted = perm.state === 'granted';
            }
          } catch (pe) {
            console.warn("Could not query geolocation permissions:", pe);
          }

          if (isGranted || !canQuery) {
            await new Promise<void>((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setUserLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
                  resolve();
                },
                (err) => {
                  console.warn("Seamless background location update skipped/failed:", err);
                  resolve();
                },
                {
                  enableHighAccuracy: true,
                  timeout: 4000, // Short timeout to keep pull-to-refresh fast and seamless
                  maximumAge: 0
                }
              );
            });
          }
        } catch (gpsError) {
          console.warn("GPS background update error:", gpsError);
        }
      }

      // Update parent global states
      if (setQuests && fetchedQuests.length > 0) {
        setQuests(fetchedQuests);
      }
      if (setStories && fetchedStories.length > 0) {
        setStories(fetchedStories);
      }
      
      showToast(lang === 'ar' ? '🔄 تم تحديث قائمة الكويستات والقصص بنجاح!' : '🔄 Feed updated successfully!');
    } catch (error) {
      console.error("Failed to refresh feed:", error);
      showToast(lang === 'ar' ? '⚠️ فشل تحديث البيانات، يرجى التحقق من اتصال الشبكة.' : '⚠️ Failed to update feed. Please check network.');
    }
  };

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      lang={lang}
      audioEffectsEnabled={userProfile?.audioEffectsEnabled !== false}
      hapticFeedbackEnabled={userProfile?.hapticFeedbackEnabled !== false}
    >
      <div className="space-y-6 pb-12 font-sans text-[#1F2A44]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>

      {/* 🚀 QUEST PROOF STORIES (Instagram Style) */}
      <div className="bg-white rounded-3xl p-4 border border-slate-900 space-y-3 relative overflow-hidden">
        {/* Glow decorative accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF3B7C]/5 blur-2xl rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#4FC3F7]/5 blur-2xl rounded-full"></div>

        <div className="flex items-center justify-between px-1 relative z-10">
          <h3 className="text-[11px] font-black tracking-wider uppercase text-gray-450 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF3B7C] fill-[#FF337C]/20" />
            <span>{lang === 'ar' ? 'قصص' : 'Recent Real-World "Quest Proof" Stories'}</span>
          </h3>
          <span className="text-[9px] bg-sky-50 text-sky-600 font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
            DISAPPEARING 24H ⏳
          </span>
        </div>

        {/* Stories Horizontal Scrolling Track */}
        <div className="flex gap-4 overflow-x-auto pb-1.5 no-scrollbar pt-1.5 scroll-smooth relative z-10">
          
          {/* Real simulated story uploader with Hot Pink Plus Badge */}
          <button
            onClick={handleStoryUpload}
            className="flex flex-col items-center gap-1.5 focus:outline-none shrink-0 group cursor-pointer text-center"
            disabled={storyUploading}
          >
            <div className="relative">
              <div className={`w-16 h-16 rounded-full p-0.5 transition-all flex items-center justify-center ${
                storyUploading 
                  ? 'bg-gradient-to-tr from-[#FF3B7C] via-gray-300 to-[#4FC3F7] animate-spin' 
                  : 'bg-slate-100 ring-1 ring-gray-200 hover:scale-105'
              }`}>
                <div className="w-full h-full bg-white rounded-full p-0.5 relative overflow-hidden flex items-center justify-center">
                  {storyUploading ? (
                    <div className="absolute inset-0 bg-[#1F2A44]/75 flex flex-col items-center justify-center text-[9px] text-white font-black z-10">
                      <span className="font-mono">{storyUploadProgress}%</span>
                    </div>
                  ) : null}
                  <img
                    src={userProfile?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={userProfile?.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              {/* Hot Pink plus badge */}
              <span className="absolute -bottom-1 right-0 bg-[#FF3B7C] text-white text-[10px] w-5 h-5 rounded-full font-black flex items-center justify-center shadow-md select-none">
                +
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-400">
              {storyUploading ? (lang === 'ar' ? 'جاري الرفع...' : 'Filing...') : (lang === 'ar' ? 'قصتك' : 'My Story')}
            </span>
          </button>

          {/* Map mock and custom local stories */}
          {stories.map(story => (
            <button
               key={story.id}
               onClick={() => {
                 if (onIncrementStoryView) {
                   onIncrementStoryView(story.id);
                 }
                 setStoryViewsMap(prev => ({
                   ...prev,
                   [story.id]: (prev[story.id] || 0) + 1
                 }));
                 setActiveStory(story);
               }}
               className="flex flex-col items-center gap-1.5 focus:outline-none shrink-0 group cursor-pointer text-center"
            >
              <div className="relative">
                {/* Glowing neon halo layout representation */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#FF3B7C] via-[#FFD34D] to-[#4FC3F7] p-0.5 group-hover:scale-105 transition-all shadow-md group-hover:rotate-12 duration-300">
                  <div className="w-full h-full bg-white rounded-full p-0.5">
                    <img
                      src={story.userAvatar || story.image}
                      alt={story.user}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </div>
                <span className="absolute -bottom-1.5 right-1/2 translate-x-1/2 bg-[#FFD34D] text-[#1F2A44] text-[8px] px-2 py-0.5 rounded-full font-black border border-white shadow-sm flex items-center gap-0.5 scale-90 uppercase">
                  Proof
                </span>
              </div>
              <span className="text-[10px] font-extrabold text-gray-700 max-w-[70px] truncate">
                {story.user}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* VERTICAL PREMIUM SOCIAL FEED PLAYGROUND */}
      <div id="social-media-feed-track" className="space-y-6">
        
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-[#1F2A44] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF3B7C] animate-ping"></span>
            <span>{lang === 'ar' ? 'كويستات' : 'Live Quest Stream'}</span>
            <span className="text-[11px] text-gray-400 font-bold">({filteredQuests.length})</span>
          </h2>
        </div>

        {filteredQuests.length === 0 ? (
          <div className="bg-white py-16 px-4 rounded-3xl border border-slate-900 text-center space-y-4">
            <div className="w-14 h-14 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <SlidersHorizontal className="w-6 h-6 text-gray-300" />
            </div>
            <h3 className="font-extrabold text-sm">{lang === 'ar' ? 'لا توجد كويستات مطابقة لخيارات الفلترة' : 'No local chores match your filters'}</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
              {lang === 'ar' ? 'حاول كتابة كلمات أخرى أو تبديل خيار التصنيف للحصول على المنشورات الأخيرة للشباب.' : 'Change the categorized tag or clear seek tags to inspect other opportunities.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl mx-auto">
            {(() => {
              const renderQuestCard = (quest: typeof quests[0] & { distanceKm?: number }, forcedOutsideRadius?: boolean) => {
                const tokenAmount = calculateBookingFee(quest.cashReward);
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
                if (quest.images && quest.images.length > 0) {
                  galleryImages.push(...quest.images);
                } else if (quest.imageUrls && quest.imageUrls.length > 0) {
                  galleryImages.push(...quest.imageUrls);
                } else if (quest.imageUrl) {
                  galleryImages.push(quest.imageUrl);
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
                          showToast(lang === 'ar' ? '🚨 إشارة الرادار: كشف خرق عاجل للحدود!' : '🚨 Sonar Signal: Urgent bounty contract pinged!');
                        }}
                        className="text-[8.5px] bg-[#FFFFFF]/25 hover:bg-[#FFFFFF]/40 active:scale-95 text-white px-2.5 py-1 rounded-lg font-black transition-all flex items-center justify-center gap-1 cursor-pointer select-none border border-white/20 uppercase"
                      >
                        📡 {lang === 'ar' ? 'مسح الإشارة' : lang === 'fr' ? 'Ping Sonar' : 'Ping Radar'}
                      </button>
                    </div>
                  )}

                  {quest.urgency === 'featured' && (
                    <div className="bg-[#FFD34D] text-[#1F2A44] text-[9.5px] font-black py-1.5 px-4 uppercase tracking-wider flex items-center justify-between gap-1">
                      <span>⭐ {dict.urgencyFeatured} • {lang === 'ar' ? 'مهمة مميزة ومثبتة للمجتمع' : 'Highly recommended communities chore'}</span>
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
                              <span className="text-[7.5px]">✓</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-gray-300" />
                            <span>{quest.createdAt}</span>
                          </div>
                        </div>
                      </div>

                      {/* Flagging alert banner and info */}
                      {quest.flagsCount && quest.flagsCount > 0 ? (
                        <div className="bg-[#FF3B7C]/10 text-[#FF3B7C] px-3 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{quest.flagsCount} FLAGS 🚨</span>
                        </div>
                      ) : null}
                    </div>

                    {/* SOCIAL POST BODY: Chores descriptions, landmarks, constraints, simulated hashtags */}
                    <div className="space-y-4 text-start">
                      
                      <h4 className="text-sm font-extrabold text-slate-800 leading-snug tracking-tight text-start mt-1">
                        {quest.title}
                      </h4>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 text-xs font-bold text-gray-700 leading-relaxed whitespace-pre-line relative text-start">
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

                    {/* 💰 DYNAMIC VISUAL TRANSACTION CALLOUT BOX - Dark Navy with precise typography */}
                    <div className="bg-[#1F2A44] rounded-2xl p-4 border border-[#FFD34D]/20 relative overflow-hidden shadow-inner flex flex-col justify-between gap-3 text-start">
                      
                      {/* Technical abstract background art lines */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FFD34D]/5 to-transparent rounded-full blur-xl pointer-events-none"></div>
                      
                      <div className="flex justify-between items-center relative z-10">
                        <div>
                          <span className="text-[9.5px] text-[#4FC3F7] block font-black uppercase tracking-widest leading-none mb-1 text-start">
                            💰 {lang === 'ar' ? 'العائد المالي النقدي الميداني' : 'Direct Cash Payout'}
                          </span>
                          <span className="text-xl font-black text-white font-mono flex items-baseline gap-1">
                            {quest.cashReward} <span className="text-xs font-sans text-gray-300 font-semibold">{lang === 'ar' ? 'دينار جزائري (د.ج)' : 'DZD / DA'}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9.5px] text-gray-300 block font-black uppercase tracking-widest leading-none mb-1">
                            ⚡ {lang === 'ar' ? 'الرمز المطلوب لحجز والمؤمن' : 'Required Booking Tokens'}
                          </span>
                          <span className="text-sm font-black text-[#FFD34D] font-mono flex items-center justify-end gap-1">
                            ⚡ {tokenAmount} <span className="text-[10px] font-sans text-gray-300 font-bold">Tokens</span>
                          </span>
                        </div>
                      </div>

                      {/* Explanation subtitle of direct physical cash delivery on ground */}
                      <p className="text-[9.5px] text-gray-300 font-bold leading-relaxed border-t border-white/10 pt-2 text-start">
                        💵 {lang === 'ar' 
                          ? 'الدفع يداً بيد أو عبر بريدي موب فور التسليم الميداني.' 
                          : 'Paid directly in cash or via BaridiMob transfer on completion.'}
                      </p>

                      {/* Hot Pink central action button or Applicant standby state */}
                      {quest.applicants?.some(a => a.userId === userProfile.id) ? (
                        <button
                          disabled
                          className="w-full bg-slate-800 border border-slate-700 text-slate-400 py-3 rounded-2xl font-bold text-[10px] sm:text-xs flex items-center justify-center p-2.5 gap-2"
                        >
                          <span className="text-center">{lang === 'ar' ? 'تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل ⏳' : 'Application pending.. Awaiting creator selection ⏳'}</span>
                        </button>
                      ) : isOutsideRadius ? (
                        <button
                          disabled
                          className="w-full bg-slate-400/40 border border-slate-300 text-slate-400 py-3.5 rounded-2xl font-bold text-[10px] sm:text-xs flex items-center justify-center p-2.5 gap-2 cursor-not-allowed opacity-75"
                        >
                          <MapPin className="w-4.5 h-4.5 text-slate-400" />
                          <span className="text-center">{lang === 'ar' ? 'هذه المهمة خارج نطاقك الجغرافي المتاح للحجز 📍' : 'This quest is outside your available geographical booking limit 📍'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleBookTaskClick(quest, e)}
                          className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white font-black text-xs py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF3B7C]/25 active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          <Award className="w-4.5 h-4.5" />
                          <span>{lang === 'ar' ? 'احجز المهمة الآن ⚡' : 'Book Quest Now ⚡'}</span>
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
                        <span>{questComments.length} {lang === 'ar' ? 'تعليقات' : 'Comments'}</span>
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
                              <span>{cardDistance ? `${cardDistance} km ${lang === 'ar' ? 'عنك' : 'away'}` : (lang === 'ar' ? 'الموقع غير متوفر 📍' : 'Location unavailable 📍')}</span>
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
                              <span>{cardDistance ? `${cardDistance} km ${lang === 'ar' ? 'عنك' : 'away'}` : (lang === 'ar' ? 'الموقع غير متوفر 📍' : 'Location unavailable 📍')}</span>
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
                        {lang === 'ar' ? 'التعليقات المباشرة للجيران والزملاء' : 'Direct Conversation with Neighbors'}
                      </div>

                      {/* List comments */}
                      {questComments.length === 0 ? (
                        <p className="text-[11px] text-gray-400 text-center py-2 font-medium">
                          {lang === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يكتب استفساراً!' : 'No question comments listed yet. Ask a question regarding tools!'}
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
                        {lang === 'ar' ? 'تحديد الموقع (GPS) غير مفعّل 📍' : 'GPS Location Disabled 📍'}
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
                        ? (lang === 'ar' ? 'جاري تحديد الموقع... ⏳' : 'Locating... ⏳')
                        : (lang === 'ar' ? 'تفعيل الـ GPS وتحديد موقعي 📍' : 'Enable GPS & Locate Me 📍')}
                    </button>
                  </div>
                ) : inRangeQuests.length === 0 ? (
                  <div className="bg-white border border-gray-100 p-8 rounded-3xl text-center space-y-3 shadow-xs">
                    <div className="w-12 h-12 bg-[#FF3B7C]/10 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto animate-pulse">
                      <MapPin className="w-5 h-5 animate-bounce" />
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-700">
                      {lang === 'ar' ? 'لا توجد كويستات قريبة في حيك حالياً 📍' : 'No nearby quests in your neighborhood currently 📍'}
                    </h4>
                    <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                      {lang === 'ar' 
                        ? 'انقر على زر مسح الرادار لتحديث موقعك، أو ابحث في كويستات خارج نطاقك الجغرافي بالأسفل!' 
                        : 'Tap on Scan Radar to update your current location, or search quests outside your radius below.'}
                    </p>
                  </div>
                ) : (
                  inRangeQuests.map((quest) => renderQuestCard(quest, false))
                )}

                {/* Tier 2 (Out-of-Range Quests) */}
                {outOfRangeQuests.length > 0 && (
                  <div className="pt-4 border-t border-gray-150/50 mt-8 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                      <MapPin className="w-4 h-4 text-slate-350 shrink-0" />
                      <span>
                        {lang === 'ar' 
                          ? 'كويستات خارج نطاقك الجغرافي المتاح للحجز (أكثر من 50 كم) 📍' 
                          : 'Quests Outside Your Geographical Booking Limit (> 50 km) 📍'}
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

      {/* DISAPPEARING STORIES OVERLAY VIEW MODAL (Gorgeous Instagram simulation with reaction boxes & progress lines) */}
      <AnimatePresence>
        {activeStory && (
          <div className="fixed inset-0 bg-[#1F2A44]/95 backdrop-blur-md z-50 flex items-center justify-center p-3 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-[#000000] aspect-[9/16] max-h-[90vh] flex flex-col justify-between p-4"
              style={
                (activeStory.proofImage || activeStory.image)
                  ? { backgroundImage: `url(${activeStory.proofImage || activeStory.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: activeStory.bgGradient || 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)' }
              }
            >
              {/* Overlay shadow filters to keep text super legible */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-0"></div>
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-0"></div>

              {/* Header Timer Progress Layout */}
              <div className="relative z-10 w-full space-y-3">
                <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-[#FF3B7C] to-[#FFD34D] h-full transition-all" style={{ width: `${storyTimer}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={activeStory.userAvatar}
                      alt={activeStory.user}
                      className="w-9 h-9 rounded-full object-cover border-2 border-[#FFD34D]"
                    />
                    <div>
                      <div className="text-white text-xs font-black flex items-center gap-1">
                        <span>{activeStory.user}</span>
                        <span className="text-[#4FC3F7] font-black scale-90">✔</span>
                      </div>
                      <div className="text-gray-300 text-[9px] font-mono flex items-center gap-1.5 mt-0.5">
                        <span>{activeStory.createdAt ? new Date(activeStory.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-DZ' : 'fr-DZ', { hour: '2-digit', minute: '2-digit' }) : (lang === 'ar' ? 'الآن' : 'Just now')}</span>
                        <span>•</span>
                        <span className="text-[#FFD34D] flex items-center gap-1 font-bold">
                          <Eye className="w-3.5 h-3.5 inline text-[#FFD34D]" />
                          <span>{activeStory.views || storyViewsMap[activeStory.id] || 1}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      Proof Uploaded
                    </span>
                    {(activeStory.user === userProfile.name || userProfile.isAdmin || activeStory.id.startsWith('story-user-') || userProfile.role === 'admin') && (
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(true);
                        }}
                        className="text-white hover:text-rose-500 bg-rose-600/80 hover:bg-rose-600 p-1.5 rounded-full cursor-pointer flex items-center justify-center transition animate-pulse"
                        title={lang === 'ar' ? 'حذف القصة' : 'Delete Story'}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => setActiveStory(null)} 
                      className="text-white bg-black/40 hover:bg-black/60 p-1.5 rounded-full cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Central high trust banner stamp */}
              <div className="relative z-10 mx-auto bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 animate-bounce">
                <Shield className="w-3.5 h-3.5 text-[#FFD34D] fill-[#FFD34D]/20" />
                <span className="text-[10px] text-white font-black uppercase tracking-wider">
                  {activeStory.sticker || (lang === 'ar' ? 'إثبات عمل موثق وطنياً' : 'Verified Community Proof')}
                </span>
              </div>

              {/* Optional Inline Custom Delete Confirmation Overlay */}
              {showDeleteConfirm && (
                <div className="absolute inset-0 bg-neutral-950/95 z-50 flex flex-col items-center justify-center p-6 text-center select-none rounded-3xl">
                  <div className="bg-rose-500/10 p-4 rounded-full border border-rose-500/20 mb-4 animate-bounce">
                    <Trash className="w-8 h-8 text-rose-500" />
                  </div>
                  <h4 className="text-white font-black text-sm mb-2">
                    {lang === 'ar' ? '⚠️ هل أنت متأكد من حذف قصتك؟' : '⚠️ Delete this story permanently?'}
                  </h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed mb-6 max-w-[220px]">
                    {lang === 'ar'
                      ? 'سيتم إزالة إثبات العمل الميداني هذا نهائياً من سجلات مجتمع كويست الجزائر.'
                      : 'This certified quest work proof will be permanently removed from Algeria community feed.'}
                  </p>
                  <div className="flex flex-col gap-2 w-full max-w-[200px]">
                    <button
                      onClick={() => {
                        if (onDeleteStory && activeStory) {
                          onDeleteStory(activeStory.id)
                            .then(() => {
                              setActiveStory(null);
                              setShowDeleteConfirm(false);
                              showToast(lang === 'ar' ? '🗑️ تم حذف قصتك بنجاح!' : '🗑️ Your quest proof story deleted successfully!');
                            })
                            .catch((err) => {
                              console.error("Failed to delete story from DB:", err);
                              showToast(lang === 'ar' ? '⚠️ فشل حذف القصة!' : '⚠️ Failed to delete story!');
                            });
                        } else {
                          setActiveStory(null);
                          setShowDeleteConfirm(false);
                          showToast(lang === 'ar' ? '🗑️ تم حذف قصتك بنجاح!' : '🗑️ Your quest proof story deleted successfully!');
                        }
                      }}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition cursor-pointer shadow-lg active:scale-95 border-none"
                    >
                      {lang === 'ar' ? 'نعم، احذف القصة 🗑️' : 'Yes, Delete Story 🗑️'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer active:scale-95 border-none"
                    >
                      {lang === 'ar' ? 'إلغاء وتراجع ❌' : 'Cancel & Go Back ❌'}
                    </button>
                  </div>
                </div>
              )}

              {/* Story Description detail & Interactive Reaction Console */}
              <div className="relative z-10 space-y-4">
                
                {/* Viewers list display representation for the story owner or active story */}
                {(() => {
                  const algerianNames = [
                    lang === 'ar' ? 'ياسين ب.' : 'Yacine B.',
                    lang === 'ar' ? 'أميرة ك.' : 'Amira K.',
                    lang === 'ar' ? 'رياض ح.' : 'Riad H.',
                    lang === 'ar' ? 'صوفيا ج.' : 'Sofia J.',
                    lang === 'ar' ? 'أنيس م.' : 'Anis M.',
                    lang === 'ar' ? 'كريمة ص.' : 'Karima S.',
                    lang === 'ar' ? 'بلال ب.' : 'Bilel B.',
                    lang === 'ar' ? 'سمير خ.' : 'Samir K.',
                    lang === 'ar' ? 'فاطمة م.' : 'Fatima M.',
                  ];
                  const viewsCount = activeStory.views || storyViewsMap[activeStory.id] || 1;
                  const chosenCount = Math.max(1, Math.min(algerianNames.length, Math.floor(viewsCount / 10) + 1));
                  const shownViewers = algerianNames.slice(0, chosenCount).join('، ');
                  const remainingCount = viewsCount - chosenCount;

                  return (
                    <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex items-center justify-between text-xs text-slate-300">
                      <span className="font-extrabold text-[9px] text-[#FFD34D] flex items-center gap-1 shrink-0">
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>{lang === 'ar' ? 'شاهدوا القصة 👥:' : 'Viewed by 👥:'}</span>
                      </span>
                      <div className="font-semibold text-[9px] text-gray-300 truncate text-left max-w-[170px] ml-1" style={{ direction: 'rtl' }}>
                        {shownViewers} {remainingCount > 0 ? `+${remainingCount}` : ''}
                      </div>
                    </div>
                  );
                })()}

                {/* Description details banner */}
                <div 
                  className="space-y-1 p-4 rounded-2xl border border-white/10 uppercase"
                  style={{ 
                    backgroundColor: activeStory.textBg || 'rgba(0, 0, 0, 0.65)', 
                    color: activeStory.textColor || '#ffffff' 
                  }}
                >
                  <p className="text-[9px] font-black tracking-wider uppercase opacity-85">
                    {lang === 'ar' ? 'إثبات معتمد ميدانياً ✨' : 'verified completed proof on ground ✨'}
                  </p>
                  <h4 className="text-sm font-extrabold" style={{ color: activeStory.textColor || '#FFD34D' }}>
                    {activeStory.title || (lang === 'ar' ? 'عمل موثق' : 'Completed Work')}
                  </h4>
                  <p className="text-xs font-medium leading-relaxed" style={{ color: activeStory.textColor || '#f8fafc' }}>
                    {activeStory.description || activeStory.caption}
                  </p>
                </div>

                {/* Simulated direct reaction quick emoji bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] text-gray-400 font-bold uppercase">{lang === 'ar' ? 'تعليق سريع للرَّانر' : 'Reaction Chars'}</span>
                    <div className="flex gap-1.5">
                      {['🎉', '👏', '🔥', '👍', '😍'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleStoryEmojiReact(emoji)}
                          className="text-base transform active:scale-150 hover:scale-110 transition-transform bg-black/40 p-1 rounded-md cursor-pointer select-none"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Reaction Text form */}
                  <form onSubmit={handleSendStoryReact} className="flex gap-2 items-center">
                    <input
                      type="text"
                      required
                      placeholder={lang === 'ar' ? `أرسل رسالة تشجيعية لـ ${activeStory.user.split(' ')[0]}...` : `Send Bravo reaction to ${activeStory.user.split(' ')[0]}...`}
                      value={storyReactMsg}
                      onChange={(e) => setStoryReactMsg(e.target.value)}
                      className="flex-1 bg-black/60 border border-white/20 px-3.5 py-2.5 rounded-xl text-xs text-white placeholder-gray-400 font-semibold focus:outline-none focus:border-[#FFD34D]"
                    />
                    <button
                      type="submit"
                      className="bg-[#FF3B7C] text-white px-3.5 py-2.5 rounded-xl text-xs font-black cursor-pointer hover:bg-[#FF3B7C]/95 transition"
                    >
                      {lang === 'ar' ? 'إرسال' : 'Send'}
                    </button>
                  </form>
                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STORY CREATION & CUSTOMIZATION MODAL - FULL FREEDOM EDITOR */}
      <AnimatePresence>
        {isCreatingStory && (
          <div className="fixed inset-0 bg-[#0b0f1a]/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row border-2 border-gray-100 font-sans text-right my-auto max-h-[92vh]"
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              {/* Left Column: Live Interactive Preview */}
              <div className="md:w-5/12 bg-slate-950 p-4 sm:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-800 relative min-h-[380px] md:min-h-[500px]">
                <div className="absolute top-3 left-3 z-10 text-white/70 text-[10px] font-black uppercase tracking-widest bg-black/50 px-2.5 py-1 rounded-full backdrop-blur border border-white/10">
                  📱 {isRtl ? 'معاينة حية للقصة' : 'Live Preview'}
                </div>

                {/* Clear Photo / Reset button if image exists */}
                {storySelectedImage && (
                  <button
                    type="button"
                    onClick={() => setStorySelectedImage('')}
                    className="absolute top-3 right-3 z-10 text-xs text-rose-300 hover:text-rose-100 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/30 px-2.5 py-1 rounded-full backdrop-blur flex items-center gap-1 cursor-pointer transition shadow-md border-none"
                  >
                    <Trash className="w-3 h-3" />
                    <span>{isRtl ? 'إزالة الصورة' : 'Remove Photo'}</span>
                  </button>
                )}

                {/* Simulated Smartphone Frame */}
                <div 
                  className="w-full max-w-[250px] sm:max-w-[270px] aspect-[9/16] rounded-[2.2rem] overflow-hidden shadow-2xl border-4 border-slate-700 bg-black relative flex flex-col justify-between p-3.5 transition-all"
                  style={
                    storySelectedImage
                      ? { backgroundImage: `url(${storySelectedImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: storyBgGradient }
                  }
                >
                  {/* Subtle Screen Overlay Gradients */}
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent z-0 pointer-events-none"></div>
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent z-0 pointer-events-none"></div>

                  {/* Header user info bar */}
                  <div className="relative z-10 flex items-center gap-2">
                    <img
                      src={userProfile.avatar}
                      alt={userProfile.name}
                      className="w-7 h-7 rounded-full object-cover border-2 border-[#FFD34D]"
                    />
                    <div className="text-left">
                      <div className="text-white text-[10px] font-black leading-none">{userProfile.name}</div>
                      <div className="text-gray-300 text-[8px] font-mono leading-none mt-0.5">{isRtl ? 'الآن بالذات' : 'Just Now'}</div>
                    </div>
                  </div>

                  {/* Sticker Stamp Badge if set */}
                  {storySticker && (
                    <div className="relative z-10 mx-auto bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1 shadow-lg animate-pulse">
                      <Shield className="w-2.5 h-2.5 text-[#FFD34D]" />
                      <span className="text-[9px] text-white font-black uppercase tracking-wider">{storySticker}</span>
                    </div>
                  )}

                  {/* Custom caption text box aligned based on position */}
                  <div 
                    className="relative z-10 w-full mb-1"
                    style={{
                      marginTop: storyTextPosition === 'top' ? '8px' : 'auto',
                      marginBottom: storyTextPosition === 'bottom' ? '8px' : 'auto',
                      transform: storyTextPosition === 'middle' ? 'translateY(-15%)' : 'none'
                    }}
                  >
                    <div 
                      className="p-3 rounded-2xl border border-white/10 shadow-xl text-center backdrop-blur-md transition-all break-words"
                      style={{ 
                        backgroundColor: storyTextBg, 
                        color: storyTextColor 
                      }}
                    >
                      <p className={`font-extrabold leading-relaxed whitespace-pre-wrap ${
                        storyFontSize === 'sm' ? 'text-[10px]' :
                        storyFontSize === 'lg' ? 'text-sm font-black' :
                        storyFontSize === 'xl' ? 'text-base font-black' : 'text-xs'
                      }`}>
                        {storyCaption.trim() || (isRtl ? 'اكتب نصك الرائع للقصة هنا...' : 'Type your story caption here...')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Complete Freedom Editor Controls */}
              <div className="md:w-7/12 p-5 sm:p-6 flex flex-col justify-between overflow-y-auto space-y-4">
                <div className="space-y-4">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b pb-3 border-gray-100">
                    <button 
                      type="button"
                      onClick={() => setIsCreatingStory(false)}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition cursor-pointer border-none"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <div className="text-right">
                      <h3 className="text-sm font-black text-[#1F2A44] flex items-center gap-1.5 justify-end">
                        <Sparkles className="w-4 h-4 text-[#FF3B7C] fill-[#FF337C]/15" />
                        <span>{isRtl ? 'استوديو تصميم ونشر القصة 📸🎨' : 'Story Design Studio 📸🎨'}</span>
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        {isRtl ? 'حرية كاملة: ارفع صورتك الخاصة أو اصنع قصة نصية خلفيتها ملونة' : 'Full freedom: Upload your photo or create colorful text stories'}
                      </p>
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                    {[
                      { id: 'media', label: isRtl ? '🖼️ الوسائط والخلفية' : '🖼️ Media' },
                      { id: 'style', label: isRtl ? '✍️ النص والتنسيق' : '✍️ Text' },
                      { id: 'sticker', label: isRtl ? '🏷️ الشارات والملصق' : '🏷️ Sticker' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setStoryActiveTab(tab.id as any)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border-none ${
                          storyActiveTab === tab.id
                            ? 'bg-white text-[#1F2A44] shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: MEDIA & BACKGROUND */}
                  {storyActiveTab === 'media' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* Upload Device Photo Section */}
                      <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-600 uppercase">
                          {isRtl ? '📁 ارفع صورة من جهازك (اختياري):' : '📁 Upload photo from device:'}
                        </label>

                        {storySelectedImage ? (
                          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-300 shrink-0">
                                <img src={storySelectedImage} className="w-full h-full object-cover" alt="Preview" />
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black text-emerald-800 block">{isRtl ? 'تم رفع وتعريف الصورة! 📸' : 'Photo set!'}</span>
                                <span className="text-[10px] font-bold text-emerald-600">{isRtl ? 'الصورة جاهزة للعرض بالقصة' : 'Ready for publication'}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setStorySelectedImage('')}
                              className="text-xs text-rose-600 font-black hover:bg-rose-100 p-2 rounded-xl transition cursor-pointer border-none"
                            >
                              {isRtl ? 'تغيير/حذف 🗑️' : 'Remove 🗑️'}
                            </button>
                          </div>
                        ) : (
                          <label 
                            htmlFor="story-file-uploader" 
                            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-[#FF3B7C] cursor-pointer p-5 rounded-2xl transition-all hover:bg-[#FF3B7C]/5 text-center group"
                          >
                            <div className="bg-[#FF3B7C]/10 p-3 rounded-full group-hover:scale-110 transition-transform">
                              <Upload className="w-6 h-6 text-[#FF3B7C]" />
                            </div>
                            <span className="text-xs font-black text-slate-700">{isRtl ? 'انقر هنا لاختيار أو التقاط صورة من جهازك 📱' : 'Click to select or capture photo 📱'}</span>
                            <span className="text-[10px] text-gray-400 font-bold">{isRtl ? 'يدعم الصور حتى 1.5 ميغابايت (JPG, PNG, WebP)' : 'Supports up to 1.5MB'}</span>
                            <input
                              id="story-file-uploader"
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileChange}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>

                      {/* Text Story Gradient Themes if no photo */}
                      {!storySelectedImage && (
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <label className="block text-xs font-black text-slate-600 uppercase">
                            {isRtl ? '🎨 أو اختر خلفية متدرجة ملونة للقصة النصية:' : '🎨 Or choose gradient for text story:'}
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { name: isRtl ? '🌌 ليلي كحلي' : 'Navy', grad: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)' },
                              { name: isRtl ? '🌸 غروب وردي' : 'Sunset', grad: 'linear-gradient(135deg, #FF3B7C 0%, #7C3AED 100%)' },
                              { name: isRtl ? '🟢 زمردي' : 'Emerald', grad: 'linear-gradient(135deg, #064E3B 0%, #047857 50%, #10B981 100%)' },
                              { name: isRtl ? '☀️ ذهبي' : 'Golden', grad: 'linear-gradient(135deg, #D97706 0%, #B45309 50%, #78350F 100%)' },
                              { name: isRtl ? '🔵 محيط أزرق' : 'Ocean', grad: 'linear-gradient(135deg, #0284C7 0%, #1E3A8A 100%)' },
                              { name: isRtl ? '🖤 فحم داكن' : 'Carbon', grad: 'linear-gradient(135deg, #18181B 0%, #27272A 100%)' },
                            ].map((g) => (
                              <button
                                key={g.name}
                                type="button"
                                onClick={() => setStoryBgGradient(g.grad)}
                                className={`h-12 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center p-1.5 shadow-sm text-[10px] font-black text-white ${
                                  storyBgGradient === g.grad ? 'border-[#FF3B7C] ring-2 ring-[#FF3B7C]/30 scale-102' : 'border-transparent opacity-85 hover:opacity-100'
                                }`}
                                style={{ background: g.grad }}
                              >
                                <span>{g.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: TEXT & STYLE */}
                  {storyActiveTab === 'style' && (
                    <div className="space-y-3 animate-fadeIn">
                      {/* Caption Text area */}
                      <div className="space-y-1">
                        <label className="block text-xs font-black text-slate-600 uppercase">
                          {isRtl ? '✍️ اكتب نص القصة بحرية:' : '✍️ Write story text:'}
                        </label>
                        <textarea
                          rows={3}
                          maxLength={180}
                          value={storyCaption}
                          onChange={(e) => setStoryCaption(e.target.value)}
                          placeholder={isRtl ? 'اكتب ما تريد مشاركته في القصة... (مثال: تم إنهاء صيانة الكابلات بنجاح!)' : 'Write what you want to share...'}
                          className="w-full bg-slate-50 border border-gray-200 rounded-2xl p-3 text-xs font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F2A44] focus:bg-white transition-all text-right"
                        />
                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold px-1">
                          <span>{180 - storyCaption.length} {isRtl ? 'حرف متبقي' : 'chars left'}</span>
                          <span>{isRtl ? 'الحد الأقصى: 180 حرف' : 'Max 180 chars'}</span>
                        </div>
                      </div>

                      {/* Text Controls Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Font Size */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase">
                            {isRtl ? '📏 حجم الخط:' : '📏 Font Size:'}
                          </label>
                          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                            {[
                              { id: 'sm', label: 'S' },
                              { id: 'md', label: 'M' },
                              { id: 'lg', label: 'L' },
                              { id: 'xl', label: 'XL' },
                            ].map((sz) => (
                              <button
                                key={sz.id}
                                type="button"
                                onClick={() => setStoryFontSize(sz.id as any)}
                                className={`flex-1 py-1 text-xs font-black rounded-lg cursor-pointer transition border-none ${
                                  storyFontSize === sz.id ? 'bg-[#1F2A44] text-white' : 'text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Text Position */}
                        <div className="space-y-1">
                          <label className="block text-[10px] font-black text-slate-500 uppercase">
                            {isRtl ? '📍 الموضع:' : '📍 Position:'}
                          </label>
                          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                            {[
                              { id: 'top', label: isRtl ? 'أعلى 🔝' : 'Top' },
                              { id: 'middle', label: isRtl ? 'وسط 🎯' : 'Mid' },
                              { id: 'bottom', label: isRtl ? 'أسفل ⬇️' : 'Bot' },
                            ].map((pos) => (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() => setStoryTextPosition(pos.id as any)}
                                className={`flex-1 py-1 text-[10px] font-black rounded-lg cursor-pointer transition border-none ${
                                  storyTextPosition === pos.id ? 'bg-[#FF3B7C] text-white' : 'text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Font Color Picker */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase">
                          {isRtl ? '🎨 لون خط النص:' : '🎨 Font Color:'}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: '#ffffff', label: 'أبيض' },
                            { value: '#FFD34D', label: 'أصفر' },
                            { value: '#4FC3F7', label: 'سماوي' },
                            { value: '#2ecc71', label: 'أخضر' },
                            { value: '#FF3B7C', label: 'وردي' },
                            { value: '#FF9800', label: 'برتقالي' },
                            { value: '#0f172a', label: 'أسود' },
                          ].map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setStoryTextColor(c.value)}
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black cursor-pointer transition flex items-center gap-1 ${
                                storyTextColor === c.value ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400' : 'bg-slate-50 text-slate-700 border-gray-200'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: c.value }}></span>
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Box Background Overlay */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase">
                          {isRtl ? '🌌 خلفية صندوق النص:' : '🌌 Text Box Style:'}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { value: 'rgba(15, 23, 42, 0.85)', label: isRtl ? 'زجاجي داكن' : 'Dark Glass' },
                            { value: 'rgba(30, 58, 138, 0.85)', label: isRtl ? 'كحلي' : 'Navy' },
                            { value: 'rgba(6, 78, 59, 0.85)', label: isRtl ? 'زمردي' : 'Forest' },
                            { value: 'rgba(190, 24, 74, 0.85)', label: isRtl ? 'وردي' : 'Rose' },
                            { value: '#ffffff', label: isRtl ? 'أبيض ناصع' : 'White' },
                            { value: 'transparent', label: isRtl ? 'بدون صندوق' : 'Clear' },
                          ].map((bg) => (
                            <button
                              key={bg.value}
                              type="button"
                              onClick={() => {
                                setStoryTextBg(bg.value);
                                if (bg.value === '#ffffff') setStoryTextColor('#0f172a');
                              }}
                              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black cursor-pointer transition ${
                                storyTextBg === bg.value ? 'bg-[#1F2A44] text-white border-[#1F2A44]' : 'bg-slate-50 text-slate-600 border-gray-200'
                              }`}
                            >
                              {bg.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: STICKERS & STAMPS */}
                  {storyActiveTab === 'sticker' && (
                    <div className="space-y-3 animate-fadeIn">
                      <label className="block text-xs font-black text-slate-600 uppercase">
                        {isRtl ? '🏷️ اختر شارة أو ملصق للختم على القصة:' : '🏷️ Choose sticker stamp:'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          '🎯 إثبات عمل',
                          '✅ تم الإنجاز',
                          '⚡ كويست سريع',
                          '🇩🇿 100% جزائري',
                          '🔥 تجربة ممتازة',
                          '💼 عمل احترافي',
                          '⭐ موثوق رسمياً',
                          'بدون شارة'
                        ].map((st) => {
                          const val = st === 'بدون شارة' ? '' : st;
                          const isSelected = storySticker === val;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setStorySticker(val)}
                              className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer text-center ${
                                isSelected 
                                  ? 'bg-[#1F2A44] text-white border-[#1F2A44] shadow-md ring-2 ring-[#1F2A44]/20'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-gray-200'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreatingStory(false)}
                    className="flex-1 py-3 border border-gray-200 hover:bg-slate-50 text-slate-600 font-extrabold text-xs rounded-xl cursor-pointer transition active:scale-98"
                  >
                    {isRtl ? 'إلغاء وتراجع' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={executePublishStory}
                    className="flex-1.5 py-3 bg-gradient-to-r from-[#FF3B7C] via-[#FF8008] to-[#FFD34D] hover:opacity-95 text-white font-black text-xs rounded-xl cursor-pointer shadow-md transition transform active:scale-98 flex items-center justify-center gap-1.5 border-none"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-100 fill-white" />
                    <span>{isRtl ? 'نشر قصتك الآن 🚀🔥' : 'Publish Story Now 🚀🔥'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED BOOKING FLOW PREVIEW DRAWER */}
      <AnimatePresence>
        {selectedQuest && (() => {
          const tokenAmount = calculateBookingFee(selectedQuest.cashReward);
          
          const galleryImages: string[] = [];
          if (selectedQuest.images && selectedQuest.images.length > 0) {
            galleryImages.push(...selectedQuest.images);
          } else if (selectedQuest.imageUrls && selectedQuest.imageUrls.length > 0) {
            galleryImages.push(...selectedQuest.imageUrls);
          } else if (selectedQuest.imageUrl) {
            galleryImages.push(selectedQuest.imageUrl);
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
                        {lang === 'ar' ? 'عاجل جداً 🔥' : 'Urgent 🔥'}
                      </span>
                    )}
                  </div>

                  {/* 👤 Created by owner block */}
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

                  <h3 className="text-xl sm:text-2xl font-black text-[#FF3B7C] leading-snug tracking-tight text-start mt-1.5 pr-10 w-full">
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
                    <h4 className="text-gray-400 font-bold text-[10px] uppercase mb-1">{lang === 'ar' ? 'الموقع الجغرافي للمهمة' : 'Chore Delivery Landmark Location'}</h4>
                    {(() => {
                      const isApprovedAndActive = (selectedQuest.helperId === userProfile.id || selectedQuest.assignedRunnerId === userProfile.id || selectedQuest.assignedRunnerIds?.includes(userProfile.id)) && selectedQuest.status !== 'completed';
                      const isLocationAuthorized = selectedQuest.creatorId === userProfile.id || isApprovedAndActive;
                      return (
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-2xl border border-gray-150/50">
                          {isLocationAuthorized ? (
                            <>
                              <MapPin className="w-4 h-4 text-[#4FC3F7] shrink-0" />
                              <span className="truncate">{selectedQuest.location}</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                              <span className="text-slate-400 truncate">
                                {lang === 'ar' ? '🔒 الموقع مخفي حتى قبول الحجز وتفعيل العقد' : '🔒 Location hidden until booking approved'}
                              </span>
                            </>
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
                          💰 {lang === 'ar' ? 'العائد المالي النقدي الميداني' : 'Direct Cash Payout'}
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-white font-mono flex items-baseline gap-1">
                          {selectedQuest.cashReward} <span className="text-xs font-sans text-gray-300 font-semibold">{lang === 'ar' ? 'دينار جزائري (د.ج)' : 'DZD / DA'}</span>
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-gray-300 block font-black uppercase tracking-wider mb-1">
                          ⚡ {lang === 'ar' ? 'الرمز المطلوب والمسحوب لحجز' : 'Required Tokens'}
                        </span>
                        <span className="text-md sm:text-lg font-black text-[#FFD34D] font-mono flex items-center justify-end gap-1">
                          ⚡ {tokenAmount} <span className="text-[10px] font-sans text-gray-300 font-bold">Tokens</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-[9.5px] text-gray-300 font-bold leading-relaxed border-t border-white/10 pt-2 text-start">
                      ℹ️ {lang === 'ar' 
                        ? 'الدفع يتم يداً بيد نقداً مائة بالمائة أو عبر تطبيق بريدي موب (BaridiMob) فور التسليم الميداني. يتم استخدام الرموز المطلوبة فقط لحجز وتثبيت الكويست.' 
                        : 'Paid directly in cash or via BaridiMob transfer on completion. Required tokens are consumed only to book and secure the quest opportunity.'}
                    </div>

                    <div className="space-y-2 pt-1">
                      {selectedQuest.applicants?.some(a => a.userId === userProfile.id) ? (
                        <button
                          disabled
                          className="w-full bg-white/10 text-gray-300 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2"
                        >
                          <span className="text-center">{lang === 'ar' ? 'تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل ⏳' : 'Application pending.. Awaiting creator selection ⏳'}</span>
                        </button>
                      ) : (selectedQuest && calculateDistanceKm(selectedQuest.lat, selectedQuest.lng) > 50) ? (
                        <button
                          disabled
                          className="w-full bg-white/10 border border-white/5 text-gray-400 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2 cursor-not-allowed opacity-75"
                        >
                          <MapPin className="w-4.5 h-4.5 text-gray-400" />
                          <span className="text-center text-[10px] sm:text-xs">
                            {lang === 'ar' ? 'هذه المهمة خارج نطاقك الجغرافي المتاح للحجز 📍' : 'This quest is outside your available geographical booking limit 📍'}
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
                              ? `احجز المهمة الآن: يخصم ${tokenAmount} رمز ⚡` 
                              : `Book Quest Now: Deduct ${tokenAmount} Tokens ⚡`}
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
                  ? '⚠️ لحماية جيراننا في المنصة ومنع الاحتيال، يجب عليك رفع بطاقتك الشخصية وتوثيق هويتك لمرة واحدة قبل حجز أي مهمة!' 
                  : '⚠️ Due to strict community anti-fraud safety measures, workers must provide KYC documentation prior to locking down local requests.'}
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
