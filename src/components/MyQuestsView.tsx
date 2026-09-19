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
 const activeQuestCount = userProfile?.hasActiveQuest === false ? 0 : quests.filter(q => q.creatorId === currentUserId && !['completed', 'cancelled', 'cancelled_by_timeout', 'stale_cleared', 'expired', 'terminated', 'archived'].includes(q.status) && !q.archived).length;
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
 showToast(lang === 'ar' ? ' تم تحديث قائمة الكويستات والمهمات بنجاح!' : ' Quests and tasks refreshed successfully!');
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
 setGpsCoords({ lat: 35.184, lng: 4.556 });
 setNewLoc('بن سرور');
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
 (q.helperId === currentUserId || q.assignedRunnerId === currentUserId || q.assignedRunnerIds?.includes(currentUserId) || q.employeeId === currentUserId || (q.jobApplicants?.some(a => a.applicantId === currentUserId) || q.applicants?.some(a => a.userId === currentUserId))) && 
 (showHistory ? (isHistoryStatus(q.status) || q.archived) : (isActiveStatus(q.status) && !q.archived))
 );

 const createdQuests = quests.filter(q => 
 (q.creatorId === currentUserId) && 
 (showHistory ? (isHistoryStatus(q.status) || q.archived) : (isActiveStatus(q.status) && !q.archived))
 );

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

 const coords = gpsCoords || { lat: 35.184, lng: 4.556 };
 const lat = coords.lat;
 const lng = coords.lng;
 const locString = newLoc.trim() || resolveNeighborhoodFromCoords(lat, lng, 'بن سرور', lang);

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
 <div className="space-y-6 pb-32 font-sans text-[#1F2A44]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
 
 {/* Minimal Header: Only Archive Toggle Icon-Button */}
 <div className="flex justify-end items-center">
 <button
 onClick={() => setShowHistory(!showHistory)}
 className={`p-2.5 rounded-2xl border shadow-sm transition-all duration-300 cursor-pointer flex items-center justify-center ${
 showHistory
 ? 'bg-amber-100 border-amber-300 text-amber-800 ring-2 ring-amber-300/50'
 : 'bg-white border-gray-150 text-[#1F2A44] hover:bg-gray-50'
 }`}
 title={showHistory ? (lang === 'ar' ? 'العقود النشطة ' : 'Active Contracts') : (lang === 'ar' ? 'سجل المهام ' : 'History Log')}
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
 {lang === 'ar' ? 'مهامي ' : lang === 'fr' ? 'Engagements ' : 'My Jobs '} ({obligations.length})
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
 {lang === 'ar' ? 'طلباتي ' : lang === 'fr' ? 'Mes Primes ' : 'My Posts '} ({createdQuests.length})
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
 <div className="space-y-4">
 {displayObligations.length === 0 ? (
 <div className="py-10 px-4 text-center space-y-3">
 <div className="mx-auto flex justify-center">
 {showHistory ? (
 <svg className="w-24 h-24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
 <circle cx="60" cy="60" r="50" className="fill-slate-100/90" />
 <circle cx="60" cy="60" r="38" className="fill-slate-200/50" />
 <path d="M36 42C36 38.6863 38.6863 36 42 36H54L60 42H78C81.3137 42 84 44.6863 84 48V78C84 81.3137 81.3137 84 78 84H42C38.6863 84 36 81.3137 36 78V42Z" fill="#FFFFFF" stroke="#64748B" strokeWidth="3" strokeLinejoin="round" />
 <circle cx="52" cy="58" r="2.5" fill="#475569" />
 <circle cx="68" cy="58" r="2.5" fill="#475569" />
 <path d="M53 68C56 64 64 64 67 68" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
 </svg>
 ) : (
 <svg className="w-24 h-24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
 <circle cx="60" cy="60" r="50" className="fill-blue-50/80" />
 <circle cx="60" cy="60" r="38" className="fill-indigo-50/60" />
 <rect x="38" y="32" width="44" height="56" rx="10" fill="#FFFFFF" stroke="#3B82F6" strokeWidth="3" />
 <rect x="48" y="26" width="24" height="10" rx="4" fill="#3B82F6" />
 <circle cx="52" cy="52" r="2.5" fill="#475569" />
 <circle cx="68" cy="52" r="2.5" fill="#475569" />
 <path d="M53 64C56 60 64 60 67 64" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
 <line x1="48" y1="72" x2="72" y2="72" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 2" />
 <path d="M26 40L32 46M32 40L26 46" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
 <path d="M88 70L94 76M94 70L88 76" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
 </svg>
 )}
 </div>
 <h3 className="font-extrabold text-sm text-slate-800">
 {showHistory 
 ? (lang === 'ar' ? 'لا توجد كويستات مؤرشفة' : 'No archived quests')
 : (lang === 'ar' ? 'لم تحجز أي مهمة بعد' : 'You haven\'t booked any tasks yet')}
 </h3>
 </div>
 ) : (
 <div className="space-y-4">
 {displayObligations.map((quest) => {
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
 {lang === 'ar' ? 'وصلت للموقع ' : 'Arrived '}
 </span>
 )}
 {isUnderReview && (
 <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#FF9800]/10 text-[#E65100] border border-[#FF9800]/20 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-[#FF9800] animate-ping"></span>
 {lang === 'ar' ? 'قيد المراجعة ' : 'Under Review '}
 </span>
 )}
 {isDisputed && (
 <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#E91E63]/10 text-[#C2185B] border border-[#E91E63]/20 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-[#E91E63]"></span>
 {lang === 'ar' ? 'نزاع مالي ' : 'Dispute '}
 </span>
 )}
 {isFinished && (
 <span className="text-[10px] font-black px-3 py-1 rounded-full bg-[#4CAF50]/10 text-[#2E7D32] border border-[#4CAF50]/20 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]"></span>
 {lang === 'ar' ? 'مكتملة ' : 'Completed '}
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
 <h3 className="font-black text-xl md:text-2xl text-sky-500 dark:text-sky-400 leading-snug tracking-tight break-words">
 {quest.title}
 </h3>
 {(() => {
 const isAuthorized = quest.creatorId === currentUserId || isOngoing || isArrived || isUnderReview || isFinished;
 return (
 <div className="inline-flex items-center gap-1.5 text-xs max-w-full">
 {isAuthorized ? (
 <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100/80 px-3 py-1.5 rounded-2xl font-bold">
 <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
 <span className="truncate">{quest.location || (lang === 'ar' ? 'الموقع الميداني' : 'Field Location')}</span>
 </div>
 ) : (
 <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50/80 border border-amber-200/60 px-3 py-1.5 rounded-2xl font-bold">
 <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
 <span>
 {lang === 'ar' ? ' الموقع مخفي حتى قبول الحجز' : ' Hidden until booked'}
 </span>
 </div>
 )}
 </div>
 );
 })()}
 </div>

 
  {/* Long-Term Contract Summary Card (Rule 9) */}
  {(quest.questType === "long_term" || quest.status === "active_employment" || quest.status === "ending" || quest.status === "disputed" || quest.status === "active" || quest.status === "booked" || quest.helperId === currentUserId || quest.employeeId === currentUserId || quest.assignedRunnerId === currentUserId) && (
    <div className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/80 rounded-2xl p-4 text-xs space-y-2 text-start my-2">
      <div className="font-extrabold text-sky-900 dark:text-sky-200 flex items-center justify-between border-b border-sky-200/60 dark:border-sky-800/60 pb-2">
        <span className="flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{lang === "ar" ? "تفاصيل عقد العمل" : "Contract Details"}</span>
        </span>
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-200/60 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200">
          {quest.status === "completed" || quest.archived
            ? (lang === "ar" ? "منتهي ومؤرشف" : "Completed & Archived")
            : quest.status === "ending"
            ? (lang === "ar" ? "قيد الإنهاء" : "Ending Request")
            : (lang === "ar" ? "عقد نشط" : "Active Contract")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "اسم العمل:" : "Job Title:"}</span>
          <span className="font-bold text-slate-900 dark:text-white">{quest.title}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "الراتب:" : "Salary:"}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{quest.cashReward} DA ({quest.salaryPeriod === "monthly" ? (lang === "ar" ? "شهري" : "Monthly") : quest.salaryPeriod === "weekly" ? (lang === "ar" ? "أسبوعي" : "Weekly") : (lang === "ar" ? "يومي" : "Daily")})</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "صاحب العمل:" : "Employer:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.creatorName || (lang === "ar" ? "صاحب العمل" : "Employer")}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "العامل المتعاقد:" : "Employee:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.helperName || quest.employeeId || (lang === "ar" ? "غير محدد" : "N/A")}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "تاريخ البداية:" : "Start Date:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.startDate ? formatArabicDate(quest.startDate) : (quest.assignedAt ? formatArabicDate(quest.assignedAt) : formatArabicDate(quest.createdAt))}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "تاريخ النهاية:" : "End Date:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.terminatedAt ? formatArabicDate(quest.terminatedAt) : (quest.endDate ? formatArabicDate(quest.endDate) : (lang === "ar" ? "مستمر / غير محدد" : "Ongoing / Indefinite"))}</span>
        </div>
        {/* Contract Termination Row */}
        <div className="col-span-2 pt-2 border-t border-sky-200/60 dark:border-sky-800/60 mt-1">
          {quest.status === "ending" ? (
            quest.endRequestedBy === currentUserId ? (
              <div className="p-3 bg-amber-100/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-black text-center space-y-2">
                <p>{lang === "ar" ? "تم فسخ العقد وفك الارتباط. المنشور بانتظار إطلاع الطرف الآخر لنقله للأرشيف." : "Contract severed & unlinked. Post awaiting partner read receipt."}</p>
                <button
                  type="button"
                  onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg font-black text-[11px] cursor-pointer transition-all"
                >
                  {lang === "ar" ? "نقل للأرشيف 📁" : "Move to Archive 📁"}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2 text-start">
                <p className="text-xs font-black text-rose-800 dark:text-rose-200 text-center">
                  {lang === "ar" ? "وصلك إشعار فسخ العقد وفك الارتباط" : "Contract termination & unlinking notice"}
                </p>
                <div className="bg-white/80 dark:bg-rose-900/40 p-2 rounded-lg border border-rose-200/60 dark:border-rose-800/60 text-right">
                  <span className="text-[10px] text-rose-600 dark:text-rose-300 font-bold block">{lang === "ar" ? "السبب الموضح بالطلب:" : "Reason provided:"}</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{quest.endReason || (lang === "ar" ? "لم يحدد سبب إضافي" : "No reason provided")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2 rounded-xl shadow-xs transition-all cursor-pointer text-center"
                >
                  {lang === "ar" ? "تأكيد الاطلاع 📁" : "Acknowledge 📁"}
                </button>
              </div>
            )
          ) : quest.status === "disputed" ? (
            <div className="p-2.5 bg-rose-100/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-black text-center">
              {lang === "ar" ? "العقد في حالة نزاع حالياً - جاري معالجته من قِبل الإدارة" : "Contract in dispute"}
            </div>
          ) : (quest.employeeId || quest.helperId || quest.assignedRunnerId || (quest.assignedRunnerIds && quest.assignedRunnerIds.length > 0)) && (quest.status === "active_employment" || quest.status === "active" || quest.status === "booked" || quest.questType === "long_term") && quest.status !== "completed" && !quest.archived ? (
            <button
              type="button"
              onClick={() => setEndWorkQuestModal(quest)}
              className="w-full bg-white dark:bg-slate-900 border border-rose-300 hover:border-rose-500 text-rose-600 dark:text-rose-400 font-black text-xs py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>{lang === "ar" ? "فسخ العقد" : "Sever Contract"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )}

  {/* Description Section */}
 <div className="text-xs text-slate-600 leading-relaxed text-start space-y-3">
 <p className="whitespace-pre-wrap font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed text-start">
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
 <div className="flex flex-col gap-2.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100/80 hover:bg-slate-50 transition-colors duration-200">
 <div 
 onClick={() => onViewPublicProfile && onViewPublicProfile(quest.creatorId!)}
 className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
 >
 <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" />
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
 
 {isOngoing && (
 <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 w-full">
 <button
 type="button"
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
 className="flex-1 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
 >
 <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
 <span>{lang === 'ar' ? 'دردشة' : 'Chat'}</span>
 </button>

 <a
 href={`tel:${quest.creatorPhone || '0550000000'}`}
 className="flex-1 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm text-center"
 >
 <Phone className="w-3.5 h-3.5 text-white shrink-0" />
 <span>{lang === 'ar' ? 'اتصال' : 'Call'}</span>
 </a>
 </div>
 )}
 </div>
 );
 })()}

 {/* Actions Panel */}
 <div className="pt-3 border-t border-slate-100 space-y-3">
 {isOngoing && (
 <div className="flex flex-col gap-2.5 w-full">
 <div className="flex gap-2 w-full">
 <button
 onClick={() => setSelectedProofQuest(quest)}
 className="flex-1 bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white font-extrabold text-xs py-3 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
 >
 <Camera className="w-4 h-4 text-white" />
 <span>{lang === 'ar' ? 'إتمام' : 'Complete'}</span>
 </button>

 <button
 onClick={() => {
 window.dispatchEvent(new CustomEvent('navigate-to-quest-map', { detail: { quest } }));
 }}
 className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
 >
 <MapPin className="w-3.5 h-3.5 text-sky-500" />
 <span>{lang === 'ar' ? 'الموقع' : 'Location'}</span>
 </button>

 <button
 onClick={() => {
 const refundAmount = Math.round(quest.bookingFeeDA * 0.30);
 onCancelBookedQuest(quest.id, refundAmount);
 }}
 className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 hover:border-rose-200 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1"
 >
 <span>{lang === 'ar' ? 'إلغاء الحجز' : 'Cancel Reservation'}</span>
 </button>

 <button
 type="button"
 onClick={() => setEndWorkQuestModal(quest)}
 className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
 >
 <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
 <span>{lang === 'ar' ? 'فسخ العقد' : 'Sever Contract'}</span>
 </button>
 </div>

 {(() => {
 const isRunnerOnly = (quest.helperId === currentUserId || quest.assignedRunnerId === currentUserId || quest.assignedRunnerIds?.includes(currentUserId)) && quest.creatorId !== currentUserId;
 return isRunnerOnly && !isArrived && onArrivedAtQuest ? (
 <button
 onClick={() => {
 onArrivedAtQuest(quest.id);
 }}
 className="w-full bg-gradient-to-r from-[#FFD34D] to-[#FF3B7C] hover:from-[#FFD34D]/90 hover:to-[#FF3B7C]/90 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-md transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 mt-0.5"
 >
 <CheckCircle2 className="w-4 h-4" />
 <span> {lang === 'ar' ? 'تأكيد الوصول للموقع' : 'Confirm Arrival Directly '}
 </span>
 </button>
 ) : null;
 })()}
 </div>
 )}
 {isUnderReview && (
 <div className="w-full text-center bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100 text-xs font-extrabold text-amber-800 flex items-center justify-center gap-2 animate-pulse">
 <Clock className="w-4 h-4 text-amber-600" />
 <span>{lang === 'ar' ? 'في انتظار مراجعة صاحب العمل لتأكيد السداد المالي' : 'Awaiting employer confirmation.'}</span>
 </div>
 )}

 {isFinished && (
 <div className="w-full text-center bg-sky-50 rounded-2xl p-3.5 border border-sky-100 text-xs font-extrabold text-sky-800 flex items-center justify-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-sky-600 animate-bounce" />
 <span>{lang === 'ar' ? 'تم اكتمال الكويست واستلام الأموال بنجاح!' : 'Quest successfully completed!'}</span>
 </div>
 )}

 {onViewQuestDetail && (
 <button
 onClick={() => onViewQuestDetail(quest.id)}
 className="w-full bg-[#1F2A44]/5 hover:bg-[#1F2A44]/10 text-[#1F2A44] border border-[#1F2A44]/10 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 mt-2.5"
 >
 <span>{lang === 'ar' ? 'تفاصيل كاملة ' : 'Full Details '}</span>
 </button>
 )}
 </div>

 </div>
 );
 })}

 {/* Applied Pending Quests */}
 {!showHistory && (() => {
 const appliedQuests = quests.filter(q => (q.applicants?.some(a => a.userId === currentUserId) || q.jobApplicants?.some(a => a.applicantId === currentUserId)) && (q.status === 'open' || q.status === 'applications' || (q.status as string) === 'pending'));
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
 <h4 className="font-black text-lg text-sky-500 dark:text-sky-400 mt-1 leading-tight">{quest.title}</h4>
 <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
 <Lock className="w-3 h-3 text-amber-500" />
 <span className="text-slate-400">
 {lang === 'ar' ? ' الموقع مخفي حتى قبول الحجز' : ' Hidden until booked'}
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
 <span>{lang === 'ar' ? 'تفاصيل كاملة ' : 'Full Details '}</span>
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
 {displayCreatedQuests.length === 0 ? (
 <div className="py-10 px-4 text-center space-y-3">
 <div className="mx-auto flex justify-center">
 {showHistory ? (
 <svg className="w-24 h-24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
 <circle cx="60" cy="60" r="50" className="fill-slate-100/90" />
 <circle cx="60" cy="60" r="38" className="fill-slate-200/50" />
 <path d="M36 42C36 38.6863 38.6863 36 42 36H54L60 42H78C81.3137 42 84 44.6863 84 48V78C84 81.3137 81.3137 84 78 84H42C38.6863 84 36 81.3137 36 78V42Z" fill="#FFFFFF" stroke="#64748B" strokeWidth="3" strokeLinejoin="round" />
 <circle cx="52" cy="58" r="2.5" fill="#475569" />
 <circle cx="68" cy="58" r="2.5" fill="#475569" />
 <path d="M53 68C56 64 64 64 67 68" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
 </svg>
 ) : (
 <svg className="w-24 h-24" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
 <circle cx="60" cy="60" r="50" className="fill-amber-50/80" />
 <circle cx="60" cy="60" r="38" className="fill-orange-50/60" />
 <path d="M34 46C34 41.5817 37.5817 38 42 38H78C82.4183 38 86 41.5817 86 46V76C86 80.4183 82.4183 84 78 84H42C37.5817 84 34 80.4183 34 76V46Z" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="3" />
 <path d="M52 84L46 94L60 84" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="3" strokeLinejoin="round" />
 <circle cx="52" cy="54" r="2.5" fill="#475569" />
 <circle cx="68" cy="54" r="2.5" fill="#475569" />
 <path d="M53 66C56 62 64 62 67 66" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
 <circle cx="92" cy="42" r="3" fill="#FCD34D" />
 <circle cx="28" cy="78" r="2" fill="#FCD34D" />
 </svg>
 )}
 </div>
 <h3 className="font-extrabold text-sm text-slate-800">
 {showHistory
 ? (lang === 'ar' ? 'لا توجد كويستات مؤرشفة' : 'No archived quests')
 : (lang === 'ar' ? 'لم تطلب شيئاً بعد' : 'You haven\'t requested anything yet')}
 </h3>
 </div>
 ) : (
 <div className="space-y-4">
 {displayCreatedQuests.map((quest) => {
 const isAvailable = quest.status === 'open' || quest.status === 'applications' || (quest.status as string) === 'pending';
 const isClaimed = quest.status === 'booked';
 const isSubmitted = quest.status === 'pending_verification';
 const isFinished = quest.status === 'completed';
 const hasHiredWorker = !!(quest.employeeId || quest.helperId || quest.assignedRunnerId || (quest.assignedRunnerIds && quest.assignedRunnerIds.length > 0) || (quest.jobApplicants && quest.jobApplicants.some(a => a.status === 'accepted')));

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
 <span className="text-[10px] font-black px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
 <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
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
 <h3 className="font-black text-xl md:text-2xl text-sky-500 dark:text-sky-400 leading-snug tracking-tight break-words">
 {quest.title}
 </h3>
 <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100/80 px-3 py-1.5 rounded-2xl font-bold">
 <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
 <span className="truncate">{quest.location || (lang === 'ar' ? 'الموقع الميداني' : 'Field Location')}</span>
 </div>
 </div>

 
  {/* Long-Term Contract Summary Card (Rule 9) */}
  {(quest.questType === "long_term" || quest.status === "active_employment" || quest.status === "ending" || quest.status === "disputed" || quest.status === "active" || quest.status === "booked" || quest.helperId === currentUserId || quest.employeeId === currentUserId || quest.assignedRunnerId === currentUserId) && (
    <div className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/80 rounded-2xl p-4 text-xs space-y-2 text-start my-2">
      <div className="font-extrabold text-sky-900 dark:text-sky-200 flex items-center justify-between border-b border-sky-200/60 dark:border-sky-800/60 pb-2">
        <span className="flex items-center gap-1.5">
          <Briefcase className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{lang === "ar" ? "تفاصيل عقد العمل" : "Contract Details"}</span>
        </span>
        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-200/60 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200">
          {quest.status === "completed" || quest.archived
            ? (lang === "ar" ? "منتهي ومؤرشف" : "Completed & Archived")
            : quest.status === "ending"
            ? (lang === "ar" ? "قيد الإنهاء" : "Ending Request")
            : (lang === "ar" ? "عقد نشط" : "Active Contract")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "اسم العمل:" : "Job Title:"}</span>
          <span className="font-bold text-slate-900 dark:text-white">{quest.title}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "الراتب:" : "Salary:"}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{quest.cashReward} DA ({quest.salaryPeriod === "monthly" ? (lang === "ar" ? "شهري" : "Monthly") : quest.salaryPeriod === "weekly" ? (lang === "ar" ? "أسبوعي" : "Weekly") : (lang === "ar" ? "يومي" : "Daily")})</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "صاحب العمل:" : "Employer:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.creatorName || (lang === "ar" ? "صاحب العمل" : "Employer")}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "العامل المتعاقد:" : "Employee:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.helperName || quest.employeeId || (lang === "ar" ? "غير محدد" : "N/A")}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "تاريخ البداية:" : "Start Date:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.startDate ? formatArabicDate(quest.startDate) : (quest.assignedAt ? formatArabicDate(quest.assignedAt) : formatArabicDate(quest.createdAt))}</span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">{lang === "ar" ? "تاريخ النهاية:" : "End Date:"}</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{quest.terminatedAt ? formatArabicDate(quest.terminatedAt) : (quest.endDate ? formatArabicDate(quest.endDate) : (lang === "ar" ? "مستمر / غير محدد" : "Ongoing / Indefinite"))}</span>
        </div>
        {/* Contract Termination Row */}
        <div className="col-span-2 pt-2 border-t border-sky-200/60 dark:border-sky-800/60 mt-1">
          {quest.status === "ending" ? (
            quest.endRequestedBy === currentUserId ? (
              <div className="p-3 bg-amber-100/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-black text-center space-y-2">
                <p>{lang === "ar" ? "تم فسخ العقد وفك الارتباط. المنشور بانتظار إطلاع الطرف الآخر لنقله للأرشيف." : "Contract severed & unlinked. Post awaiting partner read receipt."}</p>
                <button
                  type="button"
                  onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-1.5 rounded-lg font-black text-[11px] cursor-pointer transition-all"
                >
                  {lang === "ar" ? "نقل للأرشيف 📁" : "Move to Archive 📁"}
                </button>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-2 text-start">
                <p className="text-xs font-black text-rose-800 dark:text-rose-200 text-center">
                  {lang === "ar" ? "وصلك إشعار فسخ العقد وفك الارتباط" : "Contract termination & unlinking notice"}
                </p>
                <div className="bg-white/80 dark:bg-rose-900/40 p-2 rounded-lg border border-rose-200/60 dark:border-rose-800/60 text-right">
                  <span className="text-[10px] text-rose-600 dark:text-rose-300 font-bold block">{lang === "ar" ? "السبب الموضح بالطلب:" : "Reason provided:"}</span>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">{quest.endReason || (lang === "ar" ? "لم يحدد سبب إضافي" : "No reason provided")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2 rounded-xl shadow-xs transition-all cursor-pointer text-center"
                >
                  {lang === "ar" ? "تأكيد الاطلاع 📁" : "Acknowledge 📁"}
                </button>
              </div>
            )
          ) : quest.status === "disputed" ? (
            <div className="p-2.5 bg-rose-100/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-black text-center">
              {lang === "ar" ? "العقد في حالة نزاع حالياً - جاري معالجته من قِبل الإدارة" : "Contract in dispute"}
            </div>
          ) : (quest.employeeId || quest.helperId || quest.assignedRunnerId || (quest.assignedRunnerIds && quest.assignedRunnerIds.length > 0)) && (quest.status === "active_employment" || quest.status === "active" || quest.status === "booked" || quest.questType === "long_term") && quest.status !== "completed" && !quest.archived ? (
            <button
              type="button"
              onClick={() => setEndWorkQuestModal(quest)}
              className="w-full bg-white dark:bg-slate-900 border border-rose-300 hover:border-rose-500 text-rose-600 dark:text-rose-400 font-black text-xs py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>{lang === "ar" ? "فسخ العقد" : "Sever Contract"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )}

  {/* Description Section */}
 {quest.description && quest.description.trim() && (
 <div className="text-xs text-slate-600 leading-relaxed text-start space-y-3">
 <p className="font-medium text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed text-start break-words">
 {quest.description}
 </p>
 {quest.imageUrl && (
 <div className="relative group overflow-hidden rounded-[1.5rem] border border-slate-150 max-h-56 bg-slate-50 flex items-center justify-center shadow-xs transition duration-300">
 <img src={quest.imageUrl} alt={quest.title} className="w-full h-full object-cover max-h-56 group-hover:scale-[1.01] transition duration-500" />
 </div>
 )}
 </div>
 )}

 {/* Compact Hired Worker Profile Row */}
 {(quest.helperId || quest.assignedRunnerId) && (() => {
 const runnerId = quest.helperId || quest.assignedRunnerId;
 const name = quest.helperName || (lang === 'ar' ? 'المساعد الميداني' : 'Assistant');
 const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=f43f5e`;
 return (
 <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100/80 hover:bg-slate-50 transition-colors duration-200 gap-2">
 <div 
 onClick={() => onViewPublicProfile && onViewPublicProfile(runnerId!)}
 className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity min-w-0"
 >
 <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-xs shrink-0" />
 <div className="text-start min-w-0">
 <span className="text-[9px] text-slate-400 block font-black uppercase tracking-wider whitespace-nowrap">
 {lang === 'ar' ? 'المساعد المعيّن' : 'Hired Assistant'}
 </span>
 <span className="text-xs font-extrabold text-slate-800 leading-none flex items-center gap-1 mt-0.5 truncate">
 {name}
 <span className="text-amber-500 font-mono font-bold text-[10px] shrink-0">4.9</span>
 </span>
 </div>
 </div>
 
 <div className="flex items-center gap-1.5 shrink-0">
 <button
 type="button"
 onClick={() => {
 window.dispatchEvent(new CustomEvent('open-chat', {
 detail: {
 chatId: `${quest.id}_${quest.creatorId}_${runnerId}`,
 questTitle: quest.title,
 recipientName: name,
 recipientAvatar: avatar
 }
 }));
 }}
 className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-[10px] px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
 >
 <MessageSquare className="w-3.5 h-3.5 text-sky-400 shrink-0" />
 <span className="whitespace-nowrap">{lang === 'ar' ? 'دردشة' : 'Chat'}</span>
 </button>

 {quest.helperPhone ? (
 <a
 href={`tel:${quest.helperPhone}`}
 className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold text-[10px] px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm whitespace-nowrap shrink-0"
 >
 <Phone className="w-3.5 h-3.5 text-white animate-bounce shrink-0" />
 <span className="whitespace-nowrap">{lang === 'ar' ? 'اتصال' : 'Direct Call'}</span>
 </a>
 ) : (
 <button
 type="button"
 onClick={() => {
 alert(
 lang === 'ar'
 ? 'رقم هاتف العامل غير متوفر في حسابه حالياً'
 : 'Worker phone number is not available'
 );
 }}
 className="bg-sky-600/20 text-sky-800 active:scale-95 font-extrabold text-[10px] px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
 >
 <Phone className="w-3.5 h-3.5 text-sky-700 shrink-0" />
 <span className="whitespace-nowrap">{lang === 'ar' ? 'اتصال' : 'Call'}</span>
 </button>
 )}
 </div>
 </div>
 );
 })()}

 {/* Applicants pipeline list */}
 {(() => {
 const combinedApps: Applicant[] = [
 ...(quest.applicants || []),
 ...((quest.jobApplicants || []).map(ja => ({
 userId: ja.applicantId,
 name: ja.applicantName,
 avatar: ja.applicantAvatar,
 phone: ja.applicantPhone || "",
 rating: 5.0,
 questsCompleted: 0
 })))
 ].filter((app, idx, self) => idx === self.findIndex(a => a.userId === app.userId));

 if (combinedApps.length === 0) return null;
 if (!isAvailable && quest.status !== "applications" && quest.status !== "open" && (quest.status as string) !== "pending") return null;

 return (
 <div className="p-4 bg-slate-50 border border-slate-150/50 rounded-2xl space-y-3.5 text-start">
 <div className="text-[10px] font-black text-slate-700 flex items-center gap-2 uppercase tracking-wider">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B7C] opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3B7C]"></span>
 </span>
 <span>{lang === "ar" ? `المتقدمون لتنفيذ المهمة (${combinedApps.length})` : `Applicants (${combinedApps.length})`}</span>
 </div>
 <div className="flex flex-wrap gap-2.5">
 {combinedApps.map((app) => (
 <button
 key={app.userId}
 onClick={() => setSelectedApplicantData({ quest, applicant: app })}
 className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 py-2 px-4 rounded-full text-xs font-extrabold transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs hover:border-slate-400"
 >
 <img src={app.avatar} alt={app.name} className="w-5.5 h-5.5 rounded-full object-cover shadow-2xs border border-white" />
 <span className="text-slate-800">{app.name}</span>
 <span className="text-[10px] text-amber-500 font-mono font-black flex items-center gap-0.5"> {app.rating || "5.0"}</span>
 </button>
 ))}
 </div>
 </div>
 );
 })()}
 {false && (
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
 <span className="text-[10px] text-amber-500 font-mono font-black flex items-center gap-0.5"> {app.rating || '5.0'}</span>
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

 {((isClaimed || !!quest.helperId || !!quest.assignedRunnerId) && !isFinished && quest.status !== 'cancelled' && quest.status !== 'cancelled_by_timeout') && (
 <div className="flex gap-2 w-full">
 <button
 type="button"
 onClick={() => {
 if (quest.status === 'arrived' || quest.status === 'pending_verification' || quest.status === 'completed') {
 alert(lang === 'ar'
 ? ' لا يمكن إلغاء العقد بعد وصول العامل إلى الموقع الميداني أو إكمال المهمة!'
 : ' Cannot cancel contract after the worker has arrived at the location!'
 );
 return;
 }
 if (window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في إلغاء العقد وحذف الكويست وتحرير الارتباط؟' : 'Are you sure you want to cancel contract and delete quest?')) {
 if (onForceReleaseContract) {
 onForceReleaseContract(quest.id);
 }
 }
 }}
 className={`w-full py-2.5 px-4 font-bold text-xs rounded-2xl transition duration-200 flex items-center justify-center gap-1.5 ${
 (quest.status === 'arrived' || quest.status === 'pending_verification' || quest.status === 'completed')
 ? 'opacity-40 cursor-not-allowed text-gray-400 bg-gray-50 border border-gray-200'
 : 'hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 cursor-pointer bg-white'
 }`}
 title={
 (quest.status === 'arrived' || quest.status === 'pending_verification' || quest.status === 'completed')
 ? (lang === 'ar' ? 'وصل العامل - يمنع إلغاء العقد' : 'Worker Arrived - Cancellation Blocked')
 : (lang === 'ar' ? 'إلغاء العقد الميداني' : 'Cancel Contract')
 }
 >
 <X className="w-4 h-4 text-rose-500" />
 <span>{lang === 'ar' ? 'إلغاء العقد' : 'Cancel Contract'}</span>
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
 {lang === 'ar' ? 'تم الاكتمال والسداد بالكامل ' : 'Completed and fully paid '}
 </div>
 )}
 </div>

 {onViewQuestDetail && (
 <button
 onClick={() => onViewQuestDetail(quest.id)}
 className="w-full bg-[#1F2A44]/5 hover:bg-[#1F2A44]/10 text-[#1F2A44] border border-[#1F2A44]/10 font-bold text-xs py-2.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5"
 >
 <span>{lang === 'ar' ? 'تفاصيل كاملة ' : 'Full Details '}</span>
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

 {/* Stars selection */}
 <div className="space-y-1 text-center">
 <label className="text-xs font-black text-[#1F2A44] block">
 {lang === 'ar' ? 'كم نجمة يستحق شريكك؟' : 'How many stars does your partner deserve?'}
 </label>
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
 </div>

 {/* Testimonial comments text shape */}
 <div className="space-y-1 text-right">
 <label className="text-xs font-black text-[#1F2A44] block">
 {lang === 'ar' ? 'التفاصيل' : 'Details'}
 </label>
 <textarea
 rows={2}
 maxLength={140}
 placeholder={lang === 'ar' ? 'اكتب التفاصيل والملاحظات...' : 'Write details and feedback...'}
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
 {lang === 'ar' ? 'تأكيد' : 'Confirm'}
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
</div>
 </PullToRefresh>
 );
}
