import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
 Compass, 
 Map, 
 Trophy, 
 CheckSquare, 
 User, 
 Sparkles,
 Flame,
 Bell,
 Zap,
 ShieldAlert,
 MessageSquare,
 Plus,
 ShieldCheck,
 Wallet
} from 'lucide-react';
import { ViewState, Quest, UserProfile } from '../types';
import { translations } from '../data/translations';
import { playSoftClick } from '../utils/audio';
import QuestLogo from './QuestLogo';
import { NotificationDoc } from './NotificationScreen';

interface NavbarProps {
 currentView: ViewState;
 onViewChange: (view: ViewState) => void;
 unclaimedChallengesCount: number;
 unreadTasksCount: number;
 tokenBalance: number;
 lang: 'ar' | 'fr' | 'en';
 isAdmin?: boolean;
 audioEnabled?: boolean;
 unreadNotificationsCount: number;
 unreadChatsCount: number;
 onBellClick: () => void;
 userProfile?: UserProfile | null;
 quests?: Quest[];
 notifications?: NotificationDoc[];
 onTriggerCreateQuest?: () => void;
 onNavigateToProfileSubmenu?: (submenu: 'main' | 'account' | 'verification' | 'wallet' | 'general' | 'support_chat') => void;
 activeConnectionStatus?: 'online' | 'weak' | 'offline';
 showConnectionBar?: boolean;
 onCloseConnectionBar?: () => void;
 onToggleConnectionBar?: () => void;
 globalBroadcast?: string | null;
 onCloseGlobalBroadcast?: () => void;
 onNavVisibilityChange?: (visible: boolean) => void;
 isHeaderHidden?: boolean;
}

