import React, { useState, useRef, useEffect } from 'react';
import {
 X,
 Plus,
 Minus,
 Image as ImageIcon,
 Camera,
 MapPin,
 Sparkles,
 History,
 DollarSign,
 Users,
 Check,
 ChevronRight,
 ChevronLeft,
 Loader2,
 Wrench,
 Truck,
 GraduationCap,
 ShoppingBag,
 Laptop,
 Home as HomeIcon,
 Heart,
 Compass,
 Zap,
 Wallet,
 Briefcase
} from 'lucide-react';
import { Quest, QuestCategory, UserProfile } from '../types';
import { calculateBookingFee } from '../utils/fee';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../data/translations';
import { compressImage } from '../utils/imageCompressor';
import { Geolocator } from '../utils/geolocator';
import { resolveNeighborhoodFromCoords, cleanLocationName } from '../utils/locationFormatter';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../utils/firebase';

interface GlobalCreateQuestModalProps {
 isOpen: boolean;
 onClose: () => void;
 onPostQuest: (newQuest: Partial<Quest>) => void;
 lang: 'ar' | 'fr' | 'en';
 userProfile: UserProfile;
 audioEnabled?: boolean;
}

const CATEGORIES_DATA = [
 { 
 id: 'صيانة' as QuestCategory, 
 icon: Wrench, 
 labelAr: 'صيانة', labelFr: 'Maintenance', labelEn: 'Maintenance', 
 descAr: 'سباكة، كهرباء، تكييف، دهان، نجارة', 
 descFr: 'Plomberie, électricité, clim, bricolage', 
 descEn: 'Plumbing, electricity, AC, handwork' 
 },
 { 
 id: 'توصيل' as QuestCategory, 
 icon: Truck, 
 labelAr: 'توصيل شحنات', labelFr: 'Livraison', labelEn: 'Delivery', 
 descAr: 'وجبات، بقالة، طرود، مستندات عاجلة', 
 descFr: 'Repas, colis, documents, épicerie', 
 descEn: 'Meals, packages, documents, grocery' 
 },
 { 
 id: 'تعليم' as QuestCategory, 
 icon: GraduationCap, 
 labelAr: 'دروس خصوصية', labelFr: 'Éducation', labelEn: 'Education', 
 descAr: 'تعليم لغات، مراجعة مدرسية، برمجة', 
 descFr: 'Langues, devoirs, coaching, programmation', 
 descEn: 'Tutoring, languages, exam review, dev' 
 },
 { 
 id: 'تسوق' as QuestCategory, 
 icon: ShoppingBag, 
 labelAr: 'قضاء حوائج', labelFr: 'Shopping', labelEn: 'Shopping & Errands', 
 descAr: 'اقتناء أغراض، تسوق نيابة عنك، هدايا', 
 descFr: 'Courses de proximité, achats, cadeaux', 
 descEn: 'Local errands, shopping, purchase' 
 },
 { 
 id: 'تقنية' as QuestCategory, 
 icon: Laptop, 
 labelAr: 'دعم تقني', labelFr: 'Technologie', labelEn: 'Tech Support', 
 descAr: 'إصلاح هواتف وحواسيب، تنصيب برامج', 
 descFr: 'Réparation PC/Mobile, configuration, WIFI', 
 descEn: 'Phone/PC repair, config, network fix' 
 },
 { 
 id: 'مساعدة منزلية' as QuestCategory, 
 icon: HomeIcon, 
 labelAr: 'مساعدة منزلية', labelFr: 'Aide Ménagère', labelEn: 'Home Helper', 
 descAr: 'تنظيف غرف، كي الملابس، ترتيب المنزل', 
 descFr: 'Ménage, repassage, nettoyage de printemps', 
 descEn: 'Cleaning, ironing, spring tidy up' 
 },
 { 
 id: 'رعاية أليفة' as QuestCategory, 
 icon: Heart, 
 labelAr: 'رعاية أليفة', labelFr: 'Animaux', labelEn: 'Pet Sitting', 
 descAr: 'تمشية كلاب، إطعام قطط، رعاية مؤقتة', 
 descFr: 'Garde de chat, promenade de chien', 
 descEn: 'Cat feeding, dog walking, boarding' 
 },
 { 
 id: 'أخرى' as QuestCategory, 
 icon: Sparkles, 
 labelAr: 'مهام أخرى', labelFr: 'Autre Prime', labelEn: 'Other Quest', 
 descAr: 'مهام مخصصة متنوعة غير مذكورة', 
 descFr: 'Autres types de missions sur mesure', 
 descEn: 'Any custom bespoke on-demand task' 
 }
];

