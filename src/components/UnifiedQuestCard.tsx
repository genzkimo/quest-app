import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Shield, Zap, Award, MessageSquare, Navigation, CheckCircle2, Trash, Edit, Lock, Briefcase, Phone, ShieldAlert, AlertCircle, XCircle } from 'lucide-react';
import { Quest, UserProfile } from '../types';
import { formatArabicDate } from '../utils/dateFormatter';
import { cleanLocationName } from '../utils/locationFormatter';
import { calculateBookingFee } from '../utils/fee';
import { Geolocator } from '../utils/geolocator';

interface UnifiedQuestCardProps {
 quest: Quest;
 userProfile: UserProfile;
 userLoc?: { lat: number; lng: number } | null;
 lang?: 'ar' | 'fr' | 'en';
 isModal?: boolean;
 onClose?: () => void;
 onBookQuest: (questId: string, bookingFee: number) => void;
 onStartNavigation: (quest: Quest) => void;
 onOpenChat: (params: {
 chatId: string;
 questTitle: string;
 recipientName: string;
 recipientAvatar: string;
 }) => void;
 onManageQuest?: (questId: string) => void;
 onViewPublicProfile?: (userId: string) => void;
 onExtendPendingQuest?: (questId: string) => void;
 onExtendActiveContract?: (questId: string) => void;
  onRequestEndWork?: (questId: string, reason?: string) => void;
  onConfirmEndWork?: (questId: string) => void;
  onRejectEndWork?: (questId: string) => void;
 showToast?: (msg: string) => void;
}

