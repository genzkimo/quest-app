import React, { useState, useRef, useEffect } from 'react';
import { isQuestExpired } from '../utils/questExpiry';
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
	Settings,
 Star,
 Image,
 Camera,
 MessageSquare,
 Send,
 Award,
 History,
 PhoneCall,
 Lock,
 Navigation,
 Phone,
 Zap,
 XCircle,
 FolderArchive,
 Filter,
 ShieldAlert,
 Frown
} from 'lucide-react';
import { Quest, QuestCategory, UserProfile, Applicant } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { translations } from '../data/translations';
import { formatArabicDate } from '../utils/dateFormatter';
import { resolveNeighborhoodFromCoords, cleanLocationName } from '../utils/locationFormatter';
import { compressImage } from '../utils/imageCompressor';
import StandardImageLightbox from './StandardImageLightbox';
import { Geolocator } from '../utils/geolocator';
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
 onRejectApplicant?: (questId: string, applicantId: string) => void;
 onViewPublicProfile?: (userId: string) => void;
 deferredActiveChat?: any;
 onClearDeferredChat?: () => void;
 initialTab?: 'obligations' | 'created' | null;
 onClearInitialTab?: () => void;
 onViewQuestDetail?: (questId: string) => void;
 initialSelectedQuestId?: string | null;
 onClearInitialSelectedQuest?: () => void;
 onForceReleaseContract?: (questId: string) => void;
  onRequestEndWork?: (questId: string, reason?: string) => void;
  onConfirmEndWork?: (questId: string) => void;
  onRejectEndWork?: (questId: string) => void;
 onSendPushNotification?: (recipientId: string, title: string, body: string, data?: Record<string, string>) => void;
 autoOpenCreate?: boolean;
 onClearAutoOpenCreate?: () => void;
 setQuests?: (quests: Quest[]) => void;
 onArrivedAtQuest?: (questId: string) => void;
 onNavigateToProfileSubmenu?: (tab: string) => void;
  onStartNavigation?: (quest: Quest) => void;
}

const CATEGORIES_LIST: QuestCategory[] = [
 'صيانة', 'توصيل', 'تعليم', 'تسوق', 'تقنية', 'مساعدة منزلية', 'رعاية أليفة', 'أخرى'
];