export default function GlobalCreateQuestModal({
 isOpen,
 onClose,
 onPostQuest,
 lang,
 userProfile,
 audioEnabled = true
}: GlobalCreateQuestModalProps) {
 const dict = translations[lang];
 const isRtl = lang === 'ar';

 // Modal Step State (1 to 8)
 const [step, setStep] = useState(1);

 // Form Fields
 const [questType, setQuestType] = useState<'quick' | 'long_term'>('quick');
 const [title, setTitle] = useState('');
 const [desc, setDesc] = useState('');
 const [category, setCategory] = useState<QuestCategory>('صيانة');
 const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'featured'>('normal');
 const [cashReward, setCashReward] = useState<number>(1500);
 const [requiredWorkers, setRequiredWorkers] = useState<number>(1);
 const [images, setImages] = useState<string[]>([]);
 const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
 const [locationText, setLocationText] = useState<string>('');
 const [gpsAccuracyInfo, setGpsAccuracyInfo] = useState<string>('');

 // Long-term Job additional fields
 const [salaryPeriod, setSalaryPeriod] = useState<'monthly' | 'weekly' | 'daily' | 'hourly'>('monthly');
 const [employmentType, setEmploymentType] = useState<'full_time' | 'part_time'>('full_time');
 const [durationType, setDurationType] = useState<'fixed' | 'ongoing'>('ongoing');
 const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
 const [endDate, setEndDate] = useState<string>('');
 const [skillsText, setSkillsText] = useState<string>('');

 // Status indicators
 const [gpsLoading, setGpsLoading] = useState(false);
 const [imageUploading, setImageUploading] = useState(false);
 const [uploadProgress, setUploadProgress] = useState(0);

 const fileInputRef = useRef<HTMLInputElement>(null);
 const cameraInputRef = useRef<HTMLInputElement>(null);

 // Play audio clicking feed
 const playSound = () => {
 if (audioEnabled) {
 try {
 const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav');
 audio.volume = 0.25;
 audio.play().catch(() => {});
 } catch (e) {}
 }
 };

 // Reset fields on open or close
 useEffect(() => {
 if (isOpen) {
 setStep(1);
 setQuestType('quick');
 setTitle('');
 setDesc('');
 setCategory('صيانة');
 setUrgency('normal');
 setCashReward(1500);
 setRequiredWorkers(1);
 setImages([]);
 setGpsCoords(null);
 setLocationText('');
 setGpsAccuracyInfo('');
 setSalaryPeriod('monthly');
 setEmploymentType('full_time');
 setDurationType('ongoing');
 setStartDate(new Date().toISOString().split('T')[0]);
 setEndDate('');
 setSkillsText('');
 }
 }, [isOpen]);

 // Require manual GPS trigger via the button on Step 3
 if (!isOpen) return null;

 const handleAutoGPS = async () => {
 playSound();
 setGpsLoading(true);
 setGpsCoords(null);
 setGpsAccuracyInfo(lang === 'ar' ? 'جاري الاتصال بـ GPS لالتقاط الموقع عبر المستشعر...' : 'Connecting GPS sensor...');

 try {
 const accurate = await Geolocator.getAccuratePhysicalLocation((sampleCount, bestAcc) => {
 setGpsAccuracyInfo(
 lang === 'ar'
 ? `جاري معايرة الدقة... عينات: ${sampleCount} • أفضل دقة: ±${Math.round(bestAcc)}م`
 : `Calibrating precision... Samples: ${sampleCount} • Best accuracy: ±${Math.round(bestAcc)}m`
 );
 });

 const coords = { lat: accurate.lat, lng: accurate.lng };
 setGpsCoords(coords);
 Geolocator.saveCachedLocation(coords.lat, coords.lng);
 
 const resolvedName = resolveNeighborhoodFromCoords(coords.lat, coords.lng, '', lang);
 if (resolvedName && !locationText) {
 setLocationText(resolvedName);
 }

 setGpsAccuracyInfo(
 lang === 'ar'
 ? `تمت معايرة الموقع بنجاح (±${Math.round(accurate.accuracy)}م)`
 : `GPS location tagged (±${Math.round(accurate.accuracy)}m)`
 );
 } catch (err) {
 console.warn("GPS Calibration Notice:", err);
 setGpsAccuracyInfo(
 lang === 'ar'
 ? 'تعذر التقاط إشارة GPS، يرجى تفعيل خدمة الموقع ثم إعادة المحاولة'
 : 'Live GPS hardware fix unavailable, please verify location services'
 );
 } finally {
 setGpsLoading(false);
 }
 };

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files || files.length === 0) return;

 const currentCount = images.length;
 const allowedNewCount = Math.max(0, 3 - currentCount);
 if (allowedNewCount === 0) {
 alert(lang === 'ar' ? 'أقصى حد مسموح به هو ٣ صور' : 'Maximum 3 images allowed!');
 return;
 }

 setImageUploading(true);
 setUploadProgress(10);

 const filesArray = Array.from(files).slice(0, allowedNewCount);
 const uploadedUrls: string[] = [];

 try {
 for (let i = 0; i < filesArray.length; i++) {
 const file = filesArray[i] as File;
 setUploadProgress(20 + Math.round((i / filesArray.length) * 60));
 
 // Compress using local compressor
 const compressedBase64 = await compressImage(file);

 try {
 const storageRef = ref(storage, `quests/${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}.jpg`);
 
 // Wrap with a strict 1500ms timeout to avoid hanging at 20%
 const downloadUrl = await new Promise<string>(async (resolve, reject) => {
 let completed = false;
 const timer = setTimeout(() => {
 if (!completed) {
 completed = true;
 reject(new Error("Firebase Storage upload timed out"));
 }
 }, 1500);

 try {
 await uploadString(storageRef, compressedBase64, 'data_url');
 const url = await getDownloadURL(storageRef);
 completed = true;
 clearTimeout(timer);
 resolve(url);
 } catch (err) {
 completed = true;
 clearTimeout(timer);
 reject(err);
 }
 });

 uploadedUrls.push(downloadUrl);
 } catch (storageErr) {
 console.warn("Storage upload failed or took too long, fallback to base64", storageErr);
 uploadedUrls.push(compressedBase64);
 }
 }

 setUploadProgress(100);
 setTimeout(() => {
 setImageUploading(false);
 setImages(prev => [...prev, ...uploadedUrls]);
 }, 300);

 } catch (err) {
 console.warn(err);
 setImageUploading(false);
 alert(lang === 'ar' ? 'فشل تحميل الصور' : 'Failed to load images');
 }
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();

 if (step < 8) {
 if (step === 3 && (!gpsCoords || gpsLoading)) {
 alert(lang === 'ar' 
 ? 'لا يمكن التخطي! يجب الضغط على زر "تحديد تلقائي عبر مستشعر الـ GPS" أولاً والانتظار حتى يتم استقبال الإحداثيات بنجاح.' 
 : 'Cannot proceed! You must click "Auto-Tag GPS Position" and receive coordinates first.');
 return;
 }
 if (
 (step === 1 && title.trim()) ||
 (step === 2 && desc.trim()) ||
 (step === 3 && gpsCoords && !gpsLoading) ||
 (step === 6 && cashReward >= 500) ||
 (step !== 1 && step !== 2 && step !== 3 && step !== 6)
 ) {
 playSound();
 setStep(prev => prev + 1);
 }
 return;
 }

 if (!gpsCoords) {
 alert(lang === 'ar' 
 ? 'رصد موقع الـ GPS من الجهاز إجباري لنشر الكويست! ملأ اسم الحي هو للعرض على بطاقة الكويست فقط وليس بديلاً عن الـ GPS.' 
 : 'Live GPS position capture is required to publish a quest!');
 setStep(3);
 return;
 }
 const activeCoords = gpsCoords;
 const finalLocation = locationText.trim() || resolveNeighborhoodFromCoords(activeCoords.lat, activeCoords.lng, 'بن سرور', lang);

 // Call callback to store quest
 onPostQuest({
 title,
 description: desc,
 category,
 urgency,
 cashReward,
 requiredWorkerCount: requiredWorkers,
 imageUrls: images,
 images: images,
 imageUrl: images[0] || '',
 location: finalLocation,
 lat: activeCoords.lat,
 lng: activeCoords.lng,
 locationCoords: { lat: activeCoords.lat, lng: activeCoords.lng },
 gpsCoords: { lat: activeCoords.lat, lng: activeCoords.lng } as any,
 questType,
 salaryPeriod: questType === 'long_term' ? salaryPeriod : undefined,
 employmentType: questType === 'long_term' ? employmentType : undefined,
 durationType: questType === 'long_term' ? durationType : undefined,
 startDate: questType === 'long_term' ? startDate : undefined,
 endDate: (questType === 'long_term' && durationType === 'fixed') ? endDate : undefined,
 requiredSkills: questType === 'long_term' && skillsText.trim() ? skillsText.split(',').map(s => s.trim()).filter(Boolean) : undefined,
 });

 onClose();
 };

 const calculatedFee = calculateBookingFee(cashReward, questType);

 return (
 <AnimatePresence>
 <div 
 id="global-create-quest-overlay"
 className="fixed inset-0 bg-[#0F172A]/90 backdrop-blur-xl z-50 flex flex-col justify-between"
 style={{ direction: isRtl ? 'rtl' : 'ltr' }}
 >
 {/* Modern Header Navigation */}
 <div className="flex justify-between items-center px-6 py-5 border-b border-white/5 bg-slate-900/40 relative z-20">
 <div className="flex items-center gap-3">
 <span className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF3B7C] to-[#4FC3F7] flex items-center justify-center text-white text-lg font-black shadow-lg shadow-[#FF3B7C]/15 select-none">
 +
 </span>
 <div>
 <h1 className="text-white text-base font-black tracking-tight">
 {lang === 'ar' ? 'نشر كويست جديد' : lang === 'fr' ? 'Publier une Quest' : 'Publish New Quest'}
 </h1>
 <p className="text-[10px] text-gray-400 font-bold">
 {lang === 'ar' ? 'أدخل تفاصيل المهمة لنشرها' : lang === 'fr' ? 'Remplissez les détails' : 'Enter task details to publish'}
 </p>
 </div>
 </div>

 <button
 id="global-create-quest-close"
 onClick={() => {
 playSound();
 onClose();
 }}
 className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer select-none active:scale-90"
 title={dict.cancelBtn}
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Global Progress Line Indicator */}
 <div className="w-full bg-slate-800 h-1.5 relative overflow-hidden">
 <motion.div 
 className="h-full bg-gradient-to-r from-[#FF3B7C] via-[#9061F9] to-[#4FC3F7] rounded-full"
 initial={{ width: '0%' }}
 animate={{ width: `${(step / 8) * 100}%` }}
 transition={{ duration: 0.3 }}
 />
 </div>

 {/* Scrollable Center Content Area */}
 <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-y-auto max-w-2xl mx-auto w-full relative z-10">
 <form onSubmit={handleSubmit} className="w-full space-y-6">
 <AnimatePresence mode="wait">
 {/* Step 1: TITLE & OPPORTUNITY TYPE */}
 {step === 1 && (
 <motion.div
 key="step-title"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 transition={{ duration: 0.2 }}
 className="space-y-4"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-[#FF3B7C] uppercase tracking-wider font-extrabold bg-[#FF3B7C]/10 px-3 py-1 rounded-full border border-[#FF3B7C]/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة الأولى • نوع الفرصة والعنوان' : 'Step 1 • Opportunity Type & Title'}
 </span>
 <h2 className="text-white text-2xl font-black">
 {lang === 'ar' ? 'اختر نوع الفرصة التي تود إطلاقها' : 'Select Opportunity Type & Title'}
 </h2>
 </div>

 {/* Opportunity Type Toggle Cards */}
 <div className="grid grid-cols-2 gap-4 pt-1">
 <button
 type="button"
 onClick={() => { playSound(); setQuestType('quick'); }}
 className={`p-5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
 questType === 'quick'
 ? 'bg-[#FF3B7C]/20 border-[#FF3B7C] text-white shadow-lg shadow-[#FF3B7C]/15 ring-2 ring-[#FF3B7C]/30'
 : 'bg-slate-900/40 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
 }`}
 >
 <Zap className={`w-8 h-8 ${questType === 'quick' ? 'text-[#FF3B7C] fill-[#FF3B7C]/30 animate-pulse' : 'text-gray-400'}`} />
 <span className="text-sm font-black tracking-tight">
 {lang === 'ar' ? 'مهمة سريعة' : lang === 'fr' ? 'Mission Rapide' : 'Quick Task'}
 </span>
 </button>

 <button
 type="button"
 onClick={() => {
 playSound();
 setQuestType('long_term');
 if (cashReward < 5000) setCashReward(35000);
 }}
 className={`p-5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
 questType === 'long_term'
 ? 'bg-sky-500/20 border-sky-500 text-white shadow-lg shadow-sky-500/15 ring-2 ring-sky-500/30'
 : 'bg-slate-900/40 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
 }`}
 >
 <Briefcase className={`w-8 h-8 ${questType === 'long_term' ? 'text-sky-400 fill-sky-500/30' : 'text-gray-400'}`} />
 <span className="text-sm font-black tracking-tight">
 {lang === 'ar' ? 'عقد عمل' : lang === 'fr' ? 'Contrat de Travail' : 'Job Contract'}
 </span>
 </button>
 </div>

 <div className="relative pt-1">
 <label className="text-xs text-gray-300 font-bold block mb-1.5 text-start">
 {questType === 'long_term' 
 ? (lang === 'ar' ? 'المسمى الوظيفي:' : 'Job Title:') 
 : (lang === 'ar' ? 'عنوان المهمة:' : 'Quest Title:')}
 </label>
 <input
 id="quest-input-title"
 type="text"
 autoFocus
 required
 placeholder={
 questType === 'long_term'
 ? (lang === 'ar' ? 'مثال: موظف استقبال، بائع في محل تجاري، سائق...' : 'e.g. Receptionist, Shop Assistant, Driver...')
 : (lang === 'ar' ? 'مثال: صيانة مكيف بالجزائر العاصمة...' : 'e.g. AC Maintenance in Algiers...')
 }
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 className="w-full px-6 py-4 bg-slate-900/60 text-white border border-white/10 rounded-2xl text-base font-bold focus:outline-none focus:border-[#FF3B7C] focus:ring-4 focus:ring-[#FF3B7C]/20 transition-all text-center tracking-wide"
 />
 </div>
 </motion.div>
 )}

 {/* Step 2: DESCRIPTION & SKILLS */}
 {step === 2 && (
 <motion.div
 key="step-desc"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-4"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-[#4FC3F7] uppercase tracking-wider font-extrabold bg-[#4FC3F7]/10 px-3 py-1 rounded-full border border-[#4FC3F7]/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة الثانية • التفاصيل والمهارات' : 'Step 2 • Details & Skills'}
 </span>
 <h2 className="text-white text-2xl font-black">
 {questType === 'long_term'
 ? (lang === 'ar' ? 'وصف العمل والمهارات المطلوبة' : 'Job Description & Required Skills')
 : (lang === 'ar' ? 'اشرح تفاصيل المهمة والأدوات اللازمة' : 'Describe requirements and details')}
 </h2>
 </div>

 <div className="space-y-3 text-start">
 <div>
 <label className="text-xs text-gray-300 font-bold block mb-1">
 {lang === 'ar' ? 'وصف التفاصيل والشروط:' : 'Details & Description:'}
 </label>
 <textarea
 id="quest-input-desc"
 required
 rows={3}
 placeholder={
 questType === 'long_term'
 ? (lang === 'ar' ? 'مثال: مطلوب عامل للعمل بمحل بيع المواد الغذائية، ساعات العمل من 8 صباحاً إلى 5 مساءً...' : 'e.g. Grocery shop assistant wanted, work hours 8am to 5pm...')
 : (lang === 'ar' ? 'مثال: نأمل إحضار مفتاح رقم ١٢، والتأكد من شحن الغاز...' : 'e.g. Please bring size 12 wrench...')
 }
 value={desc}
 onChange={(e) => setDesc(e.target.value)}
 className="w-full px-5 py-3.5 bg-slate-900/60 text-white border border-white/10 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#4FC3F7] focus:ring-4 focus:ring-[#4FC3F7]/20 transition-all leading-relaxed"
 />
 <div className="text-right text-[10px] text-gray-500 font-bold mt-1">
 {desc.length} {lang === 'ar' ? 'حرف' : 'chars'}
 </div>
 </div>

 {questType === 'long_term' && (
 <div>
 <label className="text-xs text-sky-400 font-bold block mb-1">
 {lang === 'ar' ? 'المهارات والخبرات المطلوبة (افصل بينها بفاصلة):' : 'Required Skills (comma separated):'}
 </label>
 <input
 type="text"
 placeholder={lang === 'ar' ? 'مثال: إتقان الحاسوب، خبرة مبيعات، لغة فرنسية' : 'e.g. Computer literacy, Sales experience, French language'}
 value={skillsText}
 onChange={(e) => setSkillsText(e.target.value)}
 className="w-full px-5 py-3 bg-slate-900/60 text-white border border-sky-500/30 rounded-2xl text-xs font-bold focus:outline-none focus:border-sky-500 transition-all"
 />
 </div>
 )}
 </div>
 </motion.div>
 )}

 {/* Step 3: LOCATION GPS */}
 {step === 3 && (
 <motion.div
 key="step-gps"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-5"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-amber-400 uppercase tracking-wider font-extrabold bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة الثالثة • الموقع الجغرافي' : 'Step 3 • GPS Location'}
 </span>
 <h2 className="text-white text-2xl font-black">
 {lang === 'ar' ? 'تحديد الموقع الجغرافي الفعلي' : 'Secure GPS Tagging'}
 </h2>
 <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
 {lang === 'ar' ? 'يلزم التطبيق التقاط إحداثيات GPS الحقيقية لتثبيت مكان الكويست. ملأ اسم الحي مخصص للعرض على الكويست فقط.' : 'Real GPS coordinates capture is strictly required. Neighborhood name is for display only.'}
 </p>
 </div>

 <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 text-center space-y-5">
 <div className="flex justify-center">
 <div className={`w-16 h-16 rounded-full flex items-center justify-center ${gpsCoords ? 'bg-sky-500/10 border-2 border-sky-500' : 'bg-[#FF3B7C]/10 border-2 border-dashed border-[#FF3B7C]'} relative`}>
 <MapPin className={`w-8 h-8 ${gpsCoords ? 'text-sky-400' : 'text-[#FF3B7C] animate-bounce'}`} />
 {gpsLoading && (
 <span className="absolute inset-0 rounded-full border-4 border-t-transparent border-[#FF3B7C] animate-spin"></span>
 )}
 </div>
 </div>

 {gpsCoords ? (
 <div className="space-y-2">
 <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
 <Check className="w-3.5 h-3.5" />
 <span>{lang === 'ar' ? 'تم التقاط إحداثيات الـ GPS بنجاح' : 'GPS Coordinates Tagged'}</span>
 </div>
 {gpsAccuracyInfo && (
 <p className="text-[11px] font-bold text-sky-400/90 bg-sky-500/10 px-2.5 py-1 rounded-md inline-block">
 {gpsAccuracyInfo}
 </p>
 )}
 </div>
 ) : (
 <div className="space-y-1">
 <p className="text-xs text-rose-400 font-bold bg-rose-500/10 py-1.5 px-3 rounded-xl border border-rose-500/20 inline-block">
 {lang === 'ar' ? 'رصد موقع الـ GPS إجباري لمتابعة نشر الكويست. اضغط الزر بالأسفل' : 'Live GPS fix strictly required to proceed'}
 </p>
 {gpsAccuracyInfo && (
 <p className="text-[11px] text-amber-400 font-bold animate-pulse mt-1">
 {gpsAccuracyInfo}
 </p>
 )}
 </div>
 )}

 <button
 id="gps-trigger-button"
 type="button"
 onClick={handleAutoGPS}
 disabled={gpsLoading}
 className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FF3B7C] to-[#E0245E] hover:opacity-95 text-white font-extrabold text-xs shadow-lg shadow-[#FF3B7C]/15 cursor-pointer flex items-center justify-center gap-2 select-none disabled:opacity-50"
 >
 {gpsLoading ? (
 <>
 <Loader2 className="w-4.5 h-4.5 animate-spin" />
 <span>{lang === 'ar' ? 'جاري الاتصال بالأقمار الاصطناعية...' : 'Scanning GPS Sensors...'}</span>
 </>
 ) : (
 <>
 <Compass className="w-4.5 h-4.5" />
 <span>{lang === 'ar' ? 'تحديد تلقائي عبر مستشعر الـ GPS' : 'Auto-Tag GPS Position'}</span>
 </>
 )}
 </button>

 <div className="pt-3 border-t border-white/10 space-y-2 text-start">
 <label className="text-xs text-gray-200 font-extrabold flex items-center gap-1.5">
 <MapPin className="w-4 h-4 text-amber-400" />
 <span>{lang === 'ar' ? 'عنوان المكان / الحي والمدينة:' : 'Exact Location Name:'}</span>
 </label>
 <input
 type="text"
 value={locationText}
 onChange={(e) => setLocationText(e.target.value)}
 placeholder={lang === 'ar' ? 'مثال: بن سرور، حي العتي' : 'e.g., Ben Srour, Hay El Ati'}
 className="w-full px-4 py-3 bg-slate-800/90 border border-white/10 rounded-2xl text-white text-xs font-bold focus:outline-none focus:border-[#FF3B7C] transition-colors placeholder:text-gray-500"
 />
 <p className="text-[11px] text-gray-400 leading-relaxed">
 {lang === 'ar'
 ? 'اسم الحي والمدينة يُعرض فقط على بطاقة الكويست لتسهيل القراءة، ولا يعتبر بديلاً عن التقاط إحداثيات الـ GPS.'
 : 'Entering neighborhood name is solely for display on the quest card, not a substitute for GPS capture.'}
 </p>
 </div>
 </div>
 </motion.div>
 )}

 {/* Step 4: CATEGORIES SELECT */}
 {step === 4 && (
 <motion.div
 key="step-category"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-4 w-full"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-purple-400 uppercase tracking-wider font-extrabold bg-purple-400/10 px-3 py-1 rounded-full border border-purple-400/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة الرابعة • تصنيف الخدمة' : 'Step 4 • Category'}
 </span>
 <h2 className="text-white text-2xl font-black">
 {lang === 'ar' ? 'ما هي فئة المهمة؟' : 'Choose Quest Category'}
 </h2>
 <p className="text-xs text-gray-400 max-w-md mx-auto">
 {lang === 'ar' ? 'سيساعد هذا في عرض المهمة للمهتمين والمختصين في هذا المجال.' : 'Categorizing ensures proper push alerts reach matched professionals.'}
 </p>
 </div>

 <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto p-1">
 {CATEGORIES_DATA.map((cat) => {
 const CatIcon = cat.icon;
 const isSelected = category === cat.id;

 return (
 <button
 key={cat.id}
 type="button"
 onClick={() => {
 playSound();
 setCategory(cat.id);
 }}
 className={`p-4 rounded-2xl border text-start transition-all cursor-pointer select-none group relative overflow-hidden ${
 isSelected
 ? 'bg-gradient-to-tr from-purple-900/20 to-indigo-900/20 border-purple-500 ring-2 ring-purple-500/20'
 : 'bg-slate-900/40 border-white/5 hover:border-white/10'
 }`}
 >
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
 isSelected ? 'bg-purple-500 text-white shadow-md' : 'bg-slate-800 text-gray-400 group-hover:text-white'
 }`}>
 <CatIcon className="w-5 h-5" />
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="text-xs font-black text-white truncate">
 {lang === 'ar' ? cat.labelAr : lang === 'fr' ? cat.labelFr : cat.labelEn}
 </h4>
 <p className="text-[9px] text-gray-400 font-bold truncate mt-0.5">
 {lang === 'ar' ? cat.descAr : lang === 'fr' ? cat.descFr : cat.descEn}
 </p>
 </div>
 </div>

 {isSelected && (
 <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500"></span>
 )}
 </button>
 );
 })}
 </div>
 </motion.div>
 )}

 {/* Step 5: URGENCY TIER */}
 {step === 5 && (
 <motion.div
 key="step-urgency"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-4"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-rose-400 uppercase tracking-wider font-extrabold bg-rose-400/10 px-3 py-1 rounded-full border border-rose-400/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة الخامسة • درجة الاستعجال' : 'Step 5 • Urgency'}
 </span>
 <h2 className="text-white text-2xl font-black">
 {lang === 'ar' ? 'ما مدى استعجال تنفيذ هذه المهمة؟' : 'Select Urgency Tier'}
 </h2>
 <p className="text-xs text-gray-400 max-w-md mx-auto">
 {lang === 'ar' ? 'المهام العاجلة والمميزة تنشر بإشعارات دفع فورية لجميع المحترفين.' : 'Urgent & Featured tiers boost alerts to on-ground operators instantly.'}
 </p>
 </div>

 <div className="space-y-3">
 {/* Normal */}
 <button
 type="button"
 onClick={() => { playSound(); setUrgency('normal'); }}
 className={`w-full p-4 rounded-2xl border text-start transition-all cursor-pointer select-none flex items-center justify-between ${
 urgency === 'normal'
 ? 'bg-slate-800/60 border-gray-400 ring-2 ring-gray-400/10'
 : 'bg-slate-900/40 border-white/5 hover:border-white/10'
 }`}
 >
 <div>
 <h4 className="text-xs font-black text-white">{lang === 'ar' ? 'عادي (Normal)' : 'Normal Tier'}</h4>
 <p className="text-[10px] text-gray-400 font-medium mt-0.5">{lang === 'ar' ? 'تنشر في قائمة الاستكشاف المعتادة بالترتيب العادي.' : 'Standard directory ranking, notification to near users.'}</p>
 </div>
 <span className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0">
 {urgency === 'normal' && <span className="w-2.5 h-2.5 rounded-full bg-white"></span>}
 </span>
 </button>

 {/* Urgent */}
 <button
 type="button"
 onClick={() => { playSound(); setUrgency('urgent'); }}
 className={`w-full p-4 rounded-2xl border text-start transition-all cursor-pointer select-none flex items-center justify-between ${
 urgency === 'urgent'
 ? 'bg-red-950/20 border-red-500 ring-2 ring-red-500/10'
 : 'bg-slate-900/40 border-white/5 hover:border-white/10'
 }`}
 >
 <div>
 <h4 className="text-xs font-black text-red-400">{lang === 'ar' ? 'عاجل جداً' : 'Urgent'}</h4>
 <p className="text-[10px] text-gray-400 font-medium mt-0.5">{lang === 'ar' ? 'تلوين مميز وتنبيه فوري لجميع العمال المتاحين.' : 'High priority push alert to area workers.'}</p>
 </div>
 <span className="w-5 h-5 rounded-full border border-red-500/20 flex items-center justify-center shrink-0">
 {urgency === 'urgent' && <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>}
 </span>
 </button>

 {/* Featured */}
 <button
 type="button"
 onClick={() => { playSound(); setUrgency('featured'); }}
 className={`w-full p-4 rounded-2xl border text-start transition-all cursor-pointer select-none flex items-center justify-between ${
 urgency === 'featured'
 ? 'bg-amber-950/20 border-amber-500 ring-2 ring-amber-500/10'
 : 'bg-slate-900/40 border-white/5 hover:border-white/10'
 }`}
 >
 <div>
 <h4 className="text-xs font-black text-amber-400">{lang === 'ar' ? 'مميز وذهبي' : 'Featured'}</h4>
 <p className="text-[10px] text-gray-400 font-medium mt-0.5">{lang === 'ar' ? 'تثبت في مقدمة البحث بتمييز برونزي لضمان الحصول على عمال ممتازين.' : 'Pinned at the top of the map and directory for premium visibility.'}</p>
 </div>
 <span className="w-5 h-5 rounded-full border border-amber-500/20 flex items-center justify-center shrink-0">
 {urgency === 'featured' && <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>}
 </span>
 </button>
 </div>
 </motion.div>
 )}

 {/* Step 6: CASH BUDGET / SALARY */}
 {step === 6 && (
 <motion.div
 key="step-cash"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-4"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-sky-400 uppercase tracking-wider font-extrabold bg-sky-400/10 px-3 py-1 rounded-full border border-sky-400/20 -translate-y-4 inline-block shadow-sm">
 {questType === 'long_term'
 ? (lang === 'ar' ? 'الخطوة السادسة • تفاصيل الراتب وشروط العمل' : 'Step 6 • Salary & Job Terms')
 : (lang === 'ar' ? 'الخطوة السادسة • المكافأة النقدية' : 'Step 6 • Payout Cash')}
 </span>
 <h2 className="text-white text-2xl font-black">
 {questType === 'long_term'
 ? (lang === 'ar' ? 'حدد راتب الوظيفة ونوع الدوام' : 'Set Job Salary & Employment Type')
 : (lang === 'ar' ? 'حدد مكافأة المساعد بالدينار' : 'Proposed Payout reward')}
 </h2>
 <p className="text-xs text-gray-400 max-w-md mx-auto">
 {questType === 'long_term'
 ? (lang === 'ar' ? 'حدد قيمة الراتب المتفق عليه وتواتره ونظام العمل.' : 'Specify salary amount, period, and working schedule.')
 : (lang === 'ar' ? 'الحد الأدنى للمهمة هو ٥٠٠ د.ج. يتم احتساب عمولة ٥٪ للمنصة (الحد الأدنى ٣٥ د.ج، الحد الأقصى ٢٠٠٠ د.ج).' : 'Minimum is 500 DZD. Platform automatically secures 5% fee (Min 35 DZD, Max 2000 DZD).')}
 </p>
 </div>

 <div className="space-y-4 text-start">
 <div>
 <label className="text-xs text-gray-300 font-bold block mb-1">
 {questType === 'long_term' ? (lang === 'ar' ? 'قيمة الراتب (بالدينار):' : 'Salary Amount (DZD):') : (lang === 'ar' ? 'قيمة المكافأة (بالدينار):' : 'Reward (DZD):')}
 </label>
 <div className="relative">
 <input
 id="quest-input-cash"
 type="number"
 min="500"
 required
 value={cashReward === 0 ? '' : cashReward}
 onChange={(e) => {
 const val = e.target.value;
 setCashReward(val === '' ? 0 : Math.max(0, Number(val)));
 }}
 className="w-full px-6 py-4 bg-slate-900/60 text-sky-400 border border-white/10 rounded-2xl text-2xl font-black font-mono focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 text-center tracking-wider"
 />
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-[12px] uppercase select-none">
 DZD
 </span>
 </div>
 </div>

 {/* Long term Job additional selectors */}
 {questType === 'long_term' ? (
 <div className="space-y-3 pt-2">
 {/* Salary Period */}
 <div>
 <label className="text-xs text-gray-300 font-bold block mb-1">
 {lang === 'ar' ? 'تواتر الراتب:' : 'Salary Period:'}
 </label>
 <div className="grid grid-cols-4 gap-2">
 {[
 { id: 'monthly', ar: 'شهري', en: 'Monthly' },
 { id: 'weekly', ar: 'أسبوعي', en: 'Weekly' },
 { id: 'daily', ar: 'يومي', en: 'Daily' },
 { id: 'hourly', ar: 'بالساعة', en: 'Hourly' }
 ].map(p => (
 <button
 key={p.id}
 type="button"
 onClick={() => { playSound(); setSalaryPeriod(p.id as any); }}
 className={`py-2 px-1 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
 salaryPeriod === p.id
 ? 'bg-sky-500/20 border-sky-500 text-sky-500 font-black'
 : 'bg-slate-900/40 border-white/5 text-gray-400'
 }`}
 >
 {lang === 'ar' ? p.ar : p.en}
 </button>
 ))}
 </div>
 </div>

 {/* Employment Type */}
 <div>
 <label className="text-xs text-gray-300 font-bold block mb-1">
 {lang === 'ar' ? 'نوع الدوام:' : 'Employment Type:'}
 </label>
 <div className="grid grid-cols-2 gap-2">
 {[
 { id: 'full_time', ar: 'دوام كامل', en: 'Full-time' },
 { id: 'part_time', ar: 'دوام جزئي', en: 'Part-time' }
 ].map(t => (
 <button
 key={t.id}
 type="button"
 onClick={() => { playSound(); setEmploymentType(t.id as any); }}
 className={`py-2.5 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
 employmentType === t.id
 ? 'bg-sky-500/20 border-sky-500 text-sky-500 font-black'
 : 'bg-slate-900/40 border-white/5 text-gray-400'
 }`}
 >
 {lang === 'ar' ? t.ar : t.en}
 </button>
 ))}
 </div>
 </div>

 {/* Duration Type */}
 <div>
 <label className="text-xs text-gray-300 font-bold block mb-1">
 {lang === 'ar' ? 'مدة العمل:' : 'Work Duration:'}
 </label>
 <div className="grid grid-cols-2 gap-2">
 {[
 { id: 'continuous', ar: 'عمل مستمر', en: 'Continuous' },
 { id: 'fixed', ar: 'لمدة محددة', en: 'Fixed Term' }
 ].map(d => (
 <button
 key={d.id}
 type="button"
 onClick={() => { playSound(); setDurationType(d.id as any); }}
 className={`py-2.5 px-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
 durationType === d.id
 ? 'bg-sky-500/20 border-sky-500 text-sky-500 font-black'
 : 'bg-slate-900/40 border-white/5 text-gray-400'
 }`}
 >
 {lang === 'ar' ? d.ar : d.en}
 </button>
 ))}
 </div>
 </div>
 </div>
 ) : (
 /* Quick Presets Buttons */
 <div className="grid grid-cols-4 gap-2">
 {[1000, 1500, 2000, 5000].map((val) => (
 <button
 key={val}
 type="button"
 onClick={() => { playSound(); setCashReward(val); }}
 className={`py-2.5 rounded-xl border text-xs font-extrabold font-mono transition-all cursor-pointer select-none ${
 cashReward === val
 ? 'bg-sky-500 text-slate-950 border-sky-500 shadow-lg shadow-sky-500/15'
 : 'bg-slate-900/40 border-white/5 hover:bg-slate-800 text-gray-300'
 }`}
 >
 +{val} DA
 </button>
 ))}
 </div>
 )}
 </div>
 </motion.div>
 )}

 {/* Step 7: HELPERS COUNT */}
 {step === 7 && (
 <motion.div
 key="step-workers"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-4"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-sky-400 uppercase tracking-wider font-extrabold bg-sky-400/10 px-3 py-1 rounded-full border border-sky-400/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة السابعة • الطاقم المطلوب' : 'Step 7 • Crew Count'}
 </span>
 <h2 className="text-white text-2xl font-black">
 {lang === 'ar' ? 'كم عدد المساعدين الميدانيين المطلوبين؟' : 'Required Helpers count'}
 </h2>
 <p className="text-xs text-gray-400 max-w-md mx-auto">
 {lang === 'ar' ? 'يمكنك طلب عدة مساعدين لمهمة واحدة (من ١ إلى ٥ أفراد).' : 'Assign multiple slots if the quest demands coordinate group force.'}
 </p>
 </div>

 <div className="flex justify-center items-center gap-6 py-4">
 <button
 type="button"
 disabled={requiredWorkers <= 1}
 onClick={() => { playSound(); setRequiredWorkers(prev => Math.max(1, prev - 1)); }}
 className="w-14 h-14 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer select-none active:scale-90"
 >
 <Minus className="w-6 h-6" />
 </button>

 <div className="text-center">
 <span className="text-5xl font-black text-white font-mono">
 {requiredWorkers}
 </span>
 <span className="block text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mt-1">
 {lang === 'ar' ? 'مساعدين' : 'Helpers'}
 </span>
 </div>

 <button
 type="button"
 disabled={requiredWorkers >= 5}
 onClick={() => { playSound(); setRequiredWorkers(prev => Math.min(5, prev + 1)); }}
 className="w-14 h-14 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer select-none active:scale-90"
 >
 <Plus className="w-6 h-6" />
 </button>
 </div>
 </motion.div>
 )}

 {/* Step 8: PHOTOS & SUMMARY REVIEW */}
 {step === 8 && (
 <motion.div
 key="step-photos-review"
 initial={{ opacity: 0, scale: 0.98, y: 15 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.98, y: -15 }}
 className="space-y-4 text-start"
 >
 <div className="text-center space-y-2">
 <span className="text-xs text-pink-400 uppercase tracking-wider font-extrabold bg-pink-400/10 px-3 py-1 rounded-full border border-pink-400/20 -translate-y-4 inline-block shadow-sm">
 {lang === 'ar' ? 'الخطوة الأخيرة • التأكيد والنشر' : 'Step 8 • Review & Publish'}
 </span>
 <h2 className="text-white text-2xl font-black text-center">
 {lang === 'ar' ? 'إضافة صور وتأكيد' : 'Attach Photos & Confirm'}
 </h2>
 <p className="text-xs text-gray-400 max-w-md mx-auto text-center">
 {lang === 'ar' ? 'أضف حتى ٣ صور لمهمتك.' : 'Add up to 3 photos.'}
 </p>
 </div>

 {/* Drag drop gallery upload area & direct camera capture */}
 <div className="space-y-4">
 <input
 type="file"
 id="global-image-picker"
 ref={fileInputRef}
 multiple
 accept="image/*,image/heic,image/heif,.heic,.heif"
 className="hidden"
 onChange={handleFileChange}
 />
 <input
 type="file"
 id="global-camera-picker"
 ref={cameraInputRef}
 accept="image/*,image/heic,image/heif,.heic,.heif"
 capture="environment"
 className="hidden"
 onChange={handleFileChange}
 />

 {imageUploading ? (
 <div className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-[#4FC3F7] bg-[#4FC3F7]/5 flex flex-col items-center justify-center space-y-2">
 <Loader2 className="w-8 h-8 text-[#4FC3F7] animate-spin" />
 <div className="text-center">
 <span className="text-xs text-[#4FC3F7] font-black block">
 {lang === 'ar' ? 'جاري رفع الصور الآن...' : 'Uploading Images...'}
 </span>
 <span className="text-xs text-gray-400 font-bold block mt-1">{uploadProgress}%</span>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {/* Direct Live Camera Capture */}
 <label
 htmlFor="global-camera-picker"
 className="py-5 px-4 rounded-2xl border-2 border-dashed border-[#4FC3F7] bg-[#4FC3F7]/10 hover:bg-[#4FC3F7]/20 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] text-center group shadow-md cursor-pointer select-none"
 >
 <div className="w-12 h-12 rounded-full bg-[#4FC3F7]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Camera className="w-6 h-6 text-[#4FC3F7]" />
 </div>
 <div className="space-y-0.5">
 <span className="text-xs text-white font-black block">
 {lang === 'ar' ? 'التقاط صورة بالكاميرا' : 'Take Photo with Camera'}
 </span>
 <span className="text-[10px] text-gray-400 block">
 {lang === 'ar' ? 'انقر لفتح الكاميرا والتقاط صورة للعمل' : 'Open live device camera directly'}
 </span>
 </div>
 </label>

 {/* Gallery Choice */}
 <label
 htmlFor="global-image-picker"
 className="py-5 px-4 rounded-2xl border-2 border-dashed border-pink-400/40 bg-pink-500/10 hover:bg-pink-500/20 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98] text-center group shadow-md cursor-pointer select-none"
 >
 <div className="w-12 h-12 rounded-full bg-pink-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
 <ImageIcon className="w-6 h-6 text-pink-400" />
 </div>
 <div className="space-y-0.5">
 <span className="text-xs text-white font-black block">
 {lang === 'ar' ? 'اختيار صور من معرض الهاتف' : 'Choose from Gallery'}
 </span>
 <span className="text-[10px] text-gray-400 block">
 {lang === 'ar' ? 'تصفح ملفات الصور المخزنة لديك' : 'Browse saved photos on device'}
 </span>
 </div>
 </label>
 </div>
 )}

 {/* List of uploaded images displayed below in a beautiful grid */}
 {images.length > 0 && (
 <div className="space-y-1.5">
 <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
 {lang === 'ar' ? 'الصور المرفوعة:' : 'Uploaded Photos:'} ({images.length}/3)
 </span>
 <div className="grid grid-cols-3 gap-3">
 {images.map((url, idx) => (
 <div key={idx} className="h-20 rounded-xl overflow-hidden border border-white/10 relative group bg-slate-900/60 shadow-inner">
 <img src={url} alt={`Upload preview ${idx}`} className="w-full h-full object-cover" />
 <button
 type="button"
 onClick={() => setImages(images.filter((_, i) => i !== idx))}
 className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs font-black flex items-center justify-center shadow-lg select-none transition-colors"
 >
 
 </button>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Immersive Receipt-Style Passport Summary Card */}
 <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl relative overflow-hidden text-xs">
 <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-tr from-[#FF3B7C]/10 to-transparent rounded-full pointer-events-none blur-xl"></div>
 <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-[#4FC3F7]/10 to-transparent rounded-full pointer-events-none blur-xl"></div>

 <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest block mb-2">
 {lang === 'ar' ? 'مواصفات العقد الفوري الميداني:' : 'Official Bounty Manifest:'}
 </span>

 <div className="space-y-2 text-gray-300 font-bold">
 <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
 <span className="text-white truncate max-w-[200px]">{title}</span>
 <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'العنوان:' : 'Title:'}</span>
 </div>
 
 <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
 <span className="text-purple-400">
 {lang === 'ar' ? category : category}
 </span>
 <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'التصنيف:' : 'Category:'}</span>
 </div>

 <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
 <span className={`px-2 py-0.5 text-[9px] rounded font-black ${urgency === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : urgency === 'featured' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-gray-300'}`}>
 {urgency === 'urgent' ? (lang === 'ar' ? 'عاجل جداً' : 'Urgent') : urgency === 'featured' ? (lang === 'ar' ? 'مميز' : 'Featured') : (lang === 'ar' ? 'عادي' : 'Normal')}
 </span>
 <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'الأهمية:' : 'Urgency:'}</span>
 </div>

 <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
 <span className="text-sky-400 font-mono font-black">{requiredWorkers} {lang === 'ar' ? 'مساعدين' : 'helpers'}</span>
 <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'المطلوبون:' : 'Helpers:'}</span>
 </div>

 <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
 <span className="text-sky-400 font-mono font-black">{cashReward} DZD</span>
 <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'المكافأة:' : 'Reward Budget:'}</span>
 </div>

 <div className="flex justify-between items-center pt-0.5">
 <span className="text-xs font-bold text-sky-400 truncate max-w-[200px]">
 {locationText.trim() || (gpsCoords ? resolveNeighborhoodFromCoords(gpsCoords.lat, gpsCoords.lng, 'بن سرور', lang) : 'بن سرور')}
 </span>
 <span className="text-gray-400 font-semibold">{lang === 'ar' ? 'الموقع الجغرافي:' : 'GPS Location:'}</span>
 </div>
 </div>
 </div>

 <div className="space-y-2 pt-2">
 <button
 id="global-publish-submit"
 type="submit"
 disabled={!gpsCoords}
 className={`w-full py-4 rounded-2xl font-black text-xs select-none transition-all cursor-pointer shadow-lg tracking-wide ${
 gpsCoords
 ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black shadow-sky-500/15 hover:opacity-95 active:scale-95'
 : 'bg-slate-800 text-gray-500 border border-white/5 cursor-not-allowed'
 }`}
 >
 {gpsCoords
 ? (lang === 'ar' ? 'إصدار العقد ونشره ميدانياً الآن' : 'Authorize & Broadcast Field Contract')
 : (lang === 'ar' ? 'يجب رصد موقع الـ GPS بالخطوة ٣ لنشر الكويست' : 'Missing verified GPS location')}
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Stepper Navigation Actions */}
 <div className="flex justify-between items-center pt-2 border-t border-white/5">
 {step > 1 ? (
 <button
 id={`step-back-${step}`}
 type="button"
 onClick={() => { playSound(); setStep(prev => prev - 1); }}
 className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer select-none active:scale-95 transition-all"
 >
 <ChevronLeft className="w-4 h-4" />
 <span>{lang === 'ar' ? 'السابق' : 'Back'}</span>
 </button>
 ) : (
 <div />
 )}

 {step < 8 ? (
 <button
 id={`step-next-${step}`}
 type="button"
 disabled={
 (step === 1 && !title.trim()) ||
 (step === 2 && !desc.trim()) ||
 (step === 3 && (!gpsCoords || gpsLoading)) ||
 (step === 6 && cashReward < 500)
 }
 onClick={() => {
 if (step === 3 && (!gpsCoords || gpsLoading)) {
 alert(lang === 'ar' 
 ? 'لا يمكن التخطي! يجب الضغط على زر "تحديد تلقائي عبر مستشعر الـ GPS" واستقبال الإحداثيات بنجاح.' 
 : 'Cannot proceed! Click "Auto-Tag GPS Position" and receive coordinates first.');
 return;
 }
 playSound();
 setStep(prev => prev + 1);
 }}
 className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-30 disabled:pointer-events-none hover:opacity-95 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-purple-600/10 flex items-center gap-1.5 select-none active:scale-95"
 >
 <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
 <ChevronRight className="w-4 h-4" />
 </button>
 ) : (
 <div />
 )}
 </div>
 </form>
 </div>
 </div>
 </AnimatePresence>
 );
}
