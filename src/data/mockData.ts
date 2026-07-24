import { Quest, Leader, Challenge, Badge, UserProfile, WalletTransaction, HunterReview, GodfatherReview } from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'user-current',
  name: 'ياسين بلقاسم',
  phone: '0555123456',
  city: 'الجزائر العاصمة (Algiers)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  questsCompleted: 4,
  questsCreated: 1,
  totalPoints: 620,
  tokenBalance: 500, // Starting baseline unverified balance
  rating: 4.9,
  level: 2,
  idVerificationStatus: 'unverified', // Starts as unverified so user can test the KYC upload flow!
  kycRewardClaimed: false,
  completedQuestsIds: ['q-comp-1'],
  createdQuestsIds: ['q-created-1'],
  unlockedBadgeIds: ['badge-welcome'],
  language: 'ar',
  enableNotifications: true,
  privacyEnabled: false,
  audioEffectsEnabled: true,
  hapticFeedbackEnabled: true,
  isAdmin: true,
};

export const INITIAL_WALLET_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'tx-onboarding',
    type: 'onboarding_bonus',
    amount: 500,
    timestamp: '2026-06-08 10:00',
    referenceId: 'REF-213-999120',
  }
];

export const MOCK_STORIES: any[] = [];

export const INITIAL_QUESTS: Quest[] = [];

export const INITIAL_LEADERS: Leader[] = [];

