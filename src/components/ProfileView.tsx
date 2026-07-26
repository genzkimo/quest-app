import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc, updateDoc, query, collection, where, onSnapshot, arrayUnion, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { 
  User, 
  Phone, 
  MapPin, 
  Settings, 
  ShieldCheck, 
  Bell, 
  Globe, 
  Check, 
  X,
  Edit2, 
  Save, 
  Compass, 
  ShieldAlert, 
  Trophy,
  Star,
  CreditCard,
  CheckCircle2,
  FileCheck2,
  FileText,
  RefreshCcw,
  Sparkles,
  Info,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ShieldQuestion,
  Volume2,
  Smartphone,
  Moon,
  Trash2,
  Camera,
  MessageSquare,
  Image as ImageIcon,
  Copy,
  Zap,
  Gift,
  PartyPopper,
  Share2,
  Receipt
} from 'lucide-react';
import { UserProfile, Badge, HunterReview, GodfatherReview, Quest } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { translations } from '../data/translations';
import { playCoinSound, triggerHaptic, playCameraShutter } from '../utils/audio';
import { compressImage } from '../utils/imageCompressor';
import LeaderboardView from './LeaderboardView';
// رابط الخادم الوسيط (غيّره إلى رابط Render الخاص بك بعد الرفع)
const API_BASE_URL = 'https://quest-app-jne8.onrender.com';


interface ProfileViewProps {
  userProfile: UserProfile;
  badges: Badge[];
  lang: 'ar' | 'fr' | 'en';
  onUpdateProfile: (updatedProfile: Partial<UserProfile>) => void;
  onTopUpTokens: (amount: number) => void;
  onSubmitKYC: (fullName: string, nidNum: string, status?: 'verified' | 'pending', verifiedName?: string, verifiedNid?: string, idFrontUrl?: string, idBackUrl?: string) => void;
  showToast: (msg: string) => void;
  hunterReviews?: HunterReview[];
  godfatherReviews?: GodfatherReview[];
  onDeleteReview?: (reviewId: string) => void;
  authenticatedUser?: any;
  onSignInWithGoogle?: () => void;
  onSignOut?: () => void;
  onViewChange?: (view: any) => void;
  leaders?: any[];
  challenges?: any[];
  onUnlockBadge?: (badgeId: string, cost: number) => void;
  onClaimChallengePoints?: (challengeId: string, reward: number) => void;
  onSimulateActivity?: () => void;
  quests?: Quest[];
  initialSubmenu?: 'main' | 'account' | 'verification' | 'wallet' | 'general' | 'support_chat' | null;
  onClearInitialSubmenu?: () => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
];

