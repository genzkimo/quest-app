export interface TranslationDict {
  appName: string;
  slogan: string;
  home: string;
  map: string;
  myQuests: string;
  leaderboard: string;
  profile: string;
  tokens: string;
  cashReward: string;
  bookingCost: string;
  bookBtn: string;
  urgencyNormal: string;
  urgencyUrgent: string;
  urgencyFeatured: string;
  distanceAway: string;
  shareMessenger: string;
  storiesTitle: string;
  completedQuests: string;
  activeChallenges: string;
  claimReward: string;
  points: string;
  level: string;
  weeklyObjective: string;
  addFunds: string;
  phoneVerification: string;
  bountyHunterTitle: string;
  obigationsTab: string;
  createdTab: string;
  postNewQuest: string;
  createNewQuestTitle: string;
  titleLabel: string;
  descLabel: string;
  cashLabel: string;
  categoryLabel: string;
  submitPost: string;
  cancelBtn: string;
  scamShieldWarning: string;
  flagPost: string;
  flaggedAlert: string;
  adminConsole: string;
  adminIncome: string;
  pendingKyc: string;
  approve: string;
  reject: string;
  banUser: string;
  unbanUser: string;
  disputeQueue: string;
  eventsAndWeekly: string;
  activeTier: string;
  onboardingNotice: string;
  kycRequiredWarning: string;
  uploadId: string;
  kycPendingStatus: string;
  kycUnverifiedStatus: string;
  kycVerifiedStatus: string;
  totalStats: string;
  achievementBadges: string;
  edahabiaSim: string;
  selectLanguage: string;
  activeAccount: string;
  scamShieldStatus: string;
  scamShieldFrozen: string;
  disputeResolveRefund: string;
  disputeResolveCollect: string;
  verifyNote: string;
  kycDocumentLabel: string;
  enterMockCard: string;
  kycHeader: string;
  kycSubtitle: string;
  verifiedBadge: string;
  pendingVerification: string;
  unverifiedBadge: string;
  questsCompletedLabel: string;
  privacyHeader: string;
  privacySubtitle: string;
  profileLvl: string;
  challenges: string;
}