export const INITIAL_CHALLENGES: Challenge[] = [
  // --- 7 Daily Bonus Tasks (refresh every 24 hours, supportive bonuses) ---
  {
    id: 'daily-1',
    title: { ar: 'كابتن الصباح الباكر ☀️', fr: 'Lève-tôt ☀️', en: 'Early Bird Captain ☀️' },
    description: {
      ar: 'أكمل كويست واحد قبل منتصف الظهر للحصول على مكافأة إضافية.',
      fr: 'Complétez 1 quête avant midi pour obtenir un bonus.',
      en: 'Complete 1 quest before 12:00 PM to earn an extra challenge bonus.'
    },
    pointsReward: 30,
    targetCount: 1,
    currentCount: 0,
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'complete',
    cadence: 'daily'
  } as any,
  {
    id: 'daily-2',
    title: { ar: 'كشّاف الرادار 📡', fr: 'Éclaireur Radar 📡', en: 'Radar Scout 📡' },
    description: {
      ar: 'امسح رادار الصيادين ٣ مرات لاستعراض الفرص وتحديث خريطتك الحية.',
      fr: 'Scannez le radar 3 fois pour actualiser votre carte en direct.',
      en: 'Scan the hunter radar 3 times to find new community opportunities.'
    },
    pointsReward: 15,
    targetCount: 3,
    currentCount: 1, // Start with some progress
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'complete',
    cadence: 'daily'
  } as any,
  {
    id: 'daily-3',
    title: { ar: 'صاحب الفرص المعطاء 🎁', fr: 'Hôte Généreux 🎁', en: 'Generous Host 🎁' },
    description: {
      ar: 'انشر كويست أو فرصة مساعدة جديدة لجيرانك في مدينتك.',
      fr: 'Publiez une quête d\'aide pour vos voisins.',
      en: 'Publish a new help quest or gig for your local neighbors.'
    },
    pointsReward: 40,
    targetCount: 1,
    currentCount: 0,
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'create',
    cadence: 'daily'
  } as any,
  {
    id: 'daily-4',
    title: { ar: 'الدردشة الحية النشطة 💬', fr: 'Fil de Discussion 💬', en: 'Active Dialogue 💬' },
    description: {
      ar: 'أرسل ٣ رسائل في المحادثة لتنسيق مهامك الجارية مع العميل.',
      fr: 'Envoyez 3 messages pour coordonner vos quêtes actives.',
      en: 'Send 3 chat messages on active listings to coordinate tasks.'
    },
    pointsReward: 20,
    targetCount: 3,
    currentCount: 0,
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'complete',
    cadence: 'daily'
  } as any,
  {
    id: 'daily-5',
    title: { ar: 'خطوة التحقق الأمنية 🛡️', fr: 'Sûreté Initiale 🛡️', en: 'Security First step 🛡️' },
    description: {
      ar: 'قم برفع مستندات التحقق KYC الخاصة بك لترقية ملفك الشخصي.',
      fr: 'Soumettez vos infos KYC pour vérifier votre compte.',
      en: 'Submit your KYC verification details for high safety rating.'
    },
    pointsReward: 50,
    targetCount: 1,
    currentCount: 0,
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'points',
    cadence: 'daily'
  } as any,
  {
    id: 'daily-6',
    title: { ar: 'درع النقاء اليومي 🧼', fr: 'Défenseur Propre 🧼', en: 'Daily Clean Shield 🧼' },
    description: {
      ar: 'حافظ على ملف خالي من البلاغات أو شكاوي الاحتيال طوال اليوم.',
      fr: 'Zéro signalement ou litige durant toute la journée.',
      en: 'Keep your account completely clear of scam shields or alerts today.'
    },
    pointsReward: 25,
    targetCount: 1,
    currentCount: 1, // Completed by default if clean
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'complete',
    cadence: 'daily'
  } as any,
  {
    id: 'daily-7',
    title: { ar: 'مساعد كبار الجيران 🤝', fr: 'Aide-Sénior 🤝', en: 'Elder Helper 🤝' },
    description: {
      ar: 'اقبل أو أكمل كويست من فئة المساعدة المنزلية أو رعاية الجيران.',
      fr: 'Aidez un voisin pour des tâches ménagères ou de courses.',
      en: 'Take or complete 1 home help or neighborhood assistance task.'
    },
    pointsReward: 45,
    targetCount: 1,
    currentCount: 0,
    timeLeft: { ar: 'متبقي ٢٤ ساعة', fr: '24 heures restantes', en: '24 hours left' },
    type: 'repair',
    cadence: 'daily'
  } as any,

  // --- 7 Weekly Bonus Tasks (refreshes every 7 days) ---
  {
    id: 'weekly-1',
    title: { ar: 'حامي الحي المغوار 📍', fr: 'Gardien du Quartier 📍', en: 'Neighborhood Guardian 📍' },
    description: {
      ar: 'أكمل ٥ كويستات قريبة ضمن محيطك الجغرافي هذا الأسبوع.',
      fr: 'Complétez 5 quêtes locales près de chez vous cette semaine.',
      en: 'Complete 5 quests situated within your local neighborhood.'
    },
    pointsReward: 100,
    targetCount: 5,
    currentCount: 1,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'complete',
    cadence: 'weekly'
  } as any,
  {
    id: 'weekly-2',
    title: { ar: 'الالتزام الكامل ١٠٠٪ 💯', fr: 'Zéro Échec 💯', en: '100% Commitment 💯' },
    description: {
      ar: 'أنجز ٣ عقود بنسبة نجاح كاملة بدون أي إلغاء أو نزاع تجاري.',
      fr: 'Terminez 3 quêtes d\'affilée sans aucune annulation.',
      en: 'Deliver 3 booked tasks in a row with zero cancellations or disputes.'
    },
    pointsReward: 120,
    targetCount: 3,
    currentCount: 0,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'complete',
    cadence: 'weekly'
  } as any,
  {
    id: 'weekly-3',
    title: { ar: 'المستثمر المحنك 🪙', fr: 'Investisseur Elite 🪙', en: 'Master Token Spender 🪙' },
    description: {
      ar: 'قم بخصم أو حجز ما مجموعه ١٥٠ رمز مميز في تعهدات العقود الأسبوعية.',
      fr: 'Dépensez 150 Tokens dans les frais d\'engagement de quêtes.',
      en: 'Burn or dedicate 150 total tokens in active quest assignments.'
    },
    pointsReward: 110,
    targetCount: 150,
    currentCount: 40,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'points',
    cadence: 'weekly'
  } as any,
  {
    id: 'weekly-4',
    title: { ar: 'جامع النخبة للأمجاد ⚡', fr: 'Accumulateur d\'XP ⚡', en: 'Elite XP Accumulator ⚡' },
    description: {
      ar: 'اجمع ما لا يقل عن ٥٠٠ نقطة شرفية (XP) من المهام هذا الأسبوع.',
      fr: 'Accumulez plus de 500 points d\'expérience ce cycle.',
      en: 'Amass more than 500 points of dynamically converted XP.'
    },
    pointsReward: 130,
    targetCount: 500,
    currentCount: 120,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'points',
    cadence: 'weekly'
  } as any,
  {
    id: 'weekly-5',
    title: { ar: 'مقيم ومراجع النظراء ⭐', fr: 'Critique Équitable ⭐', en: 'Fair Peer Reviewer ⭐' },
    description: {
      ar: 'ضع تقييماً صادقاً ومكتملاً لـ ٣ صيادين أو عملاء تعاملت معهم ميدانياً.',
      fr: 'Attribuez 3 évaluations complètes à des coursiers ou clients.',
      en: 'Post 3 authentic, high-quality feedback reviews on completed tasks.'
    },
    pointsReward: 90,
    targetCount: 3,
    currentCount: 1,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'complete',
    cadence: 'weekly'
  } as any,
  {
    id: 'weekly-6',
    title: { ar: 'صاحب الخمس النجمات الخالدة 🌟', fr: 'Sceau d\'Étoile 🌟', en: 'Five-Star Legend Streak 🌟' },
    description: {
      ar: 'حقق تقييماً مثالياً بـ ٥ نجوم لـ ٣ عقود متتالية كـ رانر موثوق.',
      fr: 'Obtenez 3 notes parfaites de 5.0 d\'affilée.',
      en: 'Earn a flawless 5.0 customer rating on 3 consecutive jobs.'
    },
    pointsReward: 140,
    targetCount: 3,
    currentCount: 0,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'complete',
    cadence: 'weekly'
  } as any,
  {
    id: 'weekly-7',
    title: { ar: 'المتطوع المجتمعي المعطاء 🤝', fr: 'Pilier Communautaire 🤝', en: 'Community Pillar Activist 🤝' },
    description: {
      ar: 'أكمل مهمة واحدة مصنفة لخدمة المجتمع أو الصيانة العامة للمرافق.',
      fr: 'Accomplissez une mission de service public ou d\'intérêt collectif.',
      en: 'Complete 1 public interest, education, or community service chore.'
    },
    pointsReward: 150,
    targetCount: 1,
    currentCount: 0,
    timeLeft: { ar: 'باقي يومان', fr: '2 jours restants', en: '2 days left' },
    type: 'repair',
    cadence: 'weekly'
  } as any
];

