import React, { useState } from 'react';
import { AuthService } from '../services/auth.service';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  User, 
  MapPin, 
  ArrowLeft, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { auth, db, cleanData } from '../utils/firebase';
import { UserProfile } from '../types';
import QuestLogo from './QuestLogo';


interface AuthScreenProps {
  showToast: (msg: string) => void;
  lang?: 'ar' | 'fr' | 'en';
}

const generateShortId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'QST-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

type AuthMode = 'onboarding' | 'login' | 'register' | 'forgot-password';

export default function AuthScreen({ showToast, lang = 'ar' }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('onboarding');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('الجزائر');
  const [stateName, setStateName] = useState('');
  const [municipality, setMunicipality] = useState('');

  // UI labels based on Arabic language
  const isAr = lang === 'ar';

  const handleGoogleSignIn = async () => {
  if (loading) return;

  setLoading(true);

  try {
    await AuthService.signInWithGoogle();

    showToast(
      isAr
        ? '🎉 تم تسجيل الدخول بنجاح عبر Google!'
        : '🎉 Logged in with Google successfully!'
    );
  } catch (e: any) {
    console.error('Google Sign In Error', e);

    showToast(
      isAr
        ? '⚠️ فشل تسجيل الدخول: ' + e.message
        : '⚠️ Login failed: ' + e.message
    );
  } finally {
    setLoading(false);
  }
};

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!firstName.trim() || !lastName.trim() || !stateName.trim() || !municipality.trim() || !email.trim() || !password.trim()) {
      showToast(isAr ? '⚠️ يرجى ملء جميع الحقول المطلوبة لإنشاء حسابك!' : '⚠️ Please fill out all fields to create your account!');
      return;
    }

    if (password.length < 6) {
      showToast(isAr ? '⚠️ يجب أن تكون كلمة المرور 6 أحرف على الأقل!' : '⚠️ Password must be at least 6 characters!');
      return;
    }

    setLoading(true);

    try {
      const normEmail = email.toLowerCase().trim();
      const userCredential = await createUserWithEmailAndPassword(auth, normEmail, password.trim());
      const uid = userCredential.user.uid;

      // Seed newUser document in Firestore
      const newUserProfile: UserProfile = {
        id: uid,
        name: `${firstName.trim()} ${lastName.trim()}`,
        phone: 'غير محدد',
        city: `${country.trim()} - ${stateName.trim()} - ${municipality.trim()}`,
        avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
        questsCompleted: 0,
        questsCreated: 0,
        totalPoints: 0,
        tokenBalance: 300, // Onboarding bonus tokens (Sign-up Bonus)
        rating: 5.0,
        level: 1,
        idVerificationStatus: 'unverified',
        kycRewardClaimed: false,
        completedQuestsIds: [],
        createdQuestsIds: [],
        unlockedBadgeIds: ['badge-welcome'],
        language: 'ar',
        enableNotifications: true,
        privacyEnabled: false,
        audioEffectsEnabled: true,
        hapticFeedbackEnabled: true,
        isAdmin: normEmail === 'hakerzoldyck@gmail.com',
        role: normEmail === 'hakerzoldyck@gmail.com' ? 'admin' : 'user',
        email: normEmail,
        shortId: generateShortId(),
      };

      await setDoc(doc(db, 'users', uid), cleanData(newUserProfile));
      showToast(isAr ? '🎉 تم إنشاء الحساب ومزامنته السحابية بنجاح!' : '🎉 Account created and cloud-synced successfully!');
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err.code === 'auth/email-already-in-use') {
        showToast(isAr ? 'ℹ️ هذا الحساب موجود بالفعل! جاري تحويلك لصفحة تسجيل الدخول.' : 'ℹ️ This account already exists! Redirecting to login.');
        // Autofill email to login and flip screen
        setMode('login');
      } else if (err.code === 'auth/operation-not-allowed') {
        showToast(isAr ? '⚠️ التسجيل بالبريد الإلكتروني غير مفعّل في Firebase. يرجى استخدام الدخول بـ Google أو تفعيل Email/Password في Firebase Console.' : '⚠️ Email sign-up is disabled in Firebase. Use Google Sign-In or enable Email/Password provider in Firebase Console.');
      } else if (err.code === 'auth/network-request-failed') {
        showToast(isAr ? '⚠️ تعذر الاتصال بالسيرفر. يرجى التحقق من اتصال الإنترنت.' : '⚠️ Network request failed. Check your internet connection.');
      } else {
        showToast(isAr ? `⚠️ فشل التسجيل: ${err.message}` : `⚠️ Registration failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !password.trim()) {
      showToast(isAr ? '⚠️ يرجى إدخال البريد الإلكتروني وكلمة المرور!' : '⚠️ Please enter both email and password!');
      return;
    }

    setLoading(true);

    try {
      const normEmail = email.toLowerCase().trim();
      await signInWithEmailAndPassword(auth, normEmail, password.trim());
      showToast(isAr ? '🎉 تم تسجيل الدخول واسترجاع بياناتك بنجاح!' : '🎉 Logged in and restored all cloud data!');
    } catch (err: any) {
      console.error("Login error:", err);
      let errMsg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة!' : 'Incorrect email or password!';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = isAr ? 'طريقة الدخول بالبريد غير مفعّلة في Firebase Console.' : 'Email login is disabled in Firebase Console.';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = isAr ? 'تعذر الاتصال بالسيرفر. يرجى التحقق من اتصال الإنترنت.' : 'Network request failed. Check your internet connection.';
      }
      showToast(isAr ? `⚠️ فشل الدخول: ${errMsg}` : `⚠️ Login failed: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim()) {
      showToast(isAr ? '⚠️ يرجى كتابة البريد الإلكتروني أولاً!' : '⚠️ Please enter your email first!');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.toLowerCase().trim());
      showToast(isAr ? '📧 تم إرسال رابط استعادة كلمة المرور لبريدك الإلكتروني!' : '📧 Reset password link sent to your email!');
      setMode('login');
    } catch (err: any) {
      console.error("Reset password error:", err);
      let errMsg = err.message;
      if (err.code === 'auth/operation-not-allowed') {
        errMsg = isAr ? 'خدمة إرسال البريد غير مفعّلة في Firebase Console.' : 'Email service disabled in Firebase Console.';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = isAr ? 'تعذر الاتصال بالسيرفر. يرجى التحقق من اتصال الإنترنت.' : 'Network request failed.';
      }
      showToast(isAr ? `⚠️ فشل إرسال الرابط: ${errMsg}` : `⚠️ Error sending reset link: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FC0D82] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
      {/* Glow Spotlights */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full bg-slate-900/40 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {mode === 'onboarding' && (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-8 py-8"
            >
              {/* Logo Section */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-5 bg-white/10 rounded-[40px] shadow-2xl backdrop-blur-md transform hover:scale-105 transition duration-300">
                  <QuestLogo size="xl" textColor="text-white" iconOnly={true} />
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight italic select-none">
                  QUEST
                </h1>
                <p className="text-sm font-semibold opacity-90 max-w-xs mx-auto leading-relaxed">
                  {isAr 
                    ? 'المنصة الأولى لربط الشباب بفرص عمل ميدانية ومهام موثوقة! 🇩🇿' 
                    : 'The leading national network to connect workers with micro-gigs!'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4 pt-6">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="w-full py-4 bg-white text-[#FC0D82] text-sm font-black rounded-3xl hover:bg-slate-100 transition duration-200 shadow-xl cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isAr ? 'تسجيل الدخول' : 'Log In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="w-full py-4 bg-transparent border-2 border-white/80 text-white text-sm font-black rounded-3xl hover:bg-white hover:text-[#FC0D82] transition duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isAr ? 'إنشاء حساب جديد' : 'Create New Account'}</span>
                </button>

                <div className="flex items-center justify-center gap-3 py-1">
                  <div className="h-[1px] bg-white/20 flex-1"></div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                    {isAr ? 'أو' : 'or'}
                  </span>
                  <div className="h-[1px] bg-white/20 flex-1"></div>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-3.5 bg-white text-[#FC0D82] text-sm font-black rounded-3xl hover:bg-slate-50 transition duration-200 shadow-xl cursor-pointer flex items-center justify-center gap-2.5 border border-white"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.57-1.02-1.34-1.21-2.18v-.45z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>{isAr ? 'الدخول بحساب Google' : 'Continue with Google'}</span>
                </button>

                <p className="text-[10px] text-white/80 font-bold text-center mt-3 leading-snug px-2">
                  {isAr 
                    ? 'بمجرد تسجيل الدخول فإنك توافق على شروط الاستخدام وسياسة الخصوصية التي تطلبها غوغل.' 
                    : 'By signing in, you agree to the Terms of Service and Privacy Policy required by Google.'}
                </p>
              </div>
            </motion.div>
          )}

          {mode === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="bg-white text-slate-800 rounded-[32px] p-6 sm:p-8 shadow-2xl relative border border-white/20"
            >
              <button
                type="button"
                onClick={() => setMode('onboarding')}
                className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>

              <div className="text-center space-y-2 mb-6">
                <div className="inline-flex p-3 bg-pink-50 text-[#FC0D82] rounded-2xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-800">{isAr ? 'تسجيل الدخول' : 'Access Your Account'}</h2>
                <p className="text-[11px] text-slate-400 font-bold">
                  {isAr ? 'أدخل تفاصيل حسابك لاسترجاع بورتفوليو أعمالك والمهام' : 'Fill credentials to restore your social workspace'}
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Input */}
                <div className="space-y-1.5 text-right">
                  <label className="text-[10px] text-slate-400 font-black tracking-wider uppercase block">
                    {isAr ? 'البريد الإلكتروني 📧' : 'Email Address 📧'}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] focus:bg-white transition text-right font-sans"
                    />
                    <Mail className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5 text-right">
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-[9px] text-[#FC0D82] font-black cursor-pointer hover:underline"
                    >
                      {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </button>
                    <label className="text-[10px] text-slate-400 font-black tracking-wider uppercase block">
                      {isAr ? 'كلمة المرور 🔒' : 'Password 🔒'}
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] focus:bg-white transition text-right font-sans"
                    />
                    <Lock className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#FC0D82] hover:bg-[#FC0D82]/90 text-white text-xs font-black rounded-2xl shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{isAr ? 'دخول واسترجاع الحساب' : 'Restore Data & Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Google Sign-In Option */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <div className="h-[1px] bg-slate-100 flex-1"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    {isAr ? 'أو' : 'or'}
                  </span>
                  <div className="h-[1px] bg-slate-100 flex-1"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 bg-white text-slate-700 text-xs font-black rounded-2xl hover:bg-slate-50 transition duration-200 shadow-md cursor-pointer flex items-center justify-center gap-2 border border-slate-200"
                >
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.57-1.02-1.34-1.21-2.18v-.45z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>{isAr ? 'الدخول بواسطة حساب Google' : 'Sign In with Google'}</span>
                </button>
              </form>

              {/* Secondary actions */}
              <div className="pt-6 mt-6 border-t border-slate-50 text-center">
                <p className="text-[11px] text-slate-400 font-bold">
                  {isAr ? 'ليست لديك عضوية بعد؟' : 'New to Quest Platform?'}
                  <button
                    onClick={() => setMode('register')}
                    className="text-[#FC0D82] font-black mr-1 cursor-pointer hover:underline"
                  >
                    {isAr ? 'إنشاء حساب جديد مجاناً' : 'Create Free Account'}
                  </button>
                </p>
              </div>
            </motion.div>
          )}

          {mode === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="bg-white text-slate-800 rounded-[32px] p-6 sm:p-7 shadow-2xl relative border border-white/20"
            >
              <button
                type="button"
                onClick={() => setMode('onboarding')}
                className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>

              <div className="text-center space-y-2 mb-5">
                <div className="inline-flex p-2.5 bg-pink-50 text-[#FC0D82] rounded-xl">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-slate-800">{isAr ? 'عضوية جديدة' : 'Create Free Account'}</h2>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  {isAr ? 'سجل حسابك في 30 ثانية لتأمين مهامك واستعادتها مستقبلاً' : 'Unlock verified gigs with full server synchronization'}
                </p>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-3.5">
                {/* Full name Row */}
                <div className="grid grid-cols-2 gap-2 text-right">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-black uppercase">{isAr ? 'اللقب 👤' : 'Last Name 👤'}</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={isAr ? 'اللقب الثاني' : 'Family Name'}
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] focus:bg-white text-right"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-black uppercase">{isAr ? 'الاسم 👤' : 'First Name 👤'}</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={isAr ? 'الاسم الأول' : 'Given Name'}
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] focus:bg-white text-right"
                    />
                  </div>
                </div>

                {/* Residence Structure */}
                <div className="space-y-1.5 text-right bg-slate-50/50 p-2.5 border border-slate-100 rounded-2xl">
                  <h3 className="text-[9px] text-slate-400 font-black uppercase mb-1 flex items-center justify-end gap-1">
                    <span>{isAr ? 'مكان الإقامة (الجزائر بالكامل) 📍' : 'City Residence Info 📍'}</span>
                    <MapPin className="w-3 h-3 text-[#FC0D82]" />
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={municipality}
                        onChange={(e) => setMunicipality(e.target.value)}
                        placeholder={isAr ? 'البلدية' : 'Commune'}
                        required
                        className="w-full px-2 py-2 bg-white border border-slate-100 rounded-xl text-[11px] font-bold text-slate-800 outline-none text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder={isAr ? 'الولاية' : 'State'}
                        required
                        className="w-full px-2 py-2 bg-white border border-slate-100 rounded-xl text-[11px] font-bold text-slate-800 outline-none text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={country}
                        disabled
                        className="w-full px-2 py-2 bg-slate-100 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-400 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1 text-right">
                  <label className="text-[9px] text-slate-400 font-black uppercase block">{isAr ? 'البريد الإلكتروني 📧' : 'Email Address 📧'}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] text-right font-sans"
                  />
                </div>

                {/* Password Selection */}
                <div className="space-y-1 text-right">
                  <label className="text-[9px] text-slate-400 font-black uppercase block">{isAr ? 'كلمة المرور الآمنة 🔒' : 'Secure Password 🔒'}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="•••••••• (6 أحرف أو أكثر)"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] text-right font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Account Creation button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#FC0D82] hover:bg-[#FC0D82]/90 text-white text-xs font-black rounded-xl shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{isAr ? 'إنشاء حساب والربط السحابي' : 'Create Account & Cloud Sync'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Return link */}
              <div className="pt-4 mt-4 border-t border-slate-50 text-center">
                <p className="text-[10px] text-slate-400 font-bold">
                  {isAr ? 'لديك عضوية سابقة؟' : 'Already have a profile?'}
                  <button
                    onClick={() => setMode('login')}
                    className="text-[#FC0D82] font-black mr-1 cursor-pointer hover:underline"
                  >
                    {isAr ? 'تسجيل الدخول هنا' : 'Log In directly'}
                  </button>
                </p>
              </div>
            </motion.div>
          )}

          {mode === 'forgot-password' && (
            <motion.div
              key="forgot-password"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="bg-white text-slate-800 rounded-[32px] p-6 sm:p-8 shadow-2xl relative border border-white/20"
            >
              <button
                type="button"
                onClick={() => setMode('login')}
                className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </button>

              <div className="text-center space-y-2 mb-6">
                <div className="inline-flex p-3 bg-pink-50 text-[#FC0D82] rounded-2xl">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-800">{isAr ? 'استرجاع الحساب' : 'Forgot Password'}</h2>
                <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                  {isAr ? 'أدخل بريدك الإلكتروني لإرسال رابط تعيين كلمة مرور جديدة فوراً' : 'Enter your email to receive recovery instructions'}
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5 text-right font-sans">
                  <label className="text-[10px] text-slate-400 font-black uppercase block">{isAr ? 'البريد الإلكتروني المسجل 📧' : 'Registered Email 📧'}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-[#FC0D82] focus:bg-white text-right"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#FC0D82] hover:bg-[#FC0D82]/90 text-white text-xs font-black rounded-2xl shadow-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{isAr ? 'إرسال رابط إعادة التعيين 📧' : 'Send Reset Link 📧'}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="pt-5 mt-5 border-t border-slate-50 text-center">
                <button
                  onClick={() => setMode('login')}
                  className="text-slate-400 text-[10px] font-black cursor-pointer hover:text-[#FC0D82] hover:underline"
                >
                  {isAr ? '←العودة لصفحة تسجيل الدخول' : '← Back to Login'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer support signature */}
      <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-pink-100/70 font-black tracking-widest font-mono select-none">
        {isAr ? 'كويست الجزائر • حماية سحابية آمنة' : 'QUEST DZ • SECURE CLOUD ENCRYPTED'}
      </div>
    </div>
  );
}
