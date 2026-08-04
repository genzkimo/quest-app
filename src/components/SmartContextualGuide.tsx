import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Briefcase, ChevronRight, Compass } from 'lucide-react';

interface SmartContextualGuideProps {
  currentView: string;
  lang?: 'ar' | 'fr' | 'en';
  userId?: string;
}

export const SmartContextualGuide: React.FC<SmartContextualGuideProps> = ({
  currentView,
  lang = 'ar',
  userId,
}) => {
  const isAr = lang === 'ar';
  type HintKey = 'home_feed' | 'home_create' | 'map_view' | 'my_quests' | 'inbox_view' | 'profile_stats' | 'profile_portfolio' | 'settings_view';
  const [activeHint, setActiveHint] = useState<HintKey | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleSettingsToggle = (e: any) => {
      setIsSettingsOpen(e.detail);
    };
    window.addEventListener('settings_toggled', handleSettingsToggle);
    return () => window.removeEventListener('settings_toggled', handleSettingsToggle);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const checkHints = () => {
      const feedSeen = localStorage.getItem(`hint_home_feed_${userId}`) === 'true';
      const createSeen = localStorage.getItem(`hint_home_create_${userId}`) === 'true';
      const mapSeen = localStorage.getItem(`hint_map_view_${userId}`) === 'true';
      const myQuestsSeen = localStorage.getItem(`hint_my_quests_${userId}`) === 'true';
      const inboxSeen = localStorage.getItem(`hint_inbox_view_${userId}`) === 'true';
      const statsSeen = localStorage.getItem(`hint_profile_stats_${userId}`) === 'true';
      const portfolioSeen = localStorage.getItem(`hint_profile_portfolio_${userId}`) === 'true';
      const settingsSeen = localStorage.getItem(`hint_settings_view_${userId}`) === 'true';

      if (currentView === 'home') {
        if (!feedSeen) setActiveHint('home_feed');
        else if (!createSeen) setActiveHint('home_create');
        else setActiveHint(null);
      } else if (currentView === 'map' && !mapSeen) {
        setActiveHint('map_view');
      } else if (currentView === 'my-quests' && !myQuestsSeen) {
        setActiveHint('my_quests');
      } else if (currentView === 'inbox' && !inboxSeen) {
        setActiveHint('inbox_view');
      } else if (currentView === 'profile') {
        if (isSettingsOpen && !settingsSeen) {
          setActiveHint('settings_view');
        } else if (!isSettingsOpen && !statsSeen) {
          setActiveHint('profile_stats');
        } else if (!isSettingsOpen && !portfolioSeen) {
          setActiveHint('profile_portfolio');
        } else {
          setActiveHint(null);
        }
      } else {
        setActiveHint(null);
      }
    };

    checkHints();

    window.addEventListener('hints_reset', checkHints);
    return () => window.removeEventListener('hints_reset', checkHints);
  }, [userId, currentView, isSettingsOpen]);

  const handleDismiss = () => {
    if (userId && activeHint) {
      localStorage.setItem(`hint_${activeHint}_${userId}`, 'true');
      
      // If we dismissed home_feed, show home_create immediately if not seen
      if (activeHint === 'home_feed' && currentView === 'home') {
        const createSeen = localStorage.getItem(`hint_home_create_${userId}`) === 'true';
        if (!createSeen) {
          setActiveHint('home_create');
          return;
        }
      }

      // If we dismissed profile_stats, show profile_portfolio immediately
      if (activeHint === 'profile_stats' && currentView === 'profile') {
        const portfolioSeen = localStorage.getItem(`hint_profile_portfolio_${userId}`) === 'true';
        if (!portfolioSeen) {
          setActiveHint('profile_portfolio');
          return;
        }
      }
    }
    setActiveHint(null);
  };

  if (!activeHint) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={activeHint}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleDismiss}
        className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center cursor-pointer select-none"
        style={{ direction: isAr ? 'rtl' : 'ltr' }}
      >
        {activeHint === 'home_feed' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-32 flex flex-col items-center px-6 w-full">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug mb-4">
              {isAr ? 'هنا تجد الكويستات المنشورة 📍' : 'Here you find published quests 📍'}
            </h3>
            
            {/* Visual Replica of a Feed Card */}
            <div className="w-full max-w-sm bg-white/10 border border-white/20 p-4 rounded-3xl relative overflow-hidden shadow-2xl">
               <div className="absolute inset-0 bg-[#4FC3F7]/10 blur-2xl rounded-full opacity-50 animate-pulse -z-10"></div>
               <div className="flex gap-4 items-center opacity-80">
                 <div className="w-12 h-12 bg-white/20 rounded-full"></div>
                 <div className="flex-1 space-y-2">
                   <div className="h-4 bg-white/20 rounded-full w-3/4"></div>
                   <div className="h-3 bg-white/20 rounded-full w-1/2"></div>
                 </div>
               </div>
            </div>
            
            <p className="mt-8 text-slate-300 font-medium text-center text-sm">
              {isAr ? 'تصفح الطلبات في مدينتك وقدم عروضك لإنجازها.' : 'Browse tasks in your city and submit offers to complete them.'}
            </p>
          </motion.div>
        )}

        {activeHint === 'home_create' && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute bottom-28 flex flex-col items-center px-6 w-full">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug mb-8">
              {isAr ? 'يمكنك نشر كويست من هذا الزر ✨' : 'You can publish a quest from this button ✨'}
            </h3>
            
            {/* Visual Replica of the button */}
            <div className="relative">
              <div className="absolute inset-0 bg-[#FF3B7C] rounded-full blur-xl opacity-60 animate-pulse"></div>
              <div className="w-16 h-16 rounded-full bg-[#FF3B7C] text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,59,124,0.5)] ring-4 ring-white/30 relative z-10">
                <Plus className="w-8 h-8 stroke-[3]" />
              </div>
            </div>
            
            <p className="mt-8 text-pink-200/90 font-medium text-center text-sm max-w-[250px]">
              {isAr ? 'هل تحتاج إلى خدمة أو عامل؟ انقر هنا لنشر طلبك مجاناً' : 'Need a service or a worker? Click here to post your request for free'}
            </p>
          </motion.div>
        )}

        {activeHint === 'map_view' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center px-6">
             <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 ring-4 ring-emerald-500/30 shadow-2xl animate-bounce">
                <Compass className="w-10 h-10" />
             </div>
             <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug">
              {isAr ? 'استكشف المهام القريبة منك على الخريطة 🗺️' : 'Explore nearby tasks on the map 🗺️'}
            </h3>
          </motion.div>
        )}

        {activeHint === 'my_quests' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-28 w-full flex flex-col items-center px-6">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug mb-8">
              {isAr ? 'تابع طلباتك ومهامك النشطة هنا 📋' : 'Track your active requests and tasks here 📋'}
            </h3>
            
            {/* Visual Replica of the Tabs */}
            <div className="w-full max-w-[340px] bg-white/10 p-2 rounded-2xl border border-white/20 flex gap-2 relative shadow-2xl">
              <div className="absolute inset-0 bg-amber-400/10 blur-2xl rounded-full opacity-50 animate-pulse -z-10"></div>
              
              <div className="flex-1 py-3 px-2 rounded-xl bg-white/20 text-white font-black text-sm flex items-center justify-center gap-2 border border-white/30 shadow-lg">
                <Plus className="w-4 h-4 text-amber-300" />
                <span className="truncate">{isAr ? 'طلباتي' : 'My Posts'}</span>
              </div>
              
              <div className="flex-1 py-3 px-2 rounded-xl bg-white/5 text-white/70 font-bold text-sm flex items-center justify-center gap-2 border border-white/5">
                <Briefcase className="w-4 h-4 text-white/50" />
                <span className="truncate">{isAr ? 'مهامي المحجوزة' : 'My Jobs'}</span>
              </div>
            </div>
            
            <p className="mt-6 text-amber-200/90 font-medium text-center text-sm max-w-xs">
              {isAr ? 'استخدم هذين الزرين للتبديل بين ما طلبته وما ستقوم بإنجازه للآخرين.' : 'Use these buttons to toggle between what you requested and what you are doing.'}
            </p>
          </motion.div>
        )}

        {activeHint === 'inbox_view' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl px-6 leading-snug">
              {isAr ? 'تواصل للاتفاق على التفاصيل 💬' : 'Communicate to agree on details 💬'}
            </h3>
            <p className="mt-4 text-slate-300 font-medium text-center px-8 text-sm max-w-[280px]">
              {isAr ? 'كل محادثاتك مع أصحاب المهام أو المنفذين ستكون محفوظة ومؤمنة هنا.' : 'All your chats with task owners or helpers will be secured here.'}
            </p>
          </motion.div>
        )}

        {activeHint === 'settings_view' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-28 flex flex-col items-center w-full px-6">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug mb-8">
              {isAr ? 'إعدادات حسابك وتفضيلاتك هنا ⚙️' : 'Your account settings are here ⚙️'}
            </h3>
            
            <p className="text-slate-300 font-medium text-center text-sm max-w-[280px]">
              {isAr ? 'يمكنك تفعيل الإشعارات وتغيير اللغة والمزيد.' : 'You can enable notifications, change language, and more.'}
            </p>
          </motion.div>
        )}

        {activeHint === 'profile_stats' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-28 flex flex-col items-center w-full px-6">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug mb-8">
              {isAr ? 'حسابك وتقييماتك هنا 🛡️' : 'Your account and ratings are here 🛡️'}
            </h3>
            
            <p className="text-slate-300 font-medium text-center text-sm max-w-[280px] mb-8">
              {isAr ? 'هذه صفحتك الشخصية، حيث يمكنك إدارة معلومات حسابك ومتابعة تقييماتك لزيادة موثوقيتك.' : 'This is your profile page, where you can manage your account information and track your ratings.'}
            </p>
          </motion.div>
        )}

        {activeHint === 'profile_portfolio' && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute top-28 flex flex-col items-center w-full px-6">
            <h3 className="text-3xl font-black text-white text-center drop-shadow-2xl leading-snug mb-8">
              {isAr ? 'معرض أعمالك الاحترافي 🖼️' : 'Your Professional Portfolio 🖼️'}
            </h3>
            
            <p className="text-slate-300 font-medium text-center text-sm max-w-[280px] mb-8">
              {isAr ? 'يمكنك نشر صور لسابقة أعمالك في معرض الأعمال لزيادة فرصك في الحصول على مهام.' : 'You can publish photos of your previous work in your portfolio to increase your chances of getting tasks.'}
            </p>
          </motion.div>
        )}
        
        <div className="absolute bottom-10 text-white/60 text-sm font-bold tracking-widest animate-pulse flex items-center gap-2">
           <span className="w-2 h-2 rounded-full bg-white/60"></span>
           {isAr ? 'اضغط في أي مكان للمتابعة' : 'TAP ANYWHERE TO CONTINUE'}
           <span className="w-2 h-2 rounded-full bg-white/60"></span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartContextualGuide;