export const INITIAL_BADGES: Badge[] = [
  // --- BRONZE TIERS (1-20): Onboarding & Basics ---
  { id: 'b1', name: 'أهلاً بك في كويست', title: 'أهلاً بك في كويست', tier: 'BRONZE', description: 'انضممت رسمياً كشاب باحث ومحب للمغامرات المجتمعية.', requirement: 'تسجيل الحساب بنجاح', iconName: 'UserCheck', unlocked: true },
  { id: 'b2', name: 'المبادر الأول', title: 'المبادر الأول', tier: 'BRONZE', description: 'أكملت مهمتك الفرعية الأولى في حيك السكني.', requirement: 'إتمام كويست 1', iconName: 'Compass', unlocked: false },
  { id: 'b3', name: 'بطل الحي المحنك', title: 'بطل الحي المحنك', tier: 'BRONZE', description: 'ساعدت أهالي منطقتك وأنجزت 5 مهام كاملة وناجحة.', requirement: 'إتمام 5 كويستات', iconName: 'Trophy', unlocked: false },
  { id: 'b4', name: 'العبقري التقني', title: 'العبقري التقني', tier: 'BRONZE', description: 'أتقنت وحللت 3 مهام متعلقة بالتكنولوجيا والإنترنت.', requirement: '3 كويستات تقنية', iconName: 'Award', unlocked: false },
  { id: 'b5', name: 'المنقذ السريع الصاعق', title: 'المنقذ السريع الصاعق', tier: 'BRONZE', description: 'أتممت مهمة مستعجلة جداً في وقت قياسي.', requirement: 'إتمام كويست عاجل', iconName: 'Zap', unlocked: false },
  { id: 'b6', name: 'المستكشف الجغرافي', title: 'المستكشف الجغرافي', tier: 'BRONZE', description: 'استخدمت مسح الرادار لتفقد الكويستات القريبة.', requirement: 'مسح الرادار 5 مرات', iconName: 'Compass', unlocked: false },
  { id: 'b7', name: 'الملف الذهبي', title: 'الملف الذهبي', tier: 'BRONZE', description: 'أكملت كتابة سيرتك الذاتية ورفعت صورتك الشخصية.', requirement: 'تحديث بيانات الملف 100%', iconName: 'UserCheck', unlocked: false },
  { id: 'b8', name: 'العراب الجديد', title: 'العراب الجديد', tier: 'BRONZE', description: 'قمت بنشر أول طلب عمل (كويست) خاص بك كصاحب عمل.', requirement: 'نشر كويست 1', iconName: 'UserCheck', unlocked: false },
  { id: 'b9', name: 'المتفاوض الدبلوماسي', title: 'المتفاوض الدبلوماسي', tier: 'BRONZE', description: 'أرسلت أول عرض حجز رسمي على كويست معلق.', requirement: 'تقديم 3 عروض حجز', iconName: 'UserCheck', unlocked: false },
  { id: 'b10', name: 'الملتزم اليومي', title: 'الملتزم اليومي', tier: 'BRONZE', description: 'سجلت حضورك اليومي لمدة 3 أيام متتالية في التطبيق.', requirement: 'سلسلة حضور 3 أيام', iconName: 'Award', unlocked: false },
  ...Array.from({length: 10}, (_, i) => ({
    id: `b${i+11}`,
    name: `مستكشف المحيط الفئة ${i+1}`,
    title: `مستكشف المحيط الفئة ${i+1}`,
    tier: 'BRONZE' as const,
    description: `أثبت حضورك الميداني المستمر في منطقتك.`,
    requirement: `إتمام ${i+6} مهام منوعة`,
    iconName: 'Compass',
    unlocked: false
  })),

  // --- SILVER TIERS (21-35): Consistency & Level Ups ---
  ...Array.from({length: 15}, (_, i) => ({
    id: `s${i+21}`,
    name: `نجم العطاء الفضي رتبة ${i+1}`,
    title: `نجم العطاء الفضي رتبة ${i+1}`,
    tier: 'SILVER' as const,
    description: `الحفاظ على أداء ثابت وموثوق لدى أصحاب العمل كرانر محترف.`,
    requirement: `تجميع ${200 + (i*100)} XP والحفاظ على تقييم 4.5+`,
    iconName: 'Award',
    unlocked: false
  })),

  // --- GOLD TIERS (36-45): Elite Field Actions ---
  ...Array.from({length: 10}, (_, i) => ({
    id: `g${36+i}`,
    name: `حارس كويست الذهبي ${i+1}`,
    title: `حارس كويست الذهبي ${i+1}`,
    tier: 'GOLD' as const,
    description: `تنفيذ أصعب المهام العاجلة والميدانية بدقة متناهية دون إلغاءات.`,
    requirement: `إتمام ${20 + (i*5)} كويست عاجل وبمعدل نجاح 100%`,
    iconName: 'Trophy',
    unlocked: false
  })),

  // --- RUBY TIERS (46-50): Ultra-Rare Ultimate Milestones (0.1% Only) ---
  { id: 'r46', name: 'الأسطورة المطلقة (The Legend)', title: 'الأسطورة المطلقة (The Legend)', tier: 'RUBY', description: 'بلغت القمة المستحيلة وحققت أعلى معدل إنجاز في تاريخ المنصة.', requirement: 'إتمام 500 كويست موثق بالكامل', iconName: 'Trophy', unlocked: false },
  { id: 'r47', name: 'حارس المدينة المخلص', title: 'حارس المدينة المخلص', tier: 'RUBY', description: 'أمنت وحللت 100 كويست ميداني متتالي بتقييم 5.0 نجوم كاملة.', requirement: '100 تقييم كامل متتالي', iconName: 'Award', unlocked: false },
  { id: 'r48', name: 'عاهل الرموز والتوكنز', title: 'عاهل الرموز والتوكنز', tier: 'RUBY', description: 'قمت بحرق واستهلاك آلاف التوكنز في حجز وإتمام عقود حية.', requirement: 'حرق 5,000 توكنز تراكمياً', iconName: 'Sparkles', unlocked: false },
  { id: 'r49', name: 'المنقذ الميداني الخارق', title: 'المنقذ الميداني الخارق', tier: 'RUBY', description: 'أنهيت 50 كويست مصنف "حرج جداً ومستعجل" بنجاح متناهي.', requirement: 'إتمام 50 كويست حرج جداً', iconName: 'Zap', unlocked: false },
  { id: 'r50', name: 'النخبة الصفوة (The Elite)', title: 'النخبة الصفوة (The Elite)', tier: 'RUBY', description: 'الشارة التعجيزية الكبرى للوصول للمستوى الأقصى وتصدر قائمة المتصدرين بشكل دائم.', requirement: 'الوصول للمستوى 50 وحصد 10,000 XP', iconName: 'Trophy', unlocked: false }
];

