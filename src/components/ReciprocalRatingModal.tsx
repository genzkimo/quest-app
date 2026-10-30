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

  const lang = userProfile.language || 'ar';
  const isRtl = lang === 'ar';

  // Determine role in this quest
  const isGodfather = quest.creatorId === userProfile.id;
  const isRunner = quest.helperId === userProfile.id || 
                   quest.assignedRunnerId === userProfile.id || 
                   quest.employeeId === userProfile.id || 
                   quest.assignedRunnerIds?.includes(userProfile.id);

  if (!isGodfather && !isRunner) return null;

  // Rating and comment state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Target Name only
  const targetName = isGodfather
    ? (quest.helperName || (isRtl ? 'العامل' : 'Worker'))
    : (quest.creatorName || (isRtl ? 'صاحب العمل' : 'Employer'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const defaultComment = isGodfather
      ? (isRtl ? 'تم التقييم بنجاح' : 'Evaluation submitted successfully.')
      : (isRtl ? 'تم التقييم بنجاح' : 'Evaluation submitted successfully.');

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
    }, 300);
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-y-auto"
        style={{ direction: isRtl ? 'rtl' : 'ltr' }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl text-center space-y-4 relative"
        >
          {/* 1. اسم العامل أو صاحب العمل فقط */}
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {targetName}
          </h3>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 2. شريط النجوم فقط */}
              <div className="flex items-center justify-center gap-1.5 py-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition-transform active:scale-90 hover:scale-110"
                  >
                    <Star 
                      className={`w-8 h-8 transition-colors ${
                        star <= rating 
                          ? 'text-amber-400 fill-amber-400' 
                          : 'text-slate-200 dark:text-slate-700'
                      }`} 
                    />
                  </button>
                ))}
              </div>

              {/* 3. حقل إدخال الملاحظات فقط */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={isRtl ? 'الملاحظات...' : 'Notes...'}
                rows={3}
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold focus:outline-none focus:border-amber-400 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
              />

              {/* 4. زر إرسال فقط */}
              <button
                type="submit"
                className="w-full py-3 bg-[#1F2A44] hover:bg-[#152037] text-white dark:bg-amber-400 dark:hover:bg-amber-500 dark:text-slate-950 font-black rounded-2xl text-xs shadow-md transition-all cursor-pointer active:scale-98"
              >
                {isRtl ? 'إرسال' : 'Submit'}
              </button>
            </form>
          ) : (
            <div className="py-4 text-center">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {isRtl ? 'تم الإرسال بنجاح' : 'Submitted successfully'}
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