export default function ProfileView({ 
  userProfile, 
  badges, 
  lang,
  onUpdateProfile, 
  onTopUpTokens,
  onSubmitKYC,
  showToast,
  hunterReviews = [],
  godfatherReviews = [],
  onDeleteReview,
  authenticatedUser,
  onSignInWithGoogle,
  onSignOut,
  onViewChange,
  leaders = [],
  challenges = [],
  onUnlockBadge = () => {},
  onClaimChallengePoints = () => {},
  onSimulateActivity = () => {},
  quests = [],
  initialSubmenu = null,
  onClearInitialSubmenu = () => {},
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showLeaderboardScreen, setShowLeaderboardScreen] = useState(false);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [name, setName] = useState(userProfile.name);
  const [phone, setPhone] = useState(userProfile.phone);
  const [city, setCity] = useState(userProfile.city);
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatar);
  const [showAvatarChooser, setShowAvatarChooser] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<any>(null);

  // PWA Google Chrome installation trigger state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState<boolean>(true);

  const handleRefresh = async () => {
    try {
      if (userProfile?.id) {
        const { getDoc } = await import('firebase/firestore');
        const userRef = doc(db, 'users', userProfile.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && onUpdateProfile) {
          onUpdateProfile(userSnap.data());
        }
      }
      showToast(lang === 'ar' ? '👤 تم تحديث بيانات حسابك الشخصي!' : '👤 Profile data refreshed successfully!');
    } catch (error) {
      console.error("Failed to refresh profile:", error);
      showToast(lang === 'ar' ? '⚠️ فشل تحديث الملف الشخصي.' : '⚠️ Failed to update profile.');
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Automatically hide button if already running in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User response to app installation request:', outcome);
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    } else {
      showToast(lang === 'ar' 
        ? '💡 لتثبيت تطبيق Quest من متصفح كروم: انقر على قائمة الثلاث نقاط (⋮) في أعلى اليسار/اليمين ثم اختر "تثبيت التطبيق" (Install app) أو "إضافة للشاشة الرئيسية".' 
        : '💡 To install Quest from Google Chrome: Tap the three-dots menu (⋮) in the top-right corner and select "Install app" or "Add to Home Screen".'
      );
    }
  };

  const handleCopyIdWithFeedback = (val: string) => {
    navigator.clipboard.writeText(val).then(() => {
      showToast(lang === 'ar' ? '📋 تم نسخ معرف الحساب!' : '📋 Account ID copied!');
      triggerHaptic('sharp', !!userProfile.hapticFeedbackEnabled);
    }).catch(() => {
      try {
        const el = document.createElement('textarea');
        el.value = val;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(lang === 'ar' ? '📋 تم نسخ معرف الحساب!' : '📋 Account ID copied!');
        triggerHaptic('sharp', !!userProfile.hapticFeedbackEnabled);
      } catch (err) {
        console.error("Copy fallback failure", err);
      }
    });
  };

  const handleCopyToClipboard = (text: string, labelAr: string, labelEn: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(lang === 'ar' ? `📋 تم نسخ ${labelAr}!` : `📋 ${labelEn} copied!`);
      triggerHaptic('sharp', !!userProfile.hapticFeedbackEnabled);
    }).catch(() => {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast(lang === 'ar' ? `📋 تم نسخ ${labelAr}!` : `📋 ${labelEn} copied!`);
        triggerHaptic('sharp', !!userProfile.hapticFeedbackEnabled);
      } catch (err) {
        console.error("Copy fallback failure", err);
      }
    });
  };

  const handleStartPress = (val: string) => {
    const timer = setTimeout(() => {
      handleCopyIdWithFeedback(val);
    }, 600); // 600ms hold time
    setLongPressTimer(timer);
  };

  const handleCancelPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Dedicated Settings Screen toggles
  const [showSettingsScreen, setShowSettingsScreen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'main' | 'account' | 'verification' | 'wallet' | 'general' | 'support_chat' | 'free_tokens'>('main');
  const [userSupportTickets, setUserSupportTickets] = useState<any[]>([]);
  const [isLoadingUserSupport, setIsLoadingUserSupport] = useState(false);
  const [selectedUserTicketId, setSelectedUserTicketId] = useState<string | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [isSubmittingNewTicket, setIsSubmittingNewTicket] = useState(false);
  const [newTicketReplyText, setNewTicketReplyText] = useState('');
  const [isSendingTicketReply, setIsSendingTicketReply] = useState(false);

  // Referral and Check-in Matrix States
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [isApplyingReferral, setIsApplyingReferral] = useState(false);
  const [secondsUntilMidnight, setSecondsUntilMidnight] = useState(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  });

  useEffect(() => {
    if (activeSubmenu === 'free_tokens') {
      const timer = setInterval(() => {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        setSecondsUntilMidnight(Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000)));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeSubmenu]);

  useEffect(() => {
    if (initialSubmenu) {
      setShowSettingsScreen(true);
      setActiveSubmenu(initialSubmenu);
      if (onClearInitialSubmenu) {
        onClearInitialSubmenu();
      }
    }
  }, [initialSubmenu, onClearInitialSubmenu]);

  // Real-time listener for current user's support tickets
  useEffect(() => {
    if (!userProfile?.id || activeSubmenu !== 'support_chat') return;

    setIsLoadingUserSupport(true);
    const q = query(collection(db, 'support_tickets'), where('userId', '==', userProfile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets: any[] = [];
      snapshot.forEach((docSnapshot) => {
        tickets.push({ ...docSnapshot.data(), id: docSnapshot.id });
      });
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUserSupportTickets(tickets);
      setIsLoadingUserSupport(false);
    }, (err) => {
      console.error("Error loading support ticket for user:", err);
      setIsLoadingUserSupport(false);
    });

    return () => unsubscribe();
  }, [userProfile?.id, activeSubmenu]);

  const [userRefillRequests, setUserRefillRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!userProfile?.id || activeSubmenu !== 'wallet') return;
    const q = query(collection(db, 'refill_requests'), where('userId', '==', userProfile.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnapshot) => {
        list.push({ ...docSnapshot.data(), id: docSnapshot.id });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUserRefillRequests(list);
    }, (err) => {
      console.error("Error loading user refill requests:", err);
    });
    return () => unsubscribe();
  }, [userProfile?.id, activeSubmenu]);
  const [mainBio, setMainBio] = useState(userProfile.bio || localStorage.getItem('runner_bio') || '');
  const [isEditingMainBio, setIsEditingMainBio] = useState(false);
  const [tempBio, setTempBio] = useState(mainBio);

  const handleSaveBio = () => {
    setMainBio(tempBio);
    localStorage.setItem('runner_bio', tempBio);
    setIsEditingMainBio(false);
    onUpdateProfile({ bio: tempBio });
    showToast(lang === 'ar' ? '✅ تم تحديث السيرة الذاتية بنجاح!' : '✅ Bio updated successfully!');
  };

  // Settings states correspond exactly to profile keys
  const [language, setLanguage] = useState<'ar' | 'fr' | 'en'>(lang);
  const [enableNotifications, setEnableNotifications] = useState(userProfile.enableNotifications);
  const [privacyEnabled, setPrivacyEnabled] = useState(userProfile.privacyEnabled);
  const [audioEffectsEnabled, setAudioEffectsEnabled] = useState(!!userProfile.audioEffectsEnabled);
  const [hapticFeedbackEnabled, setHapticFeedbackEnabled] = useState(!!userProfile.hapticFeedbackEnabled);
  const [lowPerformanceModeEnabled, setLowPerformanceModeEnabled] = useState(!!userProfile.lowPerformanceModeEnabled);

  useEffect(() => {
    setLanguage(lang);
  }, [lang]);

  useEffect(() => {
    setEnableNotifications(userProfile.enableNotifications);
    setPrivacyEnabled(userProfile.privacyEnabled);
    setAudioEffectsEnabled(!!userProfile.audioEffectsEnabled);
    setHapticFeedbackEnabled(!!userProfile.hapticFeedbackEnabled);
    setLowPerformanceModeEnabled(!!userProfile.lowPerformanceModeEnabled);
  }, [userProfile]);

  // KYC form states
  const [kycFullName, setKycFullName] = useState('');
  const [kycNid, setKycNid] = useState('');
  const [uploadedFront, setUploadedFront] = useState(false);
  const [uploadedBack, setUploadedBack] = useState(false);
  const [kycFrontBase64, setKycFrontBase64] = useState<string | null>(null);
  const [kycBackBase64, setKycBackBase64] = useState<string | null>(null);
  const [kycAiLoading, setKycAiLoading] = useState(false);
  const [kycAiResult, setKycAiResult] = useState<{
    status: 'APPROVED' | 'SUSPICIOUS' | 'REJECTED';
    confidence_score: number;
    extracted_name: string;
    extracted_nid: string;
    matches_name: boolean;
    matches_nid: boolean;
    reason_arabic: string;
  } | null>(null);

  // Google Play 2026 Data Safety & Consent states
  const [showKycDisclosure, setShowKycDisclosure] = useState(false);
  const [pendingKycTrigger, setPendingKycTrigger] = useState<'front' | 'back' | null>(null);
  
  // Right to be forgotten state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return 'FINGERPRINT_' + Math.abs(hash).toString(16);
  };

  // Top up gateway states with Manual Proof-of-Payment Verification
  const [refillPaymentMethod, setRefillPaymentMethod] = useState<'baridimob' | 'ccp' | 'googleplay'>('baridimob');
  const [refillAmount, setRefillAmount] = useState<number>(3000);
  const [refillReference, setRefillReference] = useState('');
  const [refillDate, setRefillDate] = useState(new Date().toISOString().split('T')[0]);
  const [refillReceiptBase64, setRefillReceiptBase64] = useState<string | null>(null);
  const [refillReceiptFileName, setRefillReceiptFileName] = useState('');
  const [refillReceiptUploading, setRefillReceiptUploading] = useState(false);
  const [refillReceiptProgress, setRefillReceiptProgress] = useState(0);
  const [refillReceiptUploaded, setRefillReceiptUploaded] = useState(false);
  const [refillLoading, setRefillLoading] = useState(false);

  // PayPal online checkout states
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [refillAmountUSD, setRefillAmountUSD] = useState<number>(10);
  const [paypalPayerEmail, setPaypalPayerEmail] = useState('');
  const [paypalCheckoutMode, setPaypalCheckoutMode] = useState<'card' | 'paypal_direct'>('paypal_direct');
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [pendingTxId, setPendingTxId] = useState('');
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState('');
  const [otpError, setOtpError] = useState('');

  // Google Play Billing simulation states
  const [selectedGooglePackage, setSelectedGooglePackage] = useState<{ id: string; tokens: number; price: string; priceUSD: number } | null>({
    id: 'tokens_1000',
    tokens: 1000,
    price: '9.99$',
    priceUSD: 9.99
  });
  const [showGooglePlaySheet, setShowGooglePlaySheet] = useState(false);
  const [googlePlayStatus, setGooglePlayStatus] = useState<'idle' | 'purchasing' | 'success'>('idle');
  const [verificationResult, setVerificationResult] = useState<{
    status: 'APPROVED' | 'SUSPICIOUS' | 'REJECTED' | null;
    confidence_score?: number;
    extracted_data?: {
      amount_dzd?: string | null;
      date?: string | null;
      reference_number?: string | null;
    };
    reason_arabic?: string;
  } | null>(null);

  const [activeProfileTab, setActiveProfileTab] = useState<'verified' | 'gallery' | 'badges'>('verified');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const dict = translations[lang];
  const isRtl = lang === 'ar';

  // Filter user's unlocked badges
  const unlockedBadgesObj = badges.filter(badge => 
    userProfile.unlockedBadgeIds.includes(badge.id) || badge.unlocked
  );

  const getCleanEmail = (emailStr?: string) => (emailStr || '').trim().toLowerCase();
  const isAdminUser = !!(
    getCleanEmail(authenticatedUser?.email) === 'hakerzoldyck@gmail.com' ||
    authenticatedUser?.role === 'admin' ||
    getCleanEmail(userProfile?.email) === 'hakerzoldyck@gmail.com' ||
    userProfile?.role === 'admin' ||
    userProfile?.isAdmin === true
  );

  const handleSaveProfile = () => {
    onUpdateProfile({
      name,
      phone,
      city,
      avatar: selectedAvatar,
      language
    });
    setIsEditing(false);
    showToast(lang === 'ar' ? '✅ تم تحديث بيانات الحساب بنجاح!' : '✅ Profile saved successfully!');
  };

  const handleToggleNotifications = () => {
    const newVal = !enableNotifications;
    setEnableNotifications(newVal);
    onUpdateProfile({ enableNotifications: newVal });
  };

  const handleTogglePrivacy = () => {
    const newVal = !privacyEnabled;
    setPrivacyEnabled(newVal);
    onUpdateProfile({ privacyEnabled: newVal });
  };

  const handleToggleAudioEffects = () => {
    const newVal = !audioEffectsEnabled;
    setAudioEffectsEnabled(newVal);
    onUpdateProfile({ audioEffectsEnabled: newVal });
    if (newVal) {
      playCoinSound(true);
    }
  };

  const handleToggleHapticFeedback = () => {
    const newVal = !hapticFeedbackEnabled;
    setHapticFeedbackEnabled(newVal);
    onUpdateProfile({ hapticFeedbackEnabled: newVal });
    if (newVal) {
      triggerHaptic('sharp', true);
    }
  };

  const handleToggleLowPerformanceMode = () => {
    const newVal = !lowPerformanceModeEnabled;
    setLowPerformanceModeEnabled(newVal);
    onUpdateProfile({ lowPerformanceModeEnabled: newVal });
    triggerHaptic('sharp', hapticFeedbackEnabled);
    showToast(lang === 'ar'
      ? (newVal ? '🚀 تم تفعيل وضع تسريع الأجهزة الضعيفة! تم تقليل المؤثرات البصرية والخلفيات المضببة لضمان سلاسة فائقة.' : '♻️ تم العودة للوضع الرسومي الكامل.')
      : (newVal ? '🚀 Performance speed mode activated! Animations and blurs reduced for optimal FPS.' : '♻️ Returned to full quality graphics mode.')
    );
  };

  // Native NID / KYC Photo Select file input refs
  const nidFrontInputRef = useRef<HTMLInputElement>(null);
  const nidBackInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Runner portfolio state (starts empty and allows custom native phone file uploads)
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>(() => {
    const saved = localStorage.getItem('runner_portfolio_photos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((url: string) => typeof url === 'string' && !url.includes('unsplash.com'));
        }
      } catch (e) {}
    }
    return [];
  });

  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioProgress, setPortfolioProgress] = useState(0);

  const handleLangSelect = (target: 'ar' | 'fr' | 'en') => {
    setLanguage(target);
    onUpdateProfile({ language: target });
  };

  const [kycUploadingFront, setKycUploadingFront] = useState(false);
  const [kycProgressFront, setKycProgressFront] = useState(0);
  const [kycUploadingBack, setKycUploadingBack] = useState(false);
  const [kycProgressBack, setKycProgressBack] = useState(0);

  // States to limit/expand user profile feedback list
  const [showAllRunnerReviews, setShowAllRunnerReviews] = useState(false);
  const [showAllGodfatherReviews, setShowAllGodfatherReviews] = useState(false);
  const [reviewRoleTab, setReviewRoleTab] = useState<'hunter' | 'godfather'>('hunter');

  // States to limit/expand user profile feedback image captions
  const [portfolioCaptions, setPortfolioCaptions] = useState<{[url: string]: string}>(() => {
    const saved = localStorage.getItem('runner_portfolio_captions');
    return saved ? JSON.parse(saved) : {};
  });
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [tempCaption, setTempCaption] = useState('');

  const openLightbox = (url: string) => {
    setLightboxUrl(url);
    setTempCaption(portfolioCaptions[url] || '');
    setIsEditingCaption(false);
  };

  // Custom Portfolio item click & add trigger (simulates gallery slide expansion)
  const triggerAddPortfolioPhoto = () => {
    if (portfolioPhotos.length >= 10) {
      showToast(lang === 'ar' ? '⚠️ لقد وصلت للحد الأقصى المسموح به (10 صور) في معرض الأعمال!' : '⚠️ You have reached the maximum limit of 10 photos in your portfolio!');
      return;
    }
    playCameraShutter(audioEffectsEnabled);
    if (portfolioInputRef.current) {
      portfolioInputRef.current.value = '';
      portfolioInputRef.current.click();
    }
  };

  const handlePortfolioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (portfolioPhotos.length >= 10) {
      showToast(lang === 'ar' ? '⚠️ لقد وصلت للحد الأقصى المسموح به (10 صور)!' : '⚠️ Maximum of 10 photos reached!');
      return;
    }

    setPortfolioUploading(true);
    setPortfolioProgress(15);
    try {
      const file = files[0];
      // Run optimized 1080x1080 compress check with 70% quality output
      const compressedDataUrl = await compressImage(file);
      setPortfolioProgress(85);

      const newPhotos = [...portfolioPhotos, compressedDataUrl];
      setPortfolioPhotos(newPhotos);
      localStorage.setItem('runner_portfolio_photos', JSON.stringify(newPhotos));

      setPortfolioProgress(100);
      setTimeout(() => {
        setPortfolioUploading(false);
        showToast(
          lang === 'ar' 
            ? '📸 تم رفع وضغط صورة إثبات العمل في البورتفوليو بنجاح (١٠٨٠ بكسل)!' 
            : '📸 Success! Expanded digital portfolio with highly-compressed 1080px gallery item.'
        );
      }, 150);
    } catch (err) {
      console.error(err);
      setPortfolioUploading(false);
      showToast('⚠️ Error processing chosen portfolio image file');
    }
  };

  // Custom User Avatar click & add trigger
  const triggerAvatarGalleryPicker = () => {
    playCameraShutter(audioEffectsEnabled);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
      avatarInputRef.current.click();
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showToast(lang === 'ar' ? '⏳ جاري تعديل وضغط القماش الشخصي...' : '⏳ Streaming custom avatar from gallery and compressing...');
    try {
      const file = files[0];
      const compressedUrl = await compressImage(file);
      setSelectedAvatar(compressedUrl);
      showToast(lang === 'ar' ? '📸 تم تعيين الصورة المختارة من الاستوديو!' : '📸 Profile image loaded from system gallery with high compression!');
    } catch (err: any) {
      console.error(err);
      showToast('⚠️ Error loading gallery image');
    }
  };

  // NID Identity card trigger (Front side gallery capture)
  const triggerNIDFront = () => {
    if (!localStorage.getItem('kyc_disclosure_accepted')) {
      setPendingKycTrigger('front');
      setShowKycDisclosure(true);
      return;
    }
    playCameraShutter(audioEffectsEnabled);
    if (nidFrontInputRef.current) {
      nidFrontInputRef.current.value = '';
      nidFrontInputRef.current.click();
    }
  };

  const handleNIDFrontFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setKycUploadingFront(true);
    setKycProgressFront(10);
    setUploadedFront(false);
    setKycFrontBase64(null);

    let interval: NodeJS.Timeout | null = null;
    try {
      const file = files[0];
      let p = 10;
      interval = setInterval(() => {
        p += 25;
        if (p >= 90) {
          if (interval) clearInterval(interval);
        } else setKycProgressFront(p);
      }, 80);

      // Perform direct offline JPEG quality evaluation
      const compressedDataUrl = await compressImage(file);
      if (interval) clearInterval(interval);
      setKycFrontBase64(compressedDataUrl);
      setKycProgressFront(100);
      setUploadedFront(true);
      setKycUploadingFront(false);
      showToast(
        lang === 'ar' 
          ? '📸 تم تفحص وضغط الوجه الأمامي من بطاقة الهوية الوطنية بنجاح!' 
          : '📸 NID Front side loaded, parsed, and compressed from smart gallery!'
      );
    } catch (err: any) {
      if (interval) clearInterval(interval);
      console.error(err);
      setKycUploadingFront(false);
      showToast('⚠️ Failed to compress ID Front Card screenshot');
    }
  };

  // NID Identity card trigger (Back side gallery capture)
  const triggerNIDBack = () => {
    if (!localStorage.getItem('kyc_disclosure_accepted')) {
      setPendingKycTrigger('back');
      setShowKycDisclosure(true);
      return;
    }
    playCameraShutter(audioEffectsEnabled);
    if (nidBackInputRef.current) {
      nidBackInputRef.current.value = '';
      nidBackInputRef.current.click();
    }
  };

  const handleAcceptDisclosure = () => {
    localStorage.setItem('kyc_disclosure_accepted', 'true');
    setShowKycDisclosure(false);
    const trigger = pendingKycTrigger;
    setPendingKycTrigger(null);
    if (trigger === 'front') {
      if (nidFrontInputRef.current) {
        nidFrontInputRef.current.value = '';
        nidFrontInputRef.current.click();
      }
    } else if (trigger === 'back') {
      if (nidBackInputRef.current) {
        nidBackInputRef.current.value = '';
        nidBackInputRef.current.click();
      }
    }
  };

  const handleNIDBackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setKycUploadingBack(true);
    setKycProgressBack(10);
    setUploadedBack(false);
    setKycBackBase64(null);

    let interval: NodeJS.Timeout | null = null;
    try {
      const file = files[0];
      let p = 10;
      interval = setInterval(() => {
        p += 25;
        if (p >= 90) {
          if (interval) clearInterval(interval);
        } else setKycProgressBack(p);
      }, 80);

      // Perform direct offline JPEG quality evaluation
      const compressedDataUrl = await compressImage(file);
      if (interval) clearInterval(interval);
      setKycBackBase64(compressedDataUrl);
      setKycProgressBack(100);
      setUploadedBack(true);
      setKycUploadingBack(false);
      showToast(
        lang === 'ar' 
          ? '📸 تم تفحص وضغط الوجه الخلفي موثقاً من بطاقة الهوية!' 
          : '📸 NID Back side loaded, parsed, and compressed from smart gallery!'
      );
    } catch (err: any) {
      if (interval) clearInterval(interval);
      console.error(err);
      setKycUploadingBack(false);
      showToast('⚠️ Failed to compress ID Back Card screenshot');
    }
  };

  const handleKycSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycFullName || !kycNid || !uploadedFront || !uploadedBack || !kycFrontBase64 || !kycBackBase64) {
      showToast(lang === 'ar' ? '⚠️ يرجى تعبئة كافة الحقول وبصمات الصور!' : '⚠️ Fill all fields and upload physical screenshots.');
      return;
    }

    setKycAiLoading(true);
    setKycAiResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/kyc/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: kycFullName.trim(),
          nid: kycNid.trim(),
          frontBase64: kycFrontBase64,
          backBase64: kycBackBase64,
          userId: authenticatedUser?.uid || 'user-current'
        })
      });

      if (!response.ok) {
        throw new Error("Server-side verification failed");
      }

      const data = await response.json();
      setKycAiResult(data);

      if (data.status === 'APPROVED') {
        onSubmitKYC(kycFullName, kycNid, 'verified', data.extracted_name || kycFullName, data.extracted_nid || kycNid, kycFrontBase64, kycBackBase64);

        const uId = userProfile?.id || authenticatedUser?.uid;
        if (uId) {
          updateDoc(doc(db, 'users', uId), {
            idVerificationStatus: 'verified',
            idDocumentUrl: kycFrontBase64 || kycBackBase64 || '',
            idCardUrl: kycFrontBase64 || kycBackBase64 || '',
            idFrontUrl: kycFrontBase64 || '',
            idBackUrl: kycBackBase64 || '',
            verifiedName: data.extracted_name || kycFullName,
            verifiedNid: data.extracted_nid || kycNid,
            kycFullName: kycFullName.trim(),
            kycNid: kycNid.trim()
          }).catch(console.error);

          const notifRef = doc(collection(db, 'notifications'));
          setDoc(notifRef, {
            id: notifRef.id,
            userId: uId,
            text: lang === 'ar' 
              ? '🎉 تم قبول وتوثيق هويتك بنجاح بواسطة الذكاء الاصطناعي وترقية حسابك إلى حساب موثق وإضافة +700 توكن إضافية!'
              : '🎉 AI identity verification successful! Your account is now fully verified with +700 bonus tokens!',
            questId: '',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'kyc_approved'
          }).catch(console.error);
        }

        showToast(lang === 'ar' ? '🎉 تم التحقق من هويتك بنجاح بواسطة الذكاء الاصطناعي وترقية حسابك وإضافة 700 توكن!' : '🎉 AI identity verification successful! +700 tokens added & verified!');
      } else if (data.status === 'SUSPICIOUS') {
        onSubmitKYC(kycFullName, kycNid, 'pending', data.extracted_name || kycFullName, data.extracted_nid || kycNid, kycFrontBase64, kycBackBase64);

        const uId = userProfile?.id || authenticatedUser?.uid;
        if (uId) {
          updateDoc(doc(db, 'users', uId), {
            idVerificationStatus: 'pending',
            idDocumentUrl: kycFrontBase64 || kycBackBase64 || '',
            idCardUrl: kycFrontBase64 || kycBackBase64 || '',
            idFrontUrl: kycFrontBase64 || '',
            idBackUrl: kycBackBase64 || '',
            verifiedName: data.extracted_name || kycFullName,
            verifiedNid: data.extracted_nid || kycNid,
            kycFullName: kycFullName.trim(),
            kycNid: kycNid.trim()
          }).catch(console.error);

          const notifRef = doc(collection(db, 'notifications'));
          const reasonStr = data.reason_arabic || 'مطلوب التدقيق اليدوي لضمان سلامة بياناتك.';
          setDoc(notifRef, {
            id: notifRef.id,
            userId: uId,
            text: lang === 'ar' 
              ? `🕒 تم توجيه ملف هويتك للمراجعة اليدوية من قبل إدارة المنصة. السبب: ${reasonStr}`
              : `🕒 Identity routed to manual admin review. Reason: ${reasonStr}`,
            questId: '',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'kyc_pending'
          }).catch(console.error);
        }

        showToast(lang === 'ar' ? '🕒 تم إرسال الملف للتدقيق اليدوي للاشتباه ببعض المدخلات.' : '🕒 File routed to manual admin review due to suspicious metadata mismatch.');
      } else {
        const uId = userProfile?.id || authenticatedUser?.uid;
        if (uId) {
          const notifRef = doc(collection(db, 'notifications'));
          const reasonStr = data.reason_arabic || 'عدم تطابق المعلومات أو عدم وضوح الصور.';
          setDoc(notifRef, {
            id: notifRef.id,
            userId: uId,
            text: lang === 'ar' 
              ? `❌ تم رفض توثيق الهوية من قبل الذكاء الاصطناعي. السبب: ${reasonStr}`
              : `❌ AI identity verification rejected. Reason: ${reasonStr}`,
            questId: '',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'kyc_rejected'
          }).catch(console.error);
        }

        showToast(lang === 'ar' ? '❌ تم رفض وثائق الهوية من قبل الذكاء الاصطناعي لعدم التطابق.' : '❌ AI identity verification rejected.');
      }

    } catch (err) {
      console.error("AI KYC Verification Error:", err);
      onSubmitKYC(kycFullName, kycNid, 'pending', kycFullName, kycNid, kycFrontBase64, kycBackBase64);

      const uId = userProfile?.id || authenticatedUser?.uid;
      if (uId) {
        updateDoc(doc(db, 'users', uId), {
          idVerificationStatus: 'pending',
          idDocumentUrl: kycFrontBase64 || kycBackBase64 || '',
          idCardUrl: kycFrontBase64 || kycBackBase64 || '',
          idFrontUrl: kycFrontBase64 || '',
          idBackUrl: kycBackBase64 || '',
          verifiedName: kycFullName,
          verifiedNid: kycNid,
          kycFullName: kycFullName.trim(),
          kycNid: kycNid.trim()
        }).catch(console.error);
      }
      setKycAiResult({
        status: 'SUSPICIOUS',
        confidence_score: 0.5,
        extracted_name: kycFullName,
        extracted_nid: kycNid,
        matches_name: true,
        matches_nid: true,
        reason_arabic: "حدث عطل رقمي مؤقت أثناء الاتصال بنظام التدقيق التلقائي. لقد تم استلام وحفظ وثائق هويتك بنجاح، وتوجيه طلبك فوراً للمراجعة والتدقيق اليدوي من قبل إدارة المنصة في لوحة التحكم لضمان حقك وتفعيل حسابك دون ظلم قريباً."
      });
      showToast(lang === 'ar' ? '⚠️ حدث خطأ رقمي مؤقت. تم حفظ طلبك وإرساله فوراً للمراجعة اليدوية لضمان عدم ظلمك.' : '⚠️ Temporary technical error. Routed to manual verification to avoid unfair rejection.');
    } finally {
      setKycAiLoading(false);
    }
  };

  const handleDeleteAccountRequest = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteAccountConfirm = async () => {
    try {
      if (!userProfile?.id) return;
      
      const emailToHash = userProfile.email || 'anonymous';
      const nidToHash = kycNid || 'no_nid';
      const identityFingerprint = hashString(emailToHash + '_' + nidToHash);

      // Store hashed fingerprint inside "deleted_users_fingerprints" for anti-abuse soft delete
      await setDoc(doc(db, 'deleted_users_fingerprints', identityFingerprint), {
        hashedIdentity: identityFingerprint,
        deletedAt: new Date().toISOString(),
        antiAbuseEnforced: true,
      });

      // Clear NID document & user profile node from Firestore
      await deleteDoc(doc(db, 'users', userProfile.id));

      showToast(lang === 'ar' 
        ? '🗑️ تم وبنجاح كامل حذف كافة مستندات الهوية وسجلات الحساب والامتثال لحق النسيان!' 
        : '🗑️ Successfully expunged NID records and deleted the account. Compliance fulfilled!');

      setShowDeleteConfirm(false);
      
      if (onSignOut) {
        onSignOut();
      }
    } catch (err: any) {
      console.error("Failed to delete account:", err);
      showToast('⚠️ Error complying with account deletion: ' + err.message);
    }
  };

  // Trigger receipt selection
  const triggerReceiptCapture = () => {
    playCameraShutter(audioEffectsEnabled);
    if (receiptInputRef.current) {
      receiptInputRef.current.value = '';
      receiptInputRef.current.click();
    }
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setRefillReceiptUploading(true);
    setRefillReceiptProgress(10);
    setRefillReceiptUploaded(false);
    setVerificationResult(null);

    let interval: NodeJS.Timeout | null = null;
    try {
      const file = files[0];
      setRefillReceiptFileName(file.name);
      let p = 10;
      interval = setInterval(() => {
        p += 25;
        if (p >= 90) {
          if (interval) clearInterval(interval);
        } else setRefillReceiptProgress(p);
      }, 80);

      const compressedDataUrl = await compressImage(file);
      if (interval) clearInterval(interval);
      setRefillReceiptProgress(100);
      setRefillReceiptBase64(compressedDataUrl);
      setRefillReceiptUploaded(true);
      setRefillReceiptUploading(false);
      showToast(
        lang === 'ar' 
          ? '📸 تم تحميل وضغط وصل الدفع بنجاح!' 
          : '📸 Receipt proof loaded and compressed successfully!'
      );
    } catch (err: any) {
      if (interval) clearInterval(interval);
      console.error(err);
      setRefillReceiptUploading(false);
      showToast('⚠️ Failed to load or compress receipt image');
    }
  };

  // Refill top up via Manual receipt submission & Gemini verification / PayPal digital checkout
  const executeRefill = async (e: React.FormEvent) => {
    e.preventDefault();

    if (refillPaymentMethod === 'googleplay') {
      if (!selectedGooglePackage) {
        showToast(lang === 'ar' ? '⚠️ يرجى تحديد الحزمة المراد شحنها!' : '⚠️ Please select a package to purchase!');
        return;
      }
      setGooglePlayStatus('idle');
      setShowGooglePlaySheet(true);
      return;
    }

    if (refillPaymentMethod === 'paypal') {
      if (paypalCheckoutMode === 'card') {
        if (!cardHolderName.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
          showToast(lang === 'ar' ? '⚠️ يرجى ملء كافة معلومات البطاقة الائتمانية!' : '⚠️ Please fill out all credit card fields!');
          return;
        }
        if (cardNumber.trim().replace(/\s/g, '').length < 12) {
          showToast(lang === 'ar' ? '⚠️ رقم البطاقة غير صالح!' : '⚠️ Card number is invalid!');
          return;
        }
      } else {
        if (!paypalPayerEmail.trim() || !paypalPayerEmail.includes('@')) {
          showToast(lang === 'ar' ? '⚠️ يرجى إدخال بريد PayPal الإلكتروني صالح!' : '⚠️ Please enter a valid PayPal email address!');
          return;
        }
      }

      if (refillAmountUSD <= 0) {
        showToast(lang === 'ar' ? '⚠️ يرجى إدخال قيمة شحن صالحة بالدولار!' : '⚠️ Please enter a valid USD amount!');
        return;
      }

      setRefillLoading(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/wallet/initiate-paypal-refill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authenticatedUser?.uid || 'user-current',
            userEmail: authenticatedUser?.email || '',
            amountUSD: refillAmountUSD,
            cardHolderName: paypalCheckoutMode === 'card' ? cardHolderName.trim() : null,
            cardNumber: paypalCheckoutMode === 'card' ? cardNumber.trim() : null,
            cardExpiry: paypalCheckoutMode === 'card' ? cardExpiry.trim() : null,
            cardCvv: paypalCheckoutMode === 'card' ? cardCvv.trim() : null,
            paypalPayerEmail: paypalCheckoutMode === 'paypal_direct' ? paypalPayerEmail.trim() : null,
            checkoutMode: paypalCheckoutMode
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Server validation failed');
        }

        const data = await response.json();
        setGeneratedOtp(data.otp);
        setPendingTxId(data.transactionId);
        setPaypalApprovalUrl(data.approvalUrl || '');
        setOtpValue('');
        setOtpError('');
        setShowOtpPopup(true);
        showToast(lang === 'ar' ? `🔒 تم إرسال رمز الأمان OTP الافتراضي: ${data.otp}` : `🔒 Simulated 3D Secure safety OTP sent: ${data.otp}`);
      } catch (err: any) {
        console.error("PayPal initiation failed, routing to manual review:", err);
        try {
          const fallbackTxId = 'PAYPAL_INIT_FAIL_' + Math.floor(100000 + Math.random() * 900000);
          const requestRef = doc(db, 'refill_requests', fallbackTxId);
          const reasonText = lang === 'ar'
            ? `فشل فني في بدء بوابة الدفع الرقمية لـ PayPal بقيمة $${refillAmountUSD} (${refillAmountUSD * 150} توكن). تم توجيه العملية تلقائياً إلى المراجعة اليدوية للتحقق وشحن حسابك وتفادي أي أخطاء.`
            : `PayPal payment initiation of $${refillAmountUSD} (${refillAmountUSD * 150} Tokens) failed due to a gateway error. The request has been saved and routed for manual administrative review.`;

          await setDoc(requestRef, {
            userId: userProfile?.id || authenticatedUser?.uid || 'user-current',
            userEmail: userProfile?.email || authenticatedUser?.email || '',
            paymentMethod: 'paypal_direct',
            amount: refillAmountUSD * 150,
            amountUSD: refillAmountUSD,
            referenceNumber: fallbackTxId,
            date: new Date().toISOString().split('T')[0],
            status: 'suspicious',
            createdAt: new Date().toISOString(),
            verifiedBy: 'Client-PayPal-Initiate-Fallback',
            reason: reasonText
          });

          showToast(lang === 'ar'
            ? '⚠️ حدث عطل فني في بوابة الدفع. تم حفظ طلب الشحن وتوجيهه للمراجعة اليدوية لضمان شحن رصيدك.'
            : '⚠️ Payment gateway error. Your recharge request has been saved and routed for manual administrative review.'
          );
        } catch (dbErr) {
          console.error("Failed to write PayPal initiate fallback to DB:", dbErr);
        }
      } finally {
        setRefillLoading(false);
      }
      return;
    }

    if (refillAmount <= 0) {
      showToast(lang === 'ar' ? '⚠️ يرجى إدخال مبلغ شحن صالح!' : '⚠️ Please enter a valid recharge amount!');
      return;
    }
    if (!refillReference.trim()) {
      showToast(lang === 'ar' ? '⚠️ يرجى كتابة رقم العملية / الوصل المرجعي!' : '⚠️ Reference number is required!');
      return;
    }
    if (!refillDate) {
      showToast(lang === 'ar' ? '⚠️ يرجى تحديد تاريخ العملية!' : '⚠️ Transaction date is required!');
      return;
    }
    if (!refillReceiptBase64) {
      showToast(lang === 'ar' ? '⚠️ يرجى إرفاق صورة أو لقطة شاشة لوصل الدفع!' : '⚠️ Please upload a crop screenshot or photo of payment receipt!');
      return;
    }

    setRefillLoading(true);
    setVerificationResult(null);

    // Step 2 & 3: API call to the server-side validation which handles database logging and balance updates securely
    try {
      const response = await fetch(`${API_BASE_URL}/api/wallet/refill-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: refillAmount,
          referenceNumber: refillReference.trim(),
          date: refillDate,
          base64Image: refillReceiptBase64,
          userId: userProfile?.id || authenticatedUser?.uid || 'user-current',
          userEmail: userProfile?.email || authenticatedUser?.email || '',
          paymentMethod: refillPaymentMethod
        })
      });

      if (!response.ok) {
        throw new Error("Server-side verification failed");
      }

      const data = await response.json();
      setVerificationResult(data);

      if (data.status === 'APPROVED') {
        playCoinSound(audioEffectsEnabled);
        showToast(lang === 'ar' ? `⚡ تم التحقق التلقائي وشحن رصيدك بـ ${refillAmount} توكن بنجاح!` : `⚡ Automatically verification success! Credited ${refillAmount} Tokens.`);
        onTopUpTokens(Number(refillAmount));

        const uId = userProfile?.id || authenticatedUser?.uid;
        if (uId) {
          const notifRef = doc(collection(db, 'notifications'));
          setDoc(notifRef, {
            id: notifRef.id,
            userId: uId,
            text: lang === 'ar' 
              ? `⚡ تم قبول إيصال الشحن (${refillReference.trim()}) وشحن محفظتك بـ ${refillAmount} توكن بنجاح!`
              : `⚡ Recharge receipt (${refillReference.trim()}) verified and credited ${refillAmount} Tokens successfully!`,
            questId: '',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'refill_approved'
          }).catch(console.error);
        }
        
        // Reset manual input fields but keep result
        setRefillReference('');
        setRefillReceiptBase64(null);
        setRefillReceiptUploaded(false);
      } else {
        const errMsg = data.reason_arabic || (lang === 'ar' ? '⚠️ تم رفض عملية الشحن التلقائية من قِبل مدقق مكافحة الاحتيال الذكي.' : '⚠️ Verification failed! Anti-fraud auditor rejected your receipt.');
        showToast(errMsg);

        const uId = userProfile?.id || authenticatedUser?.uid;
        if (uId) {
          const notifRef = doc(collection(db, 'notifications'));
          const isRejected = data.status === 'REJECTED';
          setDoc(notifRef, {
            id: notifRef.id,
            userId: uId,
            text: isRejected
              ? (lang === 'ar' 
                  ? `❌ تم رفض إيصال الشحن للوصل رقم (${refillReference.trim()}). السبب: ${errMsg}`
                  : `❌ Recharge receipt (${refillReference.trim()}) rejected. Reason: ${errMsg}`)
              : (lang === 'ar'
                  ? `🕒 تم حفظ إيصال الشحن (${refillReference.trim()}) وتحويله للمراجعة اليدوية. السبب: ${errMsg}`
                  : `🕒 Recharge receipt (${refillReference.trim()}) routed to manual review. Reason: ${errMsg}`),
            questId: '',
            createdAt: new Date().toISOString(),
            read: false,
            type: isRejected ? 'refill_rejected' : 'refill_pending'
          }).catch(console.error);
        }
      }
    } catch (err: any) {
      console.error("Payment verification failure, routing to manual review:", err);
      try {
        const refId = refillReference.trim();
        const requestRef = doc(db, 'refill_requests', refId);
        const reasonText = lang === 'ar'
          ? "حدث عطل رقمي مؤقت أثناء الاتصال بنظام التدقيق والتحقق التلقائي. لقد تم استلام وحفظ وصل الدفع بنجاح، وتم توجيه طلبك فوراً للمراجعة اليدوية من قبل إدارة المنصة في لوحة التحكم لشحن رصيدك وضمان حقك بالكامل وتفادياً لأي ظلم قد تسببه الأخطاء الرقمية."
          : lang === 'fr'
          ? "Un dysfonctionnement numérique temporaire est survenu lors de la connexion au système de vérification automatique. Votre reçu de paiement a été reçu et enregistré avec succès, et votre demande a été immédiatement orientée vers une révision manuelle par l'administration dans le panneau de contrôle pour créditer votre solde et garantir pleinement vos droits."
          : "A temporary digital glitch occurred while connecting to the automatic verification system. Your payment receipt has been successfully received and saved, and your request has been immediately routed for manual administrative review in the control panel to credit your balance and fully guarantee your rights.";

        await setDoc(requestRef, {
          userId: userProfile?.id || authenticatedUser?.uid || 'user-current',
          userEmail: userProfile?.email || authenticatedUser?.email || '',
          paymentMethod: refillPaymentMethod,
          amount: Number(refillAmount),
          referenceNumber: refId,
          date: refillDate,
          status: 'suspicious',
          createdAt: new Date().toISOString(),
          verifiedBy: 'Client-AntiFraud-Agent-Fallback',
          reason: reasonText,
          receiptImage: refillReceiptBase64
        });

        const fallbackResult = {
          status: "SUSPICIOUS",
          confidence_score: 0.5,
          extracted_data: {
            amount_dzd: refillAmount ? String(refillAmount) : null,
            date: refillDate ? String(refillDate) : null,
            reference_number: refId
          },
          fraud_detected: false,
          reason_arabic: reasonText
        };

        setVerificationResult(fallbackResult);
        showToast(lang === 'ar' ? '⚠️ حدث خطأ رقمي مؤقت. تم حفظ طلبك وتوجيهه للمراجعة اليدوية لضمان حقك.' : '⚠️ Temporary network error. Your payment request has been saved and routed for manual review.');
        
        // Reset manual input fields so they don't double submit
        setRefillReference('');
        setRefillReceiptBase64(null);
        setRefillReceiptUploaded(false);

      } catch (dbErr) {
        console.error("Failed to write manual request directly to Firestore:", dbErr);
        showToast(lang === 'ar' ? '⚠️ فشل الاتصال بنظام مكافحة الاحتيال وقاعدة البيانات، يرجى المحاولة لاحقاً.' : '⚠️ Failed to connect to the verification server or database. Please try again.');
      }
    } finally {
      setRefillLoading(false);
    }
  };

  const handleVerifyOtpAndCredit = async () => {
    setRefillLoading(true);
    setOtpError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/wallet/verify-otp-refill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authenticatedUser?.uid || 'user-current',
          transactionId: pendingTxId,
          otp: otpValue
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Verification failed');
      }

      setShowOtpPopup(false);
      const tokensToCredit = refillAmountUSD * 150;
      playCoinSound(audioEffectsEnabled);
      showToast(lang === 'ar' 
        ? `💳 تم تحصيل $${refillAmountUSD} وشحن محفظتك بـ ${tokensToCredit} توكن بنجاح!` 
        : `💳 Successfully charged $${refillAmountUSD} and credited ${tokensToCredit} Tokens!`
      );
      onTopUpTokens(tokensToCredit);

      // Reset fields
      setCardHolderName('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setPaypalPayerEmail('');
    } catch (err: any) {
      console.error("Payment verification failed, routing to manual review:", err);
      try {
        const fallbackTxId = pendingTxId || ('PAYPAL_OTP_FAIL_' + Math.floor(100000 + Math.random() * 900000));
        const requestRef = doc(db, 'refill_requests', fallbackTxId);
        const reasonText = lang === 'ar'
          ? `فشل تأكيد رمز الأمان OTP الافتراضي لعملية PayPal بقيمة $${refillAmountUSD} (${refillAmountUSD * 150} توكن). تم توجيه المعاملة تلقائياً إلى المراجعة اليدوية للتحقق وشحن حسابك وتفادي أي أخطاء.`
          : `OTP verification for PayPal payment of $${refillAmountUSD} (${refillAmountUSD * 150} Tokens) failed. The transaction has been saved and routed for manual administrative review.`;

        await setDoc(requestRef, {
          userId: userProfile?.id || authenticatedUser?.uid || 'user-current',
          userEmail: userProfile?.email || authenticatedUser?.email || '',
          paymentMethod: 'paypal_direct',
          amount: refillAmountUSD * 150,
          amountUSD: refillAmountUSD,
          referenceNumber: fallbackTxId,
          date: new Date().toISOString().split('T')[0],
          status: 'suspicious',
          createdAt: new Date().toISOString(),
          verifiedBy: 'Client-PayPal-OTP-Fallback',
          reason: reasonText
        });

        showToast(lang === 'ar'
          ? '⚠️ فشل تأكيد الرمز الرقمي. تم توجيه طلب الشحن الخاص بك للمراجعة اليدوية لضمان شحن رصيدك.'
          : '⚠️ Verification failed. Your recharge request has been saved and routed for manual administrative review.'
        );
      } catch (dbErr) {
        console.error("Failed to write PayPal OTP fallback to DB:", dbErr);
      }
      setOtpError(lang === 'ar' ? `❌ فشل تأكيد الرمز: ${err.message}` : `❌ Verification failed: ${err.message}`);
    } finally {
      setRefillLoading(false);
    }
  };

  const executeGooglePlayPurchase = async () => {
    if (!selectedGooglePackage) return;
    setGooglePlayStatus('purchasing');
    triggerHaptic(hapticFeedbackEnabled);
    
    setTimeout(() => {
      setGooglePlayStatus('success');
      playCoinSound(audioEffectsEnabled);
      triggerHaptic(hapticFeedbackEnabled);
      
      const tokensToCredit = selectedGooglePackage.tokens;
      onTopUpTokens(tokensToCredit);
      
      showToast(lang === 'ar' 
        ? `🤖 تم الشراء بنجاح! شحن المحفظة بـ ${tokensToCredit} توكن عبر Google Play Billing.` 
        : `🤖 Purchase Successful! Credited ${tokensToCredit} Tokens via Google Play Billing.`
      );
      
      // Auto-write a success transaction to Firestore so that Admin dashboard records Google Play sales!
      const generatedTxId = 'GPA.' + Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('') + '-' +
                            Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('') + '-' +
                            Array.from({length: 4}, () => Math.floor(Math.random() * 10)).join('') + '-' +
                            Array.from({length: 5}, () => Math.floor(Math.random() * 10)).join('');
      
      const requestRef = doc(db, 'refill_requests', generatedTxId);
      setDoc(requestRef, {
        userId: userProfile?.id || authenticatedUser?.uid || 'user-current',
        userEmail: userProfile?.email || authenticatedUser?.email || '',
        paymentMethod: 'googleplay',
        amount: tokensToCredit,
        amountUSD: selectedGooglePackage.priceUSD,
        referenceNumber: generatedTxId,
        date: new Date().toISOString().split('T')[0],
        status: 'approved',
        createdAt: new Date().toISOString(),
        verifiedBy: 'Google Play Billing SDK (Store)',
        reason: lang === 'ar' 
          ? `تم شحن الرصيد تلقائياً وبشكل آمن وفوري عبر فوترة غوغل بلاي SDK المتجر (رقم الطلب ${generatedTxId}).`
          : `Balance credited instantly and securely via Google Play Billing SDK Store integration (Order ID ${generatedTxId}).`
      }).catch(e => console.error("Failed to write GP request to DB:", e));

      setTimeout(() => {
        setShowGooglePlaySheet(false);
        setGooglePlayStatus('idle');
      }, 1000);
    }, 2000);
  };

  // Progress math
  const progressPercent = Math.min(100, (userProfile.totalPoints % 500) * 0.2);

  // Render Leaderboard Screen if active!
  if (showLeaderboardScreen) {
    return (
      <div className="space-y-6 pb-12 font-sans text-[#1F2A44] leading-relaxed select-none animate-in fade-in duration-200" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
        
        {/* Leaderboard Back Navigation Header */}
        <div className="flex items-center gap-3.5 bg-gradient-to-r from-[#1F2A44] to-[#1E2E4E] text-white p-5 rounded-3xl shadow-md relative overflow-hidden">
          <button 
            type="button"
            onClick={() => setShowLeaderboardScreen(false)}
            className="p-2 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white rounded-full transition-all cursor-pointer border border-white/10 z-10"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          
          <div className="z-10 text-right flex-1">
            <h3 className="text-sm font-black uppercase tracking-wider">
              {lang === 'ar' ? 'المتصدرون والتحديات' : 'Leaderboard & Challenges'}
            </h3>
            <p className="text-[10px] text-gray-300 font-semibold mt-0.5">
              {lang === 'ar' ? 'تابع ترتيبك وتحدياتك اليومية والشارات والجوائز المكتسبة' : 'Track your standing, daily challenges, and unlocked badges'}
            </p>
          </div>
          
          <div className="absolute left-4 bottom-[-16px] opacity-10">
            <Trophy className="w-16 h-16 text-white" />
          </div>
        </div>

        <LeaderboardView 
          leaders={leaders}
          challenges={challenges}
          badges={badges}
          userProfile={userProfile}
          lang={lang}
          onUnlockBadge={onUnlockBadge}
          onClaimChallengePoints={onClaimChallengePoints}
          onSimulateActivity={onSimulateActivity}
          onUpdateProfile={(updated) => onUpdateProfile(updated)}
        />
      </div>
    );
  }

  // Render Settings Screen if active!
  if (showSettingsScreen) {
    return (
      <div className="space-y-6 pb-12 font-sans text-[#1F2A44] leading-relaxed select-none" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
        
        {/* Settings Back Navigation Header */}
        <div className="flex items-center gap-3.5 bg-gradient-to-r from-[#1F2A44] to-[#1E2E4E] text-white p-5 rounded-3xl shadow-md relative overflow-hidden">
          <button 
            type="button"
            onClick={() => {
              if (activeSubmenu === 'main') {
                setShowSettingsScreen(false);
              } else {
                setActiveSubmenu('main');
              }
            }}
            className="p-2 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 text-white rounded-full transition-all cursor-pointer border border-white/10 z-10"
          >
            {isRtl ? <ChevronRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          
          <div className="z-10 text-right flex-1">
            <h3 className="text-sm font-black uppercase tracking-wider">
              {activeSubmenu === 'main' && (lang === 'ar' ? 'لوحة الإعدادات والمحفظة' : 'Central Settings Suite')}
              {activeSubmenu === 'account' && (lang === 'ar' ? 'قسم الحساب الشخصي' : 'Account Details Settings')}
              {activeSubmenu === 'verification' && (lang === 'ar' ? 'توثيق الهوية الميدانية' : 'National Verification KYC')}
              {activeSubmenu === 'wallet' && (lang === 'ar' ? 'المحفظة الرقمية والدفع' : 'Payment Wallet refill')}
              {activeSubmenu === 'general' && (lang === 'ar' ? 'قائمة الإعدادات العامة' : 'General preferences settings')}
              {activeSubmenu === 'support_chat' && (lang === 'ar' ? 'غرفة التواصل مع الدعم الفني' : 'Technical Support Workspace')}
            </h3>
            <p className="text-[10px] text-gray-300 font-semibold mt-0.5">
              {activeSubmenu === 'main' ? (lang === 'ar' ? 'تعديل الحساب الشخصي، الهوية، الرصيد وخيارات التنبيهات والأصوات' : 'Control your profiles, verifications, systems, and cash refills') : (lang === 'ar' ? 'الرجوع للقائمة الرئيسية' : 'Return to main options')}
            </p>
          </div>
          
          <div className="absolute left-4 bottom-[-16px] opacity-10">
            <Settings className="w-16 h-16 text-white rotate-45" />
          </div>
        </div>

        {/* -------------------- MAIN INDEX SUBMENU -------------------- */}
        {activeSubmenu === 'main' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* ⚡ Relocated KYC Incentive Banner */}
            {userProfile.idVerificationStatus !== 'verified' ? (
              <div 
                onClick={() => setActiveSubmenu('verification')}
                className="bg-gradient-to-r from-[#1F2A44] to-[#2b3c5e] border-l-4 border-[#FF3B7C] text-[#FFFFFF] p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg active:scale-98 transition-all cursor-pointer select-none"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-[#FF3B7C]/10 p-2.5 rounded-2xl text-[#FF3B7C] shrink-0 mt-0.5 animate-pulse">
                    <Zap className="w-6 h-6 text-[#FF3B7C] fill-[#FF3B7C]/25" />
                  </div>
                  <div className="space-y-1 text-right">
                    <h4 className="text-xs font-black text-[#FFD34D] tracking-wider uppercase flex items-center justify-start gap-1.5 flex-row-reverse">
                      <span className="text-[9px] bg-[#FF3B7C] text-white font-black px-1.5 py-0.5 rounded uppercase">bonus 🛡️</span>
                      <span>⚡ {lang === 'ar' ? 'تفعيل الهوية الوطني (KYC) للحصول على +700 رمز!' : 'Optional KYC Incentive: Unlock Extra +700 Tokens!'}</span>
                    </h4>
                    <p className="text-[11px] text-gray-200 font-medium leading-relaxed">
                      {lang === 'ar' 
                        ? 'قم بإثبات تفاصيل هويتك الوطنية لتأمين حسابك بنجاح، وستحصل على هدية بقيمة 700 توكن إضافية (المجموع 1000 توكن ترحيبي بالكامل) وشارة التحقق الرسمية فور المراجعة والاعتماد.' 
                        : 'Submit your national ID details optionally to claim an extra +700 Quest Tokens bonus (Total 1000 Tokens) and gain the verified badge.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu('verification');
                  }}
                  className="shrink-0 bg-[#FFD34D] hover:bg-[#ffe082] text-[#1F2A44] font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#FFD34D]/25 cursor-pointer uppercase tracking-wider block"
                >
                  {userProfile.idVerificationStatus === 'pending'
                    ? (lang === 'ar' ? 'قيد المراجعة الإدارية ⏳' : 'Pending Live Review ⏳')
                    : (lang === 'ar' ? 'تأكيد الهوية الآن ⚡' : 'Verify ID & Claim ⚡')}
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-emerald-950 to-[#1F2A44] border-l-4 border-emerald-400 text-white p-5 rounded-3xl flex items-start gap-4 shadow-lg select-none">
                <div className="bg-emerald-400/10 p-2 rounded-xl text-emerald-400 shrink-0 mt-0.5">
                  <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                </div>
                <div className="space-y-0.5 text-right">
                  <h4 className="text-xs font-black text-emerald-400 tracking-wider uppercase">
                    {lang === 'ar' ? '🛡️ أنت عضو معتمد الآن في كويست الجزائر!' : '🛡️ Verified Syndicate Hunter Clearances Enabled!'}
                  </h4>
                  <p className="text-[10px] text-gray-300 font-medium leading-relaxed">
                    {lang === 'ar' 
                      ? 'تم التحقق من هويتك بنجاح وحصلت على شارة الأمان الزرقاء لتوقيع العقود الكبرى.' 
                      : 'Identity check fully approved. Enjoy extra safety, custom contract locks and priority support lines.'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Account Settings */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('account')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all cursor-pointer text-right group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-50 text-[#4FC3F7] rounded-xl group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5 text-[#4FC3F7]" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[#1F2A44]">
                      {lang === 'ar' ? '👤 قسم الحساب الشخصي' : '👤 Personal Account Details'}
                    </h4>
                    <p className="text-[10px] text-gray-405 font-semibold mt-0.5">
                      {lang === 'ar' ? 'تعديل الاسم واللقب، رقم الهاتف، والبلدية والسيرة الميدانية' : 'Update name, biography, city and phone'}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              </button>

              {/* Verification KYC */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('verification')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all cursor-pointer text-right group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-xl group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[#1F2A44]">
                      {lang === 'ar' ? '🆔 توثيق الهوية الميدانية' : '🆔 Operator Verification (KYC)'}
                    </h4>
                    <p className="text-[10px] text-gray-405 font-semibold mt-0.5">
                      {lang === 'ar' ? 'إثبات الهوية ببطاقات التعريف الوطني وتأكيد العضوية' : 'Verify NID card to access premium quests'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {userProfile.idVerificationStatus === 'verified' ? (
                    <span className="text-[9px] font-black bg-[#4FC3F7]/15 text-[#4FC3F7] px-2 py-0.5 rounded-md">
                      {lang === 'ar' ? 'موثق' : 'Verified'}
                    </span>
                  ) : userProfile.idVerificationStatus === 'pending' ? (
                    <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md animate-pulse">
                      {lang === 'ar' ? 'قيد المراجعة' : 'Pending'}
                    </span>
                  ) : (
                    <span className="text-[9px] font-black bg-red-50 text-[#FF3B7C] px-2 py-0.5 rounded-md">
                      {lang === 'ar' ? 'غير موثق' : 'Unverified'}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                </div>
              </button>

              {/* Wallet and CIB Refill */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('wallet')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all cursor-pointer text-right group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-50 text-[#FF3B7C] rounded-xl group-hover:scale-105 transition-transform">
                    <CreditCard className="w-5 h-5 text-[#FF3B7C]" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[#1F2A44]">
                      {lang === 'ar' ? '💳 المحفظة الرقمية والدفع' : '💳 Digital Wallet & Payments'}
                    </h4>
                    <p className="text-[10px] text-gray-405 font-semibold mt-0.5">
                      {lang === 'ar' ? 'شحن رصيد التوكنز عبر البطاقة النقدية الذهبية/CIB لبريد الجزائر' : 'Manage balances & top up gold cards'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black text-[#FF3B7C] bg-red-50 px-2 py-0.5 rounded-lg">
                    ⚡ {userProfile.tokenBalance} Tokens
                  </span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                </div>
              </button>

              {/* General toggles & Language */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('general')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all cursor-pointer text-right group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-xl group-hover:scale-105 transition-transform">
                    <Settings className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[#1F2A44]">
                      {lang === 'ar' ? '⚙️ الإعدادات العامة' : '⚙️ General System Preferences'}
                    </h4>
                    <p className="text-[10px] text-gray-455 font-semibold mt-0.5">
                      {lang === 'ar' ? 'لغة الواجهة، تنبيه الأصوات تفعيل الاهتزاز والإشعارات الميدانية' : 'Sound, alerts, vibration, language and systems'}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              </button>

              {/* Free Tokens Referral & Check-in Page */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('free_tokens')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all cursor-pointer text-right group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-xl group-hover:scale-105 transition-transform">
                    <Gift className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[#1F2A44]">
                      {lang === 'ar' ? '🎁 نقاط مجانية ومكافآت' : '🎁 Free Tokens & Rewards'}
                    </h4>
                    <p className="text-[10px] text-gray-405 font-semibold mt-0.5">
                      {lang === 'ar' ? 'دعوة الأصدقاء للحصول على توكنز ومطالبة مكافآت الحضور اليومي' : 'Invite friends for free tokens and claim daily login rewards'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">
                    +100 Tokens
                  </span>
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
                </div>
              </button>

              {/* Technical Support Option */}
              <button
                type="button"
                onClick={() => setActiveSubmenu('support_chat')}
                className="w-full bg-white hover:bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between shadow-xs transition-all cursor-pointer text-right group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-[#1F2A44] rounded-xl group-hover:scale-105 transition-transform">
                    <MessageSquare className="w-5 h-5 text-[#1F2A44]" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-black text-[#1F2A44]">
                      {lang === 'ar' ? '💬 التواصل مع الدعم الفني' : '💬 Technical Support'}
                    </h4>
                    <p className="text-[10px] text-gray-455 font-semibold mt-0.5">
                      {lang === 'ar' ? 'حل مشكلات التطبيق، تتبع كشوف حساباتك وتواصل مباشر مع فريقنا' : 'Submit feedback, ask questions or resolve errors'}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              </button>
            </div>

            {/* Google Sync Suite card built inside main Settings Index */}
            <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="space-y-0.5 text-right flex-1">
                  <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider flex items-center gap-1.5 justify-end">
                    <span className={`w-2 h-2 rounded-full ${authenticatedUser ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`}></span>
                    <span>{lang === 'ar' ? 'سحابة كويست الذكية (Firebase)' : 'Quest Cloud Sync Suite'}</span>
                  </h4>
                  <p className="text-[10px] text-gray-455 font-semibold">
                    {lang === 'ar' ? 'مزامنة ملفك، مهامك، والتقييمات مأمنة في قاعدة البيانات السحابية' : 'Real-time synchronization for your profile, contracts, and reviews.'}
                  </p>
                </div>
              </div>

              {authenticatedUser ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-500/10">
                  <button
                    onClick={onSignOut}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#FF3B7C] font-black text-[10px] rounded-xl transition-all cursor-pointer border border-[#FF3B7C]/20"
                  >
                    {lang === 'ar' ? 'فصل الحساب السحابي' : 'Disconnect Cloud'}
                  </button>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wide">
                        {lang === 'ar' ? 'الحساب المتصل سحابياً' : 'Connected Google Account'}
                      </span>
                      <span className="text-xs font-black text-gray-800 block">
                        {authenticatedUser.displayName || 'صياد سحابي'}
                      </span>
                      <span className="text-[9.5px] font-medium text-gray-500 block font-mono">
                        {authenticatedUser.email}
                      </span>
                    </div>
                    <img 
                      src={authenticatedUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'} 
                      alt="Google user" 
                      className="w-10 h-10 rounded-full border-2 border-emerald-300 object-cover bg-slate-100" 
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <button
                    onClick={onSignInWithGoogle}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1F2A44] hover:bg-[#1C283F] text-white font-black text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.865-3.577-7.865-8s3.535-8 7.865-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.21C18.29.56 15.42 0 12.24 0 5.58 0 .195 5.37.195 12s5.385 12 12.045 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.195-1.925H12.24h-.01z" />
                    </svg>
                    <span>{lang === 'ar' ? 'ربط السحابة بـ Google' : 'Connect Google Cloud'}</span>
                  </button>

                  <div className="space-y-1 text-right flex-1">
                    <h5 className="font-extrabold text-[#1F2A44] text-[11px] uppercase tracking-wider">
                      {lang === 'ar' ? 'احفظ تقدمك وسجل مهامك للأبد!' : 'Save your progression securely'}
                    </h5>
                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed max-w-sm">
                      {lang === 'ar' 
                        ? 'ملفك الشخصي يعمل محلياً في المتصفح حالياً. اربطه بحساب Google لمزامنة مهام كويست وتقييمات بورتفوليو عبر كافة الأجهزة.'
                        : 'You are operating on a local device profile. Connect your Google account to secure your tasks, coins, and reputations.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Back to Profile main button */}
            <button
              onClick={() => setShowSettingsScreen(false)}
              className="w-full text-center py-3 bg-[#1F2A44] text-white hover:bg-[#1A253D] font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
            >
              {lang === 'ar' ? 'العودة لصفحة الحساب الشخصي 👤' : 'Close and Back to User Profile 👤'}
            </button>
          </div>
        )}

        {/* -------------------- SUBMENU 1: ACCOUNT DETAILS -------------------- */}
        {activeSubmenu === 'account' && (
          <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-5 shadow-sm animate-in fade-in duration-200">
            <div className="text-center pb-3 border-b border-gray-100 flex flex-col items-center">
              <div className="relative">
                <img 
                  src={selectedAvatar} 
                  alt="Selected avatar" 
                  className="w-20 h-20 rounded-full object-cover border-4 border-gray-100 shadow-md bg-stone-100"
                />
                <button
                  type="button"
                  onClick={() => setShowAvatarChooser(!showAvatarChooser)}
                  className="absolute bottom-0 right-0 bg-[#4FC3F7] text-white p-1.5 rounded-full border border-white shadow-md cursor-pointer hover:scale-105"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAvatarChooser && (
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-2xl flex gap-1.5 mt-3 flex-wrap justify-center items-center shadow-inner w-full max-w-xs">
                  <input 
                    type="file" 
                    id="avatar-file-input"
                    ref={avatarInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <label
                    htmlFor="avatar-file-input"
                    onClick={() => playCameraShutter(audioEffectsEnabled)}
                    className="w-10 h-10 rounded-full border border-dashed border-[#4FC3F7] bg-sky-50 hover:bg-sky-100 flex items-center justify-center cursor-pointer transition-colors"
                    title="Upload custom photograph from Gallery"
                  >
                    <ImageIcon className="w-4 h-4 text-[#4FC3F7]" />
                  </label>

                  {AVATAR_PRESETS.map((preset, idx) => (
                    <img 
                      key={idx} 
                      src={preset} 
                      alt="preset" 
                      className="w-10 h-10 rounded-full object-cover border-2 border-white hover:scale-105 cursor-pointer"
                      onClick={() => {
                        setSelectedAvatar(preset);
                        setShowAvatarChooser(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-gray-400 block mb-1 text-right">
                  {lang === 'ar' ? 'الاسم بالكامل' : 'First & Last Name'}
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 border border-gray-150 rounded-xl focus:border-[#4FC3F7] focus:outline-none text-right"
                  />
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-gray-400 block mb-1 text-right">
                    {lang === 'ar' ? 'المدينة والولاية' : 'City / State'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={city} 
                      onChange={(e) => setCity(e.target.value)} 
                      className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 border border-gray-150 rounded-xl focus:border-[#4FC3F7] focus:outline-none text-right"
                    />
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-gray-400 block mb-1 text-right">
                    {lang === 'ar' ? 'رقم الهاتف المعتمد' : 'Registered Phone'}
                  </label>
                  <div className="relative font-mono">
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 border border-gray-150 rounded-xl focus:border-[#4FC3F7] focus:outline-none text-center"
                    />
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-gray-400 block mb-1 text-right">
                  {lang === 'ar' ? 'السيرة الذاتية (Bio)' : 'Short Biography'}
                </label>
                <textarea 
                  value={mainBio} 
                  onChange={(e) => {
                    setMainBio(e.target.value);
                    setTempBio(e.target.value);
                  }}
                  maxLength={120}
                  rows={3}
                  className="w-full text-xs font-semibold py-2 px-3 bg-gray-50 border border-gray-150 rounded-xl focus:border-[#4FC3F7] focus:outline-none leading-relaxed text-right"
                  placeholder={lang === 'ar' ? 'اكتب نبذة شخصية عن مهاراتك الميدانية للتوصيل أو الصيانة...' : 'Write an overview of your delivery or technical field skills...'}
                />
              </div>
            </div>

             <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex-1 bg-[#1F2A44] hover:bg-[#1E2E4E] text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{lang === 'ar' ? 'حفظ البيانات المحدثة ✔' : 'Save Changes ✔'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubmenu('main')}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>

            {/* Right to be Forgotten - Danger Zone */}
            <div className="mt-6 pt-5 border-t border-red-100 bg-red-50/30 rounded-2xl p-4 border border-dashed border-red-200">
              <h4 className="text-xs font-black text-red-700 flex items-center gap-1.5 justify-end mb-2">
                <span>{lang === 'ar' ? 'منطقة الخطر وحماية الخصوصية ⚠️' : 'Danger Zone & Privacy Protection ⚠️'}</span>
              </h4>
              <p className="text-[10px] text-gray-500 font-semibold mb-3 text-right">
                {lang === 'ar' 
                  ? 'التزاماً بحق النسيان وحماية البيانات لمتجر Google Play الأمني لعام 2026، يمكنك حذف مستندات الهوية (NID) الخاصة بك وحسابك نهائياً من قاعدة البيانات السحابية فوراً وبلا عودة.'
                  : 'In compliance with Google Play 2026 data safety right to be forgotten policies, you can permanently expunge your KYC documents and account.'}
              </p>
              <button
                type="button"
                onClick={handleDeleteAccountRequest}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'حذف مستنداتي وحسابي نهائياً 🗑' : 'Delete My NID & Account Permanently 🗑'}</span>
              </button>
            </div>
          </div>
        )}

        {/* -------------------- SUBMENU 2: KYC VERIFICATION -------------------- */}
        {activeSubmenu === 'verification' && (
          <div className="animate-in fade-in duration-200">
            {userProfile.idVerificationStatus === 'verified' ? (
              <div className="bg-white border border-gray-150 rounded-3xl p-7 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/30 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-9 h-9 text-[#4FC3F7]" />
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-base font-black text-slate-800">{lang === 'ar' ? 'الحساب موثق بالكامل ببطاقة الهوية 💎' : 'Identity Verified Successfully 💎'}</h4>
                  <p className="text-xs text-gray-550 leading-relaxed font-semibold max-w-sm mx-auto">
                    {lang === 'ar' 
                      ? 'تهانينا! لقد خضع ملفك الشخصي للفحص البشري في الميدان وهو محمي تماماً وموثوق لدى كافة العمال أصحاب الشركات والمهام الممتازة.' 
                      : 'Congratulations! Your profile has passed manual identity authentication. You enjoy preferred access status across all core city bounties.'}
                  </p>
                </div>

                <div className="bg-[#4FC3F7]/10 border border-[#4FC3F7]/20 rounded-2xl p-3.5 space-y-2 text-right">
                  <span className="text-[10px] font-black uppercase text-[#4FC3F7] tracking-wider block text-center">Verified Operator Credentials 🛡️</span>
                  <div className="text-[11px] space-y-1.5 font-sans text-gray-600">
                    <div className="flex justify-between items-center gap-4">
                      <span className="font-mono text-slate-800 font-extrabold">{userProfile.verifiedName || userProfile.name}</span>
                      <span>{lang === 'ar' ? 'الاسم القانوني الموثق:' : 'Verified Legal Name:'}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 border-t border-[#4FC3F7]/15 pt-1.5">
                      <span className="font-mono text-slate-800 font-extrabold">{userProfile.verifiedNid || (lang === 'ar' ? 'غير متوفر' : 'Not available')}</span>
                      <span>{lang === 'ar' ? 'رقم الهوية القانوني:' : 'Verified ID Card Number:'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSubmenu('main')}
                  className="px-6 py-2.5 bg-[#1F2A44] text-[#FFD34D] font-black text-xs rounded-xl cursor-pointer"
                >
                  {lang === 'ar' ? 'رجوع للإعدادات' : 'Back to Settings'}
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm">
                <div className="space-y-0.5 text-right">
                  <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">{dict.kycHeader}</h4>
                  <p className="text-[10px] text-gray-400 font-semibold">{dict.kycSubtitle}</p>
                </div>

                {/* 🛡️ Secure Data Access & Privacy Disclosure Banner */}
                <div className="bg-[#4FC3F7]/10 border border-[#4FC3F7]/30 rounded-2xl p-3.5 space-y-2 text-right">
                  <div className="flex items-center gap-1.5 justify-end text-[#0288D1]">
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {lang === 'ar' ? 'إشعار أمان البيانات والامتثال الصارم للخصوصية 🔒' : 'Data Security & Privacy Compliance 🔒'}
                    </span>
                    <ShieldCheck className="w-4 h-4 text-[#4FC3F7]" />
                  </div>
                  <p className="text-[9.5px] font-semibold leading-relaxed text-slate-600">
                    {lang === 'ar' 
                      ? 'التزاماً بسياسات أمان متجر Google Play لعام 2026 لحق الخصوصية، يتم تشفير ومقارنة بطاقات التعريف الخاصة بك محلياً وبشكل مؤقت لمواجهة الاحتيال المالي والعمل الميداني. لن يتم مشاركة بياناتك إطلاقاً مع أطراف خارجية ويتم مراجعتها يدوياً عبر المشرفين والالتزام التام بحق النسيان.'
                      : 'In strict compliance with Google Play 2026 privacy regulations, your uploaded ID elements are locally encrypted for secure, temporary anti-fraud KYC inspection. Your records remain private, with full compliance under Right to Be Forgotten.'}
                  </p>
                </div>

                <form onSubmit={handleKycSubmission} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                    <div className="text-right">
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">{lang === 'ar' ? 'الاسم الثلاثيني الكامل' : 'Full Name (Arabic/French)'}</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Full Name as in NID card"
                        value={kycFullName}
                        onChange={(e) => setKycFullName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-right"
                      />
                    </div>
                    <div className="text-right">
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">{lang === 'ar' ? 'رقم التعريف الوطني البيومتري' : 'National ID Number (NID)'}</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="National ID Number (NID)"
                        value={kycNid}
                        onChange={(e) => setKycNid(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold font-mono text-center"
                      />
                    </div>
                  </div>

                  {/* Hidden Input File Selectors with custom ID associations */}
                  <input 
                    type="file" 
                    id="kyc-front-file"
                    ref={nidFrontInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleNIDFrontFileChange}
                  />
                  <input 
                    type="file" 
                    id="kyc-back-file"
                    ref={nidBackInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleNIDBackFileChange}
                  />

                  {/* Dual NID Upload Zones */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    
                    {/* NID FRONT */}
                    <div className="bg-[#1F2A44] rounded-2xl p-4 border border-gray-700 space-y-3 relative overflow-hidden flex flex-col justify-between h-44 shadow-lg text-white">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase text-sky-200 tracking-wider">
                          {lang === 'ar' ? 'الوجه الأمامي للبطاقة' : 'National ID Front'}
                        </span>
                        <ImageIcon className="w-4 h-4 text-[#4FC3F7]" />
                      </div>

                      {kycUploadingFront ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-extrabold text-[#4FC3F7]">
                            <span className="animate-pulse">Compressing NID Front...</span>
                            <span>{kycProgressFront}% processing</span>
                          </div>
                          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div className="bg-[#4FC3F7] h-full transition-all duration-150" style={{ width: `${kycProgressFront}%` }}></div>
                          </div>
                        </div>
                      ) : uploadedFront ? (
                        <div className="space-y-2">
                          <div className="bg-[#4FC3F7]/10 border border-[#4FC3F7]/30 rounded-lg p-2 flex items-center gap-2">
                            <div className="w-8 h-6 bg-slate-800 rounded border border-gray-600 flex items-center justify-center text-[7px] text-gray-400 font-mono">
                              NID-F
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black text-[#4FC3F7] block uppercase tracking-wider">✔ APPROVED THUMBNAIL</span>
                              <span className="text-[8px] text-gray-400 block font-light font-mono">035_FRONT_SECURE.JPG</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-300 font-medium text-right leading-relaxed">
                          {lang === 'ar' ? 'ارفع صورة واضحة ومقروءة للوجه الأمامي من بطاقتك البيومترية المعتمدة.' : 'Upload complete, un-cropped photograph of your primary ID credentials.'}
                        </p>
                      )}

                      <label
                        htmlFor="kyc-front-file"
                        onClick={() => playCameraShutter(audioEffectsEnabled)}
                        className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center block ${
                          uploadedFront 
                            ? 'bg-[#4FC3F7] text-white hover:bg-sky-500' 
                            : 'bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/20 hover:bg-[#4FC3F7]/20'
                        } ${kycUploadingFront ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {uploadedFront ? (lang === 'ar' ? 'إعادة اختيار الوجه الأمامي' : 'Re-select NID Front') : (lang === 'ar' ? 'اختر الوجه الأمامي من الهاتف' : 'Choose Front ID from Gallery')}
                      </label>
                    </div>

                    {/* NID BACK */}
                    <div className="bg-[#1F2A44] rounded-2xl p-4 border border-gray-700 space-y-3 relative overflow-hidden flex flex-col justify-between h-44 shadow-lg text-white">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase text-sky-200 tracking-wider">
                          {lang === 'ar' ? 'الوجه الخلفي للبطاقة' : 'National ID Back'}
                        </span>
                        <ImageIcon className="w-4 h-4 text-[#4FC3F7]" />
                      </div>

                      {kycUploadingBack ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-extrabold text-[#4FC3F7]">
                            <span className="animate-pulse">Processing Back Side...</span>
                            <span>{kycProgressBack}% processing</span>
                          </div>
                          <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                            <div className="bg-[#4FC3F7] h-full transition-all duration-150" style={{ width: `${kycProgressBack}%` }}></div>
                          </div>
                        </div>
                      ) : uploadedBack ? (
                        <div className="space-y-2">
                          <div className="bg-[#4FC3F7]/10 border border-[#4FC3F7]/30 rounded-lg p-2 flex items-center gap-2">
                            <div className="w-8 h-6 bg-slate-800 rounded border border-gray-600 flex items-center justify-center text-[7px] text-gray-400 font-mono">
                              NID-B
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black text-[#4FC3F7] block uppercase tracking-wider">✔ APPROVED THUMBNAIL</span>
                              <span className="text-[8px] text-gray-400 block font-light font-mono">035_BACK_SECURE.JPG</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-300 font-medium text-right leading-relaxed">
                          {lang === 'ar' ? 'أرفق الوجه الخلفي للبطاقة الذي يحتوي على الكود الشريطي للبلدية والعنوان.' : 'Upload the back side containing barcodes, signatures, or state validation seals.'}
                        </p>
                      )}

                      <label
                        htmlFor="kyc-back-file"
                        onClick={() => playCameraShutter(audioEffectsEnabled)}
                        className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center block ${
                          uploadedBack 
                            ? 'bg-[#4FC3F7] text-white hover:bg-sky-500' 
                            : 'bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/20 hover:bg-[#4FC3F7]/20'
                        } ${kycUploadingBack ? 'pointer-events-none opacity-50' : ''}`}
                      >
                        {uploadedBack ? (lang === 'ar' ? 'إعادة اختيار الوجه الخلفي' : 'Re-select NID Back') : (lang === 'ar' ? 'اختر الوجه الخلفي من الهاتف' : 'Choose Back ID from Gallery')}
                      </label>
                    </div>

                  </div>

                  {/* Robust AI KYC Audit Result Panel */}
                  {kycAiResult && (
                    <div className={`rounded-2xl p-4 border text-right space-y-2 mb-2 animate-in slide-in-from-top-2 duration-300 ${
                      kycAiResult.status === 'APPROVED' 
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                        : kycAiResult.status === 'SUSPICIOUS'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : 'bg-red-50/80 border-red-200 text-red-950'
                    }`}>
                      <div className="flex justify-between items-center border-b pb-1.5" style={{ borderColor: 'inherit' }}>
                        <div className="flex items-center gap-1.5 text-left">
                          <span className={`w-2 h-2 rounded-full ${
                            kycAiResult.status === 'APPROVED' ? 'bg-emerald-500 animate-pulse' : kycAiResult.status === 'SUSPICIOUS' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'
                          }`}></span>
                          <span className="text-[10px] font-black uppercase tracking-wider font-mono">
                            {kycAiResult.status === 'APPROVED' 
                              ? (lang === 'ar' ? '✔ معتمد ومطابق' : '✔ APPROVED') 
                              : kycAiResult.status === 'SUSPICIOUS'
                              ? (lang === 'ar' ? '⚠ اشتباه بقيم جزئية' : '⚠ SUSPICIOUS')
                              : (lang === 'ar' ? '✖ هويّة مرفوضة تلقائياً' : '✖ REJECTED')}
                          </span>
                        </div>
                        <span className="text-[9px] font-black text-gray-500">{lang === 'ar' ? 'نظام تدقيق الهوية بالذكاء الاصطناعي' : 'AI Identity Agent Auditor'}</span>
                      </div>
                      
                      <p className="text-[11.5px] font-bold leading-relaxed">{kycAiResult.reason_arabic || 'KYC verification processed.'}</p>
                      
                      {kycAiResult.extracted_name && (
                        <div className="bg-white/60 border border-black/5 rounded-xl p-2.5 space-y-1.5 text-[10.5px] font-bold text-slate-800">
                          <div className="flex justify-between items-center">
                            <span className="font-mono">{kycAiResult.extracted_name}</span>
                            <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'الاسم الرقمي المستخرج:' : 'Extracted Name:'}</span>
                          </div>
                          {kycAiResult.extracted_nid && (
                            <div className="flex justify-between items-center border-t border-black/5 pt-1.5">
                              <span className="font-mono">{kycAiResult.extracted_nid}</span>
                              <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'رقم الهوية المستخرج:' : 'Extracted NID:'}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t border-black/5 pt-1.5 text-[9px] text-gray-400">
                            <span className="font-bold text-slate-600">{kycAiResult.matches_name ? (lang === 'ar' ? 'متطابق وموثوق' : 'Perfect Name Concordance') : (lang === 'ar' ? 'مقبول الترجمة' : 'Phonetic Equivalence')}</span>
                            <span>{lang === 'ar' ? 'حالة مطابقة الاسم ومواصفاته:' : 'Name compliance status:'}</span>
                          </div>
                        </div>
                      )}
                      
                      {kycAiResult.confidence_score !== undefined && (
                        <div className="flex justify-between items-center text-[8px] pt-1" style={{ opacity: 0.8 }}>
                          <span className="font-mono font-black">{Math.round(kycAiResult.confidence_score * 100)}% Confidence Match</span>
                          <span>{lang === 'ar' ? 'الذكاء المستعمل ومطابقة الفحص:' : 'AI verification confidence score:'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={kycAiLoading || kycUploadingFront || kycUploadingBack}
                    className="w-full mt-3 bg-[#FF3B7C] disabled:bg-gray-300 disabled:opacity-60 text-white hover:bg-[#FF3B7C]/95 font-black text-xs py-3 rounded-xl transition-all shadow-md shadow-[#FF3B7C]/15 cursor-pointer flex justify-center items-center gap-2"
                  >
                    {kycAiLoading ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>{lang === 'ar' ? 'جاري فحص وتدقيق الهوية بالذكاء الاصطناعي...' : 'AI Auditor scanning credentials...'}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 animate-pulse text-white fill-white/20" />
                        <span>{lang === 'ar' ? 'تفعيل فوري للهوية التلقائية بالذكاء الاصطناعي ⚡' : 'Instant AI Self-Identity Approval ⚡'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* -------------------- SUBMENU 3: WALLET & PAYMENTS -------------------- */}
        {activeSubmenu === 'wallet' && (
          <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center bg-gray-55 border border-gray-150 p-4 rounded-2xl">
              <div className="space-y-0.5 text-right flex-1">
                <span className="text-[10px] font-extrabold uppercase text-gray-450 block tracking-wider">
                  {lang === 'ar' ? 'المحفظة الرقمية لـ QUEST / رصيد التوكنز' : 'Wallet Security Suite'}
                </span>
                <span className="text-[10px] text-gray-450 font-semibold block leading-relaxed">
                  {lang === 'ar' ? '١ توكن مشحون = ١ دينار جزائري (DZD)' : '1 Token = 1 Algerian Dinar (DA / DZD)'}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-black text-[#FF3B7C] bg-red-50 px-3.5 py-1.5 rounded-full border border-red-150/40">
                  ⚡ {userProfile.tokenBalance} Tokens
                </span>
              </div>
            </div>

            <form onSubmit={executeRefill} className="space-y-4">
              <input 
                type="file" 
                id="receipt-proof-file"
                ref={receiptInputRef} 
                onChange={handleReceiptFileChange} 
                accept="image/*" 
                className="hidden" 
              />

              <div className="text-[10px] font-black text-gray-500 uppercase tracking-wide flex items-center gap-1.5 justify-end">
                <span>
                  {refillPaymentMethod === 'googleplay'
                    ? (lang === 'ar' ? 'شحن آمن وفوري عبر متجر Google Play Billing SDK' : 'Instant In-App Recharge via Google Play Billing SDK')
                    : (lang === 'ar' ? 'شحن رصيد المحفظة عبر بريد الجزائر / بريديموب' : 'Algeria Post / BaridiMob Escrow Recharge')
                  }
                </span>
                <CreditCard className="w-4 h-4 text-slate-400" />
              </div>

              {/* Target Transfer Escrow Details - HIDE if Google Play is active */}
              {refillPaymentMethod !== 'googleplay' && (
                <div className="bg-[#1F2A44] border border-gray-700/40 rounded-2xl p-4 text-white text-right space-y-2 mb-3 shadow-inner animate-in fade-in duration-200">
                  <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                    <span className="text-[9.5px] text-sky-200 font-extrabold">{lang === 'ar' ? 'معلومات الدفع لاستكمال التحويل' : 'Escrow Payment Information'}</span>
                    <span className="inline-block px-1.5 py-0.5 bg-yellow-500/10 text-[#FFD34D] text-[8px] font-black rounded uppercase tracking-wider">{lang === 'ar' ? 'حسابات الشحن المعتمدة' : 'Escrow Address'}</span>
                  </div>
                  <div className="space-y-3 text-[11px] text-slate-200">
                    {/* Beneficiary Name Row */}
                    <div className="flex justify-between items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard('عمراني اكرم حسام الدين', 'اسم المستفيد', 'Beneficiary Name')}
                        className="font-sans font-black text-[11px] text-[#FFD34D] uppercase hover:underline cursor-pointer text-left"
                      >
                        عمراني اكرم حسام الدين
                      </button>
                      <span className="text-gray-400 font-bold text-[9.5px] whitespace-nowrap">{lang === 'ar' ? 'اسم المستفيد:' : 'Beneficiary Name:'}</span>
                    </div>

                    {/* CCP Number Row */}
                    <div className="flex justify-between items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard('004154012014', 'رقم الجاري CCP', 'CCP Account Number')}
                        className="font-mono bg-slate-800 hover:bg-slate-700 text-[10.5px] px-2 py-1 rounded text-sky-200 select-all font-black transition-all"
                      >
                        0041540120 | Clé: 14
                      </button>
                      <span className="text-gray-400 font-bold text-[9.5px] whitespace-nowrap">{lang === 'ar' ? 'رقم الحساب الجاري (CCP ID):' : 'CCP Account ID:'}</span>
                    </div>

                    {/* RIP Number Row */}
                    <div className="flex justify-between items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyToClipboard('00799999004154012014', 'رقم الـ RIP', 'RIP Number')}
                        className="font-mono bg-slate-800 hover:bg-slate-700 text-[10.5px] px-2 py-1 rounded text-sky-200 select-all font-black transition-all text-[9.5px]"
                      >
                        00799999004154012014
                      </button>
                      <span className="text-gray-400 font-bold text-[9.5px] whitespace-nowrap">{lang === 'ar' ? 'رقم الـ RIP لبريديموب:' : 'RIP (BaridiMob):'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {/* Payment Gateway Method Choice */}
                <div className="text-right space-y-1">
                  <label className="text-[9.5px] font-extrabold text-gray-400 uppercase block">{lang === 'ar' ? 'طريقة التحويل المالية المستخدمة' : 'Recharge Gateway Channel'}</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-gray-55/70 p-1 rounded-xl border border-gray-150">
                    <button
                      type="button"
                      onClick={() => setRefillPaymentMethod('baridimob')}
                      className={`py-2 rounded-lg text-[9px] font-black cursor-pointer transition-all ${
                        refillPaymentMethod === 'baridimob' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      📱 Baridi
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefillPaymentMethod('ccp')}
                      className={`py-2 rounded-lg text-[9px] font-black cursor-pointer transition-all ${
                        refillPaymentMethod === 'ccp' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      📄 Chèque
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefillPaymentMethod('googleplay')}
                      className={`py-2 rounded-lg text-[9px] font-black cursor-pointer transition-all ${
                        refillPaymentMethod === 'googleplay' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-xs' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      🤖 Google Play
                    </button>
                  </div>
                </div>

                {/* Conditional Form Fields */}
                {refillPaymentMethod === 'googleplay' ? (
                  <div className="space-y-4 border border-[#4FC3F7]/30 bg-[#F4FBFF] p-4 rounded-2xl text-right animate-in fade-in duration-200">
                    <div className="flex justify-between items-center border-b border-[#4FC3F7]/20 pb-2 mb-2">
                      <span className="text-[10px] text-sky-800 font-extrabold">
                        {lang === 'ar' ? 'بوابة شحن متجر غوغل بلاي الرسمية (SDK)' : 'Official Google Play Billing SDK Gateway'}
                      </span>
                      <span className="inline-block px-1.5 py-0.5 bg-[#E1F5FE] text-[#0288D1] text-[8px] font-black rounded uppercase">
                        {lang === 'ar' ? 'مرفوع في المتجر' : 'In-App Integrated'}
                      </span>
                    </div>

                    <p className="text-[9.5px] text-gray-500 leading-normal mb-3 font-semibold">
                      {lang === 'ar' 
                        ? 'هذا الشحن متكامل تماماً مع نظام الفوترة الرسمي لغوغل بلاي للتطبيقات. حدد الحزمة المراد شراؤها ثم اضغط على زر التأكيد للشراء الآمن بنقرة واحدة ببطاقتك المسجلة بالمتجر أو رصيد بلاي.' 
                        : 'Fully integrated with official Google Play In-App Billing APIs. Select your preferred package, then tap "Confirm & Request Recharge" below to initiate Google Play payment.'
                      }
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'tokens_500', tokens: 500, price: '4.99$', priceUSD: 4.99 },
                        { id: 'tokens_1000', tokens: 1000, price: '9.99$', priceUSD: 9.99 },
                        { id: 'tokens_2500', tokens: 2500, price: '24.99$', priceUSD: 24.99 },
                        { id: 'tokens_5000', tokens: 5000, price: '49.99$', priceUSD: 49.99 },
                      ].map((pkg) => {
                        const isSelected = selectedGooglePackage?.id === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedGooglePackage(pkg)}
                            className={`p-3.5 rounded-2xl border-2 text-right transition-all flex flex-col justify-between h-20 relative cursor-pointer ${
                              isSelected 
                                ? 'bg-[#E1F5FE]/60 border-[#0288D1] shadow-xs scale-[1.02]' 
                                : 'bg-white border-gray-150 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-[12px] font-black text-slate-800 block">💎 {pkg.tokens} {lang === 'ar' ? 'توكن ذهبي' : 'Gold Tokens'}</span>
                            <span className="text-[10px] font-extrabold text-[#0288D1] block mt-1">{pkg.price}</span>
                            {isSelected && (
                              <span className="absolute left-2.5 top-2.5 w-2 h-2 bg-[#0288D1] rounded-full animate-ping"></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // ORIGINAL BaridiMob/CCP Inputs wrapped
                  <div className="space-y-3 animate-in fade-in duration-200">
                    {/* Amount field */}
                    <div className="text-right">
                      <label className="text-[9.5px] font-extrabold text-gray-400 uppercase block mb-1">{lang === 'ar' ? 'المبلغ المحوّل الفعلي بالدينار الجزائري (DZD)' : 'Exact Dinar Amount (DZD)'}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          required
                          min={100}
                          value={refillAmount === 0 ? '' : refillAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRefillAmount(val === '' ? 0 : Math.max(0, Number(val)));
                          }}
                          className="w-full pl-16 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs font-black focus:outline-none focus:border-[#4FC3F7]"
                          placeholder="DZD (DA)"
                        />
                        <div className="absolute left-3 top-2 text-[9.5px] font-black text-gray-400 font-mono">DZD (DA)</div>
                      </div>
                    </div>

                    {/* Reference Number */}
                    <div className="text-right">
                      <label className="text-[9.5px] font-extrabold text-[#1F2A44] uppercase block mb-1">{lang === 'ar' ? 'رقم عملية التحويل / رقم المرجع للوصل' : 'Transaction Reference Number'}</label>
                      <input 
                        type="text" 
                        required
                        value={refillReference}
                        onChange={(e) => setRefillReference(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs font-mono font-bold focus:outline-none focus:border-[#4FC3F7]"
                        placeholder={lang === 'ar' ? 'سلسلة الأرقام الكاملة (مثال: 104523)' : 'TxID Reference e.g. 104523'}
                      />
                    </div>

                    {/* Transaction Date picker */}
                    <div className="text-right">
                      <label className="text-[9.5px] font-extrabold text-gray-400 uppercase block mb-1">{lang === 'ar' ? 'تاريخ المعاملة المالية (تاريخ العملية)' : 'Transaction Date (YYYY-MM-DD)'}</label>
                      <input 
                        type="date" 
                        required
                        value={refillDate}
                        onChange={(e) => setRefillDate(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs font-mono font-bold focus:outline-none focus:border-[#4FC3F7]"
                      />
                    </div>

                    {/* Receipt Photo Drag Drop Picker */}
                    <div className="text-right space-y-1.5">
                      <label className="text-[9.5px] font-extrabold text-gray-400 uppercase block">
                        {lang === 'ar' ? 'لقطة شاشة أو صورة وصل إثبات الدفع المعتمد' : 'Receipt Proof Screen or Photograph'}
                      </label>
                      
                      <label 
                        htmlFor="receipt-proof-file"
                        onClick={() => playCameraShutter(audioEffectsEnabled)}
                        className="border-2 border-dashed border-gray-200 hover:border-[#4FC3F7] rounded-2xl p-4 text-center transition-all cursor-pointer bg-gray-50/50 hover:bg-sky-50/5 flex flex-col justify-center items-center group h-32 block"
                      >
                        {refillReceiptUploading ? (
                          <div className="space-y-2 w-full max-w-[200px]">
                            <div className="flex justify-between items-center text-[9px] font-extrabold text-[#4FC3F7]">
                              <span className="animate-pulse">{lang === 'ar' ? 'جاري ضغط ومعالجة الوصل...' : 'Processing receipt...'}</span>
                              <span>{refillReceiptProgress}%</span>
                            </div>
                            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className="bg-[#4FC3F7] h-full transition-all duration-150" style={{ width: `${refillReceiptProgress}%` }}></div>
                            </div>
                          </div>
                        ) : refillReceiptUploaded && refillReceiptBase64 ? (
                          <div className="flex items-center justify-between gap-3 w-full border border-emerald-500/15 bg-emerald-50/50 p-2 rounded-xl text-right">
                            <div className="flex items-center gap-2">
                              <span className="inline-block p-1 bg-emerald-100 rounded text-emerald-600">✔</span>
                              <div className="text-right">
                                <span className="text-[9px] font-black text-emerald-800 block leading-tight">
                                  {lang === 'ar' ? 'تم اختيار وصل الدفع بنجاح!' : 'Receipt selected successfully!'}
                                </span>
                                <span className="text-[8px] text-emerald-600 block truncate max-w-[120px] font-mono">
                                  {refillReceiptFileName}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Camera className="w-8 h-8 text-gray-400 group-hover:text-[#4FC3F7] transition-colors" />
                            <span className="text-[10px] font-extrabold text-gray-500 group-hover:text-gray-700">
                              {lang === 'ar' ? 'اضغط لرفع لقطة شاشة لوصل التحويل' : 'Tap to upload transaction receipt'}
                            </span>
                            <span className="text-[8px] text-gray-400">
                              {lang === 'ar' ? 'يدعم الصور JPG أو PNG حتى 5 ميجابايت' : 'Supports JPG, PNG up to 5MB'}
                            </span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  refillLoading || 
                  (refillPaymentMethod !== 'googleplay' && (!refillAmount || !refillReference || !refillReceiptBase64))
                }
                className="w-full py-3 bg-[#FF3B7C] hover:bg-[#E0245E] text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {refillLoading ? (
                  <span className="animate-pulse">{lang === 'ar' ? 'جاري إرسال الطلب للمراجعة...' : 'Submitting for review...'}</span>
                ) : (
                  <span>{lang === 'ar' ? 'تأكيد عملية التحويل والشحن 🚀' : 'Confirm & Request Recharge 🚀'}</span>
                )}
              </button>
            </form>

            {/* AI Verification Result Card for Payment Receipt */}
            {verificationResult && (
              <div className={`rounded-2xl p-4 border text-right space-y-2 mt-4 animate-in fade-in duration-300 ${
                verificationResult.status === 'APPROVED' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : verificationResult.status === 'REJECTED'
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <div className="flex justify-between items-center border-b border-black/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      verificationResult.status === 'APPROVED' ? 'bg-emerald-500 animate-pulse' : verificationResult.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                    }`}></span>
                    <span className="text-[10.5px] font-black font-mono">
                      {verificationResult.status === 'APPROVED' 
                        ? (lang === 'ar' ? '✔ مقبول ومطابق تلقائياً' : '✔ APPROVED') 
                        : verificationResult.status === 'REJECTED'
                        ? (lang === 'ar' ? '✖ مرفوض من الذكاء الاصطناعي' : '✖ REJECTED')
                        : (lang === 'ar' ? '⏳ تم التوجيه للمراجعة اليدوية' : '⏳ PENDING HUMAN REVIEW')}
                    </span>
                  </div>
                  <span className="text-[9px] font-black text-gray-500">{lang === 'ar' ? 'نتيجة فحص الإيصال بالذكاء الاصطناعي' : 'AI Receipt Verification Engine'}</span>
                </div>

                {verificationResult.reason_arabic && (
                  <div className="space-y-1">
                    <p className="text-xs font-bold leading-relaxed text-[#1F2A44] bg-white/70 p-2.5 rounded-xl border border-black/5">
                      {verificationResult.reason_arabic}
                    </p>
                  </div>
                )}

                {verificationResult.extracted_data && (
                  <div className="grid grid-cols-3 gap-2 text-[9.5px] font-mono bg-white/50 p-2 rounded-xl text-center">
                    <div>
                      <span className="block text-gray-400 text-[8px]">{lang === 'ar' ? 'المبلغ المستخرج' : 'Extracted Amount'}</span>
                      <span className="font-bold text-slate-800">{verificationResult.extracted_data.amount_dzd || '---'} DA</span>
                    </div>
                    <div>
                      <span className="block text-gray-400 text-[8px]">{lang === 'ar' ? 'المرجع' : 'Ref No'}</span>
                      <span className="font-bold text-slate-800">{verificationResult.extracted_data.reference_number || '---'}</span>
                    </div>
                    <div>
                      <span className="block text-gray-400 text-[8px]">{lang === 'ar' ? 'التاريخ' : 'Date'}</span>
                      <span className="font-bold text-slate-800">{verificationResult.extracted_data.date || '---'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top-Up Request History & Rejection Reasons */}
            {userRefillRequests.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-150 text-right">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">{userRefillRequests.length}</span>
                  <h5 className="text-[11px] font-black text-[#1F2A44] flex items-center gap-1.5">
                    <span>{lang === 'ar' ? 'سجل وتفاصيل طلبات الشحن السابقة' : 'Top-Up Request History'}</span>
                    <Receipt className="w-4 h-4 text-amber-500" />
                  </h5>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {userRefillRequests.map((req) => (
                    <div key={req.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-150 text-right space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status === 'approved' ? (lang === 'ar' ? 'مقبول ومحسوب ✔' : 'Approved ✔') :
                           req.status === 'rejected' ? (lang === 'ar' ? 'مرفوض ❌' : 'Rejected ❌') :
                           (lang === 'ar' ? 'قيد المراجعة ⏳' : 'Pending ⏳')}
                        </span>
                        <span className="font-mono font-bold text-[#1F2A44]">{req.amount} DA ({req.paymentMethod?.toUpperCase() || 'CCP/BARIDI'})</span>
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono">
                        <span>{req.createdAt ? new Date(req.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-DZ' : 'en-US') : ''}</span>
                        <span>Ref: {req.referenceNumber || req.id}</span>
                      </div>

                      {/* Rejection or AI Reason Display */}
                      {(req.status === 'rejected' || req.rejectionReason || req.reason || req.aiVerification?.reason_arabic) && (
                        <div className="bg-rose-50 border border-rose-200/80 p-2.5 rounded-xl text-[10.5px] text-rose-900 font-bold leading-relaxed">
                          <span className="text-rose-600 block text-[9px] font-black mb-0.5">
                            {lang === 'ar' ? '⚠️ سبب عدم القبول / توضيح النظام والذكاء الاصطناعي:' : '⚠️ Rejection Reason / AI Explanation:'}
                          </span>
                          <p>{req.rejectionReason || req.reason || req.aiVerification?.reason_arabic || (lang === 'ar' ? 'بيانات الوصل غير مطابقة أو لم يتم العثور على صورة واضحة.' : 'Receipt parameters did not match verification criteria.')}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3D Secure Simulated OTP Modal */}
            <AnimatePresence>
              {showOtpPopup && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-100 shadow-2xl space-y-4 text-center font-sans text-[#1F2A44]"
                  >
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                      <button 
                        onClick={() => setShowOtpPopup(false)}
                        className="text-gray-400 hover:text-gray-600 font-bold p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <h4 className="font-extrabold text-xs tracking-tight flex items-center gap-1.5 flex-row-reverse">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>{lang === 'ar' ? 'التحقق الثلاثي الآمن ثلاثي الأبعاد' : '3D Secure Verified by Visa/MC'}</span>
                      </h4>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-500 leading-normal">
                        {lang === 'ar' 
                          ? `لقد أرسلنا رمز التحقق المؤقت (OTP) إلى جهازك المحاكي لدواعي الأمان. يرجى إدخال الرمز المكون من 4 أرقام المكتوب أدناه لتأكيد شحن الحساب وإتمام المعاملة بنجاح:`
                          : `For secure payment, we sent a simulated 4-digit code. Please input the OTP code below to approve the transaction:`
                        }
                      </p>

                      {paypalApprovalUrl && (
                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 text-center animate-in fade-in duration-200">
                          <p className="text-[9.5px] font-bold text-amber-800 leading-normal">
                            {lang === 'ar' 
                              ? '⚠️ خطوة هامة: يرجى النقر أدناه لإتمام عملية الدفع الحقيقية والخصم عبر بوابة PayPal الآمنة أولاً:' 
                              : '⚠️ Crucial Step: Please click below to complete the real PayPal payment and authorize the charge first:'}
                          </p>
                          <a 
                            href={paypalApprovalUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-[#FFC439] hover:bg-[#F2B51F] text-blue-950 font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                          >
                            <span>{lang === 'ar' ? '🅿️ ادفع الآن عبر PayPal' : '🅿️ Pay Now with PayPal'}</span>
                          </a>
                        </div>
                      )}
                      
                      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 font-mono text-center">
                        <span className="text-[10px] font-bold text-blue-500 block uppercase tracking-wide">
                          {lang === 'ar' ? 'رمز التحقق الافتراضي المرسل:' : 'Your simulated 3D Secure code is:'}
                        </span>
                        <span className="text-lg font-black text-blue-800 tracking-widest">{generatedOtp}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-center">
                      <input 
                        type="text"
                        maxLength={4}
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                        className="w-full max-w-[150px] mx-auto text-center font-mono font-black text-xl tracking-widest py-2 bg-gray-55 border-2 border-gray-200 focus:border-blue-500 rounded-xl focus:outline-none"
                        placeholder="••••"
                      />
                      {otpError && (
                        <p className="text-[9px] text-red-600 font-black">{otpError}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowOtpPopup(false)}
                        className="py-2.5 text-xs font-black bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
                      >
                        {lang === 'ar' ? 'إلغاء المعاملة' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleVerifyOtpAndCredit}
                        className="py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        {lang === 'ar' ? 'تأكيد الدفع والخصم' : 'Verify & Charge'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* -------------------- SUBMENU 4: GENERAL PREFERENCES -------------------- */}
        {activeSubmenu === 'general' && (
          <div className="bg-white border border-gray-150 rounded-3xl divide-y divide-gray-150 shadow-sm overflow-hidden animate-in fade-in duration-200">
            
            {/* Culture Language */}
            <div className={`p-4 flex flex-col sm:flex-row justify-between items-center gap-3 ${isRtl ? '' : 'sm:flex-row-reverse'}`}>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'} w-full sm:w-auto`}>
                <h5 className="font-extrabold text-xs text-[#1F2A44]">
                  {lang === 'ar' ? 'لغة التطبيق المعتمدة (Language)' : lang === 'fr' ? "Langue de l'application" : 'App Interface Language'}
                </h5>
                <p className="text-[9px] text-gray-400 font-semibold font-sans">
                  {lang === 'ar' ? 'تحكم بثقافة ولغة واجهة المستخدم' : lang === 'fr' ? 'Changer la langue du système' : 'Control system interface language and localization'}
                </p>
              </div>
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 relative">
                {(['ar', 'fr', 'en'] as const).map((langCode) => {
                  const isActive = language === langCode;
                  const label = langCode === 'ar' ? 'العربية' : langCode === 'fr' ? 'Français' : 'English';
                  return (
                    <button
                      key={langCode}
                      onClick={() => handleLangSelect(langCode)}
                      className={`relative px-4 py-1.5 rounded-lg text-[9px] font-black cursor-pointer transition-colors duration-200 z-10 ${
                        isActive ? 'text-[#FFD34D]' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeLanguagePill"
                          className="absolute inset-0 bg-[#1F2A44] rounded-lg shadow-sm z-0"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notifications toggle */}
            <div className={`p-4 flex justify-between items-center ${isRtl ? '' : 'flex-row-reverse'}`}>
              <button 
                dir="ltr"
                onClick={handleToggleNotifications}
                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer ${
                  lang === 'ar' ? '' : 'transition-colors duration-200'
                } ${
                  enableNotifications ? 'bg-[#FF3B7C]' : 'bg-gray-300'
                }`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-xs ${
                  lang === 'ar' ? '' : 'transition-transform duration-200'
                } ${
                  enableNotifications ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                <h5 className="font-extrabold text-xs text-[#1F2A44]">
                  {lang === 'ar' ? 'الإشعارات الميدانية المهمة' : lang === 'fr' ? 'Notifications de terrain importantes' : 'Critical Field Notifications'}
                </h5>
                <p className="text-[9px] text-gray-400 font-semibold">
                  {lang === 'ar' ? 'تلقي تنبيهات عند نشر مهام عاجلة بالقرب منك' : lang === 'fr' ? 'Recevoir des alertes pour les tâches urgentes proches' : 'Get alerted immediately when urgent tasks are posted nearby'}
                </p>
              </div>
            </div>

            {/* Sound FX */}
            <div className={`p-4 flex justify-between items-center ${isRtl ? '' : 'flex-row-reverse'}`}>
              <button 
                dir="ltr"
                onClick={handleToggleAudioEffects}
                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer ${
                  lang === 'ar' ? '' : 'transition-colors duration-200'
                } ${
                  audioEffectsEnabled ? 'bg-[#FF3B7C]' : 'bg-gray-300'
                }`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-xs ${
                  lang === 'ar' ? '' : 'transition-transform duration-200'
                } ${
                  audioEffectsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'} flex items-center gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h5 className="font-extrabold text-xs text-[#1F2A44]">
                    {lang === 'ar' ? 'التأثيرات الصوتية للنظام' : lang === 'fr' ? 'Effets sonores du système' : 'System Sound Effects'}
                  </h5>
                  <p className="text-[9px] text-gray-400 font-semibold font-sans">
                    {lang === 'ar' ? 'تشغيل أصوات توكيد حية عند شحن الرصد أو حجز كويست' : lang === 'fr' ? 'Jouer des effets sonores lors du rechargement ou de l\'engagement' : 'Play realistic feedback sounds on balance refills or booking'}
                  </p>
                </div>
                <Volume2 className="w-4 h-4 text-[#FF3B7C] shrink-0" />
              </div>
            </div>

            {/* Haptic Vibration */}
            <div className={`p-4 flex justify-between items-center ${isRtl ? '' : 'flex-row-reverse'}`}>
              <button 
                dir="ltr"
                onClick={handleToggleHapticFeedback}
                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer ${
                  lang === 'ar' ? '' : 'transition-colors duration-200'
                } ${
                  hapticFeedbackEnabled ? 'bg-[#FF3B7C]' : 'bg-gray-300'
                }`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-xs ${
                  lang === 'ar' ? '' : 'transition-transform duration-200'
                } ${
                  hapticFeedbackEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'} flex items-center gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h5 className="font-extrabold text-xs text-[#1F2A44]">
                    {lang === 'ar' ? 'الاهتزاز الحسي التفاعلي' : lang === 'fr' ? 'Retours haptiques tactiles' : 'Interactive Haptic Feedback'}
                  </h5>
                  <p className="text-[9px] text-gray-400 font-semibold">
                    {lang === 'ar' ? 'بث نبضات اهتزاز ذكية بالجهاز لدعم التفاعلات باللمس' : lang === 'fr' ? 'Émettre des vibrations intelligentes lors des interactions' : 'Emit smart vibration pulses for tactile feedback on touch'}
                  </p>
                </div>
                <Smartphone className="w-4 h-4 text-[#4FC3F7] shrink-0" />
              </div>
            </div>

            {/* Low Performance Mode / Speed Boost */}
            <div className={`p-4 flex justify-between items-center border-t border-gray-100/70 ${isRtl ? '' : 'flex-row-reverse'}`}>
              <button 
                dir="ltr"
                onClick={handleToggleLowPerformanceMode}
                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer ${
                  lang === 'ar' ? '' : 'transition-colors duration-200'
                } ${
                  lowPerformanceModeEnabled ? 'bg-[#FF3B7C]' : 'bg-gray-300'
                }`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-xs ${
                  lang === 'ar' ? '' : 'transition-transform duration-200'
                } ${
                  lowPerformanceModeEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'} flex items-center gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h5 className="font-extrabold text-xs text-[#1F2A44]">
                    {lang === 'ar' ? 'وضع تسريع الأجهزة الضعيفة' : lang === 'fr' ? 'Mode Performance (Appareils Faibles)' : 'Low Performance Speed Boost'}
                  </h5>
                  <p className="text-[9px] text-gray-400 font-semibold">
                    {lang === 'ar' ? 'تقليل المؤثرات الانتقالية وإيقاف الخلفيات المعقدة لزيادة سلاسة التطبيق' : lang === 'fr' ? 'Désactiver les flous et les animations pour plus de fluidité' : 'Reduce transition speed and disable blurs for maximum FPS'}
                  </p>
                </div>
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
              </div>
            </div>

            {/* Dark Mode toggle */}
            <div className={`p-4 flex justify-between items-center ${isRtl ? '' : 'flex-row-reverse'}`}>
              <button 
                dir="ltr"
                onClick={handleTogglePrivacy}
                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer ${
                  lang === 'ar' ? '' : 'transition-colors duration-200'
                } ${
                  privacyEnabled ? 'bg-[#FF3B7C]' : 'bg-gray-300'
                }`}
              >
                <div className={`bg-white w-5 h-5 rounded-full shadow-xs ${
                  lang === 'ar' ? '' : 'transition-transform duration-200'
                } ${
                  privacyEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'} flex items-center gap-2 ${isRtl ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={isRtl ? 'text-right' : 'text-left'}>
                  <h5 className="font-extrabold text-xs text-[#1F2A44]">{dict.privacyHeader}</h5>
                  <p className="text-[9px] text-gray-400 font-semibold font-sans">{dict.privacySubtitle}</p>
                </div>
                <Moon className="w-4 h-4 text-[#FF3B7C] shrink-0" />
              </div>
            </div>

            {/* Custom Contact Support button & modal triggering row */}
            <div className={`p-4 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 ${isRtl ? '' : 'sm:flex-row-reverse'}`}>
              <button 
                type="button"
                onClick={() => setShowSupportForm(true)}
                className="px-4 py-2 bg-[#1F2A44] hover:bg-slate-800 text-white font-black text-[10px] rounded-xl cursor-pointer transition-all active:scale-95 text-center font-sans"
              >
                {lang === 'ar' ? 'التواصل مع الدعم الفني 💬' : lang === 'fr' ? 'Contacter le support 💬' : 'Contact Support 💬'}
              </button>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'} flex-1`}>
                <h5 className="font-extrabold text-xs text-[#1F2A44]">
                  {lang === 'ar' ? 'الدعم والمساعدة الفنية' : lang === 'fr' ? 'Support & Assistance' : 'Support & Technical Assistance'}
                </h5>
                <p className="text-[9px] text-gray-400 font-semibold">
                  {lang === 'ar' ? 'واجهتك مشكلة؟ تواصل فوراً مع طاقم الإشراف والتحقق.' : lang === 'fr' ? 'Un problème ? Contactez notre équipe de modération.' : 'Encountered an issue? Open a direct ticket with our support admins.'}
                </p>
              </div>
            </div>

            {/* Legal Policies & Terms Links */}
            <div className="p-4 bg-slate-100/60 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 border border-slate-200/80">
              <div className="flex gap-2 w-full sm:w-auto">
                <a
                  href="https://kimo.hakerzoldyck.workers.dev/terms%20of%20use"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#1F2A44] font-black text-[10px] rounded-lg transition-all text-center flex items-center justify-center gap-1 shadow-2xs"
                >
                  <FileText className="w-3 h-3 text-[#FF3B7C]" />
                  <span>{lang === 'ar' ? 'شروط الاستخدام' : lang === 'fr' ? "Conditions d'utilisation" : 'Terms of Use'}</span>
                </a>
                <a
                  href="https://kimo.hakerzoldyck.workers.dev/privacy%20policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#1F2A44] font-black text-[10px] rounded-lg transition-all text-center flex items-center justify-center gap-1 shadow-2xs"
                >
                  <ShieldCheck className="w-3 h-3 text-[#0288D1]" />
                  <span>{lang === 'ar' ? 'سياسة الخصوصية' : lang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy'}</span>
                </a>
              </div>
              <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                <h5 className="font-extrabold text-xs text-[#1F2A44]">
                  {lang === 'ar' ? 'الشروط والسياسات القانونية ⚖️' : 'Legal Policies & Terms ⚖️'}
                </h5>
                <p className="text-[9px] text-gray-400 font-semibold">
                  {lang === 'ar' ? 'اطّلع على سياسات الخصوصية وحماية البيانات وشروط الخدمة المعتمَدة.' : 'Read our official Privacy Policy and Terms of Use.'}
                </p>
              </div>
            </div>

          </div>
        )}

        {/* -------------------- SUBMENU 5: TECHNICAL SUPPORT CHAT -------------------- */}
        {activeSubmenu === 'support_chat' && (
          <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
            {selectedUserTicketId ? (
              // Chat conversation thread view
              (() => {
                const ticket = userSupportTickets.find(t => t.id === selectedUserTicketId);
                if (!ticket) {
                  return (
                    <button
                      type="button"
                      onClick={() => setSelectedUserTicketId(null)}
                      className="w-full bg-[#1F2A44] hover:bg-slate-800 text-white font-black text-xs py-2.5 rounded-xl cursor-pointer"
                    >
                      {isRtl ? 'حمل التذاكر' : 'Load Tickets'}
                    </button>
                  );
                }
                const allMsgs = [
                  { sender: 'user', senderName: ticket.userName, text: ticket.message, createdAt: ticket.createdAt },
                  ...(ticket.replies || [])
                ];

                return (
                  <div className="space-y-4">
                    {/* Chat header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedUserTicketId(null)}
                        className="px-3 py-1.5 bg-slate-100 font-extrabold hover:bg-slate-200 text-[#1F2A44] text-[10px] rounded-xl transition-all"
                      >
                        {isRtl ? '← رجوع للقائمة' : '← Back'}
                      </button>
                      <div className="text-right">
                        <h4 className="font-extrabold text-xs text-[#1F2A44]">{ticket.subject}</h4>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                          ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ticket.status === 'resolved' ? (isRtl ? '✅ تم الحل' : 'resolved') : (isRtl ? '⏳ معلّق' : 'pending')}
                        </span>
                      </div>
                    </div>

                    {/* Chat Messages Body */}
                    <div className="h-72 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col">
                      {allMsgs.map((msg: any, idx: number) => {
                        const isMe = msg.sender === 'user';
                        return (
                          <div key={idx} className={`flex flex-col ${isMe ? 'items-start text-left' : 'items-end text-right'} w-full`}>
                            <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed font-bold ${
                              isMe 
                                ? 'bg-[#1F2A44] text-white rounded-br-none' 
                                : 'bg-white text-slate-800 border border-gray-150 rounded-bl-none shadow-xs'
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              <span className="block text-[8px] text-gray-400 mt-1 font-mono text-left">
                                {new Date(msg.createdAt).toLocaleTimeString(isRtl ? 'ar' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                            <span className="text-[8px] text-gray-400 mt-0.5 px-1 font-bold">
                              {isMe ? (isRtl ? 'أنت' : 'You') : (isRtl ? 'الدعم الفني / الإشراف' : 'Technical Support')}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Send dialogue input */}
                    {ticket.status === 'resolved' ? (
                      <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-center text-[10px] font-extrabold">
                        {isRtl ? '🔒 هذه التذكرة مغلقة ومحلولة. إذا تكررت المشكلة، يمكنك إنشاء تذكرة جديدة.' : '🔒 This ticket is resolved. Create a new one if needed.'}
                      </div>
                    ) : (
                      <div className="flex gap-2" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                        <input
                          type="text"
                          placeholder={isRtl ? 'اكتب رسالتك ودعمك هنا...' : 'Type your message...'}
                          value={newTicketReplyText}
                          onChange={(e) => setNewTicketReplyText(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !isSendingTicketReply && newTicketReplyText.trim()) {
                              setIsSendingTicketReply(true);
                              try {
                                await updateDoc(doc(db, 'support_tickets', ticket.id), {
                                  replies: arrayUnion({
                                    sender: 'user',
                                    senderName: userProfile.name,
                                    text: newTicketReplyText.trim(),
                                    createdAt: new Date().toISOString()
                                  }),
                                  status: 'pending'
                                });
                                setNewTicketReplyText('');
                              } catch (err) {
                                console.error(err);
                                showToast(isRtl ? '❌ فشل الإرسال' : '❌ Send failed');
                              } finally {
                                setIsSendingTicketReply(false);
                              }
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-gray-205 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#1F2A44] transition-all"
                        />
                        <button
                          type="button"
                          disabled={isSendingTicketReply || !newTicketReplyText.trim()}
                          onClick={async () => {
                            if (!newTicketReplyText.trim()) return;
                            setIsSendingTicketReply(true);
                            try {
                              await updateDoc(doc(db, 'support_tickets', ticket.id), {
                                  replies: arrayUnion({
                                    sender: 'user',
                                    senderName: userProfile.name,
                                    text: newTicketReplyText.trim(),
                                    createdAt: new Date().toISOString()
                                  }),
                                  status: 'pending'
                              });
                              setNewTicketReplyText('');
                            } catch (err) {
                              console.error(err);
                              showToast(isRtl ? '❌ فشل الإرسال' : '❌ Send failed');
                            } finally {
                              setIsSendingTicketReply(false);
                            }
                          }}
                          className="px-4 bg-[#1F2A44] hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isRtl ? 'إرسال' : 'Send'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              // Tickets List / Creation Form
              <div className="space-y-4" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                <div className="flex justify-between items-center border-b border-gray-100 pb-3 font-sans">
                  <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
                    {isRtl ? '💬 تذاكر الدعم الفني الخاصة بك' : '💬 Your Support Tickets'}
                  </h4>
                  <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                    {userSupportTickets.length} {isRtl ? 'تذاكر' : 'Tickets'}
                  </span>
                </div>

                {/* Open New Ticket Option Form */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-150 space-y-3 font-sans">
                  <h5 className="font-black text-xs text-[#1F2A44]">
                    {isRtl ? '🎁 إنشاء تذكرة دعم فني جديدة' : '🎁 Create New Ticket'}
                  </h5>
                  <div className="space-y-2.5">
                    <div>
                      <input
                        type="text"
                        placeholder={isRtl ? 'الموضوع / ما هي مشكلتك؟' : 'Subject...'}
                        value={newTicketSubject}
                        onChange={(e) => setNewTicketSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold' outline-none focus:border-[#1F2A44]"
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder={isRtl ? 'اشرح لنا المشكلة بالتفصيل هنا وسنقوم بالرد عليك بحد أقصى ساعات قليلة...' : 'Message details...'}
                        rows={3}
                        value={newTicketMessage}
                        onChange={(e) => setNewTicketMessage(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-[#1F2A44] resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isSubmittingNewTicket || !newTicketSubject.trim() || !newTicketMessage.trim()}
                      onClick={async () => {
                        setIsSubmittingNewTicket(true);
                        try {
                          const ticketId = 'TCK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                          const ticketDoc = {
                            ticketId,
                            userId: userProfile.id,
                            userName: userProfile.name || 'مستخدم مجهول',
                            userEmail: authenticatedUser?.email || userProfile.email || 'بلا إيميل',
                            subject: newTicketSubject.trim(),
                            message: newTicketMessage.trim(),
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            replies: []
                          };
                          await setDoc(doc(db, 'support_tickets', ticketId), ticketDoc);
                          showToast(isRtl ? '🎉 تم إنشاء التذكرة بنجاح! انتقل للشات.' : '🎉 Ticket created successfully!');
                          setNewTicketSubject('');
                          setNewTicketMessage('');
                          setSelectedUserTicketId(ticketId);
                        } catch (err) {
                          console.error(err);
                          showToast(isRtl ? '❌ فشل الإرسال' : '❌ Submission failed');
                        } finally {
                          setIsSubmittingNewTicket(false);
                        }
                      }}
                      className="w-full bg-[#1F2A44] hover:bg-slate-800 text-white font-black text-xs py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingNewTicket ? (isRtl ? 'جاري الإرسال السحابي...' : 'Sending...') : (isRtl ? 'بدء المحادثة الآن 🚀' : 'Start Support Conversation 🚀')}
                    </button>
                  </div>
                </div>

                {/* Active tickets List rendering */}
                {isLoadingUserSupport ? (
                  <p className="text-center font-bold text-xs text-gray-400 animate-pulse">{isRtl ? 'جاري تحميل التذاكر...' : 'Loading...'}</p>
                ) : userSupportTickets.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userSupportTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedUserTicketId(t.id)}
                        className="p-3 bg-white border border-gray-150 rounded-2xl flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <ChevronRight className={`w-4 h-4 text-gray-400 ${isRtl ? 'rotate-180' : ''}`} />
                        <div className="text-right flex-1 pr-3 font-sans">
                          <h6 className="text-[11px] font-extrabold text-[#1F2A44]">{t.subject}</h6>
                          <div className="flex items-center gap-1.5 justify-end mt-1">
                            <span className="text-[8px] text-gray-400 font-mono">ID: {t.ticketId}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                              t.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {t.status === 'resolved' ? (isRtl ? '✅ تم الحل' : 'resolved') : (isRtl ? '⏳ معلّق' : 'pending')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[10px] text-gray-400 font-semibold">{isRtl ? 'لا توجد نقاشات دعم نشطة حالياً.' : 'No active support discussions found.'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* -------------------- SUBMENU 6: FREE TOKENS & DAILY REWARDS -------------------- */}
        {activeSubmenu === 'free_tokens' && (
          <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm space-y-6 animate-in fade-in duration-200 text-right font-sans">
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                <Gift className="w-6 h-6 text-amber-500 fill-amber-500/10" />
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-black text-[#1F2A44]">
                  {lang === 'ar' ? '🎁 مكافآت ونقاط مجانية' : '🎁 Free Tokens & Rewards'}
                </h5>
                <p className="text-[10px] text-gray-400 font-semibold">
                  {lang === 'ar' ? 'أكمل حضورك اليومي أو ادعُ أصدقاءك للحصول على توكنز إضافية!' : 'Claim daily streak rewards or invite your friends to obtain bonus Gold Ammo!'}
                </p>
              </div>
            </div>

            {/* 📅 SECTION 1: DAILY REWARDS MATRIX */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <span className="text-amber-500 text-xs">🔥</span>
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                    {lang === 'ar' ? `السلسلة الحالية: ${userProfile.checkInStreak || 0} أيام` : `Streak: ${userProfile.checkInStreak || 0} Days`}
                  </span>
                </div>
                <h6 className="font-extrabold text-xs text-[#1F2A44]">
                  {lang === 'ar' ? 'تسجيل الحضور اليومي' : 'Daily Check-In Matrix'}
                </h6>
              </div>

              {/* Matrix view */}
              {(() => {
                const DAILY_REWARDS = [1, 2, 3, 5, 7, 10, 50];
                const lastCheckIn = userProfile.lastCheckInDate || '';
                const currentStreak = userProfile.checkInStreak || 0;
                
                // Simple date helpers
                const getLocalDateString = () => {
                  const d = new Date();
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

                const formatCountdown = (totalSeconds: number) => {
                  const hours = Math.floor(totalSeconds / 3600);
                  const minutes = Math.floor((totalSeconds % 3600) / 60);
                  const seconds = totalSeconds % 60;
                  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                };

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
                    showToast(lang === 'ar' ? '⚠️ لقد سجلت حضورك اليوم بالفعل! عد غداً.' : '⚠️ Already checked-in today! Come back tomorrow.');
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
                    newStreak = 1;
                    reward = DAILY_REWARDS[0];
                  }

                  const newBalance = (userProfile.tokenBalance || 0) + reward;

                  if (onUpdateProfile) {
                    onUpdateProfile({
                      tokenBalance: newBalance,
                      lastCheckInDate: today,
                      checkInStreak: newStreak,
                    });

                    // Trigger sound/haptic
                    try {
                      const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                      if (navigator.vibrate && hapticEnabled) {
                        navigator.vibrate(50);
                      }
                    } catch (err) {
                      console.warn(err);
                    }

                    if (newStreak === 7) {
                      showToast(lang === 'ar'
                        ? `🎉 رائع! لقد حصلت على الجائزة الكبرى لليوم السابع: +50 توكنز!`
                        : `🎉 Grand achievement! Credited Day 7 Jackpot: +50 Tokens!`
                      );
                    } else {
                      showToast(lang === 'ar'
                        ? `🔥 تم تسجيل حضورك لليوم ${newStreak}! وحصلت على +${reward} توكنز.`
                        : `🔥 Success! Day ${newStreak} check-in recorded: +${reward} Tokens added.`
                      );
                    }
                  }
                };

                return (
                  <div className="space-y-4">
                    {/* Grid of days */}
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {DAILY_REWARDS.map((rew, idx) => {
                        const dayNum = idx + 1;
                        
                        // Check state
                        const isClaimed = alreadyCheckedInToday ? (dayNum <= currentStreak) : (dayNum < activeClaimDay);
                        const isActive = !alreadyCheckedInToday && (dayNum === activeClaimDay);

                        let cardStyles = "";
                        let rewardTextHighlight = "";
                        
                        if (isClaimed) {
                          cardStyles = "bg-emerald-50 border border-emerald-200 text-emerald-600";
                          rewardTextHighlight = "text-emerald-600";
                        } else if (isActive) {
                          cardStyles = "bg-gradient-to-b from-amber-400 to-amber-500 text-white font-black shadow-md shadow-amber-400/20 cursor-pointer scale-105 active:scale-95 duration-200 transition-all";
                          rewardTextHighlight = "text-white font-black";
                        } else {
                          cardStyles = "bg-gray-50 border border-gray-150 text-gray-400";
                          rewardTextHighlight = "text-gray-500";
                        }

                        return (
                          <div 
                            key={dayNum}
                            onClick={() => {
                              if (isActive) {
                                claimDailyReward();
                              }
                            }}
                            className={`flex flex-col items-center justify-between py-3 px-1 rounded-2xl text-center select-none ${cardStyles}`}
                            title={isActive ? "Claim Today" : `Day ${dayNum}`}
                          >
                            <span className="text-[7px] font-black block uppercase opacity-75">
                              {lang === 'ar' ? `يوم ${dayNum}` : `D ${dayNum}`}
                            </span>

                            <div className="my-1.5">
                              {isClaimed ? (
                                <div className="w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto text-[8px] font-black">
                                  ✓
                                </div>
                              ) : isActive ? (
                                <div className="w-4 h-4 bg-white text-amber-500 rounded-full flex items-center justify-center mx-auto text-[8px] font-black animate-bounce shadow-xs">
                                  🪙
                                </div>
                              ) : (
                                <div className="w-4 h-4 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center mx-auto text-[8px] font-bold">
                                  🪙
                                </div>
                              )}
                            </div>

                            <span className={`text-[8px] font-black block leading-none ${rewardTextHighlight}`}>
                              +{rew}T
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Claim Button */}
                    <div>
                      {alreadyCheckedInToday ? (
                        <button
                          type="button"
                          disabled
                          className="bg-gray-50 text-gray-400 border border-gray-200 w-full py-3 rounded-2xl text-[10px] font-black flex items-center justify-center gap-1.5 cursor-not-allowed"
                        >
                          <span>✓ {lang === 'ar' ? 'تم الحضور اليوم! يفتح التالي في: ' : 'Checked-in Today! Next in: '}</span>
                          <span className="font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-black">
                            {formatCountdown(secondsUntilMidnight)}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={claimDailyReward}
                          className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-black w-full py-3 rounded-2xl text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/10 cursor-pointer"
                        >
                          <PartyPopper className="w-4 h-4" />
                          <span>
                            {lang === 'ar' 
                              ? `تسجيل حضور اليوم (+${DAILY_REWARDS[activeClaimDay - 1]} توكنز) ⚡` 
                              : `Claim Day ${activeClaimDay} (+${DAILY_REWARDS[activeClaimDay - 1]} Tokens) ⚡`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 🔗 SECTION 2: REFERRAL CODE & SYSTEM */}
            <div className="border-t border-gray-100 pt-6 space-y-4">
              <h6 className="font-extrabold text-xs text-[#1F2A44]">
                {lang === 'ar' ? 'برنامج دعوة الأصدقاء' : 'Friend Referral Program'}
              </h6>
              
              <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                {lang === 'ar' 
                  ? 'شارك كود الدعوة الخاص بك مع أصدقائك. عند انضمامهم، ستحصل أنت على 100 توكنز فوراً، وسيحصل صديقك المدعو على 100 توكنز إضافية فور إتمامه أول مهمة له بنجاح!' 
                  : 'Share your code with friends. You will receive 100 tokens immediately when they use your code, and they will get 100 bonus tokens after finishing their first quest!'}
              </p>

              {/* Your Code Display Card */}
              <div className="bg-slate-50 border border-gray-150 p-4 rounded-2xl space-y-2 text-center">
                <span className="text-[9px] text-gray-400 font-black uppercase tracking-wider block">
                  {lang === 'ar' ? 'كود الدعوة الخاص بك' : 'Your Referral Code'}
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-black font-mono text-[#1F2A44] select-all bg-white border border-gray-200 px-4 py-1.5 rounded-xl">
                    {userProfile.shortId || '(Pending)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (userProfile.shortId) {
                        navigator.clipboard.writeText(userProfile.shortId);
                        showToast(lang === 'ar' ? '📋 تم نسخ كود الإحالة بنجاح!' : '📋 Referral code copied to clipboard!');
                      }
                    }}
                    className="p-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-[#1F2A44] rounded-xl cursor-pointer duration-200 transition-all"
                    title="Copy Code"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Invited count badge */}
                <div className="pt-2 text-[10px] font-semibold text-[#1F2A44] flex items-center justify-center gap-1.5">
                  <span>👥 {lang === 'ar' ? 'الأشخاص المدعوين بواسطة كودك:' : 'Users invited with your code:'}</span>
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg font-black text-[10px] font-mono">
                    {userProfile.referredUsersCount || 0} {lang === 'ar' ? 'أصدقاء' : 'friends'}
                  </span>
                </div>
              </div>

              {/* ENTER CODE SECTION */}
              <div className="bg-white border border-gray-150 p-4 rounded-2xl space-y-3">
                <span className="text-[10px] text-gray-450 font-black block">
                  {lang === 'ar' ? 'هل تمت دعوتك بواسطة صديق؟' : 'Were you invited by a friend?'}
                </span>

                {userProfile.referredBy ? (
                  /* Already referred view */
                  <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl space-y-1 text-center">
                    <span className="text-[9px] text-emerald-800 font-black block">
                      {lang === 'ar' ? '✅ تم تفعيل رمز الإحالة بنجاح' : '✅ Referral Applied'}
                    </span>
                    <p className="text-[10px] text-emerald-700 font-semibold">
                      {lang === 'ar' 
                        ? `تم تسجيلك بدعوة من الكود: ${userProfile.referredBy}` 
                        : `You joined via code: ${userProfile.referredBy}`}
                    </p>
                    <div className="text-[9px] font-extrabold text-emerald-800 mt-1">
                      {userProfile.questsCompleted && userProfile.questsCompleted >= 1 ? (
                        <span>🎉 {lang === 'ar' ? 'تمت إضافة 100 توكن مكافأة للتسجيل بنجاح بعد إتمام أول مهمة!' : '100 bonus tokens added to your balance after first quest!'}</span>
                      ) : (
                        <span>⏳ {lang === 'ar' ? 'ستحصل على 100 توكن إضافية فور إتمام مهمتك الأولى!' : 'You will receive 100 bonus tokens after your first quest!'}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Enter referral input */
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isApplyingReferral || !referralCodeInput.trim()}
                        onClick={async () => {
                          const code = referralCodeInput.trim().toUpperCase();
                          if (!code) return;
                          if (code === userProfile.shortId) {
                            showToast(lang === 'ar' ? '❌ لا يمكنك إدخال كود الدعوة الخاص بك!' : '❌ You cannot enter your own referral code!');
                            return;
                          }
                          setIsApplyingReferral(true);
                          try {
                            // Fetch inviter
                            const usersRef = collection(db, 'users');
                            const q = query(usersRef, where('shortId', '==', code));
                            const querySnapshot = await getDocs(q);
                            
                            if (querySnapshot.empty) {
                              showToast(lang === 'ar' ? '❌ رمز الدعوة غير صالح أو غير موجود!' : '❌ Invalid or non-existent referral code!');
                              setIsApplyingReferral(false);
                              return;
                            }

                            const inviterDoc = querySnapshot.docs[0];
                            const inviterData = inviterDoc.data();
                            
                            // 1. Immediately credit inviter B (+100 tokens and increment count)
                            const currentInviterBalance = Number(inviterData.tokenBalance) || 0;
                            const currentInvitedCount = Number(inviterData.referredUsersCount) || 0;
                            
                            await updateDoc(doc(db, 'users', inviterDoc.id), {
                              tokenBalance: currentInviterBalance + 100,
                              referredUsersCount: currentInvitedCount + 1
                            });

                            // 2. Update invitee (current user) with referral association
                            if (onUpdateProfile) {
                              onUpdateProfile({
                                referredBy: code,
                                referralRewardClaimed: false // will be rewarded on first quest completion
                              });
                            }
                            
                            showToast(lang === 'ar' 
                              ? '🎉 تم قبول كود الدعوة بنجاح! ستحصل على 100 توكن مكافأة فور إتمام مهمتك الأولى، وحصل الداعي على 100 توكن مكافأة فوراً!' 
                              : '🎉 Referral code applied! You will get 100 bonus tokens after your first quest, and the inviter received 100 tokens immediately!'
                            );
                            setReferralCodeInput('');
                          } catch (err) {
                            console.error(err);
                            showToast(lang === 'ar' ? '❌ حدث خطأ أثناء التحقق من الكود!' : '❌ Error checking referral code!');
                          } finally {
                            setIsApplyingReferral(false);
                          }
                        }}
                        className="bg-[#1F2A44] hover:bg-slate-800 text-white font-black text-[10px] px-4 py-2.5 rounded-xl cursor-pointer duration-200 transition-all disabled:opacity-50"
                      >
                        {isApplyingReferral ? (lang === 'ar' ? '⏳ جاري التأكيد...' : 'Applying...') : (lang === 'ar' ? 'تفعيل الكود' : 'Apply')}
                      </button>
                      <input
                        type="text"
                        value={referralCodeInput}
                        onChange={(e) => setReferralCodeInput(e.target.value)}
                        placeholder={lang === 'ar' ? 'أدخل كود صديقك هنا (مثال: ABCD)' : 'Enter friend\'s code (e.g. ABCD)'}
                        className="flex-1 border border-gray-250 bg-gray-50 text-right px-3 py-2 text-xs font-mono font-bold rounded-xl focus:border-[#1F2A44] focus:bg-white outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    );
  }

  // Dynamic stats calculation for user profile
  const myHunterReviews = (hunterReviews || []).filter(r => r.hunterId === userProfile.id);
  const myGodfatherReviews = (godfatherReviews || []).filter(r => r.godfatherId === userProfile.id);
  const totalReviews = myHunterReviews.length + myGodfatherReviews.length;
  const dynamicRating = totalReviews > 0
    ? Number((([...myHunterReviews, ...myGodfatherReviews].reduce((acc, r) => acc + r.rating, 0) / totalReviews)).toFixed(1))
    : (userProfile.rating || 5.0);

  const dynamicCompleted = quests
    ? Math.max(quests.filter(q => q.helperId === userProfile.id && q.status === 'completed').length, userProfile.questsCompleted || 0)
    : (userProfile.questsCompleted || 0);

  const dynamicCreated = quests
    ? Math.max(quests.filter(q => q.creatorId === userProfile.id).length, userProfile.questsCreated || 0)
    : (userProfile.questsCreated || 0);

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      lang={lang}
      audioEffectsEnabled={userProfile?.audioEffectsEnabled !== false}
      hapticFeedbackEnabled={userProfile?.hapticFeedbackEnabled !== false}
    >
      <div className="space-y-6 pb-12 font-sans text-[#1F2A44]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {/* Dynamic Profile Header with adaptive banner */}
      <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-28 bg-gradient-to-r from-[#1F2A44] to-[#1E2E4E]"></div>

        {/* Floating Settings Gear Icon Button on the top dynamic corner */}
        <button 
          onClick={() => {
            setShowSettingsScreen(true);
            setActiveSubmenu('main');
          }}
          className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-4 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md p-2 rounded-full z-20 cursor-pointer transition-all duration-200 border border-white/20`}
          title={lang === 'ar' ? 'الإعدادات العامة' : 'Settings'}
        >
          <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
        </button>

        {/* Floating Leaderboard Trophy Icon Button on the top dynamic corner */}
        <button 
          onClick={() => {
            setShowLeaderboardScreen(true);
          }}
          className={`absolute ${isRtl ? 'left-14' : 'right-14'} top-4 bg-white/10 hover:bg-white/20 text-[#FFD34D] backdrop-blur-md p-2 rounded-full z-20 cursor-pointer transition-all duration-200 border border-white/20`}
          title={lang === 'ar' ? 'قائمة المتصدرين والنقاط' : 'Leaderboard & Points'}
        >
          <Trophy className="w-5 h-5" />
        </button>

        <div className="relative pt-12 flex flex-col items-center">
          <div className="relative">
            <img 
              src={selectedAvatar} 
              alt={name}
              className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-md bg-white cursor-pointer"
              onClick={() => isEditing && setShowAvatarChooser(!showAvatarChooser)}
            />
            {userProfile.idVerificationStatus === 'verified' && (
              <span className="absolute bottom-0 right-0 p-1.5 bg-[#4FC3F7] text-white rounded-full border-2 border-white shadow-md animate-pulse">
                <ShieldCheck className="w-4.5 h-4.5 text-[#1F2A44] fill-[#4FC3F7]" />
              </span>
            )}
          </div>

          {/* Preset image selector */}
          {isEditing && showAvatarChooser && (
            <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-2xl flex gap-1.5 mt-3 flex-wrap justify-center items-center shadow-inner">
              {/* Hidden file input for custom gallery avatar */}
              <input 
                type="file" 
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <button
                type="button"
                onClick={triggerAvatarGalleryPicker}
                className="w-10 h-10 rounded-full border border-dashed border-[#4FC3F7] bg-sky-50/50 hover:bg-sky-50 flex items-center justify-center cursor-pointer"
                title="Upload custom photograph from Gallery"
              >
                <ImageIcon className="w-4 h-4 text-[#4FC3F7]" />
              </button>

              {AVATAR_PRESETS.map((preset, idx) => (
                <img 
                  key={idx} 
                  src={preset} 
                  alt="preset" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-white hover:scale-105 cursor-pointer"
                  onClick={() => {
                    setSelectedAvatar(preset);
                    setShowAvatarChooser(false);
                  }}
                />
              ))}
            </div>
          )}

          <div className="text-center mt-3.5 space-y-1 w-full max-w-sm">
            {isEditing ? (
              <div className="space-y-2 mt-2">
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  className="w-full text-center py-2 px-3 bg-gray-50 border border-gray-150 rounded-xl text-xs font-black"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    value={city} 
                    onChange={(e) => setCity(e.target.value)} 
                    className="w-full text-center py-2 px-3 bg-gray-50 border border-gray-150 rounded-xl text-xs font-black"
                  />
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="w-full text-center py-2 px-3 bg-gray-50 border border-gray-150 rounded-xl text-xs font-black font-mono"
                  />
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-black">{userProfile.name}</h3>

                {/* Copiable Account ID Badge */}
                <div 
                  id="user-id-badge"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-gray-150 hover:bg-slate-100 active:scale-95 text-slate-500 rounded-xl text-[10px] font-mono font-bold cursor-pointer transition-all select-all shadow-xs"
                  title={lang === 'ar' ? 'اضغط أو اضغط ضغطاً مطولاً لنسخ معرف الحساب' : 'Click or hold down to copy Account ID'}
                  onClick={() => handleCopyIdWithFeedback(userProfile.id)}
                  onMouseDown={() => handleStartPress(userProfile.id)}
                  onMouseUp={handleCancelPress}
                  onMouseLeave={handleCancelPress}
                  onTouchStart={() => handleStartPress(userProfile.id)}
                  onTouchEnd={handleCancelPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleCopyIdWithFeedback(userProfile.id);
                  }}
                >
                  <span className="font-sans font-black text-gray-400">ID:</span>
                  <span className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-black">{userProfile.id}</span>
                </div>
                
                {/* 
                  Verified Worker status badge display per instructions:
                  Verified users get Sky Blue Verification badge (color #4FC3F7)
                */}
                <div className="flex flex-col items-center gap-1.5">
                  {userProfile.idVerificationStatus === 'verified' ? (
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-[#4FC3F7]/10 text-[#4FC3F7] rounded-full text-[10px] font-black border border-[#4FC3F7]/30 uppercase tracking-widest">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#4FC3F7]" />
                      <span>{dict.verifiedBadge}</span>
                    </div>
                  ) : userProfile.idVerificationStatus === 'pending' ? (
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black border border-amber-200 uppercase tracking-widest animate-pulse">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{dict.pendingVerification}</span>
                    </div>
                  ) : ((userProfile as any).idVerificationStatus === 'rejected' || (userProfile as any).verificationStatus === 'rejected') ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black border border-rose-200 uppercase tracking-widest">
                        <ShieldAlert className="w-3.5 h-3.5/65" />
                        <span>{lang === 'ar' ? 'طلب توثيق مرفوض ❌' : 'Identity Verification Rejected ❌'}</span>
                      </div>
                      {(userProfile as any).rejectionReason && (
                        <p className="text-[10px] text-rose-500 font-bold max-w-xs text-center mt-1 bg-rose-50 px-2 py-1 rounded-lg">
                          {lang === 'ar' ? 'السبب: ' : 'Reason: '} {(userProfile as any).rejectionReason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-[#FF3B7C] rounded-full text-[10px] font-black border border-red-150 uppercase tracking-widest">
                      <ShieldQuestion className="w-3.5 h-3.5 text-[#FF3B7C]" />
                      <span>{dict.unverifiedBadge}</span>
                    </div>
                  )}

                  {/* 📝 Flexible Short Bio field block with inline-editing layout */}
                  <div className="mt-2 bg-gray-50/75 hover:bg-gray-100/80 p-3 rounded-2xl border border-gray-200/60 inline-block max-w-xs w-full text-center group relative transition-all duration-250">
                    <p className="text-[9px] uppercase font-black text-gray-400 tracking-wider mb-0.5">
                      {lang === 'ar' ? '📝 السيرة الذاتية للرانر (Bio)' : '📝 Runner Field Biography'}
                    </p>
                    {isEditingMainBio ? (
                      <div className="flex items-center gap-1.5 mt-1.5 justify-center">
                        <input 
                          type="text" 
                          value={tempBio}
                          maxLength={100}
                          onChange={(e) => setTempBio(e.target.value)}
                          className="py-1 px-2 border border-[#4FC3F7]/50 rounded-lg text-[11px] font-bold text-center bg-white flex-1 focus:outline-none focus:border-[#4FC3F7]"
                          placeholder={lang === 'ar' ? 'اكتب مهاراتك المباشرة هنا...' : "I can repair or deliver quickly..."}
                          autoFocus
                        />
                        <button 
                          onClick={handleSaveBio}
                          className="p-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black transition-transform active:scale-95 cursor-pointer flex items-center justify-center"
                          title="Save Bio"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditingMainBio(false);
                            setTempBio(mainBio);
                          }}
                          className="p-1 px-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg text-[10px] font-black transition-transform active:scale-95 cursor-pointer flex items-center justify-center"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <p className="text-[11px] font-black leading-relaxed text-[#1F2A44] break-words">
                          {mainBio || (lang === 'ar' ? '📝 السيرة الذاتية (Bio) لم تكتب بعد' : '📝 No Skills Bio Added Yet')}
                        </p>
                        <button
                          onClick={() => {
                            setTempBio(mainBio);
                            setIsEditingMainBio(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200/80 rounded-md transition-all shrink-0 cursor-pointer text-[#4FC3F7] hover:scale-105"
                          title="Edit Bio"
                        >
                          <Edit2 className="w-3 h-3 text-[#4FC3F7] inline" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center gap-4 text-xs text-gray-500 font-bold mt-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF3B7C]" />
                    {userProfile.city}
                  </span>
                  <span>|</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-[#4FC3F7]" />
                    {userProfile.phone}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Stats Bento Block Layout */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-150 p-4 rounded-2xl text-center space-y-0.5 shadow-sm">
          <span className="text-xl font-black block font-mono">{dynamicCompleted}</span>
          <span className="text-[9px] text-[#1F2A44] font-extrabold uppercase tracking-wide block">{dict.questsCompletedLabel}</span>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-2xl text-center space-y-0.5 shadow-sm">
          <span className="text-xl font-black text-amber-500 block font-mono flex items-center justify-center gap-0.5">
            {dynamicRating.toFixed(1)} ★
          </span>
          <span className="text-[9px] text-[#1F2A44] font-extrabold uppercase tracking-wide block">{lang === 'ar' ? 'التقييم العام' : 'Reputation'}</span>
        </div>
        <div className="bg-white border border-gray-150 p-4 rounded-2xl text-center space-y-0.5 shadow-sm">
          <span className="text-xl font-black block font-mono">{dynamicCreated}</span>
          <span className="text-[9px] text-[#1F2A44] font-extrabold uppercase tracking-wide block">{lang === 'ar' ? 'مهام ناشر' : 'Posted Chores'}</span>
        </div>
      </div>

      {/* 🔐 Admin secure command tile */}
      {isAdminUser && (
        <div className="bg-[#1F2A44] border-2 border-[#FFD34D] rounded-3xl p-5 shadow-lg flex items-center justify-between text-white animate-pulse">
          <div className="space-y-1 text-right">
            <h4 className="font-black text-xs text-[#FFD34D] tracking-wider uppercase flex items-center gap-2">
              <span>🛡️ {lang === 'ar' ? 'بوابة الإدارة المركزية' : 'Central Admin Gate'}</span>
            </h4>
            <p className="text-[10px] text-gray-300 font-semibold leading-relaxed">
              {lang === 'ar' ? 'لديك صلاحيات كاملة لمراجعة تفعيلات الهوية (KYC) وإثباتات العمل مباشرة.' : 'Full supervisory authorization detected. Review KYC requests and operator verifications.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onViewChange?.('admin')}
            className="px-4 py-2.5 bg-[#FFD34D] hover:bg-yellow-400 text-[#1F2A44] font-black text-xs rounded-xl shadow-md transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
          >
            {lang === 'ar' ? 'لوحة الإدارة ⚙️' : 'Admin Board ⚙️'}
          </button>
        </div>
      )}

      {/* 🎛️ Premium 3-Tab Segmented Controller */}
      <div className="bg-slate-50 p-1.5 rounded-2xl border border-gray-150 grid grid-cols-3 gap-1 mx-auto max-w-lg mb-6 text-right">
        <button
          type="button"
          onClick={() => setActiveProfileTab('verified')}
          className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border-none ${
            activeProfileTab === 'verified'
              ? 'bg-[#1F2A44] text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>🛡️</span>
          <span>{lang === 'ar' ? 'إنجازات موثقة' : 'Verified Portfolio'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveProfileTab('gallery')}
          className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border-none ${
            activeProfileTab === 'gallery'
              ? 'bg-[#1F2A44] text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>📸</span>
          <span>{lang === 'ar' ? 'صور شخصية' : 'Gallery'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveProfileTab('badges')}
          className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 border-none ${
            activeProfileTab === 'badges'
              ? 'bg-[#1F2A44] text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>🎖️</span>
          <span>{lang === 'ar' ? 'الشارات' : 'Badges'}</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {activeProfileTab === 'verified' && (
          <div className="space-y-4 animate-slideUp">
            {/* Permanent Social Portfolio & Testimonial review cards in Hunter Profile */}
            <div className="space-y-6">
              {/* Reviews Toggle Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 border border-gray-150">
                <button
                  type="button"
                  onClick={() => setReviewRoleTab('hunter')}
                  className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none ${
                    reviewRoleTab === 'hunter'
                      ? 'bg-[#1F2A44] text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span>🏃‍♂️</span>
                  <span>{lang === 'ar' ? 'تقييمات العمل' : 'As Worker'}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${reviewRoleTab === 'hunter' ? 'bg-[#FFD34D] text-[#1F2A44]' : 'bg-gray-200 text-gray-500'}`}>
                    {hunterReviews.filter(r => r.hunterId === userProfile.id).length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewRoleTab('godfather')}
                  className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none ${
                    reviewRoleTab === 'godfather'
                      ? 'bg-[#1F2A44] text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span>👑</span>
                  <span>{lang === 'ar' ? 'تقييمات التوظيف' : 'As Employer'}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${reviewRoleTab === 'godfather' ? 'bg-[#FFD34D] text-[#1F2A44]' : 'bg-gray-200 text-gray-500'}`}>
                    {godfatherReviews.filter(r => r.godfatherId === userProfile.id).length}
                  </span>
                </button>
              </div>

              {/* 1. Reviews received as a Runner */}
              {reviewRoleTab === 'hunter' && (
                <div className="space-y-3 animate-slideUp">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 flex-row-reverse">
                      <span>🏃‍♂️ {lang === 'ar' ? 'تقييمات تلقيتها كعامل' : 'Reviews Received as Worker'}</span>
                    </h4>
                    <span className="text-[9px] bg-sky-50 text-sky-600 font-extrabold px-2 py-0.5 rounded-full">
                      {hunterReviews.filter(r => r.hunterId === userProfile.id).length} {lang === 'ar' ? 'شهادة' : 'Reviews'}
                    </span>
                  </div>

                  {(() => {
                    const filtered = hunterReviews.filter(r => r.hunterId === userProfile.id);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-xs text-center text-gray-400 py-6 bg-slate-50/50 border border-gray-100 rounded-2xl font-semibold">
                          {lang === 'ar' ? 'لا توجد تقييمات عامل بعد. أنجز المهام لتلقي نقاط السمعة!' : 'No worker testimonials on your portfolio yet.'}
                        </div>
                      );
                    }
                    const visible = showAllRunnerReviews ? filtered : filtered.slice(0, 6);
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {visible.map((review) => (
                            <div 
                              key={review.reviewId} 
                              className="bg-white hover:border-[#4FC3F7] border border-gray-150 rounded-2xl overflow-hidden shadow-xs relative flex flex-col justify-between group transition-all"
                            >
                              {review.completedTaskImage && (
                                <div className="h-32 w-full overflow-hidden relative">
                                  <img 
                                    src={review.completedTaskImage} 
                                    alt="Completed Task" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                  <div className="absolute bottom-2 left-2 bg-[#FFD34D] text-[#1F2A44] px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-0.5 shadow-sm">
                                    {Array.from({ length: review.rating }).map((_, i) => (
                                      <Star key={i} className="w-2.5 h-2.5 fill-[#1F2A44] text-[#1F2A44]" />
                                    ))}
                                    <span className="ml-1 font-mono font-bold">{review.rating}.0</span>
                                  </div>
                                </div>
                              )}

                              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-right">
                                <p className="text-xs font-semibold text-slate-600 italic leading-relaxed">
                                  “{review.comment}”
                                </p>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                                  <button
                                    onClick={() => setReviewToDelete(review.reviewId)}
                                    className="p-1 px-1.5 bg-red-50 hover:bg-red-100 text-[#FF3B7C] rounded-lg transition-colors cursor-pointer border-none"
                                    title={lang === 'ar' ? 'حذف التقييم' : 'Delete'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <span className="text-[10px] font-black text-[#1F2A44] block">
                                        {review.godfatherName}
                                      </span>
                                      <span className="text-[8px] text-gray-400 block font-mono">
                                        {review.createdAt || 'الآن'}
                                      </span>
                                    </div>
                                    <img 
                                      src={review.godfatherAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'} 
                                      alt={review.godfatherName} 
                                      className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {filtered.length > 6 && (
                          <div className="flex justify-center pt-2">
                            <button
                              onClick={() => setShowAllRunnerReviews(!showAllRunnerReviews)}
                              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-[#1F2A44] font-black text-xs rounded-xl shadow-xs cursor-pointer select-none transition-all flex items-center gap-1 active:scale-95 border border-slate-200"
                            >
                              <span>{showAllRunnerReviews ? '⬆️' : '⬇️'}</span>
                              <span>
                                {showAllRunnerReviews 
                                  ? (lang === 'ar' ? 'عرض أقل' : 'Show Less')
                                  : (lang === 'ar' ? 'عرض المزيد' : 'Show More')}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 2. Reviews received as a Godfather */}
              {reviewRoleTab === 'godfather' && (
                <div className="space-y-3 pt-2 animate-slideUp">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 flex-row-reverse">
                      <span>👑 {lang === 'ar' ? 'تقييمات تلقيتها كصاحب عمل ' : 'Reviews Received as client'}</span>
                    </h4>
                    <span className="text-[9px] bg-amber-50 text-amber-600 font-extrabold px-2 py-0.5 rounded-full">
                      {godfatherReviews.filter(r => r.godfatherId === userProfile.id).length} {lang === 'ar' ? 'شهادة' : 'Reviews'}
                    </span>
                  </div>

                  {(() => {
                    const filtered = godfatherReviews.filter(r => r.godfatherId === userProfile.id);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-xs text-center text-gray-400 py-6 bg-slate-50/50 border border-gray-100 rounded-2xl font-semibold">
                          {lang === 'ar' ? 'لا توجد تقييمات متبادلة للصاحب عمل حالياً.' : 'No client reciprocity reviews yet.'}
                        </div>
                      );
                    }
                    const visible = showAllGodfatherReviews ? filtered : filtered.slice(0, 6);
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {visible.map((review) => (
                            <div 
                              key={review.reviewId} 
                              className="bg-white hover:border-amber-400 border border-gray-150 rounded-2xl overflow-hidden shadow-xs relative flex flex-col justify-between group transition-all"
                            >
                              {review.completedTaskImage && (
                                <div className="h-32 w-full overflow-hidden relative">
                                  <img 
                                    src={review.completedTaskImage} 
                                    alt="Completed Task" 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                  <div className="absolute bottom-2 left-2 bg-amber-400 text-slate-900 px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-0.5 shadow-sm">
                                    {Array.from({ length: review.rating }).map((_, i) => (
                                      <Star key={i} className="w-2.5 h-2.5 fill-slate-900 text-slate-900" />
                                    ))}
                                    <span className="ml-1 font-mono font-bold">{review.rating}.0</span>
                                  </div>
                                </div>
                              )}

                              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-right">
                                <p className="text-xs font-semibold text-slate-600 italic leading-relaxed">
                                  “{review.comment}”
                                </p>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                                    {lang === 'ar' ? 'تقييم متبادل بطلبك' : 'Reciprocal rating'}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <span className="text-[10px] font-black text-[#1F2A44] block">
                                        {review.hunterName}
                                      </span>
                                      <span className="text-[8px] text-gray-400 block font-mono">
                                        {review.createdAt || 'الآن'}
                                      </span>
                                    </div>
                                    <img 
                                      src={review.hunterAvatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=50'} 
                                      alt={review.hunterName} 
                                      className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-200"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {filtered.length > 6 && (
                          <div className="flex justify-center pt-2">
                            <button
                              onClick={() => setShowAllGodfatherReviews(!showAllGodfatherReviews)}
                              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-[#1F2A44] font-black text-xs rounded-xl shadow-xs cursor-pointer select-none transition-all flex items-center gap-1 active:scale-95 border border-slate-200"
                            >
                              <span>{showAllGodfatherReviews ? '⬆️' : '⬇️'}</span>
                              <span>
                                {showAllGodfatherReviews 
                                  ? (lang === 'ar' ? 'عرض أقل' : 'Show Less')
                                  : (lang === 'ar' ? 'عرض المزيد' : 'Show More')}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {activeProfileTab === 'gallery' && (
          <div className="space-y-4 animate-slideUp">
            {/* Dynamic Personal Portfolio Showcase */}
            <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 flex-row-reverse text-right">
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
                    {lang === 'ar' ? 'معرض الصور الشخصية والأعمال 📸' : 'Visual Portfolio snaps'}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-semibold">
                    {lang === 'ar' ? 'صور حقيقية لإنجازاتك ومهاراتك الميدانية موثقة من المعرض مباشرةً' : 'Authentic snapshots of achievements selected directly from your native gallery'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerAddPortfolioPhoto}
                  disabled={portfolioUploading}
                  className="bg-[#4FC3F7]/15 hover:bg-[#4FC3F7]/25 text-[#4FC3F7] font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-xl cursor-pointer transition-all flex items-center gap-1 border-none"
                >
                  {portfolioUploading ? (
                    <span className="animate-pulse">Compressing...</span>
                  ) : (
                    <span>+ {lang === 'ar' ? 'أضف صورة للغاليري' : 'Add Gallery Photo'}</span>
                  )}
                </button>
              </div>

              {portfolioPhotos.length >= 10 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2.5 rounded-2xl text-center font-bold animate-pulse">
                  {lang === 'ar' 
                    ? '⚠️ لقد وصلت للحد الأقصى المسموح به (10 صور) لمعرض أعمالك!' 
                    : '⚠️ You have reached the maximum allowed limit of 10 photos in your portfolio!'}
                </div>
              )}

              {/* Hidden File Input for Native Photo Portfolio picker (simulates picker.pickImage) */}
              <input 
                type="file" 
                ref={portfolioInputRef}
                accept="image/*"
                className="hidden"
                onChange={handlePortfolioFileChange}
              />

              {portfolioUploading && (
                <div className="bg-[#4FC3F7]/5 border border-dashed border-[#4FC3F7]/30 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <div className="flex justify-between w-full max-w-[240px] text-[10px] font-black text-[#4FC3F7]">
                    <span>Quality Pipeline Check: 70% JPEG...</span>
                    <span>{portfolioProgress}%</span>
                  </div>
                  <div className="w-full max-w-[240px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="bg-[#4FC3F7] h-full transition-all duration-150" style={{ width: `${portfolioProgress}%` }}></div>
                  </div>
                </div>
              )}

              {portfolioPhotos.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs font-semibold border border-dashed border-gray-200 rounded-2xl">
                  {lang === 'ar' ? 'معرض فارغ حالياً. اختر صور حقيقية لإبهار أصحاب المشاريع!' : 'Visual portfolio is empty. Upload snaps to secure higher-paying bounties!'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {portfolioPhotos.map((url, idx) => (
                    <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-gray-150 relative group bg-gray-100 shadow-xs">
                      <img 
                        src={url} 
                        alt={`Portfolio sample ${idx}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-zoom-in" 
                        onClick={() => openLightbox(url)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const filtered = portfolioPhotos.filter((_, i) => i !== idx);
                          setPortfolioPhotos(filtered);
                          localStorage.setItem('runner_portfolio_photos', JSON.stringify(filtered));
                          showToast(lang === 'ar' ? '🗑️ تم إزالة الصورة من البورتفوليو!' : '🗑️ Removed portfolio photo!');
                        }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-xl p-1.5 shadow-md active:scale-90 transition-all cursor-pointer opacity-0 group-hover:opacity-100 border-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-2 left-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-[8px] font-bold text-center truncate">
                        {portfolioCaptions[url] || `Snap ${idx + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeProfileTab === 'badges' && (
          <div className="space-y-4 animate-slideUp">
            {/* Display Level Badges */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider text-right">{lang === 'ar' ? 'الشارات التقديرية المكتسبة 🎖️' : 'Your unlocked medals'}</h4>
              {unlockedBadgesObj.length === 0 ? (
                <div className="text-xs text-center text-gray-400 py-6 bg-white border border-gray-150 rounded-2xl font-bold">
                  No medals unlocked yet. Run local tasks to earn trophies!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unlockedBadgesObj.map((badge, idx) => {
                    return (
                      <div key={idx} className="bg-white hover:bg-slate-50/50 p-3.5 rounded-2xl border border-gray-150 flex items-center gap-3 text-right flex-row-reverse">
                        <div className="p-2.5 bg-[#FFD34D]/10 rounded-xl text-amber-600 shrink-0">
                          <Trophy className="w-5 h-5 text-amber-500 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <h5 className="text-xs font-black text-[#1F2A44]">{badge.title}</h5>
                          <p className="text-[10px] text-gray-400 font-semibold leading-normal">{badge.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🛡️ Explicit Camera/NID Access Disclosure Popup Dialog */}
      {showKycDisclosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-150 text-right space-y-4"
          >
            <div className="flex justify-center">
              <div className="p-3.5 bg-[#4FC3F7]/10 rounded-2xl text-[#4FC3F7] animate-bounce">
                <ShieldCheck className="w-8 h-8 text-[#4FC3F7]" />
              </div>
            </div>
            
            <h3 className="text-sm font-black text-[#1F2A44] text-center">
              {lang === 'ar' ? 'طلب موافقة صريحة على الوصول والتوثيق 🔒' : 'Explicit KYC & Camera Consent Required'}
            </h3>
            
            <p className="text-[11px] text-gray-500 leading-relaxed font-bold text-center">
              {lang === 'ar' 
                ? 'التزاماً صارماً بسياسات أمان متجر Google Play لعام 2026 لحق الخصوصية، يرجى تزويدنا بالموافقة المسبقة الصريحة للوصول لقراءة الصورة من كاميرا الهاتف أو معرض الصور بشكل مؤقت ومحلي لتشفير وضغط بطاقة التعريف ومطابقتها لمكافحة الاحتيال المالي الميداني. لن يتم مشاركة بياناتك إطلاقاً مع أي أطراف خارجية وسيتم حفظها ومراجعتها يدوياً عبر المشرفين فقط.'
                : 'In detailed compliance with Google Play 2026 data security directives, we require your explicit prior consent to trigger camera sensors and view gallery objects. This coordinates securely compressed offline matching indices for anti-abuse controls. Your data remains strictly private.'}
            </p>

            <div className="flex gap-2.5 pt-2 font-mono">
              <button
                type="button"
                onClick={handleAcceptDisclosure}
                className="flex-1 py-2.5 bg-[#4FC3F7] hover:bg-[#4FC3F7]/85 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer text-center block"
              >
                {lang === 'ar' ? 'أوافق ومتابعة الوصول ✓' : 'Consent & Access ✓'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowKycDisclosure(false);
                  setPendingKycTrigger(null);
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Deny'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 🛑 Confirm Deletion Modal Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-red-950/40 backdrop-blur-xs p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-red-150 text-right space-y-4"
          >
            <div className="flex justify-center">
              <div className="p-3 bg-red-100 text-red-650 rounded-2xl animate-pulse">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            <h3 className="text-sm font-black text-red-650 text-center">
              {lang === 'ar' ? 'تأكيد الحذف النهائي والأبدي؟ ⚠️' : 'Confirm Permanent Deletion?'}
            </h3>
            
            <p className="text-[11px] text-gray-500 leading-relaxed font-bold text-center">
              {lang === 'ar' 
                ? 'تحذير: هذا الإجراء غير قابل للتراجع عنه نهائياً! سيتم تشفير هويتك كصورة وبصمة، مسح حسابك وصورتك وسيرتك وسجلات مهامك تماماً من قاعدة البيانات وحذف مستنداتك السحابية بالكامل فوراً والالتزام التام بمتطلبات "حق النسيان".'
                : 'Warning: This action is irreversible! All your profile nodes, completed jobs registry, and uploaded national physical photos will be permanently purged to enforce the GDPR/Google Play right to be forgotten.'}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDeleteAccountConfirm}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer text-center"
              >
                {lang === 'ar' ? 'نعم، احذف حسابي ومستنداتي فوراً' : 'Yes, Delete Permanently'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-650 font-extrabold text-xs rounded-xl cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء والتوقف' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 📸 Interactive lightbox zoom modal */}
      <AnimatePresence>
        {lightboxUrl && (
          <div 
            className="fixed inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="absolute top-4 right-4 z-50">
              <button 
                onClick={() => setLightboxUrl(null)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors border-none cursor-pointer text-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-xl w-full text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative group/zoom rounded-2xl overflow-hidden border border-white/15 bg-black">
                <img 
                  src={lightboxUrl} 
                  alt="Zoomed portfolio snap" 
                  className="max-h-[50vh] object-contain mx-auto rounded-xl" 
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Caption and Management Box */}
              <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl text-right flex flex-col gap-3 shadow-2xl">
                {/* Caption Label */}
                <div>
                  <h4 className="text-[10px] text-[#4FC3F7] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 justify-end">
                    <span>{lang === 'ar' ? 'الوصف المرفق بالصورة 📸' : 'Image Caption 📸'}</span>
                  </h4>
                  {!isEditingCaption ? (
                    <p className="text-sm font-bold text-gray-200 leading-relaxed whitespace-pre-line bg-white/5 p-3 rounded-xl min-h-[42px] flex items-center justify-end text-end">
                      {portfolioCaptions[lightboxUrl] || (lang === 'ar' ? 'لا يوجد وصف مضاف لهذه الصورة بعد.' : 'No caption added to this portfolio snap yet.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={tempCaption}
                        onChange={(e) => setTempCaption(e.target.value)}
                        placeholder={lang === 'ar' ? 'اكتب وصفاً أو تعليقاً على هذا العمل الميداني...' : 'Enter a description for this portfolio item...'}
                        className="w-full text-xs font-bold p-3 bg-white/5 border border-white/15 rounded-xl text-white outline-none focus:ring-1 focus:ring-[#4FC3F7] text-right"
                        rows={3}
                        maxLength={250}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setIsEditingCaption(false)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all border-none"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...portfolioCaptions, [lightboxUrl]: tempCaption };
                            setPortfolioCaptions(updated);
                            localStorage.setItem('runner_portfolio_captions', JSON.stringify(updated));
                            setIsEditingCaption(false);
                            showToast(lang === 'ar' ? '✅ تم حفظ الوصف الجديد بنجاح!' : '✅ Caption updated!');
                          }}
                          className="px-4 py-1.5 bg-[#4FC3F7] hover:bg-[#4FC3F7]/90 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all border-none"
                        >
                          {lang === 'ar' ? 'حفظ الوصف' : 'Save Caption'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Interactive Options Row (Edit Caption & Delete Photo) */}
                {!isEditingCaption && (
                  <div className="flex gap-2.5 pt-2 border-t border-white/5 justify-end">
                    {/* Delete Photo Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const filtered = portfolioPhotos.filter(url => url !== lightboxUrl);
                        setPortfolioPhotos(filtered);
                        localStorage.setItem('runner_portfolio_photos', JSON.stringify(filtered));
                        
                        const updatedCaptions = { ...portfolioCaptions };
                        delete updatedCaptions[lightboxUrl];
                        setPortfolioCaptions(updatedCaptions);
                        localStorage.setItem('runner_portfolio_captions', JSON.stringify(updatedCaptions));

                        setLightboxUrl(null);
                        showToast(lang === 'ar' ? '🗑️ تم حذف الصورة نهائياً من معرضك!' : '🗑️ Photo permanently deleted from portfolio!');
                      }}
                      className="flex-1 bg-red-550 hover:bg-red-650 text-white border border-red-500/30 text-rose-100 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف الصورة 🗑' : 'Delete Photo 🗑'}</span>
                    </button>

                    {/* Edit Caption Trigger Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setTempCaption(portfolioCaptions[lightboxUrl] || '');
                        setIsEditingCaption(true);
                      }}
                      className="flex-1 bg-[#4FC3F7]/15 hover:bg-[#4FC3F7] hover:text-white border border-[#4FC3F7]/30 text-[#4FC3F7] py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تعديل الكابشن 📝' : 'Edit Caption 📝'}</span>
                    </button>
                  </div>
                )}
              </div>

              <p className="text-gray-400 text-[10px] font-black">
                {lang === 'ar' ? '🔍 اضغط في أي مكان بالخلفية للعودة للملف الشخصي' : '🔍 Click background outside to return to profile'}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cryptographic Authority Confirmation Popup modal for review deletion */}
      <AnimatePresence>
        {reviewToDelete && (
          <div className="fixed inset-0 bg-[#1F2A44]/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 border border-red-100 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-50 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6 text-[#FF3B7C]" />
              </div>
              
              <h3 className="text-sm font-black uppercase text-[#1F2A44]">
                {lang === 'ar' ? 'سلطة التعديل التامة: تأكيد الحذف' : 'Cryptographic Deletion Query'}
              </h3>
              
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                {lang === 'ar' 
                  ? 'بصفتك المالك الوحيد لهذا الملف الشخصي، تملك الصلاحية التامة لإزالة المراجعات  للأبد. هل تؤكد حذف منشور التقييم من بورتفوليو أعمالك؟' 
                  : 'To preserve complete user data privacy, you possess absolute authority to wipe this review. Do you want to permanently purge it?'}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    if (onDeleteReview && reviewToDelete) {
                      onDeleteReview(reviewToDelete);
                    }
                    setReviewToDelete(null);
                  }}
                  className="bg-[#1F2A44] hover:bg-[#1C283F] text-white font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'نعم، أكد الحذف للأبد' : 'Yes, purge review'}
                </button>
                <button
                  onClick={() => setReviewToDelete(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء الحذف' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Support & Contact Dialog Modal */}
      <AnimatePresence>
        {showSupportForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md p-6 border border-slate-100 shadow-xl space-y-4 text-right font-sans"
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <button 
                  onClick={() => {
                    setShowSupportForm(false);
                    setSupportSubject('');
                    setSupportMessage('');
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
                <h4 className="font-extrabold text-sm text-[#1F2A44] flex items-center gap-1.5 flex-row-reverse">
                  <span>{isRtl ? '📧 تذكرة دعم فني جديدة' : '📧 New Support Ticket'}</span>
                </h4>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                    {isRtl ? 'الموضوع / عنوان المشكلة' : 'Subject / Issue Title'}
                  </label>
                  <input 
                    type="text"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    placeholder={isRtl ? 'أدخل عنواناً للمشكلة...' : 'Enter title...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#1F2A44] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                    {isRtl ? 'تفاصيل المشكلة أو الرسالة' : 'Describe your issue / Message'}
                  </label>
                  <textarea 
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    rows={4}
                    placeholder={isRtl ? 'اشرح بالتفصيل المشكلة التي تواجهها هنا وسيقوم المشرف بالرد عليك عاجلاً...' : 'Tell us what happened...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#1F2A44] transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingSupport}
                  onClick={async () => {
                    if (!supportSubject.trim() || !supportMessage.trim()) {
                      showToast(isRtl ? 'الرجاء ملء كل الحقول المطلوبة' : 'Please complete all fields');
                      return;
                    }
                    setIsSubmittingSupport(true);
                    try {
                      const ticketId = 'TCK-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                      const ticketDoc = {
                        ticketId,
                        userId: userProfile.id,
                        userName: userProfile.name || 'مستخدم مجهول',
                        userEmail: authenticatedUser?.email || userProfile.email || 'بلا إيميل',
                        subject: supportSubject.trim(),
                        message: supportMessage.trim(),
                        status: 'pending',
                        createdAt: new Date().toISOString()
                      };
                      await setDoc(doc(db, 'support_tickets', ticketId), ticketDoc);
                      showToast(isRtl ? '🎉 تم إرسال التذكرة بنجاح! سيقوم فريق الإشراف بمراجعة طلبك.' : '🎉 Support ticket sent successfully!');
                      setShowSupportForm(false);
                      setSupportSubject('');
                      setSupportMessage('');
                    } catch (err: any) {
                      console.error("Support submission error:", err);
                      showToast(isRtl ? '❌ فشل إرسال التذكرة، تأكد من الاتصال' : '❌ Failed to submit support ticket');
                    } finally {
                      setIsSubmittingSupport(false);
                    }
                  }}
                  className="flex-1 bg-[#1F2A44] hover:bg-[#151E33] text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer text-center disabled:opacity-50"
                >
                  {isSubmittingSupport 
                    ? (isRtl ? 'جاري الإرسال السحابي...' : 'Sending...') 
                    : (isRtl ? 'إرسال التذكرة 🚀' : 'Submit Ticket 🚀')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSupportForm(false);
                    setSupportSubject('');
                    setSupportMessage('');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-[#1F2A44] font-black text-xs px-4 py-3 rounded-xl transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
    </PullToRefresh>
  );
}