export const OLD_INITIAL_BADGES: Badge[] = [
  // --- TIER 1: BRONZE BADGES (20 Easy Badges - onboarding & basic actions) ---
  {
    id: 'bronze-1',
    title: { ar: 'مرحباً بك في كويست الجزائر 🇩🇿', fr: 'Bienvenue sur Quest 🇩🇿', en: 'Welcome to Quest Dz 🇩🇿' },
    description: { ar: 'انضممت وبادرت بإنشاء حسابك وتأشير رقمك الجزائري.', fr: 'Création validée sur le réseau d\'entraide.', en: 'First account creation completed with verified mobile contact.' },
    iconName: 'UserCheck', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-2',
    title: { ar: 'مستكشف الخرائط الحية 🗺️', fr: 'Géolocalisé 🗺️', en: 'Live Navigator 🗺️' },
    description: { ar: 'قمت بتفعيل مستشعر الـ GPS واستعراض الكويستات على الخريطة.', fr: 'Système GPS connecté pour le guidage.', en: 'Triggered mobile GPS location tracking to reveal nearby jobs.' },
    iconName: 'Compass', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-3',
    title: { ar: 'الصياد المستجد 🔍', fr: 'Jeune Recrue 🔍', en: 'Novice Hunter 🔍' },
    description: { ar: 'قمت بالبحث عن أول كويست تبريدي في محيطك لأول مرة.', fr: 'Première recherche sur le radar de tâches.', en: 'Flashed search query filters on the regional community feed.' },
    iconName: 'Search', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-4',
    title: { ar: 'الملف الأنيق البهي 👤', fr: 'Profil Soigné 👤', en: 'Polished Profile 👤' },
    description: { ar: 'رفعت صورتك الشخصية وكتبت نبذة تعريفية لتوثيق ملفك.', fr: 'Détails du compte complétés avec photo.', en: 'Uploaded a custom profile photo and detailed your workspace bio.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Bronze', pointsCost: 30
  },
  {
    id: 'bronze-5',
    title: { ar: 'أولى خطوات الرانر 🏃', fr: 'Premier Pas 🏃', en: 'First Courier Stride 🏃' },
    description: { ar: 'قدمت عرض حجز أول لكويست على جدول الأعمال.', fr: 'Candidature soumise sur un contrat régional.', en: 'Placed your first booking offer on an active local gig.' },
    iconName: 'Zap', unlocked: false, tier: 'Bronze', pointsCost: 40
  },
  {
    id: 'bronze-6',
    title: { ar: 'راصد النخبة والرواد 📊', fr: 'Observateur Majeur 📊', en: 'Leaderboard Spectator 📊' },
    description: { ar: 'تفقدت قائمة المتصدرين للاطلاع على نقاط ورواد نقابة الصيادين.', fr: 'Consultation du classement des meilleurs.', en: 'Opened the leaderboard of honor to look at the elite runners.' },
    iconName: 'Trophy', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-7',
    title: { ar: 'أولى الرسائل التنسيقية 💬', fr: 'Échange Convivial 💬', en: 'First Coordinator Chat 💬' },
    description: { ar: 'افتتحت قناة دردشة حية لتنسيق تفاصيل الموعد مع العميل.', fr: 'Lancement d\'une boîte de conversation privée.', en: 'Initiated a sync discussion room with your local employer.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Bronze', pointsCost: 35
  },
  {
    id: 'bronze-8',
    title: { ar: 'حارس المحفظة الرقمية 🪙', fr: 'Gardien de Solde 🪙', en: 'Token Wallet Guard 🪙' },
    description: { ar: 'اطّلعت على كشف الحساب وتوزيع رصيد التوكنز الترحيبي.', fr: 'Vérification du solde de jetons de réserve.', en: 'Opened your wallet transaction history ledger for the first time.' },
    iconName: 'Sparkles', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-9',
    title: { ar: 'راية البداية المباركة 🏁', fr: 'Lancement Réussi 🏁', en: 'Blessed Start 🏁' },
    description: { ar: 'شاركت في حل وإتمام الكويست الميداني الأول لك بنجاح.', fr: 'Une quête accomplie sur le terrain.', en: 'Successfully completed your very first verified work assignment.' },
    iconName: 'CheckCircle', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-10',
    title: { ar: 'صوت التقييم البنّاء 🌟', fr: 'Critique Utile 🌟', en: 'Constructive Critique 🌟' },
    description: { ar: 'منحت نجمات تقييم عادلة لعميل بعد إكمال العمل.', fr: 'Attribution d\'une première note étoilée.', en: 'Wrote your first mutual review on an employer profile.' },
    iconName: 'Sparkles', unlocked: false, tier: 'Bronze', pointsCost: 45
  },
  {
    id: 'bronze-11',
    title: { ar: 'سمع ورؤية الإشعارات 🔔', fr: 'Actif Alertes 🔔', en: 'Alert Inbound 🔔' },
    description: { ar: 'قمت بتمكين وتفعيل إشعارات الكابستور للجوال والويب.', fr: 'Notifications mobiles activées avec succès.', en: 'Enabled real-time push alert notification permissions.' },
    iconName: 'Zap', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-12',
    title: { ar: 'مستمع هادئ الرنين 🎵', fr: 'Fidèle Audio 🎵', en: 'Acoustic Ear 🎵' },
    description: { ar: 'أبقيت على المؤثرات الصوتية والاهتزازات الهارمونية نشطة.', fr: 'Bruitages haptiques activés.', en: 'Confirmed immersive UI audio effects and haptics are active.' },
    iconName: 'Sparkles', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-13',
    title: { ar: 'درع خصوصية البيانات 🔒', fr: 'Secret Privé 🔒', en: 'Privacy Vault 🔒' },
    description: { ar: 'عدلت تفضيلات الخصوصية لحماية موقعك الدقيق وقت الفراغ.', fr: 'Mode de protection invisible configuré.', en: 'Configured data stealth toggles inside your account console.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Bronze', pointsCost: 50
  },
  {
    id: 'bronze-14',
    title: { ar: 'طالب العلم التقني 📚', fr: 'Étudiant Tech 📚', en: 'Smart Learner 📚' },
    description: { ar: 'تصفحت فئة التعليم ودروس التقنية لحل كويست أكاديمي.', fr: 'Consultation des modules d\'étude.', en: 'Opened the education & tutoring directory category lists.' },
    iconName: 'Compass', unlocked: false, tier: 'Bronze', pointsCost: 40
  },
  {
    id: 'bronze-15',
    title: { ar: 'مستودع الصور واللقطات 📸', fr: 'Preuve Visuelle 📸', en: 'Photo Submitter 📸' },
    description: { ar: 'أرفقت أول إثبات تسليم بالصور عبر كاميرا التطبيق.', fr: 'Upload de capture d\'écran d\'évaluation.', en: 'Took or uploaded your first field verification work snapshot.' },
    iconName: 'CheckCircle', unlocked: false, tier: 'Bronze', pointsCost: 55
  },
  {
    id: 'bronze-16',
    title: { ar: 'الأمين المنضبط ⚖️', fr: 'Dévoué Honnête ⚖️', en: 'Sincere Hand ⚖️' },
    description: { ar: 'وافقت على ميثاق نقابة وصيادي كويست الجزائر التبريدي.', fr: 'Code d\'honneur de la guilde validé.', en: 'Read and accepted the local Runner community code of conduct.' },
    iconName: 'UserCheck', unlocked: true, tier: 'Bronze'
  },
  {
    id: 'bronze-17',
    title: { ar: 'الرادار المتيقظ 📡', fr: 'Radar Allumé 📡', en: 'Active Scan Monitor 📡' },
    description: { ar: 'نقرت مسح الرادار لتحديث خريطة الإحداثيات مرتين.', fr: 'Vérification bimensuelle de position.', en: 'Completed two consecutive geo-radar sweeps sequentially.' },
    iconName: 'Compass', unlocked: false, tier: 'Bronze', pointsCost: 40
  },
  {
    id: 'bronze-18',
    title: { ar: 'كريم التنازل الأخلاقي 🕊️', fr: 'Accord Amiable 🕊️', en: 'Peace Ambassador 🕊️' },
    description: { ar: 'قمت بسحب عرض أو الاتفاق ودياً دون إثارة خلاف.', fr: 'Retrait d\'offre sans aucun problème.', en: 'Withdrew a pending application or bid without friction.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Bronze', pointsCost: 45
  },
  {
    id: 'bronze-19',
    title: { ar: 'صديق الحيوان الأليف 🐾', fr: 'Ami des Bêtes 🐾', en: 'Pet Companion 🐾' },
    description: { ar: 'استكشفت كويستات فئة رعاية الأليفة الميدانية وجلبت غنائمها.', fr: 'Exploration de la catégorie animaux.', en: 'Inspected the regional pet care task requests page.' },
    iconName: 'Compass', unlocked: false, tier: 'Bronze', pointsCost: 35
  },
  {
    id: 'bronze-20',
    title: { ar: 'الترقية الصاعدة للأعلى 📈', fr: 'Éveil de Niveau 📈', en: 'Rookie Ascendant 📈' },
    description: { ar: 'جمعت أول 300 نقطة كخطوة نحو الترقية الرتبوية.', fr: '300 points glanés sur Quest.', en: 'Climbed your way up to 300 points of dynamically earned XP.' },
    iconName: 'TrendingUp', unlocked: false, tier: 'Bronze', pointsCost: 60
  },

  // --- TIER 2: SILVER BADGES (15 Medium Badges - milestones & consistent efforts) ---
  {
    id: 'silver-1',
    title: { ar: 'صائد المشاوير العشري 🏆', fr: 'Coureur Décennal 🏆', en: 'Diligence Ten 🏆' },
    description: { ar: 'أكملت ١٠ مهام كويست معتمدة لخدمة ورعاية المجتمع.', fr: '10 travaux validés à votre actif.', en: 'Completed 10 certified physical quests successfully.' },
    iconName: 'Trophy', unlocked: false, tier: 'Silver', pointsCost: 150
  },
  {
    id: 'silver-2',
    title: { ar: 'حاصد نجوم التقييم ⭐', fr: 'Étoilé Brillant ⭐', en: 'Stellar Operator ⭐' },
    description: { ar: 'حافظت على تقييم 4.5+ نجوم عبر 5 عقود نشطة متتالية.', fr: 'Score de 4.5+ sur 5 prestations.', en: 'Maintained a high 4.5+ star review rating over 5 finished jobs.' },
    iconName: 'Sparkles', unlocked: false, tier: 'Silver', pointsCost: 160
  },
  {
    id: 'silver-3',
    title: { ar: 'البرق الفضي اللامع ⚡', fr: 'Foudre d\'Argent ⚡', en: 'Silver Speedster ⚡' },
    description: { ar: 'أغلقت ونفذت كويست معلّم كونه مستعجل في أقل من ساعة.', fr: 'Livraison express réussie en moins d\'une heure.', en: 'Completed an urgent category quest in under 60 minutes flat.' },
    iconName: 'Zap', unlocked: false, tier: 'Silver', pointsCost: 170
  },
  {
    id: 'silver-4',
    title: { ar: 'ثبات المستوى المتميز 🥈', fr: 'Force Niveau 2 🥈', en: 'Level 2 Ascendant 🥈' },
    description: { ar: 'تخطيت حاجز الـ 1200 نقطة شرفية وحققت المستوى الثاني.', fr: 'Atteignez le niveau de grade 2.', en: 'Crossed the 1200 cumulative Honor Points milestone.' },
    iconName: 'TrendingUp', unlocked: false, tier: 'Silver', pointsCost: 180
  },
  {
    id: 'silver-5',
    title: { ar: 'حارس أمن الهوية 💙', fr: 'Garant Identity 💙', en: 'Validated Blue Badge 💙' },
    description: { ar: 'رفعت مستنداتك المعتمدة وحققت رخصة KYC الزرقاء رسمياً.', fr: 'Validation officielle de vos papiers par l\'admin.', en: 'KYC identity validated and awarded the blue verified shield.' },
    iconName: 'ShieldAlert', unlocked: false, tier: 'Silver', pointsCost: 150
  },
  {
    id: 'silver-6',
    title: { ar: 'صاحب الذكاء والحلول 🧠', fr: 'Résolveur d\'Énigmes 🧠', en: 'Pro Tech Solver 🧠' },
    description: { ar: 'أكملت ٣ كويستات من فئة إصلاحات التقنية والأجهزة.', fr: '3 dépannages de haut niveau.', en: 'Completed 3 high-tech or device repair assignments.' },
    iconName: 'Cpu', unlocked: false, tier: 'Silver', pointsCost: 165
  },
  {
    id: 'silver-7',
    title: { ar: 'المتحدث البليغ المتصل 💬', fr: 'Orateur Engagé 💬', en: 'Eloquence Sync 💬' },
    description: { ar: 'تفاعلت واختتمت بنجاح ٢٠ رسالة في غرف دردشة مختلفة.', fr: 'Discussions actives de négociation de contrats.', en: 'Sent over 20 messages in active coordinating chat panels.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Silver', pointsCost: 140
  },
  {
    id: 'silver-8',
    title: { ar: 'المتطوع الفضي المعاون 🤝', fr: 'Bénévole Distingué 🤝', en: 'Silver Volunteer 🤝' },
    description: { ar: 'حللت كويستان مجانيان تماماً لمساعدة المحتاجين وكبار السن.', fr: '2 aides au voisinage de pure bienveillance.', en: 'Completed 2 free goodwill tasks supporting your neighbors.' },
    iconName: 'Compass', unlocked: false, tier: 'Silver', pointsCost: 155
  },
  {
    id: 'silver-9',
    title: { ar: 'ملازم ومصلح المرافق 🛠️', fr: 'As de la Clé 🛠️', en: 'Handy Craftsman 🛠️' },
    description: { ar: 'أتممت حزمتين من مهام الصيانة المنزلية والتركيبات.', fr: '2 quêtes de maintenance de robinetterie ou d\'électricité.', en: 'Finished 2 heavy home maintenance or plumber operations.' },
    iconName: 'Compass', unlocked: false, tier: 'Silver', pointsCost: 175
  },
  {
    id: 'silver-10',
    title: { ar: 'الناقل فائق الدقة 📦', fr: 'Livreur Agile 📦', en: 'Agile Transporter 📦' },
    description: { ar: 'نفذت ٣ كويستات ناجحة بالكامل في فئة التوصيل السريع والطرود.', fr: '3 courses urbaines livrées sans encombre.', en: 'Dispatched and safely delivered 3 packages or shopping errands.' },
    iconName: 'Compass', unlocked: false, tier: 'Silver', pointsCost: 135
  },
  {
    id: 'silver-11',
    title: { ar: 'منقذ الموعد المزدحم ⏱️', fr: 'Gardien d\'Heure ⏱️', en: 'Punctuality Wizard ⏱️' },
    description: { ar: 'أكملت مهام تسليم قبل حلول الموعد بنصف ساعة كاملة.', fr: 'Livraison anticipée terminée bien avant l\'heure.', en: 'Completed active jobs 30 minutes before set deadline.' },
    iconName: 'Zap', unlocked: false, tier: 'Silver', pointsCost: 180
  },
  {
    id: 'silver-12',
    title: { ar: 'مستودع المراجعات النفيسة 📝', fr: 'Évaluateur Suivi 📝', en: 'Trusted Reviewer 📝' },
    description: { ar: 'جمعت ٥ مراجعات إيجابية مفصلة في سجل بورتفوليو الخاص بك.', fr: '5 revues positives capturées dans votre registre.', en: 'Gained 5 highly positive worker feedback reviews.' },
    iconName: 'Sparkles', unlocked: false, tier: 'Silver', pointsCost: 190
  },
  {
    id: 'silver-13',
    title: { ar: 'رائد رعاية الحيوان المخلص 🐕', fr: 'Ami Protecteur 🐕', en: 'Fidelity Veterinarian Helper 🐕' },
    description: { ar: 'أكملت كويستان في فئة العناية وتأمين حماية الحيوان الأليف.', fr: '2 hébergements ou soins d\'animaux complétés.', en: 'Delivered 2 successful premium pet protection tasks.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Silver', pointsCost: 145
  },
  {
    id: 'silver-14',
    title: { ar: 'المليونير الفضي الصاعد 💰', fr: 'Fortune d\'Argent 💰', en: 'Silver Fortune 💰' },
    description: { ar: 'جمعت رصيداً صافياً يفوق 4500 من عملات توكنز بالمحفظة.', fr: 'Un solde dépassant 4500 jetons d\'affaires.', en: 'Accumulated over 4,500 active tokens inside your wallet.' },
    iconName: 'Sparkles', unlocked: false, tier: 'Silver', pointsCost: 200
  },
  {
    id: 'silver-15',
    title: { ar: 'مدافع رادع الاحتيال 🛡️', fr: 'Défenseur Vigilant 🛡️', en: 'Scam Shield Marshal 🛡️' },
    description: { ar: 'أبلغت بنجاح عن كويست وهمي أو غير آمن لتنشيط درع الأمان.', fr: 'Signalement légitime pour sécuriser le feed.', en: 'Submitted a validated safety alert to protect neighbors.' },
    iconName: 'ShieldAlert', unlocked: false, tier: 'Silver', pointsCost: 160
  },

  // --- TIER 3: GOLD BADGES (10 Hard Badges - high proficiency & elite performance) ---
  {
    id: 'gold-1',
    title: { ar: 'قاهر المستحيل الذهبي 🥇', fr: 'Légende d\'Or 🥇', en: 'Gold Quest Crusader 🥇' },
    description: { ar: 'أكملت ٥٠ كويستاً ميدانياً بنجاح باهر في شتى ولايات الوطن.', fr: '50 succès d\'entraide validés en Algérie.', en: 'Completed 50 certified gig contracts successfully.' },
    iconName: 'Trophy', unlocked: false, tier: 'Gold', pointsCost: 350
  },
  {
    id: 'gold-2',
    title: { ar: 'الملتزم الحديدي الدائم 🔗', fr: 'Volonté de Fer 🔗', en: 'Ironclad Commitment 🔗' },
    description: { ar: 'حققت نسبة إلغاء صفر٪ طيلة ٣٠ يوماً متواصلة من العمل.', fr: 'Zéro annulation sur une période active de 30 jours.', en: 'Maintained a strict 0% booking cancellation rate for 30 consecutive days.' },
    iconName: 'ShieldAlert', unlocked: false, tier: 'Gold', pointsCost: 380
  },
  {
    id: 'gold-3',
    title: { ar: 'قائد التوجيه الجغرافي ⚓', fr: 'Maître d\'Ancre ⚓', en: 'Geo Navigation Admiral ⚓' },
    description: { ar: 'أكملت أكثر من ٢٠ مهمة طارئة مستندة لـ GPS الدقيق.', fr: '20 tâches complexes guidées par GPS résolues.', en: 'Completed 20 physical coordinate-based field missions.' },
    iconName: 'Compass', unlocked: false, tier: 'Gold', pointsCost: 400
  },
  {
    id: 'gold-4',
    title: { ar: 'رتبة الجنرال الذهبي 🎖️', fr: 'Grand Général 🎖️', en: 'General of Honor Rank 🎖️' },
    description: { ar: 'حققت المستوى الخامس في ملفك الشخصي بجموع النقاط.', fr: 'Atteignez le rang et niveau d\'expérience 5.', en: 'Crossed the threshold to Level 5 using dynamic Honor XP.' },
    iconName: 'Trophy', unlocked: false, tier: 'Gold', pointsCost: 450
  },
  {
    id: 'gold-5',
    title: { ar: 'سيد رادار الصيادين 📡', fr: 'Maître Scan 📡', en: 'Radar Mastermind 📡' },
    description: { ar: 'نقرت مسح رادار الصيادين بنجاح ١٠٠ مرة للعثور على الغنائم.', fr: 'Scannez le radar géographique plus de 100 fois.', en: 'Completed 100 successful high-precision area coordinate sweeps.' },
    iconName: 'Compass', unlocked: false, tier: 'Gold', pointsCost: 320
  },
  {
    id: 'gold-6',
    title: { ar: 'محترف الإغاثة والإنقاذ ⚡', fr: 'Secouriste Éclair ⚡', en: 'Critical Crisis Savior ⚡' },
    description: { ar: 'أكملت ٣ كويستات حرجة ومستعجلة قياسية تحت ٣٠ دقيقة.', fr: '3 quêtes urgentes réglées en un temps record absolu.', en: 'Completed 3 critical urgency quests in under 30 minutes each.' },
    iconName: 'Zap', unlocked: false, tier: 'Gold', pointsCost: 420
  },
  {
    id: 'gold-7',
    title: { ar: 'المعلم والموجه المثالي 🎓', fr: 'Professeur Mentor 🎓', en: 'Elite Mentor Academic 🎓' },
    description: { ar: 'أنجزت ١٠ كويستات ناجحة بالكامل في فئة التعليم والتدريس.', fr: '10 sessions d\'accompagnement validées.', en: 'Conducted 10 certified academic or tech mentoring tours.' },
    iconName: 'Cpu', unlocked: false, tier: 'Gold', pointsCost: 360
  },
  {
    id: 'gold-8',
    title: { ar: 'مغناطيس الدخل المجتمعي 💰', fr: 'Aimant de Richesse 💰', en: 'Wealth Syndicate Magnate 💰' },
    description: { ar: 'جنيت ما مجموعه 50,000 دج كعوائد نقدية من رعاية جيرانك.', fr: 'Gagnez plus de 50 000 DA grâce à l\'entraide locale.', en: 'Earned over 50,000 DA in cash rewards across completed tasks.' },
    iconName: 'Sparkles', unlocked: false, tier: 'Gold', pointsCost: 500
  },
  {
    id: 'gold-9',
    title: { ar: 'الإعجاب والمحبة الشاملة 😍', fr: 'Super Star 🌟', en: 'Neighborhood Admiration 😍' },
    description: { ar: 'حققت معدل تقييم ثابت بـ 5.0 نجوم من ٢٥ مراجع منفصل.', fr: 'Note parfaite de 5.0 par 25 employeurs distincts.', en: 'Secured a pristine 5.0 star average rating on 25 different reviews.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Gold', pointsCost: 480
  },
  {
    id: 'gold-10',
    title: { ar: 'المحكم الأمين للنزاعات ⚖️', fr: 'Arbitre d\'Or ⚖️', en: 'Golden Dispute Arbiter ⚖️' },
    description: { ar: 'قمت بإنهاء وتسوية ٣ قضايا معلقة بسلام وتصالح تام.', fr: 'Aide à la clôture de 3 différends avec fair-play.', en: 'Resolved 3 dispute cases in complete compliance and peace.' },
    iconName: 'UserCheck', unlocked: false, tier: 'Gold', pointsCost: 390
  },

  // --- TIER 4: RUBY BADGES (5 Ultra-Rare / grueling mathematically achievements) ---
  {
    id: 'ruby-1',
    title: { ar: 'الأسطورة الحية الخالدة 🩸', fr: 'Légende Éternelle 🩸', en: 'The Absolute Legend 🩸' },
    description: { ar: 'أكمل ٥٠٠ كويست معتمد ومحقق بالكامل على أرض الواقع.', fr: 'Complétez 500 quêtes certifiées de la guilde active.', en: 'Complete 500 verified quests to acquire this ultimate badge.' },
    iconName: 'Trophy', unlocked: false, tier: 'Ruby', pointsCost: 1500
  },
  {
    id: 'ruby-2',
    title: { ar: 'حارس الإقليم والبلدة ⛩️', fr: 'Gardien Sacré ⛩️', en: 'Neighborhood Guardian ⛩️' },
    description: { ar: 'أحرز ١٠٠ تقييم متتالي بمعدل مثالي ٥.٠ نجوم كـRunner نخبة.', fr: 'Assurez 100 prestations consécutives à 5.0 étoiles de rang.', en: 'Secure 100 consecutive 5.0-star treatments as a Runner.' },
    iconName: 'ShieldAlert', unlocked: false, tier: 'Ruby', pointsCost: 1800
  },
  {
    id: 'ruby-3',
    title: { ar: 'إمبراطور الرموز والتوكنز 👑', fr: 'Empereur de Jeton 👑', en: 'Token Monarch 👑' },
    description: { ar: 'احرق واستهلك ٥,٠٠٠ توكنز تراكمياً في تأمين ورعاية العقود.', fr: 'Consommez plus de 5 000 jetons dans vos affectations.', en: 'Burn 5,000 cumulative tokens on gig assignments.' },
    iconName: 'Zap', unlocked: false, tier: 'Ruby', pointsCost: 2000
  },
  {
    id: 'ruby-4',
    title: { ar: 'قاهر الأقاليم والولايات 🇩🇿', fr: 'Nomade Alpin Dz 🇩🇿', en: 'National State Hero 🇩🇿' },
    description: { ar: 'أنجز عقوداً ونفذ غنائم ومهام في ٥ ولايات جزائرية مختلفة.', fr: 'Complétez des tâches dans 5 wilayas différentes d\'Algérie.', en: 'Successfully complete quests in 5 major Algerian provinces (wilayas).' },
    iconName: 'Compass', unlocked: false, tier: 'Ruby', pointsCost: 2500
  },
  {
    id: 'ruby-5',
    title: { ar: 'النخبة العليا اللانهائية 🌌', fr: 'Elite Omnisciente 🌌', en: 'Ultimate Level 50 Elite 🌌' },
    description: { ar: 'اجمع نقاطاً شرفية وارتقِ حتى تصل للمستوى الخمسين (Lvl 50).', fr: 'Gravissez les échelons légendaires de Quest jusqu\'au niveau 50.', en: 'Rise to the celestial ranks and secure Level 50.' },
    iconName: 'Trophy', unlocked: false, tier: 'Ruby', pointsCost: 3000
  }
];

export const INITIAL_HUNTER_REVIEWS: HunterReview[] = [
  {
    reviewId: 'rev-1',
    hunterId: 'user-current',
    godfatherId: 'c-1',
    godfatherName: 'أبو أحمد الباركي',
    godfatherAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    completedTaskImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    comment: 'عمل رائع جداً وسريع! قام بإصلاح مكيف الهواء باحترافية تامة وأنصح بالتعامل معه.',
    createdAt: 'منذ يومين'
  },
  {
    reviewId: 'rev-2',
    hunterId: 'user-current',
    godfatherId: 'c-3',
    godfatherName: 'سفيان جودي',
    godfatherAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&auto=format&fit=crop&q=80',
    completedTaskImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    rating: 4,
    comment: 'شرح ممتاز للألياف البصرية وحل مفصل لأسئلة الامتحان الاستدراكي ومفاهيم الـ OOP.',
    createdAt: 'منذ ٤ أيام'
  }
];

export const INITIAL_GODFATHER_REVIEWS: GodfatherReview[] = [
  {
    reviewId: 'rev-g1',
    godfatherId: 'user-current',
    hunterId: 'hunter-1',
    hunterName: 'رشيد بن علي',
    hunterAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    completedTaskImage: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600&auto=format&fit=crop&q=80',
    rating: 5,
    comment: 'العراب ياسين بلقاسم قمة في الأمانة والاحترام، دفع المستحقات على الفور فور الانتهاء من تأكيد العمل الموثق! سرعة رهيبة في التواصل وتوضيح الكويست الميداني.',
    createdAt: 'البارحة'
  }
];
