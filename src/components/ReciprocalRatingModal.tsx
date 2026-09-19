import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star } from 'lucide-react';
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
  const isRunner = quest.helperId === userProfile.id || quest.assignedRunnerId === userProfile.id || quest.employeeId === userProfile.id || quest.assignedRunnerIds?.includes(userProfile.id);

  // If user is neither godfather nor helper, do not block screen
  if (!isGodfather && !isRunner) return null;

  // Rating and comment state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const defaultComment = isRtl ? 'تم التقييم بنجاح' : 'Evaluation submitted successfully.';
    const finalComment = comment.trim() || defaultComment;

    setTimeout(() => {
      if (isGodfather) {
        // Godfather rates the Worker
        const recipientId = quest.employeeId || quest.helperId || quest.assignedRunnerId || (quest.assignedRunnerIds && quest.assignedRunnerIds[0]) || 'worker-1';
        const newReview: HunterReview = {
          reviewId: `rev-${quest.id}`,
          hunterId: recipientId,
          godfatherId: userProfile.id,
          godfatherName: userProfile.name,
          godfatherAvatar: userProfile.avatar,
          completedTaskImage: quest.proofImageUrl || (quest.imageUrls && quest.imageUrls[0]) || 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600',
          rating,
          comment: finalComment,
          createdAt: new Date().toISOString(),
        };
        onSaveHunterReview(newReview);
      } else if (isRunner) {
        // Worker rates the Godfather/Creator
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
          createdAt: new Date().toISOString(),
        };
        onSaveGodfatherReview(newReview);
      }
    }, 400);
  };

  const targetName = isGodfather 
    ? (quest.helperName || (isRtl ? 'العامل المنفذ' : 'Worker')) 
    : (quest.creatorName || (isRtl ? 'صاحب العمل' : 'Employer'));

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto select-none"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl space-y-5 text-right relative"
        >
          {/* Target User Info Header */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1F2A44] text-[#FFD34D] rounded-full flex items-center justify-center font-black text-sm uppercase shrink-0">
              {targetName.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] bg-[#1F2A44]/10 text-[#1F2A44] px-2 py-0.5 rounded font-black tracking-wider uppercase mb-0.5 inline-block">
                {isGodfather 
                  ? (isRtl ? 'العامل' : 'Worker')
                  : (isRtl ? 'صاحب العمل' : 'Employer')}
              </span>
              <h4 className="text-sm font-black text-slate-800 truncate">{targetName}</h4>
            </div>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Section */}
              <div className="space-y-2 text-center">
                <label className="text-xs font-black text-[#1F2A44] block">
                  {isRtl ? 'كم نجمة يستحق شريكك؟' : 'How many stars does your partner deserve?'}
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
              </div>

              {/* Feedback Comment Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#1F2A44] block">
                  {isRtl ? 'التفاصيل' : 'Details'}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    isRtl 
                      ? 'اكتب التفاصيل والملاحظات...' 
                      : 'Write details and feedback...'
                  }
                  required
                  rows={3}
                  className="w-full text-xs font-semibold p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-[#1F2A44] focus:outline-none transition-all placeholder:text-gray-300"
                />
              </div>

              {/* Submit Button - Strictly "تأكيد" */}
              <button
                type="submit"
                className="w-full py-3.5 bg-[#1F2A44] hover:bg-[#1E2E4E] text-[#FFD34D] rounded-2xl text-xs font-black shadow-lg shadow-[#1F2A44]/15 cursor-pointer uppercase transition-all"
              >
                {isRtl ? 'تأكيد' : 'Confirm'}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-2">
              <h3 className="text-sm font-black text-[#1F2A44]">
                {isRtl ? 'تم التقييم بنجاح' : 'Evaluation Submitted'}
              </h3>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
