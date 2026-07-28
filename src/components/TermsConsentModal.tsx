import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, FileText, ExternalLink, Check, Lock } from 'lucide-react';

interface TermsConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  lang?: 'ar' | 'fr' | 'en';
}

export default function TermsConsentModal({ isOpen, onAccept, lang = 'ar' }: TermsConsentModalProps) {
  const [agreed, setAgreed] = useState(true);

  if (!isOpen) return null;

  const isAr = lang === 'ar';
  const isFr = lang === 'fr';

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden ${isAr ? 'text-right dir-rtl' : 'text-left dir-ltr'}`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Glow ambient background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FC0D82]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#4285F4]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FC0D82] to-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
              <Lock className="w-3 h-3" />
              {isAr ? 'شروط  وسياسة الخصوصية' : isFr ? 'Normes de confidentialité ' : ' Terms & Privacy Standards'}
            </span>
            <h2 className="text-lg font-black text-white leading-tight">
              {isAr ? 'موافقة شروط الاستخدام وسياسة الخصوصية' : isFr ? "Conditions d'utilisation et politique de confidentialité" : 'Terms of Use & Privacy Consent'}
            </h2>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 text-slate-300 text-xs font-semibold leading-relaxed space-y-3 mb-5">
          <p className="text-slate-200 font-bold">
            {isAr
              ? 'أهلاً بك! بمجرد تسجيل الدخول واستخدام التطبيق، فإنك توافق على شروط الاستخدام وسياسة الخصوصية المطلوبة وفقًا لمعايير   لحماية بياناتك وشخصيتك.'
              : isFr
              ? 'Bienvenue ! En vous connectant et en utilisant l\'application, vous acceptez les conditions d\'utilisation et la politique de confidentialité requises par les normes   pour protéger vos données.'
              : 'Welcome! By logging in and using the app, you agree to the Terms of Use and Privacy Policy required under   standards to protect your data.'}
          </p>
          <p className="text-[11px] text-slate-400 leading-normal">
            {isAr
              ? 'نحن نلتزم بحماية خصوصيتك وعدم مشاركة بياناتك مع أي طرف ثالث دون إذنك الصريح.'
              : isFr
              ? 'Nous nous engageons à protéger votre vie privée et à ne jamais partager vos données sans votre consentement explicite.'
              : 'We are committed to protecting your privacy and never sharing your data with third parties without explicit consent.'}
          </p>

          {/* Links Section */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2">
            <a
              href="https://kimo.hakerzoldyck.workers.dev/terms%20of%20use"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-[11px] font-bold text-[#FC0D82] flex items-center justify-between transition group cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-pink-400" />
                {isAr ? 'شروط الاستخدام' : isFr ? "Conditions d'utilisation" : 'Terms of Use'}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-white transition" />
            </a>

            <a
              href="https://kimo.hakerzoldyck.workers.dev/privacy%20policy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-[11px] font-bold text-blue-400 flex items-center justify-between transition group cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                {isAr ? 'سياسة الخصوصية' : isFr ? 'Politique de confidentialité' : 'Privacy Policy'}
              </span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-white transition" />
            </a>
          </div>
        </div>

        {/* Checkbox agreement */}
        <label
          onClick={() => setAgreed(!agreed)}
          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 cursor-pointer transition select-none mb-5 border border-transparent hover:border-slate-800"
        >
          <div
            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
              agreed
                ? 'bg-[#FC0D82] border-[#FC0D82] text-white shadow-md shadow-pink-500/30'
                : 'border-slate-600 bg-slate-950'
            }`}
          >
            {agreed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
          <span className="text-[11px] font-bold text-slate-300 leading-snug">
            {isAr
              ? 'قرأت وفهمت جميع شروط الاستخدام وسياسة الخصوصية المذكورة وأوافق عليها للبدء.'
              : isFr
              ? 'J\'ai lu, compris et j\'accepte toutes les conditions d\'utilisation et la politique de confidentialité pour commencer.'
              : 'I have read, understood and agree to all the Terms of Use and Privacy Policy.'}
          </span>
        </label>

        {/* Primary Accept Action */}
        <button
          disabled={!agreed}
          onClick={onAccept}
          className={`w-full py-3.5 rounded-2xl text-xs font-black shadow-xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
            agreed
              ? 'bg-gradient-to-r from-[#FC0D82] to-pink-600 hover:from-pink-500 hover:to-[#FC0D82] text-white shadow-pink-500/25 hover:shadow-pink-500/40'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          <span>{isAr ? 'أوافق وأتابع إلى التطبيق 🚀' : isFr ? 'J\'accepte et continuer vers l\'application 🚀' : 'Agree & Continue to App 🚀'}</span>
        </button>
      </motion.div>
    </div>
  );
}
