import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  Briefcase, 
  X,
  AlertTriangle,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  FileText,
  Star,
  Image,
  Camera,
  MessageSquare,
  Send,
  Award,
  History,
  PhoneCall,
  Lock,
  Phone
} from 'lucide-react';
import { Quest, QuestCategory, UserProfile, Applicant } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { translations } from '../data/translations';
import { formatArabicDate } from '../utils/dateFormatter';
import { compressImage } from '../utils/imageCompressor';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage, db, auth, handleFirestoreError, OperationType } from '../utils/firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

interface MyQuestsViewProps {
  quests: Quest[];
  currentUserId: string;
  lang: 'ar' | 'fr' | 'en';
  onPostNewQuest: (newQuest: Partial<Quest>) => void;
  onDeleteCreatedQuest: (questId: string) => void;
  onCancelBookedQuest: (questId: string, refundedTokens: number) => void;
  onUploadProof: (questId: string, proofUrl: string) => void;
  onConfirmPayout: (questId: string, rating?: number, comment?: string) => void;
  userProfile: UserProfile;
  onAcceptApplicant: (questId: string, applicantId: string) => void;
  onViewPublicProfile?: (userId: string) => void;
  deferredActiveChat?: any;
  onClearDeferredChat?: () => void;
  initialTab?: 'obligations' | 'created' | null;
  onClearInitialTab?: () => void;
  onViewQuestDetail?: (questId: string) => void;
  initialSelectedQuestId?: string | null;
  onClearInitialSelectedQuest?: () => void;
  onForceReleaseContract?: (questId: string) => void;
  onSendPushNotification?: (recipientId: string, title: string, body: string, data?: Record<string, string>) => void;
  autoOpenCreate?: boolean;
  onClearAutoOpenCreate?: () => void;
  setQuests?: (quests: Quest[]) => void;
  onArrivedAtQuest?: (questId: string) => void;
}

const CATEGORIES_LIST: QuestCategory[] = [
  'صيانة', 'توصيل', 'تعليم', 'تسوق', 'تقنية', 'مساعدة منزلية', 'رعاية أليفة', 'أخرى'
];

