import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  CheckCircle2, 
  X, 
  ShieldAlert, 
  Megaphone, 
  Trash2, 
  Check, 
  UserPlus, 
  TrendingUp, 
  MapPin, 
  ShieldX, 
  ExternalLink,
  Sparkles,
  Search,
  BookOpen,
  Eye,
  ShieldCheck,
  Phone,
  AlertTriangle,
  Mail,
  MessageSquare,
  CreditCard,
  Gift
} from 'lucide-react';
import { UserProfile, Quest, Leader } from '../types';
import { translations } from '../data/translations';
import { collection, onSnapshot, query, updateDoc, doc, deleteDoc, arrayUnion, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

interface AdminViewProps {
  userProfile: UserProfile;
  quests: Quest[];
  leaders: Leader[];
  lang: 'ar' | 'fr' | 'en';
  onApproveKYC: (userId: string) => void;
  onRejectKYC: (userId: string) => void;
  onBanUser: (userId: string, isBanned: boolean) => void;
  onDeleteQuest: (questId: string) => void;
  onBroadcastMessage: (msg: string) => void;
  showToast: (msg: string) => void;
  onInspectQuest?: (questId: string) => void;
}

export default function AdminView({
  userProfile,
  quests,
  leaders,
  lang,
  onApproveKYC,
  onRejectKYC,
  onBanUser,
  onDeleteQuest,
  onBroadcastMessage,
  showToast,
  onInspectQuest
}: AdminViewProps) {
  const [announcement, setAnnouncement] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real-time Firestore users subscription
  const [dbPendingUsers, setDbPendingUsers] = useState<UserProfile[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(true);

  // New admin search/profile controls state
  const [dbAllUsers, setDbAllUsers] = useState<UserProfile[]>([]);
  const [adminSearchCode, setAdminSearchCode] = useState('');
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editRating, setEditRating] = useState(5.0);
  const [editVerification, setEditVerification] = useState<'unverified' | 'pending' | 'verified'>('unverified');
  const [editBanned, setEditBanned] = useState(false);
  const [editBalance, setEditBalance] = useState(0);

  // Modal inspecting national card image
  const [selectedIdImageUrl, setSelectedIdImageUrl] = useState<string | null>(null);

  // Reject workflow states
  const [rejoiningUserId, setRejoiningUserId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  // Support & Ticketing System state
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(true);
  const [activeAdminTab, setActiveAdminTab] = useState<'user_management' | 'support_and_moderation' | 'recharge_audit' | 'matchmaker'>('user_management');
  const [userSubTab, setUserSubTab] = useState<'all' | 'pending_kyc' | 'banned'>('all');
  const [moderationSubTab, setModerationSubTab] = useState<'tickets' | 'scam_shield' | 'broadcast_form'>('tickets');
  const [refillRequests, setRefillRequests] = useState<any[]>([]);
  const [isLoadingRefills, setIsLoadingRefills] = useState(true);
  const [adminReplyTexts, setAdminReplyTexts] = useState<Record<string, string>>({});
  const [isReplyingTicketId, setIsReplyingTicketId] = useState<string | null>(null);

  // Matchmaker state variables
  const [selectedQuestId, setSelectedQuestId] = useState<string>('');
  const [expandedKycUserId, setExpandedKycUserId] = useState<string | null>(null);
  
  // Pending actions state (e.g. for refill confirmations to prevent iframe window.confirm blocks)
  const [refillPendingAction, setRefillPendingAction] = useState<{ id: string; action: 'approve' | 'reject' | 'delete' } | null>(null);

  const handleEmergencyNidExport = async () => {
    try {
      // Validate super-admin role
      if (userProfile.email !== 'hakerzoldyck@gmail.com') {
        showToast(isRtl ? '⚠️ غير مصرح لك! مخصص للمشرفين الخارقين فقط.' : '⚠️ Unauthorized! Restricted to super-admins.');
        return;
      }

      // Grab users with NID profiles loaded
      const usersWithDocs = dbAllUsers.filter(u => u.kycFullName || u.idVerificationStatus === 'verified' || u.idVerificationStatus === 'pending');
      
      if (usersWithDocs.length === 0) {
        showToast(isRtl ? 'ℹ️ لا توجد مستندات هوية حالية لتصديرها!' : 'ℹ️ No NID records available to export.');
        return;
      }

      // Record immutable logging inside admin_audit_logs in firestore
      await runTransaction(db, async (transaction) => {
        const logRef = doc(collection(db, 'admin_audit_logs'));
        transaction.set(logRef, {
          id: logRef.id,
          action: 'EXPLICIT_EMERGENCY_NID_EXPORT',
          actorEmail: userProfile.email,
          actorName: userProfile.name,
          timestamp: new Date().toISOString(),
          recordCount: usersWithDocs.length,
          clientIP: 'RECORDS_SECURED'
        });
      });

      // Stream direct JSON file downloader
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(usersWithDocs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `QUEST_EMERGENCY_NID_EXPORT_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast(isRtl 
        ? '✅ تم بنجاح تصدير الملف وتسجيل الأثر الأمني في قاعدة Firestore بنجاح!' 
        : '✅ Successfully exported NID registries and minted secure audit blocks!');
    } catch (err: any) {
      console.error(err);
      showToast('⚠️ Error exporting NID databases: ' + err.message);
    }
  };

  const dict = translations[lang];
  const isRtl = lang === 'ar';

  const formatImageSrc = (img: string | null | undefined): string | null => {
    if (!img) return null;
    const trimmed = img.trim();
    if (!trimmed || trimmed === 'national_id_card.png') return null;
    if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return `data:image/jpeg;base64,${trimmed}`;
  };

  // Sync searchedUser reactively when dbAllUsers refreshes
  useEffect(() => {
    if (searchedUser) {
      const fresh = dbAllUsers.find(u => u.id === searchedUser.id);
      if (fresh) {
        setSearchedUser(fresh);
      }
    }
  }, [dbAllUsers]);

  useEffect(() => {
    // Listen to real-time updates inside users collection in Firestore
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pending: UserProfile[] = [];
      const all: UserProfile[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as UserProfile;
        
        // Auto-backfill shortId if missing for any user!
        if (!data.shortId) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let genId = 'QST-';
          for (let i = 0; i < 4; i++) {
            genId += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const userDocRef = doc(db, 'users', docSnapshot.id);
          updateDoc(userDocRef, { shortId: genId }).catch(err => {
            console.error("Backfilling shortId failed:", docSnapshot.id, err);
          });
          data.shortId = genId;
        }

        all.push(data);
        // Support both verificationStatus AND idVerificationStatus for complete fallback compatibility
        if (data.idVerificationStatus === 'pending' || (data as any).verificationStatus === 'pending') {
          pending.push(data);
        }
      });
      setDbPendingUsers(pending);
      setDbAllUsers(all);
      setIsLoadingPending(false);
    }, (error) => {
      console.error("Firestore security rules block / read mismatch: ", error);
      setIsLoadingPending(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Real-time listener for support tickets (Inbox)
    const q = query(collection(db, 'support_tickets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets: any[] = [];
      snapshot.forEach((docSnapshot) => {
        tickets.push({ ...docSnapshot.data(), id: docSnapshot.id });
      });
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSupportTickets(tickets);
      setIsLoadingSupport(false);
    }, (error) => {
      console.error("Firestore loading support tickets blocked/rules missing: ", error);
      setIsLoadingSupport(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Real-time listener for manual wallet refill requests
    const q = query(collection(db, 'refill_requests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnapshot) => {
        list.push({ ...docSnapshot.data(), id: docSnapshot.id });
      });
      // Sort newest first
      list.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
      setRefillRequests(list);
      setIsLoadingRefills(false);
    }, (error) => {
      console.error("Firestore loading refill requests blocked: ", error);
      setIsLoadingRefills(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApproveRefill = async (refill: any) => {
    try {
      const response = await fetch('/api/admin/approve-refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refillId: refill.id,
          adminUserId: userProfile.id
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Server error");
      }

      showToast(lang === 'ar' ? '✔ تم قبول الوصل يدوياً وشحن الرصيد المالي بنجاح!' : '✔ Receipt approved manually and wallet credited successfully!');
    } catch (err: any) {
      console.error(err);
      showToast(lang === 'ar' ? '⚠️ فشل تحديث المعاملة يدوياً: ' + err.message : '⚠️ Manual approval failed: ' + err.message);
    }
  };

  const handleRejectRefill = async (refill: any) => {
    try {
      const response = await fetch('/api/admin/reject-refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refillId: refill.id,
          adminUserId: userProfile.id
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Server error");
      }

      showToast(lang === 'ar' ? '❌ تم تعيين حالة الوصل إلى "مرفوض" بنجاح.' : '❌ Receipt status marked as Rejected.');
    } catch (err: any) {
      console.error(err);
      showToast(lang === 'ar' ? '⚠️ فشل تحديث حالة المعاملة: ' + err.message : '⚠️ Failed to update receipt status: ' + err.message);
    }
  };

  const selectUserForInspection = (found: any) => {
    setSearchedUser(found);
    setEditName(found.name || '');
    setEditPhone(found.phone || '');
    setEditCity(found.city || '');
    setEditRating(found.rating || 5.0);
    setEditVerification(found.idVerificationStatus || 'unverified');
    setEditBanned(!!found.isBanned);
    setEditBalance(found.tokenBalance || 0);
  };

  const handleAdminSearch = () => {
    const key = adminSearchCode.trim().toLowerCase();
    if (!key) {
      showToast(isRtl ? 'الرجاء إدخال الاسم، البريد، أو معرّف ID للبحث' : 'Please enter Name, Email, or ID code to search');
      return;
    }
    const found = dbAllUsers.find(
      u => 
        (u.shortId && u.shortId.toLowerCase().includes(key)) ||
        (u.id && u.id.toLowerCase() === key) ||
        (u.email && u.email.toLowerCase().includes(key)) ||
        (u.name && u.name.toLowerCase().includes(key)) ||
        (u.phone && u.phone.includes(key))
    );
    if (found) {
      selectUserForInspection(found);
      showToast(isRtl ? 'تم العثور على المستخدم!' : 'Operator found!');
    } else {
      showToast(isRtl ? 'لم يتم العثور على أي مستخدم بهذا المعيار' : 'No operator found with this search parameter');
    }
  };

  const handleSaveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedUser) return;
    try {
      const userRef = doc(db, 'users', searchedUser.id);
      await updateDoc(userRef, {
        name: editName,
        phone: editPhone,
        city: editCity,
        rating: Number(editRating),
        idVerificationStatus: editVerification,
        isBanned: editBanned,
        tokenBalance: Number(editBalance)
      });
      showToast(isRtl ? 'تم تحديث بيانات المستخدم بنجاح!' : 'User account successfully updated!');
    } catch (err) {
      console.error(err);
      showToast(isRtl ? 'حدث خطأ أثناء حفظ التغييرات' : 'Error updating user profile');
    }
  };

  const adjustBalance = (amount: number) => {
    const newVal = Math.max(0, editBalance + amount);
    setEditBalance(newVal);
  };

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    onBroadcastMessage(announcement.trim());
    setAnnouncement('');
    showToast(lang === 'ar' ? '📣 تم تعميم البلاغ العاجل لكافة مستخدمي Quest!' : '📣 Broadcast broadcasted successfully!');
  };

  const handleApproveUser = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User document does not exist!");
        }

        const userData = userSnap.data();
        const currentBalance = userData.tokenBalance || 0;
        const currentBadges = userData.unlockedBadgeIds || [];
        const isClaimed = userData.kycRewardClaimed === true;

        const updatedBadges = currentBadges.includes('badge-certified-runner')
          ? currentBadges
          : [...currentBadges, 'badge-certified-runner'];

        const rewardAmount = isClaimed ? 0 : 2500;

        transaction.update(userRef, {
          idVerificationStatus: 'verified',
          verificationStatus: 'approved',
          tokenBalance: currentBalance + rewardAmount,
          kycRewardClaimed: true,
          unlockedBadgeIds: updatedBadges,
          rejectionReason: '', // clear previous reasons upon confirmation
          verifiedName: userData.verifiedName || userData.name || '',
          verifiedNid: userData.verifiedNid || ''
        });
      });

      showToast(lang === 'ar' ? '✔ تم تفعيل الشارة الخضراء للأمان بنجاح!' : '✔ KYC identity approved successfully!');
      
      const notifRef = doc(collection(db, 'notifications'));
      setDoc(notifRef, {
        id: notifRef.id,
        userId: userId,
        text: lang === 'ar'
          ? '🎉 تم قبول وتوثيق هويتك بنجاح من قبل إدارة المنصة وترقية حسابك!'
          : '🎉 Your identity verification has been manually approved by administration!',
        questId: '',
        createdAt: new Date().toISOString(),
        read: false,
        type: 'kyc_approved'
      }).catch(console.error);

      onApproveKYC(userId);
    } catch (e) {
      console.error("Error writing approval update directly to Firestore:", e);
      // Fallback safely using prop updating local layout state
      onApproveKYC(userId);
      showToast('State updated locally (Dev Sandbox fallback)');
    }
  };

  const handleConfirmReject = async (userId: string) => {
    if (!rejectionReasonText.trim()) {
      showToast(lang === 'ar' ? 'يرجى كتابة سبب تعليل الرفض' : 'Please type a reason for rejecting.');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        idVerificationStatus: 'rejected',
        verificationStatus: 'rejected',
        rejectionReason: rejectionReasonText.trim()
      });

      const notifRef = doc(collection(db, 'notifications'));
      setDoc(notifRef, {
        id: notifRef.id,
        userId: userId,
        text: lang === 'ar'
          ? `❌ تم رفض توثيق الهوية من قبل الإدارة. السبب: ${rejectionReasonText.trim()}`
          : `❌ Your identity verification was rejected. Reason: ${rejectionReasonText.trim()}`,
        questId: '',
        createdAt: new Date().toISOString(),
        read: false,
        type: 'kyc_rejected'
      }).catch(console.error);

      showToast(lang === 'ar' ? '❌ تم رفض الملف وإرسال التنبيه للمشغل' : '❌ Verification rejected and user alerted.');
      setRejoiningUserId(null);
      setRejectionReasonText('');
      onRejectKYC(userId);
    } catch (e) {
      console.error("Error writing rejection write block: ", e);
      // Fallback locally
      onRejectKYC(userId);
      setRejoiningUserId(null);
      showToast('Rejected locally (Dev Sandbox Fallback)');
    }
  };

  const cleanEmailStr = (userProfile?.email || '').trim().toLowerCase();
  const isAuthorized = cleanEmailStr === 'hakerzoldyck@gmail.com' || userProfile?.role === 'admin' || userProfile?.isAdmin === true;

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center space-y-4 max-w-lg mx-auto bg-white rounded-3xl border-2 border-red-200 shadow-xl mt-12 font-sans select-none">
        <div className="w-16 h-16 bg-red-100 text-[#FF3B7C] rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-slate-900">
          {lang === 'ar' ? 'وصول محمي أمنياً 🔒' : 'Cryptographic Security Fence'}
        </h2>
        <p className="text-xs text-gray-500 font-bold leading-relaxed">
          {lang === 'ar' 
            ? 'خطأ 403: تم حظر الوصول. الهوية المدخلة لا تملك ترخيص الإدارة الفدرالية للمنصة كويست الجزائر.' 
            : 'Error 403: Security perimeter blocked. Provided credentials lack authorized administrative clearance.'}
        </p>
      </div>
    );
  }

  // Metrics computing incorporating real-time database results
  const totalDancers = leaders.length + 1;
  const bookedQuests = quests.filter(q => q.status === 'booked' || q.status === 'pending_verification');
  const finishedQuests = quests.filter(q => q.status === 'completed');

  return (
    <div className="space-y-6 pb-12 font-sans text-[#1F2A44]" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {/* 🖼️ Gorgeous Full-Screen ID Inspect Modal */}
      {selectedIdImageUrl && (
        <div 
          onClick={() => setSelectedIdImageUrl(null)}
          className="fixed inset-0 bg-[#1F2A44]/95 z-50 flex flex-col items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="absolute top-4 right-4 z-50">
            <button 
              onClick={() => setSelectedIdImageUrl(null)}
              className="w-12 h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer border-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="max-w-4xl w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] text-[#FFD34D] font-black tracking-widest uppercase bg-slate-900/80 px-4 py-1.5 rounded-full inline-block">
              🛡️ {lang === 'ar' ? 'معاينة أمنية دقيقة للبطاقة الوطنية للتوثيق' : 'Secure National KYC Image Inspector'}
            </p>
            <div className="relative border-4 border-[#FFD34D] rounded-3xl overflow-hidden bg-white shadow-2xl">
              <img 
                src={formatImageSrc(selectedIdImageUrl) || selectedIdImageUrl} 
                alt="National ID Document Preview" 
                className="w-full max-h-[70vh] object-contain mx-auto"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs text-slate-300 font-bold">
              {lang === 'ar' ? 'يرجى مراجعة تناسق البيانات الأمنية وتطابقها قبل اتخاذ القرار.' : 'Please double check face contrast, full title matching and credential numbers.'}
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Header */}
      <div className="bg-slate-900 border-2 border-[#FFD34D] text-white p-5 rounded-3xl space-y-2 shadow-md relative overflow-hidden">
        <span className="absolute -top-3 -right-3 w-16 h-16 bg-[#FFD34D]/10 rounded-full blur-lg"></span>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#FFD34D]" />
          <span className="text-[10px] text-[#FFD34D] font-black uppercase tracking-widest">{lang === 'ar' ? 'الإدارة المركزية لـ Quest' : 'Master Central Command'}</span>
        </div>
        <h3 className="text-base font-black text-[#FFD34D]">{lang === 'ar' ? 'لوحة تفتيش الهوية والتحقق ومكافحة الاحتيال 🔒' : 'KYC Audit Dashboard & Fraud Control'}</h3>
        <p className="text-xs text-gray-300 font-medium leading-relaxed">
          {lang === 'ar' 
            ? 'بصفتك مراقباً إدارياً مسجلاً، لديك سلطة قضائية كاملة موازية لفحص بطاقات التعريف، ومراجعة بلاغات السمسرة المشبوهة.' 
            : 'As an authorized administrator, you possess cryptographic discretion to arbitrate national KYC registries and moderate chore boards.'}
        </p>
      </div>

      {/* 🧭 Admin Navigation Center */}
      <div className="flex gap-2 flex-wrap items-center bg-slate-100 p-1.5 rounded-2xl border border-gray-200">
        <button
          type="button"
          onClick={() => {
            setActiveAdminTab('user_management');
            setUserSubTab('all');
          }}
          className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 select-none border-none ${
            activeAdminTab === 'user_management'
              ? 'bg-[#1F2A44] text-white shadow-md'
              : 'text-gray-600 hover:bg-white hover:text-[#1F2A44]'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>{lang === 'ar' ? '👤 إدارة الأعضاء والتوثيق' : '👤 Users & KYC'}</span>
          {dbPendingUsers.length > 0 && (
            <span className="bg-amber-500 text-slate-950 font-black font-mono text-[9px] px-2 py-0.5 rounded-full animate-bounce">
              {dbPendingUsers.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveAdminTab('support_and_moderation');
            setModerationSubTab('tickets');
          }}
          className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 select-none border-none ${
            activeAdminTab === 'support_and_moderation'
              ? 'bg-[#1F2A44] text-white shadow-md'
              : 'text-gray-600 hover:bg-white hover:text-[#1F2A44]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
          <span>{lang === 'ar' ? '🛡️ الدعم والبلاغات والبث' : '🛡️ Moderation & Support'}</span>
          {(supportTickets.filter(t => t.status !== 'resolved').length > 0 || quests.filter(q => q.flagsCount && q.flagsCount > 0).length > 0) && (
            <span className="bg-rose-500 text-white font-black font-mono text-[9px] px-2 py-0.5 rounded-full animate-pulse">
              {supportTickets.filter(t => t.status !== 'resolved').length + quests.filter(q => q.flagsCount && q.flagsCount > 0).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('recharge_audit')}
          className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 select-none border-none ${
            activeAdminTab === 'recharge_audit'
              ? 'bg-[#1F2A44] text-white shadow-md'
              : 'text-gray-600 hover:bg-white hover:text-[#1F2A44]'
          }`}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span>{lang === 'ar' ? '💳 تدقيق المعاملات والدفع' : '💳 Payment & Recharge Audit'}</span>
          {refillRequests.filter(r => r.status === 'suspicious' || r.status === 'rejected' || r.status === 'pending').length > 0 && (
            <span className="bg-amber-500 text-slate-950 font-black font-mono text-[9px] px-2 py-0.5 rounded-full animate-pulse">
              {refillRequests.filter(r => r.status === 'suspicious' || r.status === 'rejected' || r.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('matchmaker')}
          className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 select-none border-none ${
            activeAdminTab === 'matchmaker'
              ? 'bg-[#1F2A44] text-white shadow-md'
              : 'text-gray-600 hover:bg-white hover:text-[#1F2A44]'
          }`}
        >
          <TrendingUp className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
          <span>{lang === 'ar' ? '🎯 خوارزمية المطابقة الموزونة' : '🎯 Weighted Matchmaking'}</span>
        </button>
      </div>

      {activeAdminTab === 'user_management' && (
        <>
          {/* Bento Platform Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Total Users</span>
              <span className="text-xl font-black font-mono block">{totalDancers} Operators</span>
            </div>
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Pending KYC Certs</span>
              <span className="text-xl font-black text-amber-600 font-mono block">
                {dbPendingUsers.length} Envelopes
              </span>
            </div>
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">Active Task Trades</span>
              <span className="text-xl font-black text-[#4FC3F7] font-mono block">{bookedQuests.length} Chores</span>
            </div>
            <div className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wide block">DZD Paid Volume</span>
              <span className="text-xl font-black text-[#FF3B7C] font-mono block">
                DZD {finishedQuests.reduce((acc, q) => acc + q.cashReward, 0)} DA
              </span>
            </div>
          </div>

          {/* 📥 Super-Admin Emergency NID Data Export Controller (Right to NID compliance) */}
          {userProfile.email === 'hakerzoldyck@gmail.com' && (
            <div className="bg-[#1F2A44] border-2 border-red-500 rounded-3xl p-6 text-white space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10 text-right">
                <div className="space-y-1 text-right flex-1 w-full">
                  <h4 className="text-sm font-black text-red-400 flex items-center gap-2 justify-end mb-1">
                    <span>{isRtl ? 'بوابة المراقبة الفائقة: تصدير وثائق الهوية الطارئة 🛡️' : 'Super-Admin Core: Emergency NID Export 🛡️'}</span>
                  </h4>
                  <p className="text-[10px] text-gray-300 font-bold">
                    {isRtl ? 'تصدير كامل ومشفر لكافة بيانات المشغلين وبطاقات NID مع تسجيل الأثر فورياً لتدقيق الجهات الأمنية' : 'Audit-logged raw cryptographic JSON exporter for security compliance.'}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-[10.5px] text-gray-350 font-semibold leading-relaxed text-right max-w-md">
                  {isRtl
                    ? '⚠️ تنبيه أمني: استخدام هذا الزر يطبع أثرًا غير قابل للتزييف في السجل الإداري (admin_audit_logs) على الفايرستور. يتم حفظ الأرشيف فوراً كملف JSON مشفر.'
                    : '⚠️ Security Notice: Export usage prints an immutable entry in centralized audit blocks. Data yields standard JSON format.'}
                </p>
                <button
                  type="button"
                  onClick={handleEmergencyNidExport}
                  className="w-full sm:w-auto px-5 py-3 bg-red-650 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 shrink-0 hover:scale-102 transition-transform"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>{isRtl ? 'تحميل أرشيف NID وتصدير البيانات 📥' : 'Download NID Archives & Export 📥'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 🗂️ Users & Identity Sub-Tabs */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-md border border-gray-200/80">
            <button
              type="button"
              onClick={() => setUserSubTab('all')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                userSubTab === 'all'
                  ? 'bg-white text-[#1F2A44] shadow-sm font-black'
                  : 'text-gray-500 hover:text-[#1F2A44]'
              }`}
            >
              <span>{isRtl ? '👤 كافة الأعضاء' : 'All Operators'}</span>
            </button>
            <button
              type="button"
              onClick={() => setUserSubTab('pending_kyc')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                userSubTab === 'pending_kyc'
                  ? 'bg-white text-[#1F2A44] shadow-sm font-black'
                  : 'text-gray-500 hover:text-[#1F2A44]'
              }`}
            >
              <span>{isRtl ? '📑 طلبات التوثيق' : 'KYC Queue'}</span>
              {dbPendingUsers.length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                  {dbPendingUsers.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setUserSubTab('banned')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                userSubTab === 'banned'
                  ? 'bg-white text-[#1F2A44] shadow-sm font-black'
                  : 'text-gray-500 hover:text-[#1F2A44]'
              }`}
            >
              <span>{isRtl ? '🚫 المحظورين' : 'Banned'}</span>
              {dbAllUsers.filter(u => u.isBanned).length > 0 && (
                <span className="bg-red-500 text-white font-black font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                  {dbAllUsers.filter(u => u.isBanned).length}
                </span>
              )}
            </button>
          </div>

          {userSubTab === 'all' && (
            <>
              {/* 🔍 User Account Registry Inspector Board */}
              <div id="admin-user-inspector-panel" className="bg-white border-2 border-[#FFD34D] rounded-3xl p-6 space-y-6 shadow-md">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <div className="p-1.5 bg-[#FFD34D]/10 rounded-xl">
            <Search className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-right">
            <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
              {isRtl ? 'بوابة الرقابة والتحكم برصيد الضمان الميداني والبروفايل' : 'Operator Query Registry & Balance Core'}
            </h4>
            <p className="text-[10px] text-gray-400 font-semibold">
              {isRtl ? 'ابحث عن أي عضو في كويست بالرمز الفريد، البريدية الإلكترونية أو الاسم للتحكم الكلي ببياناته ورصيده' : 'Search any member by unique ID code, name, or Google mail to override status or balance.'}
            </p>
          </div>
        </div>

        {/* Search Bar Wrapper */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={isRtl ? 'ابحث عن مستخدم بالاسم، البريد الإلكتروني، أو رمز الـ ID (مثلاً: QST-A79B)...' : 'Search user by Name, Email, or Short ID (e.g. QST-7C4E)...'}
            value={adminSearchCode}
            onChange={(e) => setAdminSearchCode(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 border border-gray-255 rounded-2xl text-xs font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFD34D]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdminSearch();
            }}
          />
          <button
            onClick={handleAdminSearch}
            className="px-6 py-3 bg-[#1F2A44] text-white hover:bg-slate-800 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            {isRtl ? 'استعراض 🔍' : 'Inspect 🔍'}
          </button>
        </div>

        {/* Live Auto-Suggest Search Results Dropdown */}
        {adminSearchCode.trim().length > 0 && (
          <div className="bg-slate-50 border border-amber-200/80 rounded-2xl p-2.5 space-y-1.5 max-h-56 overflow-y-auto shadow-sm text-right animate-in fade-in duration-150">
            <span className="text-[9.5px] text-amber-900 font-extrabold uppercase px-2 block">
              {isRtl ? '🔍 المطبّق الفوري لنتائج البحث بالمستخدمين:' : '🔍 Live Search Matches:'}
            </span>
            {dbAllUsers.filter(u => {
              const q = adminSearchCode.trim().toLowerCase();
              return (
                (u.name && u.name.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.shortId && u.shortId.toLowerCase().includes(q)) ||
                (u.id && u.id.toLowerCase().includes(q)) ||
                (u.phone && u.phone.includes(q))
              );
            }).length === 0 ? (
              <p className="text-[10px] text-gray-400 font-bold p-2 text-center">
                {isRtl ? 'لا توجد نتائج مطابقة لهذا البحث حالياً' : 'No users match this query'}
              </p>
            ) : (
              dbAllUsers.filter(u => {
                const q = adminSearchCode.trim().toLowerCase();
                return (
                  (u.name && u.name.toLowerCase().includes(q)) ||
                  (u.email && u.email.toLowerCase().includes(q)) ||
                  (u.shortId && u.shortId.toLowerCase().includes(q)) ||
                  (u.id && u.id.toLowerCase().includes(q)) ||
                  (u.phone && u.phone.includes(q))
                );
              }).slice(0, 8).map((u) => (
                <div 
                  key={u.id}
                  onClick={() => {
                    selectUserForInspection(u);
                  }}
                  className="flex items-center justify-between p-2.5 bg-white hover:bg-amber-50 rounded-xl border border-gray-200 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <span className="text-[10px] font-mono font-black text-[#FF3B7C] bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                    {u.shortId || u.id.slice(0, 8)}
                  </span>
                  <div className="flex items-center gap-2.5 text-right">
                    <div>
                      <span className="text-xs font-black text-[#1F2A44] block">{u.name}</span>
                      <span className="text-[9.5px] text-gray-400 block font-mono">{u.email || u.phone || 'بدون بريد'}</span>
                    </div>
                    <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Searched Inspector Box */}
        {searchedUser ? (
          <div className="bg-slate-50/55 rounded-2xl p-5 border border-gray-150 space-y-5">
            
            {/* Header Mini Info Card */}
            <div className="flex items-center justify-between pb-4 border-b border-dashed border-gray-200 gap-3.5">
              <div className="flex items-center gap-3.5">
                <img 
                  src={searchedUser.avatar} 
                  alt={searchedUser.name} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                />
                <div className="space-y-0.5 text-right flex-1">
                  <h5 className="font-extrabold text-sm text-[#1F2A44] flex items-center justify-start gap-1.5">
                    <span>{searchedUser.name}</span>
                    <span className="text-[9px] bg-slate-950 text-[#FFD34D] px-2 py-0.5 rounded-lg font-mono font-black uppercase">
                      {searchedUser.shortId || '(Pending)'}
                    </span>
                  </h5>
                  <p className="text-[10px] text-gray-400 font-mono font-semibold">
                    UID: <span className="select-all font-bold text-gray-600">{searchedUser.id}</span>
                  </p>
                  {searchedUser.email && (
                    <p className="text-[10px] text-[#4FC3F7] font-semibold">{searchedUser.email}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {(searchedUser.idVerificationStatus === 'verified' || searchedUser.idVerificationStatus === 'pending') && (
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedKycUserId(expandedKycUserId === searchedUser.id ? null : searchedUser.id);
                    }}
                    className="bg-sky-50 text-sky-750 hover:bg-sky-100 font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer border-none flex items-center gap-1.5 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'بيانات الهوية' : 'ID Details'}</span>
                  </button>
                )}

                {searchedUser.idVerificationStatus !== 'verified' && (
                  <button
                    type="button"
                    onClick={() => handleApproveUser(searchedUser.id)}
                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer border-none flex items-center gap-1.5 transition-all"
                  >
                    <span>{lang === 'ar' ? 'تفعيل الهوية (Approve)' : 'Approve KYC'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Expanded ID Credentials panel */}
            {expandedKycUserId === searchedUser.id && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-right text-xs font-sans animate-fade-in w-full">
                <div className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider mb-1 flex items-center justify-between">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{lang === 'ar' ? '🔍 معلومات بطاقة الهوية الوطنية المستخرجة' : '🔍 Extracted ID Credentials'}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-mono text-[#1F2A44] font-black">{searchedUser.name}</span>
                  <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'الاسم المصرح به:' : 'Declared Name:'}</span>
                </div>
                <div className="flex justify-between items-center gap-4 border-t border-slate-100 pt-1.5">
                  <span className="font-mono text-emerald-600 font-black">{searchedUser.verifiedName || searchedUser.name}</span>
                  <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'الاسم المستخرج من البطاقة:' : 'Extracted ID Name:'}</span>
                </div>
                <div className="flex justify-between items-center gap-4 border-t border-slate-100 pt-1.5">
                  <span className="font-mono text-slate-700 font-black">{searchedUser.verifiedNid || (lang === 'ar' ? 'غير متوفر' : 'Not available')}</span>
                  <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'رقم الهوية المستخرج:' : 'Extracted ID Number:'}</span>
                </div>
                <div className="flex justify-between items-center gap-4 border-t border-slate-100 pt-1.5">
                  <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded ${
                    searchedUser.idVerificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {searchedUser.idVerificationStatus?.toUpperCase()}
                  </span>
                  <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'حالة التوثيق:' : 'Verification Status:'}</span>
                </div>

                {/* Front & Back Images of National ID */}
                {(() => {
                  const sFront = formatImageSrc(searchedUser.idFrontUrl || (searchedUser as any).kycFrontUrl || searchedUser.idCardUrl || searchedUser.idDocumentUrl);
                  const sBack = formatImageSrc(searchedUser.idBackUrl || (searchedUser as any).kycBackUrl);
                  return (sFront || sBack) ? (
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      {sFront && (
                        <div 
                          onClick={() => setSelectedIdImageUrl(sFront)}
                          className="w-24 h-16 bg-slate-900 rounded-lg overflow-hidden border border-slate-300 cursor-zoom-in relative group shrink-0"
                        >
                          <img src={sFront} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white font-black text-center">{lang === 'ar' ? 'الوجه الأمامي' : 'Front'}</span>
                        </div>
                      )}
                      {sBack && (
                        <div 
                          onClick={() => setSelectedIdImageUrl(sBack)}
                          className="w-24 h-16 bg-slate-900 rounded-lg overflow-hidden border border-slate-300 cursor-zoom-in relative group shrink-0"
                        >
                          <img src={sBack} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[7px] text-white font-black text-center">{lang === 'ar' ? 'الوجه الخلفي' : 'Back'}</span>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Referral Information Display */}
            <div className="bg-amber-50/40 border border-amber-200/40 rounded-xl p-3.5 space-y-2 text-right text-xs font-sans">
              <div className="text-amber-800 font-extrabold text-[9px] uppercase tracking-wider mb-1 flex items-center justify-between">
                <Gift className="w-3 h-3 text-amber-500 fill-amber-500/10" />
                <span>{lang === 'ar' ? '🔗 معلومات الإحالة ودعوة الأصدقاء' : '🔗 Referral & Invitation Stats'}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-mono text-[#1F2A44] font-black">{searchedUser.referredUsersCount || 0}</span>
                <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'عدد الأشخاص المدعوين:' : 'People Invited:'}</span>
              </div>
              <div className="flex justify-between items-center gap-4 border-t border-amber-100/40 pt-1.5">
                <span className="font-mono text-[#1F2A44] font-black">{searchedUser.referredBy || (lang === 'ar' ? 'غير متوفر' : 'Not available')}</span>
                <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'تمت دعوته بواسطة:' : 'Referred By:'}</span>
              </div>
            </div>

            {/* Editing Form */}
            <form onSubmit={handleSaveUserProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                    {isRtl ? 'الاسم المعروض بالكامل' : 'Full Operator Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-250 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                    {isRtl ? 'رقم الهاتف المعتمد' : 'Telephone Direct Line'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-255 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                    {isRtl ? 'الموقع الجغرافي (البلدية والولاية)' : 'City or Regional Coordinates'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-255 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                    {isRtl ? 'مستويات التقييم العام (⭐ 1.0 - 5.0)' : 'Reputation Score star rating'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    required
                    value={editRating}
                    onChange={(e) => setEditRating(parseFloat(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-255 rounded-xl text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                    {isRtl ? 'حالة مراجعة الهوية KYC' : 'KYC verification state'}
                  </label>
                  <select
                    value={editVerification}
                    onChange={(e: any) => setEditVerification(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-255 rounded-xl text-xs font-bold focus:outline-none"
                  >
                    <option value="unverified">{isRtl ? 'غير موثق (Unverified)' : 'Unverified Identity'}</option>
                    <option value="pending">{isRtl ? 'قيد التدقيق (Pending review)' : 'Pending Audit Approval'}</option>
                    <option value="verified">{isRtl ? 'موثق رسمياً (Verified ✓)' : 'ID Verified ✓'}</option>
                  </select>
                </div>

                <div className="space-y-1.5 text-right flex flex-col justify-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider mb-2">
                    {isRtl ? 'وضع الأمان ودرع حظر الحساب' : 'Freeze & Block'}
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer w-fit select-none">
                    <input
                      type="checkbox"
                      checked={editBanned}
                      onChange={(e) => setEditBanned(e.target.checked)}
                      className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500 cursor-pointer"
                    />
                    <span className={`text-xs font-black ${editBanned ? 'text-red-600' : 'text-emerald-600'}`}>
                      {editBanned 
                        ? (isRtl ? '🔴 مجمّد ومحظور حالياً (BANNED)' : '🔴 BANNED & FROZEN') 
                        : (isRtl ? '🟢 حساب نشط وصالح (ACTIVE)' : '🟢 ACTIVE')}
                    </span>
                  </label>
                </div>

              </div>

              {/* 💵 Specialized Override */}
              <div className="bg-white border border-yellow-250 p-4.5 rounded-2xl space-y-3 shadow-inner">
                <div className="flex justify-between items-center text-right">
                  <span className="text-[11px] font-black text-slate-400 uppercase block tracking-wider flex-1">
                    {isRtl ? 'تعديل رصيد الضمان والـ DA للمستخدم' : 'Local Gold Token Balance (Tokens / DA)'}
                  </span>
                  <span className="text-xs font-mono font-black text-[#FF3B7C]">
                    {editBalance} DA
                  </span>
                </div>

                {/* Direct input and buttons together */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                  <input
                    type="number"
                    min="0"
                    required
                    value={editBalance}
                    onChange={(e) => setEditBalance(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-mono font-black text-gray-700 focus:outline-none"
                  />
                  <div className="grid grid-cols-4 gap-1 sm:flex sm:gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustBalance(-500)}
                      className="px-2.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-[10px] font-black cursor-pointer active:scale-95 transition-all text-center"
                    >
                      -500
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustBalance(-100)}
                      className="px-2.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-[10px] font-black cursor-pointer active:scale-95 transition-all text-center"
                    >
                      -100
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustBalance(100)}
                      className="px-2.5 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[10px] font-black cursor-pointer active:scale-95 transition-all text-center"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustBalance(500)}
                      className="px-2.5 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-[10px] font-black cursor-pointer active:scale-95 transition-all text-center"
                    >
                      +500
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer text-center"
                >
                  {isRtl ? '💾 حفظ التغييرات وتحديث السجل' : '💾 Save Profile Override'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(isRtl ? `⚠️ هل أنت متأكد من حذف حساب المستخدم (${searchedUser.name}) نهائياً من قاعدة البيانات والمنصة؟` : `⚠️ Are you sure you want to purge user (${searchedUser.name}) permanently?`)) {
                      const targetId = searchedUser.id;
                      setDbAllUsers(prev => prev.filter(u => u.id !== targetId));
                      setSearchedUser(null);
                      showToast(isRtl ? '🗑️ تم حذف حساب المستخدم نهائياً!' : '🗑️ User account purged successfully!');
                      try {
                        await deleteDoc(doc(db, 'users', targetId));
                      } catch (err) {
                        console.warn("Firestore user deletion warning:", err);
                      }
                    }
                  }}
                  className="px-4 py-3.5 bg-rose-50 hover:bg-rose-100 text-[#FF3B7C] border border-rose-200 font-black text-xs rounded-2xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                  title={isRtl ? 'حذف حساب هذا المستخدم نهائياً' : 'Purge User Account'}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isRtl ? 'حذف الحساب 🗑' : 'Purge User 🗑'}</span>
                </button>
              </div>
            </form>

            {/* 📝 User publications and task posts management */}
            <div className="space-y-3 pt-3 border-t border-dashed border-gray-200">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">
                {isRtl ? 'المنشورات والكويستات المعلنة بواسطة هذا المستخدم' : 'Active publications hosted by this identity'}
              </h5>

              {quests.filter(q => q.creatorId === searchedUser.id).length === 0 ? (
                <p className="text-center py-4 bg-white rounded-xl border border-dashed border-gray-200 text-[10.5px] text-gray-400 font-bold">
                  {isRtl ? 'لم يقم هذا المستخدم بنشر أي طلبات عمل بعد.' : 'No active quest publications found.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {quests
                    .filter(q => q.creatorId === searchedUser.id)
                    .map((quest) => (
                      <div 
                        key={quest.id} 
                        className="bg-white p-3 rounded-xl border border-gray-150 flex items-center justify-between gap-3 text-right"
                      >
                        <div className="space-y-0.5 min-w-0 pr-1 flex-1">
                          <span className="text-[8px] bg-gray-100 text-[#1F2A44] font-black px-1.5 py-0.2 rounded uppercase">
                            {quest.category}
                          </span>
                          <h6 className="font-extrabold text-xs text-[#1F2A44] truncate">{quest.title}</h6>
                          <p className="text-[9px] text-[#FF3B7C] font-mono leading-none">{quest.cashReward} DA | {quest.status}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(isRtl ? 'هل تريد حذف هذا المنشور نهائيا؟' : 'Purge this quest post?')) {
                              onDeleteQuest(quest.id);
                              showToast(isRtl ? 'تم حذف المنشور!' : 'Post deleted!');
                            }
                          }}
                          className="bg-red-55 hover:bg-red-100 text-red-500 p-2 rounded-lg cursor-pointer transition-colors shrink-0 border-none"
                          title={isRtl ? 'حذف هذا المنشور فوراً' : 'Purge Post Immediately'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center py-4 text-xs text-gray-400 font-semibold italic">
            {isRtl ? 'اكتب معرّف ID في الأعلى ثم اضغط استعراض لبدء عملية المراجعة وتعديل الرصيد.' : 'Specify ID or code above and trigger inspection to explore properties.'}
          </div>
        )}
      </div>
      </>
      )}

      {userSubTab === 'pending_kyc' && (
        <>
          {/* Real-time KYC Envelopes Section */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#4FC3F7]" />
            <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
              {lang === 'ar' ? 'طلبات التحقق من الهوية قيد المراجعة الإدارية' : 'Live Operator KYC Verification Queue'} ({dbPendingUsers.length})
            </h4>
          </div>
          <span className="text-[9.5px] bg-red-100 text-red-600 px-2 py-0.5 rounded-md font-black animate-pulse">
            Live Database
          </span>
        </div>

        <div className="space-y-4 divide-y divide-gray-100">
          {isLoadingPending && (
            <div className="text-center py-6 space-y-2">
              <span className="w-6 h-6 border-2 border-[#1F2A44] border-t-transparent rounded-full animate-spin inline-block"></span>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest animate-pulse">
                {lang === 'ar' ? 'جاري الاتصال السحابي بالتحقق الفدرالي...' : 'Subscribing to administrative live KYC feed...'}
              </p>
            </div>
          )}

          {!isLoadingPending && dbPendingUsers.map((user) => {
            const frontRaw = user.idFrontUrl || (user as any).kycFrontUrl || user.idCardUrl || user.idDocumentUrl;
            const backRaw = user.idBackUrl || (user as any).kycBackUrl;
            const frontImg = formatImageSrc(frontRaw);
            const backImg = formatImageSrc(backRaw);
            const hasIdImage = !!(frontImg || backImg);
            const isActiveReject = rejoiningUserId === user.id;

            return (
              <div 
                key={user.id} 
                className="pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:bg-slate-50/50 p-2 rounded-2xl"
              >
                <div className="flex gap-3.5 items-start">
                  {/* Thumbnails of National ID (Front and Back) */}
                  <div className="flex gap-1.5 shrink-0">
                    {frontImg && (
                      <div 
                        onClick={() => setSelectedIdImageUrl(frontImg)}
                        className="relative w-16 h-12 md:w-20 md:h-14 rounded-xl bg-slate-900 overflow-hidden cursor-zoom-in border-2 border-slate-200 hover:border-[#FFD34D] transition-all duration-200 shrink-0 group shadow-xs"
                      >
                        <img 
                          src={frontImg} 
                          alt="National ID Front Document" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 text-[#FFD34D]" />
                        </div>
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[7px] text-white font-black text-center py-0.5">
                          {lang === 'ar' ? 'الوجه الأمامي' : 'Front'}
                        </span>
                      </div>
                    )}
                    {backImg && (
                      <div 
                        onClick={() => setSelectedIdImageUrl(backImg)}
                        className="relative w-16 h-12 md:w-20 md:h-14 rounded-xl bg-slate-900 overflow-hidden cursor-zoom-in border-2 border-slate-200 hover:border-[#FFD34D] transition-all duration-200 shrink-0 group shadow-xs"
                      >
                        <img 
                          src={backImg} 
                          alt="National ID Back Document" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-4 h-4 text-[#FFD34D]" />
                        </div>
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[7px] text-white font-black text-center py-0.5">
                          {lang === 'ar' ? 'الوجه الخلفي' : 'Back'}
                        </span>
                      </div>
                    )}
                    {!frontImg && !backImg && (
                      <div className="w-16 h-12 md:w-20 md:h-14 bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-1 shrink-0">
                        <Eye className="w-4 h-4 text-slate-300 mb-0.5" />
                        <span className="text-[7.5px] text-slate-400 font-extrabold">{lang === 'ar' ? 'لا توجد صورة' : 'No ID Image'}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-right">
                    <div className="flex items-center gap-2 justify-start">
                      <img src={user.avatar} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                      <h5 className="text-xs font-black text-[#1F2A44]">{user.name}</h5>
                    </div>
                    <p className="text-[10.5px] font-mono font-bold text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#4FC3F7]" />
                      <span>{user.phone}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className="text-[8px] bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide flex items-center gap-0.5">
                        <Sparkles className="w-2 h-2" />
                        {lang === 'ar' ? 'قيد المراجعة الإدارية' : 'Pending Administrative Review'}
                      </span>
                      {hasIdImage ? (
                        <span className="text-[8px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md font-extrabold uppercase">
                          {lang === 'ar' ? 'مرفق بطاقة الهوية' : 'NID Cover Uploaded'}
                        </span>
                      ) : (
                        <span className="text-[8px] bg-[#FF3B7C]/10 text-[#FF3B7C] px-2 py-0.5 rounded-md font-extrabold uppercase">
                          {lang === 'ar' ? 'صورة تجريبية' : 'Sandbox Demo Card'}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 bg-slate-50 border border-slate-150 rounded-xl p-2.5 space-y-1 text-right text-[10.5px] font-sans w-full max-w-sm">
                      <div className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                        <span>{lang === 'ar' ? '🔍 تدقيق الهوية بالذكاء الاصطناعي (AI OCR)' : '🔍 Identity Match Audit'}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="font-mono text-[#1F2A44] font-black">{user.name}</span>
                        <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'الاسم المصرح به:' : 'Declared Name:'}</span>
                      </div>
                      {user.verifiedName && (
                        <div className="flex justify-between gap-4 border-t border-slate-100 pt-1">
                          <span className="font-mono text-emerald-600 font-black">{user.verifiedName}</span>
                          <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'الاسم المستخرج من البطاقة:' : 'Extracted ID Name:'}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-4 border-t border-slate-100 pt-1">
                        <span className="font-mono text-slate-700 font-black">{user.verifiedNid || (lang === 'ar' ? 'غير متوفر' : 'Not available')}</span>
                        <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'رقم الهوية المستخرج:' : 'Extracted ID Number:'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto self-stretch md:self-auto shrink-0 justify-end">
                  {!isActiveReject ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApproveUser(user.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'قبول التوثيق' : 'Approve Case'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejoiningUserId(user.id);
                          setRejectionReasonText('');
                        }}
                        className="bg-red-50 hover:bg-red-100 text-[#FF3B7C] font-black text-[10px] px-4 py-2.5 rounded-xl border border-[#FF3B7C]/20 transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <ShieldX className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'رفض الطلب' : 'Reject Case'}</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full bg-[#FF3B7C]/5 border border-[#FF3B7C]/20 p-3 rounded-2xl space-y-2 mt-1 text-right">
                      <label className="block text-[10px] font-black text-rose-700">
                        {lang === 'ar' ? 'حدد سبب الرفض لتنبيه المستخدم:' : 'State Rejection Reason to notify operator:'}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={rejectionReasonText}
                          onChange={(e) => setRejectionReasonText(e.target.value)}
                          placeholder={lang === 'ar' ? 'الاسم لا يطابق بطاقة الهوية / الصورة غير واضحة...' : 'e.g., Name mismatch with identity card / image fuzzy...'}
                          className="flex-grow px-3 py-1.5 bg-white border border-rose-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#FF3B7C]"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmReject(user.id)}
                          className="bg-[#FF3B7C] hover:bg-[#FF3B7C]/90 text-white font-black text-[10px] px-3.5 py-1.5 rounded-xl shadow-sm transition-all"
                        >
                          {lang === 'ar' ? 'تأكيد الرفض' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejoiningUserId(null)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-none"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!isLoadingPending && dbPendingUsers.length === 0 && (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2.5">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 text-xl font-bold">
                ✔
              </div>
              <div>
                <h5 className="text-xs font-black text-gray-700">
                  {lang === 'ar' ? 'كل طلبات التحقق من الهوية تمت مراجعتها بالكامل 🤝' : 'Identity Registry Fully Cleared 🤝'}
                </h5>
                <p className="text-[10px] text-gray-400 font-semibold max-w-sm mx-auto leading-relaxed mt-1">
                  {lang === 'ar' 
                    ? 'لا توجد أي ملفات معلقة في قاعدة بيانات المسيلية حالياً. جميع الصيادين الملتزمين رصيدهم سليم وموثق.' 
                    : 'All users are in sync. No operator is currently awaiting KYC verification.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {userSubTab === 'all' && (
        <>
          {/* Operator Users Audit Directory */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FFD34D]" />
            <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">Operator Users Audit Directory</h4>
          </div>
          <input
            type="text"
            placeholder="Filter operators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold"
          />
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {/* Include current user profile as first operator user */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <img src={userProfile.avatar} className="w-8 h-8 rounded-full object-cover border" />
              <div className="text-right">
                <h5 className="text-xs font-black text-[#1F2A44] flex items-center gap-1 justify-start">
                  <span>{userProfile.name} (You)</span>
                  <span className="bg-[#1F2A44] text-[#FFD34D] text-[7px] px-2 py-0.2 rounded font-black uppercase">SUPERVISOR</span>
                </h5>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Rep: {userProfile.rating} ⭐ | {userProfile.idVerificationStatus} KYC</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md uppercase">Active Admin</span>
            </div>
          </div>

          {leaders
            .filter(leader => leader.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((user) => {
              const isBanned = user.isBanned;
              return (
                <div key={user.id} className="p-3.5 bg-white rounded-2xl border border-gray-150 hover:shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-3 w-full">
                    <div className="flex items-center gap-2.5">
                      <img src={user.avatar} className="w-8 h-8 rounded-full object-cover border border-slate-100" />
                      <div className="text-right">
                        <h5 className="text-xs font-black text-[#1F2A44] flex items-center gap-1 justify-start">
                          <span>{user.name}</span>
                          {(user.idVerificationStatus === 'verified' || (user as any).verificationStatus === 'approved') && (
                            <span className="text-emerald-500 font-black">✔</span>
                          )}
                        </h5>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Rep: {user.rating} ⭐ | {user.idVerificationStatus || 'unverified'} KYC</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {(user.idVerificationStatus === 'verified' || user.idVerificationStatus === 'pending') && (
                        <button
                          onClick={() => {
                            setExpandedKycUserId(expandedKycUserId === user.id ? null : user.id);
                          }}
                          className="bg-sky-50 text-sky-750 hover:bg-sky-100 font-bold text-[9px] px-2.5 py-1.5 rounded-lg cursor-pointer border-none flex items-center gap-1 transition-all"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'بيانات الهوية' : 'ID Details'}</span>
                        </button>
                      )}

                      {user.idVerificationStatus !== 'verified' && (
                        <button
                          onClick={() => handleApproveUser(user.id)}
                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[9px] px-2.5 py-1.5 rounded-lg cursor-pointer border-none"
                        >
                          Approve KYC
                        </button>
                      )}

                      <button
                        onClick={() => onBanUser(user.id, !isBanned)}
                        className={`font-black text-[9px] px-3 py-1.5 rounded-lg cursor-pointer border-none ${
                          isBanned ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-50 text-[#FF3B7C] hover:bg-red-150'
                        }`}
                      >
                        {isBanned ? 'Pardon (Unban)' : 'Ban/Freeze'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded ID Information block */}
                  {expandedKycUserId === user.id && (
                    <div className="mt-1 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-right text-xs font-sans animate-fade-in w-full">
                      <div className="text-slate-400 font-extrabold text-[9px] uppercase tracking-wider mb-1 flex items-center justify-between">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{lang === 'ar' ? '🔍 معلومات بطاقة الهوية الوطنية المستخرجة' : '🔍 Extracted ID Credentials'}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4">
                        <span className="font-mono text-[#1F2A44] font-black">{user.name}</span>
                        <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'الاسم المصرح به:' : 'Declared Name:'}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 border-t border-slate-100 pt-1.5">
                        <span className="font-mono text-emerald-600 font-black">{user.verifiedName || user.name}</span>
                        <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'الاسم المستخرج من البطاقة:' : 'Extracted ID Name:'}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 border-t border-slate-100 pt-1.5">
                        <span className="font-mono text-slate-700 font-black">{user.verifiedNid || (lang === 'ar' ? 'غير متوفر' : 'Not available')}</span>
                        <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'رقم الهوية المستخرج:' : 'Extracted ID Number:'}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4 border-t border-slate-100 pt-1.5">
                        <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded ${
                          user.idVerificationStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {user.idVerificationStatus?.toUpperCase()}
                        </span>
                        <span className="text-gray-500 font-semibold">{lang === 'ar' ? 'حالة التوثيق:' : 'Verification Status:'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
      </>
      )}

      {userSubTab === 'banned' && (
        <div className="bg-white border border-red-200 rounded-3xl p-6 space-y-6 shadow-sm" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-100 text-right">
            <div className="space-y-1 text-right flex-1 w-full">
              <h4 className="text-base font-black text-red-600 flex items-center gap-2 justify-start">
                <ShieldX className="w-5 h-5 text-red-500" />
                <span>{isRtl ? 'قائمة المستخدمين المحظورين والمجمدين 🚫' : 'Banned & Frozen Users Directory 🚫'}</span>
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {isRtl
                  ? 'هؤلاء المستخدمون لديهم حظر نشط في النظام. تم حظرهم من رؤية المويستات أو حجزها، ولكن يمكنهم تسجيل الدخول ومراسلة الدعم الفني لحل مشكلتهم.'
                  : 'These users are currently banned in the system. They are blocked from seeing or booking quests, but they can still log in and contact support for appeals.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {dbAllUsers.filter(u => u.isBanned).length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-gray-200 font-sans">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-black">
                  {isRtl ? 'رائع! لا يوجد مستخدمين محظورين حالياً.' : 'Splendid! There are no banned users currently.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dbAllUsers.filter(u => u.isBanned).map((user) => (
                  <div key={user.id} className="bg-slate-50 border border-red-150 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <img 
                        src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                        alt={user.name} 
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0 text-right">
                        <h5 className="text-xs font-black text-[#1F2A44] truncate">{user.name}</h5>
                        <p className="text-[10px] text-gray-500 truncate font-mono select-all">ID: {user.shortId || user.id}</p>
                        {user.email && <p className="text-[10px] text-gray-400 truncate font-semibold">{user.email}</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200/60 pt-2.5">
                      <button
                        type="button"
                        onClick={() => onBanUser(user.id, false)}
                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-black text-[10px] px-3.5 py-1.5 rounded-xl transition-all border-none cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'إلغاء الحظر (Pardon)' : 'Pardon (Unban)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchedUser(user)}
                        className="bg-slate-200 text-slate-700 hover:bg-slate-300 font-black text-[10px] px-3.5 py-1.5 rounded-xl transition-all border-none cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'عرض وتعديل التفاصيل' : 'View & Edit'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
    )}

      {activeAdminTab === 'support_and_moderation' && (
        <>
          {/* 🗂️ Support & Moderation Sub-Tabs */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-lg border border-gray-200/80 mb-4">
            <button
              type="button"
              onClick={() => setModerationSubTab('tickets')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                moderationSubTab === 'tickets'
                  ? 'bg-white text-[#1F2A44] shadow-sm font-black'
                  : 'text-gray-500 hover:text-[#1F2A44]'
              }`}
            >
              <span>{isRtl ? '📬 تذاكر الدعم' : 'Support Tickets'}</span>
              {supportTickets.filter(t => t.status !== 'resolved').length > 0 && (
                <span className="bg-rose-500 text-white font-black font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                  {supportTickets.filter(t => t.status !== 'resolved').length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setModerationSubTab('scam_shield')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                moderationSubTab === 'scam_shield'
                  ? 'bg-white text-[#1F2A44] shadow-sm font-black'
                  : 'text-gray-500 hover:text-[#1F2A44]'
              }`}
            >
              <span>{isRtl ? '🛡️ بلاغات الاحتيال' : 'Scam Shield'}</span>
              {quests.filter(q => q.flagsCount && q.flagsCount > 0).length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-black font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                  {quests.filter(q => q.flagsCount && q.flagsCount > 0).length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setModerationSubTab('broadcast_form')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                moderationSubTab === 'broadcast_form'
                  ? 'bg-white text-[#1F2A44] shadow-sm font-black'
                  : 'text-gray-500 hover:text-[#1F2A44]'
              }`}
            >
              <span>{isRtl ? '📣 البث العام' : 'System Broadcast'}</span>
            </button>
          </div>

          {moderationSubTab === 'broadcast_form' && (
            <>
              {/* Broadcast Urgent Broadcast system form */}
              <div className="bg-white border-2 border-[#FFD34D] rounded-3xl p-6 space-y-4 shadow-md font-sans">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <Megaphone className="w-5 h-5 text-amber-500" />
                  <div className="text-right">
                    <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
                      {lang === 'ar' ? '📣 إرسال بلاغ عاجل وتعميم لكافة المشغلين' : '📣 System-Wide Broadcast'}
                    </h4>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      {lang === 'ar' ? 'اكتب بلاغاً لإرساله وتعميمه إدارياً كإشعار منبثق فوري في واجهة كافة الصيادين' : 'Send a priority broadcast overlay notification directly to all active mobile devices.'}
                    </p>
                  </div>
                </div>
                <form onSubmit={handleBroadcastSubmit} className="space-y-3">
                  <textarea
                    required
                    rows={3}
                    placeholder={lang === 'ar' ? 'اكتب الرسالة العاجلة هنا...' : 'Type urgent announcement text here...'}
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-205 rounded-2xl text-xs font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FFD34D] resize-none"
                  />
                  <button
                    type="submit"
                    className="w-full bg-[#1F2A44] text-white hover:bg-slate-800 rounded-2xl text-xs py-3 font-black transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    {lang === 'ar' ? 'تعميم الإشعار العاجل السحابي ⚡' : 'Deploy Urgent Overlay Broadcast ⚡'}
                  </button>
                </form>
              </div>
            </>
          )}

          {moderationSubTab === 'scam_shield' && (
            <>
              {/* Flagged standard post removals section */}
              <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#FF3B7C]" />
          <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">Reports & Scam Shield Activity Queue</h4>
        </div>

        <div className="space-y-3">
          {quests.some(q => q.flagsCount && q.flagsCount > 0) ? (
            quests
              .filter(q => q.flagsCount && q.flagsCount > 0)
              .map((q) => (
                <div 
                  key={q.id} 
                  onClick={() => onInspectQuest?.(q.id)}
                  className="p-4 bg-red-50/50 hover:bg-red-50 hover:border-red-300 border border-red-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer transition-all active:scale-[0.99] group"
                >
                  <div className="space-y-0.5 text-right flex-1 select-none">
                    <span className="text-[8px] bg-[#FF3B7C] text-white px-2 py-0.5 rounded font-black uppercase inline-block">
                      {q.flagsCount} flags flagged
                    </span>
                    <h5 className="text-xs font-black text-[#1F2A44] leading-relaxed mt-1 flex items-center justify-start gap-1 flex-row-reverse">
                      <span>{q.title}</span>
                      <span className="text-[9px] text-gray-400 font-mono">({q.id})</span>
                    </h5>
                    <p className="text-[10px] text-gray-500 font-medium">{q.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onInspectQuest?.(q.id)}
                      className="bg-white hover:bg-slate-50 border border-gray-200 text-[#1F2A44] font-black text-[10px] px-3.5 py-2 rounded-xl text-center cursor-pointer transition-all active:scale-95 shadow-xs flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#1F2A44]" />
                      <span>{lang === 'ar' ? 'معاينة المنشور 👁️' : 'Inspect Post 👁️'}</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'quests', q.id), { flagsCount: 0, flaggers: [] });
                          showToast(lang === 'ar' ? '✅ تم تبرئة المنشور وإلغاء البلاغ بنجاح!' : '✅ Report dismissed & flags cleared successfully!');
                        } catch (err) {
                          console.error("Failed to dismiss report:", err);
                          showToast(lang === 'ar' ? '❌ فشل في إلغاء البلاغ' : '❌ Failed to dismiss report');
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-3.5 py-2 rounded-xl text-center cursor-pointer transition-all active:scale-95 shadow-sm border-none flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'إلغاء البلاغ' : 'Dismiss Report'}</span>
                    </button>
                    <button
                      onClick={() => onDeleteQuest(q.id)}
                      className="bg-[#FF3B7C] hover:bg-red-700 text-white font-extrabold text-[10px] px-3.5 py-2 rounded-xl text-center cursor-pointer transition-all active:scale-95 shadow-sm border-none"
                    >
                      Banished Proposal (Remove)
                    </button>
                  </div>
                </div>
              ))
          ) : (
            <p className="text-xs text-gray-400 text-center py-3 font-semibold">
              No reported scams or flags detected on the live Algeria feed today.
            </p>
          )}
        </div>
      </div>

      {/* Direct Quest/Post ID Inspection Search */}
      <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm font-sans mt-4" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="space-y-0.5 text-right flex-1">
            <h5 className="text-[11px] font-black text-[#1F2A44] flex items-center gap-1 justify-start">
              <span>{isRtl ? '🔍 معاينة منشور مباشر عبر المعرّف (ID)' : '🔍 Inspect Post Directly by ID'}</span>
            </h5>
            <p className="text-[9px] text-[#FF3B7C] font-semibold block">
              {isRtl ? 'أدخل معرّف الكويست للانتقال فوراً لصفحة التفاصيل والتحقق من المحتوى حيّاً' : 'Enter any Quest ID to view target content details instantly'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <input 
              type="text"
              id="direct-quest-inspect-id-tab"
              placeholder={isRtl ? 'مثال: QST-A39B...' : 'e.g. QST-A39B...'}
              className="px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-mono font-bold w-full sm:w-44 outline-none focus:border-[#1F2A44] focus:bg-white transition-all text-center"
            />
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('direct-quest-inspect-id-tab') as HTMLInputElement | null;
                const val = el?.value?.trim();
                if (val) {
                  onInspectQuest?.(val);
                } else {
                  showToast(isRtl ? 'الرجاء إدخال معرّف صالح' : 'Please provide a valid ID');
                }
              }}
              className="bg-[#1F2A44] hover:bg-[#111A2B] text-white font-extrabold text-[10px] px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-xs whitespace-nowrap"
            >
              {isRtl ? 'معاينة 👁️' : 'Inspect 👁️'}
            </button>
          </div>
        </div>
      </div>
    </>
    )}

    {moderationSubTab === 'tickets' && (
      <>
          {/* Support Ticketing Inbox Section */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm mt-6 font-sans">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#FF3B7C]" />
                <h4 className="font-extrabold text-[#1F2A44] text-xs uppercase tracking-wider">
                  {isRtl ? '📬 البريد الوارد للدعم الفني (Support Inbox)' : '📬 Support Inbox'}
                </h4>
              </div>
              <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                {supportTickets.length} {isRtl ? 'رسائل مرسلة' : 'Tickets'}
              </span>
            </div>

            <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
              {isLoadingSupport ? (
                <p className="text-xs text-gray-400 text-center py-6 font-semibold animate-pulse">
                  {isRtl ? 'جاري تحميل صندوق تذاكر الدعم...' : 'Loading support tickets inbox...'}
                </p>
              ) : supportTickets.length > 0 ? (
                supportTickets.map((t) => (
                  <div 
                    key={t.id} 
                    className={`p-4 rounded-2xl border transition-all ${
                      t.status === 'resolved' 
                        ? 'bg-emerald-50/20 border-emerald-100' 
                        : 'bg-slate-50/80 border-slate-150'
                    }`}
                    style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                  >
                    {/* Subject & Status Badge Row */}
                    <div className="flex justify-between items-center gap-2 flex-wrap mb-2">
                      <h5 className="text-xs font-black text-[#1F2A44] leading-relaxed flex items-center gap-1.5 justify-start">
                        <span className="w-2 h-2 rounded-full bg-[#FF3B7C]"></span>
                        <span className="font-black text-xs text-[#1F2A44]">{t.subject}</span>
                        <span className="text-[9px] text-gray-400 font-mono">({t.ticketId})</span>
                      </h5>
                      <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded ${
                        t.status === 'resolved' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.status === 'resolved' 
                          ? (isRtl ? '✅ تم الحل' : 'resolved') 
                          : (isRtl ? '⏳ معلّق' : 'pending')}
                      </span>
                    </div>

                    {/* Sender Identity Details */}
                    <div className="bg-slate-100/50 p-2.5 rounded-xl border border-slate-200/40 text-[10px] space-y-1 text-slate-600">
                      <div className="flex justify-between flex-wrap gap-x-3 gap-y-1 text-right">
                        <div className="text-right">
                          <span className="font-extrabold text-gray-500">{isRtl ? '👤 المرسل: ' : 'Sender: '}</span>
                          <strong className="text-[#1F2A44]">{t.userName}</strong>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-gray-500">{isRtl ? '📧 البريد الإلكتروني: ' : 'Email: '}</span>
                          <strong className="text-slate-700 font-mono select-all">{t.userEmail}</strong>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-gray-500">{isRtl ? '🆔 المعرّف (User ID): ' : 'User ID: '}</span>
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded text-gray-500 select-all border border-slate-100">{t.userId}</span>
                      </div>
                      <div className="text-[9px] text-gray-400 font-medium text-right">
                        {isRtl ? 'تاريخ الإرسال: ' : 'Submitted on: '}{new Date(t.createdAt).toLocaleString(isRtl ? 'ar' : 'en-US')}
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="text-xs text-gray-600 bg-white p-3.5 rounded-xl border border-gray-150 mt-3 whitespace-pre-wrap leading-relaxed select-text font-medium text-right font-sans">
                      {t.message}
                    </div>

                    {/* Chat History between User & Admin */}
                    {t.message && (
                      <div className="mt-4 p-3 bg-slate-100/50 rounded-2xl border border-slate-200/50 space-y-3">
                        <span className="text-[9px] text-[#1F2A44] font-black uppercase tracking-wider block border-b border-gray-200 pb-1.5">
                          💬 {isRtl ? 'سجل نقاش الدعم الفني المباشر' : 'Live Dialogue Log History'}
                        </span>
                        
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {/* Original Message */}
                          <div className="text-right">
                            <span className="text-[8px] text-gray-400 font-bold block mb-1">
                              👤 {t.userName} [{new Date(t.createdAt).toLocaleTimeString(isRtl ? 'ar' : 'en-US', {hour: '2-digit', minute:'2-digit'})}]:
                            </span>
                            <div className="inline-block bg-[#1F2A44] text-white text-xs p-2.5 rounded-2xl rounded-br-none font-medium max-w-[90%] text-right whitespace-pre-wrap">
                              {t.message}
                            </div>
                          </div>

                          {/* Alternating Replies thread */}
                          {t.replies && t.replies.map((reply: any, rIdx: number) => {
                            const isAdmin = reply.sender === 'admin';
                            return (
                              <div key={rIdx} className={isAdmin ? 'text-left' : 'text-right'}>
                                <span className="text-[8px] text-gray-400 font-bold block mb-1">
                                  {isAdmin ? '🛡️ الدعم الفني / الإشراف' : `👤 ${reply.senderName}`} [{new Date(reply.createdAt).toLocaleTimeString(isRtl ? 'ar' : 'en-US', {hour: '2-digit', minute:'2-digit'})}]:
                                </span>
                                <div className={`inline-block text-xs p-2.5 rounded-2xl font-medium max-w-[90%] text-right whitespace-pre-wrap ${
                                  isAdmin 
                                    ? 'bg-emerald-600 text-white rounded-bl-none' 
                                    : 'bg-white text-slate-800 border border-gray-150 rounded-br-none shadow-xs'
                                }`}>
                                  {reply.text}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Instant Reply Composer for Admin */}
                    {t.status !== 'resolved' && (
                      <div className="mt-3 bg-white p-3 rounded-xl border border-gray-200/80 space-y-2">
                        <div className="flex gap-2" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                          <input
                            type="text"
                            placeholder={isRtl ? 'اكتب ردك ومساعدتك للمستخدم هنا الفورية...' : 'Compose instant response...'}
                            value={adminReplyTexts[t.id] || ''}
                            onChange={(e) => setAdminReplyTexts({ ...adminReplyTexts, [t.id]: e.target.value })}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && (adminReplyTexts[t.id] || '').trim() && isReplyingTicketId !== t.id) {
                                const replyText = (adminReplyTexts[t.id] || '').trim();
                                if (!replyText) return;
                                setIsReplyingTicketId(t.id);
                                try {
                                  await updateDoc(doc(db, 'support_tickets', t.id), {
                                    replies: arrayUnion({
                                      sender: 'admin',
                                      senderName: 'الدعم الفني / الإشراف',
                                      text: replyText,
                                      createdAt: new Date().toISOString()
                                    }),
                                    status: 'pending'
                                  });
                                  setAdminReplyTexts({ ...adminReplyTexts, [t.id]: '' });
                                  showToast(isRtl ? '🎉 تم إرسال رد الدعم الفني بنجاح!' : '🎉 Response deployed successfully!');
                                } catch (err) {
                                  console.error(err);
                                  showToast(isRtl ? '❌ فشل إرسال الرد' : '❌ Failed to send reply');
                                } finally {
                                  setIsReplyingTicketId(null);
                                }
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-slate-800 transition-all text-right font-sans"
                          />
                          <button
                            type="button"
                            disabled={isReplyingTicketId === t.id || !(adminReplyTexts[t.id] || '').trim()}
                            onClick={async () => {
                              const replyText = (adminReplyTexts[t.id] || '').trim();
                              if (!replyText) return;
                              setIsReplyingTicketId(t.id);
                              try {
                                  await updateDoc(doc(db, 'support_tickets', t.id), {
                                    replies: arrayUnion({
                                      sender: 'admin',
                                      senderName: 'الدعم الفني / الإشراف',
                                      text: replyText,
                                      createdAt: new Date().toISOString()
                                    }),
                                    status: 'pending'
                                  });
                                  setAdminReplyTexts({ ...adminReplyTexts, [t.id]: '' });
                                  showToast(isRtl ? '🎉 تم إرسال رد الدعم الفني بنجاح!' : '🎉 Response deployed successfully!');
                              } catch (err) {
                                  console.error(err);
                                  showToast(isRtl ? '❌ فشل إرسال الرد' : '❌ Failed to send reply');
                              } finally {
                                  setIsReplyingTicketId(null);
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-40"
                          >
                            {isReplyingTicketId === t.id ? (isRtl ? 'جاري...' : 'Sending...') : (isRtl ? 'إرسال الرد ✉' : 'Send Reply ✉')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Operations & actions row */}
                    <div className="flex justify-end gap-2.5 mt-3 pt-2.5 border-t border-slate-200/50">
                      {t.status !== 'resolved' && (
                        <button
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'support_tickets', t.id), { status: 'resolved' });
                              showToast(isRtl ? '✅ تم وضع علامة كـ محلولة!' : '✅ Ticket marked as resolved!');
                            } catch (err) {
                              console.error("Failed to resolve ticket:", err);
                              showToast(isRtl ? '❌ فشل التحديث' : '❌ Failed to resolve ticket');
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] px-3 py-2 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1 border-none"
                        >
                          <Check className="w-3 h-3" />
                          <span>{isRtl ? 'تحديد كمحلولة ✅' : 'Resolve Ticket ✅'}</span>
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (window.confirm(isRtl ? '⚠️ هل تريد حذف رسالة الدعم هذه للأبد؟' : '⚠️ Are you sure you want to delete this ticket?')) {
                            setSupportTickets(prev => prev.filter(item => item.id !== t.id));
                            showToast(isRtl ? '🗑️ تم حذف تذكرة الدعم بنجاح' : '🗑️ Ticket deleted successfully!');
                            try {
                              await deleteDoc(doc(db, 'support_tickets', t.id));
                            } catch (err) {
                              console.warn("Firestore delete ticket warning:", err);
                            }
                          }
                        }}
                        className="bg-red-50 hover:bg-red-100 text-[#FF3B7C] font-black text-[9.5px] px-3 py-2 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1 border border-red-200 animate-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isRtl ? 'حذف تذكرة الدعم 🗑' : 'Delete Ticket 🗑'}</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 space-y-1.5 bg-slate-50 rounded-2xl border border-slate-150 font-sans">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold">
                    {isRtl ? 'لا توجد تذاكر دعم فني واردة في النظام حالياً.' : 'Your support inbox is clear. No tickets found.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
    )}

      {activeAdminTab === 'recharge_audit' && (
        <>
          <div className="bg-white border-2 border-[#FFD34D] rounded-3xl p-6 space-y-6 shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-100">
              <div className="space-y-1 text-right">
                <h4 className="text-base font-black text-[#1F2A44] flex items-center gap-2 justify-start">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                  <span>{isRtl ? 'تدقيق وفحص أرقام المعاملات ووصولات الدفع 🧾' : 'Transaction Proofs & Recharge Audits'}</span>
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {isRtl 
                    ? 'هذا القسم يتيح مراجعة عمليات شحن المحفظة المعالجة بالذكاء الاصطناعي وتجاوز القرارات الخاطئة (Override) في حال تم رفض معاملة صحيحة.'
                    : 'Review AI anti-fraud validations and manually override rejected or suspicious transaction receipts.'}
                </p>
              </div>
              <div className="flex bg-slate-50 border border-gray-200 p-1 rounded-xl gap-1 font-sans shrink-0">
                <span className="text-[10px] font-black text-slate-500 px-2 py-1 uppercase">{isRtl ? 'إجمالي المعاملات:' : 'Total Audited:'} {refillRequests.length}</span>
              </div>
            </div>

            <div className="space-y-4">
              {refillRequests.length > 0 ? (
                refillRequests.map((r) => (
                  <div key={r.id} className="p-5 bg-slate-50 border border-gray-150 rounded-2xl flex flex-col lg:flex-row gap-5 items-stretch relative overflow-hidden">
                    
                    {/* Status Badge Background Glow */}
                    <span className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-15 ${
                      r.status === 'approved' ? 'bg-emerald-500' : r.status === 'suspicious' ? 'bg-amber-500' : 'bg-rose-500'
                    }`}></span>

                    {/* Receipt Image Thumbnail or Placeholder */}
                    <div className="w-full lg:w-44 shrink-0 flex flex-col justify-center items-center bg-slate-100 rounded-xl relative border border-gray-200 p-2 overflow-hidden min-h-[140px]">
                      {(() => {
                        const rawReceipt = r.receiptImage || r.base64Image || r.receiptUrl || r.receipt_image || r.imageUrl;
                        const receiptImg = formatImageSrc(rawReceipt);
                        return receiptImg ? (
                          <div className="relative group w-full h-full cursor-zoom-in" onClick={() => setSelectedIdImageUrl(receiptImg)}>
                            <img 
                              src={receiptImg} 
                              alt="Transaction Receipt thumbnail" 
                              className="w-full h-28 object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-[#1F2A44]/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-lg">
                              <span className="text-[9px] text-white font-black bg-[#1F2A44] px-2 py-1 rounded shadow-md uppercase tracking-wider">{isRtl ? 'تكبير الصورة 🔍' : 'Zoom 🔍'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-4">
                            <Eye className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                            <span className="text-[9px] text-slate-400 font-extrabold block">{isRtl ? 'لا توجد صورة وصل مرفقة' : 'No Receipt Attached'}</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Transaction Details */}
                    <div className="flex-1 space-y-3.5 text-right flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              r.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'suspicious'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {r.status === 'approved' ? (isRtl ? 'مقبول ✅' : 'Approved') : r.status === 'suspicious' ? (isRtl ? 'مشبوه ⚠️' : 'Suspicious') : (isRtl ? 'مرفوض ❌' : 'Rejected')}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-gray-400 bg-white px-2 py-0.5 border border-gray-200 rounded">
                              {r.paymentMethod || 'CCP/CIB'}
                            </span>
                          </div>
                          
                          <div className="text-xs font-black text-slate-700">
                            {isRtl ? 'بتاريخ:' : 'Date:'} <span className="font-mono text-[11px] font-medium text-slate-600 bg-white px-1.5 py-0.5 rounded border border-gray-100">{r.date || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{isRtl ? 'المشغل (رقم الحساب / البريد):' : 'Operator ID / Email:'}</p>
                            <p className="font-mono text-[11px] font-black text-[#1F2A44] leading-none block break-all bg-white p-2 rounded-lg border border-gray-150">
                              {r.userEmail || r.userId}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{isRtl ? 'رقم المعاملة / رقم الوصل المرجعي:' : 'Reference Number:'}</p>
                            <p className="font-mono text-xs font-black text-[#FF3B7C] bg-white p-2 rounded-lg border border-gray-150 tracking-wider">
                              {r.referenceNumber || r.id}
                            </p>
                          </div>
                        </div>

                        <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/50 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                            <span className="font-mono text-[9px] text-[#FF3B7C]">{r.verifiedBy || 'AI Auditor'}</span>
                            <span className="uppercase">{isRtl ? 'نتيجة التدقيق والتحقق:' : 'Verification Reason:'}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-600 leading-relaxed text-right">
                            {r.reason || (isRtl ? 'لا يوجد تعليل مدون من المدقق.' : 'No audit details recorded.')}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 font-bold block uppercase">{isRtl ? 'رصيد العملية المستحَق:' : 'Recharge Amount:'}</span>
                          <span className="text-sm font-black font-mono text-[#1F2A44] block">
                            DZD {r.amount} DA
                          </span>
                        </div>

                        {refillPendingAction && refillPendingAction.id === r.id ? (
                          <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl flex items-center gap-3 w-full sm:w-auto justify-between text-right font-sans">
                            <span className="text-xs font-bold text-amber-900">
                              {refillPendingAction.action === 'approve' 
                                ? (isRtl ? '⚠️ تأكيد القبول والشحن؟' : '⚠️ Confirm Approval?')
                                : refillPendingAction.action === 'reject'
                                ? (isRtl ? '⚠️ تأكيد رفض الوصل؟' : '⚠️ Confirm Rejection?')
                                : (isRtl ? '⚠️ تأكيد حذف السجل نهائياً؟' : '⚠️ Confirm Permanent Delete?')}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  const act = refillPendingAction.action;
                                  if (act === 'approve') {
                                    await handleApproveRefill(r);
                                  } else if (act === 'reject') {
                                    await handleRejectRefill(r);
                                  } else if (act === 'delete') {
                                    setRefillRequests(prev => prev.filter(item => item.id !== r.id));
                                    showToast(isRtl ? '🗑️ تم الحذف بنجاح' : '🗑️ Record cleared successfully!');
                                    try {
                                      await deleteDoc(doc(db, 'refill_requests', r.id));
                                    } catch (err) {
                                      console.warn("Firestore delete refill record warning:", err);
                                    }
                                  }
                                  setRefillPendingAction(null);
                                }}
                                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded-lg cursor-pointer transition-all border-none"
                              >
                                {isRtl ? 'نعم، متأكد' : 'Yes, Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRefillPendingAction(null)}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-[10px] rounded-lg cursor-pointer transition-all border-none"
                              >
                                {isRtl ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2.5 w-full sm:w-auto">
                            {r.status !== 'approved' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefillPendingAction({ id: r.id, action: 'approve' });
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 border-none"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'قبول يدوياً وشحن الرصيد' : 'Approve & Credit'}</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-black flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                <Check className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'تم الشحن والاعتماد' : 'Credited & Confirmed'}</span>
                              </span>
                            )}

                            {r.status !== 'approved' && r.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefillPendingAction({ id: r.id, action: 'reject' });
                                }}
                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-[#FF3B7C] border border-rose-200 font-black text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'رفض الوصل ❌' : 'Reject Receipt ❌'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setRefillPendingAction({ id: r.id, action: 'delete' });
                              }}
                              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all active:scale-95 cursor-pointer border-none"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-gray-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-150 font-sans">
                  <CreditCard className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
                  <p className="text-xs font-black">
                    {isRtl ? 'لا توجد وصولات أو معاملات دفع مسجلة في قاعدة البيانات حالياً.' : 'Your payment ledger was clean. No transaction audits.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeAdminTab === 'broadcast' && (
        <>
          {/* Direct Quest/Post ID Inspection Search */}
          <div className="bg-white border border-gray-150 rounded-3xl p-5 space-y-4 shadow-sm font-sans mt-4" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="space-y-0.5 text-right flex-1">
                <h5 className="text-[11px] font-black text-[#1F2A44] flex items-center gap-1 justify-start">
                  <span>{isRtl ? '🔍 معاينة منشور مباشر عبر المعرّف (ID)' : '🔍 Inspect Post Directly by ID'}</span>
                </h5>
                <p className="text-[9px] text-[#FF3B7C] font-semibold block">
                  {isRtl ? 'أدخل معرّف الكويست للانتقال فوراً لصفحة التفاصيل والتحقق من المحتوى حيّاً' : 'Enter any Quest ID to view target content details instantly'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <input 
                  type="text"
                  id="direct-quest-inspect-id-tab"
                  placeholder={isRtl ? 'مثال: QST-A39B...' : 'e.g. QST-A39B...'}
                  className="px-3 py-2 bg-slate-50 border border-gray-200 rounded-xl text-xs font-mono font-bold w-full sm:w-44 outline-none focus:border-[#1F2A44] focus:bg-white transition-all text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('direct-quest-inspect-id-tab') as HTMLInputElement | null;
                    const val = el?.value?.trim();
                    if (val) {
                      onInspectQuest?.(val);
                    } else {
                      showToast(isRtl ? 'الرجاء إدخال معرّف صالح' : 'Please provide a valid ID');
                    }
                  }}
                  className="bg-[#1F2A44] hover:bg-[#111A2B] text-white font-extrabold text-[10px] px-4 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95 shadow-xs whitespace-nowrap"
                >
                  {isRtl ? 'معاينة 👁️' : 'Inspect 👁️'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeAdminTab === 'matchmaker' && (
        <div className="bg-white border-2 border-amber-400 rounded-3xl p-6 space-y-6 shadow-md" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-100 text-right">
            <div className="space-y-1 text-right flex-1 w-full">
              <h4 className="text-base font-black text-[#1F2A44] flex items-center gap-2 justify-start">
                <TrendingUp className="w-5 h-5 text-amber-500 animate-pulse" />
                <span>{isRtl ? 'خوارزمية المطابقة الموزونة ومضاعِف المبتدئين 🎯' : 'Weighted Matchmaking Engine & Newbie Boost'}</span>
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {isRtl
                  ? 'نموذج مطابقة متوافق مع متجر Google Play لعام 2026 لتوزيع عادل للمهام. الوزن: معدل الإتمام (40٪)، التقييم (30٪)، مضاعف دعم المبتدئين الجدد (30٪).'
                  : 'Fair job dispatch model matching 2026 Play Store guidelines. Weights: Completion Rate (40%), Stars (30%), +30 Points Newbie Boost (30%).'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-gray-200">
              <label className="block text-xs font-black text-[#1F2A44] mb-2 text-right">
                {isRtl ? 'اختر مهمة نشطة لتقييم المتقدمين:' : 'Select an Active Quest to Evaluate Applicants:'}
              </label>
              <select
                value={selectedQuestId}
                onChange={(e) => setSelectedQuestId(e.target.value)}
                className="w-full p-3 bg-white border border-gray-220 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">-- {isRtl ? 'اختر مَهمة من القائمة' : 'Select a Quest'} --</option>
                {quests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.cashReward} DA) - {isRtl ? `حالة: ${q.status}` : `Status: ${q.status}`}
                  </option>
                ))}
              </select>
            </div>

            {selectedQuestId ? (
              (() => {
                const quest = quests.find(q => q.id === selectedQuestId);
                if (!quest) return null;

                // Grab candidates: either the actual applicants, or all users for demo purposes if applicants list empty
                const hasApplicants = quest.applicants && quest.applicants.length > 0;
                const rawCandidates = hasApplicants 
                  ? dbAllUsers.filter(u => quest.applicants?.some(app => app.userId === u.id))
                  : dbAllUsers.slice(0, 8); // fallback: simulate on top 8 local operators

                // Map and apply the 2026 Weighted Matchmaking Formula
                const matchResult = rawCandidates.map((user) => {
                  // 1. Completion Rate Score (40% Weight)
                  // Assume 10 tasks completed gives maximum 100 points, mapped to 40 max points
                  const completedCount = user.questsCompleted || 0;
                  const completionScoreRaw = Math.min(100, completedCount * 10);
                  const completionScoreWeighted = completionScoreRaw * 0.40;

                  // 2. Rating Score (30% Weight)
                  // Mapped to 30 max points based on 5-star ratio
                  const ratingVal = user.rating || 5.0;
                  const ratingScoreWeighted = (ratingVal / 5.0) * 100 * 0.30;

                  // 3. Newbie Boost (30% Weight)
                  // Beginners with less than 3 quests completed are granted +30 points automatically to guarantee onboarding dispatch
                  const isNewbie = completedCount < 3;
                  const newbieBoostWeighted = isNewbie ? 30 : 0;

                  const totalScore = Math.min(100, Math.round(completionScoreWeighted + ratingScoreWeighted + newbieBoostWeighted));

                  return {
                    user,
                    completionScoreRaw,
                    completionScoreWeighted,
                    ratingVal,
                    ratingScoreWeighted,
                    isNewbie,
                    newbieBoostWeighted,
                    totalScore
                  };
                }).sort((a, b) => b.totalScore - a.totalScore); // Sort descending by matchmaking score

                return (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md font-black">
                        {hasApplicants ? (isRtl ? 'طلبات حقيقية حيّة' : 'Live Applicants') : (isRtl ? 'محاكاة اختبارية تماثلية' : 'Testbed Simulation')}
                      </span>
                      <h5 className="text-[11px] font-black text-amber-800">
                        {isRtl ? `نتائج المطابقة للمهمة: "${quest.title}"` : `Match Scores for: "${quest.title}"`}
                      </h5>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5 text-right" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
                      {matchResult.map(({ user, completionScoreWeighted, ratingVal, ratingScoreWeighted, isNewbie, totalScore }) => (
                        <div key={user.id} className="p-4 bg-slate-50 border border-gray-150 rounded-2xl flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 relative overflow-hidden text-right leading-relaxed">
                          {/* Top Score Ribbon */}
                          <div className="absolute top-0 left-0 bg-amber-400 text-slate-950 font-black font-mono text-[10px] px-3 py-1 rounded-br-xl shadow-xs">
                            {totalScore} pts
                          </div>

                          <div className="text-right space-y-1.5 pt-2 sm:pt-0">
                            <span className="text-xs font-black text-slate-800 block">
                              {user.name} ({user.shortId || 'QST-USER'})
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 justify-start flex-wrap">
                              <span className="text-[9.5px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-md font-extrabold font-mono">
                                {isRtl ? `أكمل ${user.questsCompleted || 0} مهام` : `${user.questsCompleted || 0} tasks`}
                              </span>
                              <span className="text-[9.5px] bg-yellow-50 text-yellow-600 border border-yellow-200 px-2 py-0.5 rounded-md font-black">
                                ⭐ {ratingVal.toFixed(1)}
                              </span>
                              {isNewbie && (
                                <span className="text-[9px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-md animate-pulse">
                                  {isRtl ? '🚀 دعم المبتدئين نشط (+30)' : '🚀 Newbie Boost (+30)'}
                                </span>
                              )}
                              {user.idVerificationStatus === 'verified' && (
                                <span className="text-[9px] bg-blue-500 text-white font-extrabold px-1.5 py-0.5 rounded-md">
                                  ✓ KYC Verified
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Scores breakdown column */}
                          <div className="flex flex-col text-right justify-center space-y-1 bg-white p-3 rounded-xl border border-gray-150 min-w-[200px]">
                            <div className="flex justify-between items-center text-[9px] text-gray-500">
                              <span className="font-mono font-bold">({completionScoreWeighted.toFixed(0)}/40)</span>
                              <span className="font-semibold">{isRtl ? 'نسبة الإنجاز (40٪):' : 'Completion Rate (40%):'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-gray-500">
                              <span className="font-mono font-bold">({ratingScoreWeighted.toFixed(0)}/30)</span>
                              <span className="font-semibold">{isRtl ? 'التقييم بالنجوم (30٪):' : 'Stars Ratio (30%):'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-gray-500">
                              <span className={`font-mono font-bold ${isNewbie ? 'text-emerald-500 font-black' : ''}`}>
                                ({isNewbie ? 30 : 0}/30)
                              </span>
                              <span className="font-semibold">{isRtl ? 'دعم المبتدئين (30٪):' : 'Onboarding Boost (30%):'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-8 text-center text-gray-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-gray-200 font-sans">
                <TrendingUp className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-black">
                  {isRtl ? 'يرجى اختيار مَهمة من القائمة أعلاه لتجربة خوارزمية المطابقة الموزونة.' : 'Choose a dynamic Quest from the dropdown selector to test custom matchmaking.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
