/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  INITIAL_USER_PROFILE, 
  INITIAL_QUESTS, 
  INITIAL_LEADERS, 
  INITIAL_CHALLENGES, 
  INITIAL_BADGES,
  INITIAL_HUNTER_REVIEWS,
  INITIAL_GODFATHER_REVIEWS
} from './data/mockData';
import { Quest, UserProfile, UserModel, Leader, Challenge, Badge, ViewState, HunterReview, GodfatherReview, QuestStory } from './types';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { onSnapshot, doc, setDoc, updateDoc, deleteDoc, collection, getDoc, query, where, orderBy, limit, getDocs, increment } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, cleanData } from './utils/firebase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { triggerPhoneDeviceNotification } from './utils/phoneNotifications';
import Navbar from './components/Navbar';
import QuestLogo from './components/QuestLogo';
import HomeView from './components/HomeView';
import MapView from './components/MapView';
import LeaderboardView from './components/LeaderboardView';
import MyQuestsView from './components/MyQuestsView';
import ProfileView from './components/ProfileView';
import AdminView from './components/AdminView';
import PublicProfileView from './components/PublicProfileView';
import ReciprocalRatingModal from './components/ReciprocalRatingModal';
import NotificationScreen, { NotificationDoc } from './components/NotificationScreen';
import InboxScreen from './components/InboxScreen';
import UnifiedQuestCard from './components/UnifiedQuestCard';
import QuestDetailScreen from './components/QuestDetailScreen';
import GlobalCreateQuestModal from './components/GlobalCreateQuestModal';
import TermsConsentModal from './components/TermsConsentModal';
import { motion, AnimatePresence } from 'motion/react';
import { Geolocator } from './utils/geolocator';
import { calculateBookingFee } from './utils/fee';
import AuthScreen from './components/AuthScreen';
import { Lock, CheckCircle2, Star, X, Coins, ShieldX, MessageSquare, Users } from 'lucide-react';

