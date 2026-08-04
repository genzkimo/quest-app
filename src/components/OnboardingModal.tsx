import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, ArrowLeft, ArrowRight, CheckCircle2, User } from 'lucide-react';
import { UserProfile } from '../types';
import { ALGERIA_WILAYAS } from '../data/algeriaData';

interface OnboardingModalProps {
  userProfile: UserProfile;
  lang?: 'ar' | 'fr' | 'en';
  onSaveProfile: (updated: Partial<UserProfile>) => void;
  showToast: (msg: string) => void;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  userProfile,
  lang = 'ar',
  onSaveProfile,
  showToast,
  onClose
}) => {
  const isAr = lang === 'ar';
  
  // Step 1: Real Name, Step 2: Phone, Step 3: Address (Wilaya & Commune)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Name State
  const initialName = userProfile.name && !userProfile.name.includes('@') && userProfile.name !== 'مستخدم المستكشف' ? userProfile.name : '';
  const [realName, setRealName] = useState(initialName);

  // Phone State
  const initialPhone = userProfile.phone && userProfile.phone !== 'غير محدد' ? userProfile.phone : '';
  const [phone, setPhone] = useState(initialPhone);
  
  // Address State
  const defaultWilayaObj = ALGERIA_WILAYAS.find(w => w.code === '16') || ALGERIA_WILAYAS[15];
  const [selectedWilayaCode, setSelectedWilayaCode] = useState<string>(defaultWilayaObj.code);
  const selectedWilaya = ALGERIA_WILAYAS.find(w => w.code === selectedWilayaCode) || defaultWilayaObj;
  const [selectedCommune, setSelectedCommune] = useState<string>(selectedWilaya.communes[0] || 'الجزائر الوسطى');

  const [errorMsg, setErrorMsg] = useState('');

  // Handle Wilaya change and reset commune to first commune in list
  const handleWilayaChange = (code: string) => {
    setSelectedWilayaCode(code);
    const found = ALGERIA_WILAYAS.find(w => w.code === code);
    if (found && found.communes.length > 0) {
      setSelectedCommune(found.communes[0]);
    }
    setErrorMsg('');
  };

  const handleNextStep1 = () => {
    if (realName.trim().length < 3) {
      setErrorMsg(isAr ? '⚠️ يرجى إدخال اسمك الحقيقي (3 أحرف على الأقل)' : '⚠️ Please enter your real name (at least 3 characters)');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleNextStep2 = () => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const phoneRegex = /^(05|06|07)\d{8}$/;

    if (!phoneRegex.test(cleanPhone)) {
      setErrorMsg(isAr ? '⚠️ يجب أن يتكون رقم الهاتف من 10 أرقام ويبدأ بـ 05 أو 06 أو 07' : '⚠️ Phone number must be 10 digits and start with 05, 06, or 07');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleFinishStep3 = () => {
    if (!selectedCommune) {
      setErrorMsg(isAr ? '⚠️ يرجى اختيار البلدية' : '⚠️ Please select commune');
      return;
    }

    const formattedAddress = `${selectedWilaya.nameAr} (${selectedCommune})`;

    onSaveProfile({
      name: realName.trim(),
      phone: phone.trim(),
      city: formattedAddress,
      hasCompletedOnboarding: true,
      totalPoints: (userProfile.totalPoints || 0) + 15
    });

    try {
      localStorage.setItem(`onboarding_completed_${userProfile.id}`, 'true');
    } catch (e) {
      console.warn("Could not set local onboarding flag", e);
    }

    showToast(isAr ? '🎉 تم حفظ البيانات بنجاح!' : '🎉 Details saved!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-100 text-slate-800 flex flex-col min-h-[460px] justify-between relative"
      >
        {/* Step Indicator Header */}
        <div className="p-6 pb-2 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
              step >= 1 ? (step > 1 ? 'bg-emerald-500 text-white' : 'bg-[#FF3B7C] text-white shadow-md') : 'bg-slate-100 text-slate-400'
            }`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className="h-1 w-6 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full bg-[#FF3B7C] transition-all duration-300 ${step >= 2 ? 'w-full' : 'w-0'}`} />
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
              step >= 2 ? (step > 2 ? 'bg-emerald-500 text-white' : 'bg-[#FF3B7C] text-white shadow-md') : 'bg-slate-100 text-slate-400'
            }`}>
              {step > 2 ? '✓' : '2'}
            </div>
            <div className="h-1 w-6 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full bg-[#FF3B7C] transition-all duration-300 ${step >= 3 ? 'w-full' : 'w-0'}`} />
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
              step === 3 ? 'bg-[#FF3B7C] text-white shadow-md' : 'bg-slate-100 text-slate-400'
            }`}>
              3
            </div>
          </div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
            {isAr ? `الخطوة ${step} من 3` : `Step ${step} of 3`}
          </span>
        </div>

        {/* Content Area */}
        <div className="p-6 flex-1 flex flex-col justify-center text-right">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#FF3B7C]/10 text-[#FF3B7C] flex items-center justify-center mx-auto mb-3">
                    <User className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800">
                    {isAr ? 'ما هو اسمك الحقيقي؟' : 'What is your real name?'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                    {isAr
                      ? 'يرجى إدخال اسمك الحقيقي لبناء الثقة في مجتمع كويست'
                      : 'Please enter your real name to build trust in the Quest community'}
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs font-extrabold text-center">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 block text-right">
                    {isAr ? 'الاسم واللقب' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={realName}
                    onChange={(e) => {
                      setRealName(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder={isAr ? 'الاسم واللقب' : 'First and Last Name'}
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#FF3B7C] focus:bg-white focus:outline-none rounded-2xl py-3.5 px-4 text-sm font-black text-slate-800 transition-all text-center"
                    autoFocus
                  />
                </div>
              </motion.div>
            ) : step === 2 ? (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-[#FF3B7C]/10 text-[#FF3B7C] flex items-center justify-center mx-auto mb-3">
                    <Phone className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800">
                    {isAr ? 'ما هو رقم هاتفك؟' : 'What is your phone number?'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                    {isAr
                      ? 'يرجى إدخال رقم هاتفك للتواصل مع أصحاب الأعمال والمنفذين'
                      : 'Please enter your phone number to coordinate quests'}
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs font-extrabold text-center">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 block text-right">
                    {isAr ? 'رقم الهاتف' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    maxLength={10}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhone(val);
                      setErrorMsg('');
                    }}
                    placeholder=""
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#FF3B7C] focus:bg-white focus:outline-none rounded-2xl py-3.5 px-4 text-sm font-mono font-black text-slate-800 transition-all text-center tracking-wider"
                    autoFocus
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center space-y-1">
                  <div className="w-14 h-14 rounded-2xl bg-[#4FC3F7]/10 text-[#4FC3F7] flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-7 h-7 text-[#FF3B7C]" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800">
                    {isAr ? 'أين تسكن؟' : 'Where are you located?'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                    {isAr
                      ? 'اختر ولايتك وبلديتك لعرض الطلبات القريبة منك'
                      : 'Select your Wilaya and Commune to find nearby requests'}
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs font-extrabold text-center">
                    {errorMsg}
                  </div>
                )}

                {/* Wilaya Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block text-right">
                    {isAr ? 'الولاية' : 'Wilaya'}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedWilayaCode}
                      onChange={(e) => handleWilayaChange(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus:border-[#FF3B7C] focus:bg-white focus:outline-none rounded-2xl py-3 px-4 text-xs font-black text-slate-800 transition-all appearance-none text-right cursor-pointer"
                    >
                      {ALGERIA_WILAYAS.map((w) => (
                        <option key={w.code} value={w.code}>
                          {w.nameAr} ({w.nameFr})
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Commune / Municipality Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 block text-right">
                    {isAr ? 'البلدية' : 'Commune'}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCommune}
                      onChange={(e) => {
                        setSelectedCommune(e.target.value);
                        setErrorMsg('');
                      }}
                      className="w-full bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus:border-[#FF3B7C] focus:bg-white focus:outline-none rounded-2xl py-3 px-4 text-xs font-black text-slate-800 transition-all appearance-none text-right cursor-pointer"
                    >
                      {selectedWilaya.communes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg('');
                setStep(step === 2 ? 1 : 2);
              }}
              className="py-3 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold rounded-2xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <span>{isAr ? 'السابق' : 'Back'}</span>
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={handleNextStep1}
              className="w-full py-3.5 bg-[#1F2A44] hover:bg-[#1E2E4E] text-white font-black rounded-2xl text-xs transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isAr ? 'المتابعة' : 'Next'}</span>
              <ArrowLeft className="w-4 h-4 text-[#FFD34D]" />
            </button>
          ) : step === 2 ? (
            <button
              type="button"
              onClick={handleNextStep2}
              className="w-full py-3.5 bg-[#1F2A44] hover:bg-[#1E2E4E] text-white font-black rounded-2xl text-xs transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isAr ? 'المتابعة' : 'Next'}</span>
              <ArrowLeft className="w-4 h-4 text-[#FFD34D]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishStep3}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs transition-all shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{isAr ? 'حفظ وتأكيد' : 'Save & Confirm'}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingModal;