function MyQuestsView({
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
 onRejectApplicant,
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
 onArrivedAtQuest,
 onNavigateToProfileSubmenu,
 onRequestEndWork,
 onConfirmEndWork,
 onRejectEndWork
}: MyQuestsViewProps) {
  const [endWorkQuestModal, setEndWorkQuestModal] = useState<Quest | null>(null);
  const [endWorkReasonText, setEndWorkReasonText] = useState("");
  const scrolledQuestIdRef = useRef<string | null>(null);
 const activeQuestCount = userProfile?.hasActiveQuest === false ? 0 : quests.filter(q => q.creatorId === currentUserId && !['completed', 'cancelled', 'cancelled_by_timeout', 'stale_cleared', 'expired', 'terminated', 'archived'].includes(q.status) && !q.archived && !isQuestExpired(q)).length;
 const [activeTab, setActiveTab] = useState<'obligations' | 'created'>(initialTab || 'obligations');

 const handleRefresh = async () => {
 try {
 const questsQuery = query(collection(db, 'quests'), orderBy('createdAt', 'desc'), limit(300));
 const questsSnapshot = await getDocs(questsQuery);
 const fetchedQuests: Quest[] = [];
 questsSnapshot.forEach((doc) => {
   const qData = { id: doc.id, ...doc.data() } as Quest;
   if (!isQuestExpired(qData)) {
     fetchedQuests.push(qData);
   }
 });
 if (setQuests && fetchedQuests.length > 0) {
 setQuests(fetchedQuests);
 }
 } catch (error) {
 console.error("Failed to refresh quests in MyQuestsView:", error);
 showToast(lang === 'ar' ? ' فشل تحديث البيانات.' : ' Failed to update data.');
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
 ? 'لا يمكنك نشر أكثر من مهمة واحدة نشطة في نفس الوقت ' 
 : lang === 'fr'
 ? "Vous ne pouvez publier qu'une seule tâche active à la fois "
 : 'You can only have one active published quest at a time '
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
 const [lightboxImage, setLightboxImage] = useState<string | null>(null);
 const [lightboxMeta, setLightboxMeta] = useState<{ title?: string; subtitle?: string; caption?: string } | null>(null);

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

 // Listen to initialTab prop updates only if explicitly passed
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      if (onClearInitialTab) {
        onClearInitialTab();
      }
    }
  }, [initialTab, onClearInitialTab]);

 useEffect(() => {
    if (initialSelectedQuestId && onClearInitialSelectedQuest) {
      onClearInitialSelectedQuest();
    }
  }, [initialSelectedQuestId, onClearInitialSelectedQuest]);

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

 const handleAutoTagLocation = async () => {
 setGpsLoading(true);
 showToast(lang === 'ar' ? ' جاري الاتصال بمستشعر الـ GPS...' : ' Connecting GPS sensor...');

 try {
 const accurate = await Geolocator.getAccuratePhysicalLocation();
 const coords = {
 lat: accurate.lat,
 lng: accurate.lng
 };
 setGpsCoords(coords);
 Geolocator.saveCachedLocation(coords.lat, coords.lng);
 const resLoc = resolveNeighborhoodFromCoords(coords.lat, coords.lng, '', lang);
 if (resLoc) setNewLoc(resLoc);
 showToast(
 lang === 'ar'
 ? ` تم التقاط الموقع بدقة (±${Math.round(accurate.accuracy)}م)!`
 : ` GPS location tagged!`
 );
 } catch (error) {
 console.warn("GPS tagging fallback notice:", error);
 const cached = Geolocator.getCachedLocation();
 if (cached) {
 setGpsCoords(cached);
 const resLoc = resolveNeighborhoodFromCoords(cached.lat, cached.lng, '', lang);
 if (resLoc) setNewLoc(resLoc);
 } else {
 setGpsCoords(null);
 }
 showToast(
 lang === 'ar' ? ' تم تحديد الموقع الجغرافي' : ' Location tagged'
 );
 } finally {
 setGpsLoading(false);
 }
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
 ? ' يمكنك إرفاق ما يصل إلى 3 صور كحد أقصى!'
 : ' You can attach up to 3 images maximum!'
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
 ? ' تم الوصول للحد الأقصى (3 صور)!'
 : ' Maximum of 3 images reached!'
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
 ? ` تم ضغط وتجهيز ${fileCount} صور بنجاح!` 
 : ` Successfully compressed and attached ${fileCount} images!`
 );
 } else {
 setBountyProgress(p);
 }
 }, 60);

 } catch (err: any) {
 console.error(err);
 setBountyUploading(false);
 showToast(lang === 'ar' ? ' حدث فشل أثناء ضغط ملفات المعرض' : ' Error compressing selected gallery photographs');
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
 ? ' تم إدخال الإثبات بنجاح بعد ضغطه وتعديل مقاساته لـ 1080x1080!'
 : ' Photo selected from Gallery and compressed to 1080px (70% Quality)!'
 );
 }, 100);

 } catch (err: any) {
 console.error(err);
 setHelperUploading(false);
 showToast(lang === 'ar' ? ' فشل تحميل وضغط ملف الإثبات' : ' Verification proof processing failed');
 }
 };

 // Payout star rating variables state
 const [ratingQuestId, setRatingQuestId] = useState<string | null>(null);
 const [ratingVal, setRatingVal] = useState<number>(5);
 const [ratingComment, setRatingComment] = useState<string>('');

 const dict = translations[lang];
 const isRtl = lang === 'ar';

 const isHistoryStatus = (status: string) => {
 return ['completed', 'cancelled', 'expired', 'cancelled_by_timeout', 'stale_cleared', 'terminated', 'archived', 'withdrawn'].includes(status);
 };

 const isActiveStatus = (status: string) => {
 return !isHistoryStatus(status);
 };

 const obligations = quests.filter(q => 
 (q.helperId === currentUserId || q.assignedRunnerId === currentUserId || q.assignedRunnerIds?.includes(currentUserId) || q.employeeId === currentUserId) && 
 (showHistory ? (isHistoryStatus(q.status) || q.archived) : (isActiveStatus(q.status) && !q.archived && !isQuestExpired(q)))
 );

 const createdQuests = quests.filter(q => 
 (q.creatorId === currentUserId) && 
 (showHistory ? (isHistoryStatus(q.status) || q.archived || isQuestExpired(q)) : (isActiveStatus(q.status) && !q.archived && !isQuestExpired(q)))
 );

  const appliedQuests = quests.filter(q => {
    if (isQuestExpired(q) || q.status === 'expired' || q.status === 'stale_cleared' || q.status === 'cancelled_by_timeout') return false;
    if (q.archived) return false;
    if (['completed', 'cancelled', 'cancelled_by_timeout', 'stale_cleared', 'expired', 'terminated'].includes(q.status)) return false;

    const isAlreadyAssigned = q.helperId === currentUserId || 
      q.assignedRunnerId === currentUserId || 
      q.employeeId === currentUserId || 
      (q.assignedRunnerIds && q.assignedRunnerIds.includes(currentUserId));
    if (isAlreadyAssigned) return false;

    const isApplicant = (q.applicants?.some(a => a.userId === currentUserId)) || 
      (q.jobApplicants?.some(a => a.applicantId === currentUserId));
    if (!isApplicant) return false;

    return true;
  });

  const handleCancelApplicant = async (questId: string) => {
    try {
      const questRef = doc(db, 'quests', questId);
      const questSnap = await getDoc(questRef);
      if (questSnap.exists()) {
        const qData = questSnap.data() as Quest;
        const updatedApplicants = (qData.applicants || []).filter(a => a.userId !== currentUserId);
        await setDoc(questRef, { applicants: updatedApplicants }, { merge: true });
        if (setQuests) {
          setQuests(quests.map(q => q.id === questId ? { ...q, applicants: updatedApplicants } : q));
        }
        showToast(lang === 'ar' ? 'تم إلغاء طلب الحجز بنجاح' : 'Booking request cancelled');
      }
    } catch (err) {
      console.error("Failed to cancel applicant request:", err);
      showToast(lang === 'ar' ? 'حدث خطأ أثناء إلغاء الطلب' : 'Failed to cancel request');
    }
  };

 const [archiveFilter, setArchiveFilter] = useState<'all' | 'quick' | 'long_term' | 'completed' | 'finished'>('all');

 const applyArchiveFilter = (questList: Quest[]) => {
 if (!showHistory) return questList;
 return questList.filter(q => {
 if (archiveFilter === 'all') return true;
 if (archiveFilter === 'quick') {
 return q.questType === 'quick' || (q as any).isQuickTask || q.questType !== 'long_term';
 }
 if (archiveFilter === 'long_term') {
 return q.questType === 'long_term';
 }
 if (archiveFilter === 'completed') {
 return q.status === 'completed';
 }
 if (archiveFilter === 'finished') {
 return q.status !== 'completed';
 }
 return true;
 });
 };

 const getArchiveCounts = (questList: Quest[]) => {
 return {
 all: questList.length,
 quick: questList.filter(q => q.questType === 'quick' || (q as any).isQuickTask || q.questType !== 'long_term').length,
 long_term: questList.filter(q => q.questType === 'long_term').length,
 completed: questList.filter(q => q.status === 'completed').length,
 finished: questList.filter(q => q.status !== 'completed').length,
 };
 };

 const displayObligations = applyArchiveFilter(obligations);
 const displayCreatedQuests = applyArchiveFilter(createdQuests);

 const handleCreateSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!newTitle || !newDesc) return;

 if (!gpsCoords) {
 showToast(lang === 'ar' ? ' يرجى تحديد موقعك الجغرافي أولاً' : ' Please tag your GPS location first');
 return;
 }
 const lat = gpsCoords.lat;
 const lng = gpsCoords.lng;
 const locString = newLoc.trim() || resolveNeighborhoodFromCoords(lat, lng, '', lang);

 onPostNewQuest({
 title: newTitle,
 description: newDesc,
 location: locString,
 category: newCat,
 cashReward: Number(newCash),
 bookingFeeDA: Math.max(50, Math.round(Number(newCash) * 0.10)),
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
 showToast(lang === 'ar' ? ' يرجى رفع أو التقاط صورة إثبات من جهازك أولاً!' : ' Please upload or take a proof photo from your device first!');
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
 <div className="space-y-6 pt-[max(3.25rem,calc(env(safe-area-inset-top,0px)+2.25rem))] pb-36 font-sans text-[#1F2A44] px-3 sm:px-6 w-full" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
 
 {/* Stable Persistent Tabs (Fixed Order: مهامي then طلباتي) */}
  <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 items-center gap-2">
    {/* Tab 1: مهامي (Obligations & Booking Requests) */}
    <button
      id="tab-obligations"
      onClick={() => setActiveTab('obligations')}
      className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
        activeTab === 'obligations' 
          ? 'bg-[#1F2A44] text-[#FFD34D] shadow-md shadow-[#1F2A44]/25 scale-[1.01]' 
          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Briefcase className="w-4 h-4 shrink-0 text-[#38BDF8]" />
      <span className="truncate">
        {lang === 'ar' ? 'مهامي الميدانية' : lang === 'fr' ? 'Mes Missions' : 'My Jobs'} ({obligations.length})
      </span>
      {appliedQuests.length > 0 && (
        <span className="text-[10px] bg-[#FFD34D] text-[#1F2A44] font-black px-2 py-0.5 rounded-full shrink-0 shadow-xs">
          {appliedQuests.length} {lang === 'ar' ? 'معلقة' : 'pending'}
        </span>
      )}
    </button>

    {/* Tab 2: طلباتي (Created Quests) */}
    <button
      id="tab-created"
      onClick={() => setActiveTab('created')}
      className={`flex-1 py-3 px-3 sm:px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
        activeTab === 'created' 
          ? 'bg-[#1F2A44] text-[#FFD34D] shadow-md shadow-[#1F2A44]/25 scale-[1.01]' 
          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Plus className="w-4 h-4 shrink-0 text-[#FF3B7C]" />
      <span className="truncate">
        {lang === 'ar' ? 'طلباتي المنشورة' : lang === 'fr' ? 'Mes Primes' : 'My Posts'} ({createdQuests.length})
      </span>
    </button>
  </div>

  {/* Archive Warning & Indicator and Navigation Back Button */}
 {showHistory && (
 <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-900 animate-fadeIn shadow-sm">
 <div className="flex items-center gap-3">
 <History className="w-6 h-6 text-amber-600 shrink-0" />
 <div className="text-start space-y-0.5">
 <span className="text-sm font-black block">
 {lang === 'ar' ? 'أنت تعرض حالياً سجل الأرشيف والتاريخ ' : 'Viewing History & Archived Records '}
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
 {lang === 'ar' ? 'الرجوع للعقود النشطة ' : 'Back to Active Contracts '}
 </button>
 </div>
 )}

 {/* Smart Archive Filter Pills */}
 {showHistory && (
 <div className="bg-white border border-amber-200/80 rounded-2xl p-3 space-y-2 shadow-xs animate-fadeIn">
 <div className="flex items-center justify-between text-xs font-black text-amber-900 px-1">
 <div className="flex items-center gap-1.5">
 <Filter className="w-3.5 h-3.5 text-amber-600 shrink-0" />
 <span>{lang === 'ar' ? 'تصنيف وتصفية الأرشيف الذكية:' : 'Smart Archive Categories:'}</span>
 </div>
 <span className="text-[10px] text-amber-700/80 font-bold">
 {lang === 'ar' ? 'اختر فئة للعرض' : 'Select category'}
 </span>
 </div>

 <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
 <button
 type="button"
 onClick={() => setArchiveFilter('all')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
 archiveFilter === 'all'
 ? 'bg-[#1F2A44] text-white shadow-xs scale-[1.02]'
 : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
 }`}
 >
 <FolderArchive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
 <span>{lang === 'ar' ? 'الكل' : 'All'}</span>
 <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
 archiveFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
 }`}>
 {(activeTab === 'obligations' ? getArchiveCounts(obligations).all : getArchiveCounts(createdQuests).all)}
 </span>
 </button>

 <button
 type="button"
 onClick={() => setArchiveFilter('quick')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
 archiveFilter === 'quick'
 ? 'bg-[#FF3B7C] text-white shadow-xs scale-[1.02]'
 : 'bg-rose-50 text-rose-800 hover:bg-rose-100/80 border border-rose-150'
 }`}
 >
 <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
 <span>{lang === 'ar' ? 'مهمات سريعة' : 'Quick Tasks'}</span>
 <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
 archiveFilter === 'quick' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
 }`}>
 {(activeTab === 'obligations' ? getArchiveCounts(obligations).quick : getArchiveCounts(createdQuests).quick)}
 </span>
 </button>

 <button
 type="button"
 onClick={() => setArchiveFilter('long_term')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
 archiveFilter === 'long_term'
 ? 'bg-sky-700 text-white shadow-xs scale-[1.02]'
 : 'bg-sky-50 text-sky-800 hover:bg-sky-100/80 border border-sky-150'
 }`}
 >
 <Briefcase className="w-3.5 h-3.5 text-sky-300 shrink-0" />
 <span>{lang === 'ar' ? 'عقود طويلة المدى' : 'Long-term'}</span>
 <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
 archiveFilter === 'long_term' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
 }`}>
 {(activeTab === 'obligations' ? getArchiveCounts(obligations).long_term : getArchiveCounts(createdQuests).long_term)}
 </span>
 </button>

 <button
 type="button"
 onClick={() => setArchiveFilter('completed')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
 archiveFilter === 'completed'
 ? 'bg-emerald-600 text-white shadow-xs scale-[1.02]'
 : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 border border-emerald-150'
 }`}
 >
 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
 <span>{lang === 'ar' ? 'مكتملة' : 'Completed'}</span>
 <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
 archiveFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
 }`}>
 {(activeTab === 'obligations' ? getArchiveCounts(obligations).completed : getArchiveCounts(createdQuests).completed)}
 </span>
 </button>

 <button
 type="button"
 onClick={() => setArchiveFilter('finished')}
 className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0 ${
 archiveFilter === 'finished'
 ? 'bg-amber-600 text-white shadow-xs scale-[1.02]'
 : 'bg-amber-50 text-amber-800 hover:bg-amber-100/80 border border-amber-200'
 }`}
 >
 <XCircle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
 <span>{lang === 'ar' ? 'منتهية / ملغاة' : 'Expired/Cancelled'}</span>
 <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
 archiveFilter === 'finished' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
 }`}>
 {(activeTab === 'obligations' ? getArchiveCounts(obligations).finished : getArchiveCounts(createdQuests).finished)}
 </span>
 </button>
 </div>
 </div>
 )}

 {/* Worker Obligations Mode */}
  {activeTab === 'obligations' && (
    <div className="space-y-6">
      {/* 1. Accepted Ongoing Obligations */}
      {displayObligations.length > 0 ? (
        <div className="space-y-4">
          {displayObligations.map((quest) => {
            const isOngoing = quest.status === 'booked' || quest.status === 'arrived' || quest.status === 'active' || quest.status === 'hired' || quest.status === 'active_employment';
            const isArrived = quest.status === 'arrived';
            const isUnderReview = quest.status === 'pending_verification';
            const isDisputed = quest.status === 'disputed';
            const isFinished = quest.status === 'completed';

            // Top status accent color
            const statusColor = isFinished 
              ? 'bg-emerald-500' 
              : isDisputed 
              ? 'bg-[#FF3B7C]' 
              : isUnderReview 
              ? 'bg-amber-500' 
              : isArrived 
              ? 'bg-[#FFD34D]' 
              : 'bg-[#38BDF8]';

            // Status label & badge
            let statusBadge = {
              text: lang === 'ar' ? 'قيد التنفيذ' : 'In Progress',
              className: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
            };
            if (isArrived) {
              statusBadge = {
                text: lang === 'ar' ? 'وصلت للموقع' : 'Arrived',
                className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              };
            } else if (isUnderReview) {
              statusBadge = {
                text: lang === 'ar' ? 'قيد المراجعة' : 'Under Review',
                className: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
              };
            } else if (isDisputed) {
              statusBadge = {
                text: lang === 'ar' ? 'نزاع مالي' : 'Dispute',
                className: 'bg-rose-50 dark:bg-rose-950/40 text-[#FF3B7C] border border-rose-200 dark:border-rose-800'
              };
            } else if (isFinished) {
              statusBadge = {
                text: lang === 'ar' ? 'مكتملة' : 'Completed',
                className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              };
            }

            const employerName = quest.creatorName || (lang === 'ar' ? 'صاحب العمل' : 'Employer');
            const employerAvatar = quest.creatorAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${employerName}&backgroundColor=111827`;
            const employerPhone = quest.creatorPhone || '0550000000';

            return (
              <div 
                key={quest.id} 
                className={`bg-white dark:bg-slate-900 border rounded-3xl overflow-hidden shadow-sm transition-all duration-300 relative ${
                  showHistory 
                    ? 'grayscale opacity-75 border-slate-200 dark:border-slate-800' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-[#1F2A44] dark:hover:border-sky-500 hover:shadow-xl'
                }`}
              >
                {/* 1. Top Status Accent Strip */}
                <div className={`h-1.5 w-full ${statusColor}`} />

                <div className="p-5 space-y-4">
                  {/* 2. Title & Status Badge (Clean & Direct) */}
                  <div className="flex items-start justify-between gap-3 text-start">
                    <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-snug tracking-tight break-words flex-1">
                      {quest.title}
                    </h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1 mt-0.5 ${statusBadge.className}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {statusBadge.text}
                    </span>
                  </div>

                  {/* 4. Counterpart: Employer with Inline Direct Action Icons */}
                  <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full text-start pt-1">
                    <div 
                      onClick={() => onViewPublicProfile && quest.creatorId && onViewPublicProfile(quest.creatorId)}
                      className={`flex items-center gap-2.5 min-w-0 flex-1 ${quest.creatorId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    >
                      <img src={employerAvatar} alt={employerName} className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider">
                          {lang === 'ar' ? 'صاحب العمل' : 'Employer'}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate flex items-center gap-1">
                          {employerName}
                          <span className="text-[#FFD34D] font-mono font-bold text-[10px]">★ 5.0</span>
                        </span>
                      </div>
                    </div>

                    {/* Inline Icon-Only Chat & Call for Worker facing Employer (Always visible) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('open-chat', {
                            detail: {
                              chatId: `${quest.id}_${quest.creatorId}_${currentUserId}`,
                              questTitle: quest.title,
                              recipientName: employerName,
                              recipientAvatar: employerAvatar
                            }
                          }));
                        }}
                        className="w-8 h-8 rounded-xl bg-[#1F2A44] hover:bg-[#152037] active:scale-90 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
                        title={lang === 'ar' ? 'دردشة مباشرة' : 'Chat'}
                        aria-label={lang === 'ar' ? 'دردشة مباشرة' : 'Chat'}
                      >
                        <MessageSquare className="w-4 h-4 text-[#38BDF8]" />
                      </button>

                      <a
                        href={`tel:${employerPhone}`}
                        className="w-8 h-8 rounded-xl bg-[#38BDF8] hover:bg-sky-500 active:scale-90 text-slate-950 flex items-center justify-center transition-all shadow-xs"
                        title={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                        aria-label={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                      >
                        <Phone className="w-4 h-4 text-slate-950" />
                      </a>
                    </div>
                  </div>

                  {/* 6. Action Elements for Worker */}
                  {isOngoing && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Confirm Arrival Button if Runner & not arrived */}
                      {(() => {
                        const isRunnerOnly = (quest.helperId === currentUserId || quest.assignedRunnerId === currentUserId || quest.assignedRunnerIds?.includes(currentUserId)) && quest.creatorId !== currentUserId;
                        return isRunnerOnly && !isArrived && onArrivedAtQuest ? (
                          <button
                            onClick={() => onArrivedAtQuest(quest.id)}
                            className="w-full bg-gradient-to-r from-[#FFD34D] to-[#FF3B7C] hover:opacity-95 text-white font-black text-xs py-3 rounded-2xl shadow-sm transition duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>{lang === 'ar' ? 'تأكيد الوصول إلى الموقع' : 'Confirm Arrival At Location'}</span>
                          </button>
                        ) : null;
                      })()}

                      {/* Primary Worker Action: إتمام المهمة ورفع الإثبات (Full Width Pink) */}
                      <button
                        onClick={() => setSelectedProofQuest(quest)}
                        className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 active:scale-[0.98] text-white font-black text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-pink-500/20"
                      >
                        <Camera className="w-4 h-4 text-white" />
                        <span>{lang === 'ar' ? 'إتمام المهمة ورفع الإثبات' : 'Complete Quest & Upload Proof'}</span>
                      </button>

                      {/* Discreet Danger Row: Cancel & Sever */}
                      <div className="flex items-center gap-2 pt-1 w-full">
                        <button
                          onClick={() => {
                            const refundAmount = Math.round(quest.bookingFeeDA * 0.30);
                            onCancelBookedQuest(quest.id, refundAmount);
                          }}
                          className="flex-1 bg-rose-50/70 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/40 font-bold text-[11px] py-2 rounded-xl transition duration-200 cursor-pointer text-center"
                        >
                          <span>{lang === 'ar' ? 'إلغاء الحجز' : 'Cancel Reservation'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEndWorkQuestModal(quest)}
                          className="flex-1 bg-rose-50/70 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/40 font-bold text-[11px] py-2 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-1"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{lang === 'ar' ? 'فسخ العقد' : 'Sever Contract'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Under Review Notice */}
                  {isUnderReview && (
                    <div className="w-full text-center bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl p-3 border border-amber-200/80 dark:border-amber-800 text-xs font-black text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 animate-pulse">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{lang === 'ar' ? 'في انتظار مراجعة صاحب العمل لتأكيد السداد المالي' : 'Awaiting employer confirmation.'}</span>
                    </div>
                  )}

                  {/* Completed Success Notice */}
                  {isFinished && (
                    <div className="w-full text-center bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-3 border border-emerald-200 dark:border-emerald-800 text-xs font-black text-emerald-800 dark:text-emerald-200 flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'ar' ? 'تم اكتمال الكويست واستلام الأموال بنجاح!' : 'Quest successfully completed!'}</span>
                    </div>
                  )}

                  {/* 7. View Full Details Button for Worker */}
                  {onViewQuestDetail && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onViewQuestDetail(quest.id)}
                        className="w-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 font-black text-xs py-2.5 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>{lang === 'ar' ? 'عرض تفاصيل الكويست' : 'View Quest Details'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-white dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl space-y-3">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Briefcase className="w-6 h-6 text-[#38BDF8]" />
          </div>
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
            {lang === 'ar' ? 'لا توجد مهام أو عقود حالياً' : 'No active tasks or contracts'}
          </h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {lang === 'ar' ? 'تصفح قائمة المهام المتاحة وقدم على المهام التي تناسب مهاراتك.' : 'Browse available quests and apply to tasks that suit your skills.'}
          </p>
        </div>
      )}

      {/* Applied / Pending Booking Quests */}
      {appliedQuests.length > 0 && !showHistory && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-amber-400 px-1">
            <Clock className="w-4 h-4" />
            <span>{lang === 'ar' ? 'طلبات الحجز قيد المراجعة والانتظار' : 'Pending Applications'} ({appliedQuests.length})</span>
          </div>
          <div className="space-y-3">
            {appliedQuests.map((quest) => (
              <div 
                key={quest.id} 
                className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 rounded-3xl p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3 text-start">
                  <h4 className="font-black text-base text-slate-900 dark:text-white leading-snug tracking-tight break-words flex-1">
                    {quest.title}
                  </h4>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
                    {lang === 'ar' ? 'بانتظار موافقة صاحب العمل' : 'Pending Approval'}
                  </span>
                </div>
                {/* Counterpart: Employer with Inline Direct Action Icons */}
                {(() => {
                  const empName = quest.creatorName || (lang === 'ar' ? 'صاحب العمل' : 'Employer');
                  const empAvatar = quest.creatorAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(empName)}&backgroundColor=111827`;
                  const empPhone = quest.creatorPhone || '0550000000';
                  return (
                    <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full text-start">
                      <div 
                        onClick={() => onViewPublicProfile && quest.creatorId && onViewPublicProfile(quest.creatorId)}
                        className={`flex items-center gap-2.5 min-w-0 flex-1 ${quest.creatorId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      >
                        <img src={empAvatar} alt={empName} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider">
                            {lang === 'ar' ? 'صاحب العمل' : 'Employer'}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate flex items-center gap-1">
                            {empName}
                            <span className="text-[#FFD34D] font-mono font-bold text-[10px]">★ 5.0</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('open-chat', {
                              detail: {
                                chatId: `${quest.id}_${quest.creatorId}_${currentUserId}`,
                                questTitle: quest.title,
                                recipientName: empName,
                                recipientAvatar: empAvatar
                              }
                            }));
                          }}
                          className="w-8 h-8 rounded-xl bg-[#1F2A44] hover:bg-[#152037] active:scale-90 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
                          title={lang === 'ar' ? 'دردشة مباشرة' : 'Chat'}
                          aria-label={lang === 'ar' ? 'دردشة مباشرة' : 'Chat'}
                        >
                          <MessageSquare className="w-4 h-4 text-[#38BDF8]" />
                        </button>

                        <a
                          href={`tel:${empPhone}`}
                          className="w-8 h-8 rounded-xl bg-[#38BDF8] hover:bg-sky-500 active:scale-90 text-slate-950 flex items-center justify-center transition-all shadow-xs"
                          title={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                          aria-label={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                        >
                          <Phone className="w-4 h-4 text-slate-950" />
                        </a>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleCancelApplicant(quest.id)}
                    className="flex-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-black rounded-xl transition cursor-pointer"
                  >
                    {lang === 'ar' ? 'إلغاء طلب الحجز' : 'Cancel Application'}
                  </button>
                  {onViewQuestDetail && (
                    <button
                      type="button"
                      onClick={() => onViewQuestDetail(quest.id)}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 text-slate-700 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>{lang === 'ar' ? 'عرض تفاصيل الكويست' : 'View Quest Details'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )}

  {/* Employer Created Mode */}
  {activeTab === 'created' && (
    <div className="space-y-6">
      {displayCreatedQuests.length > 0 ? (
        <div className="space-y-4">
          {displayCreatedQuests.map((quest) => {
            const assignedWorkers = (() => {
              if (quest.assignedRunnerIds && quest.assignedRunnerIds.length > 0) {
                return quest.assignedRunnerIds.map((runnerId, idx) => {
                  const applicantMatch = quest.applicants?.find(a => a.userId === runnerId);
                  const name = applicantMatch?.name || (runnerId === quest.helperId && quest.helperName ? quest.helperName : `${lang === 'ar' ? 'العامل' : 'Worker'} ${idx + 1}`);
                  const avatar = applicantMatch?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=111827`;
                  const phone = applicantMatch?.phone || (runnerId === quest.helperId ? quest.helperPhone : undefined) || '0550000000';
                  const rating = applicantMatch?.rating || 5.0;
                  return { id: runnerId, name, avatar, phone, rating };
                });
              }
              if (quest.helperId || quest.assignedRunnerId) {
                const singleId = quest.helperId || quest.assignedRunnerId || '';
                const applicantMatch = quest.applicants?.find(a => a.userId === singleId);
                const name = applicantMatch?.name || quest.helperName || (lang === 'ar' ? 'العامل' : 'Worker');
                const avatar = applicantMatch?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=111827`;
                const phone = applicantMatch?.phone || quest.helperPhone || '0550000000';
                const rating = applicantMatch?.rating || 5.0;
                return [{ id: singleId, name, avatar, phone, rating }];
              }
              return [];
            })();
            const hasAssignedWorker = assignedWorkers.length > 0;
            const isPendingVerification = quest.status === 'pending_verification';
            const isCompleted = quest.status === 'completed';
            const isDisputed = quest.status === 'disputed';
            const isOngoing = quest.status === 'booked' || quest.status === 'arrived' || quest.status === 'active';
            const canDelete = !hasAssignedWorker && quest.status === 'active';

            // Top status accent color
            const statusColor = isCompleted 
              ? 'bg-emerald-500' 
              : isDisputed 
              ? 'bg-[#FF3B7C]' 
              : isPendingVerification 
              ? 'bg-amber-500' 
              : isOngoing && hasAssignedWorker 
              ? 'bg-[#38BDF8]' 
              : 'bg-emerald-500';

            return (
              <div 
                key={quest.id} 
                className={`bg-white dark:bg-slate-900 border rounded-3xl overflow-hidden shadow-sm transition-all duration-300 relative ${
                  showHistory 
                    ? 'grayscale opacity-75 border-slate-200 dark:border-slate-800' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-[#1F2A44] dark:hover:border-sky-500 hover:shadow-xl'
                }`}
              >
                {/* 1. Top Status Accent Strip */}
                <div className={`h-1.5 w-full ${statusColor}`} />

                <div className="p-5 space-y-4">
                  {/* 2. Title, Status Badge & Delete Action (Clean & Direct) */}
                  <div className="flex items-start justify-between gap-3 text-start">
                    <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-snug tracking-tight break-words flex-1">
                      {quest.title}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {quest.status === 'active' && !hasAssignedWorker && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {lang === 'ar' ? 'متاح للتقديم' : 'Open'}
                        </span>
                      )}
                      {isOngoing && hasAssignedWorker && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#38BDF8]/10 text-sky-600 dark:text-sky-400 border border-[#38BDF8]/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
                          {lang === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                        </span>
                      )}
                      {isPendingVerification && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                          {lang === 'ar' ? 'بانتظار التأكيد المالي' : 'Pending Review'}
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {lang === 'ar' ? 'مكتملة' : 'Completed'}
                        </span>
                      )}
                      {isDisputed && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/10 text-[#FF3B7C] border border-rose-500/20">
                          {lang === 'ar' ? 'نزاع مالي' : 'Dispute'}
                        </span>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmQuestId(quest.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title={lang === 'ar' ? 'حذف المهمة' : 'Delete Quest'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4. Counterpart: Assigned Worker(s) with Inline Direct Action Icons OR Open Assignment Status */}
                  <div className="space-y-2 pt-1 text-start">
                    {hasAssignedWorker ? (
                      <div className="space-y-2">
                        {assignedWorkers.map((worker) => (
                          <div 
                            key={worker.id}
                            className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 w-full"
                          >
                            <div 
                              onClick={() => onViewPublicProfile && worker.id && onViewPublicProfile(worker.id)}
                              className={`flex items-center gap-2.5 min-w-0 flex-1 ${worker.id ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            >
                              <img src={worker.avatar} alt={worker.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider">
                                  {lang === 'ar' ? 'العامل المنفذ' : 'Worker'}
                                </span>
                                <span className="text-xs font-black text-slate-900 dark:text-white truncate flex items-center gap-1">
                                  {worker.name}
                                  <span className="text-[#FFD34D] font-mono font-bold text-[10px]">★ {worker.rating || '5.0'}</span>
                                </span>
                              </div>
                            </div>

                            {/* Inline Icon-Only Chat & Call for Employer facing this Worker */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('open-chat', {
                                    detail: {
                                      chatId: `${quest.id}_${currentUserId}_${worker.id}`,
                                      questTitle: quest.title,
                                      recipientName: worker.name,
                                      recipientAvatar: worker.avatar
                                    }
                                  }));
                                }}
                                className="w-8 h-8 rounded-xl bg-[#1F2A44] hover:bg-[#152037] active:scale-90 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer"
                                title={lang === 'ar' ? 'دردشة مباشرة' : 'Chat'}
                                aria-label={lang === 'ar' ? 'دردشة مباشرة' : 'Chat'}
                              >
                                <MessageSquare className="w-4 h-4 text-[#38BDF8]" />
                              </button>

                              <a
                                href={`tel:${worker.phone}`}
                                className="w-8 h-8 rounded-xl bg-[#38BDF8] hover:bg-sky-500 active:scale-90 text-slate-950 flex items-center justify-center transition-all shadow-xs"
                                title={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                                aria-label={lang === 'ar' ? 'اتصال هاتفي' : 'Call'}
                              >
                                <Phone className="w-4 h-4 text-slate-950" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-start w-full">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider">
                            {lang === 'ar' ? 'حالة التعيين' : 'Assignment'}
                          </span>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate block">
                            {lang === 'ar' ? 'بانتظار اختيار عامل' : 'Awaiting worker'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 6. Applicants List (if quest is open and has applicants) */}
                  {!hasAssignedWorker && quest.applicants && quest.applicants.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-start">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                        {lang === 'ar' ? 'المتقدمون لتنفيذ المهمة' : 'Applicants'} ({quest.applicants.length})
                      </span>
                      <div className="space-y-2">
                        {quest.applicants.map((applicant) => (
                          <div key={applicant.userId} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700">
                            <div 
                              onClick={() => setSelectedApplicantData({ quest, applicant })}
                              className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                            >
                              <img src={applicant.avatar} alt={applicant.name} className="w-8 h-8 rounded-full object-cover" />
                              <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{applicant.name}</span>
                                <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">★ {applicant.rating || '5.0'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedApplicantData({ quest, applicant })}
                                className="px-3 py-1.5 bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white text-[11px] font-black rounded-xl transition cursor-pointer shadow-xs"
                              >
                                {lang === 'ar' ? 'معاينة وقبول' : 'Review & Accept'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 7. Verification / Proof Review Action for Employer */}
                  {isPendingVerification && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <button
                        type="button"
                        onClick={() => setRatingQuestId(quest.id)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-3 rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>{lang === 'ar' ? 'تأكيد إتمام العمل وسداد المستحقات' : 'Confirm Completion & Pay'}</span>
                      </button>
                    </div>
                  )}

                  {/* 8. View Full Details Button for Employer */}
                  {onViewQuestDetail && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onViewQuestDetail(quest.id)}
                        className="w-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 font-black text-xs py-2.5 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span>{lang === 'ar' ? 'عرض تفاصيل الكويست' : 'View Quest Details'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-white dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl space-y-3">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Plus className="w-6 h-6 text-[#FF3B7C]" />
          </div>
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
            {lang === 'ar' ? 'لا توجد طلبات معلنة حالياً' : 'No posted quests yet'}
          </h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {lang === 'ar' ? 'قم بنشر مهمة جديدة ليصلك عروض من المساعدين والعمال الميدانيين.' : 'Post a new quest to receive offers from nearby helpers.'}
          </p>
        </div>
      )}
    </div>
  )}

  {/* Bottom Archive & History Access Button */}
 <div className="pt-6 pb-2 flex justify-center">
 <button
 type="button"
 onClick={() => setShowHistory(!showHistory)}
 className={`w-full max-w-sm py-3 px-5 rounded-2xl font-black text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-2.5 shadow-sm active:scale-95 border ${
 showHistory
 ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/30'
 : 'bg-white dark:bg-[#151F32] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2640]'
 }`}
 >
 <History className="w-4 h-4 text-amber-500 shrink-0" />
 <span>
 {showHistory
 ? (lang === 'ar' ? 'الرجوع إلى العقود والمهام النشطة' : 'Back to Active Contracts')
 : (lang === 'ar' ? 'عرض سجل الأرشيف والمهام السابقة' : 'View Archived Tasks & History Log')}
 </span>
 </button>
 </div>

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
 {lang === 'ar' ? 'تراجع ' : 'Cancel '}
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
 {lang === 'ar' ? 'نعم، حذف ' : 'Yes, Delete '}
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
 {lang === 'ar' ? 'إرفاق إثبات إتمام العمل' : 'Attach Proof'}
 </h3>
 
 <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
 {lang === 'ar' 
 ? 'التقط أو اختر صورة توضح إتمام العمل لإنهاء المهمة واستلام المبلغ.' 
 : 'Submit a photo showing completed work.'}
 </p>

 {/* Sky Blue Camera & Gallery Upload Zone */}
 <input 
 type="file" 
 id="helper-proof-picker"
 ref={proofInputRef}
 accept="image/*,image/heic,image/heif,.heic,.heif"
 className="hidden"
 onChange={handleHelperFileChange}
 />
 <input 
 type="file" 
 id="helper-proof-camera-picker"
 accept="image/*,image/heic,image/heif,.heic,.heif"
 capture="environment"
 className="hidden"
 onChange={handleHelperFileChange}
 />

 {helperUploading ? (
 <div className="w-full h-32 rounded-2xl border-2 border-dashed border-[#4FC3F7] bg-sky-50/30 flex flex-col items-center justify-center p-4">
 <div className="space-y-2 w-full flex flex-col items-center">
 <div className="w-10 h-10 rounded-full border-2 border-t-[#4FC3F7] border-gray-200 animate-spin flex items-center justify-center">
 <span className="text-[8px] text-[#4FC3F7] font-black">{helperProgress}%</span>
 </div>
 <span className="text-[10px] text-[#4FC3F7] font-extrabold px-3 py-1 bg-white rounded-full shadow-sm">
 {lang === 'ar' ? 'جاري معالجة وضغط الصورة...' : 'Compressing image...'}
 </span>
 <div className="w-2/3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <div className="bg-[#4FC3F7] h-full transition-all duration-100" style={{ width: `${helperProgress}%` }}></div>
 </div>
 </div>
 </div>
 ) : selectedProofFile ? (
 <div className="w-full h-36 rounded-2xl border-2 border-[#4FC3F7] relative overflow-hidden shadow-md">
 <img src={selectedProofFile} className="w-full h-full object-cover" alt="Selected proof preview" />
 <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
 <label
 htmlFor="helper-proof-camera-picker"
 className="bg-[#4FC3F7] hover:bg-sky-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-sm"
 >
 <Camera className="w-3.5 h-3.5" />
 <span>{lang === 'ar' ? 'التقاط بالكاميرا' : 'Retake Camera'}</span>
 </label>
 <label
 htmlFor="helper-proof-picker"
 className="bg-white/90 hover:bg-white text-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-sm"
 >
 <Image className="w-3.5 h-3.5 text-sky-600" />
 <span>{lang === 'ar' ? 'من المعرض' : 'From Gallery'}</span>
 </label>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-2 gap-2.5">
 {/* Camera Option */}
 <label
 htmlFor="helper-proof-camera-picker"
 className="h-32 rounded-2xl border-2 border-dashed border-[#4FC3F7] bg-sky-50/40 hover:bg-sky-100/60 flex flex-col items-center justify-center p-3 transition-all active:scale-95 cursor-pointer text-center group select-none shadow-xs"
 >
 <div className="w-10 h-10 rounded-full bg-[#4FC3F7]/15 text-[#4FC3F7] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
 <Camera className="w-5 h-5" />
 </div>
 <span className="text-[11px] font-black text-[#1F2A44] block">
 {lang === 'ar' ? ' التقاط بالكاميرا' : ' Take Photo'}
 </span>
 <span className="text-[8.5px] text-sky-600 font-extrabold block mt-0.5">
 {lang === 'ar' ? 'صورة للعمل' : 'Live Camera Snap'}
 </span>
 </label>

 {/* Gallery Option */}
 <label
 htmlFor="helper-proof-picker"
 className="h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-gray-50/60 hover:bg-gray-100/80 flex flex-col items-center justify-center p-3 transition-all active:scale-95 cursor-pointer text-center group select-none shadow-xs"
 >
 <div className="w-10 h-10 rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
 <Image className="w-5 h-5" />
 </div>
 <span className="text-[11px] font-black text-slate-700 block">
 {lang === 'ar' ? ' معرض الصور' : ' Device Gallery'}
 </span>
 <span className="text-[8.5px] text-gray-500 font-extrabold block mt-0.5">
 {lang === 'ar' ? 'اختيار من الاستوديو' : 'Select Saved Photo'}
 </span>
 </label>
 </div>
 )}

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
 <span>{lang === 'ar' ? 'التالي ' : 'Next '}</span>
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
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
 </button>
 <button
 type="button"
 disabled={!newDesc.trim()}
 onClick={() => setCreateStep(3)}
 className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
 >
 {lang === 'ar' ? 'التالي ' : 'Next '}
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
 {lang === 'ar' ? 'تحديد الموقع الجغرافي ' : 'Location Coordinates '}
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
 <span>{gpsLoading ? (lang === 'ar' ? 'جاري التحديد...' : 'Tagging...') : (lang === 'ar' ? ' تلقائي GPS' : ' Auto-Tag GPS')}</span>
 </button>
 </div>

 {gpsCoords ? (
 <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-xl text-[10px] text-sky-800 font-extrabold flex justify-between items-center animate-in fade-in">
 <span className="tracking-wide"> {newLoc || resolveNeighborhoodFromCoords(gpsCoords.lat, gpsCoords.lng, 'بن سرور', lang)}</span>
 <span className="text-[8px] bg-sky-200 text-sky-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider">{lang === 'ar' ? 'مؤكد' : 'Tagged'}</span>
 </div>
 ) : (
 <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl text-[9px] text-[#FF3B7C] font-semibold leading-relaxed">
 {lang === 'ar' 
 ? ' يرجى الضغط على زر تلقائي GPS أو كتابة موقعك كتابياً بالأسفل.' 
 : ' Press Auto-Tag GPS or type your address below.'}
 </div>
 )}

 <div className="pt-2 border-t border-gray-200 space-y-1.5">
 <label className="text-[11px] text-gray-700 font-extrabold block">
 {lang === 'ar' ? 'اسم المكان / الحي والمدينة:' : 'Neighborhood & City Name:'}
 </label>
 <input
 type="text"
 value={newLoc}
 onChange={(e) => setNewLoc(e.target.value)}
 placeholder={lang === 'ar' ? 'مثال: بن سرور، حي العتي' : 'e.g., Ben Srour, Hay El Ati'}
 className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-800 text-xs font-bold focus:outline-none focus:border-[#FF3B7C]"
 />
 </div>
 </div>

 <div className="flex justify-between pt-2 border-t border-gray-100">
 <button
 type="button"
 onClick={() => setCreateStep(2)}
 className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
 >
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
 </button>
 <button
 type="button"
 disabled={!gpsCoords}
 onClick={() => setCreateStep(4)}
 className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
 >
 {lang === 'ar' ? 'التالي ' : 'Next '}
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
 {lang === 'ar' ? 'تصنيف المهمة ' : 'Quest Category '}
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
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
 </button>
 <button
 type="button"
 onClick={() => setCreateStep(5)}
 className="px-5 py-2.5 bg-[#1F2A44] text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
 >
 {lang === 'ar' ? 'التالي ' : 'Next '}
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
 {lang === 'ar' ? 'درجة الاستعجال ' : 'Urgency Tier '}
 </label>
 </div>

 <div className="space-y-1">
 <select 
 value={newUrgency} 
 onChange={(e) => setNewUrgency(e.target.value as any)}
 className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#FF3B7C]"
 >
 <option value="normal">{lang === 'ar' ? 'عادي (Normal)' : 'Normal'}</option>
 <option value="urgent">{lang === 'ar' ? 'عاجل (Urgent)' : 'Urgent '}</option>
 <option value="featured">{lang === 'ar' ? 'مميز (Featured)' : 'Featured '}</option>
 </select>
 </div>

 <div className="flex justify-between pt-2 border-t border-gray-100">
 <button
 type="button"
 onClick={() => setCreateStep(4)}
 className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
 >
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
 </button>
 <button
 type="button"
 onClick={() => setCreateStep(6)}
 className="px-5 py-2.5 bg-[#1F2A44] text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
 >
 {lang === 'ar' ? 'التالي ' : 'Next '}
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
 {lang === 'ar' ? 'مبلغ المكافأة المقترحة بالدينار الجزائري ' : 'Proposed Reward in DZD '}
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
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
 </button>
 <button
 type="button"
 disabled={newCash < 500}
 onClick={() => setCreateStep(7)}
 className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
 >
 {lang === 'ar' ? 'التالي ' : 'Next '}
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
 {lang === 'ar' ? 'عدد المساعدين الميدانيين المطلوبين ' : 'Required Helpers count '}
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
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
 </button>
 <button
 type="button"
 disabled={newRequiredWorkerCount < 1}
 onClick={() => setCreateStep(8)}
 className="px-5 py-2.5 bg-[#1F2A44] disabled:bg-gray-100 disabled:text-gray-400 text-[#FFD34D] font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
 >
 {lang === 'ar' ? 'التالي ' : 'Next '}
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
 {lang === 'ar' ? 'أضف صوراً توضيحية للموقع أو السلعة ' : 'Add Quest Clarifying Photos '}
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
 accept="image/*,image/heic,image/heif,.heic,.heif"
 className="hidden"
 onChange={handleContractFileChange}
 />
 <input 
 type="file" 
 id="contract-camera-picker"
 accept="image/*,image/heic,image/heif,.heic,.heif"
 capture="environment"
 className="hidden"
 onChange={handleContractFileChange}
 />

 {/* Camera Button */}
 <label
 htmlFor="contract-camera-picker"
 className={`h-16 rounded-xl border-2 border-dashed border-[#4FC3F7] bg-sky-50/50 hover:bg-sky-100 flex flex-col items-center justify-center p-1 cursor-pointer transition-all active:scale-95 text-center group font-black select-none block ${bountyUploading ? 'pointer-events-none opacity-50' : ''}`}
 >
 <Camera className="w-4 h-4 text-[#4FC3F7] mx-auto" />
 <span className="text-[8px] text-[#4FC3F7] font-black mt-1 leading-tight block">
 {lang === 'ar' ? ' الكاميرا' : ' Camera'}
 </span>
 </label>

 {/* Gallery Button */}
 <label
 htmlFor="contract-image-picker"
 className={`h-16 rounded-xl border-2 border-dashed border-slate-300 bg-gray-50/70 hover:bg-gray-100 flex flex-col items-center justify-center p-1 cursor-pointer transition-all active:scale-95 text-center group font-black select-none block ${bountyUploading ? 'pointer-events-none opacity-50' : ''}`}
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
 <Image className="w-4 h-4 text-slate-600 mx-auto" />
 <span className="text-[8px] text-slate-700 font-black mt-1 leading-tight block">
 {lang === 'ar' ? ' المعرض' : ' Gallery'}
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
 <span className="font-bold text-sky-700 truncate max-w-[200px]">
 {gpsCoords ? resolveNeighborhoodFromCoords(gpsCoords.lat, gpsCoords.lng, 'الجزائر العاصمة', lang) : 'N/A'}
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
 ? (lang === 'ar' ? 'تأكيد وإصدار العقد الميداني الآن ' : 'Confirm & Publish Field Contract ')
 : (lang === 'ar' ? ' يرجى العودة لخطوة تحديد الموقع GPS' : ' Missing verified coordinates')}
 </button>
 <button
 type="button"
 onClick={() => setCreateStep(7)}
 className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-extrabold text-[10px] py-2.5 rounded-xl transition-all cursor-pointer"
 >
 {lang === 'ar' ? '⬅ السابق' : '⬅ Back'}
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
 {ratingQuestId && (() => {
 const targetQuest = quests.find(q => q.id === ratingQuestId);
 const targetName = targetQuest?.helperName || (lang === 'ar' ? 'العامل' : 'Worker');

 return (
 <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
 <motion.div
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 text-center"
 >
 {/* 1. اسم العامل فقط */}
 <h3 className="text-base font-black text-slate-900 dark:text-white">
 {targetName}
 </h3>

 {/* 2. شريط النجوم فقط */}
 <div className="flex items-center justify-center gap-1.5 py-1">
 {[1, 2, 3, 4, 5].map((starVal) => (
 <button
 key={starVal}
 type="button"
 onClick={() => setRatingVal(starVal)}
 className="p-1 cursor-pointer transition-transform active:scale-90 hover:scale-110"
 >
 <Star 
 className={`w-8 h-8 transition-colors ${
 starVal <= ratingVal ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'
 }`} 
 />
 </button>
 ))}
 </div>

 {/* 3. حقل إدخال الملاحظات فقط */}
 <textarea
 rows={3}
 placeholder={lang === 'ar' ? 'الملاحظات...' : 'Notes...'}
 value={ratingComment}
 onChange={(e) => setRatingComment(e.target.value)}
 className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold focus:outline-none focus:border-amber-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
 />

 {/* 4. زر إرسال فقط */}
 <button
 type="button"
 onClick={() => {
 onConfirmPayout(ratingQuestId, ratingVal, ratingComment);
 setRatingQuestId(null);
 }}
 className="w-full py-3 bg-[#1F2A44] hover:bg-[#152037] text-white dark:bg-amber-400 dark:hover:bg-amber-500 dark:text-slate-950 font-black rounded-2xl text-xs shadow-md transition-all cursor-pointer active:scale-98"
 >
 {lang === 'ar' ? 'إرسال' : 'Submit'}
 </button>
 </motion.div>
 </div>
 );
 })()}
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
 <span className="text-white">{lang === 'ar' ? 'قبول المتقدم وتفعيل العقد ' : 'Accept Applicant & Activate Contract '}</span>
 </button>

 <button
 onClick={() => {
 const { quest, applicant } = selectedApplicantData;
 if (onRejectApplicant) {
 onRejectApplicant(quest.id, applicant.userId);
 } else if (setQuests && quests) {
 const updated = quests.map(q => q.id === quest.id ? { ...q, applicants: q.applicants?.filter(a => a.userId !== applicant.userId) } : q);
 setQuests(updated);
 }
 setSelectedApplicantData(null);
 }}
 className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs py-2.5 rounded-xl border border-rose-200 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
 >
 <X className="w-4 h-4 text-rose-600" />
 <span>{lang === 'ar' ? 'رفض المتقدم ' : 'Reject Applicant '}</span>
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 
      {/* End Work Modal */}
      {endWorkQuestModal && (() => {
        const isModalEmployer = endWorkQuestModal.creatorId === currentUserId;
        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[100005] font-sans">
            <div 
              className="bg-white dark:bg-[#0A1128] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right"
              style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-black text-lg text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>
                    {lang === 'ar' ? 'فسخ العقد' : 'Sever Contract'}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEndWorkQuestModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                {isModalEmployer
                  ? (lang === 'ar'
                      ? 'سيتم إرسال طلب إنهاء الخدمة للعامل للموافقة عليه وتسوية كافة المستحقات وتعديل حالة العقد.'
                      : 'A service termination request will be sent to the employee for approval and settlement.')
                  : (lang === 'ar'
                      ? 'سيتم إرسال طلب الاستقالة وفسخ العقد لصاحب العمل للموافقة عليه وإخلاء الطرف واسترجاع حالة حسابك كمتاح للعمل.'
                      : 'A resignation request will be sent to the employer for approval and clearance.')}
              </p>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                  {isModalEmployer
                    ? (lang === 'ar' ? 'سبب إنهاء الخدمة (اختياري):' : 'Reason for service termination (optional):')
                    : (lang === 'ar' ? 'سبب الاستقالة (اختياري):' : 'Reason for resignation (optional):')}
                </label>
                <textarea
                  value={endWorkReasonText}
                  onChange={(e) => setEndWorkReasonText(e.target.value)}
                  placeholder={
                    isModalEmployer
                      ? (lang === 'ar' ? 'مثال: انتهاء فترة المشروع، عدم الحاجة للخدمة حالياً...' : 'e.g., Project finished...')
                      : (lang === 'ar' ? 'مثال: الانتقال لوظيفة جديدة، عدم التفرغ...' : 'e.g., Personal reasons, moving to new role...')
                  }
                  className="w-full bg-slate-50 dark:bg-[#162035] border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs font-medium outline-none focus:border-rose-500 dark:focus:border-rose-500 resize-none h-24 text-right"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onRequestEndWork) {
                      onRequestEndWork(endWorkQuestModal.id, endWorkReasonText);
                    }
                    setEndWorkQuestModal(null);
                    setEndWorkReasonText('');
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-3 rounded-2xl shadow-md transition-all cursor-pointer text-center"
                >
                  {lang === 'ar' ? 'تأكيد فسخ العقد' : 'Confirm Severing Contract'}
                </button>
                <button
                  type="button"
                  onClick={() => setEndWorkQuestModal(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
  {/* Standard Lightbox Overlay with Pinch-to-zoom & Pan (Strictly bounded) */}
  <StandardImageLightbox
    imageUrl={lightboxImage}
    onClose={() => { setLightboxImage(null); setLightboxMeta(null); }}
    title={lightboxMeta?.title}
    subtitle={lightboxMeta?.subtitle}
    caption={lightboxMeta?.caption}
    lang={lang}
  />
</div>
 </PullToRefresh>
 );
}

export default React.memo(MyQuestsView);