export const translations: Record<'ar' | 'fr' | 'en', TranslationDict> = {
  ar: {
    appName: "كويست",
    slogan: "شبكة عقود الغنائم والذخيرة الذهبية للشباب بالجزائر",
    home: "الرئيسية",
    map: "الخريطة",
    myQuests: "عقودي",
    leaderboard: "المتصدرين",
    profile: "الملف الشخصي",
    tokens: "ذخيرة ذهبية",
    cashReward: "المكافأة نقداً",
    bookingCost: "رسوم تأمين حجز عقد المهمة ⚡",
    bookBtn: "توقيع العقد 🎯",
    urgencyNormal: "عادي",
    urgencyUrgent: "مستعجل حرج 🔥",
    urgencyFeatured: "عرض مميز ⭐",
    distanceAway: "على بعد {dist} كم",
    shareMessenger: "مشاركة عبر ماسنجر",
    storiesTitle: "قصص",
    completedQuests: "العقود المكتملة",
    activeChallenges: "المهام والطلبات النشطة",
    claimReward: "المطالبة بالمكافأة",
    points: "نقطة خبرة",
    level: "المستوى",
    weeklyObjective: "التحدي الأسبوعي العام للشركاء",
    addFunds: "شحن الذخيرة الذهبية (الذهبية / CIB)",
    phoneVerification: "التحقق من الهاتف الجزائري (+213)",
    bountyHunterTitle: "خارطة المهام والعمال المحليين 🗺️",
    obigationsTab: "مهامي المحجوزة 🛠️",
    createdTab: "طلباتي المنشورة 💼",
    postNewQuest: "إصدار عقد غنيمة جديد",
    createNewQuestTitle: "نشر عقد غنيمة جديد",
    titleLabel: "عنوان العقد / الغنيمة",
    descLabel: "شرح العقد والمواصفات المطلوبة للتنفيذ الميداني",
    cashLabel: "المكافأة النقدية بالدينار الجزائري (د.ج)",
    categoryLabel: "فئة العقد",
    submitPost: "أنشئ العقد والغنيمة فوراً",
    cancelBtn: "إلغاء",
    scamShieldWarning: "درع الأمان للحماية من الاحتيال أو سوء التفاهم",
    flagPost: "الإبلاغ عن احتيال أو التزام عقد كاذب",
    flaggedAlert: "تم الإبلاغ! الإبلاغ المتكرر سيجمد الحساب فوراً للتحقيق.",
    adminConsole: "وحدة الإشراف والتحكم المالي للإمبراطورية",
    adminIncome: "عمولات وعائدات المنصة التراكمية من الذخيرة الذهبية",
    pendingKyc: "طلبات التفعيل المعلقة (KYC)",
    approve: "اعتماد وتوثيق الحساب",
    reject: "رفض ملف الـ KYC",
    banUser: "حظر العضو المخالف",
    unbanUser: "فك حظر الحساب",
    disputeQueue: "نزاعات العمل والتحكيم المالي السريع",
    eventsAndWeekly: "بث برقيات التحدي الأسبوعي للشركاء",
    activeTier: "الرتبة الحالية",
    onboardingNotice: "⚡ هدية التسجيل الترحيبية: لقد حصلت على 500 ذخيرة ذهبية مجاناً كبداية! أكمل الـ KYC للحصول على +2500 رمز إضافي وشارة الأمان الزرقاء!",
    kycRequiredWarning: "⚠️ يتطلب تفعيل حسابك رفع بطاقة الهوية وتوثيق الـ KYC لتأكيد الهوية للعمل ميدانياً.",
    uploadId: "رفع بطاقة الهوية الوطنية أو رخصة القيادة لإثبات الهوية",
    kycPendingStatus: "طلب التحقق من الهوية معلق قيد المراجعة ⏳",
    kycUnverifiedStatus: "حساب غير موثق ❌ - ارفع هويتك لتفعيل الحساب ومباشرة الأعمال",
    kycVerifiedStatus: "حساب معتمد موثق مع شارة الأمان الزرقاء ✔️",
    totalStats: "إحصائيات إنجاز الأعمال والمهام",
    achievementBadges: "أوسمة الشرف المحققة",
    edahabiaSim: "محاكاة بوابة شحن الذخيرة الذهبية عبر بريد الجزائر / ساتيم",
    selectLanguage: "لغة التطبيق - Langue",
    activeAccount: "حالة الحساب وتحقيق الشخصية",
    scamShieldStatus: "نظام درع الاحتيال والمكافحة الإلكترونية",
    scamShieldFrozen: "🔒 حساب مجمد بسبب كثرة بلاغات كسر العهود والاحتيال!",
    disputeResolveRefund: "إعادة الذخيرة الذهبية للعامل المتظلم",
    disputeResolveCollect: "تحصيل عمولة الذخيرة الذهبية وتأكيد العقوبة على المخالف",
    verifyNote: "ملاحظة: هذا النظام يحاكي دورة حياة العقد بالكامل على السيرفر وموثق للتطبيق الحقيقي.",
    kycDocumentLabel: "مستند الهوية المرفوع",
    enterMockCard: "أدخل معلومات بطاقة الذهب أو CIB لزيادة رصيدك من الذخيرة الذهبية",
    kycHeader: "التحقق من الهوية الرسمي (KYC)",
    kycSubtitle: "ارفع بطاقتك لتصبح شريكاً موثقاً وتحصل على شارة الأمان الزرقاء لمباشرة المهام المحلية الكبرى",
    verifiedBadge: "شريك معتمد موثق ✔️",
    pendingVerification: "قيد المراجعة الإدارية ⏳",
    unverifiedBadge: "حساب غير موثق ❌",
    questsCompletedLabel: "عقود غنمُتها",
    privacyHeader: "تفعيل الوضع المظلم",
    privacySubtitle: "تغيير واجهة التطبيق إلى المظهر الداكن المريح للعين",
    profileLvl: "المستوى والرتبة",
    challenges: "المهمات النشطة"
  },
  fr: {
    appName: "Quest",
    slogan: "Contrats de Primes & Munitions d'Or pour Jeunes en Algérie",
    home: "Flux de Primes",
    map: "Carte des Primes",
    myQuests: "Mes Contrats",
    leaderboard: "Chasseurs d'Élite",
    profile: "Mercenaire & Munitions",
    tokens: "Munitions d'Or",
    cashReward: "Solde Cash (DA)",
    bookingCost: "Frais de Contrat (10% Munitions)",
    bookBtn: "Signer le Contrat 🎯",
    urgencyNormal: "Normal",
    urgencyUrgent: "Trés Urgent 🔥",
    urgencyFeatured: "Prime de Parrain ⭐",
    distanceAway: "À {dist} km d'ici",
    shareMessenger: "Partager sur Messenger",
    storiesTitle: "Succès des Chasseurs en Direct (Dernières 24h)",
    completedQuests: "Contrats Remplis",
    activeChallenges: "Missions de Chasseur Actives",
    claimReward: "Réclamer XP",
    points: "Points d'XP",
    level: "Rang",
    weeklyObjective: "Sprint Hebdomadaire des Chasseurs",
    addFunds: "Acheter Munitions d'Or (Edahabia / CIB)",
    phoneVerification: "Validation du téléphone (+213)",
    bountyHunterTitle: "Système de Traque des Mercenaires",
    obigationsTab: "Mes Engagements 🛠️",
    createdTab: "Mes Contrats 💼",
    postNewQuest: "Émettre un Contrat de Prime",
    createNewQuestTitle: "Diffuser une nouvelle Prime locale",
    titleLabel: "Titre de la Prime",
    descLabel: "Spécifications de la cible et outils requis",
    cashLabel: "Récompense Cash du Parrain en Dinars (DZD / DA)",
    categoryLabel: "Catégorie de Prime",
    submitPost: "Diffuser le Contrat Immédiatement",
    cancelBtn: "Annuler",
    scamShieldWarning: "Scam Shield - Protection communautaire contre les Parrains véreux",
    flagPost: "Signaler une infraction de contrat ou fraude",
    flaggedAlert: "Signalement enregistré ! Plusieurs alertes gèleront l'accès du suspect.",
    adminConsole: "Panneau de Contrôle Impérial de l'Ombre",
    adminIncome: "Bénéfice de Plateforme (Frais de Munitions d'Or)",
    pendingKyc: "Vérifications de Mercenaires en attente (KYC)",
    approve: "Valider le statut de Chasseur Agréé",
    reject: "Rejeter le document KYC",
    banUser: "Bannir suspect",
    unbanUser: "Gracier profil",
    disputeQueue: "Litiges Financiers et Arbitrages des Primes",
    eventsAndWeekly: "Défis mondiaux de Chasse",
    activeTier: "Division Actuelle",
    onboardingNotice: "⚡ Don du Parrain : Vous avez reçu 500 Munitions d'Or comme point de départ ! Remplissez le KYC pour recevoir +2500 Jetons bonus et le Badge d'Honneur Bleu !",
    kycRequiredWarning: "⚠️ La signature de contrats exige une identité de chasseur vérifiée (KYC).",
    uploadId: "Téléverser la pièce d'identité du Chasseur",
    kycPendingStatus: "Vérification de l'identité du Chasseur en traitement ⏳",
    kycUnverifiedStatus: "Chasseur Non Vérifié ❌ - Téléversez votre identité",
    kycVerifiedStatus: "Chasseur Licencié avec Badge d'Honneur Bleu ✔️",
    totalStats: "Statistiques du Mercenaire",
    achievementBadges: "Ordres et Médailles d'Honneur",
    edahabiaSim: "Simulateur de Marché de Munitions d'Or (Edahabia / CIB)",
    selectLanguage: "Langue du Système",
    activeAccount: "Autorisation de Chasse & Sécurité",
    scamShieldStatus: "État de Scam Shield",
    scamShieldFrozen: "🔒 Compte gelé pour rupture de contrat ou fraude excessive !",
    disputeResolveRefund: "Restituer les Munitions d'Or au Mercenaire",
    disputeResolveCollect: "Confirmer la faute et collecter la prime",
    verifyNote: "Note: Modèle de simulation complet des transactions de l'Ombre sur serveur.",
    kycDocumentLabel: "Pièce d'Identité Nationale fournie",
    enterMockCard: "Saisissez les paramètres de carte pour obtenir des Munitions d'Or",
    kycHeader: "Enregistrement de Mercenaire Officiel (KYC)",
    kycSubtitle: "Soumettez vos papiers pour devenir Chasseur Certifié avec badge de confiance bleu",
    verifiedBadge: "Chasseur Certifié ✔️",
    pendingVerification: "En attente de cachet officiel ⏳",
    unverifiedBadge: "Mercenaire non enregistré ❌",
    questsCompletedLabel: "Contrats Chassés",
    privacyHeader: "Mode Sombre",
    privacySubtitle: "Activer l'ambiance sombre et apaisante pour vos yeux",
    profileLvl: "Rang & Prestige",
    challenges: "Missions Actives"
  },
  en: {
    appName: "Quest",
    slogan: "High-Octane Local Bounties & Gold Ammo for Algerian Chasers",
    home: "Bounties Stream",
    map: "Bounty Grid Coordinate",
    myQuests: "My Contracts",
    leaderboard: "Hunter Syndicate Elite",
    profile: "Mercenary Profile",
    tokens: "Gold Ammo",
    cashReward: "Cash Payout (DA)",
    bookingCost: "Contract Booking Fee (10% Gold Ammo)",
    bookBtn: "Sign Bounty Contract 🎯",
    urgencyNormal: "Standard",
    urgencyUrgent: "CRITICAL BREACH 🔥",
    urgencyFeatured: "Godfather Approved ⭐",
    distanceAway: "{dist} km away",
    shareMessenger: "Share on Messenger",
    storiesTitle: "Hunter Accomplishments (Active Proof Stories)",
    completedQuests: "Contracts Cleared",
    activeChallenges: "Syndicate Special Missions",
    claimReward: "Claim Bounty XP",
    points: "Prestige XP",
    level: "Syndicate Level",
    weeklyObjective: "Global Syndicate Sprint",
    addFunds: "Buy Gold Ammo Reserves (Edahabia / CIB)",
    phoneVerification: "Algerian Mobile Verification (+213)",
    bountyHunterTitle: "Mercenary Position Tracker",
    obigationsTab: "My Obligations 🛠️",
    createdTab: "My Quests 💼",
    postNewQuest: "Issue New Bounty Contract",
    createNewQuestTitle: "Broadcast New Neighborhood Bounty",
    titleLabel: "Bounty Contract Title",
    descLabel: "Target objectives, operational details, and tools required",
    cashLabel: "Godfather Cash payout on-ground (DZD / DA)",
    categoryLabel: "Bounty Category Tag",
    submitPost: "Publish Contract Immediately",
    cancelBtn: "Cancel",
    scamShieldWarning: "Scam Shield - Collective Underworld Bounty Protection",
    flagPost: "Flag breach of contract or Godfather fraud",
    flaggedAlert: "Report logged! Flagged profiles will hold frozen assets instantly.",
    adminConsole: "Shadow Master Control & Empire Assets",
    adminIncome: "Cumulative Platform Revenues (Gold Ammo Commission)",
    pendingKyc: "Mercenary Registrations Pending (KYC Check)",
    approve: "Approve Fighter Credentials",
    reject: "Deny Credentials",
    banUser: "Exile Mercenary",
    unbanUser: "Pardon Bounty Account",
    disputeQueue: "Disputed Contracts & Rapid Financial Arbitrations",
    eventsAndWeekly: "Broadcast Syndicate Global Sprints",
    activeTier: "Current Syndicate Division",
    onboardingNotice: "⚡ Godfather Welcoming Gift: We credited your stash with 500 Gold Ammo! Upload your KYC to claim an extra +2500 tokens bonus and the Blue Shield badge!",
    kycRequiredWarning: "⚠️ Signing neighborhood contracts requires a verified hunter card uploaded.",
    uploadId: "Upload High-Resolution national NID card image",
    kycPendingStatus: "Worker license registration pending approval ⏳",
    kycUnverifiedStatus: "Unverified Fighter ❌ - Submit identity documents to unlock",
    kycVerifiedStatus: "Verified Syndicate Fighter under Sky Blue security clearance ✔️",
    totalStats: "Cleared Contracts Analytics",
    achievementBadges: "Unlocked Medals of Valor",
    edahabiaSim: "Simulated Algerian E-Payment Portal for Gold Ammo Supplies",
    selectLanguage: "Interface Language Selection",
    activeAccount: "Fighter Security Clearence & State",
    scamShieldStatus: "Anti-Fraud Scam Shield Detection",
    scamShieldFrozen: "🔒 Account placed on lockdown due to duplicate contract breaches!",
    disputeResolveRefund: "Refund Gold Ammo back to Chaser",
    disputeResolveCollect: "Claim Gold Ammo Commission & enforce penalty",
    verifyNote: "Notice: Live client simulation of decentralized system.",
    kycDocumentLabel: "National Fighter Registry Card",
    enterMockCard: "Enter Dahabia Card Parameters to Recharge Gold Ammo Supplies",
    kycHeader: "Underworld Identity Certification (KYC)",
    kycSubtitle: "Submit documentation to become a Certified Syndicate Hunter and obtain blue high-trust badge",
    verifiedBadge: "Certified Hunter ✔️",
    pendingVerification: "Pending Syndicate Stamp ⏳",
    unverifiedBadge: "Unregistered Mercenary ❌",
    questsCompletedLabel: "Contracts Cleared",
    privacyHeader: "Dark Mode Theme",
    privacySubtitle: "Switch to eye-friendly responsive dark interface styling",
    profileLvl: "Syndicate Level & Rank",
    challenges: "Syndicate Missions"
  }
};