const generateShortId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'QST-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [navigatingQuest, setNavigatingQuest] = useState<Quest | null>(null);
  const [mapSelectedQuest, setMapSelectedQuest] = useState<Quest | null>(null);
  
  // State variables synchronized with localStorage
  const [quests, setQuests] = useState<Quest[]>([]);
  const [stories, setStories] = useState<QuestStory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [hunterReviews, setHunterReviews] = useState<HunterReview[]>([]);
  const [godfatherReviews, setGodfatherReviews] = useState<GodfatherReview[]>([]);
  const [activeRatingQuestId, setActiveRatingQuestId] = useState<string | null>(null);
  const [isLoadingRating, setIsLoadingRating] = useState<boolean>(true);
  const [loadedQuests, setLoadedQuests] = useState<boolean>(false);
  const [loadedHunterReviews, setLoadedHunterReviews] = useState<boolean>(false);
  const [loadedGodfatherReviews, setLoadedGodfatherReviews] = useState<boolean>(false);
  const [selectedPublicProfileId, setSelectedPublicProfileId] = useState<string | null>(null);
  const [deferredActiveChat, setDeferredActiveChat] = useState<any>(null);
  const [activeMessagesChatId, setActiveMessagesChatId] = useState<string | null>(null);
  const [userFlags, setUserFlags] = useState<Record<string, number>>({});
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState<boolean>(false);
  const [splashActive, setSplashActive] = useState<boolean>(true);
  const [splashFadeOut, setSplashFadeOut] = useState<boolean>(false);
  const [animationPhase, setAnimationPhase] = useState<'zoom' | 'shrink' | 'text-fade'>('zoom');

  // Real-time Captain arrival alert state for employers
  const [activeArrivalAlert, setActiveArrivalAlert] = useState<{ id: string; text: string; questId?: string } | null>(null);
  const alertedArrivalIdsRef = React.useRef<Set<string>>(new Set());
  const notifiedDocIdsRef = React.useRef<Set<string>>(new Set());
  const notifiedQuestIdsRef = React.useRef<Set<string>>(new Set());
  const notifiedMsgIdsRef = React.useRef<Set<string>>(new Set());
  const seededHunterRef = React.useRef<boolean>(false);
  const seededGodfatherRef = React.useRef<boolean>(false);
  
  // State variables for GPS Permission Guardrails
  const [isGpsEnabled, setIsGpsEnabled] = useState<boolean>(true);
  const [gpsAlertOpen, setGpsAlertOpen] = useState<boolean>(false);

  // Pre-flight balance check and KYC prompt state
  const [showKycRefillPromptModal, setShowKycRefillPromptModal] = useState<boolean>(false);
  const [requiredRefillFee, setRequiredRefillFee] = useState<number>(0);
  
  // Real-time backend notifications and chats state variables
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [userChats, setUserChats] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [initialSelectedQuestId, setInitialSelectedQuestId] = useState<string | null>(null);
  const [myQuestsActiveTab, setMyQuestsActiveTab] = useState<'obligations' | 'created' | null>(null);
  const [autoOpenCreateQuest, setAutoOpenCreateQuest] = useState<boolean>(false);
  const [profileSubmenu, setProfileSubmenu] = useState<'main' | 'account' | 'verification' | 'wallet' | 'general' | 'support_chat' | null>(null);
  const [showGlobalCreateQuest, setShowGlobalCreateQuest] = useState<boolean>(false);
  const [globalQuestDetailId, setGlobalQuestDetailId] = useState<string | null>(null);
  const [showTermsConsentModal, setShowTermsConsentModal] = useState<boolean>(false);
  const [navigationHistory, setNavigationHistory] = useState<{ view: ViewState; questDetailId: string | null; selectedPublicProfileId: string | null }[]>([]);

  // State variables for the instant payment-before-evaluation safety/lock system
  const [blockedQuestRatings, setBlockedQuestRatings] = useState<Record<string, number>>({});
  const [blockedQuestComments, setBlockedQuestComments] = useState<Record<string, string>>({});
  const [lightboxBlockedImageUrl, setLightboxBlockedImageUrl] = useState<string | null>(null);

  // State for badge local dismissals
  const [homeBadgeDismissed, setHomeBadgeDismissed] = useState(false);
  const [myQuestsBadgeDismissed, setMyQuestsBadgeDismissed] = useState(false);
  const [messagesBadgeDismissed, setMessagesBadgeDismissed] = useState(false);
  const [profileBadgeDismissed, setProfileBadgeDismissed] = useState(false);

  const [prevMatchingQuestsCount, setPrevMatchingQuestsCount] = useState(0);
  const [prevMyQuestsUpdates, setPrevMyQuestsUpdates] = useState(0);
  const [prevUnreadChatsCount, setPrevUnreadChatsCount] = useState(0);
  const [prevProfileUpdates, setPrevProfileUpdates] = useState(0);

  // Synchronize Dark Mode Class (stored in userProfile.privacyEnabled)
  useEffect(() => {
    if (userProfile?.privacyEnabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userProfile?.privacyEnabled]);

  // Synchronize Low Performance Class (stored in userProfile.lowPerformanceModeEnabled)
  useEffect(() => {
    if (userProfile?.lowPerformanceModeEnabled) {
      document.documentElement.classList.add('low-perf');
    } else {
      document.documentElement.classList.remove('low-perf');
    }
  }, [userProfile?.lowPerformanceModeEnabled]);

  // First time login Terms & Privacy consent check
  useEffect(() => {
    if (userProfile && authenticatedUser) {
      const acceptedLocal = localStorage.getItem('terms_accepted_' + userProfile.id);
      const acceptedCloud = (userProfile as any).termsAccepted;
      if (!acceptedLocal && !acceptedCloud) {
        setShowTermsConsentModal(true);
      }
    }
  }, [userProfile, authenticatedUser]);

  const handleAcceptTerms = async () => {
    if (userProfile) {
      try {
        localStorage.setItem('terms_accepted_' + userProfile.id, 'true');
        if (auth.currentUser) {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            termsAccepted: true,
            termsAcceptedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn("Could not save terms consent state:", e);
      }
    }
    setShowTermsConsentModal(false);
    showToast(userProfile?.language === 'ar' ? '✅ تم قبول شروط الاستخدام وسياسة الخصوصية بنجاح!' : '✅ Terms & Privacy Policy accepted!');
  };

  // Register Capacitor Push Notifications and define FCM listener handlers
  useEffect(() => {
    if (!userProfile?.id) return;

    const initPushNotifications = async () => {
      if (!Capacitor.isNativePlatform()) {
        console.log('FCM Push notifications: Running on Web Environment. Native listeners are bypassed (Simulation logging active).');
        return;
      }

      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Capacitor Push Notifications: Device permissions were denied.');
          return;
        }

        // Register with Google FCM / Apple APNS channels
        await PushNotifications.register();

        // On successful registration, update user profile document in Firestore
        PushNotifications.addListener('registration', async (token) => {
          console.log('Mobile Push registration succeeded. Captured FCM Token:', token.value);
          try {
            const userRef = doc(db, 'users', userProfile.id);
            await updateDoc(userRef, { fcmToken: token.value });
          } catch (err) {
            console.error('Failed to update fcmToken inside Firestore user doc:', err);
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration fail: ' + JSON.stringify(error));
        });

        // Capture incoming push alert events when app is active (Foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received in foreground:', notification);
          if (notification.title || notification.body) {
            showToast(`🔔 ${notification.title}: ${notification.body}`);
          }
        });

        // Capture incoming action push alerts when background / completely closed (Background)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification selection occurred:', notification);
          const data = notification.notification.data;
          if (data && data.questId) {
            navigateToQuestDetail(data.questId);
          }
        });

        // Capture local phone system notification taps
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          console.log('Local phone notification tapped:', action);
          const extra = action.notification.extra;
          if (extra && extra.questId) {
            navigateToQuestDetail(extra.questId);
          } else {
            setShowNotifications(true);
          }
        });

      } catch (err) {
        console.error('Error during Capacitor push registrations:', err);
      }
    };

    initPushNotifications();
  }, [userProfile?.id]);

  // Unified helper to dispatch mobile notifications
  const sendPushNotification = async (recipientId: string, title: string, body: string, data?: Record<string, string>) => {
    console.log(`[FCM Notification Dispatch Request] Send to ${recipientId}`, { title, body, data });
    
    // Simulate push alert inside app UI if recipient is the current active user
    if (userProfile && recipientId === userProfile.id) {
      showToast(`🔔 ${title}: ${body}`);
    }

    try {
      const recipientDoc = await getDoc(doc(db, 'users', recipientId));
      if (recipientDoc.exists()) {
        const uDoc = recipientDoc.data();
        const token = uDoc?.fcmToken;
        if (token) {
          console.log(`FCM Token detected for reader: ${token}. Invoking server dispatch proxy.`);
          await fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, title, body, data })
          });
        }
      }
    } catch (err) {
      console.warn("FCM dynamic API dispatch rejected or offline:", err);
    }
  };

  const navigateToQuestDetail = (questId: string) => {
    setNavigationHistory(prev => [
      ...prev,
      { view: currentView, questDetailId: globalQuestDetailId, selectedPublicProfileId }
    ]);
    setGlobalQuestDetailId(questId);
    setSelectedPublicProfileId(null);
  };

  const navigateBack = () => {
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setCurrentView(previous.view);
      setGlobalQuestDetailId(previous.questDetailId);
      setSelectedPublicProfileId(previous.selectedPublicProfileId);
    } else {
      setGlobalQuestDetailId(null);
    }
  };

  const handleViewNavigation = async (view: ViewState) => {
    // Rule 1: Allow seamless browsing and map navigation without launch/modal GPS gates
    setCurrentView(view);
    setSelectedPublicProfileId(null);
    setGlobalQuestDetailId(null);
  };
  
  // Real-time hardware GPS level tracking coordinates
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  // Quest Cleanup, Expiration & Extension System task loop
  useEffect(() => {
    const PENDING_QUEST_TIMEOUT = 8 * 60 * 60 * 1000; // 8 Hours
    const ACTIVE_CONTRACT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 Hours

    const intervalId = setInterval(async () => {
      if (!quests || quests.length === 0) return;

      const now = new Date().getTime();
      let hasChanges = false;
      const updatedList = [...quests];

      for (let i = 0; i < updatedList.length; i++) {
        const quest = updatedList[i];

        // Case 1: Pending/Open Quest 8-Hour limit
        if (quest.status === 'open') {
          const createdAtTime = new Date(quest.createdAt).getTime();
          if (now - createdAtTime >= PENDING_QUEST_TIMEOUT) {
            console.log(`Quest ${quest.id} has expired.`);
            
            // Delete from Firestore
            if (auth.currentUser) {
              try {
                await deleteDoc(doc(db, 'quests', quest.id));
              } catch (err) {
                console.error(`Failed to auto-delete expired quest ${quest.id}:`, err);
              }
            }

            // Remove from creator list if creator is the current active user, without token refund
            if (userProfile && quest.creatorId === userProfile.id) {
              if (auth.currentUser) {
                try {
                  await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    tokenBalance: userProfile.tokenBalance,
                    tokens: (userProfile as any).tokens || userProfile.tokenBalance
                  }, { merge: true });
                } catch (e) {
                  console.warn("Could not sync profile expiration DB:", e);
                }
              }

              // Update client profile state (safely decrement count and clear from created lists)
              syncProfile({
                ...userProfile,
                questsCreated: Math.max(0, userProfile.questsCreated - 1),
                createdQuestsIds: userProfile.createdQuestsIds.filter(id => id !== quest.id),
                tokenBalance: userProfile.tokenBalance,
                tokens: (userProfile as any).tokens || userProfile.tokenBalance
              } as any);

              showToast(
                userProfile.language === 'ar'
                  ? `⏰ انتهت صلاحية نشر مهمة "${quest.title}" (8 ساعات). تم سحب المنشور تلقائياً!`
                  : `⏰ Your quest "${quest.title}" has expired (8h deadline). The post has been automatically withdrawn!`
              );
            }
          }
        }

        // Case 2: Active Contract 24-Hour limit
        if (quest.status === 'active' || quest.status === 'booked') {
          const assignTime = quest.assignedAt ? new Date(quest.assignedAt).getTime() : new Date(quest.createdAt).getTime();
          if (now - assignTime >= ACTIVE_CONTRACT_TIMEOUT) {
            console.log(`Contract ${quest.id} has timed out.`);
            
            // Unblock worker availability
            const assignedRunners = quest.assignedRunnerIds && quest.assignedRunnerIds.length > 0
              ? quest.assignedRunnerIds
              : [quest.helperId || quest.assignedRunnerId].filter(Boolean) as string[];

            assignedRunners.forEach(async (runnerId) => {
              if (auth.currentUser) {
                try {
                  await setDoc(doc(db, 'users', runnerId), { isAvailable: true }, { merge: true });
                } catch (err) {
                  console.warn(`Could not reset runner ${runnerId} availability:`, err);
                }
              }
              if (userProfile && runnerId === userProfile.id) {
                syncProfile({
                  ...userProfile,
                  isAvailable: true
                });
              }
            });

            // Update quest status
            const updatedQuest: Quest = {
              ...quest,
              status: 'cancelled_by_timeout'
            };

            if (auth.currentUser) {
              try {
                await setDoc(doc(db, 'quests', quest.id), cleanData(updatedQuest));
              } catch (e) {
                console.error(`Failed to update quest ${quest.id} status to timeout cancelled:`, e);
              }
            } else {
              updatedList[i] = updatedQuest;
              hasChanges = true;
            }

            if (userProfile && (quest.creatorId === userProfile.id || assignedRunners.includes(userProfile.id))) {
              showToast(
                userProfile.language === 'ar'
                  ? `⏰ تم إلغاء عقد العمل لمهمة "${quest.title}" تلقائياً لتجاوز الموعد النهائي (24 ساعة).`
                  : `⏰ Contract for "${quest.title}" canceled automatically due to timeout (24 hours deadline).`
              );
            }
          }
        }
      }

      if (hasChanges && !auth.currentUser) {
        setQuests(updatedList);
        localStorage.setItem('quest_app_quests', JSON.stringify(updatedList));
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [quests, userProfile]);

  // Listen to Geolocator status shifts via event listener without continuous polling loops
  useEffect(() => {
    const handleGpsSync = async () => {
      const enabled = await Geolocator.isLocationServiceEnabled();
      setIsGpsEnabled(enabled);
    };
    handleGpsSync();

    const handleGpsStatusEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.enabled === 'boolean') {
        setIsGpsEnabled(detail.enabled);
      }
    };
    window.addEventListener('gps_status_changed', handleGpsStatusEvent);
    return () => {
      window.removeEventListener('gps_status_changed', handleGpsStatusEvent);
    };
  }, []);

  // Simulation notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Admin: Broadcast platform messages and updates to all users via sticky bar!
  const [globalBroadcast, setGlobalBroadcast] = useState<string | null>(null);

  // Internet Connection Status Banner State
  const [realConnectionStatus, setRealConnectionStatus] = useState<'online' | 'weak' | 'offline'>(() => {
    if (typeof window !== 'undefined') {
      if (!navigator.onLine) return 'offline';
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn && (
        conn.effectiveType === 'slow-2g' || 
        conn.effectiveType === '2g' || 
        conn.effectiveType === '3g' || 
        (conn.downlink && conn.downlink < 1.5)
      )) {
        return 'weak';
      }
    }
    return 'online';
  });

  const [simulatedConnectionStatus, setSimulatedConnectionStatus] = useState<'online' | 'weak' | 'offline' | null>(null);
  const activeConnectionStatus = simulatedConnectionStatus !== null ? simulatedConnectionStatus : realConnectionStatus;

  const [showConnectionBar, setShowConnectionBar] = useState<boolean>(true);

  // Trigger whenever active status changes
  useEffect(() => {
    setShowConnectionBar(true);
    const timer = setTimeout(() => {
      setShowConnectionBar(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [activeConnectionStatus]);

  // Monitor real-time connection status
  useEffect(() => {
    const updateRealStatus = () => {
      if (!navigator.onLine) {
        setRealConnectionStatus('offline');
        return;
      }
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn && (
        conn.effectiveType === 'slow-2g' || 
        conn.effectiveType === '2g' || 
        conn.effectiveType === '3g' || 
        (conn.downlink && conn.downlink < 1.5)
      )) {
        setRealConnectionStatus('weak');
      } else {
        setRealConnectionStatus('online');
      }
    };

    window.addEventListener('online', updateRealStatus);
    window.addEventListener('offline', updateRealStatus);

    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      conn.addEventListener('change', updateRealStatus);
    }

    return () => {
      window.removeEventListener('online', updateRealStatus);
      window.removeEventListener('offline', updateRealStatus);
      if (conn) {
        conn.removeEventListener('change', updateRealStatus);
      }
    };
  }, []);

  // Google / Firebase Authentication functions
  const handleSignInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showToast('🎉 تم تسجيل الدخول بنجاح عبر حساب Google!');
    } catch (e: any) {
      console.error('Google Sign In Error', e);
      let errMsg = e.message;
      if (e.code === 'auth/operation-not-allowed') {
        errMsg = 'تسجيل الدخول عبر Google غير مفعّل في لوحة تحكم Firebase Console.';
      } else if (e.code === 'auth/network-request-failed') {
        errMsg = 'تعذر الاتصال بالشبكة، يرجى التحقق من اتصال الإنترنت.';
      }
      showToast('⚠️ فشل تسجيل الدخول: ' + errMsg);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('ℹ️ تم تسجيل الخروج من حسابك السحابي.');
    } catch (e: any) {
      console.error('Sign Out Error', e);
    }
  };

  // 1. Initial State bootstrapping and Firebase Authentication/Firestore sync
  useEffect(() => {
    // A. Setup local storage caching fallback loaders
    try {
      const storedFlags = localStorage.getItem('quest_app_user_flags');
      if (storedFlags) setUserFlags(JSON.parse(storedFlags));

      const storedLeaders = localStorage.getItem('quest_app_leaders');
      if (storedLeaders) setLeaders(JSON.parse(storedLeaders));
      else {
        setLeaders(INITIAL_LEADERS);
        localStorage.setItem('quest_app_leaders', JSON.stringify(INITIAL_LEADERS));
      }

      const storedChallenges = localStorage.getItem('quest_app_challenges');
      if (storedChallenges) setChallenges(JSON.parse(storedChallenges));
      else {
        setChallenges(INITIAL_CHALLENGES);
        localStorage.setItem('quest_app_challenges', JSON.stringify(INITIAL_CHALLENGES));
      }

      const storedBadges = localStorage.getItem('quest_app_badges');
      if (storedBadges) setBadges(JSON.parse(storedBadges));
      else {
        setBadges(INITIAL_BADGES);
        localStorage.setItem('quest_app_badges', JSON.stringify(INITIAL_BADGES));
      }
    } catch (e) {
      console.error('Failed mock list loading from LocalStorage', e);
    }

    // B. Realtime Auth state and Firestore synchronization
    let unsubProfile: (() => void) | null = null;
    let unsubQuests: (() => void) | null = null;
    let unsubReviews: (() => void) | null = null;
    let unsubGodfatherReviews: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;
    let unsubChatsOwner: (() => void) | null = null;
    let unsubChatsApplicant: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;
    let unsubStories: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clear legacy listeners first to prevent memory/permissions leaks
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (unsubQuests) { unsubQuests(); unsubQuests = null; }
      if (unsubReviews) { unsubReviews(); unsubReviews = null; }
      if (unsubGodfatherReviews) { unsubGodfatherReviews(); unsubGodfatherReviews = null; }
      if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }
      if (unsubChatsOwner) { unsubChatsOwner(); unsubChatsOwner = null; }
      if (unsubChatsApplicant) { unsubChatsApplicant(); unsubChatsApplicant = null; }
      if (unsubUsers) { unsubUsers(); unsubUsers = null; }
      if (unsubStories) { unsubStories(); unsubStories = null; }

      if (firebaseUser) {
        setAuthenticatedUser(firebaseUser);
        
        // Load cloud documents
        const userRef = doc(db, 'users', firebaseUser.uid);
        let userSnap;
        try {
          userSnap = await getDoc(userRef);
        } catch (err) {
          console.error("Firestore access error on connect:", err);
        }

        let profileToUse: UserProfile;
        const normEmail = (firebaseUser.email || '').toLowerCase().trim();
        const matchesAdmin = normEmail === 'hakerzoldyck@gmail.com';

        if (userSnap && userSnap.exists()) {
          profileToUse = UserModel.fromFirestore(userSnap.data(), firebaseUser.uid);
          
          // Generate and backfill shortId if it is missing
          if (!profileToUse.shortId) {
            const generatedCode = generateShortId();
            profileToUse = {
              ...profileToUse,
              shortId: generatedCode
            };
            try {
              await updateDoc(userRef, { shortId: generatedCode });
            } catch (err) {
              console.error("Failed saving shortId to existing user profile:", err);
            }
          }

          // Dynamically sync and upgrade existing hakerzoldyck@gmail.com profiles in Firestore to secure role
          if (matchesAdmin && (profileToUse.role !== 'admin' || !profileToUse.isAdmin || profileToUse.email !== normEmail)) {
            profileToUse = {
              ...profileToUse,
              isAdmin: true,
              role: 'admin',
              email: normEmail
            };
            try {
              await updateDoc(userRef, {
                isAdmin: true,
                role: 'admin',
                email: normEmail
              });
            } catch (err) {
              console.error("Failed dynamics database promote to admin: ", err);
            }
          } else if (!profileToUse.email && firebaseUser.email) {
            profileToUse.email = normEmail;
            try {
              await updateDoc(userRef, { email: normEmail });
            } catch (err) {
              console.error("Failed saving email to profile: ", err);
            }
          }
        } else {
          profileToUse = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'صياد كويست',
            phone: firebaseUser.phoneNumber || '',
            city: '',
            avatar: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            questsCompleted: 0,
            questsCreated: 0,
            totalPoints: 0,
            tokenBalance: 300,
            rating: 5.0,
            level: 1,
            idVerificationStatus: 'unverified',
            kycRewardClaimed: false,
            completedQuestsIds: [],
            createdQuestsIds: [],
            unlockedBadgeIds: ['badge-welcome'],
            language: 'ar',
            enableNotifications: true,
            privacyEnabled: false,
            audioEffectsEnabled: true,
            hapticFeedbackEnabled: true,
            lowPerformanceModeEnabled: false,
            isAdmin: matchesAdmin,
            role: matchesAdmin ? 'admin' : 'user',
            email: normEmail,
            shortId: generateShortId(),
            bio: '',
          };
          try {
            await setDoc(userRef, cleanData(UserModel.toFirestore(profileToUse)));
          } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, `users/${firebaseUser.uid}`);
          }
        }

        setUserProfile(profileToUse);
        setAuthInitialized(true);

        // Sub 1: Profile listener
        unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(UserModel.fromFirestore(docSnap.data(), firebaseUser.uid));
          }
        }, (e) => handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`));

        // Sub 2: Quests list listener - Optimized with sorting and limit (max 300 active/recent quests)
        const qQuests = query(collection(db, 'quests'), orderBy('createdAt', 'desc'), limit(300));
        unsubQuests = onSnapshot(qQuests, (snap) => {
          const loadedQuestsData: Quest[] = [];

          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const qData = change.doc.data() as Quest;
              const diffMs = Date.now() - new Date(qData.createdAt || Date.now()).getTime();
              // Deliver mobile phone system notification if new quest created recently (< 3 min) and not by me
              if (qData.creatorId !== firebaseUser.uid && diffMs < 180000 && !notifiedQuestIdsRef.current.has(change.doc.id)) {
                notifiedQuestIdsRef.current.add(change.doc.id);
                const qTitle = userProfile?.language === 'ar' ? '🎯 مهمة جديدة متاحة بالقرب منك!' : '🎯 New Quest Available Near You!';
                const qBody = `${qData.title} - المكافأة: ${qData.cashReward || 0} د.ج`;
                triggerPhoneDeviceNotification(qTitle, qBody, { questId: change.doc.id });
              }
            }
          });

          snap.forEach((docSnap) => {
            const id = docSnap.id;
            const data = docSnap.data();
            // Automatically purge legacy mock/trial quests from Firestore to keep DB pure
            if (id.startsWith('q-') && !id.startsWith('q-user-')) {
              deleteDoc(doc(db, 'quests', id)).catch(err => {
                console.warn(`Failed to legacy purge mock quest ${id}:`, err);
              });
            } else {
              loadedQuestsData.push({ ...data, id } as Quest);
            }
          });
          loadedQuestsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          setQuests(loadedQuestsData);
          setLoadedQuests(true);
        }, (e) => {
          handleFirestoreError(e, OperationType.LIST, 'quests');
          setLoadedQuests(true);
        });

        // Sub 3: Reviews list listener - Optimized limit (max 100)
        const qReviews = query(collection(db, 'reviews'), limit(100));
        unsubReviews = onSnapshot(qReviews, (snap) => {
          const loadedReviews: HunterReview[] = [];
          snap.forEach((doc) => {
            loadedReviews.push(doc.data() as HunterReview);
          });
          if (loadedReviews.length > 0) {
            setHunterReviews(loadedReviews);
          } else if (!seededHunterRef.current) {
            seededHunterRef.current = true;
            // Seed reviews
            INITIAL_HUNTER_REVIEWS.forEach(async (initReview) => {
              try {
                await setDoc(doc(db, 'reviews', initReview.reviewId), cleanData(initReview));
              } catch (e) {
                console.error("Firestore review write seed error", e);
              }
            });
            setHunterReviews(INITIAL_HUNTER_REVIEWS);
          }
          setLoadedHunterReviews(true);
        }, (e) => {
          handleFirestoreError(e, OperationType.LIST, 'reviews');
          setLoadedHunterReviews(true);
        });

        // Sub 3b: Godfather reviews list listener - Optimized limit (max 100)
        const qGReviews = query(collection(db, 'godfather_reviews'), limit(100));
        unsubGodfatherReviews = onSnapshot(qGReviews, (snap) => {
          const loadedGReviews: GodfatherReview[] = [];
          snap.forEach((doc) => {
            loadedGReviews.push(doc.data() as GodfatherReview);
          });
          if (loadedGReviews.length > 0) {
            setGodfatherReviews(loadedGReviews);
          } else if (!seededGodfatherRef.current) {
            seededGodfatherRef.current = true;
            INITIAL_GODFATHER_REVIEWS.forEach(async (initGReview) => {
              try {
                await setDoc(doc(db, 'godfather_reviews', initGReview.reviewId), cleanData(initGReview));
              } catch (e) {
                console.error("Firestore godfather review write seed error", e);
              }
            });
            setGodfatherReviews(INITIAL_GODFATHER_REVIEWS);
          }
          setLoadedGodfatherReviews(true);
        }, (e) => {
          handleFirestoreError(e, OperationType.LIST, 'godfather_reviews');
          setLoadedGodfatherReviews(true);
        });

        // Sub 4: Notifications collection subscription
        const qNotifications = query(collection(db, 'notifications'), where('userId', '==', firebaseUser.uid));
        unsubNotifications = onSnapshot(qNotifications, (snap) => {
          const loaded: NotificationDoc[] = [];
          let latestArrival: any = null;

          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data() as NotificationDoc;
              const diffMs = Date.now() - new Date(data.createdAt).getTime();
              // Deliver to phone system tray if unread, created recently (< 3 min), and not yet notified
              if (!data.read && diffMs < 180000 && !notifiedDocIdsRef.current.has(change.doc.id)) {
                notifiedDocIdsRef.current.add(change.doc.id);
                const notifTitle = userProfile?.language === 'ar' ? 'إشعار جديد 🔔' : 'New Notification 🔔';
                triggerPhoneDeviceNotification(notifTitle, data.text, { questId: data.questId, type: data.type });
              }
            }
          });
          
          snap.forEach((doc) => {
            const data = doc.data() as NotificationDoc;
            loaded.push({ ...data, id: doc.id });

            if (data.type === 'arrival' && !data.read && !alertedArrivalIdsRef.current.has(doc.id)) {
              const diffMs = Date.now() - new Date(data.createdAt).getTime();
              if (diffMs < 45000) { // within last 45 seconds
                latestArrival = { ...data, id: doc.id };
                alertedArrivalIdsRef.current.add(doc.id);
              }
            }
          });
          
          loaded.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNotifications(loaded);

          if (latestArrival) {
            import('./utils/audio').then(m => {
              m.playArrivalChime(userProfile?.audioEffectsEnabled !== false);
            });
            setActiveArrivalAlert({
              id: latestArrival.id,
              text: latestArrival.text,
              questId: latestArrival.questId
            });
          }
        }, (e) => console.error("Notifications subscription error:", e));

        // Sub 5: Chats collections subscription
        const qOwnerChats = query(collection(db, 'chats'), where('ownerId', '==', firebaseUser.uid));
        const qApplicantChats = query(collection(db, 'chats'), where('applicantId', '==', firebaseUser.uid));
        const allChatsMap: Record<string, any> = {};

        const updateChatsState = () => {
          const merged = Object.values(allChatsMap).sort((a, b) => {
            const aMsgs = (a as any).messages || [];
            const bMsgs = (b as any).messages || [];
            const aTime = aMsgs.length > 0 ? aMsgs[aMsgs.length - 1].createdAt : "";
            const bTime = bMsgs.length > 0 ? bMsgs[bMsgs.length - 1].createdAt : "";
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          });
          setUserChats(merged);
        };

        unsubChatsOwner = onSnapshot(qOwnerChats, (snap) => {
          snap.docChanges().forEach((change) => {
            const chatData = change.doc.data();
            const msgs = chatData.messages || [];
            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];
              const diffMs = Date.now() - new Date(lastMsg.createdAt || Date.now()).getTime();
              if (lastMsg.senderId !== firebaseUser.uid && lastMsg.senderId !== 'system' && diffMs < 180000 && !notifiedMsgIdsRef.current.has(lastMsg.id)) {
                notifiedMsgIdsRef.current.add(lastMsg.id);
                const msgTitle = `💬 ${lastMsg.senderName || 'رسالة جديدة'}`;
                triggerPhoneDeviceNotification(msgTitle, lastMsg.text, { questId: chatData.questId, chatId: change.doc.id });
              }
            }
          });
          snap.forEach((doc) => {
            allChatsMap[doc.id] = { ...doc.data(), id: doc.id };
          });
          updateChatsState();
        }, (e) => console.error("Chats owner subscription error:", e));

        unsubChatsApplicant = onSnapshot(qApplicantChats, (snap) => {
          snap.docChanges().forEach((change) => {
            const chatData = change.doc.data();
            const msgs = chatData.messages || [];
            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];
              const diffMs = Date.now() - new Date(lastMsg.createdAt || Date.now()).getTime();
              if (lastMsg.senderId !== firebaseUser.uid && lastMsg.senderId !== 'system' && diffMs < 180000 && !notifiedMsgIdsRef.current.has(lastMsg.id)) {
                notifiedMsgIdsRef.current.add(lastMsg.id);
                const msgTitle = `💬 ${lastMsg.senderName || 'رسالة جديدة'}`;
                triggerPhoneDeviceNotification(msgTitle, lastMsg.text, { questId: chatData.questId, chatId: change.doc.id });
              }
            }
          });
          snap.forEach((doc) => {
            allChatsMap[doc.id] = { ...doc.data(), id: doc.id };
          });
          updateChatsState();
        }, (e) => console.error("Chats applicant subscription error:", e));

        // Sub 6: Users collection snapshot for real-time Leaderboard sync - Optimized for >1 Million users with sorting and limit
        const qUsers = query(collection(db, 'users'), orderBy('totalPoints', 'desc'), limit(100));
        unsubUsers = onSnapshot(qUsers, (snap) => {
          const userProfiles: UserProfile[] = [];
          snap.forEach((docSnap) => {
            userProfiles.push(UserModel.fromFirestore(docSnap.data(), docSnap.id));
          });
          
          // Map user profiles to Leaders
          const mappedLeaders = userProfiles
            .filter(profile => !profile.isBanned)
            .map((profile) => {
              const pts = profile.totalPoints || 0;
              let tier: 'Bronze' | 'Silver' | 'Gold' = 'Bronze';
              if (pts >= 1000) tier = 'Gold';
              else if (pts >= 400) tier = 'Silver';
              
              return {
                id: profile.id,
                name: profile.name || 'مستخدم كويست',
                avatar: profile.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                points: pts,
                questsCompleted: profile.questsCompleted || 0,
                rating: profile.rating || 5.0,
                rank: 1, // Will be computed in LeaderboardView based on sorted points
                tier: tier,
                isCurrentUser: profile.id === firebaseUser.uid,
                idVerificationStatus: profile.idVerificationStatus,
                isBanned: profile.isBanned,
                verifiedName: profile.verifiedName,
                verifiedNid: profile.verifiedNid
              } as Leader;
            });
            
          setLeaders(mappedLeaders);
          localStorage.setItem('quest_app_leaders', JSON.stringify(mappedLeaders));
        }, (e) => {
          console.error("Users subscription failed: ", e);
        });

        // Sub 7: Stories collection real-time synchronization - Optimized with sorting and limit (max 50)
        const qStories = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(50));
        unsubStories = onSnapshot(qStories, (snap) => {
          const loadedStories: QuestStory[] = [];
          snap.forEach((docSnap) => {
            loadedStories.push({ ...docSnap.data(), id: docSnap.id } as QuestStory);
          });
          // Sort by createdAt descending
          loadedStories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setStories(loadedStories);
        }, (e) => {
          handleFirestoreError(e, OperationType.LIST, 'stories');
        });

      } else {
        setAuthenticatedUser(null);
        setUserProfile(null);
        setQuests([]);
        setStories([]);
        setNotifications([]);
        setUserChats([]);
        setAuthInitialized(true);
        setLoadedQuests(true);
        setLoadedHunterReviews(true);
        setLoadedGodfatherReviews(true);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
      if (unsubQuests) unsubQuests();
      if (unsubReviews) unsubReviews();
      if (unsubGodfatherReviews) unsubGodfatherReviews();
      if (unsubNotifications) unsubNotifications();
      if (unsubChatsOwner) unsubChatsOwner();
      if (unsubChatsApplicant) unsubChatsApplicant();
      if (unsubUsers) unsubUsers();
      if (unsubStories) unsubStories();
    };
  }, []);

  // Synchronous and Secure Runner Token Deduction:
  // When the runner sees they have an active quest they are assigned to,
  // we deduct the booking fee from their own profile client-side and sync it.
  useEffect(() => {
    if (!userProfile || !auth.currentUser) return;

    // Find all quests where status is active/arrived/pending_verification/completed
    // and this user is the assigned runner.
    const myActiveQuests = quests.filter(q => 
      (q.status === 'active' || q.status === 'arrived' || q.status === 'pending_verification' || q.status === 'completed') && 
      q.assignedRunnerId === userProfile.id
    );

    let profileUpdated = false;
    let newBalance = userProfile.tokenBalance;

    // Get list of already processed/deducted quest IDs from localStorage
    let deductedIds: string[] = [];
    try {
      const stored = localStorage.getItem('deducted_quest_fees');
      if (stored) {
        deductedIds = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error reading deducted_quest_fees:', e);
    }

    myActiveQuests.forEach(q => {
      if (!deductedIds.includes(q.id)) {
        const fee = q.bookingFeeTokens || calculateBookingFee(q.cashReward);
        newBalance = Math.max(0, newBalance - fee);
        deductedIds.push(q.id);
        profileUpdated = true;
      }
    });

    if (profileUpdated) {
      try {
        localStorage.setItem('deducted_quest_fees', JSON.stringify(deductedIds));
        syncProfile({
          ...userProfile,
          tokenBalance: newBalance
        });
        showToast(userProfile.language === 'ar'
          ? '⚡ تم خصم عربون ضمان الجدية والحجز بنجاح للمهمات النشطة.'
          : '⚡ Guarantee booking deposit fee successfully locked for active quests.'
        );
      } catch (err) {
        console.error('Failed to deduct guarantee fee locally: ', err);
      }
    }
  }, [quests, userProfile]);

  // Core Functional Notification Hub helper
  const addNotification = async (userId: string, text: string, questId?: string, type: string = 'info') => {
    const notifTitle = userProfile?.language === 'ar' ? 'إشعار جديد 🔔' : 'New Notification 🔔';

    // 1. Dispatch push notification to recipient's mobile device via FCM
    sendPushNotification(userId, notifTitle, text, { questId: questId || "", type });

    // 2. If the notification recipient is the current active user, trigger local phone system notification immediately
    if (userProfile && userId === userProfile.id) {
      triggerPhoneDeviceNotification(notifTitle, text, { questId, type });
    }

    if (auth.currentUser) {
      try {
        const notifRef = doc(collection(db, 'notifications'));
        const newNotif = {
          id: notifRef.id,
          userId,
          text,
          questId: questId || "",
          createdAt: new Date().toISOString(),
          read: false,
          type
        };
        await setDoc(notifRef, newNotif);
      } catch (e) {
        console.error("Failed creating cloud notification:", e);
      }
    } else {
      // Offline fallback
      try {
        const key = 'local_notifications';
        const stored = localStorage.getItem(key);
        let list: NotificationDoc[] = [];
        if (stored) {
          list = JSON.parse(stored);
        }
        const newNotif: NotificationDoc = {
          id: `local-notif-${Date.now()}`,
          userId,
          text,
          questId: questId || "",
          createdAt: new Date().toISOString(),
          read: false,
          type
        };
        list.unshift(newNotif);
        localStorage.setItem(key, JSON.stringify(list));
        setNotifications(list);
      } catch (err) {
        console.error("Failed creating local notification:", err);
      }
    }
  };

  // 2. Synchronize states with either cloud database (Firestore) or LocalStorage
  const syncQuests = (newQuests: Quest[], deletedId?: string) => {
    if (auth.currentUser) {
      if (deletedId) {
        deleteDoc(doc(db, 'quests', deletedId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `quests/${deletedId}`));
      }
      
      // Surgical Sync Optimization: only setDoc for quests that changed/added compared to internal state
      const changedQuests = newQuests.filter(q => {
        const existingQ = quests.find(prev => prev.id === q.id);
        if (!existingQ) return true; // Brand new quest!
        return existingQ.status !== q.status ||
               existingQ.flagsCount !== q.flagsCount ||
               existingQ.helperId !== q.helperId ||
               existingQ.assignedRunnerId !== q.assignedRunnerId ||
               existingQ.createdAt !== q.createdAt ||
               existingQ.assignedAt !== q.assignedAt ||
               existingQ.extensionRequestedBy !== q.extensionRequestedBy ||
               existingQ.extensionApprovedBy !== q.extensionApprovedBy ||
               (existingQ.applicants?.length !== q.applicants?.length) ||
               existingQ.proofImageUrl !== q.proofImageUrl ||
               existingQ.title !== q.title ||
               existingQ.description !== q.description ||
               existingQ.location !== q.location;
      });

      changedQuests.forEach((q) => {
        setDoc(doc(db, 'quests', q.id), cleanData(q)).catch(e => handleFirestoreError(e, OperationType.WRITE, `quests/${q.id}`));
      });
    } else {
      setQuests(newQuests);
      localStorage.setItem('quest_app_quests', JSON.stringify(newQuests));
    }
  };

  const syncProfile = (newProfile: UserProfile) => {
    let finalProfile = { ...newProfile };
    
    // Auto-reward the invitee +100 tokens on their first completed quest
    if (
      finalProfile.questsCompleted >= 1 &&
      (!userProfile || !userProfile.questsCompleted || userProfile.questsCompleted === 0) &&
      finalProfile.referredBy &&
      !finalProfile.referralRewardClaimed
    ) {
      finalProfile.tokenBalance = (finalProfile.tokenBalance || 0) + 100;
      finalProfile.referralRewardClaimed = true;
      setTimeout(() => {
        showToast(
          finalProfile.language === 'ar'
            ? '🎁 مبروك! حصلت على +100 توكن إضافية لتسجيلك بكود دعوة وإتمام أول مهمة بنجاح!'
            : '🎁 Congrats! You received +100 bonus tokens for joining via referral and finishing your first task successfully!'
        );
      }, 700);
    }

    setUserProfile(finalProfile);
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), cleanData(UserModel.toFirestore(finalProfile)), { merge: true })
        .catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser?.uid}`));
    } else {
      localStorage.setItem('quest_app_profile', JSON.stringify(finalProfile));
    }

    // Leaderboard visual syncing
    const updatedLeaders = leaders.map(leader => {
      if (leader.id === 'user-current' || leader.isCurrentUser || (auth.currentUser && leader.id === auth.currentUser.uid)) {
        return {
          ...leader,
          name: newProfile.name,
          avatar: newProfile.avatar,
          points: newProfile.totalPoints,
          questsCompleted: newProfile.questsCompleted,
          rating: newProfile.rating
        };
      }
      return leader;
    });
    setLeaders(updatedLeaders);
    localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));
  };

  const syncChallenges = (newChallenges: Challenge[]) => {
    setChallenges(newChallenges);
    localStorage.setItem('quest_app_challenges', JSON.stringify(newChallenges));
  };

  const syncBadges = (newBadges: Badge[]) => {
    setBadges(newBadges);
    localStorage.setItem('quest_app_badges', JSON.stringify(newBadges));
  };

  const syncHunterReviews = (newReviews: HunterReview[], deletedId?: string) => {
    if (auth.currentUser) {
      let targetHunterId: string | null = null;
      if (deletedId) {
        targetHunterId = hunterReviews.find(r => r.reviewId === deletedId)?.hunterId || null;
        deleteDoc(doc(db, 'reviews', deletedId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `reviews/${deletedId}`));
      }
      
      // Surgical Sync Optimization: only write reviews that actually changed or are brand new
      const changedReviews = newReviews.filter(r => {
        const existingR = hunterReviews.find(prev => prev.reviewId === r.reviewId);
        if (!existingR) return true; // Brand new review!
        return existingR.rating !== r.rating ||
               existingR.comment !== r.comment ||
               existingR.godfatherName !== r.godfatherName;
      });

      if (changedReviews.length > 0) {
        targetHunterId = changedReviews[0].hunterId;
      }

      changedReviews.forEach((r) => {
        setDoc(doc(db, 'reviews', r.reviewId), cleanData(r)).catch(e => handleFirestoreError(e, OperationType.WRITE, `reviews/${r.reviewId}`));
      });

      // Recalculate average rating for the target helper and update their user document
      if (targetHunterId) {
        const targetId = targetHunterId;
        const helperReviewsForUser = newReviews.filter(r => r.hunterId === targetId);
        const avg = helperReviewsForUser.length > 0
          ? helperReviewsForUser.reduce((sum, r) => sum + r.rating, 0) / helperReviewsForUser.length
          : 5.0;
        
        setDoc(doc(db, 'users', targetId), {
          rating: Number(avg.toFixed(1))
        }, { merge: true }).catch(err => console.warn("Could not update hunter rating in database:", err));
      }
    } else {
      setHunterReviews(newReviews);
      localStorage.setItem('quest_app_hunter_reviews', JSON.stringify(newReviews));
    }
  };

  const syncGodfatherReviews = (newGReviews: GodfatherReview[], deletedId?: string) => {
    if (auth.currentUser) {
      let targetGodfatherId: string | null = null;
      if (deletedId) {
        targetGodfatherId = godfatherReviews.find(r => r.reviewId === deletedId)?.godfatherId || null;
        deleteDoc(doc(db, 'godfather_reviews', deletedId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `godfather_reviews/${deletedId}`));
      }
      const changedReviews = newGReviews.filter(r => {
        const existingR = godfatherReviews.find(prev => prev.reviewId === r.reviewId);
        if (!existingR) return true;
        return existingR.rating !== r.rating ||
               existingR.comment !== r.comment ||
               existingR.hunterName !== r.hunterName;
      });

      if (changedReviews.length > 0) {
        targetGodfatherId = changedReviews[0].godfatherId;
      }

      changedReviews.forEach((r) => {
        setDoc(doc(db, 'godfather_reviews', r.reviewId), cleanData(r)).catch(e => handleFirestoreError(e, OperationType.WRITE, `godfather_reviews/${r.reviewId}`));
      });

      // Recalculate average rating for the target godfather and update their user document
      if (targetGodfatherId) {
        const targetId = targetGodfatherId;
        const reviewsForUser = newGReviews.filter(r => r.godfatherId === targetId);
        const avg = reviewsForUser.length > 0
          ? reviewsForUser.reduce((sum, r) => sum + r.rating, 0) / reviewsForUser.length
          : 5.0;
        
        setDoc(doc(db, 'users', targetId), {
          rating: Number(avg.toFixed(1))
        }, { merge: true }).catch(err => console.warn("Could not update godfather rating in database:", err));
      }
    } else {
      setGodfatherReviews(newGReviews);
      localStorage.setItem('quest_app_godfather_reviews', JSON.stringify(newGReviews));
    }
  };

  const handleSaveHunterReviewFromReciprocal = (newReview: HunterReview) => {
    const updatedReviews = [newReview, ...hunterReviews];
    syncHunterReviews(updatedReviews);
    setActiveRatingQuestId(null);
    showToast(userProfile?.language === 'ar' ? '✅ تم وضع مراجعة العامل بنجاح وتحديث نقاط السمعة!' : '✅ Worker review broadcast successfully and trust rating updated!');
  };

  const handleSaveGodfatherReviewFromReciprocal = (newReview: GodfatherReview) => {
    const updatedGReviews = [newReview, ...godfatherReviews];
    syncGodfatherReviews(updatedGReviews);
    setActiveRatingQuestId(null);
    showToast(userProfile?.language === 'ar' ? '✅ تم وضع تقييم صاحب العمل المتبادل وتكريم العميل بنجاح!' : '✅ Respective Client review broadcast successfully!');
  };

  const handleDeleteHunterReview = (reviewId: string) => {
    const updatedReviews = hunterReviews.filter(r => r.reviewId !== reviewId);
    syncHunterReviews(updatedReviews, reviewId);

    // If we have reviews left for current user, recalculate
    if (userProfile) {
      const myReviews = updatedReviews.filter(r => r.hunterId === userProfile.id);
      const averageRating = myReviews.length > 0 
        ? myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length 
        : 5.0; // fallback default
      syncProfile({
        ...userProfile,
        rating: Number(averageRating.toFixed(1))
      });
    }
    showToast('تم حذف التقييم ومراجعة العمل من ملفك الشخصي بنجاح.');
  };

  // Trigger automatic map navigation routing immediately on successful contract activation
  useEffect(() => {
    if (!userProfile) return;

    const activeQuestAssignedToMe = quests.find(
      q => q.assignedRunnerId === userProfile.id && q.status === 'active'
    );

    if (activeQuestAssignedToMe && (!navigatingQuest || navigatingQuest.id !== activeQuestAssignedToMe.id)) {
      setNavigatingQuest({
        ...activeQuestAssignedToMe,
        status: 'booked' as const // Ensure the MapView treats it as booked/active tracking
      });
      handleViewNavigation('map');
      showToast(userProfile.language === 'ar'
        ? '🚀 تم قبولك في الكويست! الملاحة وتوجيه GPS بدأ تلقائياً.'
        : '🚀 You were accepted for this quest! GPS navigation launched automatically.'
      );
    }
  }, [quests, userProfile, navigatingQuest]);

  // Automatic completed quest reciprocal ratings trigger
  useEffect(() => {
    if (!userProfile) return;
    
    // Only proceed once database snapshots of lists are completed fetching
    if (!loadedQuests || !loadedHunterReviews || !loadedGodfatherReviews) {
      return;
    }
    
    // Find any completed quest that this user hasn't rated yet
    const unratedCompletedQuest = quests.find(q => {
      if (q.status !== 'completed') return false;
      
      const isCreator = q.creatorId === userProfile.id;
      const isRunner = q.helperId === userProfile.id || q.assignedRunnerId === userProfile.id || (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id));
      
      if (isCreator) {
        // Did the creator rate this runner?
        const alreadyRated = hunterReviews.some(r => r.reviewId === `rev-${q.id}`);
        return !alreadyRated;
      } else if (isRunner) {
        // Did the runner rate this creator?
        const alreadyRated = godfatherReviews.some(r => r.reviewId === `g-rev-${q.id}`);
        return !alreadyRated;
      }
      return false;
    });

    if (unratedCompletedQuest) {
      if (activeRatingQuestId !== unratedCompletedQuest.id) {
        setActiveRatingQuestId(unratedCompletedQuest.id);
      }
    } else {
      if (activeRatingQuestId !== null) {
        setActiveRatingQuestId(null);
      }
    }
    
    // Check successfully run to completion
    setIsLoadingRating(false);
  }, [quests, userProfile, hunterReviews, godfatherReviews, activeRatingQuestId, loadedQuests, loadedHunterReviews, loadedGodfatherReviews]);

  // Global listener for open-chat to auto-navigate to messages page
  useEffect(() => {
    const handleOpenChatGlobal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.chatId) {
        setActiveMessagesChatId(detail.chatId);
        setCurrentView('messages');
      }
    };
    window.addEventListener('open-chat', handleOpenChatGlobal);
    return () => window.removeEventListener('open-chat', handleOpenChatGlobal);
  }, []);

  // Global listener for view-public-profile to instantly view a user's account profile
  useEffect(() => {
    const handleViewProfileGlobal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.userId) {
        setSelectedPublicProfileId(detail.userId);
      }
    };
    window.addEventListener('view-public-profile', handleViewProfileGlobal);
    return () => window.removeEventListener('view-public-profile', handleViewProfileGlobal);
  }, []);

  // Set isLoadingRating to false if user is a guest/logged out
  useEffect(() => {
    if (authInitialized && !userProfile) {
      setIsLoadingRating(false);
    }
  }, [authInitialized, userProfile]);

  // Premium entry splash animations and timing controls
  useEffect(() => {
    const minTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 2500);

    const shrinkTimer = setTimeout(() => {
      setAnimationPhase('shrink');
    }, 900);

    const textTimer = setTimeout(() => {
      setAnimationPhase('text-fade');
    }, 1200);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(shrinkTimer);
      clearTimeout(textTimer);
    };
  }, []);

  // Sync splashActive and splashFadeOut turning off
  useEffect(() => {
    if (minTimeElapsed && authInitialized) {
      if (!userProfile || !isLoadingRating) {
        setSplashFadeOut(true);
        const timer = setTimeout(() => {
          setSplashActive(false);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [minTimeElapsed, authInitialized, userProfile, isLoadingRating]);

  // Global listener for manage-quest to auto-navigate to my-quests (created tab)
  useEffect(() => {
    const handleManageQuestGlobal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.questId) {
        setMyQuestsActiveTab('created');
        setInitialSelectedQuestId(detail.questId);
        setNavigationHistory([]);
        setGlobalQuestDetailId(null);
        setMapSelectedQuest(null);
        setSelectedPublicProfileId(null);
        setCurrentView('my-quests');
      }
    };
    window.addEventListener('manage-quest', handleManageQuestGlobal);
    return () => window.removeEventListener('manage-quest', handleManageQuestGlobal);
  }, []);

  // Global listener for navigate-to-quest-map to auto-navigate to map and start navigating a quest
  useEffect(() => {
    const handleNavigateQuestMapGlobal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.quest) {
        const q = detail.quest;
        const isRunner = userProfile && (q.helperId === userProfile.id || q.assignedRunnerId === userProfile.id || (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id)));
        if (isRunner) {
          setNavigatingQuest(q);
        } else {
          setMapSelectedQuest(q);
        }
        handleViewNavigation('map');
        setGlobalQuestDetailId(null);
      }
    };
    window.addEventListener('navigate-to-quest-map', handleNavigateQuestMapGlobal);
    return () => window.removeEventListener('navigate-to-quest-map', handleNavigateQuestMapGlobal);
  }, [userProfile]);

  // Match active challenges that have reached their target but haven't been claimed yet
  const unclaimedChallengesCount = challenges.filter(ch => ch.currentCount >= ch.targetCount).length;
  // Ongoing quests in which the user is helping
  const unreadTasksCount = quests.filter(q => q.helperId === userProfile?.id && q.status === 'ongoing').length;

  // Real-time badge counts for Notification Center and Chat Inbox
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  const unreadChatsCount = userChats.filter(chat => {
    const messages = chat.messages || [];
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.senderId === (userProfile?.id || 'guest')) return false;
    const readBy = chat.readBy || [];
    return !readBy.includes(userProfile?.id || 'guest');
  }).length;

  // Compute matching quests count
  const matchingQuests = quests.filter(q => 
    q.status === 'open' && 
    (Number(q.cashReward) >= 3000 || Number(q.pointsReward) >= 100) && 
    (!userProfile?.city || q.location.toLowerCase().includes(userProfile.city.toLowerCase()))
  );
  const matchingQuestsCount = matchingQuests.length;

  // Compute My Quests notifications and counts
  const questNotifications = notifications.filter(n => 
    !n.read && 
    (n.type === 'applicant' || n.type === 'arrival' || n.type === 'approved' || n.type === 'completed' || n.text.includes('عقد') || n.text.includes('كويست') || n.text.includes('Quest') || n.text.includes('Contract') || n.text.includes('مهمة') || n.text.includes('موافق'))
  );
  const questNotificationsCount = questNotifications.length;
  const totalMyQuestsUpdates = unreadTasksCount + questNotificationsCount;

  // Compute unread chats list
  const unreadChats = userChats.filter(chat => {
    const messages = chat.messages || [];
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.senderId === (userProfile?.id || 'guest')) return false;
    const readBy = chat.readBy || [];
    return !readBy.includes(userProfile?.id || 'guest');
  });

  // Compute profile updates
  const profileNotifications = notifications.filter(n => 
    !n.read && 
    (n.type === 'approved' || n.text.includes('شحن') || n.text.includes('الرصيد') || n.text.includes('refill') || n.text.includes('credited'))
  );
  const profileNotificationsCount = profileNotifications.length;
  const totalProfileUpdates = unclaimedChallengesCount + profileNotificationsCount;

  // Track increases in notifications to reset dismissal
  useEffect(() => {
    if (matchingQuestsCount > prevMatchingQuestsCount) {
      setHomeBadgeDismissed(false);
    }
    setPrevMatchingQuestsCount(matchingQuestsCount);
  }, [matchingQuestsCount]);

  useEffect(() => {
    if (totalMyQuestsUpdates > prevMyQuestsUpdates) {
      setMyQuestsBadgeDismissed(false);
    }
    setPrevMyQuestsUpdates(totalMyQuestsUpdates);
  }, [totalMyQuestsUpdates]);

  useEffect(() => {
    if (unreadChatsCount > prevUnreadChatsCount) {
      setMessagesBadgeDismissed(false);
    }
    setPrevUnreadChatsCount(unreadChatsCount);
  }, [unreadChatsCount]);

  useEffect(() => {
    if (totalProfileUpdates > prevProfileUpdates) {
      setProfileBadgeDismissed(false);
    }
    setPrevProfileUpdates(totalProfileUpdates);
  }, [totalProfileUpdates]);

  // Unified controller to dismiss badges and update database on active view focus
  useEffect(() => {
    if (currentView === 'home') {
      setHomeBadgeDismissed(true);
    } else if (currentView === 'my-quests') {
      setMyQuestsBadgeDismissed(true);
      if (questNotifications.length > 0 && auth.currentUser) {
        import('firebase/firestore').then(({ writeBatch, doc }) => {
          const batch = writeBatch(db);
          questNotifications.forEach(notif => {
            const ref = doc(db, 'notifications', notif.id);
            batch.update(ref, { read: true });
          });
          batch.commit().catch(err => console.error("Error marking quest notifications read in DB:", err));
        });
      }
    } else if (currentView === 'messages') {
      setMessagesBadgeDismissed(true);
      if (unreadChats.length > 0 && auth.currentUser) {
        import('firebase/firestore').then(({ writeBatch, doc, arrayUnion }) => {
          const batch = writeBatch(db);
          unreadChats.forEach(chat => {
            const ref = doc(db, 'chats', chat.id);
            batch.update(ref, { readBy: arrayUnion(userProfile?.id || 'guest') });
          });
          batch.commit().catch(err => console.error("Error marking chats read in DB:", err));
        });
      }
    } else if (currentView === 'profile') {
      setProfileBadgeDismissed(true);
      if (profileNotifications.length > 0 && auth.currentUser) {
        import('firebase/firestore').then(({ writeBatch, doc }) => {
          const batch = writeBatch(db);
          profileNotifications.forEach(notif => {
            const ref = doc(db, 'notifications', notif.id);
            batch.update(ref, { read: true });
          });
          batch.commit().catch(err => console.error("Error marking profile notifications read in DB:", err));
        });
      }
    }
  }, [currentView, matchingQuestsCount, totalMyQuestsUpdates, unreadChatsCount, totalProfileUpdates]);

  const renderSplashContent = () => (
    <div className={`fixed -inset-2 bg-[#0B132B] flex items-center justify-center font-sans px-6 select-none overflow-hidden z-[99999] transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${
      splashFadeOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
    }`}>
      {/* Subtle, luxurious Ambient Glow in the background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-[#FC0D82]/5 blur-[120px] pointer-events-none"></div>

      <div className="relative flex items-center justify-center w-[320px] h-[120px] z-10 select-none pointer-events-none">
        {/* Logo element with Zoom & Shrink/Move animation */}
        <motion.div
          animate={{
            scale: animationPhase === 'zoom' ? 1.6 : 1.0,
            x: animationPhase === 'zoom' ? 0 : -64,
          }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 18,
          }}
          className="absolute flex items-center justify-center shrink-0 select-none pointer-events-none"
        >
          <QuestLogo size="xl" iconOnly={true} />
        </motion.div>

        {/* Staggered Text "Quest" appearing next to the logo on the right */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ 
            opacity: animationPhase === 'text-fade' ? 1 : 0,
            x: animationPhase === 'text-fade' ? 56 : 20
          }}
          transition={{
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1] // professional cubic-bezier ease out
          }}
          className="absolute flex items-center justify-center"
        >
          <span 
            style={{ letterSpacing: '-0.04em' }}
            className="font-sans font-black italic tracking-tighter uppercase select-none text-white text-5xl sm:text-6xl"
          >
            Quest
          </span>
        </motion.div>
      </div>
    </div>
  );

  if (splashActive) {
    return renderSplashContent();
  }

  if (!userProfile) {
    return <AuthScreen showToast={showToast} lang="ar" />;
  }

  // Helper action: Recalculate level up based on points (each 600 points raises a level)
  const calculateLevelForPoints = (points: number) => {
    const calculatedLevel = Math.max(1, Math.floor(points / 600) + 1);
    return calculatedLevel;
  };

  // Helper action: Calculate true geodesic distance using Haversine formula
  const calculateDistanceKmWithCoords = (qLat?: number, qLng?: number, uLat?: number, uLng?: number) => {
    if (typeof qLat !== 'number' || typeof qLng !== 'number' || typeof uLat !== 'number' || typeof uLng !== 'number') return -1;
    const R = 6371; // Earth major radius in km
    const dLat = (qLat - uLat) * Math.PI / 180;
    const dLng = (qLng - uLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(uLat * Math.PI / 180) * Math.cos(qLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    return parseFloat(dist.toFixed(1));
  };

  const calculateDistanceKm = (qLat?: number, qLng?: number) => {
    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') return -1;
    return calculateDistanceKmWithCoords(qLat, qLng, userLoc.lat, userLoc.lng);
  };



  const verifyGpsHardwareAndExecute = async (
    actionType: 'publish' | 'book',
    params: any,
    onPassed: (coords: { lat: number; lng: number }) => void
  ) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLoc(coords);
          Geolocator.saveCachedLocation(coords.lat, coords.lng);
          onPassed(coords);
        },
        (error) => {
          console.warn("Geolocation fallback failed:", error);
          showToast(userProfile?.language === 'ar' ? '⚠️ لا يمكن حجز أو نشر الكويست إلا بعد تفعيل خدمة تحديد الموقع (GPS)' : '⚠️ Cannot book or publish quest without enabling GPS location service');
        },
        {
          enableHighAccuracy: true, // Demands pure physical GPS hardware sensors
          timeout: 15000,
          maximumAge: 10000 // Reuse recent GPS coordinates if under 10 seconds old to save battery/performance
        }
      );
    } else {
      showToast(userProfile?.language === 'ar' ? '⚠️ شغل gps وفقك' : '⚠️ GPS is not supported on this device');
    }
  };

  // --- Stories CRUD operations (Real Firestore Integration) ---
  const handlePublishStory = async (story: Partial<QuestStory>) => {
    if (!userProfile) return;
    try {
      const storyId = story.id || 'story-' + Date.now();
      await setDoc(doc(db, 'stories', storyId), {
        ...story,
        id: storyId,
        userId: userProfile.id,
        user: userProfile.name,
        userAvatar: userProfile.avatar,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `stories/${story.id}`);
    }
  };

  const handleIncrementStoryView = async (storyId: string) => {
    try {
      const storyRef = doc(db, 'stories', storyId);
      const docSnap = await getDoc(storyRef);
      if (docSnap.exists()) {
        const currentViews = docSnap.data().views || 0;
        await updateDoc(storyRef, {
          views: currentViews + 1
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `stories/${storyId}`);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `stories/${storyId}`);
    }
  };

  // Callback 1: Apply for Quest (Multi-Applicant pipeline) - NOW PROTECTED BY HARDWARE GPS ENFORCEMENT
  const handleBookQuest = (questId: string, bookingFee: number) => {
    if (!userProfile) return;

    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    // Calculate dynamic implicit fee: 5% of cashReward (min 35 DA, max 2000 DA)
    const implicitPlatformFee = calculateBookingFee(targetQuest.cashReward);

    if (userProfile.tokenBalance < implicitPlatformFee) {
      setRequiredRefillFee(implicitPlatformFee);
      setShowKycRefillPromptModal(true);
      return;
    }

    if (targetQuest.creatorId === userProfile.id) {
      showToast(userProfile.language === 'ar' 
        ? '⚠️ لا يمكنك التقديم على كويست قمت بنشره بنفسك!' 
        : '⚠️ You cannot apply to your own quests!'
      );
      return;
    }

    const alreadyApplied = targetQuest.applicants?.some(app => app.userId === userProfile.id);
    if (alreadyApplied) {
      showToast(userProfile.language === 'ar' 
        ? '⚠️ لقد قمت بالتقديم على هذا الكويست مسبقاً.' 
        : '⚠️ You already applied to this quest.'
      );
      return;
    }

    // Trigger strict action-based hardware GPS checks before booking is finalized (Rule 3)
    verifyGpsHardwareAndExecute('book', { questId, bookingFee }, (coords) => {
      // Recalculate distance using verified real physical coordinates
      const trueDistance = calculateDistanceKmWithCoords(targetQuest.lat, targetQuest.lng, coords.lat, coords.lng);
      if (trueDistance > 50) {
        showToast(userProfile.language === 'ar'
          ? `📍 هذه المهمة خارج نطاقك الجغرافي المتاح للحجز (المسافة: ${trueDistance} كم، الحد الأقصى: 50 كم)`
          : `📍 This quest is outside your available geographical booking limit (Distance: ${trueDistance}km, Limit: 50km)`
        );
        return;
      }

      const newApplicant = {
        userId: userProfile.id,
        name: userProfile.name,
        avatar: userProfile.avatar,
        rating: userProfile.rating || 5.0,
        questsCompleted: userProfile.questsCompleted || 0,
        phone: userProfile.phone || ''
      };

      const updatedQuests = quests.map(q => {
        if (q.id === questId) {
          return {
            ...q,
            applicants: [...(q.applicants || []), newApplicant]
          };
        }
        return q;
      });

      syncQuests(updatedQuests);

      showToast(userProfile.language === 'ar' 
        ? '✅ تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل ⏳' 
        : '✅ Application submitted successfully.. awaiting creator selection ⏳'
      );

      // Realtime notification alert for owner (chat will unlock after creator accepts)
      addNotification(
        targetQuest.creatorId,
        `تقدم الكابتن ${userProfile.name} لمهمتك ${targetQuest.title}. راجع بروفايله الآن! 👥`,
        targetQuest.id,
        'applicant'
      );
    });
  };

  // Extension System - Rule 1: Manual 8-Hour Pending Quest Extension
  const handleExtendPendingQuest = (questId: string) => {
    if (!userProfile) return;

    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return {
          ...q,
          createdAt: new Date().toISOString() // resets the 8-hour publication countdown
        };
      }
      return q;
    });

    syncQuests(updatedQuests);

    showToast(userProfile.language === 'ar'
      ? '⏰ تم تمديد صلاحية نشر الكويست بنجاح لـ 8 ساعات إضافية!'
      : '⏰ Quest publication validity successfully extended for 8 additional hours!'
    );
  };

  // Extension System - Rule 2: 24-Hour Active Contract Mutual Extension
  const handleExtendActiveContract = (questId: string) => {
    if (!userProfile) return;

    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    const isCreator = targetQuest.creatorId === userProfile.id;
    const runnerId = targetQuest.helperId || targetQuest.assignedRunnerId || targetQuest.assignedRunnerIds?.[0];

    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        // If other party requested it, approve & reset assignedAt to extend contract life for 24h
        if (q.extensionRequestedBy && q.extensionRequestedBy !== userProfile.id) {
          return {
            ...q,
            assignedAt: new Date().toISOString(), // resets 24h timeline
            extensionRequestedBy: null,
            extensionApprovedBy: userProfile.id
          };
        } else {
          // Send request setting current user as the requester
          return {
            ...q,
            extensionRequestedBy: userProfile.id
          };
        }
      }
      return q;
    });

    const isApprovedNow = targetQuest.extensionRequestedBy && targetQuest.extensionRequestedBy !== userProfile.id;

    syncQuests(updatedQuests);

    if (isApprovedNow) {
      // Send real-time notification to the other party
      const otherUserId = isCreator ? runnerId : targetQuest.creatorId;
      if (otherUserId) {
        addNotification(
          otherUserId,
          userProfile.language === 'ar'
            ? `🤝 وافق الطرف الآخر على تمديد عقد المهمة "${targetQuest.title}" لمدة 24 ساعة إضافية!`
            : `🤝 The other party approved extending "${targetQuest.title}" contract for 24 more hours!`,
          targetQuest.id,
          'message'
        );
      }

      showToast(userProfile.language === 'ar'
        ? '🤝 تم الموافقة المتبادلة وتمديد العمل بنجاح لـ 24 ساعة إضافية!'
        : '🤝 Mutual extension approved! Contract successfully extended for 24 hours!'
      );
    } else {
      const otherUserId = isCreator ? runnerId : targetQuest.creatorId;
      if (otherUserId) {
        addNotification(
          otherUserId,
          userProfile.language === 'ar'
            ? `⏳ يطلب الطرف الآخر تمديد مهلة العمل لمهمة "${targetQuest.title}" لـ 24 ساعة إضافية. يرجى المراجعة والموافقة!`
            : `⏳ The other party requested extending "${targetQuest.title}" contract deadline for 24h. Please review & approve!`,
          targetQuest.id,
          'message'
        );
      }

      showToast(userProfile.language === 'ar'
        ? '⏳ تم إرسال طلب التمديد.. بانتظار موافقة الطرف الآخر!'
        : '⏳ Extension request sent.. Awaiting other party approval!'
      );
    }
  };

  // Callback 1.1: Accept applicant and lock the contract (firebase state updates & programmatic notification)
  const handleAcceptApplicant = async (questId: string, applicantId: string) => {
    if (!userProfile) return;

    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    // Calculate implicit platform fee: 5% of cashReward (min 35 DA, max 2000 DA)
    const fee = calculateBookingFee(targetQuest.cashReward);

    // Update locally and inside public profile synced state
    if (applicantId === userProfile.id) {
      syncProfile({
        ...userProfile,
        isAvailable: false,
        tokenBalance: Math.max(0, userProfile.tokenBalance - fee)
      });
    }

    // Update applicant's global status and deduct tokens if possible in Firestore
    try {
      if (applicantId === userProfile.id) {
        await setDoc(doc(db, 'users', applicantId), { 
          isAvailable: false,
          tokenBalance: Math.max(0, userProfile.tokenBalance - fee)
        }, { merge: true });
      } else {
        await setDoc(doc(db, 'users', applicantId), { isAvailable: false }, { merge: true });
      }
    } catch (err) {
      console.warn("Could not set user availability or deduct tokens in DB:", err);
    }

    const selectedApplicant = targetQuest.applicants?.find(app => app.userId === applicantId);

    // Support multi-slot hiring
    const limitCount = targetQuest.requiredWorkerCount || 1;
    const currentAssigned = targetQuest.assignedRunnerIds || [];

    if (currentAssigned.includes(applicantId)) {
      showToast(userProfile.language === 'ar' ? '⚠️ هذا العامل معين بالفعل لهذه المهمة!' : '⚠️ This worker is already assigned to this quest!');
      return;
    }

    const updatedAssigned = [...currentAssigned, applicantId];
    // If we've reached the required limit, mark fully booked
    const isFullyBooked = updatedAssigned.length >= limitCount;

    // Officially bind the runner & activate contract
    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return {
          ...q,
          status: (isFullyBooked ? 'active' : 'open') as any, // Only flip to 'active' once fully booked
          helperId: applicantId, // fallback
          helperName: selectedApplicant?.name || 'صياد كويست',
          helperPhone: selectedApplicant?.phone || '',
          assignedRunnerId: applicantId, // fallback
          assignedRunnerIds: updatedAssigned,
          assignedAt: new Date().toISOString()
        };
      }
      return q;
    });

    syncQuests(updatedQuests);

    // Notify the newly accepted runner via system message
    const approvedChatId = `${questId}_${targetQuest.creatorId}_${applicantId}`;
    
    // Programmatically open chat window directly for immediate live interaction
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-chat', {
        detail: {
          chatId: approvedChatId,
          questTitle: targetQuest.title,
          recipientName: selectedApplicant?.name || 'صياد كويست',
          recipientAvatar: selectedApplicant?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=Runner&backgroundColor=f43f5e'
        }
      }));
    }, 100);
    const noticeText = '🤝 مبروك! لقد تم اختيارك وتفعيل العقد رسمياً لهذه المهمة. الملاحة والعمل الميداني نشط الآن!';
    addNotification(
      applicantId,
      `تم قبول طلبك لمهمة ${targetQuest.title}! افتح الخريطة لبدء التوجيه الميداني الحركي 🛰️`,
      questId,
      'approved'
    );
    sendPushNotification(
      applicantId,
      userProfile.language === 'ar' ? '🎉 تم قبول طلبك!' : '🎉 Bid Accepted!',
      userProfile.language === 'ar' 
        ? `تم قبول طلبك لمهمة "${targetQuest.title}"! افتح الخريطة لبدء التوجيه الميداني.`
        : `You have been selected for "${targetQuest.title}"! Click to view navigation details.`,
      { questId }
    );

    if (auth.currentUser) {
      const chatDocRef = doc(db, 'chats', approvedChatId);
      try {
        const chatSnap = await getDoc(chatDocRef);
        const systemMsg = {
          id: `notice-${Date.now()}`,
          senderId: 'system',
          senderName: 'نظام كويست / System',
          text: noticeText,
          createdAt: new Date().toISOString()
        };

        if (chatSnap.exists()) {
          const chatData = chatSnap.data();
          const currentMessages = chatData.messages || [];
          await setDoc(chatDocRef, {
            ...chatData,
            messages: [...currentMessages, systemMsg]
          }, { merge: true });
        } else {
          // Initialize chat document upon acceptance
          await setDoc(chatDocRef, {
            id: approvedChatId,
            questId,
            questTitle: targetQuest.title,
            ownerId: targetQuest.creatorId,
            ownerName: targetQuest.creatorName,
            ownerAvatar: targetQuest.creatorAvatar,
            applicantId: applicantId,
            applicantName: selectedApplicant?.name || 'صياد كويست',
            applicantAvatar: selectedApplicant?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=Runner&backgroundColor=f43f5e',
            messages: [systemMsg],
            createdAt: new Date().toISOString()
          });
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `chats/${approvedChatId}`);
      }
    } else {
      // Offline fallback
      try {
        const key = `local_chat_${approvedChatId}`;
        const stored = localStorage.getItem(key);
        const systemMsg = {
          id: `notice-${Date.now()}`,
          senderId: 'system',
          senderName: 'نظام كويست / System',
          text: noticeText,
          createdAt: new Date().toISOString()
        };

        if (stored) {
          const parsed = JSON.parse(stored);
          const currentMessages = parsed.messages || [];
          parsed.messages = [...currentMessages, systemMsg];
          localStorage.setItem(key, JSON.stringify(parsed));
        } else {
          const localChatData = {
            id: approvedChatId,
            questId,
            questTitle: targetQuest.title,
            ownerId: targetQuest.creatorId,
            ownerName: targetQuest.creatorName,
            ownerAvatar: targetQuest.creatorAvatar,
            applicantId: applicantId,
            applicantName: selectedApplicant?.name || 'صياد كويست',
            applicantAvatar: selectedApplicant?.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=Runner&backgroundColor=f43f5e',
            messages: [systemMsg],
            createdAt: new Date().toISOString()
          };
          localStorage.setItem(key, JSON.stringify(localChatData));
        }
      } catch (e) {
        console.error('Failed to post local notice info:', e);
      }
    }

    // Dismiss other applicants ONLY if fully booked
    if (isFullyBooked && targetQuest.applicants) {
      targetQuest.applicants.forEach(async (app) => {
        if (updatedAssigned.includes(app.userId)) return; // Already hired for a slot!

        const otherChatId = `${questId}_${targetQuest.creatorId}_${app.userId}`;
        const otherNoticeText = 'عذراً، تم اختيار كابتن آخر لهذه المهمة. بالتوفيق في كويست قادم! 🎯';

        addNotification(
          app.userId,
          `عذراً، تم اختيار كابتن آخر لمهمة ${targetQuest.title}. بالتوفيق في كويست قادم! 🎯`,
          questId,
          'dismissed'
        );
        sendPushNotification(
          app.userId,
          userProfile.language === 'ar' ? '🎯 تحديث حالة الكويست' : '🎯 Quest Status Update',
          userProfile.language === 'ar'
            ? `عذراً، تم اختيار كابتن آخر لمهمة ${targetQuest.title}. بالتوفيق في المرات القادمة!`
            : `Sorry, another captain was selected for ${targetQuest.title}. Wish you luck next time!`,
          { questId }
        );

        if (auth.currentUser) {
          const chatDocRef = doc(db, 'chats', otherChatId);
          try {
            const chatSnap = await getDoc(chatDocRef);
            if (chatSnap.exists()) {
              const chatData = chatSnap.data();
              const currentMessages = chatData.messages || [];
              await setDoc(chatDocRef, {
                ...chatData,
                messages: [
                  ...currentMessages,
                  {
                    id: `notice-${Date.now()}`,
                    senderId: 'system',
                    senderName: 'نظام كويست / System',
                    text: otherNoticeText,
                    createdAt: new Date().toISOString()
                  }
                ]
              }, { merge: true });
            }
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `chats/${otherChatId}`);
          }
        } else {
          // Local storage fallback
          try {
            const key = `local_chat_${otherChatId}`;
            const stored = localStorage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored);
              const currentMessages = parsed.messages || [];
              parsed.messages = [
                ...currentMessages,
                {
                  id: `notice-${Date.now()}`,
                  senderId: 'system',
                  senderName: 'نظام كويست / System',
                  text: otherNoticeText,
                  createdAt: new Date().toISOString()
                }
              ];
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          } catch (e) {
            console.error('Failed to post local dismiss notice:', e);
          }
        }
      });
    }

    showToast(userProfile.language === 'ar'
      ? '🤝 تم قبول الطلب وتفعيل العقد بنجاح!'
      : '🤝 Application approved and contract activated successfully!'
    );
  };

  // Callback 1.2: Arrive at Quest Location (Tactical geofence trigger closure)
  const handleArrivedAtQuest = (questId: string) => {
    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest || !userProfile) return;

    // Security check: Verify that the user is actually the assigned runner for this quest
    const isRunner = targetQuest.helperId === userProfile.id || 
                     targetQuest.assignedRunnerId === userProfile.id || 
                     (targetQuest.assignedRunnerIds && targetQuest.assignedRunnerIds.includes(userProfile.id));

    if (!isRunner) {
      showToast(userProfile.language === 'ar'
        ? '⚠️ لا يمكنك تأكيد الوصول لمهمة لست الكابتن المعين لها!'
        : '⚠️ You cannot confirm arrival for a quest you are not assigned to!'
      );
      return;
    }

    addNotification(
      targetQuest.creatorId,
      `وصل الكابتن ${userProfile.name} إلى موقع المهمة وهو جاهز للتنفيذ 🏁`,
      questId,
      'arrival'
    );

    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return {
          ...q,
          status: 'arrived' as const
        };
      }
      return q;
    });
    
    // Updates firestore & local state
    syncQuests(updatedQuests);

    showToast(userProfile?.language === 'ar' 
      ? '🏁 لقد تم إرسال تنبيه الوصول الميداني بنجاح! تم إخطار صاحب العمل تلقائياً.' 
      : '🏁 Arrival alert dispatched! Freelance publisher notified in real-time.'
    );

    // Dynamic clean-up layout parameters (shuts down track session & OSRM)
    setNavigatingQuest(null);

    // Redirect straight to "عقودي" (My Contracts / obligations tab)
    setCurrentView('my-quests');
  };

  // Callback 1.5: Flag Quest
  const handleFlagQuest = (questId: string) => {
    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        const flaggerList = q.flaggers || [];
        if (!flaggerList.includes(userProfile.id)) {
          const newFlaggers = [...flaggerList, userProfile.id];
          const newFlagsCount = q.flagsCount + 1;
          
          // SCAM SHIELD: If 3 or more community flags accumulate, freeze or warn!
          if (newFlagsCount >= 3) {
            showToast('🚨 تم تجميد العرض تلقائياً بواسطة درع الأمان (Scam Shield) لوجود بلاغات احتيال متعددة!');
          }
          
          return {
            ...q,
            flagsCount: newFlagsCount,
            flaggers: newFlaggers
          };
        }
      }
      return q;
    });
    syncQuests(updatedQuests);
    showToast('شكراً لبلاغك! سيقوم نظام درع الاحتيال بمراجعة هذا العرض وفحصه جلياً.');
  };

  // Callback 2: Deliver and finalize accepted quest, earning cash and points
  const handleCompleteAcceptedQuest = (questId: string) => {
    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    // Mark quest status as completed
    const updatedQuests = quests.map(quest => {
      if (quest.id === questId) {
        return { ...quest, status: 'completed' as const };
      }
      return quest;
    });
    syncQuests(updatedQuests);

    // Archive associated chats also when task is completed
    const associatedChats = userChats.filter(c => c.questId === questId || c.id.startsWith(questId + '_'));
    if (auth.currentUser) {
      associatedChats.forEach(async (chat) => {
        try {
          const chatDocRef = doc(db, 'chats', chat.id);
          await setDoc(chatDocRef, { isArchived: true }, { merge: true });
        } catch (err) {
          console.warn(`Could not archive chat ${chat.id}:`, err);
        }
      });
    } else {
      associatedChats.forEach((chat) => {
        try {
          const key = `local_chat_${chat.id}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.isArchived = true;
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (e) {
          console.error('Failed to archive local chat:', e);
        }
      });
    }

    // Increase user point balance, quests completed numbers, ratings and level calculations
    // Shift primary XP from static tasks to active Quest completion expenditures: Multiply booking fee tokens * 3
    const questTokensCost = targetQuest.bookingFeeTokens || targetQuest.requiredTokens || calculateBookingFee(targetQuest.cashReward || 1000);
    const dynamicXPReward = questTokensCost * 3;
    const updatedPoints = userProfile.totalPoints + dynamicXPReward;
    const updatedCompletedQuestsCount = userProfile.questsCompleted + 1;
    const calculatedLevel = calculateLevelForPoints(updatedPoints);

    // Append completed quest id safely
    const storedCompletedIds = [...userProfile.completedQuestsIds];
    if (!storedCompletedIds.includes(questId)) {
      storedCompletedIds.push(questId);
    }

    // Auto-unlock standard badges based on thresholds
    const unlockedBadgeIds = [...userProfile.unlockedBadgeIds];
    if (updatedCompletedQuestsCount >= 5 && !unlockedBadgeIds.includes('badge-hero-neighborhood')) {
      unlockedBadgeIds.push('badge-hero-neighborhood');
      showToast('🎖️ إنجاز مذهل: لقد فتحت شارة بطل الحي المحنك!');
    }
    // Check if urgent completed
    if (targetQuest.urgency === 'urgent' && !unlockedBadgeIds.includes('badge-speedster')) {
      unlockedBadgeIds.push('badge-speedster');
      showToast('⚡ إنجاز مستعجل: فتحت شارة المنقذ السريع الصاعق!');
    }

    syncProfile({
      ...userProfile,
      totalPoints: updatedPoints,
      questsCompleted: updatedCompletedQuestsCount,
      level: calculatedLevel,
      completedQuestsIds: storedCompletedIds,
      unlockedBadgeIds,
    });

    // Handle Challenge points progression (Points targets update using dynamic HP/XP converted reward)
    const updatedChallenges = challenges.map(challenge => {
      if (challenge.type === 'points') {
        return {
          ...challenge,
          currentCount: Math.min(challenge.targetCount, challenge.currentCount + dynamicXPReward)
        };
      }
      return challenge;
    });
    syncChallenges(updatedChallenges);

    // Free the runner(s) assigned to this quest back to true
    const assignedRunners = targetQuest.assignedRunnerIds && targetQuest.assignedRunnerIds.length > 0
      ? targetQuest.assignedRunnerIds
      : [targetQuest.helperId || targetQuest.assignedRunnerId].filter(Boolean) as string[];

    assignedRunners.forEach(async (runnerId) => {
      try {
        await setDoc(doc(db, 'users', runnerId), { isAvailable: true }, { merge: true });
      } catch (err) {
        console.warn("Could not set runner availability to true:", err);
      }
      
      // Guest fallback if current user is one of the runners
      if (!auth.currentUser && runnerId === userProfile.id) {
        syncProfile({
          ...userProfile,
          isAvailable: true
        });
      }
    });

    showToast(`عمل ممتاز! تم تسليم الخدمة وحساب +${targetQuest.cashReward} ريال مكافأة مالية في رصيدك و +${targetQuest.pointsReward} نقطة شرفية! 🎉`);
  };

  // Callback 2.1: Cancel Booked Quest and refund strictly 30% token fee
  const handleCancelBookedQuest = (questId: string, refundedTokens: number) => {
    const targetQuest = quests.find(q => q.id === questId);
    const refundRate = 0.30;
    const finalRefundTokens = targetQuest 
      ? Math.round(targetQuest.bookingFeeTokens * refundRate) 
      : Math.round(refundedTokens);

    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return {
          ...q,
          status: 'open' as const,
          helperId: undefined,
          helperName: undefined,
          helperPhone: undefined
        };
      }
      return q;
    });
    syncQuests(updatedQuests);

    syncProfile({
      ...userProfile,
      tokenBalance: userProfile.tokenBalance + finalRefundTokens
    });

    showToast(userProfile.language === 'ar' 
      ? `تم إلغاء الحجز بنجاح! تم استيراد ريفاوند 30% بقيمة (${finalRefundTokens} رمز) لمحفظتك.`
      : `Quest booking canceled. Refunded strictly 30% (${finalRefundTokens} tokens) to your wallet.`
    );
  };

  // Callback 2.2: Upload Proof image
  const handleUploadProof = (questId: string, proofUrl: string) => {
    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return {
          ...q,
          status: 'pending_verification' as const,
          proofImageUrl: proofUrl
        };
      }
      return q;
    });
    syncQuests(updatedQuests);
    showToast('تم رفع لقطة الشاشة إثبات تسليم العمل بنجاح ونقله لقيد تفعيل الدفع من صاحب العمل!');
  };

  // Callback 2.3: Confirm payout and complete quest
  const handleConfirmPayout = (questId: string, rating?: number, comment?: string) => {
    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    // Mark quest status as completed
    const updatedQuests = quests.map(quest => {
      if (quest.id === questId) {
        return { ...quest, status: 'completed' as const };
      }
      return quest;
    });
    syncQuests(updatedQuests);

    // Archive associated chats also when task is completed
    const associatedChats = userChats.filter(c => c.questId === questId || c.id.startsWith(questId + '_'));
    if (auth.currentUser) {
      associatedChats.forEach(async (chat) => {
        try {
          const chatDocRef = doc(db, 'chats', chat.id);
          await setDoc(chatDocRef, { isArchived: true }, { merge: true });
        } catch (err) {
          console.warn(`Could not archive chat ${chat.id}:`, err);
        }
      });
    } else {
      associatedChats.forEach((chat) => {
        try {
          const key = `local_chat_${chat.id}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.isArchived = true;
            localStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (e) {
          console.error('Failed to archive local chat:', e);
        }
      });
    }

    // Free the runner(s) assigned to this quest back to true
    const assignedRunners = targetQuest.assignedRunnerIds && targetQuest.assignedRunnerIds.length > 0
      ? targetQuest.assignedRunnerIds
      : [targetQuest.helperId || targetQuest.assignedRunnerId].filter(Boolean) as string[];

    assignedRunners.forEach(async (runnerId) => {
      try {
        await setDoc(doc(db, 'users', runnerId), { isAvailable: true }, { merge: true });
      } catch (err) {
        console.warn("Could not set runner availability to true:", err);
      }
      
      // Guest fallback if current user is one of the runners
      if (!auth.currentUser && runnerId === userProfile.id) {
        syncProfile({
          ...userProfile,
          isAvailable: true
        });
      }
    });

    // Generate Hunter Review
    const finalRating = rating || 5;
    const finalComment = comment || (userProfile && userProfile.lang === 'ar' ? 'عمل ممتاز وسريع للغاية! شكراً جزيلاً.' : 'Excellent work, fast and professional! Highly recommended.');
    const helperId = targetQuest.helperId || 'leader-1';
    const helperName = targetQuest.helperName || 'رشيد بن علي';

    const newReview: HunterReview = {
      reviewId: `rev-${questId}`,
      hunterId: helperId,
      godfatherId: userProfile?.id || 'user-current',
      godfatherName: userProfile?.name || 'صاحب العمل',
      godfatherAvatar: userProfile?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      completedTaskImage: targetQuest.proofImageUrl || (targetQuest.imageUrls && targetQuest.imageUrls[0]) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80',
      rating: finalRating,
      comment: finalComment,
      createdAt: 'الآن بالذات'
    };

    const updatedReviews = [newReview, ...hunterReviews];
    syncHunterReviews(updatedReviews);

    // Recalculate average rating of the helper if helper is current user
    if (helperId === userProfile?.id) {
      const myReviews = updatedReviews.filter(r => r.hunterId === userProfile.id);
      const averageRating = myReviews.reduce((sum, r) => sum + r.rating, 0) / myReviews.length;
      
      // Shift primary XP from static tasks to active Quest completion expenditures: Multiply booking fee tokens * 3
      const questTokensCost = targetQuest.bookingFeeTokens || targetQuest.requiredTokens || calculateBookingFee(targetQuest.cashReward || 1000);
      const dynamicXPReward = questTokensCost * 3;
      const updatedPoints = userProfile.totalPoints + dynamicXPReward;
      const updatedCompletedQuestsCount = userProfile.questsCompleted + 1;
      const calculatedLevel = calculateLevelForPoints(updatedPoints);

      const storedCompletedIds = [...userProfile.completedQuestsIds];
      if (!storedCompletedIds.includes(questId)) {
        storedCompletedIds.push(questId);
      }

      const unlockedBadgeIds = [...userProfile.unlockedBadgeIds];
      if (updatedCompletedQuestsCount >= 5 && !unlockedBadgeIds.includes('badge-hero-neighborhood')) {
        unlockedBadgeIds.push('badge-hero-neighborhood');
      }
      if (targetQuest.urgency === 'urgent' && !unlockedBadgeIds.includes('badge-speedster')) {
        unlockedBadgeIds.push('badge-speedster');
      }

      syncProfile({
        ...userProfile,
        rating: Number(averageRating.toFixed(1)),
        totalPoints: updatedPoints,
        questsCompleted: updatedCompletedQuestsCount,
        level: calculatedLevel,
        completedQuestsIds: storedCompletedIds,
        unlockedBadgeIds
      });
    } else {
      // If another user or mock leader was the helper, raise their score and average rating too!
      const updatedLeaders = leaders.map(leader => {
        if (leader.id === helperId) {
          const leaderReviews = updatedReviews.filter(r => r.hunterId === helperId);
          const averageRating = leaderReviews.reduce((sum, r) => sum + r.rating, 0) / leaderReviews.length;
          return {
            ...leader,
            points: leader.points + targetQuest.pointsReward,
            questsCompleted: leader.questsCompleted + 1,
            rating: Number(averageRating.toFixed(1))
          };
        }
        return leader;
      });
      setLeaders(updatedLeaders);
      localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));

      // Persist the helper's newly added points & completed quests statistics to Cloud Firestore
      if (auth.currentUser) {
        const helperRef = doc(db, 'users', helperId);
        const targetLeader = leaders.find(l => l.id === helperId);
        const addedPts = targetQuest.pointsReward || 150;
        if (targetLeader) {
          const currentPts = targetLeader.points || 0;
          const currentCount = targetLeader.questsCompleted || 0;
          const newPts = currentPts + addedPts;
          const newCount = currentCount + 1;
          
          setDoc(helperRef, {
            totalPoints: newPts,
            questsCompleted: newCount,
            level: calculateLevelForPoints(newPts)
          }, { merge: true }).catch(err => {
            console.warn("Could not update helper points/count in database:", err);
          });
        }
      }

      showToast(`🏆 تم تأكيد تسليم العمل! تم إنشاء "مراجعة بورتفوليو" للعامل [${targetQuest.helperName}].`);
    }
  };

  // Callback 3: Post a brand new local quest - NOW PROTECTED BY HARDWARE GPS
  const handlePostNewQuest = (newQuestData: Partial<Quest>) => {
    verifyGpsHardwareAndExecute('publish', newQuestData, (coords) => {
      const newQuest: Quest = {
        id: `q-user-${Date.now()}`,
        title: newQuestData.title || '',
        description: newQuestData.description || '',
        location: newQuestData.location || '',
        lat: coords.lat,
        lng: coords.lng,
        category: newQuestData.category || 'أخرى',
        cashReward: newQuestData.cashReward || 50,
        pointsReward: newQuestData.pointsReward || 150,
        bookingFeeTokens: calculateBookingFee(newQuestData.cashReward || 1000),
        urgency: newQuestData.urgency || 'normal',
        createdAt: new Date().toISOString(),
        status: 'open',
        flagsCount: 0,
        flaggers: [],
        creatorId: userProfile.id,
        creatorName: userProfile.name,
        creatorPhone: userProfile.phone,
        creatorAvatar: userProfile.avatar,
        imageUrls: newQuestData.imageUrls,
        images: newQuestData.images,
        imageUrl: newQuestData.imageUrl,
      };

      const updatedQuests = [newQuest, ...quests];
      syncQuests(updatedQuests);

      // Update Profile statistics for created list
      const updatedCreatedList = [...userProfile.createdQuestsIds, newQuest.id];
      syncProfile({
        ...userProfile,
        questsCreated: userProfile.questsCreated + 1,
        createdQuestsIds: updatedCreatedList,
      });

      showToast(userProfile?.language === 'ar'
        ? '🚀 كويست منشور بنجاح! تم التقاط موقع GPS الخاص بك وتعميم المهمة على الرانرز المحيطين بك.'
        : '🚀 Quest published successfully! Your validated hardware GPS coordinates have been broadcast to runners around you.'
      );
    });
  };

  // Callback 4: Delete a created Quest (if still available)
  const handleDeleteCreatedQuest = async (questId: string) => {
    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    // No refund amount to prevent free-token exploits since creation did not deduct tokens
    const refundAmount = 0;

    const updatedQuests = quests.filter(q => q.id !== questId);
    syncQuests(updatedQuests, questId);

    // Atomic database update directly into owner's balance
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          tokenBalance: userProfile.tokenBalance,
          tokens: (userProfile as any).tokens || userProfile.tokenBalance
        }, { merge: true });
      } catch (err) {
        console.warn("Could not set user in DB:", err);
      }
    }

    syncProfile({
      ...userProfile,
      questsCreated: Math.max(0, userProfile.questsCreated - 1),
      createdQuestsIds: userProfile.createdQuestsIds.filter(id => id !== questId),
      tokenBalance: userProfile.tokenBalance,
      tokens: (userProfile as any).tokens || userProfile.tokenBalance
    } as any);

    showToast(userProfile.language === 'ar' ? 'تم سحب وإلغاء المنشور بنجاح ✅' : 'The post has been successfully withdrawn and cancelled ✅');
  };

  // Emergency Contract Bypass for Owner
  const handleForceReleaseContract = async (questId: string) => {
    if (!userProfile) return;
    const targetQuest = quests.find(q => q.id === questId);
    if (!targetQuest) return;

    // 1. Change quest status to cancelled
    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return {
          ...q,
          status: 'cancelled' as const
        };
      }
      return q;
    });
    syncQuests(updatedQuests);

    // 2. Unlock the owner's publishing lock on the profile both locally and in Firestore (tokenless!)
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid), {
          hasActiveQuest: false
        }, { merge: true });
      } catch (err) {
        console.warn("Error updating owner profile:", err);
      }
    }
    syncProfile({
      ...userProfile,
      hasActiveQuest: false
    });

    // 3. Reset runner availability
    const runnerId = targetQuest.helperId || targetQuest.assignedRunnerId || (targetQuest.assignedRunnerIds && targetQuest.assignedRunnerIds[0]);
    if (runnerId) {
      try {
        await setDoc(doc(db, 'users', runnerId), { isAvailable: true }, { merge: true });
      } catch (err) {
        console.warn("Could not reset companion availability:", err);
      }
    }

    showToast(userProfile.language === 'ar'
      ? '🚨 تم إلغاء العقد وتحرير حسابك من الحظر بنجاح!'
      : '🚨 Contract has been force released! Locked state cleared from your account!'
    );
  };

  // Callback 5: Edit Quest
  const handleEditQuest = (questId: string, updatedFields: Partial<Quest>) => {
    const updatedQuests = quests.map(q => {
      if (q.id === questId) {
        return { ...q, ...updatedFields } as Quest;
      }
      return q;
    });
    syncQuests(updatedQuests);
    showToast('تم تحديث وحفظ تفاصيل الكويست.');
  };

  // Callback 6: Claim challenge reward points
  const handleClaimChallengePoints = (challengeId: string, reward: number) => {
    const updatedPoints = userProfile.totalPoints + reward;
    const calculatedLevel = calculateLevelForPoints(updatedPoints);

    syncProfile({
      ...userProfile,
      totalPoints: updatedPoints,
      level: calculatedLevel,
    });
  };

  // Callback 7: Buy/Unlock Badge with points
  const handleUnlockBadgeInProfile = (badgeId: string, cost: number) => {
    const unlockedBadgeIds = [...userProfile.unlockedBadgeIds];
    if (!unlockedBadgeIds.includes(badgeId)) {
      unlockedBadgeIds.push(badgeId);
    }

    syncProfile({
      ...userProfile,
      totalPoints: Math.max(0, userProfile.totalPoints - cost),
      unlockedBadgeIds,
    });

    // Update locked status in global badges list
    const updatedBadges = badges.map(b => b.id === badgeId ? { ...b, unlocked: true } : b);
    syncBadges(updatedBadges);
  };

  // Profile Edit updates
  const handleUpdateProfile = (updatedFields: Partial<UserProfile>) => {
    const isAr = (updatedFields.language || userProfile?.language) === 'ar';
    syncProfile({
      ...userProfile,
      ...updatedFields
    });
    showToast(isAr ? '✅ تم حفظ التعديلات والخيارات بنجاح!' : '✅ Profile updates and preferences saved successfully!');
  };

  // Token Refill Top-up simulation
  const handleTopUpTokens = (amount: number) => {
    if (!userProfile) return;
    syncProfile({
      ...userProfile,
      tokenBalance: userProfile.tokenBalance + amount
    });
  };

  // KYC submission simulation
  const handleSubmitKyc = (fullName: string, nidNum: string, customStatus?: 'verified' | 'pending', verifiedName?: string, verifiedNid?: string, idFrontUrl?: string, idBackUrl?: string) => {
    if (!userProfile) return;
    const isApproved = customStatus === 'verified';
    const rewardAmount = isApproved ? 700 : 0;
    
    syncProfile({
      ...userProfile,
      idVerificationStatus: customStatus || 'pending',
      idDocumentUrl: idFrontUrl || idBackUrl || userProfile.idDocumentUrl || '',
      idFrontUrl: idFrontUrl || userProfile.idFrontUrl || '',
      idBackUrl: idBackUrl || userProfile.idBackUrl || '',
      idCardUrl: idFrontUrl || idBackUrl || userProfile.idCardUrl || '',
      kycRewardClaimed: isApproved ? true : userProfile.kycRewardClaimed,
      tokenBalance: userProfile.tokenBalance + rewardAmount,
      verifiedName: verifiedName || fullName,
      verifiedNid: verifiedNid || nidNum
    });
  };

  // Admin: Approve user KYC documentation
  const handleApproveKYC = (userId: string) => {
    if (userId === 'user-current' || (userProfile && userId === userProfile.id)) {
      if (!userProfile) return;
      const updatedBadges = userProfile.unlockedBadgeIds.includes('badge-certified-runner')
        ? userProfile.unlockedBadgeIds
        : [...userProfile.unlockedBadgeIds, 'badge-certified-runner'];
      
      const alreadyClaimed = userProfile.kycRewardClaimed === true;
      const rewardAmount = alreadyClaimed ? 0 : 700;

      syncProfile({
        ...userProfile,
        idVerificationStatus: 'verified',
        tokenBalance: userProfile.tokenBalance + rewardAmount,
        kycRewardClaimed: true,
        unlockedBadgeIds: updatedBadges,
      });
      if (!alreadyClaimed) {
        showToast('Approved user KYC identity! Extra 700 Quest Tokens bonus & Verified Badge unlocked successfully! ⚡🛡️');
      } else {
        showToast('Approved user KYC identity! Verified Badge unlocked successfully! 🛡️');
      }
    } else {
      // Find the user details to compute potential token balances and badges correctly
      const targetLeader = leaders.find(l => l.id === userId);
      const alreadyClaimed = targetLeader ? (targetLeader as any).kycRewardClaimed === true : false;
      const rewardAmount = alreadyClaimed ? 0 : 700;

      const updatedLeaders = leaders.map(leader => {
        if (leader.id === userId) {
          return {
            ...leader,
            idVerificationStatus: 'verified' as const,
            kycRewardClaimed: true,
            tokenBalance: (leader.tokenBalance || 0) + rewardAmount
          };
        }
        return leader;
      });
      setLeaders(updatedLeaders);
      localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));

      // Persist status updates to Cloud Database for full cross-session stability
      if (auth.currentUser) {
        const otherUserRef = doc(db, 'users', userId);
        setDoc(otherUserRef, {
          idVerificationStatus: 'verified',
          kycRewardClaimed: true,
          tokenBalance: targetLeader ? (targetLeader.tokenBalance || 0) + rewardAmount : rewardAmount
        }, { merge: true }).catch(err => {
          console.error("Firestore approve KYC update failed:", err);
        });
      }

      showToast('Approved operator KYC identity verified badge!');
    }
  };

  // Admin: Reject user KYC card
  const handleRejectKYC = (userId: string) => {
    if (userId === 'user-current' || (userProfile && userId === userProfile.id)) {
      if (!userProfile) return;
      syncProfile({
        ...userProfile,
        idVerificationStatus: 'unverified'
      });
      showToast('Rejected KYC application info.');
    } else {
      const updatedLeaders = leaders.map(leader => {
        if (leader.id === userId) {
          return {
            ...leader,
            idVerificationStatus: 'unverified' as const
          };
        }
        return leader;
      });
      setLeaders(updatedLeaders);
      localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));

      // Save rejection update to Cloud Database to reflect status immediately in real-time listeners
      if (auth.currentUser) {
        const otherUserRef = doc(db, 'users', userId);
        setDoc(otherUserRef, {
          idVerificationStatus: 'unverified'
        }, { merge: true }).catch(err => {
          console.error("Firestore reject KYC update failed:", err);
        });
      }

      showToast('Rejected operator KYC application.');
    }
  };

  // Admin: Ban/Freeze user
  const handleBanUser = async (userId: string, isBanned: boolean) => {
    const updatedLeaders = leaders.map(leader => {
      if (leader.id === userId) {
        return {
          ...leader,
          isBanned: isBanned
        };
      }
      return leader;
    });
    setLeaders(updatedLeaders);
    localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));

    // Save user Banned status in Cloud Firestore with token management (zero on ban, restore on unban)
    if (auth.currentUser) {
      const otherUserRef = doc(db, 'users', userId);
      try {
        const userSnap = await getDoc(otherUserRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (isBanned) {
            const currentBalance = Number(userData.tokenBalance) || 0;
            await setDoc(otherUserRef, {
              isBanned: true,
              preBanTokenBalance: currentBalance,
              tokenBalance: 0
            }, { merge: true });
          } else {
            const restoredBalance = Number(userData.preBanTokenBalance) || 0;
            await setDoc(otherUserRef, {
              isBanned: false,
              tokenBalance: restoredBalance,
              preBanTokenBalance: 0
            }, { merge: true });
          }
        } else {
          await setDoc(otherUserRef, {
            isBanned: isBanned,
            tokenBalance: 0,
            preBanTokenBalance: 0
          }, { merge: true });
        }
      } catch (err) {
        console.error("Firestore ban user failed:", err);
      }
    }

    showToast(isBanned ? 'Operator profile has been frozen locked!' : 'Operator profile has been unbanned.');
  };

  // Admin: Delete/moderate post
  const handleDeleteQuest = (questId: string) => {
    const updatedQuests = quests.filter(q => q.id !== questId);
    syncQuests(updatedQuests, questId); // pass second argument to actually delete it from Firestore!
    showToast('Post removed from community feed database successfully.');
  };

  const handleReportUser = (targetUserId: string, reason: string) => {
    const updatedFlags = {
      ...userFlags,
      [targetUserId]: (userFlags[targetUserId] || 0) + 1
    };
    setUserFlags(updatedFlags);
    localStorage.setItem('quest_app_user_flags', JSON.stringify(updatedFlags));

    // Also sync and ban on leaders list if flags >= 3
    if (updatedFlags[targetUserId] >= 3) {
      const updatedLeaders = leaders.map(leader => {
        if (leader.id === targetUserId) {
          return {
            ...leader,
            isBanned: true
          };
        }
        return leader;
      });
      setLeaders(updatedLeaders);
      localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));

      // Persist BAN to Firestore for safety with token management
      if (auth.currentUser) {
        const otherUserRef = doc(db, 'users', targetUserId);
        getDoc(otherUserRef).then(async (userSnap) => {
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentBalance = Number(userData.tokenBalance) || 0;
            await setDoc(otherUserRef, {
              isBanned: true,
              preBanTokenBalance: currentBalance,
              tokenBalance: 0
            }, { merge: true });
          } else {
            await setDoc(otherUserRef, {
              isBanned: true,
              tokenBalance: 0,
              preBanTokenBalance: 0
            }, { merge: true });
          }
        }).catch(err => {
          console.error("Firestore report auto-ban failed:", err);
        });
      }

      showToast(userProfile?.language === 'ar' 
        ? '🚨 تم تجميد حساب هذا العضو تماماً بموجب درع الأمان لتجاوزه ٣ بلاغات احتيال بالمنصة الوطنية!'
        : '🚨 This user profile has been frozen locked by the Scam Shield after receiving 3 community flags!'
      );
    } else {
      showToast(userProfile?.language === 'ar'
        ? `📥 تم تسجيل بلاغك بنجاح! هذا العضو يملك الآن ${updatedFlags[targetUserId]} بلاغات.`
        : `📥 Report filed successfully. This user now has ${updatedFlags[targetUserId]} community flags.`
      );
    }
  };

  const handleBroadcastMessage = (msg: string) => {
    setGlobalBroadcast(msg);
  };

  // Companion Competitor activity simulator!
  const handleSimulateCompetitorActivity = () => {
    // Choose random leader other than user and raise their points
    const nonUserLeaders = leaders.filter(l => l.id !== 'user-current' && !l.isCurrentUser);
    if (nonUserLeaders.length === 0) return;

    const luckyCompetitor = nonUserLeaders[Math.floor(Math.random() * nonUserLeaders.length)];
    const scoreAdd = 50 + Math.round(Math.random() * 80);

    const updatedLeaders = leaders.map(leader => {
      if (leader.id === luckyCompetitor.id) {
        return {
          ...leader,
          points: leader.points + scoreAdd,
          questsCompleted: leader.questsCompleted + 1,
        };
      }
      return leader;
    });

    setLeaders(updatedLeaders);
    localStorage.setItem('quest_app_leaders', JSON.stringify(updatedLeaders));

    showToast(`⚡ تحديث حي: أنجز منافسك [${luckyCompetitor.name}] كويستاً جديداً وباشر مكاسبه بـ +${scoreAdd} نقطة!`);
  };

  const getCleanEmail = (emailStr?: string) => (emailStr || '').trim().toLowerCase();
  const isAdminUser = !!(
    getCleanEmail(authenticatedUser?.email) === 'hakerzoldyck@gmail.com' ||
    authenticatedUser?.role === 'admin' ||
    getCleanEmail(userProfile?.email) === 'hakerzoldyck@gmail.com' ||
    userProfile?.role === 'admin' ||
    userProfile?.isAdmin === true
  );

  const handleOpenArrivalChat = async () => {
    if (!activeArrivalAlert) return;
    const alertId = activeArrivalAlert.id;
    const qId = activeArrivalAlert.questId;
    
    setActiveArrivalAlert(null);

    if (auth.currentUser) {
      try {
        const ref = doc(db, 'notifications', alertId);
        await updateDoc(ref, { read: true });
      } catch (err) {
        console.error("Error marking arrival notification read:", err);
      }
    }

    if (qId) {
      const q = quests.find(item => item.id === qId);
      if (q) {
        const helperId = q.helperId || q.assignedRunnerId || "";
        const helperAvatar = q.applicants?.find(app => app.userId === helperId)?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
        setDeferredActiveChat({
          chatId: `${q.id}_${q.creatorId}_${helperId}`,
          questTitle: q.title,
          recipientName: q.helperName || (userProfile?.language === 'ar' ? 'منفذ المهمة 🏃' : 'Captain 🏃'),
          recipientAvatar: helperAvatar
        });
        
        setMyQuestsActiveTab('created');
        setCurrentView('my-quests');
      }
    }
  };

  const handleDismissArrivalAlert = async () => {
    if (!activeArrivalAlert) return;
    const alertId = activeArrivalAlert.id;
    setActiveArrivalAlert(null);
    
    if (auth.currentUser) {
      try {
        const ref = doc(db, 'notifications', alertId);
        await updateDoc(ref, { read: true });
      } catch (err) {
        console.error("Error marking arrival notification read:", err);
      }
    }
  };

  const pendingVerificationQuests = userProfile 
    ? quests.filter(q => q.creatorId === userProfile.id && q.status === 'pending_verification') 
    : [];

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased relative">
      
      {/* 🔒 Instant Completion-before-Evaluation Block Overlay */}
      {pendingVerificationQuests.length > 0 && (
        <div 
          className="fixed inset-0 bg-slate-900/98 backdrop-blur-md z-[99999] flex flex-col items-center justify-start overflow-y-auto p-4 md:p-8"
          style={{ direction: userProfile?.language === 'ar' ? 'rtl' : 'ltr' }}
        >
          <div className="max-w-xl w-full bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-gray-200/50 dark:border-slate-700 shadow-2xl space-y-6 text-center my-auto">
            
            {/* Warning Lock Header */}
            <div className="space-y-3">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <Lock className="w-8 h-8" />
              </div>
              
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 leading-snug">
                {userProfile?.language === 'ar' 
                  ? '🔒 يجب دفع المكافأة للاستمرار!' 
                  : userProfile?.language === 'fr'
                  ? '🔒 Libérez le paiement pour continuer !'
                  : '🔒 Release Payout to Continue!'}
              </h2>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                {userProfile?.language === 'ar' 
                  ? 'يرجى مراجعة إثبات تسليم العمل أدناه وتقييم المساعد لتحرير مستحقاته وإلغاء القفل فوراً.' 
                  : userProfile?.language === 'fr'
                  ? 'Veuillez vérifier la preuve de travail ci-dessous, évaluer l’assistant pour libérer ses fonds et déverrouiller l’application.'
                  : 'Please check the completion proof below, rate the helper to release funds and unlock the application.'}
              </p>
            </div>

            {/* Quests Pending List */}
            <div className="space-y-4">
              {pendingVerificationQuests.map((quest) => {
                const questRating = blockedQuestRatings[quest.id] || 5;
                const questComment = blockedQuestComments[quest.id] || '';
                
                return (
                  <div 
                    key={quest.id}
                    className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-150/80 dark:border-slate-700 text-start space-y-4"
                  >
                    {/* Quest Title & Reward */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          {quest.category}
                        </span>
                        <h3 className="text-sm font-black text-[#1F2A44] dark:text-slate-100 leading-snug">
                          {quest.title}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                          {quest.cashReward} DA
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold block">
                          {userProfile?.language === 'ar' ? 'المكافأة النقدية' : 'Cash Reward'}
                        </span>
                      </div>
                    </div>

                    {/* Helper Info Section */}
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700/80">
                      <img 
                        src={quest.creatorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                        alt={quest.helperName || 'Helper'} 
                        className="w-10 h-10 rounded-full object-cover border border-amber-300" 
                      />
                      <div className="flex-1">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-none mb-1">
                          {quest.helperName || (userProfile?.language === 'ar' ? 'المساعد المعتمد' : 'Field Helper')}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold leading-none">
                          {userProfile?.language === 'ar' ? 'منفذ الكويست الميداني' : 'Field Quest Performer'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-amber-500 font-black">
                          ★ 5.0
                        </span>
                      </div>
                    </div>

                    {/* Completion Proof Photo Preview with click-to-zoom */}
                    {quest.proofImageUrl && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black text-[#FF3B7C] uppercase tracking-wider block">
                          📸 {userProfile?.language === 'ar' ? 'إثبات الإنجاز المرفوع بواسطة المساعد:' : 'Proof of Completion Uploaded:'}
                        </span>
                        <div 
                          onClick={() => setLightboxBlockedImageUrl(quest.proofImageUrl || null)}
                          className="group relative cursor-pointer overflow-hidden rounded-xl border border-rose-100 dark:border-rose-950/40 bg-black/5 flex items-center justify-center max-h-48 aspect-video"
                        >
                          <img 
                            src={quest.proofImageUrl} 
                            alt="Proof image" 
                            className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200 text-white font-extrabold text-xs">
                            🔍 {userProfile?.language === 'ar' ? 'عرض مكبّر لإثبات التسليم' : 'Click to Zoom Proof'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Star Rating Evaluator */}
                    <div className="space-y-1.5 text-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700/80">
                      <span className="text-[10px] font-black text-[#1F2A44] dark:text-slate-300 block">
                        {userProfile?.language === 'ar' ? 'قيم أداء المساعد واكتب كلمة تقييم:' : 'Rate helper performance & write a comment:'}
                      </span>
                      <div className="flex items-center justify-center gap-1.5 py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setBlockedQuestRatings(prev => ({ ...prev, [quest.id]: star }))}
                            className="transition-transform active:scale-90 hover:scale-110 cursor-pointer p-0.5"
                          >
                            <Star 
                              className={`w-7 h-7 ${
                                star <= questRating 
                                  ? 'text-amber-400 fill-amber-400 drop-shadow-xs' 
                                  : 'text-gray-200 dark:text-gray-700'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={questComment}
                        onChange={(e) => setBlockedQuestComments(prev => ({ ...prev, [quest.id]: e.target.value }))}
                        placeholder={userProfile?.language === 'ar' ? 'اكتب كلمة شكر أو تعليقاً... (مثال: بطل أمين، عمل سريع ومتقن!)' : 'Write feedback... (e.g. Awesome speed & great results!)'}
                        className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-700 rounded-lg font-bold focus:outline-none text-slate-800 dark:text-slate-100"
                        rows={2}
                      />
                    </div>

                    {/* Submit Payout release Button */}
                    <button
                      onClick={() => {
                        handleConfirmPayout(quest.id, questRating, questComment);
                        showToast(userProfile?.language === 'ar' ? '💸 تم الدفع للمساعد بنجاح وتقييمه، تم إلغاء القفل بنجاح!' : '💸 Payout confirmed & helper reviewed! App unblocked successfully.');
                      }}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs py-3.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4.5 h-4.5 text-white" />
                      <span>
                        {userProfile?.language === 'ar' ? 'تأكيد إتمام العمل وتحرير الأموال للمساعد 💸' : 'Confirm Completion & Release Cash 💸'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🔍 Dynamic Blocked Image Lightbox zoom */}
      {lightboxBlockedImageUrl && (
        <div 
          className="fixed inset-0 bg-black/95 z-[999999] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxBlockedImageUrl(null)}
        >
          <div className="max-w-3xl w-full max-h-[85vh] relative" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxBlockedImageUrl} alt="Zoomed Proof" className="w-full h-full object-contain rounded-2xl" />
            <button 
              onClick={() => setLightboxBlockedImageUrl(null)}
              className="absolute -top-12 right-0 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      {/* Toast alert popup indicator */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-20 right-4 left-4 md:right-8 md:left-8 z-50 bg-slate-900/95 backdrop-blur-xs border border-emerald-500 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center justify-between text-xs font-bold leading-relaxed shadow-emerald-950/20"
          >
            <div className="flex-1 text-center md:text-right">
              {toastMessage}
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="px-2 text-[10px] text-gray-400 hover:text-white font-extrabold mr-3 cursor-pointer"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Notification Center Slide-over Overlay */}
      <AnimatePresence>
        {showNotifications && (
          <NotificationScreen 
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
            onNotificationClick={(notif) => {
              setShowNotifications(false);
              const type = notif.type;
              const questId = notif.questId;

              if (type === 'message') {
                if (questId && userProfile) {
                  const questToNav = quests.find(q => q.id === questId);
                  if (questToNav) {
                    // Determine the partner ID
                    const partnerId = (userProfile.id === questToNav.creatorId) 
                      ? (questToNav.helperId || questToNav.assignedRunnerId || (questToNav.assignedRunnerIds && questToNav.assignedRunnerIds[0])) 
                      : questToNav.creatorId;
                    if (partnerId) {
                      const computedChatId = `${questId}_${questToNav.creatorId}_${partnerId}`;
                      setActiveMessagesChatId(computedChatId);
                    }
                  }
                }
                setCurrentView('messages');
              } else if (type === 'applicant' || type === 'arrival') {
                if (questId) {
                  setMyQuestsActiveTab('created');
                  setCurrentView('my-quests');
                  navigateToQuestDetail(questId);
                }
              } else if (type === 'approved') {
                if (questId) {
                  setMyQuestsActiveTab('obligations');
                  setCurrentView('my-quests');
                  navigateToQuestDetail(questId);
                  
                  const questToNav = quests.find(q => q.id === questId);
                  if (questToNav) {
                    setNavigatingQuest(questToNav);
                  }
                }
              } else if (type === 'dismissed') {
                setMyQuestsActiveTab('obligations');
                setCurrentView('my-quests');
              } else if (type === 'comment') {
                if (questId) {
                  navigateToQuestDetail(questId);
                }
              } else {
                if (questId) {
                  const questToNav = quests.find(q => q.id === questId);
                  if (questToNav && userProfile) {
                    const isCreator = questToNav.creatorId === userProfile.id;
                    if (isCreator) {
                      setMyQuestsActiveTab('created');
                      setCurrentView('my-quests');
                    } else {
                      setMyQuestsActiveTab('obligations');
                      setCurrentView('my-quests');
                    }
                    navigateToQuestDetail(questId);
                  }
                }
              }
            }}
            onViewQuest={(questId) => {
              setShowNotifications(false);
              if (questId) {
                const questToNav = quests.find(q => q.id === questId);
                if (questToNav && userProfile) {
                  const isCreator = questToNav.creatorId === userProfile.id;
                  if (isCreator) {
                    setMyQuestsActiveTab('created');
                    setCurrentView('my-quests');
                  } else {
                    setMyQuestsActiveTab('obligations');
                    setCurrentView('my-quests');
                  }
                  navigateToQuestDetail(questId);
                }
              }
            }}
          />
        )}
      </AnimatePresence>



      {/* Dynamic Member Profile Inspection Full Screen View */}
      <AnimatePresence>
        {selectedPublicProfileId && (
          <motion.div 
            id="public-profile-backdrop"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            className="fixed inset-0 bg-slate-50 z-[120] overflow-y-auto flex flex-col"
          >
            <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:px-6 md:py-10 flex-1 flex flex-col">
              <div className="bg-white border border-gray-100/80 rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xl shadow-slate-100/50 flex-1 flex flex-col">
                <PublicProfileView 
                  userId={selectedPublicProfileId}
                  currentUser={userProfile}
                  leaders={leaders}
                  quests={quests}
                  hunterReviews={hunterReviews}
                  godfatherReviews={godfatherReviews}
                  lang={userProfile?.language || 'ar'}
                  onReportUser={handleReportUser}
                  onClose={() => setSelectedPublicProfileId(null)}
                  showToast={showToast}
                  userFlags={userFlags}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Internet Connection Status Bar */}
      <AnimatePresence>
        {showConnectionBar && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 right-0 left-0 z-30 border-b py-2.5 px-4 flex items-center justify-between gap-3 shadow-md backdrop-blur-md transition-all duration-300 ${
              activeConnectionStatus === 'offline'
                ? 'bg-rose-50/95 border-rose-200 text-rose-700'
                : activeConnectionStatus === 'weak'
                ? 'bg-amber-50/95 border-amber-200 text-amber-700'
                : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                activeConnectionStatus === 'offline'
                  ? 'bg-rose-500'
                  : activeConnectionStatus === 'weak'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`} />
              <span className="text-[11px] font-extrabold leading-relaxed">
                {activeConnectionStatus === 'offline' && (
                  userProfile?.language === 'ar' ? '🔴 لا يوجد اتصال بالإنترنت - يرجى التحقق من الشبكة' : '🔴 No internet connection - please check your network'
                )}
                {activeConnectionStatus === 'weak' && (
                  userProfile?.language === 'ar' ? '⚠️ الاتصال بالإنترنت ضعيف - قد تواجه بعض البطء' : '⚠️ Connection is weak - you may experience some lag'
                )}
                {activeConnectionStatus === 'online' && (
                  userProfile?.language === 'ar' ? '🟢 متصل بالإنترنت بنجاح - الخدمة مستقرة' : '🟢 Successfully connected - service is stable'
                )}
              </span>
            </div>

            <button 
              onClick={() => setShowConnectionBar(false)}
              className="text-gray-400 hover:text-gray-600 px-1 font-black shrink-0 cursor-pointer text-xs"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Global Broadcast bulletin and announcement stream */}
      {globalBroadcast && (
        <div className="fixed top-16 right-0 left-0 bg-slate-100 border-b border-gray-200 py-2.5 px-4 z-30 flex items-center justify-between text-[11px] font-extrabold text-[#1F2A44] leading-relaxed shadow-sm">
          <span className="flex-1 text-[#1F2A44] truncate">{globalBroadcast}</span>
          <button 
            onClick={() => setGlobalBroadcast(null)}
            className="text-[#FF3B7C] hover:text-[#FF3B7C]/80 px-2 font-black shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Bottom aligned navigation frame */}
      <Navbar 
        currentView={currentView}
        onViewChange={(view) => {
          setShowNotifications(false);
          setSelectedPublicProfileId(null);
          setGlobalQuestDetailId(null);
          handleViewNavigation(view);
        }}
        onNavigateToProfileSubmenu={(submenu) => {
          setProfileSubmenu(submenu);
          setCurrentView('profile');
        }}
        unclaimedChallengesCount={profileBadgeDismissed ? 0 : unclaimedChallengesCount}
        unreadTasksCount={myQuestsBadgeDismissed ? 0 : unreadTasksCount}
        tokenBalance={userProfile.tokenBalance}
        lang={userProfile.language}
        isAdmin={isAdminUser}
        audioEnabled={userProfile.audioEffectsEnabled !== false}
        unreadNotificationsCount={showNotifications ? 0 : unreadNotificationsCount}
        unreadChatsCount={messagesBadgeDismissed ? 0 : unreadChatsCount}
        onBellClick={async () => {
          setShowNotifications(prev => !prev);
          setSelectedPublicProfileId(null);
          setGlobalQuestDetailId(null);
          
          // Instantly mark all notifications as read when bell clicked
          const unreadNotifs = notifications.filter(n => !n.read);
          if (unreadNotifs.length > 0 && auth.currentUser) {
            // Optimistic local update
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            
            try {
              const { writeBatch, doc } = await import('firebase/firestore');
              const batch = writeBatch(db);
              unreadNotifs.forEach((notif) => {
                const ref = doc(db, 'notifications', notif.id);
                batch.update(ref, { read: true });
              });
              await batch.commit();
            } catch (err) {
              console.error("Error marking all read on bell click:", err);
            }
          }
        }}
        userProfile={userProfile}
        quests={homeBadgeDismissed ? [] : quests}
        notifications={notifications.map(n => {
          let updatedRead = n.read;
          if (myQuestsBadgeDismissed) {
            const isQuestNotif = (n.type === 'applicant' || n.type === 'arrival' || n.type === 'approved' || n.type === 'completed' || n.text.includes('عقد') || n.text.includes('كويست') || n.text.includes('Quest') || n.text.includes('Contract') || n.text.includes('مهمة') || n.text.includes('موافق'));
            if (isQuestNotif) updatedRead = true;
          }
          if (profileBadgeDismissed) {
            const isProfileNotif = (n.type === 'approved' || n.text.includes('شحن') || n.text.includes('الرصيد') || n.text.includes('refill') || n.text.includes('credited'));
            if (isProfileNotif) updatedRead = true;
          }
          return { ...n, read: updatedRead };
        })}
        onTriggerCreateQuest={() => {
          const activeCount = userProfile?.hasActiveQuest === false ? 0 : quests.filter(q => q.creatorId === userProfile?.id && q.status !== 'completed' && q.status !== 'cancelled' && q.status !== 'cancelled_by_timeout' && q.status !== 'stale_cleared').length;
          if (activeCount > 0) {
            alert(
              userProfile?.language === 'ar'
                ? 'لا يمكنك نشر أكثر من مهمة واحدة نشطة في نفس الوقت ⚠️'
                : userProfile?.language === 'fr'
                ? "Vous ne pouvez publier qu'une seule tâche active à la fois ⚠️"
                : 'You can only have one active published quest at a time ⚠️'
            );
            return;
          }
          setShowGlobalCreateQuest(true);
        }}
      />

      {/* Main Scroll Content Area */}
      <main className={currentView === 'messages' && !globalQuestDetailId ? "w-full max-w-none px-0 pt-16 pb-[72px]" : "max-w-5xl mx-auto px-4 md:px-8 pt-28 pb-28 md:pb-32"}>
        <h2 className="sr-only">محتوى صفحة كويست الرئيسي</h2>
        <AnimatePresence mode="wait">
          <motion.div
            key={globalQuestDetailId ? `quest-detail-${globalQuestDetailId}` : currentView}
            initial={{ 
              opacity: 0, 
              x: globalQuestDetailId ? (userProfile?.language === 'ar' ? -50 : 50) : 0, 
              y: globalQuestDetailId ? 0 : 12 
            }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ 
              opacity: 0, 
              x: globalQuestDetailId ? (userProfile?.language === 'ar' ? 50 : -50) : 0, 
              y: globalQuestDetailId ? 0 : -12 
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* View Switching logic with dynamic stack-based router */}
            {globalQuestDetailId ? (
              <QuestDetailScreen
                questId={globalQuestDetailId}
                quests={quests}
                userProfile={userProfile!}
                userLoc={userLoc}
                onBack={navigateBack}
                onBookQuest={(questId, tokenFee) => {
                  handleBookQuest(questId, tokenFee);
                }}
                onStartNavigation={(q) => {
                  const isRunner = userProfile && (q.helperId === userProfile.id || q.assignedRunnerId === userProfile.id || (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id)));
                  const isCreator = userProfile && q.creatorId === userProfile.id;
                  if (isRunner) {
                    setNavigatingQuest(q);
                    handleViewNavigation('map');
                    setGlobalQuestDetailId(null);
                  } else if (isCreator) {
                    setMapSelectedQuest(q);
                    handleViewNavigation('map');
                    setGlobalQuestDetailId(null);
                  } else {
                    showToast(userProfile?.language === 'ar' ? '⚠️ لا يمكنك فتح الخريطة أو تتبع الموقع حتى تقوم بحجز المهمة أولاً!' : '⚠️ You cannot open the map or view location until you book the quest first!');
                  }
                }}
                onOpenChat={(chatParams) => {
                  const openChatEvent = new CustomEvent('open-chat', {
                    detail: chatParams
                  });
                  window.dispatchEvent(openChatEvent);
                }}
                onManageQuest={(questId) => {
                  setMyQuestsActiveTab('created');
                  setInitialSelectedQuestId(questId);
                  setNavigationHistory([]);
                  setGlobalQuestDetailId(null);
                  setMapSelectedQuest(null);
                  setSelectedPublicProfileId(null);
                  setCurrentView('my-quests');
                }}
                onViewPublicProfile={(userId) => setSelectedPublicProfileId(userId)}
                onExtendPendingQuest={handleExtendPendingQuest}
                onExtendActiveContract={handleExtendActiveContract}
                showToast={showToast}
              />
            ) : (
              <>
                {userProfile?.isBanned && (currentView === 'home' || currentView === 'map' || currentView === 'my-quests') ? (
                  <div className="bg-white border-2 border-red-500 rounded-3xl p-8 max-w-2xl mx-auto my-8 text-center space-y-6 shadow-xl" style={{ direction: userProfile.language === 'ar' ? 'rtl' : 'ltr' }}>
                    <div className="inline-flex p-4 bg-red-50 rounded-full text-red-500 animate-pulse">
                      <ShieldX className="w-16 h-16" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-black text-red-600">
                        {userProfile.language === 'ar' ? '🚫 تم تجميد حسابك مؤقتاً!' : '🚫 Your Account has been Suspended!'}
                      </h2>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        {userProfile.language === 'ar' 
                          ? 'لقد تم تجميد حسابك من قبل الإدارة لمراجعة الأنشطة أو بسبب شكاوى أو اشتباه في مخالفة قوانين المنصة. لحماية مجتمع كويست، تم منع حسابك من تصفح المويستات أو حجزها.'
                          : 'Your account has been frozen by the administration due to safety reviews, disputes, or policy violations. To protect the Quest community, you are currently blocked from viewing or booking quests.'}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-150 space-y-2 text-right">
                      <h4 className="text-xs font-black text-[#1F2A44] flex items-center gap-1.5 justify-start">
                        <span>💡 {userProfile.language === 'ar' ? 'ما يمكنك فعله الآن:' : 'What you can do now:'}</span>
                      </h4>
                      <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
                        <li>{userProfile.language === 'ar' ? 'مراسلة الدعم الفني مباشرة لتقديم التماس فك التجميد.' : 'Contact Technical Support immediately to submit an appeal.'}</li>
                        <li>{userProfile.language === 'ar' ? 'تعديل أو مراجعة معلومات حسابك الشخصي والتحقق من الهوية.' : 'Review or update your personal identity profile & KYC details.'}</li>
                      </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileSubmenu('support_chat');
                          setCurrentView('profile');
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-6 py-3 rounded-xl transition-all shadow-md cursor-pointer border-none flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{userProfile.language === 'ar' ? '💬 مراسلة الدعم الفني (تقديم التماس)' : '💬 Direct Support Appeal'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileSubmenu('main');
                          setCurrentView('profile');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs px-6 py-3 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-2"
                      >
                        <Users className="w-4 h-4" />
                        <span>{userProfile.language === 'ar' ? '👤 الذهاب للملف الشخصي' : '👤 Go to Profile'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {currentView === 'home' && (
                      <HomeView 
                        quests={quests}
                        stories={stories}
                        onPublishStory={handlePublishStory}
                        onIncrementStoryView={handleIncrementStoryView}
                        onDeleteStory={handleDeleteStory}
                        userProfile={userProfile}
                        lang={userProfile.language}
                        onBookQuest={handleBookQuest}
                        onFlagQuest={handleFlagQuest}
                        showToast={showToast}
                        onViewPublicProfile={setSelectedPublicProfileId}
                        setQuests={syncQuests}
                        setStories={setStories}
                        initialSelectedQuestId={initialSelectedQuestId}
                        onClearInitialSelectedQuest={() => setInitialSelectedQuestId(null)}
                        onViewQuestDetail={navigateToQuestDetail}
                        onUpdateProfile={syncProfile}
                        onTriggerCreateQuest={() => {
                          setCurrentView('my-quests');
                          setAutoOpenCreateQuest(true);
                        }}
                        onViewChange={setCurrentView}
                        onStartNavigation={(q) => {
                          const isRunner = userProfile && (q.helperId === userProfile.id || q.assignedRunnerId === userProfile.id || (q.assignedRunnerIds && q.assignedRunnerIds.includes(userProfile.id)));
                          const isCreator = userProfile && q.creatorId === userProfile.id;
                          if (isRunner) {
                            setNavigatingQuest(q);
                            setCurrentView('map');
                          } else if (isCreator) {
                            setMapSelectedQuest(q);
                            setCurrentView('map');
                          } else {
                            showToast(userProfile?.language === 'ar' ? '⚠️ لا يمكنك فتح الخريطة أو تتبع الموقع حتى تقوم بحجز المهمة أولاً!' : '⚠️ You cannot open the map or view location until you book the quest first!');
                          }
                        }}
                      />
                    )}

                    {currentView === 'map' && (
                      <MapView 
                        quests={quests}
                        userProfile={userProfile}
                        lang={userProfile.language}
                        onBookQuest={handleBookQuest}
                        showToast={showToast}
                        navigatingQuest={navigatingQuest}
                        setNavigatingQuest={setNavigatingQuest}
                        onArrivedAtQuest={handleArrivedAtQuest}
                        onViewQuestDetail={navigateToQuestDetail}
                        onManageQuest={(questId) => {
                          setMyQuestsActiveTab('created');
                          setInitialSelectedQuestId(questId);
                          setNavigationHistory([]);
                          setGlobalQuestDetailId(null);
                          setMapSelectedQuest(null);
                          setSelectedPublicProfileId(null);
                          setCurrentView('my-quests');
                        }}
                        onExtendPendingQuest={handleExtendPendingQuest}
                        onExtendActiveContract={handleExtendActiveContract}
                        mapSelectedQuest={mapSelectedQuest}
                        setMapSelectedQuest={setMapSelectedQuest}
                        onCloseMap={() => {
                          setCurrentView('home');
                        }}
                        setQuests={syncQuests}
                      />
                    )}

                    {currentView === 'my-quests' && (
                      <MyQuestsView 
                        quests={quests}
                        currentUserId={userProfile.id}
                        userProfile={userProfile}
                        lang={userProfile.language}
                        onPostNewQuest={handlePostNewQuest}
                        onDeleteCreatedQuest={handleDeleteCreatedQuest}
                        onCancelBookedQuest={handleCancelBookedQuest}
                        onUploadProof={handleUploadProof}
                        onConfirmPayout={handleConfirmPayout}
                        onAcceptApplicant={handleAcceptApplicant}
                        onForceReleaseContract={handleForceReleaseContract}
                        onViewPublicProfile={(userId) => setSelectedPublicProfileId(userId)}
                        deferredActiveChat={deferredActiveChat}
                        onClearDeferredChat={() => setDeferredActiveChat(null)}
                        initialTab={myQuestsActiveTab}
                        onClearInitialTab={() => setMyQuestsActiveTab(null)}
                        onViewQuestDetail={navigateToQuestDetail}
                        initialSelectedQuestId={initialSelectedQuestId}
                        onClearInitialSelectedQuest={() => setInitialSelectedQuestId(null)}
                        onSendPushNotification={sendPushNotification}
                        autoOpenCreate={autoOpenCreateQuest}
                        onClearAutoOpenCreate={() => setAutoOpenCreateQuest(false)}
                        setQuests={syncQuests}
                        onArrivedAtQuest={handleArrivedAtQuest}
                      />
                    )}
                  </>
                )}

                {currentView === 'profile' && (
                  <ProfileView 
                    userProfile={userProfile}
                    badges={badges}
                    lang={userProfile.language}
                    onUpdateProfile={handleUpdateProfile}
                    onTopUpTokens={handleTopUpTokens}
                    onSubmitKYC={handleSubmitKyc}
                    showToast={showToast}
                    hunterReviews={hunterReviews}
                    godfatherReviews={godfatherReviews}
                    onDeleteReview={handleDeleteHunterReview}
                    authenticatedUser={authenticatedUser}
                    onSignInWithGoogle={handleSignInWithGoogle}
                    onSignOut={handleSignOut}
                    onViewChange={setCurrentView}
                    leaders={leaders}
                    challenges={challenges}
                    onUnlockBadge={handleUnlockBadgeInProfile}
                    onClaimChallengePoints={handleClaimChallengePoints}
                    onSimulateActivity={handleSimulateCompetitorActivity}
                    quests={quests}
                    initialSubmenu={profileSubmenu}
                    onClearInitialSubmenu={() => setProfileSubmenu(null)}
                  />
                )}

                {currentView === 'messages' && (
                  <InboxScreen 
                    userChats={userChats}
                    quests={quests}
                    onClose={() => setCurrentView('home')}
                    currentUserId={userProfile.id}
                    userProfile={userProfile}
                    lang={userProfile.language}
                    onOpenChat={(chatId) => {
                      const questId = chatId.split('_')[0];
                      navigateToQuestDetail(questId);
                    }}
                    isFullPageView={true}
                    onInspectUser={(userId) => setSelectedPublicProfileId(userId)}
                    initialChatId={activeMessagesChatId}
                    onClearInitialChatId={() => setActiveMessagesChatId(null)}
                    setUserChats={setUserChats}
                    onSendPushNotification={sendPushNotification}
                  />
                )}

                {currentView === 'admin' && (
                  isAdminUser ? (
                    <AdminView 
                      userProfile={userProfile}
                      quests={quests}
                      leaders={leaders}
                      lang={userProfile.language}
                      onApproveKYC={handleApproveKYC}
                      onRejectKYC={handleRejectKYC}
                      onBanUser={handleBanUser}
                      onDeleteQuest={handleDeleteQuest}
                      onBroadcastMessage={handleBroadcastMessage}
                      showToast={showToast}
                      onInspectQuest={(questId) => setGlobalQuestDetailId(questId)}
                    />
                  ) : (
                    <div className="bg-white border-2 border-red-500 rounded-3xl p-8 text-center space-y-4 shadow-md max-w-md mx-auto my-12 font-sans" style={{ direction: userProfile.language === 'ar' ? 'rtl' : 'ltr' }}>
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-red-600 text-3xl">⚠️</span>
                      </div>
                      <h3 className="text-lg font-black text-red-600">غير مصرح بالدخول | Access Denied</h3>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                        هذه الصفحة مخصصة للمشرفين فقط. يرجى تسجيل الدخول بحساب مشرف معتمد للوصول للميزات الإدارية.
                      </p>
                    </div>
                  )
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {/* Pre-flight Balance Fee Check Warning / KYC Incentives Prompt Modal */}
        {showKycRefillPromptModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[12000]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-150 text-right space-y-4"
              style={{ direction: userProfile?.language === 'ar' ? 'rtl' : 'ltr' }}
            >
              <div className="flex justify-center">
                <div className="p-3.5 bg-amber-50 text-amber-500 rounded-3xl animate-pulse text-center flex items-center justify-center">
                  <span className="text-3xl">⚠️</span>
                </div>
              </div>

              <h3 className="text-sm font-black text-slate-800 text-center">
                {userProfile?.language === 'ar' 
                  ? 'رصيد الرموز غير كافٍ لحجز العقد! ⚖️' 
                  : 'Insufficient Token Balance to Reserve Contract'}
              </h3>

              <div className="space-y-3">
                <p className="text-[11px] text-gray-500 leading-relaxed font-bold text-center">
                  {userProfile?.language === 'ar'
                    ? `رصيدك الحالي هو (${userProfile?.tokenBalance || 0} توكن)، بينما تبلغ «رسوم التحقق والضمان وحماية المنصة» لهذه المهمة (${requiredRefillFee} توكن) لضمان التزام معايير متجر Google Play لمنع الاحتيال.`
                    : `Your token balance is (${userProfile?.tokenBalance || 0} tokens), whereas the «Platform guarantee & validation safety fee» is (${requiredRefillFee} tokens) to satisfy dynamic Google Play data integrity conditions.`}
                </p>

                <p className="text-[11px] text-[#4FC3F7] font-extrabold bg-[#4FC3F7]/5 p-3 rounded-2xl border border-[#4FC3F7]/20 text-center leading-relaxed">
                  {userProfile?.language === 'ar'
                    ? '💡 نصيحة مجانية: يمكنك توثيق هويتك (KYC) فوراً لكسب 700 توكن مجانية، أو شحن محفظتك مباشرة لتأمين المهمة.'
                    : '💡 Smart Tip: Verify your identity (KYC) for free to earn +700 welcome tokens immediately, or add tokens to your wallet.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowKycRefillPromptModal(false);
                    setCurrentView('profile');
                  }}
                  className="w-full py-2.5 bg-[#4FC3F7] hover:bg-[#4FC3F7]/85 text-white font-black text-xs rounded-xl shadow-md cursor-pointer text-center"
                >
                  {userProfile?.language === 'ar' ? '🛡️ توثيق هويتي الآن مجاناً (+700)' : '🛡️ Verify Identity for Free (+700)'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowKycRefillPromptModal(false);
                    setCurrentView('profile');
                  }}
                  className="w-full py-2.5 bg-[#1F2A44] hover:bg-[#1E2E4E] text-white font-black text-xs rounded-xl shadow-md cursor-pointer text-center"
                >
                  {userProfile?.language === 'ar' ? '💳 شحن رصيد المحفظة بالتوكنز' : '💳 Top Up Wallet Tokens'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowKycRefillPromptModal(false)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 font-extrabold text-[11px] rounded-xl cursor-pointer text-center"
                >
                  {userProfile?.language === 'ar' ? 'إغلاق النافذة' : 'Close Notification'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gpsAlertOpen && (
          <div className="fixed inset-0 bg-[#1F2A44]/60 backdrop-blur-md flex items-center justify-center p-4 z-[10000]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-150 text-center space-y-4 font-sans"
              style={{ direction: userProfile?.language === 'ar' ? 'rtl' : 'ltr' }}
            >
              <div className="w-16 h-16 bg-red-50 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <span className="text-3xl">📍</span>
              </div>
              
              <h3 className="text-base font-black text-gray-900 leading-tight">
                {userProfile?.language === 'ar' ? 'تحديد الموقع المباشر معطل' : 'Location Services Disabled'}
              </h3>
              
              <p className="text-xs text-slate-500 font-bold leading-relaxed font-sans">
                {userProfile?.language === 'ar'
                  ? 'الرجاء تفعيل خدمة تحديد المواقع (GPS) في جهازك لتتمكن من تصفح خريطة الكويستات والمهام المتاحة 📍'
                  : 'Please enable location services (GPS) on your device to start tracking quests and exploring nearby tasks 📍'}
              </p>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={async () => {
                    await Geolocator.openLocationSettings();
                    setGpsAlertOpen(false);
                    setCurrentView('map');
                    showToast(userProfile?.language === 'ar'
                      ? '✅ تم تفعيل خدمات GPS بنجاح! جاري تحميل الخريطة الميدانية...'
                      : '✅ GPS enabled successfully! Direct Map initialized!'
                    );
                  }}
                  className="w-full py-3 bg-[#1F2A44] hover:bg-[#1F2A44]/90 text-[#FFD34D] rounded-2xl text-xs font-black shadow-md cursor-pointer select-none transition-all"
                >
                  {userProfile?.language === 'ar' ? 'تفعيل الآن' : 'Enable Now'}
                </button>
                <button
                  onClick={() => setGpsAlertOpen(false)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-150 text-gray-600 rounded-2xl text-[11px] font-black cursor-pointer select-none transition-all"
                >
                  {userProfile?.language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🏁 Real-time Interactive Captain Arrival Alert Overlay */}
      <AnimatePresence>
        {activeArrivalAlert && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 z-[30000] font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: 'spring', damping: 20 }}
              className="bg-[#1F2A44] border-2 border-[#FFD34D]/50 rounded-[2rem] p-8 max-w-sm w-full shadow-[0_0_50px_rgba(255,211,77,0.25)] relative overflow-hidden text-center space-y-6"
              style={{ direction: userProfile?.language === 'ar' ? 'rtl' : 'ltr' }}
            >
              {/* Pulsating Map Geofence Radar Animation */}
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <span className="absolute inline-flex h-20 w-20 rounded-full bg-emerald-400 opacity-20 animate-ping"></span>
                <span className="absolute inline-flex h-16 w-16 rounded-full bg-emerald-500 opacity-30 animate-pulse"></span>
                <div className="relative w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-300">
                  <span className="text-3xl">📍</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-[#FFD34D]/15 border border-[#FFD34D]/30 rounded-full text-[10px] font-black text-[#FFD34D] uppercase tracking-wider animate-pulse font-sans">
                  {userProfile?.language === 'ar' ? 'تنبيه وصول مباشر 🏁' : 'LIVE ARRIVAL ALERT 🏁'}
                </span>
                <h3 className="text-lg font-black text-white leading-tight">
                  {userProfile?.language === 'ar' ? 'وصل الكابتن إلى موقع المهمة!' : 'Captain Arrived at Location!'}
                </h3>
                <p className="text-xs text-slate-300 font-bold leading-relaxed px-1">
                  {activeArrivalAlert.text}
                </p>
              </div>

              {/* Quest Short Details Preview Card */}
              {(() => {
                const q = quests.find(item => item.id === activeArrivalAlert.questId);
                if (!q) return null;
                return (
                  <div className="bg-[#162035] border border-slate-700/60 rounded-2xl p-4 text-right flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1F2A44] flex items-center justify-center text-xl shrink-0 border border-slate-700">
                      🏃
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] text-[#4FC3F7] font-extrabold block uppercase tracking-wider leading-none mb-1">
                        {userProfile?.language === 'ar' ? 'المهمة المرتبطة' : 'Associated Quest'}
                      </span>
                      <h4 className="text-xs font-black text-white truncate ltr:text-left text-right">
                        {q.title}
                      </h4>
                      <p className="text-[10px] text-[#FFD34D] font-black mt-0.5 ltr:text-left text-right">
                        💰 {q.cashReward} {userProfile?.language === 'ar' ? 'ر.س' : 'DA'}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  onClick={handleOpenArrivalChat}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FFD34D] to-[#F1C40F] hover:from-[#FFE066] hover:to-[#F39C12] text-[#1F2A44] hover:shadow-[0_0_20px_rgba(255,211,77,0.4)] rounded-2xl text-xs font-black shadow-lg cursor-pointer select-none transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>💬</span>
                  <span>
                    {userProfile?.language === 'ar' ? 'تحدث مع الكابتن الآن' : 'Chat with Captain Now'}
                  </span>
                </button>
                <button
                  onClick={handleDismissArrivalAlert}
                  className="w-full py-3 bg-slate-700/50 hover:bg-slate-700/80 border border-slate-600/40 text-slate-100 rounded-2xl text-xs font-black cursor-pointer select-none transition-all transform active:scale-[0.98]"
                >
                  {userProfile?.language === 'ar' ? 'حسناً، فهمت 👍' : 'Understood, Awesome 👍'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🤝 Reciprocal Forced Rating Modal Overlay (Dual Evaluation) */}
      {!isLoadingRating && activeRatingQuestId && userProfile && (
        <ReciprocalRatingModal
          questId={activeRatingQuestId}
          quests={quests}
          userProfile={userProfile}
          onSaveHunterReview={handleSaveHunterReviewFromReciprocal}
          onSaveGodfatherReview={handleSaveGodfatherReviewFromReciprocal}
        />
      )}

      {/* 🔮 Immersive Global Full-screen Quest Creator */}
      <GlobalCreateQuestModal
        isOpen={showGlobalCreateQuest}
        onClose={() => setShowGlobalCreateQuest(false)}
        onPostQuest={handlePostNewQuest}
        lang={userProfile?.language || 'ar'}
        userProfile={userProfile}
        audioEnabled={userProfile?.audioEffectsEnabled !== false}
      />

      {/* 🛡️ Terms of Use & Privacy Policy First-Time Consent Modal */}
      <TermsConsentModal
        isOpen={showTermsConsentModal}
        onAccept={handleAcceptTerms}
        lang={userProfile?.language || 'ar'}
      />

    </div>
  );
}
