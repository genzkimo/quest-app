import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Trophy, Sparkles, Smile, MessageSquare, Handshake } from 'lucide-react';
import { Quest, UserProfile, HunterReview, GodfatherReview } from '../types';

interface ReciprocalRatingModalProps {
  questId: string;
  quests: Quest[];
  userProfile: UserProfile;
  onSaveHunterReview: (review: HunterReview) => void;
  onSaveGodfatherReview: (review: GodfatherReview) => void;
}

export default function ReciprocalRatingModal({
  questId,
  quests,
  userProfile,
  onSaveHunterReview,
  onSaveGodfatherReview,
}: ReciprocalRatingModalProps) {
  const quest = quests.find(q => q.id === questId);
  if (!quest) return null;

  const isRtl = userProfile.language === 'ar';

  // Determine role in this quest
  const isGodfather = quest.creatorId === userProfile.id;
  const isRunner = quest.helperId === userProfile.id || quest.assignedRunnerId === userProfile.id;

  // Rating and comment state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Suggested quick review badges/keywords depending on role
  const runnerKeywords = [
    isRtl ? 'سرعة خارقة ⚡' : 'Flash speed ⚡',
    isRtl ? 'بطل أمين وملتزم 🛡️' : 'Honest hero 🛡️',
    isRtl ? 'تواصل ممتاز ومميز 📞' : 'Great response 📞',
    isRtl ? 'تنفيذ فاق التوقعات 🎯' : 'Exceeded limits 🎯',
    isRtl ? 'أنصح بالتعامل معه جزيلاً 🌟' : 'Highly recommend 🌟',
  ];

  const godfatherKeywords = [
    isRtl ? 'دفع سخي وفوري 💸' : 'Generous payout 💸',
    isRtl ? 'تنسيق قمة في الرقي 🤝' : 'Top coordinator 🤝',
    isRtl ? 'تواصل غاية في السرعة ⚡' : 'Speedy logs ⚡',
    isRtl ? 'طلب واضح وسهل التنفيذ 🏆' : 'Pragmatic clear info 🏆',
    isRtl ? 'عميل رائع وراقي جداً 🌟' : 'Splendid client 🌟',
  ];

  const keywords = isGodfather ? runnerKeywords : godfatherKeywords;

  const handleKeywordClick = (kw: string) => {
    if (comment.includes(kw)) return;
    setComment(prev => (prev ? `${prev} | ${kw}` : kw));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const defaultComment = isRtl
      ? 'تقييم متبادل ناجح وموثق عبر بروتوكول منصة كويست.'
      : 'Successful reciprocal evaluation recorded on Quest platform.';
    const finalComment = comment.trim() || defaultComment;

    // Simulate slight delay for beautiful loading animation
    setTimeout(() => {
      if (isGodfather) {
        // Godfather rates the Runner (Hunter)
        const recipientId = quest.helperId || quest.assignedRunnerId || 'hunter-1';
        const newReview: HunterReview = {
          reviewId: `rev-${quest.id}`,
          hunterId: recipientId,
          godfatherId: userProfile.id,
          godfatherName: userProfile.name,
          godfatherAvatar: userProfile.avatar,
          completedTaskImage: quest.proofImageUrl || (quest.imageUrls && quest.imageUrls[0]) || 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600',
          rating,
          comment: finalComment,
          createdAt: isRtl ? 'الآن بالذات' : 'Just now',
        };
        onSaveHunterReview(newReview);
      } else if (isRunner) {
        // Runner rates the Godfather (Arab / Creator)
        const recipientId = quest.creatorId;
        const newReview: GodfatherReview = {
          reviewId: `g-rev-${quest.id}`,
          godfatherId: recipientId,
          hunterId: userProfile.id,
          hunterName: userProfile.name,
          hunterAvatar: userProfile.avatar,
          completedTaskImage: quest.proofImageUrl || (quest.imageUrls && quest.imageUrls[0]) || 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600',
          rating,
          comment: finalComment,
          createdAt: isRtl ? 'الآن بالذات' : 'Just now',
        };
        onSaveGodfatherReview(newReview);
      }
    }, 1200);
  };

  // If user is neither godfather nor helper, do not block screen
  if (!isGodfather && !isRunner) return null;

  const targetName = isGodfather 
    ? (quest.helperName || (isRtl ? 'العامل المنفذ' : 'Worker')) 
    : (quest.creatorName || (isRtl ? 'صاحب الكويست' : 'Work poster'));

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-950/95 z-[9999] flex items-center justify-center p-4 overflow-y-auto select-none"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Subtle decoration background gradients */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl -z-10"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#1F2A44]/10 rounded-full blur-2xl -z-10"></div>

          {/* Header Title with animated stars */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-amber-50 rounded-2xl text-amber-500 animate-pulse">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-black text-[#1F2A44] leading-snug">
              {isRtl ? 'التقييم المشترك المتبادل 🤝' : 'Reciprocal Mutual Evaluation 🤝'}
            </h2>
            <p className="text-xs text-slate-500 font-bold leading-relaxed px-4">
              {isRtl 
                ? 'بناءً على بروتوكول الأمان لـ "كويست"، يُرجى تقييم الطرف الآخر لتوثيق نقاط السمعة وبناء الثقة المتبادلة.'
                : 'Under the Quest guidelines, both parties must evaluate each other to build mutual trust indexes.'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3.5 flex-row-reverse">
            <div className="w-11 h-11 bg-[#1F2A44] text-[#FFD34D] rounded-full flex items-center justify-center font-black text-sm uppercase">
              {targetName.substring(0, 2)}
            </div>
            <div className="flex-1 text-right">
              <span className="text-[9px] bg-[#1F2A44]/10 text-[#1F2A44] px-2 py-0.5 rounded font-black tracking-wider uppercase mb-1 inline-block">
                {isGodfather 
                  ? (isRtl ? 'العامل' : 'WORKER')
                  : (isRtl ? 'صاحب العمل' : ' CLIENT')}
              </span>
              <h4 className="text-sm font-black text-slate-800 leading-none">{targetName}</h4>
            </div>
          </div>

          {/* Form container */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-5 text-right">
              {/* Star Rating Selectors */}
              <div className="space-y-2 text-center">
                <label className="text-xs font-black text-[#1F2A44] block">
                  {isRtl ? 'كم نجمة يستحق شريكك في الكويست؟ ⭐' : 'How many stars does your partner deserve? ⭐'}
                </label>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="transition-transform active:scale-90 hover:scale-110 cursor-pointer p-1"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          star <= rating 
                            ? 'text-amber-400 fill-amber-400 drop-shadow-sm' 
                            : 'text-gray-300'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mt-1">
                  {rating === 5 && (isRtl ? 'ممتاز واحترافي للغايه 🌟' : 'EXCELLENT & SPECTACULAR 🌟')}
                  {rating === 4 && (isRtl ? 'جيد جداً ومتجاوب 👍' : 'VERY GOOD & RESPONSIVE 👍')}
                  {rating === 3 && (isRtl ? 'مقبول ويلبي المعايير 👌' : 'ACCEPTABLE STANDARDS 👌')}
                  {rating <= 2 && (isRtl ? 'يحتاج إلى تحسين ⚠️' : 'NEEDS MODERATION ATTENTION ⚠️')}
                </div>
              </div>

              {/* Badges keywords suggestion tags */}
              <div className="space-y-2">
                <label className="text-xs font-black text-[#1F2A44] flex items-center justify-end gap-1">
                  <span>{isRtl ? 'كلمات مفتاحية سريعة:' : 'Quick review badges:'}</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </label>
                <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                  {keywords.map((kw, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleKeywordClick(kw)}
                      className="bg-slate-50 hover:bg-[#1F2A44]/15 hover:border-[#1F2A44]/25 text-xs text-slate-700 font-extrabold px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer transition-all"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback comment box */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#1F2A44] flex items-center justify-end gap-1">
                  <span>{isRtl ? 'تفاصيل المراجعة والتقييم:' : 'Detailed feedback report:'}</span>
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    isRtl 
                      ? 'اكتب بضع كلمات بصدق لتوجيه المشرفين ومكافأة السمعة...' 
                      : 'Share a sincere evaluation of your reciprocal run logs...'
                  }
                  required
                  rows={3}
                  className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-[#1F2A44] focus:outline-none transition-all placeholder:text-gray-300"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#1F2A44] hover:bg-[#1F2A44]/95 text-[#FFD34D] rounded-2xl text-xs font-black shadow-lg shadow-blue-950/15 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1 transition-all"
              >
                <Handshake className="w-4 h-4" />
                <span>{isRtl ? 'تأكيد وبث التقييم المتبادل ⚡' : 'Sign & Broadcast Mutual Review ⚡'}</span>
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-4 animate-scaleUp">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-inner text-emerald-500">
                <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <h3 className="text-base font-black text-[#1F2A44]">
                {isRtl ? 'جاري بث التقييم المشفر لقاعدة البيانات...' : 'Broadcasting encrypted trust records...'}
              </h3>
              <p className="text-xs text-slate-400 font-bold leading-normal">
                {isRtl 
                  ? 'تم تأكيد الدعم والتوقيع الرقمي بنجاح متبادل. سيقوم بروتوكول كويست بتحديث مؤشرات الثقة وحساب الشارات فورياً!'
                  : 'Reciprocal rating successfully stamped. Trust scores and badges will adapt instantly.'}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