export default function MyQuestsView({
  quests,
  currentUserId,
  lang,
  onPostNewQuest,
  onDeleteCreatedQuest,
  onCancelBookedQuest,
  onUploadProof,
  onConfirmPayout,
  userProfile,
  onAcceptApplicant,
  onViewPublicProfile,
  deferredActiveChat,
  onClearDeferredChat,
  initialTab,
  onClearInitialTab,
  onViewQuestDetail,
  initialSelectedQuestId,
  onClearInitialSelectedQuest,
  onForceReleaseContract,
  onSendPushNotification,
  autoOpenCreate,
  onClearAutoOpenCreate,
  setQuests,
  onArrivedAtQuest
}: MyQuestsViewProps) {
  const activeQuestCount = userProfile?.hasActiveQuest === false ? 0 : quests.filter(q => q.creatorId === currentUserId && q.status !== 'completed' && q.status !== 'cancelled' && q.status !== 'cancelled_by_timeout' && q.status !== 'stale_cleared').length;
  const [activeTab, setActiveTab ] = useState<'obligations' | 'created'>(() => {
    if (initialTab) return initialTab;
    return activeQuestCount > 0 ? 'created' : 'obligations';
  });

  const handleRefresh = async () => {
    try {
      const questsQuery = query(collection(db, 'quests'), orderBy('createdAt', 'desc'), limit(300));
      const questsSnapshot = await getDocs(questsQuery);
      const fetchedQuests: Quest[] = [];
      questsSnapshot.forEach((doc) => {
        fetchedQuests.push({ id: doc.id, ...doc.data() } as any);
      });
      if (setQuests && fetchedQuests.length > 0) {
        setQuests(fetchedQuests);
      }
      showToast(lang === 'ar' ? '🔄 تم تحديث قائمة الكويستات والمهمات بنجاح!' : '🔄 Quests and tasks refreshed successfully!');
    } catch (error) {
      console.error("Failed to refresh quests in MyQuestsView:", error);
      showToast(lang === 'ar' ? '⚠️ فشل تحديث البيانات.' : '⚠️ Failed to update data.');
    }
  };
  const [showHistory, setShowHistory] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  // Auto show creation modal when triggered from home
  useEffect(() => {
    if (autoOpenCreate) {
      if (activeQuestCount > 0) {
        alert(
          lang === 'ar' 
            ? 'لا يمكنك نشر أكثر من مهمة واحدة نشطة في نفس الوقت ⚠️' 
            : lang === 'fr'
            ? "Vous ne pouvez publier qu'une seule tâche active à la fois ⚠️"
            : 'You can only have one active published quest at a time ⚠️'
        );
        if (onClearAutoOpenCreate) {
          onClearAutoOpenCreate();
        }
        return;
      }
      setActiveTab('created');
      setCreateStep(1);
      setShowCreateModal(true);
      if (onClearAutoOpenCreate) {
        onClearAutoOpenCreate();
      }
    }
  }, [autoOpenCreate, onClearAutoOpenCreate, activeQuestCount, lang]);
  const [selectedProofQuest, setSelectedProofQuest] = useState<Quest | null>(null);
  const [selectedProofFile, setSelectedProofFile] = useState<string>('');

  // Applicant & Profile Modal states
  const [selectedApplicantData, setSelectedApplicantData] = useState<{ quest: Quest; applicant: Applicant } | null>(null);
  const [deleteConfirmQuestId, setDeleteConfirmQuestId] = useState<string | null>(null);

  // Get equipment list for UI rendering dynamically
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
          lang === 'ar' ? 'قائمة المشتريات المحددة ووسيلة دفع مناسبة' : 'Specific shopping list & payment method',
          lang === 'ar' ? 'أكياس تسوق صديقة للبيئة وقابلة لإعادة الاستخدام' : 'Reusable eco-friendly shopping bags'
        ];
      case 'تقنية':
        return [
          lang === 'ar' ? 'جهاز كمبيوتر لابتوب عالي الأداء مع كابلات التوصيل' : 'High-performance laptop & connector cables',
          lang === 'ar' ? 'شاحن سريع ومحركات أقراص USB محمولة لنقل البيانات' : 'Fast charger & flash drives for transfers'
        ];
      case 'مساعدة منزلية':
        return [
          lang === 'ar' ? 'أدوات ومواد تنظيف مخصصة للمنازل' : 'Dedicated residential cleaning materials',
          lang === 'ar' ? 'ممسحة وقفازات مطاطية لحماية الأيدي' : 'Mop & rubber protective gloves'
        ];
      case 'رعاية أليفة':
        return [
          lang === 'ar' ? 'حبل متين لقيادة الحيوانات الأليفة ووعاء للماء' : 'Sturdy pet leash & portable water bowl',
          lang === 'ar' ? 'أكياس مخصصة للتخلص الصحي من الفضلات' : 'Wastes collection bags & dry treats'
        ];
      default:
        return [
          lang === 'ar' ? 'هاتف ذكي متصل بالإنترنت ومفعل للتوجيه الجغرافي' : 'Connected smartphone with GPS activated',
          lang === 'ar' ? 'شاحن طاقة متنقل لحالات الطوارئ الميدانية' : 'Portable power bank for outdoor emergencies'
        ];
    }
  };

  // Listen to initialTab prop updates and apply
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (onClearInitialTab) {
        onClearInitialTab();
      }
    }
  }, [initialTab, onClearInitialTab]);

  // Scroll and highlight pre-selected quest on created tab
  useEffect(() => {
    if (initialSelectedQuestId) {
      if (activeTab !== 'created') {
        setActiveTab('created');
      }

      // Check if target quest is in history vs active tab
      const targetQuest = quests.find(q => q.id === initialSelectedQuestId);
      if (targetQuest) {
        const isHistory = isHistoryStatus(targetQuest.status);
        if (showHistory !== isHistory) {
          setShowHistory(isHistory);
        }
      }

      let attempts = 0;
      const attemptScroll = () => {
        const element = document.getElementById(`quest-${initialSelectedQuestId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempts < 6) {
          attempts++;
          setTimeout(attemptScroll, 150);
        }
      };

      const timer = setTimeout(attemptScroll, 200);

      const clearTimer = setTimeout(() => {
        if (onClearInitialSelectedQuest) {
          onClearInitialSelectedQuest();
        }
      }, 4000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [activeTab, initialSelectedQuestId, onClearInitialSelectedQuest, quests, showHistory]);

  // Local state for UI feedback toast notifications
  const [localToast, setLocalToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast(prev => prev === msg ? null : prev);
    }, 3000);
  };

  // Form states for hosting quest
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [newCat, setNewCat] = useState<QuestCategory>('صيانة');
  const [newCash, setNewCash] = useState(1500); // default Algerian Dinar price
  const [newUrgency, setNewUrgency] = useState<'normal' | 'urgent' | 'featured'>('normal');
  const [newQuestImages, setNewQuestImages] = useState<string[]>([]);
  const [newRequiredWorkerCount, setNewRequiredWorkerCount] = useState<number>(1);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleAutoTagLocation = () => {
    if (!navigator.geolocation) {
      showToast(lang === 'ar' ? '⚠️ تحديد الموقع غير مدعوم في متصفحك!' : '⚠️ Geolocation is not supported by your browser!');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setGpsCoords(coords);
        setGpsLoading(false);
        setNewLoc(`Lat: ${coords.lat.toFixed(5)}, Lng: ${coords.lng.toFixed(5)}`);
        showToast(lang === 'ar' ? '🎯 تم تحديد ونشاط رمز إحداثيات GPS بنجاح!' : '🎯 GPS location coordinates tagged successfully!');
      },
      (error) => {
        console.warn(error);
        setGpsLoading(false);
        setGpsCoords(null);
        setNewLoc('');
        showToast(lang === 'ar' 
          ? "⚠️ شغل gps وفقك"
          : "⚠️ Please turn on your GPS"
        );
      },
      { 
        enableHighAccuracy: true, // Demands pure physical GPS hardware sensors
        timeout: 15000, 
        maximumAge: 0 // Disable cached network IP location entirely (always false caching)
      }
    );
  };

  // Refs for native Gallery-only input selectors
  const contractInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Simulated upload progress states
  const [bountyUploading, setBountyUploading] = useState(false);
  const [bountyProgress, setBountyProgress] = useState(0);
  const [helperUploading, setHelperUploading] = useState(false);
  const [helperProgress, setHelperProgress] = useState(0);

  // Trigger native Algerian photo gallery select (multiple files)
  const handleAddContractImageSimulated = () => {
    if (newQuestImages.length >= 3) {
      showToast(
        lang === 'ar'
          ? '⚠️ يمكنك إرفاق ما يصل إلى 3 صور كحد أقصى!'
          : '⚠️ You can attach up to 3 images maximum!'
      );
      return;
    }
    if (contractInputRef.current) {
      contractInputRef.current.value = '';
      contractInputRef.current.click();
    }
  };

  // Multiple Image Selection from native device gallery (simulates picker.pickMultiImage())
  const handleContractFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = newQuestImages.length;
    const allowedNewCount = Math.max(0, 3 - currentCount);
    if (allowedNewCount === 0) {
      showToast(
        lang === 'ar'
          ? '⚠️ تم الوصول للحد الأقصى (3 صور)!'
          : '⚠️ Maximum of 3 images reached!'
      );
      return;
    }

    setBountyUploading(true);
    setBountyProgress(5);

    // Limit files to allowedNewCount
    const filesArray = Array.from(files).slice(0, allowedNewCount);
    const fileCount = filesArray.length;
    const compressedUrls: string[] = [];

    try {
      for (let i = 0; i < fileCount; i++) {
        const file = filesArray[i] as File;
        // Calculate dynamic loading progress
        const stepProgress = Math.round(((i + 1) / fileCount) * 80);
        setBountyProgress(stepProgress);
        
        // Expose file to professional 1080x1080 compression at 70% quality factor
        const compressedBase64 = await compressImage(file);

        try {
          // Upload to Firebase Storage with a 2-second timeout to prevent stalling if Storage sits on a cold bucket/permissions hang
          const storageRef = ref(storage, `quests/${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}.jpg`);
          
          await Promise.race([
            uploadString(storageRef, compressedBase64, 'data_url'),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase Storage Timeout")), 2000))
          ]);
          
          const downloadUrl = await getDownloadURL(storageRef);
          compressedUrls.push(downloadUrl);
        } catch (storageErr) {
          console.warn("Storage upload took too long or failed, falling back to local compressed base64 URI", storageErr);
          compressedUrls.push(compressedBase64);
        }
      }

      // Finish smooth progress counter animation
      setBountyProgress(90);
      let p = 90;
      const interval = setInterval(() => {
        p += 5;
        if (p >= 100) {
          clearInterval(interval);
          setBountyUploading(false);
          setNewQuestImages(prev => [...prev, ...compressedUrls]);
          showToast(
            lang === 'ar' 
              ? `📸 تم ضغط وتجهيز ${fileCount} صور بنجاح!` 
              : `📸 Successfully compressed and attached ${fileCount} images!`
          );
        } else {
          setBountyProgress(p);
        }
      }, 60);

    } catch (err: any) {
      console.error(err);
      setBountyUploading(false);
      showToast(lang === 'ar' ? '⚠️ حدث فشل أثناء ضغط ملفات المعرض' : '⚠️ Error compressing selected gallery photographs');
    }
  };

  // Trigger native photo gallery for completion proof
  const handleHelperUploadSimulated = () => {
    if (proofInputRef.current) {
      proofInputRef.current.value = '';
      proofInputRef.current.click();
    }
  };

  // Single Image Selection from native device gallery (simulates picker.pickImage(source: ImageSource.gallery))
  const handleHelperFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setHelperUploading(true);
    setHelperProgress(8);

    try {
      const file = files[0];
      
      // Simulated progressive check
      let progress = 10;
      const interval = setInterval(() => {
        progress += 15;
        if (progress >= 90) {
          clearInterval(interval);
        } else {
          setHelperProgress(progress);
        }
      }, 80);

      // Perform direct offline JPEG quality: 70 & 1080x1080 max-res restriction check
      const compressedDataUrl = await compressImage(file);
      clearInterval(interval);

      setHelperProgress(100);
      setTimeout(() => {
        setHelperUploading(false);
        setSelectedProofFile(compressedDataUrl);
        showToast(
          lang === 'ar'
            ? '📸 تم إدخال الإثبات بنجاح بعد ضغطه وتعديل مقاساته لـ 1080x1080!'
            : '📸 Photo selected from Gallery and compressed to 1080px (70% Quality)!'
        );
      }, 100);

    } catch (err: any) {
      console.error(err);
      setHelperUploading(false);
      showToast(lang === 'ar' ? '⚠️ فشل تحميل وضغط ملف الإثبات' : '⚠️ Verification proof processing failed');
    }
  };

  // Payout star rating variables state
  const [ratingQuestId, setRatingQuestId] = useState<string | null>(null);
  const [ratingVal, setRatingVal] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');

  const dict = translations[lang];
  const isRtl = lang === 'ar';

  const isHistoryStatus = (status: string) => {
    return ['completed', 'cancelled', 'expired', 'cancelled_by_timeout', 'stale_cleared'].includes(status);
  };

  const isActiveStatus = (status: string) => {
    return !isHistoryStatus(status);
  };

  const obligations = quests.filter(q => 
    (q.helperId === currentUserId || q.assignedRunnerId === currentUserId || q.assignedRunnerIds?.includes(currentUserId)) && 
    (showHistory ? isHistoryStatus(q.status) : isActiveStatus(q.status))
  );

  const createdQuests = quests.filter(q => 
    q.creatorId === currentUserId && 
    (showHistory ? isHistoryStatus(q.status) : isActiveStatus(q.status))
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpsCoords) {
      showToast(lang === 'ar' 
        ? "⚠️ تعذر تحديد موقع GPS بدقة. يرجى تفعيل الموقع أو الخروج لمكان مفتوح."
        : "⚠️ Could not acquire GPS coordinates. Please enable phone location or step outside."
      );
      return;
    }
    if (!newTitle || !newDesc) return;

    const lat = gpsCoords.lat;
    const lng = gpsCoords.lng;
    const locString = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

    onPostNewQuest({
      title: newTitle,
      description: newDesc,
      location: locString,
      category: newCat,
      cashReward: Number(newCash),
      bookingFeeTokens: Math.max(50, Math.round(Number(newCash) * 0.10)),
      urgency: newUrgency,
      lat,
      lng,
      imageUrls: newQuestImages.length > 0 ? newQuestImages : undefined,
      images: newQuestImages.length > 0 ? newQuestImages : undefined,
      imageUrl: newQuestImages.length > 0 ? newQuestImages[0] : undefined,
      locationCoords: { lat, lng },
      requiredWorkerCount: newRequiredWorkerCount,
      assignedRunnerIds: []
    });

    setNewTitle('');
    setNewDesc('');
    setNewLoc('');
    setNewCat('صيانة');
    setNewCash(1500);
    setNewUrgency('normal');
    setNewQuestImages([]);
    setNewRequiredWorkerCount(1);
    setGpsCoords(null);
    setShowCreateModal(false);
    setActiveTab('created');
  };

  const executeProofUpload = () => {
    if (!selectedProofFile) {
      showToast(lang === 'ar' ? '⚠️ يرجى رفع أو التقاط صورة إثبات من جهازك أولاً!' : '⚠️ Please upload or take a proof photo from your device first!');
      return;
    }
    if (selectedProofQuest) {
      onUploadProof(selectedProofQuest.id, selectedProofFile);
      setSelectedProofQuest(null);
      setSelectedProofFile('');
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
      
      {/* Minimal Header: Only Archive Toggle Icon-Button */}
      <div className="flex justify-end items-center">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`p-2.5 rounded-2xl border shadow-sm transition-all duration-300 cursor-pointer flex items-center justify-center ${
            showHistory
              ? 'bg-amber-100 border-amber-300 text-amber-800 ring-2 ring-amber-300/50'
              : 'bg-white border-gray-150 text-[#1F2A44] hover:bg-gray-50'
          }`}
          title={showHistory ? (lang === 'ar' ? 'العقود النشطة 🤝' : 'Active Contracts') : (lang === 'ar' ? 'سجل المهام ⏳' : 'History Log')}
        >
          <History className="w-5 h-5 text-current" />
        </button>
      </div>

      {/* Persistent Tabs (The PinnedTabBar) */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 items-center gap-2">
        {activeQuestCount > 0 ? (
          <>
            {/* Created Tab (Primary state for Poster/Employer mode) */}
            <button
              id="tab-created-active-quest"
              onClick={() => setActiveTab('created')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'created' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-md scale-[1.01]' : 'text-gray-500 hover:text-gray-75'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0 text-[#FFD34D]" />
              <span className="truncate">{dict.createdTab} ({createdQuests.length})</span>
            </button>

            {/* Obligations Tab (Secondary, now equal-sized state) */}
            <button
              id="tab-obligations-active-quest"
              onClick={() => setActiveTab('obligations')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'obligations' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-md scale-[1.01]' : 'text-gray-500 hover:text-gray-75'
              }`}
              title={dict.obigationsTab}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {lang === 'ar' ? 'مهامي 🛠️' : lang === 'fr' ? 'Engagements 🛠️' : 'My Jobs 🛠️'} ({obligations.length})
              </span>
            </button>
          </>
        ) : (
          <>
            {/* Obligations Tab (Primary state for Runner/Worker mode) */}
            <button
              id="tab-obligations-inactive-quest"
              onClick={() => setActiveTab('obligations')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'obligations' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-md scale-[1.01]' : 'text-gray-500 hover:text-gray-75'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0 text-[#FFD34D]" />
              <span className="truncate">{dict.obigationsTab} ({obligations.length})</span>
            </button>

            {/* Created Tab (Secondary, now equal-sized state) */}
            <button
              id="tab-created-inactive-quest"
              onClick={() => setActiveTab('created')}
              className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'created' ? 'bg-[#1F2A44] text-[#FFD34D] shadow-md scale-[1.01]' : 'text-gray-500 hover:text-gray-75'
              }`}
              title={dict.createdTab}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {lang === 'ar' ? 'طلباتي 💼' : lang === 'fr' ? 'Mes Primes 💼' : 'My Posts 💼'} ({createdQuests.length})
              </span>
            </button>
          </>
        )}
      </div>

      {/* Archive Warning & Indicator and Navigation Back Button */}
      {showHistory && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-900 animate-fadeIn shadow-sm">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-amber-600 shrink-0" />
            <div className="text-start space-y-0.5">
              <span className="text-sm font-black block">
                {lang === 'ar' ? 'أنت تعرض حالياً سجل الأرشيف والتاريخ ⏳' : 'Viewing History & Archived Records ⏳'}
              </span>
              <span className="text-xs text-amber-700/90 font-bold block leading-relaxed">
                {lang === 'ar'
                  ? 'هذه المقالات والعقود مؤرشفة للقراءة فقط ومثبتة رسمياً كأدلة سابقة على الإنجاز.'
                  : 'These are completed, cancelled, or expired read-only contracts.'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-5 py-3 rounded-2xl transition-all cursor-pointer shadow-sm shadow-amber-600/20 active:scale-95 text-center shrink-0 w-full sm:w-auto"
          >
            {lang === 'ar' ? 'الرجوع للعقود النشطة 🤝' : 'Back to Active Contracts 🤝'}
          </button>
        </div>
      )}

      {/* Worker Obligations Mode */}
      {activeTab === 'obligations' && (
        <div className="space-y-4">
          {obligations.length === 0 ? (
            <div className="bg-white py-16 px-4 rounded-3xl border border-gray-150 border-dashed text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                <Briefcase className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-extrabold text-sm">{lang === 'ar' ? 'أنت لا تلتزم بأي مهمة عمل حالياً' : 'No active worker commitments'}</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                {lang === 'ar' ? 'تصفح كويستات بالرئيسية والخريطة، ادفع 10% رسوم حجز لتبدأ العمل وكسب المكافأة!' : 'Book standard tasks on home or map view to populate commitments.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {obligations.map((quest) => {
                const isOngoing = quest.status === 'booked' || quest.status === 'arrived';
                const isArrived = quest.status === 'arrived';
                const isUnderReview = quest.status === 'pending_verification';
                const isDisputed = quest.status === 'disputed';
                const isFinished = quest.status === 'completed';

                return (
                  <div 
                    key={quest.id} 
                    className={`bg-white border rounded-[2rem] p-6 space-y-5 shadow-sm transition-all duration-300 relative ${
                      showHistory 
                        ? 'grayscale opacity-75 border-slate-200 bg-slate-50/50' 
                        : 'border-[#1F2A44] hover:border-[#FF3B7C] hover:shadow-lg'
                    }`}
                  >
                    {/* Header: Status, Category, and Reward */}
                    <div className="flex justify-between items-center gap-4 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap text-start">
                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#1F2A44]/5 text-[#1F2A44] border border-[#1F2A44]/10 uppercase tracking-wider">
                          {quest.category}
                        </span>
                        
                        {isOngoing && !isArrived && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#2196F3]/10 text-[#1565C0] border border-[#2196F3]/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2196F3] animate-pulse"></span>
                            {lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                          </span>
                        )}
                        {isArrived && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#FFB300]/10 text-[#B78103] border border-[#FFB300]/20 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFB300]"></span>
                            {lang === 'ar' ? 'وصلت للموقع 🏁' : 'Arrived 🏁'}
                          </span>
                        )}
                        {isUnderReview && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#FF9800]/10 text-[#E65100] border border-[#FF9800]/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9800] animate-ping"></span>
                            {lang === 'ar' ? 'قيد المراجعة ⏳' : 'Under Review ⏳'}
                          </span>
                        )}
                        {isDisputed && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#E91E63]/10 text-[#C2185B] border border-[#E91E63]/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E91E63]"></span>
                            {lang === 'ar' ? 'نزاع مالي 🔒' : 'Dispute 🔒'}
                          </span>
                        )}
                        {isFinished && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#4CAF50]/10 text-[#2E7D32] border border-[#4CAF50]/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"></span>
                            {lang === 'ar' ? 'مكتملة ✔️' : 'Completed ✔️'}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span className="text-[#FF3B7C] font-black text-sm md:text-base font-mono block bg-[#FF3B7C]/5 px-3.5 py-1.5 rounded-2xl border border-[#FF3B7C]/20 shadow-2xs">
                          {quest.cashReward} DA
                        </span>
                      </div>
                    </div>

                    {/* Title and Location */}
                    <div className="space-y-2 text-start">
                      <h3 className="font-extrabold text-base md:text-lg text-slate-900 leading-snug tracking-tight break-words">
                        {quest.title}
                      </h3>
                      {(() => {
                        const isAuthorized = quest.creatorId === currentUserId || isOngoing || isArrived || isUnderReview || isFinished;
                        return (
                          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl max-w-full">
                            {isAuthorized ? (
                              <>
                                <MapPin className="w-3.5 h-3.5 text-[#4FC3F7] shrink-0" />
                                <span className="truncate font-medium">{quest.location}</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="text-slate-400 truncate font-semibold">
                                  {lang === 'ar' ? '🔒 الموقع مخفي حتى قبول الحجز وتفعيل العقد' : '🔒 Location hidden until booking approved'}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Description Section */}
                    <div className="text-xs text-slate-600 leading-relaxed text-start space-y-3">
                      <p className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/60 whitespace-pre-wrap font-medium text-slate-700">
                        {quest.description}
                      </p>
                      {quest.imageUrl && (
                        <div className="relative group overflow-hidden rounded-[1.5rem] border border-slate-150 max-h-56 bg-slate-50 flex items-center justify-center shadow-xs transition duration-300">
                          <img src={quest.imageUrl} alt={quest.title} className="w-full h-full object-cover max-h-56 group-hover:scale-[1.01] transition duration-500" />
                        </div>
                      )}
                    </div>

                    {/* Compact Employer Profile Row */}
                    {quest.creatorId && (() => {
                      const name = quest.creatorName || (lang === 'ar' ? 'صاحب العمل' : 'Employer');
                      const avatar = quest.creatorAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=111827`;
                      return (
                        <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100/80 hover:bg-slate-50 transition-colors duration-200">
                          <div 
                            onClick={() => onViewPublicProfile && onViewPublicProfile(quest.creatorId!)}
                            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
                          >
                            <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs" />
                            <div className="text-start">
                              <span className="text-[9px] text-slate-400 block font-black uppercase tracking-wider">
                                {lang === 'ar' ? 'صاحب العمل' : 'Employer'}
                              </span>
                              <span className="text-xs font-extrabold text-slate-800 leading-none flex items-center gap-1 mt-0.5">
                                {name}
                                <span className="text-amber-500 font-mono font-bold text-[10px]">★ 5.0</span>
                              </span>
                            </div>
                          </div>
                          
                          {isOngoing && quest.creatorPhone && (
                            <a
                              href={`tel:${quest.creatorPhone}`}
                              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Phone className="w-3.5 h-3.5 text-white animate-bounce" />
                              <span>{lang === 'ar' ? 'اتصال مباشر' : 'Direct Call'}</span>
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    {/* Actions Panel */}
                    <div className="pt-2 border-t border-slate-100">
                      {isOngoing && (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex gap-2 w-full">
                            <button
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('open-chat', {
                                  detail: {
                                    chatId: `${quest.id}_${quest.creatorId}_${currentUserId}`,
                                    questTitle: quest.title,
                                    recipientName: quest.creatorName,
                                    recipientAvatar: quest.creatorAvatar
                                  }
                                }));
                              }}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <MessageSquare className="w-4 h-4 text-emerald-400" />
                              <span>{lang === 'ar' ? 'مراسلة العميل' : 'Message Client'}</span>
                            </button>

                            <button
                              onClick={() => setSelectedProofQuest(quest)}
                              className="flex-1 bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white font-extrabold text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Camera className="w-4 h-4 text-white" />
                              <span>{lang === 'ar' ? 'إثبات الإنجاز' : 'Submit Proof'}</span>
                            </button>
                          </div>

                          <div className="flex gap-2 w-full mt-1">
                            <button
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('navigate-to-quest-map', {
                                  detail: { quest }
                                }));
                              }}
                              className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <MapPin className="w-3.5 h-3.5 text-sky-500" />
                              <span>{lang === 'ar' ? 'الاتجاه للموقع' : 'Navigate'}</span>
                            </button>

                            <button
                              onClick={() => {
                                const refundAmount = Math.round(quest.bookingFeeTokens * 0.30);
                                onCancelBookedQuest(quest.id, refundAmount);
                              }}
                              className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 hover:border-rose-200 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <span>{lang === 'ar' ? 'إلغاء الحجز' : 'Cancel Reservation'}</span>
                            </button>
                          </div>

                          {!isArrived && onArrivedAtQuest && (
                            <button
                              onClick={() => {
                                onArrivedAtQuest(quest.id);
                              }}
                              className="w-full bg-gradient-to-r from-[#FFD34D] to-[#FF3B7C] hover:from-[#FFD34D]/90 hover:to-[#FF3B7C]/90 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                            >
                              <span>🏁 {lang === 'ar' ? 'تأكيد الوصول للموقع (مباشرة)' : 'Confirm Arrival Directly 🏁'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {isUnderReview && (
                        <div className="w-full text-center bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100 text-xs font-extrabold text-amber-800 flex items-center justify-center gap-2 animate-pulse">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>{lang === 'ar' ? 'في انتظار مراجعة صاحب العمل لتأكيد السداد المالي' : 'Awaiting employer confirmation.'}</span>
                        </div>
                      )}

                      {isFinished && (
                        <div className="w-full text-center bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100 text-xs font-extrabold text-emerald-800 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-bounce" />
                          <span>{lang === 'ar' ? 'تم اكتمال الكويست واستلام الأموال بنجاح!' : 'Quest successfully completed!'}</span>
                        </div>
                      )}

                      {onViewQuestDetail && (
                        <button
                          onClick={() => onViewQuestDetail(quest.id)}
                          className="w-full bg-[#1F2A44]/5 hover:bg-[#1F2A44]/10 text-[#1F2A44] border border-[#1F2A44]/10 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 mt-2.5"
                        >
                          <span>{lang === 'ar' ? 'تفاصيل كاملة 🔗' : 'Full Details 🔗'}</span>
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}

              {/* Applied Pending Quests */}
              {!showHistory && (() => {
                const appliedQuests = quests.filter(q => q.applicants?.some(a => a.userId === currentUserId) && q.status === 'open');
                if (appliedQuests.length === 0) return null;
                return (
                  <div className="space-y-4 pt-6 border-t border-slate-200">
                    <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 tracking-wider">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span>{lang === 'ar' ? 'طلبات توظيف قيد الانتظار' : 'Applied Quests (Pending Approval)'}</span>
                    </h3>
                    <div className="grid gap-4">
                      {appliedQuests.map((quest) => (
                        <div key={quest.id} className="bg-slate-50/60 border border-slate-200 p-6 rounded-3xl space-y-4 shadow-xs">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1 text-start">
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100/70 text-amber-800 uppercase">
                                {quest.category}
                              </span>
                              <h4 className="font-extrabold text-sm text-slate-900 mt-1 leading-tight">{quest.title}</h4>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Lock className="w-3 h-3 text-amber-500" />
                                <span className="text-slate-400">
                                  {lang === 'ar' ? '🔒 الموقع مخفي حتى قبول الحجز وتفعيل العقد' : '🔒 Location hidden until booking approved'}
                                </span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[#FF3B7C] font-black text-xs md:text-sm font-mono block bg-rose-50/50 px-2.5 py-1 rounded-xl border border-rose-100/50">
                                {quest.cashReward} DA
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-white px-4 py-3 rounded-2xl border border-slate-150/70 shadow-2xs">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                              {lang === 'ar' ? 'طلبك قيد الانتظار لموافقة صاحب العمل' : 'Awaiting employer selection'}
                            </span>
                            <span className="text-[10px] font-extrabold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg">
                              <Lock className="w-3 h-3 text-slate-400" />
                              {lang === 'ar' ? 'الدردشة مغلقة' : 'Chat Locked'}
                            </span>
                          </div>

                          {onViewQuestDetail && (
                            <button
                              onClick={() => onViewQuestDetail(quest.id)}
                              className="w-full bg-[#1F2A44]/5 hover:bg-[#1F2A44]/10 text-[#1F2A44] border border-[#1F2A44]/10 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>{lang === 'ar' ? 'تفاصيل كاملة 🔗' : 'Full Details 🔗'}</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Poster Mode */}
      {activeTab === 'created' && (
        <div className="space-y-4">
          {createdQuests.length === 0 ? (
            <div className="bg-white py-16 px-4 rounded-3xl border border-gray-150 border-dashed text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                <Plus className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="font-extrabold text-sm">{lang === 'ar' ? 'لم تقم بنشر أي كويست سابقاً' : 'No hosted chores listed'}</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                {lang === 'ar' ? 'انشر طلباً لمساعدة الجيران! حدد مكافأة نقدية، ودع الرَّانَرز يلبون النداء.' : 'Post custom chores in Algeria to hire youth runner assistants today.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {createdQuests.map((quest) => {
                const isAvailable = quest.status === 'open';
                const isClaimed = quest.status === 'booked';
                const isSubmitted = quest.status === 'pending_verification';
                const isFinished = quest.status === 'completed';

                return (
                  <div
                    key={quest.id}
                    id={`quest-${quest.id}`}
                    className={`bg-white border rounded-[2rem] p-6 space-y-5 shadow-sm transition-all duration-300 relative ${
                      showHistory 
                        ? 'grayscale opacity-75 border-slate-200 bg-slate-50/50' 
                        : initialSelectedQuestId === quest.id
                        ? 'border-[#FF3B7C] ring-4 ring-[#FF3B7C]/15 scale-[1.01]'
                        : 'border-[#1F2A44] hover:border-[#FF3B7C] hover:shadow-lg'
                    }`}
                  >
                    {/* Header: Status, Category, and Reward */}
                    <div className="flex justify-between items-center gap-4 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap text-start">
                        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#1F2A44]/5 text-[#1F2A44] border border-[#1F2A44]/10 uppercase tracking-wider">
                          {quest.category}
                        </span>
                        
                        {isAvailable && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
                            {lang === 'ar' ? 'مفتوح للتقديم' : 'Open'}
                          </span>
                        )}
                        {isClaimed && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {lang === 'ar' ? 'تم التعيين' : 'Assigned'}
                          </span>
                        )}
                        {isSubmitted && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#FF9800]/10 text-[#E65100] border border-[#FF9800]/20 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9800]"></span>
                            {lang === 'ar' ? 'تم استلام الإنجاز' : 'Proof Submitted'}
                          </span>
                        )}
                        {isFinished && (
                          <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {lang === 'ar' ? 'مكتمل' : 'Completed'}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span className="text-[#FF3B7C] font-black text-sm md:text-base font-mono block bg-[#FF3B7C]/5 px-3.5 py-1.5 rounded-2xl border border-[#FF3B7C]/20 shadow-2xs">
                          {quest.cashReward} DA
                        </span>
                      </div>
                    </div>

                    {/* Title and Location */}
                    <div className="space-y-2 text-start">
                      <h3 className="font-extrabold text-base md:text-lg text-slate-900 leading-snug tracking-tight break-words">
                        {quest.title}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl max-w-full">
                        <MapPin className="w-3.5 h-3.5 text-[#4FC3F7] shrink-0" />
                        <span className="truncate font-medium">{quest.location}</span>
                      </div>
                    </div>

                    {/* Description Section */}
                    <div className="text-xs text-slate-600 leading-relaxed text-start space-y-3">
                      <p className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100/60 whitespace-pre-wrap font-medium text-slate-700">
                        {quest.description}
                      </p>
                      {quest.imageUrl && (
                        <div className="relative group overflow-hidden rounded-[1.5rem] border border-slate-150 max-h-56 bg-slate-50 flex items-center justify-center shadow-xs transition duration-300">
                          <img src={quest.imageUrl} alt={quest.title} className="w-full h-full object-cover max-h-56 group-hover:scale-[1.01] transition duration-500" />
                        </div>
                      )}
                    </div>

                    {/* Compact Hired Worker Profile Row */}
                    {(quest.helperId || quest.assignedRunnerId) && (() => {
                      const runnerId = quest.helperId || quest.assignedRunnerId;
                      const name = quest.helperName || (lang === 'ar' ? 'المساعد الميداني' : 'Assistant');
                      const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=f43f5e`;
                      return (
                        <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100/80 hover:bg-slate-50 transition-colors duration-200">
                          <div 
                            onClick={() => onViewPublicProfile && onViewPublicProfile(runnerId!)}
                            className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
                          >
                            <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs" />
                            <div className="text-start">
                              <span className="text-[9px] text-slate-400 block font-black uppercase tracking-wider">
                                {lang === 'ar' ? 'المساعد المعيَّن 🏃‍♂️' : 'Hired Assistant 🏃‍♂️'}
                              </span>
                              <span className="text-xs font-extrabold text-slate-800 leading-none flex items-center gap-1 mt-0.5">
                                {name}
                                <span className="text-amber-500 font-mono font-bold text-[10px]">★ 4.9</span>
                              </span>
                            </div>
                          </div>
                          
                          {quest.helperPhone && (
                            <a
                              href={`tel:${quest.helperPhone}`}
                              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              <Phone className="w-3.5 h-3.5 text-white animate-bounce" />
                              <span>{lang === 'ar' ? 'اتصال مباشر' : 'Direct Call'}</span>
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    {/* Applicants pipeline list */}
                    {isAvailable && quest.applicants && quest.applicants.length > 0 && (
                      <div className="p-4 bg-slate-50 border border-slate-150/50 rounded-2xl space-y-3.5 text-start">
                        <div className="text-[10px] font-black text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B7C] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3B7C]"></span>
                          </span>
                          <span>{lang === 'ar' ? `المتقدمون لتنفيذ المهمة (${quest.applicants.length})` : `Applicants (${quest.applicants.length})`}</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          {quest.applicants.map((app) => (
                            <button
                              key={app.userId}
                              onClick={() => setSelectedApplicantData({ quest, applicant: app })}
                              className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 py-2 px-4 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs hover:border-slate-400"
                            >
                              <img src={app.avatar} alt={app.name} className="w-5.5 h-5.5 rounded-full object-cover shadow-2xs border border-white" />
                              <span className="text-slate-800">{app.name}</span>
                              <span className="text-[10px] text-amber-500 font-mono font-black flex items-center gap-0.5">★ {app.rating || '5.0'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending proof view for creator verification */}
                    {isSubmitted && quest.proofImageUrl && (
                      <div className="p-4 bg-amber-50/30 border border-amber-200 rounded-2xl space-y-3 text-start">
                        <div className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600 fill-amber-500" />
                          <span>{lang === 'ar' ? 'صورة إثبات الإنجاز المرفوعة بواسطة المساعد:' : 'Visual completion proof uploaded:'}</span>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-amber-200 shadow-2xs max-h-56 bg-white flex items-center justify-center">
                          <img 
                            src={quest.proofImageUrl} 
                            alt="Proof of completion"
                            className="w-full object-cover max-h-56"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons footer */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-150/40 w-full">
                      <div className="flex gap-2 w-full">
                        {(((quest.status as string) === 'pending' || quest.status === 'open' || !quest.assignedRunnerId) && !quest.helperId && !showHistory) && (
                          <button
                            id={`delete-quest-btn-${quest.id}`}
                            onClick={() => setDeleteConfirmQuestId(quest.id)}
                            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150/55 font-extrabold text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-4 h-4 text-rose-500" />
                            <span>{lang === 'ar' ? 'إلغاء المنشور وحذف الطلب' : 'Cancel & Delete Post'}</span>
                          </button>
                        )}

                        {isClaimed && (
                          <div className="flex gap-2 w-full">
                            <button
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('open-chat', {
                                  detail: {
                                    chatId: `${quest.id}_${quest.creatorId}_${currentUserId}`,
                                    questTitle: quest.title,
                                    recipientName: quest.helperName,
                                    recipientAvatar: `https://api.dicebear.com/7.x/initials/svg?seed=${quest.helperName}&backgroundColor=f43f5e`
                                  }
                                }));
                              }}
                              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                            >
                              <MessageSquare className="w-4 h-4 text-emerald-400" />
                              <span>{lang === 'ar' ? 'مراسلة المساعد' : 'Message Assistant'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في إلغاء العقد وتحرير الارتباط؟' : 'Are you sure you want to force release and cancel contract?')) {
                                  if (onForceReleaseContract) {
                                    onForceReleaseContract(quest.id);
                                  }
                                }
                              }}
                              className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 hover:border-rose-200 font-bold text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <span>{lang === 'ar' ? 'إلغاء العقد الميداني' : 'Cancel Contract'}</span>
                            </button>
                          </div>
                        )}

                        {isSubmitted && (
                          <div className="w-full">
                            <button
                              onClick={() => {
                                setRatingQuestId(quest.id);
                                setRatingVal(5);
                                setRatingComment('');
                              }}
                              className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white font-extrabold text-xs py-3.5 rounded-2xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#FF3B7C]/15 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4.5 h-4.5 text-white" />
                              <span>{lang === 'ar' ? 'تأكيد إتمام العمل وتحرير الأموال' : 'Confirm Completion & Release Cash'}</span>
                            </button>
                          </div>
                        )}

                        {isFinished && (
                          <div className="w-full text-center bg-slate-50 py-3 rounded-2xl text-xs text-slate-400 font-bold border border-slate-150/50">
                            {lang === 'ar' ? 'تم الاكتمال والسداد بالكامل ✔️' : 'Completed and fully paid ✔️'}
                          </div>
                        )}
                      </div>

                      {onViewQuestDetail && (
                        <button
                          onClick={() => onViewQuestDetail(quest.id)}
                          className="w-full bg-[#1F2A44]/5 hover:bg-[#1F2A44]/10 text-[#1F2A44] border border-[#1F2A44]/10 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>{lang === 'ar' ? 'تفاصيل كاملة 🔗' : 'Full Details 🔗'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete/Cancel Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmQuestId && (
          <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-[99]" id="delete-confirm-modal">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-150"
            >
              <div className="w-12 h-12 bg-red-50 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              
              <h3 className="text-sm font-black tracking-wider text-[#1F2A44]" id="delete-modal-title">
                {lang === 'ar' ? 'هل أنت متأكد من حذف وإلغاء هذا الكويست؟' : 'Are you sure you want to delete and cancel this quest?'}
              </h3>
              
              <p className="text-xs text-gray-400 font-bold leading-relaxed">
                {lang === 'ar' 
                  ? 'سيتم إلغاء المنشور وإزالته نهائياً من قائمة الطلبات المتاحة، وستتم إعادة الرموز (Tokens) المستقطعة بالكامل وبشكل فوري إلى رصيدك.' 
                  : 'This post will be permanently canceled and removed, and all booking tokens will be refunded into your token balance immediately.'}
              </p>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  id="delete-modal-cancel"
                  onClick={() => setDeleteConfirmQuestId(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-150 hover:text-gray-700 text-gray-500 font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'تراجع ✕' : 'Cancel ✕'}
                </button>
                <button
                  type="button"
                  id="delete-modal-confirm"
                  onClick={() => {
                    const qId = deleteConfirmQuestId;
                    setDeleteConfirmQuestId(null);
                    onDeleteCreatedQuest(qId);
                  }}
                  className="flex-1 bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer shadow-md shadow-[#FF3B7C]/20"
                >
                  {lang === 'ar' ? 'نعم، حذف 🗑️' : 'Yes, Delete 🗑️'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Proof Submission Modal */}
      <AnimatePresence>
        {selectedProofQuest && (
          <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-150"
            >
              <div className="w-12 h-12 bg-[#4FC3F7]/10 text-[#4FC3F7] rounded-full flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6 text-[#4FC3F7]" />
              </div>
              
              <h3 className="text-xs font-black tracking-wider uppercase text-[#1F2A44]">
                {lang === 'ar' ? 'إرفاق إثبات العمل الميداني' : 'Attach Photographic Proof of Completion'}
              </h3>
              
              <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
                {lang === 'ar' 
                  ? 'يرجى التقاط أو اختيار صورة توضح تسليم الأغراض أو إتمام العمل ليقوم منشئ الكويست بإطلاق المبلغ النامي.' 
                  : 'Submit a real-time photograph showing the completed work. The Godfather will view this to release your cash reward.'}
              </p>

              {/* Sky Blue Camera Upload Zone */}
              <input 
                type="file" 
                id="helper-proof-picker"
                ref={proofInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleHelperFileChange}
              />

              <label
                htmlFor="helper-proof-picker"
                className={`w-full h-36 rounded-2xl border-2 border-dashed border-[#4FC3F7] bg-sky-50/30 hover:bg-sky-50/50 flex flex-col items-center justify-center p-4 transition-all active:scale-98 cursor-pointer relative overflow-hidden select-none block ${helperUploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                {helperUploading ? (
                  <div className="space-y-2 w-full flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 border-t-[#4FC3F7] border-gray-200 animate-spin flex items-center justify-center">
                      <span className="text-[8px] text-[#4FC3F7] font-black">{helperProgress}%</span>
                    </div>
                    <span className="text-[10px] text-[#4FC3F7] font-extrabold px-3 py-1 bg-white rounded-full shadow-sm">
                      Compressing gallery image...
                    </span>
                    <div className="w-2/3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="bg-[#4FC3F7] h-full transition-all duration-100" style={{ width: `${helperProgress}%` }}></div>
                    </div>
                  </div>
                ) : selectedProofFile ? (
                  <div className="absolute inset-0">
                    <img src={selectedProofFile} className="w-full h-full object-cover" alt="Selected proof preview" />
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white">
                      <Camera className="w-6 h-6 mb-1 text-[#4FC3F7]" />
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#4FC3F7] text-white px-2.5 py-1 rounded-full">
                        {lang === 'ar' ? 'تغيير صورة الإثبات' : 'Change completion photo'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#4FC3F7]/10 text-[#4FC3F7] flex items-center justify-center mx-auto">
                      <Image className="w-5 h-5 mx-auto" />
                    </div>
                    <span className="text-xs font-black text-[#4FC3F7] block">
                      {lang === 'ar' ? 'افتح الهاتف لاختيار إثبات العمل' : 'Select Proof from Gallery'}
                    </span>
                    <span className="text-[9px] text-gray-400 block uppercase font-mono">Native Photo Gallery ONLY</span>
                  </div>
                )}
              </label>

              <div className="space-y-2 pt-2">
                <button
                  onClick={executeProofUpload}
                  disabled={helperUploading}
                  className="w-full bg-[#1F2A44] hover:bg-[#2c3c61] text-[#FFD34D] font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {lang === 'ar' ? 'إرسال الملف للإثبات الفوري' : 'Lock Proof and Submit Chores'}
                </button>
                <button
                  onClick={() => setSelectedProofQuest(null)}
                  className="w-full text-gray-400 hover:text-gray-600 text-[10px] font-semibold cursor-pointer"
                >
                  {dict.cancelBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Form Modal: Host Quest */}
      <AnimatePresence>
        {false && showCreateModal && (
          <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              <div className="bg-[#1F2A44] text-white p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-sm">{dict.createNewQuestTitle}</h3>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white cursor-pointer select-none">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
                {/* Thin sleek animated horizontal progress bar only */}
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-[#FF3B7C] to-[#4FC3F7] transition-all duration-300 rounded-full"
                    style={{ width: `${(createStep / 8) * 100}%` }}
                  />
                </div>

                <AnimatePresence mode="wait">
                  {/* Step 1: Title */}
                  {createStep === 1 && (
                    <motion.div 
                      key="step-1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'عنوان المهمة' : 'Quest Title'}
                        </label>
                      </div>

                      <input 
                        type="text" 
                        required 
                        placeholder={lang === 'ar' ? 'مثال: صيانة مكيف بالجزائر العاصمة...' : 'e.g. AC Maintenance in Algiers...'}
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-[#FF3B7C] rounded-xl text-xs font-bold focus:outline-none transition-colors shadow-inner"
                      />

                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <button 
                          type="button" 
                          onClick={() => { setShowCreateModal(false); setCreateStep(1); }} 
                          className="text-gray-400 hover:text-gray-600 text-[10px] font-bold"
                        >
                          {dict.cancelBtn}
                        </button>
                        <button
                          type="button"
                          disabled={!newTitle.trim()}
                          onClick={() => setCreateStep(2)}
                          className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
                        >
                          <span>{lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Description / Requirements */}
                  {createStep === 2 && (
                    <motion.div 
                      key="step-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'المواصفات والطلبات بالتفصيل' : 'Requirements & Details'}
                        </label>
                      </div>

                      <textarea 
                        required 
                        rows={3}
                        placeholder={lang === 'ar' ? 'مثال: نأمل إحضار مفتاح رقم ١٢، والتأكد من شحن الغاز...' : 'e.g. Please bring size 12 wrench, and check gas pressure...'}
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-[#FF3B7C] rounded-xl text-xs font-bold focus:outline-none transition-colors shadow-inner"
                      />

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(1)}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                        <button
                          type="button"
                          disabled={!newDesc.trim()}
                          onClick={() => setCreateStep(3)}
                          className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Location / GPS */}
                  {createStep === 3 && (
                    <motion.div 
                      key="step-3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'تحديد الموقع الجغرافي 📍' : 'Location Coordinates 📍'}
                        </label>
                      </div>

                      <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-150">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-gray-500 uppercase">GPS Sensor</span>
                          <button
                            type="button"
                            onClick={handleAutoTagLocation}
                            className="px-3 py-1.5 rounded-lg bg-[#FF3B7C] text-white text-[10px] font-black flex items-center gap-1 hover:bg-[#FF3B7C]/95 transition-all cursor-pointer shadow-xs border-none"
                          >
                            <span>{gpsLoading ? (lang === 'ar' ? 'جاري التحديد...' : 'Tagging...') : (lang === 'ar' ? '🎯 تلقائي GPS' : '🎯 Auto-Tag GPS')}</span>
                          </button>
                        </div>

                        {gpsCoords ? (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-700 font-extrabold flex justify-between items-center animate-in fade-in">
                            <span className="font-mono tracking-wider">Tagged: {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}</span>
                            <span className="text-[8px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{lang === 'ar' ? 'مؤكد' : 'Tagged'}</span>
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-[9px] text-[#FF3B7C] font-semibold leading-relaxed">
                            {lang === 'ar' 
                              ? '⚠️ يرجى الضغط على زر تلقائي GPS لتفعيل المستشعر وتحديد الموقع.' 
                              : '⚠️ Please press Auto-Tag GPS to capture location coordinates.'}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(2)}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                        <button
                          type="button"
                          disabled={!gpsCoords}
                          onClick={() => setCreateStep(4)}
                          className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Category Selection */}
                  {createStep === 4 && (
                    <motion.div 
                      key="step-4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'تصنيف المهمة 🏷️' : 'Quest Category 🏷️'}
                        </label>
                      </div>

                      <div className="space-y-1">
                        <select 
                          value={newCat} 
                          onChange={(e) => setNewCat(e.target.value as QuestCategory)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#FF3B7C]"
                        >
                          {CATEGORIES_LIST.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(3)}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateStep(5)}
                          className="px-5 py-2.5 bg-[#1F2A44] text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 5: Urgency Tier */}
                  {createStep === 5 && (
                    <motion.div 
                      key="step-5"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'درجة الاستعجال ⚡' : 'Urgency Tier ⚡'}
                        </label>
                      </div>

                      <div className="space-y-1">
                        <select 
                          value={newUrgency} 
                          onChange={(e) => setNewUrgency(e.target.value as any)}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#FF3B7C]"
                        >
                          <option value="normal">{lang === 'ar' ? 'عادي (Normal)' : 'Normal'}</option>
                          <option value="urgent">{lang === 'ar' ? 'عاجل 🔥 (Urgent)' : 'Urgent 🔥'}</option>
                          <option value="featured">{lang === 'ar' ? 'مميز ⭐ (Featured)' : 'Featured ⭐'}</option>
                        </select>
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(4)}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateStep(6)}
                          className="px-5 py-2.5 bg-[#1F2A44] text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 6: Reward Budget (DZD) */}
                  {createStep === 6 && (
                    <motion.div 
                      key="step-6"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'مبلغ المكافأة المقترحة بالدينار الجزائري 💰' : 'Proposed Reward in DZD 💰'}
                        </label>
                      </div>

                      <div className="space-y-1">
                        <div className="relative">
                          <input 
                            type="number" 
                            min="500" 
                            max="10000" 
                            required
                            value={newCash === 0 ? '' : newCash}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewCash(val === '' ? 0 : Math.max(0, Number(val)));
                            }}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black font-mono focus:outline-none focus:border-[#FF3B7C]"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-[11px] mr-[100px]">DZD (DA)</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-semibold leading-tight">
                          {lang === 'ar' ? 'عمولة المنصة ١٠٪ (خصم من المكافأة)' : '10% platform fee deduction applies.'}
                        </p>
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(5)}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                        <button
                          type="button"
                          disabled={newCash < 500}
                          onClick={() => setCreateStep(7)}
                          className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 7: Helpers & Crew Size */}
                  {createStep === 7 && (
                    <motion.div 
                      key="step-7"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'عدد المساعدين الميدانيين المطلوبين 👥' : 'Required Helpers count 👥'}
                        </label>
                      </div>

                      <div className="space-y-1">
                        <input 
                          type="number" 
                          min="1" 
                          max="5"
                          required
                          value={newRequiredWorkerCount === 0 ? '' : newRequiredWorkerCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRequiredWorkerCount(val === '' ? 0 : Math.max(0, Number(val)));
                          }}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black font-mono focus:outline-none focus:border-[#FF3B7C]"
                        />
                        <p className="text-[9px] text-slate-400 font-medium leading-none pt-1">
                          {lang === 'ar' 
                            ? 'العدد المسموح به: من ١ إلى ٥ مساعدين.'
                            : 'Allowed helper range is between 1 and 5.'}
                        </p>
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCreateStep(6)}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                        <button
                          type="button"
                          disabled={newRequiredWorkerCount < 1}
                          onClick={() => setCreateStep(8)}
                          className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          {lang === 'ar' ? 'التالي ➡️' : 'Next ➡️'}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 8: Photos & Final Review before Posting */}
                  {createStep === 8 && (
                    <motion.div 
                      key="step-8"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4 text-start pt-1"
                    >
                      <div className="space-y-1">
                        <label className="text-xs font-black text-[#1F2A44] block">
                          {lang === 'ar' ? 'أضف صوراً توضيحية للموقع أو السلعة 📸' : 'Add Quest Clarifying Photos 📸'}
                        </label>
                      </div>

                      {/* Photo upload component with preview */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <input 
                            type="file" 
                            id="contract-image-picker"
                            ref={contractInputRef}
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleContractFileChange}
                          />

                          <label
                            htmlFor="contract-image-picker"
                            className={`h-16 rounded-xl border-2 border-dashed border-[#4FC3F7] bg-sky-50/40 hover:bg-sky-55 flex flex-col items-center justify-center p-1 cursor-pointer transition-all active:scale-95 text-center group font-black select-none block ${bountyUploading ? 'pointer-events-none opacity-50' : ''}`}
                          >
                            {bountyUploading ? (
                              <div className="space-y-1">
                                <span className="text-[10px] text-[#4FC3F7] animate-pulse block">Compressing...</span>
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden mx-auto">
                                  <div className="bg-[#4FC3F7] h-full transition-all" style={{ width: `${bountyProgress}%` }}></div>
                                </div>
                                <span className="text-[8px] text-gray-400 block">{bountyProgress}%</span>
                              </div>
                            ) : (
                              <>
                                <Image className="w-4 h-4 text-[#4FC3F7] mx-auto" />
                                <span className="text-[8px] text-[#4FC3F7] font-black mt-1 leading-tight block">
                                  {lang === 'ar' ? 'معرض الصور' : 'Device Gallery'}
                                </span>
                              </>
                            )}
                          </label>

                          {newQuestImages.map((url, idx) => (
                            <div key={idx} className="h-16 rounded-xl overflow-hidden border border-gray-200 relative group bg-gray-50 shadow-xs">
                              <img src={url} alt={`Quest upload ${idx}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setNewQuestImages(newQuestImages.filter((_, i) => i !== idx))}
                                className="absolute -top-1 -right-1 bg-[#FF3B7C] text-white rounded-full w-4 h-4 text-[9px] font-black flex items-center justify-center shadow-md select-none hover:bg-red-700"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Brief visual review card of all steps */}
                      <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-2xl space-y-2 text-[10.5px]">
                        <span className="text-[9px] font-black text-gray-400 block uppercase tracking-wider">
                          {lang === 'ar' ? 'ملخص العقد المراد نشره:' : 'Bounty Summary Statement:'}
                        </span>
                        
                        <div className="space-y-1.5 font-bold text-slate-700">
                          <div className="flex justify-between">
                            <span className="text-[#1F2A44] truncate max-w-[180px]">{newTitle}</span>
                            <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'عنوان المهمة:' : 'Title:'}</span>
                          </div>
                          <div className="flex justify-between border-t border-black/5 pt-1.5">
                            <span className="text-[#FF3B7C] font-mono">{newCash} DZD</span>
                            <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'المكافأة المقترحة:' : 'Proposed Reward:'}</span>
                          </div>
                          <div className="flex justify-between border-t border-black/5 pt-1.5">
                            <span className="text-slate-600 font-medium truncate max-w-[180px]">{newDesc}</span>
                            <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'المتطلبات الأساسية:' : 'Requirements:'}</span>
                          </div>
                          <div className="flex justify-between border-t border-black/5 pt-1.5">
                            <span className="bg-sky-100 text-sky-800 text-[9px] px-1.5 py-0.5 rounded font-black font-mono">
                              {newRequiredWorkerCount} helpers
                            </span>
                            <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'عدد المساعدين:' : 'Assistants:'}</span>
                          </div>
                          <div className="flex justify-between border-t border-black/5 pt-1.5">
                            <span className="font-mono text-emerald-600">
                              {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : 'N/A'}
                            </span>
                            <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'إحداثيات الموقع:' : 'GPS Tag:'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-150">
                        <button 
                          type="submit" 
                          disabled={!gpsCoords}
                          className={`w-full font-black py-3 rounded-xl text-xs shadow-md select-none transition-all ${
                            gpsCoords 
                              ? 'bg-[#1F2A44] text-[#FFD34D] cursor-pointer hover:bg-[#1A253C]' 
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                          }`}
                        >
                          {gpsCoords 
                            ? (lang === 'ar' ? 'تأكيد وإصدار العقد الميداني الآن 🚀' : 'Confirm & Publish Field Contract 🚀')
                            : (lang === 'ar' ? '⚠️ يرجى العودة لخطوة تحديد الموقع GPS' : '⚠️ Missing verified coordinates')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateStep(7)}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-[10px] py-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? '⬅️ السابق' : '⬅️ Back'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Godfather Rating Review popup dialog upon Confirm Payout */}
      <AnimatePresence>
        {ratingQuestId && (
          <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-150 text-center"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
              </div>
              
              <h3 className="text-sm font-black uppercase text-[#1F2A44]">
                {lang === 'ar' ? 'تأكيد التسليم وتقييم أداء الرانر' : 'Confirm & Review Mercenary'}
              </h3>
              
              <p className="text-xs text-slate-400 font-bold leading-normal">
                {lang === 'ar' 
                  ? 'يرجى وضع مراجعتك وتقييمك ليعزز بورتفوليو الرانر ويُسهم في رفع ترتيبه في قائمة المتصدرين الوطنية.' 
                  : 'Submit a verified star rating and testimonial statement to permanently endorse the runner in their public social portfolio.'}
              </p>

              {/* Stars selection */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setRatingVal(starVal)}
                    className="p-1 cursor-pointer transition-all active:scale-125 select-none"
                  >
                    <Star 
                      className={`w-7 h-7 transition-colors ${
                        starVal <= ratingVal ? 'fill-[#FFD34D] text-[#FFD34D]' : 'text-gray-200'
                      }`} 
                    />
                  </button>
                ))}
              </div>

              {/* Testimonial comments text shape */}
              <div className="space-y-1 text-right">
                <label className="text-[9px] font-black text-gray-400 uppercase">
                  {lang === 'ar' ? 'كلمة شكر وشهادة عمل بالتجربة' : 'Godfather Testimonial Comment'}
                </label>
                <textarea
                  rows={2}
                  maxLength={140}
                  placeholder={lang === 'ar' ? 'مثال: أداء رائع وسريع في الموعد أنصح به!' : 'e.g. Excellent work and super polite! Highest yield recommendation.'}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none"
                />
              </div>

              {/* Confirmation CTAs */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    onConfirmPayout(ratingQuestId, ratingVal, ratingComment);
                    setRatingQuestId(null);
                  }}
                  className="w-full bg-[#1F2A44] hover:bg-[#1E2E4E] text-[#FFD34D] font-extrabold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md shadow-[#1F2A44]/15"
                >
                  {lang === 'ar' ? 'تأكيد التسليم النهائي وحفظ التقييم' : 'Finalize Contract & Write Review'}
                </button>
                <button
                  onClick={() => setRatingQuestId(null)}
                  className="w-full text-gray-400 hover:text-gray-600 text-[10px] font-semibold cursor-pointer py-1"
                >
                  {dict.cancelBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Native Floating Local Notice Card */}
      <AnimatePresence>
        {localToast && (
          <div className="fixed bottom-24 left-4 right-4 z-50 flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 text-white text-[11px] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-sm pointer-events-auto leading-relaxed font-bold font-sans"
            >
              <div className="w-4 h-4 rounded-full bg-[#4FC3F7]/20 flex items-center justify-center text-[#4FC3F7] shrink-0 font-black">
                ✓
              </div>
              <span>{localToast}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. Applicant Profile Preview Modal */}
      <AnimatePresence>
        {selectedApplicantData && (
          <div className="fixed inset-0 bg-[#1F2A44]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-150 relative text-[#1F2A44]"
            >
              <button 
                onClick={() => setSelectedApplicantData(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div 
                onClick={() => {
                  if (onViewPublicProfile) {
                    onViewPublicProfile(selectedApplicantData.applicant.userId);
                    setSelectedApplicantData(null);
                  }
                }}
                className="mx-auto w-20 h-20 rounded-full overflow-hidden border-2 border-[#FFD34D] shadow-md bg-slate-50 flex items-center justify-center cursor-pointer hover:scale-105 transition-all"
              >
                <img src={selectedApplicantData.applicant.avatar} alt={selectedApplicantData.applicant.name} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-1 font-sans">
                <h3 
                  onClick={() => {
                    if (onViewPublicProfile) {
                      onViewPublicProfile(selectedApplicantData.applicant.userId);
                      setSelectedApplicantData(null);
                    }
                  }}
                  className="font-extrabold text-[#FF3B7C] text-md cursor-pointer hover:underline transition-all"
                >
                  {selectedApplicantData.applicant.name}
                </h3>
                <div className="flex items-center justify-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-black font-mono">{selectedApplicantData.applicant.rating || '5.0'} / 5.0</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">{lang === 'ar' ? 'العقود المكتملة' : 'Completed Quests'}</span>
                  <span className="text-sm font-black text-[#1F2A44] font-mono">{selectedApplicantData.applicant.questsCompleted || 0}</span>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">{lang === 'ar' ? 'الشرف والمستوى' : 'Level'}</span>
                  <span className="text-xs font-black text-rose-500 flex items-center gap-1">
                    <Award className="w-4.5 h-4.5" />
                    <span>Bronze</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    const { quest, applicant } = selectedApplicantData;
                    onAcceptApplicant(quest.id, applicant.userId);
                    setSelectedApplicantData(null);
                  }}
                  className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white font-extrabold text-xs py-3 rounded-xl transition-all shadow-md shadow-[#FF3B7C]/15 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Award className="w-4 h-4 text-white" />
                  <span className="text-white">{lang === 'ar' ? 'قبول العامل وتفعيل العقد 🤝' : 'Accept Worker and Activate Contract 🤝'}</span>
                </button>

                <button
                  disabled
                  title={lang === 'ar' ? 'تفتح المحادثة تلقائياً بمجرد قبولك وقفل العقد لحماية خصوصية الطرفين.' : 'Chat unlocks after contract activation.'}
                  className="w-full bg-slate-300 text-slate-500 font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>{lang === 'ar' ? 'الدردشة مغلقة (تفتح بعد التعيين) 🔒' : 'Chat Locked (Unlocks post-assignment) 🔒'}</span>
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