export default function Navbar({ 
 currentView, 
 onViewChange, 
 unclaimedChallengesCount, 
 unreadTasksCount,
 tokenBalance,
 lang,
 isAdmin = false,
 audioEnabled = true,
 unreadNotificationsCount,
 unreadChatsCount,
 onBellClick,
 userProfile = null,
 quests = [],
 notifications = [],
 onTriggerCreateQuest,
 onNavigateToProfileSubmenu,
 activeConnectionStatus,
 showConnectionBar,
 onCloseConnectionBar,
 onToggleConnectionBar,
 globalBroadcast,
 onCloseGlobalBroadcast,
 onNavVisibilityChange,
 isHeaderHidden = false
}: NavbarProps) {
 
 const [showTokenMenu, setShowTokenMenu] = useState(false);
 const [isVisible, setIsVisible] = useState(true);
 const [isTyping, setIsTyping] = useState(false);

 useEffect(() => {
 const isInputElement = (el: Element | null) => {
 if (!el) return false;
 const tagName = el.tagName;
 if (tagName === 'TEXTAREA') return true;
 if ((el as HTMLElement).isContentEditable) return true;
 if (el.getAttribute('role') === 'textbox') return true;
 if (tagName === 'INPUT') {
 const type = (el as HTMLInputElement).type?.toLowerCase();
 return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'].includes(type);
 }
 return false;
 };

 const handleFocusIn = (e: FocusEvent) => {
 if (isInputElement(e.target as Element)) {
 setIsTyping(true);
 }
 };

 const handleFocusOut = () => {
 setTimeout(() => {
 if (!isInputElement(document.activeElement)) {
 setIsTyping(false);
 }
 }, 50);
 };

 if (isInputElement(document.activeElement)) {
 setIsTyping(true);
 }

 window.addEventListener('focusin', handleFocusIn);
 window.addEventListener('focusout', handleFocusOut);

 return () => {
 window.removeEventListener('focusin', handleFocusIn);
 window.removeEventListener('focusout', handleFocusOut);
 };
 }, []);

 useEffect(() => {
 if (onNavVisibilityChange) {
 onNavVisibilityChange(isVisible && !isTyping);
 }
 }, [isVisible, isTyping, onNavVisibilityChange]);

 useEffect(() => {
 setIsVisible(true);
 }, [currentView]);

 useEffect(() => {
 let lastY = window.scrollY || 0;
 let touchStartY = 0;

 const handleScroll = (e: Event) => {
 let currentY = window.scrollY || document.documentElement.scrollTop || 0;
 
 const target = e.target as HTMLElement | Document;
 if (target && target !== document && target !== document.body && (target as HTMLElement).scrollTop !== undefined) {
 const elScrollTop = (target as HTMLElement).scrollTop;
 if (elScrollTop !== undefined && !isNaN(elScrollTop)) {
 currentY = elScrollTop;
 }
 }

 // Always keep visible when near the top of the page (first 150px)
 if (currentY <= 150) {
 setIsVisible(true);
 lastY = currentY;
 return;
 }

 // Require scrolling down at least 150px before hiding
 if (currentY > lastY + 150) {
 setIsVisible(false);
 lastY = currentY;
 } 
 // Require scrolling up at least 50px before showing again
 else if (currentY < lastY - 50) {
 setIsVisible(true);
 lastY = currentY;
 }
 };

 const handleTouchStart = (e: TouchEvent) => {
 if (e.touches && e.touches.length > 0) {
 touchStartY = e.touches[0].clientY;
 }
 };

 const handleTouchMove = (e: TouchEvent) => {
 if (!e.touches || e.touches.length === 0) return;
 const currentTouchY = e.touches[0].clientY;
 const deltaY = currentTouchY - touchStartY;

 // Swiping down (scrolling up) by more than 50px shows nav
 if (deltaY > 50) {
 setIsVisible(true);
 } 
 // Swiping up (scrolling down) by more than 150px when past top 150px hides nav
 else if (deltaY < -150) {
 const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
 if (currentScrollY > 150) {
 setIsVisible(false);
 }
 }
 };

 window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
 window.addEventListener('touchstart', handleTouchStart, { passive: true });
 window.addEventListener('touchmove', handleTouchMove, { passive: true });

 return () => {
 window.removeEventListener('scroll', handleScroll, { capture: true });
 window.removeEventListener('touchstart', handleTouchStart);
 window.removeEventListener('touchmove', handleTouchMove);
 };
 }, [currentView]);

 const dict = translations[lang];
 const isVerified = userProfile?.idVerificationStatus === 'verified';

 const matchingQuestsCount = (quests || []).filter(q => 
 q.status === 'open' && 
 (Number(q.cashReward) >= 3000 || Number(q.pointsReward) >= 100) && 
 (!userProfile?.city || q.location.toLowerCase().includes(userProfile.city.toLowerCase()))
 ).length;

 const questNotificationsCount = (notifications || []).filter(n => 
 !n.read && 
 (n.type === 'applicant' || n.type === 'arrival' || n.type === 'approved' || n.type === 'completed' || n.text.includes('عقد') || n.text.includes('كويست') || n.text.includes('Quest') || n.text.includes('Contract') || n.text.includes('مهمة') || n.text.includes('موافق'))
 ).length;
 const totalMyQuestsUpdates = unreadTasksCount + questNotificationsCount;

 const profileNotificationsCount = (notifications || []).filter(n => 
 !n.read && 
 (n.type === 'approved' || n.text.includes('شحن') || n.text.includes('الرصيد') || n.text.includes('refill') || n.text.includes('credited'))
 ).length;
 const totalProfileUpdates = unclaimedChallengesCount + profileNotificationsCount;

 const NAV_ITEMS: { 
 id: ViewState; 
 label: string; 
 icon: React.ComponentType<{ className?: string }>;
 hasBadge?: boolean;
 badgeValue?: string | number;
 onClickOverride?: () => void;
 }[] = [
 { 
 id: 'home', 
 label: dict.home, 
 icon: Compass,
 hasBadge: matchingQuestsCount > 0,
 badgeValue: matchingQuestsCount > 0 ? matchingQuestsCount : undefined
 },
 { 
 id: 'my-quests', 
 label: dict.myQuests, 
 icon: CheckSquare, 
 hasBadge: totalMyQuestsUpdates > 0,
 badgeValue: totalMyQuestsUpdates > 0 ? totalMyQuestsUpdates : undefined
 },
 {
 id: 'messages',
 label: lang === 'ar' ? 'الدردشة' : lang === 'fr' ? 'Messagerie' : 'Chat',
 icon: MessageSquare,
 hasBadge: unreadChatsCount > 0,
 badgeValue: unreadChatsCount > 0 ? unreadChatsCount : undefined,
 },
 { 
 id: 'profile', 
 label: dict.profile, 
 icon: User,
 hasBadge: totalProfileUpdates > 0,
 badgeValue: totalProfileUpdates > 0 ? totalProfileUpdates : undefined
 },
 ];

 if (isAdmin) {
 NAV_ITEMS.push({
 id: 'admin',
 label: lang === 'ar' ? 'الإشراف' : lang === 'fr' ? 'Superviser' : 'Supervise',
 icon: ShieldAlert
 });
 }

 const isRtl = lang === 'ar';

 return (
 <>
 {/* Top Main Brand Header Bar Container - Animated sliding together with Connection and Broadcast bars */}
 <div 
 style={{ direction: isRtl ? 'rtl' : 'ltr' }}
 className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
 isVisible && !isHeaderHidden && !isTyping ? 'translate-y-0' : '-translate-y-full'
 }`}
 >
 <header 
 className="relative h-18 pb-2 flex items-center justify-between px-4 md:px-8 select-none"
 >
 {/* Cloud Gradient Background Layer - Masked so blur & color dissolve into complete transparency */}
 <div 
 className="absolute -inset-x-0 top-0 h-24 pointer-events-none -z-10"
 style={{
 background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.75) 50%, rgba(255, 255, 255, 0) 100%)',
 backdropFilter: 'blur(20px)',
 WebkitBackdropFilter: 'blur(20px)',
 maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.7) 60%, rgba(0, 0, 0, 0) 100%)',
 WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.7) 60%, rgba(0, 0, 0, 0) 100%)'
 }}
 />
 
 {/* Brand Name Logo on the left */}
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-2 cursor-pointer transition-transform duration-150 active:scale-95" onClick={() => { playSoftClick(audioEnabled); onViewChange('home'); }}>
 <QuestLogo size="sm" textColor="text-[#FF3B7C]" />
 <span className="text-white text-[8.5px] py-0.5 px-1.5 rounded-lg bg-[#FF3B7C] font-black tracking-widest uppercase">DZ</span>
 </div>
 </div>
 
 {/* Dynamic active Token Balance on center-right, Chat Inbox & Notification bell on right */}
 <div className="flex items-center gap-2">
 
 {/* Active Token Balance inside relative container for dropdown */}
 <div className="relative">
 <div 
 onClick={() => {
 playSoftClick(audioEnabled);
 setShowTokenMenu(!showTokenMenu);
 }}
 className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl cursor-pointer transition-all duration-200 border border-slate-100"
 >
 <Zap className="w-4.5 h-4.5 text-[#FFD34D] fill-[#FFD34D]/25" />
 <span className="text-sm font-black font-mono text-[#1F2A44] flex items-center gap-0.5">
 {tokenBalance}
 </span>
 </div>

 {showTokenMenu && (
 <>
 <div 
 className="fixed inset-0 z-40 bg-transparent" 
 onClick={() => setShowTokenMenu(false)} 
 />
 <div 
 style={{ direction: isRtl ? 'rtl' : 'ltr' }}
 className={`absolute top-11 ${isRtl ? 'left-0' : 'right-0'} w-72 bg-white border border-gray-150 rounded-2xl shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-2 duration-150`}
 >
 <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider px-2 pb-1.5 mb-1.5 border-b border-gray-100 text-right">
 {lang === 'ar' ? 'خيارات الرصيد والتوثيق ' : lang === 'fr' ? 'Options de solde et de vérification ' : 'Token & Verification Options '}
 </p>
 <div className="space-y-1">
 {/* Option 1: 700 tokens for NID verification */}
 {!isVerified && (
 <button
 onClick={() => {
 setShowTokenMenu(false);
 if (onNavigateToProfileSubmenu) {
 onNavigateToProfileSubmenu('verification');
 }
 }}
 className="w-full flex items-start gap-2.5 p-2 rounded-xl text-right hover:bg-sky-50/50 transition-colors cursor-pointer group"
 >
 <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
 <div className="flex-1 text-right">
 <span className="text-xs font-black text-sky-800 block group-hover:text-sky-700">
 {lang === 'ar' ? 'توثيق الهوية (+700 د.ج)' : lang === 'fr' ? 'Vérifier NID (+700 DA)' : 'Verify NID (+700 DA)'}
 </span>
 <span className="text-[10px] text-sky-500 block leading-tight">
 {lang === 'ar' ? 'ارفع بطاقة التعريف الوطنية للحصول على 700 د.ج رصيد مجاناً' : lang === 'fr' ? 'Soumettez votre carte pour 700 DA solde gratuit' : 'Submit your identity card to get 700 DA free usage balance'}
 </span>
 </div>
 </button>
 )}

 {/* Option 2: Charge/recharge tokens */}
 <button
 onClick={() => {
 setShowTokenMenu(false);
 if (onNavigateToProfileSubmenu) {
 onNavigateToProfileSubmenu('wallet');
 }
 }}
 className="w-full flex items-start gap-2.5 p-2 rounded-xl text-right hover:bg-[#4FC3F7]/10 transition-colors cursor-pointer group"
 >
 <Wallet className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
 <div className="flex-1 text-right">
 <span className="text-xs font-black text-slate-800 block group-hover:text-[#039BE5]">
 {lang === 'ar' ? 'إضافة رصيد Quest' : lang === 'fr' ? 'Ajouter du solde Quest' : 'Add Quest Balance'}
 </span>
 <span className="text-[10px] text-gray-500 block leading-tight">
 {lang === 'ar' ? 'شحن رصيدك عبر بريدي موب أو بطاقة الدفع' : lang === 'fr' ? 'Recharger via Baridimob ou carte' : 'Top up your balance via Baridimob or card'}
 </span>
 </div>
 </button>
 </div>
 </div>
 </>
 )}
 </div>

 {/* Elegant float notification bell */}
 <button 
 onClick={onBellClick}
 className="w-9 h-9 rounded-xl bg-transparent flex items-center justify-center relative text-[#1F2A44] hover:bg-black/5 cursor-pointer transition-all active:scale-95"
 title={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
 >
 <Bell className="w-5 h-5 text-[#1F2A44]" />
 {unreadNotificationsCount > 0 && (
 <span className="absolute top-0.5 right-0.5 bg-[#FF3B7C] text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white animate-pulse transition-all shadow-md w-4 h-4">
 {unreadNotificationsCount}
 </span>
 )}
 </button>
 </div>

 </header>

 {/* Dynamic Internet Connection Status Bar linked directly below Header */}
 <AnimatePresence>
 {showConnectionBar && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 exit={{ opacity: 0, height: 0 }}
 className={`border-b py-2 px-4 flex items-center justify-between gap-3 shadow-md backdrop-blur-md transition-all ${
 activeConnectionStatus === 'offline'
 ? 'bg-rose-50/95 border-rose-200 text-rose-700'
 : activeConnectionStatus === 'weak'
 ? 'bg-amber-50/95 border-amber-200 text-amber-700'
 : 'bg-sky-50/95 border-sky-200 text-sky-700'
 }`}
 >
 <div className="flex items-center gap-2">
 <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
 activeConnectionStatus === 'offline'
 ? 'bg-rose-500'
 : activeConnectionStatus === 'weak'
 ? 'bg-amber-500'
 : 'bg-sky-500'
 }`} />
 <span className="text-[11px] font-extrabold leading-relaxed">
 {activeConnectionStatus === 'offline' && (
 lang === 'ar' ? ' لا يوجد اتصال بالإنترنت - يرجى التحقق من الشبكة' : ' No internet connection - please check your network'
 )}
 {activeConnectionStatus === 'weak' && (
 lang === 'ar' ? ' الاتصال بالإنترنت ضعيف - قد تواجه بعض البطء' : ' Connection is weak - you may experience some lag'
 )}
 {activeConnectionStatus === 'online' && (
 lang === 'ar' ? ' متصل بالإنترنت بنجاح - الخدمة مستقرة' : ' Successfully connected - service is stable'
 )}
 </span>
 </div>

 {onCloseConnectionBar && (
 <button 
 onClick={onCloseConnectionBar}
 className="text-gray-400 hover:text-gray-600 px-1 font-black shrink-0 cursor-pointer text-xs"
 >
 
 </button>
 )}
 </motion.div>
 )}
 </AnimatePresence>

 {/* Sticky Global Broadcast bulletin attached under Header */}
 {globalBroadcast && (
 <div className="bg-white dark:bg-[#0A1128] border-b border-[#FF3B7C]/40 py-2 px-4 flex items-center justify-between text-[11px] font-extrabold text-slate-900 dark:text-white leading-relaxed shadow-md">
 <span className="flex-1 text-slate-800 dark:text-[#FFD34D] truncate font-extrabold">{globalBroadcast}</span>
 {onCloseGlobalBroadcast && (
 <button 
 onClick={onCloseGlobalBroadcast}
 className="text-[#FF3B7C] hover:text-[#FF3B7C]/80 px-2 font-black shrink-0 cursor-pointer bg-slate-100 dark:bg-white/10 py-0.5 rounded border border-slate-200 dark:border-white/10"
 >
 
 </button>
 )}
 </div>
 )}
 </div>

 {/* Bottom bar with Cloud Gradient Background Layer - buttons stay 100% solid */}
 <nav 
 style={{ 
 direction: isRtl ? 'rtl' : 'ltr'
 }}
 className={`fixed bottom-0 left-0 right-0 z-40 px-2 lg:px-24 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
 isVisible && !isTyping ? 'translate-y-0' : 'translate-y-full'
 }`}
 >
 {/* Cloud Gradient Background Layer - Masked so blur & color dissolve into complete transparency at top edge */}
 <div 
 className="absolute -inset-x-0 bottom-0 h-28 pointer-events-none -z-10"
 style={{
 background: 'linear-gradient(to top, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.75) 50%, rgba(255, 255, 255, 0) 100%)',
 backdropFilter: 'blur(20px)',
 WebkitBackdropFilter: 'blur(20px)',
 maskImage: 'linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.7) 60%, rgba(0, 0, 0, 0) 100%)',
 WebkitMaskImage: 'linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.7) 60%, rgba(0, 0, 0, 0) 100%)'
 }}
 />

 <div className="max-w-xl mx-auto flex justify-between h-18 items-center py-2 relative z-10">
 {NAV_ITEMS.slice(0, 2).map((item) => {
 const Icon = item.icon;
 const isActive = currentView === item.id;
 
 return (
 <button
 key={item.id}
 onClick={() => {
 playSoftClick(audioEnabled);
 if (item.onClickOverride) {
 item.onClickOverride();
 } else {
 onViewChange(item.id as ViewState);
 }
 }}
 className="flex-1 flex flex-col items-center justify-center relative py-1 focus:outline-none transition-all group scale-100 active:scale-95 cursor-pointer"
 >
 {/* Active Sky Blue marker at the top of active tab */}
 {isActive && (
 <span className="absolute -top-1 w-8 h-1 bg-[#4FC3F7] rounded-full shadow-[0_2px_8px_rgba(79,195,247,0.4)]"></span>
 )}

 {/* Micro-Stack wrapper that scales perfectly avoiding key collision */}
 <div className={`relative transition-all duration-300 ${isActive ? 'scale-115' : 'scale-100'}`}>
 {/* Tab Icon - Highlighted in Sky Blue */}
 <Icon className={`w-5.5 h-5.5 transition-all ${
 isActive 
 ? 'text-[#4FC3F7] drop-shadow-[0_2px_6px_rgba(79,195,247,0.3)]' 
 : 'text-gray-450 group-hover:text-gray-650'
 }`} />

 {/* Red Notification Badge */}
 {item.hasBadge ? (
 <span 
 id={`nav-badge-${item.id}`}
 className={`absolute bg-[#FF3B7C] text-white font-black rounded-full flex items-center justify-center border border-white animate-pulse transition-all shadow-md ${
 item.badgeValue 
 ? 'text-[7px] w-4 h-4 -top-1.5 -right-1.5' 
 : 'w-2 h-2 -top-0.5 -right-0.5'
 }`}
 >
 {item.badgeValue || ''}
 </span>
 ) : null}
 </div>

 </button>
 );
 })}

 {/* Special Floating Plus Button in the middle */}
 <button
 onClick={() => {
 playSoftClick(audioEnabled);
 if (onTriggerCreateQuest) {
 onTriggerCreateQuest();
 }
 }}
 className="w-12 h-12 rounded-full bg-[#FF3B7C] hover:bg-[#E0245E] text-white flex items-center justify-center shadow-lg shadow-[#FF3B7C]/25 cursor-pointer active:scale-90 transition-all shrink-0 -mt-6 border-4 border-white relative z-50 group"
 title={lang === 'ar' ? 'نشر كويست جديد' : lang === 'fr' ? 'Publier un Quest' : 'Post New Quest'}
 >
 <Plus className="w-6 h-6 text-white stroke-[3.5px] transition-transform duration-200 group-hover:scale-110" />
 </button>

 {NAV_ITEMS.slice(2).map((item) => {
 const Icon = item.icon;
 const isActive = currentView === item.id;
 
 return (
 <button
 key={item.id}
 onClick={() => {
 playSoftClick(audioEnabled);
 if (item.onClickOverride) {
 item.onClickOverride();
 } else {
 onViewChange(item.id as ViewState);
 }
 }}
 className="flex-1 flex flex-col items-center justify-center relative py-1 focus:outline-none transition-all group scale-100 active:scale-95 cursor-pointer"
 >
 {/* Active Sky Blue marker at the top of active tab */}
 {isActive && (
 <span className="absolute -top-1 w-8 h-1 bg-[#4FC3F7] rounded-full shadow-[0_2px_8px_rgba(79,195,247,0.4)]"></span>
 )}

 {/* Micro-Stack wrapper that scales perfectly avoiding key collision */}
 <div className={`relative transition-all duration-300 ${isActive ? 'scale-115' : 'scale-100'}`}>
 {/* Tab Icon - Highlighted in Sky Blue */}
 <Icon className={`w-5.5 h-5.5 transition-all ${
 isActive 
 ? 'text-[#4FC3F7] drop-shadow-[0_2px_6px_rgba(79,195,247,0.3)]' 
 : 'text-gray-450 group-hover:text-gray-650'
 }`} />

 {/* Red Notification Badge */}
 {item.hasBadge ? (
 <span 
 id={`nav-badge-${item.id}`}
 className={`absolute bg-[#FF3B7C] text-white font-black rounded-full flex items-center justify-center border border-white animate-pulse transition-all shadow-md ${
 item.badgeValue 
 ? 'text-[7px] w-4 h-4 -top-1.5 -right-1.5' 
 : 'w-2 h-2 -top-0.5 -right-0.5'
 }`}
 >
 {item.badgeValue || ''}
 </span>
 ) : null}
 </div>

 </button>
 );
 })}
 </div>
 </nav>
 </>
 );
}
export type { ViewState };