export default function UnifiedQuestCard({
 quest,
 userProfile,
 userLoc,
 lang = 'ar',
 isModal = false,
 onClose,
 onBookQuest,
 onStartNavigation,
 onOpenChat,
 onManageQuest,
 onViewPublicProfile,
 onExtendPendingQuest,
 onExtendActiveContract,
  onRequestEndWork,
  onConfirmEndWork,
  onRejectEndWork,
 showToast
}: UnifiedQuestCardProps) {
 const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showEndWorkModal, setShowEndWorkModal] = useState(false);
  const [endWorkReason, setEndWorkReason] = useState("");
 const [isEditingDescription, setIsEditingDescription] = useState(false);
 const [isSubmittingDesc, setIsSubmittingDesc] = useState(false);
 const [tempDescription, setTempDescription] = useState('');

 const [localUserLoc, setLocalUserLoc] = useState<{ lat: number; lng: number } | null>(() => {
 return userLoc || Geolocator.getCachedLocation();
 });

 useEffect(() => {
 if (userLoc) {
 setLocalUserLoc(userLoc);
 Geolocator.saveCachedLocation(userLoc.lat, userLoc.lng);
 } else {
 const cached = Geolocator.getCachedLocation();
 if (cached) {
 setLocalUserLoc(cached);
 } else if (navigator.geolocation) {
 navigator.geolocation.getCurrentPosition(
 (pos) => {
 const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
 setLocalUserLoc(coords);
 Geolocator.saveCachedLocation(coords.lat, coords.lng);
 },
 (err) => console.warn("GPS lookup in UnifiedQuestCard:", err),
 { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
 );
 }
 }
 }, [userLoc]);

 // 1. Calculate user distance in km
 const calculateDistanceKm = (qLat?: number, qLng?: number) => {
 const activeLoc = userLoc || localUserLoc || Geolocator.getCachedLocation();
 if (!activeLoc || typeof activeLoc.lat !== 'number' || typeof activeLoc.lng !== 'number') return -1;

 let targetLat = typeof qLat === 'number' && !isNaN(qLat) ? qLat : quest?.lat;
 let targetLng = typeof qLng === 'number' && !isNaN(qLng) ? qLng : quest?.lng;

 if (targetLat === undefined || isNaN(targetLat)) {
 if ((quest as any)?.gpsCoords?.lat) targetLat = parseFloat((quest as any).gpsCoords.lat);
 else if (quest?.locationCoords?.lat) targetLat = quest.locationCoords.lat;
 else targetLat = 36.7538;
 }

 if (targetLng === undefined || isNaN(targetLng)) {
 if ((quest as any)?.gpsCoords?.lng) targetLng = parseFloat((quest as any).gpsCoords.lng);
 else if (quest?.locationCoords?.lng) targetLng = quest.locationCoords.lng;
 else targetLng = 3.0588;
 }

 const R = 6371; // Earth radius in km
 const dLat = ((targetLat - activeLoc.lat) * Math.PI) / 180;
 const dLng = ((targetLng - activeLoc.lng) * Math.PI) / 180;
 const a =
 Math.sin(dLat / 2) * Math.sin(dLat / 2) +
 Math.cos((activeLoc.lat * Math.PI) / 180) *
 Math.cos((targetLat * Math.PI) / 180) *
 Math.sin(dLng / 2) *
 Math.sin(dLng / 2);
 const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
 const dist = R * c;
 return parseFloat(dist.toFixed(1));
 };

 const distance = calculateDistanceKm(quest.lat, quest.lng);
 const tokenAmount = calculateBookingFee(quest.cashReward, quest.questType);

 // Dynamic banner equipment items based on category
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

 // 2. State Machine Logic for Action Tray
 // Determine user state milestone
 const isCreator = quest.creatorId === userProfile.id;
  const hasHiredWorker = !!(quest.employeeId || quest.helperId || quest.assignedRunnerId || (quest.assignedRunnerIds && quest.assignedRunnerIds.length > 0));
 const isPendingApplicant = quest.applicants?.some(a => a.userId === userProfile.id) ||
 quest.jobApplicants?.some(a => a.applicantId === userProfile.id);
 const isApprovedAndActive = (quest.helperId === userProfile.id || quest.assignedRunnerId === userProfile.id || quest.assignedRunnerIds?.includes(userProfile.id) || quest.employeeId === userProfile.id) && quest.status !== 'completed' && quest.status !== 'terminated' && quest.status !== 'expired' && quest.status !== 'archived';
 const isCompleted = quest.status === 'completed';

 const handleApplyJob = async () => {
    if (onBookQuest) {
      onBookQuest(quest.id, tokenAmount || 0);
      return;
    }
 try {
 const { doc, updateDoc, setDoc } = await import('firebase/firestore');
 const { db: fDb } = await import('../utils/firebase');
 
 const newJobApp = {
 id: `app_${Date.now()}_${userProfile.id}`,
 jobId: quest.id,
 applicantId: userProfile.id,
 applicantName: userProfile.name,
 applicantAvatar: userProfile.avatar,
 applicantPhone: userProfile.phone || '',
 appliedAt: new Date().toISOString(),
 status: 'pending' as const
 };

 const newApplicant = {
 userId: userProfile.id,
 name: userProfile.name,
 avatar: userProfile.avatar,
 rating: userProfile.rating || 5.0,
 questsCompleted: userProfile.questsCompleted || 0,
 phone: userProfile.phone || ''
 };

 const updatedJobApplicants = [...(quest.jobApplicants || []), newJobApp];
 const updatedApplicants = [...(quest.applicants || []), newApplicant];

 await updateDoc(doc(fDb, 'quests', quest.id), {
 jobApplicants: updatedJobApplicants,
 applicants: updatedApplicants,
 status: quest.status === 'open' ? 'applications' : quest.status
 });

 try {
 await setDoc(doc(fDb, 'job_applications', newJobApp.id), newJobApp);
 } catch (err) {
 console.warn('Could not save to job_applications subcollection:', err);
 }

 if (showToast) {
 showToast(lang === 'ar' ? 'تم تقديم طلبك للوظيفة بنجاح!' : 'Job application submitted successfully!');
 }
 } catch (err) {
 console.error('Error applying for long-term job:', err);
 if (showToast) {
 showToast(lang === 'ar' ? 'حدث خطأ أثناء تقديم الطلب' : 'Error submitting application');
 }
 }
 };

 let currentTrayState: 'A' | 'B' | 'C' | 'D' | 'E' | 'BUSY' = 'B';

 if (isCompleted) {
 currentTrayState = 'E';
 } else if (isApprovedAndActive) {
 currentTrayState = 'D';
 } else if (isPendingApplicant) {
 currentTrayState = 'C';
 } else if (userProfile.isAvailable === false && !isCreator) {
 currentTrayState = 'BUSY';
 } else if (distance !== -1 && distance > 50) {
 currentTrayState = 'A';
 } else {
 currentTrayState = 'B';
 }

 // Gather Images
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
 const proofImgUnified = (quest as any).proofImage || quest.proofImageUrl;
 if (proofImgUnified && typeof proofImgUnified === 'string' && !galleryImages.includes(proofImgUnified)) {
 galleryImages.push(proofImgUnified);
 }

 // Image deletion handler
 const handleDeleteImage = async (imageToDelete: string) => {
 const isRtl = lang === 'ar';
 const confirmMsg = isRtl 
 ? 'هل أنت متأكد من رغبتك في إزالة هذه الصورة من المعرض؟' 
 : 'Are you sure you want to remove this image from the gallery?';
 if (!window.confirm(confirmMsg)) return;

 try {
 // Filter out this image
 const updatedImages = (quest.images || []).filter(img => img !== imageToDelete);
 const updatedImageUrls = (quest.imageUrls || []).filter(img => img !== imageToDelete);
 let updatedImageUrl = quest.imageUrl;
 if (quest.imageUrl === imageToDelete) {
 updatedImageUrl = updatedImages[0] || '';
 }

 // Update in Firestore
 const { doc: fDoc, updateDoc: fUpdateDoc } = await import('firebase/firestore');
 const { db: fDb } = await import('../utils/firebase');
 
 await fUpdateDoc(fDoc(fDb, 'quests', quest.id), {
 images: updatedImages,
 imageUrls: updatedImageUrls,
 imageUrl: updatedImageUrl
 });

 if (showToast) {
 showToast(isRtl ? 'تم حذف الصورة من المعرض بنجاح!' : 'Image deleted from gallery successfully!');
 }
 } catch (error) {
 console.error('Error deleting image:', error);
 if (showToast) {
 showToast(isRtl ? 'فشل حذف الصورة' : 'Failed to delete image');
 }
 }
 };

 const renderDeleteOverlay = (imgUrl: string) => {
 if (!isCreator) return null;
 return (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteImage(imgUrl);
 }}
 className="absolute top-2.5 right-2.5 bg-red-600 hover:bg-red-750 text-white rounded-full p-2 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-115 active:scale-90 z-20 cursor-pointer border-none"
 title={lang === 'ar' ? 'حذف هذه الصورة' : 'Delete this image'}
 >
 <Trash className="w-3.5 h-3.5" />
 </button>
 );
 };

 const cardContent = (
 <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col font-sans text-start border border-slate-100">
 
 {/* Upper Header Layout */}
 <div className="p-6 pb-5 relative flex flex-col items-start bg-white border-b border-slate-100 w-full">
 
 {/* Close Button rendering (active for modal layouts) */}
 {onClose && (
 <button
 onClick={onClose}
 className="absolute top-5 ltr:right-5 rtl:left-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full p-2 w-9 h-9 flex items-center justify-center transition-all duration-200 active:scale-90 z-20 cursor-pointer text-base focus:outline-none"
 title={lang === 'ar' ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
 >
 <X className="w-5 h-5 shrink-0" />
 </button>
 )}

 {/* Clean Category Badges Row */}
 <div className="flex flex-wrap gap-1.5 mb-2.5 ltr:pr-12 rtl:pl-12 items-center">
 {quest.questType === 'long_term' ? (
 <span className="bg-sky-600 text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0">
 <Briefcase className="w-3 h-3 text-white shrink-0" />
 <span>{lang === 'ar' ? 'عقد عمل' : 'Job Contract'}</span>
 </span>
 ) : (
 <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 whitespace-nowrap shrink-0">
 <Zap className="w-3 h-3 text-amber-500 shrink-0" />
 <span>{lang === 'ar' ? 'مهمة سريعة' : 'Quick Task'}</span>
 </span>
 )}
 <span className="bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider whitespace-nowrap shrink-0">
 {quest.category}
 </span>
 {quest.urgency === 'urgent' && (
 <span className="bg-[#FF3B7C]/10 text-[#FF3B7C] text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider animate-pulse border border-[#FF3B7C]/20 whitespace-nowrap shrink-0">
 {lang === 'ar' ? 'عاجل' : 'Urgent'}
 </span>
 )}
 {quest.urgency === 'featured' && (
 <span className="bg-[#3B82F6]/10 text-[#3B82F6] text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-[#3B82F6]/20 whitespace-nowrap shrink-0">
 {lang === 'ar' ? 'مميز' : 'Featured'}
 </span>
 )}
 </div>

 {/* Clean, Prominent Title */}
 <h3 className="text-2xl sm:text-3xl font-black text-sky-500 dark:text-sky-400 leading-snug tracking-tight text-start ltr:pr-12 rtl:pl-12 w-full">
 {quest.title}
 </h3>

 {/* Cohesive Subtitle Metadata */}
 <div className="flex items-center gap-2 flex-wrap text-slate-500 text-[11px] mt-2 w-full font-medium">
 <span className="flex items-center gap-1.5 text-slate-700 font-extrabold">
 <img 
 src={quest.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
 alt={quest.creatorName} 
 className="w-4.5 h-4.5 rounded-full object-cover shrink-0 border border-slate-150" 
 referrerPolicy="no-referrer"
 onError={(e) => {
 (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
 }}
 />
 {quest.creatorName}
 </span>
 <span>•</span>
 <span>{formatArabicDate(quest.createdAt, lang)}</span>
 </div>

 {/* High-Impact Quick Stats Grid (Bento bar replacing all overlapping and complex deadline/distance containers) */}
 {(() => {
 const nowMs = new Date().getTime();
 const createdAtMs = new Date(quest.createdAt).getTime();
 const pendingTimeLimit = 8 * 60 * 60 * 1000;
 const pendingTimeRemaining = pendingTimeLimit - (nowMs - createdAtMs);

 const assignedAtMs = quest.assignedAt ? new Date(quest.assignedAt).getTime() : createdAtMs;
 const activeTimeLimit = 24 * 60 * 60 * 1000;
 const activeTimeRemaining = activeTimeLimit - (nowMs - assignedAtMs);

 const formatTimeRemaining = (ms: number) => {
 if (ms <= 0) return lang === 'ar' ? 'منتهي' : 'Expired';
 const totalMinutes = Math.floor(ms / (60 * 1000));
 const hours = Math.floor(totalMinutes / 60);
 const mins = totalMinutes % 60;
 if (hours > 0) {
 return lang === 'ar' ? `${hours} س و ${mins} د` : `${hours}h ${mins}m`;
 }
 return lang === 'ar' ? `${mins} د` : `${mins}m`;
 };

 const isNearExpiry = quest.status === 'open' 
 ? pendingTimeRemaining <= 1 * 60 * 60 * 1000 
 : activeTimeRemaining <= 4 * 60 * 60 * 1000;

 const remainingText = quest.status === 'open'
 ? formatTimeRemaining(pendingTimeRemaining)
 : quest.status === 'active' || quest.status === 'booked'
 ? formatTimeRemaining(activeTimeRemaining)
 : lang === 'ar' ? 'منتهي' : 'Expired';

 if (quest.questType === 'long_term') {
 return (
 <div className="grid grid-cols-3 gap-2 w-full border border-sky-100 py-3 mt-4 bg-sky-50/50 rounded-2xl px-2.5">
 <div className="text-center flex flex-col justify-center items-center">
 <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'ar' ? 'الدوام' : 'Schedule'}</span>
 <span className="text-xs font-black text-slate-800">
 {quest.employmentType === 'full_time' ? (lang === 'ar' ? 'دوام كامل' : 'Full-Time') : (lang === 'ar' ? 'دوام جزئي' : 'Part-Time')}
 </span>
 </div>
 <div className="text-center flex flex-col justify-center items-center border-x border-sky-100">
 <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'ar' ? 'العقد' : 'Contract'}</span>
 <span className="text-xs font-black text-sky-700">
 {quest.durationType === 'fixed' ? (lang === 'ar' ? 'محدد المدة' : 'Fixed-term') : (lang === 'ar' ? 'مستمر' : 'Ongoing')}
 </span>
 </div>
 <div className="text-center flex flex-col justify-center items-center">
 <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'ar' ? 'الراتب' : 'Salary'}</span>
 <span className="text-[11px] font-black text-slate-800">
 {quest.cashReward} د.ج/{quest.salaryPeriod === 'monthly' ? 'شهر' : quest.salaryPeriod === 'weekly' ? 'أسبوع' : quest.salaryPeriod === 'daily' ? 'يوم' : 'سا'}
 </span>
 </div>
 </div>
 );
 }

 return (
 <div className="grid grid-cols-3 gap-2 w-full border border-slate-100 py-3 mt-4 bg-slate-50/50 rounded-2xl px-2.5">
 <div className="text-center flex flex-col justify-center items-center">
 <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'ar' ? 'المسافة' : 'Distance'}</span>
 <span className="text-xs font-black text-slate-800">
 {distance !== -1 ? `${distance} ${lang === 'ar' ? 'كم' : 'km'}` : (lang === 'ar' ? 'غير محدد' : 'N/A')}
 </span>
 </div>
 <div className="text-center flex flex-col justify-center items-center border-x border-slate-100">
 <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'ar' ? 'رسوم الحجز' : 'Booking Fee'}</span>
 <span className="text-xs font-black text-amber-500">{tokenAmount}</span>
 </div>
 <div className="text-center flex flex-col justify-center items-center">
 <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'ar' ? 'الوقت المتبقي' : 'Time Left'}</span>
 <span className={`font-mono text-[11px] font-black ${isNearExpiry ? 'text-[#FF3B7C] animate-pulse' : 'text-slate-800'}`}>
 {remainingText}
 </span>
 </div>
 </div>
 );
 })()}
 </div>

 {/* Middle Content Section Container */}
 <div className="p-6 pt-5 pb-6 space-y-5 flex flex-col items-start w-full">
 
 {/* Description Section Card */}
 <div className="w-full space-y-2 text-start">
 <div className="flex justify-between items-center w-full">
 <span className="text-[10px] font-black uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
 <span>{lang === 'ar' ? 'تفاصيل المهمة' : 'Quest Details'}</span>
 </span>
 {isCreator && (
 <button
 type="button"
 onClick={() => {
 setTempDescription(quest.description);
 setIsEditingDescription(true);
 }}
 className="flex items-center gap-1.5 text-[11px] font-black text-blue-650 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer border-none"
 title={lang === 'ar' ? 'تعديل الوصف' : 'Edit description'}
 >
 <Edit className="w-3 h-3" />
 <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
 </button>
 )}
 </div>

 <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium whitespace-pre-line text-start w-full font-sans">
 {quest.description}
 </div>

 {/* Long Term Job Additional Meta Card */}
 {quest.questType === 'long_term' && (
 <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-3.5 space-y-2.5 w-full text-start text-xs">
 <div className="flex items-center justify-between border-b border-sky-100 pb-2">
 <span className="font-extrabold text-sky-900 flex items-center gap-1.5">
 <span>{lang === 'ar' ? 'شروط فرصة العمل' : 'Job Offer Details'}</span>
 </span>
 <span className="font-black text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full text-[10px]">
 {quest.salaryPeriod === 'monthly' ? (lang === 'ar' ? 'راتب شهري' : 'Monthly Salary') :
 quest.salaryPeriod === 'weekly' ? (lang === 'ar' ? 'راتب أسبوعي' : 'Weekly Salary') :
 quest.salaryPeriod === 'daily' ? (lang === 'ar' ? 'أجر يومي' : 'Daily Rate') :
 (lang === 'ar' ? 'أجر بالساعة' : 'Hourly Rate')}
 </span>
 </div>

 <div className="grid grid-cols-2 gap-2 text-[11px]">
 <div className="bg-white/80 p-2 rounded-xl border border-sky-100/80">
 <span className="text-gray-400 block text-[9.5px] font-bold">{lang === 'ar' ? 'نوع الدوام' : 'Employment'}</span>
 <span className="font-extrabold text-slate-800">
 {quest.employmentType === 'part_time' ? (lang === 'ar' ? 'دوام جزئي' : 'Part-time') : (lang === 'ar' ? 'دوام كامل' : 'Full-time')}
 </span>
 </div>

 <div className="bg-white/80 p-2 rounded-xl border border-sky-100/80">
 <span className="text-gray-400 block text-[9.5px] font-bold">{lang === 'ar' ? 'مدة العمل' : 'Duration'}</span>
 <span className="font-extrabold text-slate-800">
 {quest.durationType === 'fixed' ? (lang === 'ar' ? 'فترة محددة' : 'Fixed Term') : (lang === 'ar' ? 'عمل مستمر' : 'Continuous')}
 </span>
 </div>
 </div>

 {quest.requiredSkills && quest.requiredSkills.length > 0 && (
 <div className="pt-1">
 <span className="text-[10px] font-bold text-sky-800 block mb-1">
 {lang === 'ar' ? 'المهارات والخبرات المطلوبة:' : 'Required Skills & Qualifications:'}
 </span>
 <div className="flex flex-wrap gap-1">
 {quest.requiredSkills.map((skill, sIdx) => (
 <span key={sIdx} className="bg-white text-sky-800 border border-sky-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">
 {skill}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Swipeable / Grid Images Section */}
 {galleryImages.length > 0 && (
 <div className="mt-5 w-full space-y-2">
 <span className="text-[10px] font-black uppercase tracking-wider text-slate-450 block">
 {lang === 'ar' ? 'المرفقات والصور الميدانية' : 'Attachments & Field Photos'}
 </span>
 <div className="w-full">
 {galleryImages.length === 1 && (
 <div 
 className="quest-image-grid grid-1" 
 style={{ 
 display: 'grid', 
 gridTemplateColumns: '1fr', 
 height: '220px', 
 gap: '8px', 
 width: '100%', 
 borderRadius: '12px', 
 overflow: 'hidden', 
 marginBottom: '12px' 
 }}
 >
 <div className="w-full h-full cursor-pointer relative" onClick={() => setLightboxImage(galleryImages[0])}>
 <img
 src={galleryImages[0]}
 alt="Quest detail cover"
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 referrerPolicy="no-referrer"
 />
 {renderDeleteOverlay(galleryImages[0])}
 </div>
 </div>
 )}

 {galleryImages.length === 2 && (
 <div 
 className="quest-image-grid grid-2" 
 style={{ 
 display: 'grid', 
 gridTemplateColumns: '1fr 1fr', 
 height: '180px', 
 gap: '8px', 
 width: '100%', 
 borderRadius: '12px', 
 overflow: 'hidden', 
 marginBottom: '12px' 
 }}
 >
 {galleryImages.map((img, idx) => (
 <div key={idx} className="w-full h-full cursor-pointer relative" onClick={() => setLightboxImage(img)}>
 <img
 src={img}
 alt={`Quest detailed reference ${idx + 1}`}
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 referrerPolicy="no-referrer"
 />
 {renderDeleteOverlay(img)}
 </div>
 ))}
 </div>
 )}

 {galleryImages.length >= 3 && (
 <div 
 className="quest-image-grid grid-3" 
 style={{ 
 display: 'grid', 
 gridTemplateColumns: '2fr 1fr', 
 gridTemplateRows: '1fr 1fr', 
 height: '220px', 
 gap: '8px', 
 width: '100%', 
 borderRadius: '12px', 
 overflow: 'hidden', 
 marginBottom: '12px' 
 }}
 >
 {/* First major image spans 2 rows */}
 <div 
 className="w-full h-full cursor-pointer relative" 
 style={{ gridRow: 'span 2' }}
 onClick={() => setLightboxImage(galleryImages[0])}
 >
 <img
 src={galleryImages[0]}
 alt="Quest principal reference"
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 referrerPolicy="no-referrer"
 />
 {renderDeleteOverlay(galleryImages[0])}
 </div>

 {/* Next thumbnails (up to 2 visible slots on the right) */}
 {galleryImages.slice(1, 3).map((img, idx) => {
 const isLastThumbnail = idx === 1;
 const extraCount = galleryImages.length - 3;
 return (
 <div key={idx} className="w-full h-full cursor-pointer relative" onClick={() => setLightboxImage(img)}>
 <img
 src={img}
 alt={`Quest detailed secondary ${idx + 2}`}
 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
 referrerPolicy="no-referrer"
 />
 {renderDeleteOverlay(img)}
 {isLastThumbnail && extraCount > 0 && (
 <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs select-none">
 +{extraCount}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 )}

 {/* Hired Profile Box if booked/assigned */}
 {(quest.status !== 'open' && quest.status !== 'applications' && (quest.status as string) !== 'pending' || !!quest.assignedRunnerId || !!quest.helperId) && (() => {
 const isOwner = userProfile.id === quest.creatorId;
 const runnerId = quest.helperId || quest.assignedRunnerId || '';
 
 let profileId = '';
 let profileName = '';
 let profileAvatar = '';
 let roleTitle = '';

 if (isOwner) {
 const workerApplicant = quest.applicants?.find(a => a.userId === runnerId);
 profileId = runnerId;
 profileName = workerApplicant?.name || quest.helperName || (lang === 'ar' ? 'العامل المعيَّن' : 'Hired Assistant');
 profileAvatar = workerApplicant?.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120';
 roleTitle = lang === 'ar' ? 'العامل الميداني المتعاقد معه' : 'Contracted Field Agent';
 } else {
 profileId = quest.creatorId;
 profileName = quest.creatorName || (lang === 'ar' ? 'صاحب العمل' : 'Employer');
 profileAvatar = quest.creatorAvatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120';
 roleTitle = lang === 'ar' ? 'صاحب العمل (صاحب الطلب)' : 'Quest Employer';
 }

 const handleClickProfile = () => {
 if (profileId) {
 if (onViewPublicProfile) {
 onViewPublicProfile(profileId);
 } else {
 window.dispatchEvent(new CustomEvent('view-public-profile', {
 detail: { userId: profileId }
 }));
 }
 }
 };

 return (
 <div className="border-t border-slate-100 pt-5 mt-5 text-start w-full">
 <h4 className="text-slate-400 font-bold text-[10px] uppercase mb-2 flex items-center gap-1.5 justify-start">
 <Shield className="w-3.5 h-3.5 text-[#FF3B7C] stroke-[3px]" />
 <span>{lang === 'ar' ? 'تفاصيل الطرف الآخر في العقد' : 'Contract Participant Profile'}</span>
 </h4>
 <div 
 onClick={handleClickProfile}
 className="flex flex-col gap-3 p-3.5 bg-slate-50 border border-slate-100 hover:bg-slate-100/70 rounded-2xl cursor-pointer transition-all active:scale-98 w-full"
 title={lang === 'ar' ? 'انقر لعرض الملف الشخصي العام' : 'Click to view public profile'}
 >
 <div className="flex items-center gap-3 w-full">
 <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-white shrink-0">
 <img 
 src={profileAvatar} 
 alt={profileName} 
 className="w-full h-full object-cover" 
 referrerPolicy="no-referrer"
 />
 </div>
 <div className="text-start min-w-0 flex-1">
 <span className="text-[9px] text-slate-400 font-extrabold block truncate">
 {roleTitle}
 </span>
 <span className="text-xs font-black text-[#1F2A44] hover:underline block truncate">
 {profileName}
 </span>
 </div>
 </div>

 {(!isOwner && !hasHiredWorker) ? (
 <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] font-extrabold text-amber-900 dark:text-amber-200 flex items-center justify-center gap-1.5 text-center w-full mt-2">
 <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
 <span>{lang === 'ar' ? 'زر الاتصال والدردشة غير مفعليْن حالياً، وسيتم تفعيلهما فور قبول صاحب المهمة لطلب الحجز' : 'Call & Chat are locked until the quest creator accepts your booking request'}</span>
 </div>
 ) : (
 <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 w-full">
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 if (onClose) onClose();
 const runnerId = quest.helperId || quest.assignedRunnerId || (quest.assignedRunnerIds ? quest.assignedRunnerIds[0] : userProfile.id);
 const targetPartnerId = isOwner ? runnerId : userProfile.id;
 const computedChatId = `${quest.id}_${quest.creatorId}_${targetPartnerId}`;
 onOpenChat({
 chatId: computedChatId,
 questTitle: quest.title,
 recipientName: profileName,
 recipientAvatar: profileAvatar
 });
 }}
 className="flex-1 bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
 >
 <MessageSquare className="w-3.5 h-3.5 text-white shrink-0" />
 <span>{lang === 'ar' ? 'دردشة' : 'Chat'}</span>
 </button>

 {(() => {
   const phoneNum = isOwner ? (quest.helperPhone || quest.creatorPhone) : quest.creatorPhone;
   return phoneNum ? (
     <a
       href={`tel:${phoneNum}`}
       onClick={(e) => e.stopPropagation()}
       className="flex-1 bg-sky-600 hover:bg-sky-500 text-white py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition-all text-center"
     >
       <Phone className="w-3.5 h-3.5 text-white shrink-0" />
       <span>{lang === 'ar' ? 'اتصال' : 'Call'}</span>
     </a>
   ) : (
     <button
       type="button"
       onClick={(e) => {
         e.stopPropagation();
         alert(lang === 'ar' ? 'رقم الهاتف غير متوفر حالياً' : 'Phone number is not available');
       }}
       className="flex-1 bg-sky-600/20 text-sky-800 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
     >
       <Phone className="w-3.5 h-3.5 text-sky-700 shrink-0" />
       <span>{lang === 'ar' ? 'اتصال' : 'Call'}</span>
     </button>
   );
 })()}
 </div>
 )}
 </div>
 </div>
 );
 })()}

 {/* Location Landmark */}
 <div className="border-t border-slate-100 pt-5 mt-5 text-start w-full">
 <h4 className="text-slate-400 font-bold text-[10px] uppercase mb-2 flex items-center gap-1.5">
 <MapPin className="w-3.5 h-3.5 text-[#FF3B7C]" />
 <span>{lang === 'ar' ? 'موقع المهمة' : 'Quest Location'}</span>
 </h4>
 {(() => {
 const isLocationAuthorized = quest.creatorId === userProfile.id || isApprovedAndActive;
 return (
 <button
 onClick={() => {
 if (isLocationAuthorized) {
 if (onStartNavigation) {
 onStartNavigation(quest);
 }
 } else {
 if (showToast) {
 showToast(
 lang === 'ar' 
 ? 'الموقع مخفي حتى قبول الحجز!' 
 : 'Location is locked until your booking is approved!'
 );
 }
 }
 }}
 className={`w-full flex items-center justify-center gap-2 text-xs font-black p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-98 ${
 isLocationAuthorized
 ? 'bg-[#4FC3F7]/10 border-[#4FC3F7]/30 text-[#0284C7] hover:bg-[#4FC3F7]/20 shadow-xs'
 : 'bg-amber-50/80 border-amber-200/60 text-amber-700 hover:bg-amber-100/80'
 }`}
 title={lang === 'ar' ? 'عرض على الخريطة' : 'View on Map'}
 >
 {isLocationAuthorized ? (
 <>
 <Navigation className="w-4 h-4 text-[#0284C7] shrink-0" />
 <span>{lang === 'ar' ? 'عرض على الخريطة' : 'Show Map'}</span>
 </>
 ) : (
 <>
 <Lock className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
 <span>{lang === 'ar' ? 'الموقع مخفي حتى قبول الحجز' : 'Location hidden until booked'}</span>
 </>
 )}
 </button>
 );
 })()}
 </div>
 </div>

 {/* Rewards and Bottom Action Card */}
   {/* Bottom Action Card */}
  <div className="p-5 bg-white dark:bg-[#0A1128] border-t border-slate-100 dark:border-slate-800 rounded-b-3xl">
  <div className="flex flex-col gap-3">

 {/* Tray Action Container */}
 <div className="space-y-2.5 w-full">
 
 {/* If Creator, show direct active management button to follow up applicants */}
 {isCreator && !isCompleted && (
 <div className="w-full space-y-2">
 <button
 onClick={() => {
 if (onManageQuest) {
 onManageQuest(quest.id);
 } else {
 const event = new CustomEvent('manage-quest', { detail: { questId: quest.id } });
 window.dispatchEvent(event);
 }
 }}
 className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white px-4 py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-[#FF3B7C]/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center leading-relaxed whitespace-normal break-words"
 >
 <span className="block w-full text-center leading-relaxed whitespace-normal break-words">
 {lang === 'ar'
 ? 'إدارة هذا المنشور ومتابعة المتقدمين'
 : lang === 'fr'
 ? 'Gérer cette annonce & suivre les candidats'
 : 'Manage this post & follow up on applicants'}
 </span>
 </button>

 {/* Rule 1: Extension Button for Creator (Pending Quest hit 7th hour) */}
 {(quest.status === 'open' || quest.status === 'applications') && (() => {
 const nowMs = new Date().getTime();
 const createdAtMs = new Date(quest.createdAt).getTime();
 const pendingTimeLimit = 8 * 60 * 60 * 1000;
 const pendingTimeRemaining = pendingTimeLimit - (nowMs - createdAtMs);
 if (pendingTimeRemaining <= 1 * 60 * 60 * 1000) {
 return (
 <button
 onClick={() => {
 if (onExtendPendingQuest) onExtendPendingQuest(quest.id);
 }}
 className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center leading-relaxed whitespace-normal break-words border border-amber-600"
 >
 <span className="block w-full text-center leading-relaxed whitespace-normal break-words">
 {lang === 'ar' 
 ? 'تمديد صلاحية النشر (8 ساعات إضافية)' 
 : 'Extend Post Validity (8 Additional Hours)'}
 </span>
 </button>
 );
 }
 return null;
 })()}

 {/* Rule 2: Mutual Extension Requests for Creator when active card hits 20th hour (4 hours remain) */}
 {(quest.status === 'active' || quest.status === 'booked') && (() => {
 const nowMs = new Date().getTime();
 const assignedAtMs = quest.assignedAt ? new Date(quest.assignedAt).getTime() : new Date(quest.createdAt).getTime();
 const activeTimeLimit = 24 * 60 * 60 * 1000;
 const activeTimeRemaining = activeTimeLimit - (nowMs - assignedAtMs);

 if (activeTimeRemaining <= 4 * 60 * 60 * 1000) {
 const hasRequested = quest.extensionRequestedBy;
 const isMyRequest = hasRequested === userProfile.id;
 const isPendingApprovalFromMe = hasRequested && hasRequested !== userProfile.id;

 if (isMyRequest) {
 return (
 <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 px-4 py-3 rounded-2xl font-black text-xs text-center leading-relaxed whitespace-normal break-words">
 {lang === 'ar' ? 'في انتظار موافقة الطرف الآخر على التمديد...' : 'Awaiting secondary party approval...'}
 </div>
 );
 } else if (isPendingApprovalFromMe) {
 return (
 <button
 onClick={() => {
 if (onExtendActiveContract) onExtendActiveContract(quest.id);
 }}
 className="w-full bg-sky-500 hover:bg-sky-400 text-white px-4 py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center leading-relaxed whitespace-normal break-words border border-sky-600"
 >
 <span className="block w-full text-center leading-relaxed whitespace-normal break-words">
 {lang === 'ar' 
 ? 'موافقة على طلب تمديد عقد العمل (24 ساعة إضافية)' 
 : 'Approve Contract Extension (24h Extra)'}
 </span>
 </button>
 );
 } else {
 return (
 <button
 onClick={() => {
 if (onExtendActiveContract) onExtendActiveContract(quest.id);
 }}
 className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center leading-relaxed whitespace-normal break-words border border-blue-700"
 >
 <span className="block w-full text-center leading-relaxed whitespace-normal break-words">
 {lang === 'ar'
 ? 'طلب تمديد عقد العمل (24 ساعة إضافية)'
 : 'Request Contract Extension (24h Extra)'}
 </span>
 </button>
 );
 }
 }
 return null;
 })()}

  {/* Contract Termination Request Actions for Creator */}
  {hasHiredWorker && (quest.questType === 'long_term' || quest.status === 'active_employment' || quest.status === 'active' || quest.status === 'booked' || quest.status === 'ending' || quest.status === 'disputed') && (
    <div className="w-full mt-2">
      {quest.status === 'ending' ? (
        quest.endRequestedBy === userProfile.id ? (
          <div className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3.5 rounded-2xl font-bold text-xs text-center space-y-2">
            <p>{lang === 'ar' ? 'تم فسخ العقد وفك الارتباط. المنشور بانتظار إطلاع العامل عليه لنقله إلى الأرشيف.' : 'Contract severed. Post awaiting employee read receipt before archiving.'}</p>
            <button
              type="button"
              onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl font-black text-xs shadow-xs cursor-pointer transition-all"
            >
              {lang === 'ar' ? 'نقل للأرشيف 📁' : 'Move to Archive 📁'}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-start">
            <div className="text-xs font-black text-rose-800 dark:text-rose-200 text-center space-y-1">
              <p>{lang === 'ar' ? 'وصلك إشعار استقالة وفسخ عقد العمل من العامل' : 'Resignation notice received from employee'}</p>
              <div className="bg-white/80 dark:bg-rose-900/40 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-800/60 text-right">
                <span className="text-[10px] text-rose-600 dark:text-rose-300 font-bold block">{lang === 'ar' ? 'السبب الموضح بالطلب:' : 'Reason provided:'}</span>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{quest.endReason || (lang === 'ar' ? 'لم يذكر سبب إضافي' : 'No specific reason provided')}</p>
              </div>
              <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                {lang === 'ar' ? 'تم فك ارتباط العامل. يرجى تأكيد الاطلاع ونقله للأرشيف.' : 'Worker unlinked. Click below to acknowledge and archive.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-black text-xs shadow-md cursor-pointer text-center transition-all"
            >
              {lang === 'ar' ? 'تأكيد الاطلاع 📁' : 'Acknowledge 📁'}
            </button>
          </div>
        )
      ) : quest.status === 'disputed' ? (
        <div className="w-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl font-bold text-xs text-center">
          {lang === 'ar' ? 'العقد في حالة نزاع حالياً - جاري معالجته من قِبل الإدارة' : 'Contract is in dispute state - Under administrative review'}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowEndWorkModal(true)}
          className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center shadow-xs"
        >
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{lang === 'ar' ? 'فسخ العقد' : 'Sever Contract'}</span>
        </button>
      )}
    </div>
  )}
 </div>
 )}

 {!isCreator && (
 <>
 {/* STATE A: Out of Range */}
 {currentTrayState === 'A' && (
 <button
 disabled
 className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2 cursor-not-allowed opacity-80"
 >
 <MapPin className="w-4.5 h-4.5 text-gray-400" />
 <span className="text-center text-[10px] sm:text-xs">
 {lang === 'ar' ? 'هذه المهمة خارج نطاقك الجغرافي المتاح للحجز' : 'This quest is outside your available geographical booking limit'}
 </span>
 </button>
 )}

 {/* STATE B: Local Booking / Application Available */}
 {currentTrayState === 'B' && (
 quest.questType === 'long_term' ? (
 <div className="space-y-2.5 w-full text-start">
 <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 rounded-2xl leading-relaxed text-start">
 {lang === 'ar'
 ? 'لا توجد رسوم حجز لتقديم طلبات العمل. سيتم إشعارك فور مراجعة ملفك من صاحب العمل.'
 : 'No booking fees for job applications. You will be notified upon review.'}
 </p>
 <button
 onClick={handleApplyJob}
 className="w-full bg-sky-600 hover:bg-sky-500 text-white py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-sky-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center"
 >
 <span>{lang === 'ar' ? 'تقديم طلب للوظيفة' : 'Apply for Job'}</span>
 </button>
 </div>
 ) : (
 <div className="space-y-2.5 w-full text-start">
 <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-800/50 p-2.5 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 rounded-2xl leading-relaxed text-start">
 {lang === 'ar'
 ? 'يتضمن هذا العقد رسوم ضمان وحماية بنسبة 10%.'
 : 'This contract includes a 10% guarantee and protection fee.'}
 </p>
 <button
 onClick={() => onBookQuest(quest.id, tokenAmount)}
 className="w-full bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-[#FF3B7C]/25 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center"
 >
 <Zap className="w-4.5 h-4.5 text-amber-300" />
 <span>
 {lang === 'ar' ? 'احجز المهمة الآن' : 'Book Quest Now'}
 </span>
 </button>
 </div>
 )
 )}

 {/* STATE C: Pending Selection */}
 {currentTrayState === 'C' && (
 <button
 disabled
 className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2"
 >
 <span className="text-center">
 {lang === 'ar'
 ? 'تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل'
 : 'Application pending.. Awaiting creator selection'}
 </span>
 </button>
 )}

 {/* STATE D: Approved & Active Contract */}
 {currentTrayState === 'D' && (
 <div className="w-full space-y-2">
 

 {/* Rule 2 Mutual Extension Requests for Runner when active card hits 20th hour (4 hours remain) */}
 {(quest.status === 'active' || quest.status === 'booked') && (() => {
 const nowMs = new Date().getTime();
 const assignedAtMs = quest.assignedAt ? new Date(quest.assignedAt).getTime() : new Date(quest.createdAt).getTime();
 const activeTimeLimit = 24 * 60 * 60 * 1000;
 const activeTimeRemaining = activeTimeLimit - (nowMs - assignedAtMs);

 if (activeTimeRemaining <= 4 * 60 * 60 * 1000) {
 const hasRequested = quest.extensionRequestedBy;
 const isMyRequest = hasRequested === userProfile.id;
 const isPendingApprovalFromMe = hasRequested && hasRequested !== userProfile.id;

 if (isMyRequest) {
 return (
 <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 py-3.5 rounded-2xl font-black text-xs text-center border-dashed">
 {lang === 'ar' ? 'في انتظار موافقة الطرف الآخر على التمديد...' : 'Awaiting secondary party approval...'}
 </div>
 );
 } else if (isPendingApprovalFromMe) {
 return (
 <button
 onClick={() => {
 if (onExtendActiveContract) onExtendActiveContract(quest.id);
 }}
 className="w-full bg-sky-500 hover:bg-sky-400 text-white py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center border border-sky-600"
 >
 <span>
 {lang === 'ar' 
 ? 'موافقة على طلب تمديد عقد العمل (24 ساعة إضافية)' 
 : 'Approve Contract Extension (24h Extra)'}
 </span>
 </button>
 );
 } else {
 return (
 <button
 onClick={() => {
 if (onExtendActiveContract) onExtendActiveContract(quest.id);
 }}
 className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center border border-blue-700"
 >
 <span>
 {lang === 'ar'
 ? 'طلب تمديد عقد العمل (24 ساعة إضافية)'
 : 'Request Contract Extension (24h Extra)'}
 </span>
 </button>
 );
 }
 }
 return null;
 })()}

  {/* Contract Termination Request Actions for Worker */}
  {(quest.questType === 'long_term' || quest.status === 'active_employment' || quest.status === 'active' || quest.status === 'booked' || quest.status === 'ending' || quest.status === 'disputed' || isApprovedAndActive) && (
    <div className="w-full mt-2">
      {quest.status === 'ending' ? (
        quest.endRequestedBy === userProfile.id ? (
          <div className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3.5 rounded-2xl font-bold text-xs text-center space-y-2">
            <p>{lang === 'ar' ? 'تم تقديم الاستقالة وفك الارتباط. المنشور بانتظار إطلاع صاحب العمل عليه لنقله للأرشيف.' : 'Resignation submitted & unlinked. Post awaiting employer read receipt.'}</p>
            <button
              type="button"
              onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl font-black text-xs shadow-xs cursor-pointer transition-all"
            >
              {lang === 'ar' ? 'نقل للأرشيف 📁' : 'Move to Archive 📁'}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-start">
            <div className="text-xs font-black text-rose-800 dark:text-rose-200 text-center space-y-1">
              <p>{lang === 'ar' ? 'وصلك إشعار إنهاء الخدمة وفسخ العقد من صاحب العمل' : 'Service termination notice received from employer'}</p>
              <div className="bg-white/80 dark:bg-rose-900/40 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-800/60 text-right">
                <span className="text-[10px] text-rose-600 dark:text-rose-300 font-bold block">{lang === 'ar' ? 'السبب الموضح بالطلب:' : 'Reason provided:'}</span>
                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{quest.endReason || (lang === 'ar' ? 'لم يذكر سبب إضافي' : 'No specific reason provided')}</p>
              </div>
              <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                {lang === 'ar' ? 'تم فك ارتباطك بالعقد وحسابك متاح الآن. يرجى تأكيد الاطلاع ونقله للأرشيف.' : 'Unlinked from contract & account is now available. Click below to acknowledge & archive.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onConfirmEndWork && onConfirmEndWork(quest.id)}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-black text-xs shadow-md cursor-pointer text-center transition-all"
            >
              {lang === 'ar' ? 'تأكيد الاطلاع 📁' : 'Acknowledge 📁'}
            </button>
          </div>
        )
      ) : quest.status === 'disputed' ? (
        <div className="w-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-3.5 rounded-2xl font-bold text-xs text-center">
          {lang === 'ar' ? 'العقد في حالة نزاع حالياً - جاري معالجته من قِبل الإدارة' : 'Contract is in dispute state - Under administrative review'}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowEndWorkModal(true)}
          className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center shadow-xs"
        >
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>{lang === 'ar' ? 'فسخ العقد' : 'Sever Contract'}</span>
        </button>
      )}
    </div>
  )}
  </div>
 )}

 {/* STATE E: Completed & Historical Souvenir */}
 {currentTrayState === 'E' && (
 <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1">
 <div className="flex items-center gap-1.5 text-sky-500 font-black text-xs sm:text-sm">
 <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
 <span>{lang === 'ar' ? 'كذكرى في البورتفوليو' : 'Completed Portfolio Milestone'}</span>
 </div>
 <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold max-w-xs mt-1">
 {lang === 'ar'
 ? 'تم إنجاز هذه المهمة بنجاح وتوثيق فخرها وإحصائياتها بمحفظة أعمالك!'
 : 'This task was successfully executed & logged into your local service career profile archives!'}
 </p>
 </div>
 )}

 {/* STATE BUSY: Already assigned and unavailable */}
 {currentTrayState === 'BUSY' && (
 <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1 w-full">
 <div className="flex items-center gap-1.5 text-amber-500 font-black text-xs sm:text-sm">
 <Shield className="w-5 h-5 text-amber-500 shrink-0" />
 <span>{lang === 'ar' ? 'لديك مهمة نشطة حالياً' : 'You have an active quest assignment'}</span>
 </div>
 <p className="text-[10px] text-amber-600/90 font-bold max-w-xs mt-1">
 {lang === 'ar'
 ? 'لا يمكنك الحجز أو التقديم على مهام أخرى حتى تنتهي من إنجاز مهمتك الشاغرة الحالية!'
 : 'You cannot book or apply for other quests until your current pending offline assignment is completed!'}
 </p>
 </div>
 )}

 {/* Bottom cancel or close action */}
 {onClose && (
 <button
 onClick={onClose}
 className="w-full bg-white/5 text-gray-350 hover:bg-white/10 hover:text-white py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center mt-1"
 >
 {lang === 'ar' ? 'الرجوع للخلف' : 'Go Back'}
 </button>
 )}
 </>
 )}
 </div>
 </div>
 </div>

 {/* Lightbox Overlay */}
 {lightboxImage && (
 <div className="fixed inset-0 bg-black/95 z-55 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
 <button className="absolute top-5 right-5 text-white/80 hover:text-white text-3xl font-bold cursor-pointer">&times;</button>
 <img src={lightboxImage} alt="Fullscreen Reference Preview" className="max-w-full max-h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
 </div>
 )}

 {/* Edit Description Dialog */}
 <AnimatePresence>
 {isEditingDescription && (
 <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
 {/* Backdrop click to abandon */}
 <div className="absolute inset-0" onClick={() => {
 if (!isSubmittingDesc) {
 setIsEditingDescription(false);
 setTempDescription('');
 }
 }}></div>

 <motion.div
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 transition={{ type: 'spring', damping: 20 }}
 className="relative bg-white rounded-3xl w-full max-w-md p-6 border border-slate-100 shadow-2xl space-y-4 text-start font-sans z-10"
 style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
 >
 <div className="flex justify-between items-center border-b border-gray-100 pb-3">
 <h4 className="font-extrabold text-sm text-[#1F2A44] flex items-center gap-1.5">
 <Edit className="w-4 h-4 text-[#1F2A44]" />
 <span>{lang === 'ar' ? 'تعديل وصف المنشور' : 'Edit Post Description'}</span>
 </h4>
 <button
 type="button"
 onClick={() => {
 setIsEditingDescription(false);
 setTempDescription('');
 }}
 className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border-none"
 >
 <X className="w-5 h-5 text-gray-400" />
 </button>
 </div>

 <div className="space-y-3 text-start">
 <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
 {lang === 'ar' ? 'الوصف الجديد للمهمة' : 'New Quest Description'}
 </label>
 <textarea
 value={tempDescription}
 onChange={(e) => setTempDescription(e.target.value)}
 rows={6}
 maxLength={2000}
 placeholder={lang === 'ar' ? 'أدخل تفاصيل المهمة الدقيقة هنا...' : 'Describe your quest details...'}
 className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-[#1F2A44] transition-all resize-none text-start"
 />
 <div className="ltr:text-right rtl:text-left text-[10px] text-gray-400 font-bold font-mono">
 {tempDescription.length}/2000
 </div>
 </div>

 <div className="flex gap-2.5 pt-2">
 <button
 type="button"
 disabled={isSubmittingDesc}
 onClick={async () => {
 if (!tempDescription.trim()) {
 if (showToast) {
 showToast(lang === 'ar' ? 'لا يمكن حفظ وصف فارغ' : 'Description cannot be empty');
 }
 return;
 }
 setIsSubmittingDesc(true);
 try {
 const { doc: fDoc, updateDoc: fUpdateDoc } = await import('firebase/firestore');
 const { db: fDb } = await import('../utils/firebase');
 
 await fUpdateDoc(fDoc(fDb, 'quests', quest.id), {
 description: tempDescription.trim()
 });

 if (showToast) {
 showToast(lang === 'ar' ? 'تم تحديث وصف المنشور بنجاح!' : 'Post description updated successfully!');
 }
 setIsEditingDescription(false);
 } catch (err: any) {
 console.error("Description update error:", err);
 if (showToast) {
 showToast(lang === 'ar' ? 'فشل تحديث الوصف' : 'Failed to update description');
 }
 } finally {
 setIsSubmittingDesc(false);
 }
 }}
 className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer text-center disabled:opacity-50"
 >
 {isSubmittingDesc
 ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...')
 : (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}
 </button>
 <button
 type="button"
 disabled={isSubmittingDesc}
 onClick={() => {
 setIsEditingDescription(false);
 setTempDescription('');
 }}
 className="bg-gray-100 hover:bg-gray-200 text-[#1F2A44] font-black text-xs px-4 py-3 rounded-xl transition-all cursor-pointer border-none"
 >
 {lang === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </div>
 );


      {/* End Work / Contract Termination Request Modal */}
      {showEndWorkModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[100005] font-sans">
          <div 
            className="bg-white dark:bg-[#0A1128] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right"
            style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-lg text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>
                  {lang === 'ar' ? 'فسخ العقد' : 'Sever Contract'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEndWorkModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              {isCreator
                ? (lang === 'ar'
                    ? 'سيتم إرسال طلب إنهاء الخدمة للعامل للموافقة عليه وتسوية كافة المستحقات وتعديل حالة العقد.'
                    : 'A service termination request will be sent to the employee for approval and settlement.')
                : (lang === 'ar'
                    ? 'سيتم إرسال طلب الاستقالة وفسخ العقد لصاحب العمل للموافقة عليه وإخلاء الطرف واسترجاع حالة حسابك كمتاح للعمل.'
                    : 'A resignation request will be sent to the employer for approval and clearance.')}
            </p>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                {isCreator
                  ? (lang === 'ar' ? 'سبب إنهاء الخدمة (اختياري):' : 'Reason for service termination (optional):')
                  : (lang === 'ar' ? 'سبب الاستقالة (اختياري):' : 'Reason for resignation (optional):')}
              </label>
              <textarea
                value={endWorkReason}
                onChange={(e) => setEndWorkReason(e.target.value)}
                placeholder={
                  isCreator
                    ? (lang === 'ar' ? 'مثال: انتهاء فترة المشروع، عدم الحاجة للخدمة حالياً...' : 'e.g., Project completed...')
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
                    onRequestEndWork(quest.id, endWorkReason);
                  }
                  setShowEndWorkModal(false);
                  setEndWorkReason('');
                  if (showToast) {
                    showToast(
                      isCreator
                        ? (lang === 'ar' ? 'تم إرسال طلب إنهاء الخدمة بنجاح' : 'Service termination request sent successfully')
                        : (lang === 'ar' ? 'تم إرسال طلب الاستقالة بنجاح' : 'Resignation request sent successfully')
                    );
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-3 rounded-2xl shadow-md transition-all cursor-pointer text-center"
              >
                {lang === 'ar' ? 'تأكيد فسخ العقد' : 'Confirm Severing Contract'}
              </button>
              <button
                type="button"
                onClick={() => setShowEndWorkModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
 // If designated as modal, wrap in overlay backdrop with entry fade + scale spring physics
 if (isModal) {
 return (
 <div className="fixed inset-0 bg-[#0F172A]/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
 {/* Click background backdrop to escape modal */}
 <div className="absolute inset-0" onClick={onClose}></div>
 
 <motion.div
 initial={{ scale: 0.94, opacity: 0, y: 15 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 0.94, opacity: 0, y: 15 }}
 transition={{ type: 'spring', damping: 24, stiffness: 220 }}
 className="relative max-w-lg w-full z-10"
 >
 {cardContent}
 </motion.div>
 </div>
 );
 }

 // Standalone rendering
 return cardContent;
}
