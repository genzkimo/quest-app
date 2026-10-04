import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { playConfirmSound, triggerHaptic } from '../utils/audio';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  lang?: 'ar' | 'fr' | 'en';
  audioEffectsEnabled?: boolean;
  hapticFeedbackEnabled?: boolean;
  className?: string;
}

/**
 * WorkerHammeringMascot (المحاولة الثانية المحسنة)
 * Animated cartoon construction worker hammering a nail into wood.
 * - طبقة المسمار تحت طبقة الخشبة: The nail is rendered behind the wood plank so it drives into/under it.
 * - زيادة العرض وإزالة القص: Wider viewBox and container with overflow-visible to prevent any clipping.
 * - تصغير الحجم قليلاً: Scaled to 0.88 - 0.92 for optimal crispness.
 */
function WorkerHammeringMascot({
  pullState,
  progress,
}: {
  pullState: 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success';
  progress: number;
}) {
  const isRefreshing = pullState === 'refreshing';
  const isReady = pullState === 'ready';
  const isSuccess = pullState === 'success';

  return (
    <div className="flex flex-col items-center justify-center select-none pointer-events-none py-1 w-full overflow-visible">
      <motion.div
        animate={
          isRefreshing
            ? { scale: 0.88, y: [0, -2.5, 1, 0], transition: { repeat: Infinity, duration: 0.32, ease: 'easeInOut' } }
            : isSuccess
            ? { scale: [0.88, 0.95, 0.88], y: -2, transition: { duration: 0.35 } }
            : isReady
            ? { scale: 0.92, y: -2 }
            : { scale: Math.max(0.66, 0.66 + progress * 0.22) }
        }
        className="relative w-56 h-20 flex items-center justify-center overflow-visible"
      >
        <svg 
          className="w-56 h-20 overflow-visible" 
          viewBox="-12 -4 146 70" 
          fill="none"
        >
          {/* Ground Soft Ambient Shadow */}
          <ellipse cx="60" cy="58" rx="50" ry="3.5" fill="#B45309" opacity="0.25" />

          {/* ======================================================== */}
          {/* 1. THE NAIL (المسمار - طبقة المسمار تحت طبقة الخشبة)    */}
          {/* Rendered BEFORE the wooden plank so the stem is behind    */}
          {/* ======================================================== */}
          <motion.g
            animate={
              isSuccess
                ? { y: 10.5 } // Driven flush into the wood!
                : isRefreshing
                ? { y: [0, 2, 4, 3, 0] } // Vibrating & driving deeper with strikes
                : { y: Math.min(progress * 4, 4) }
            }
            transition={
              isSuccess
                ? { type: 'spring', stiffness: 260, damping: 18 }
                : isRefreshing
                ? { repeat: Infinity, duration: 0.32, ease: 'easeOut' }
                : { duration: 0 }
            }
          >
            {/* Nail Stem / Point (Renders UNDER the wooden plank) */}
            <line
              x1="88"
              y1="35"
              x2="88"
              y2="48"
              stroke="#64748B"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Metallic Nail Head */}
            <rect
              x="83"
              y="32"
              width="10"
              height="3.2"
              rx="1"
              fill="#94A3B8"
              stroke="#475569"
              strokeWidth="1"
            />

            {/* Flash / Glint on Nail Head upon successful completion */}
            {isSuccess && (
              <path
                d="M84 33.5 L88 33.5"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </motion.g>

          {/* ======================================================== */}
          {/* 2. WOODEN WORK PLANK (قطعة الخشب - فوق المسمار)          */}
          {/* Placed AFTER the nail so it covers the stem realistically*/}
          {/* ======================================================== */}
          <g>
            {/* Main Wooden Plank */}
            <rect
              x="68"
              y="45"
              width="44"
              height="13"
              rx="3"
              fill="#D97706"
              stroke="#92400E"
              strokeWidth="1.5"
            />
            {/* Wood Grain Lines */}
            <line x1="72" y1="49" x2="108" y2="49" stroke="#B45309" strokeWidth="1" strokeLinecap="round" />
            <line x1="74" y1="53" x2="102" y2="53" stroke="#B45309" strokeWidth="1" strokeLinecap="round" />
          </g>

          {/* Success Checkmark & "DONE" Badge above the hammered nail (on top of plank) */}
          {isSuccess && (
            <motion.g
              initial={{ scale: 0, y: 5 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.1 }}
              transform="translate(88, 22)"
            >
              {/* Green Victory Badge */}
              <circle cx="0" cy="0" r="9" fill="#10B981" stroke="#059669" strokeWidth="1.5" />
              {/* Checkmark */}
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, delay: 0.15 }}
                d="M-3.5 0 L-1 3 L4 -3"
                stroke="#FFFFFF"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </motion.g>
          )}

          {/* ======================================================== */}
          {/* 3. HAMMER STRIKE SPARKS (شرارات الطرق أثناء التحديث)      */}
          {/* ======================================================== */}
          {isRefreshing && (
            <>
              <motion.path
                animate={{
                  scale: [0, 1.4, 0],
                  opacity: [0, 1, 0],
                  x: [-1, -4, -7],
                  y: [0, -3, -6],
                }}
                transition={{ repeat: Infinity, duration: 0.32, ease: 'easeOut' }}
                d="M84 31 L85 33 L87 34 L85 35 L84 37 L83 35 L81 34 L83 33 Z"
                fill="#F59E0B"
                style={{ transformOrigin: '84px 34px' }}
              />
              <motion.path
                animate={{
                  scale: [0, 1.3, 0],
                  opacity: [0, 1, 0],
                  x: [1, 5, 8],
                  y: [0, -4, -7],
                }}
                transition={{ repeat: Infinity, duration: 0.32, delay: 0.08, ease: 'easeOut' }}
                d="M88 29 L89 31 L91 32 L89 33 L88 35 L87 33 L85 32 L87 31 Z"
                fill="#EF4444"
                style={{ transformOrigin: '88px 32px' }}
              />
            </>
          )}

          {/* ======================================================== */}
          {/* 4. THE HANDYMAN / WORKER (العامل الكرتوني)               */}
          {/* ======================================================== */}
          {/* Work Boots */}
          <ellipse cx="32" cy="55" rx="4.8" ry="2.8" fill="#1F2A44" />
          <ellipse cx="42" cy="55" rx="4.8" ry="2.8" fill="#1F2A44" />

          {/* Work Dungarees / Overalls */}
          <rect
            x="27"
            y="34"
            width="20"
            height="18"
            rx="5"
            fill="#1F2A44"
            stroke="#0F172A"
            strokeWidth="1.5"
          />

          {/* Orange Work Shirt / Collar */}
          <path d="M29 34 L37 40 L45 34" fill="#EA580C" />

          {/* Cyan Overalls Straps */}
          <rect x="29" y="34" width="3" height="8" rx="1" fill="#0284C7" />
          <rect x="42" y="34" width="3" height="8" rx="1" fill="#0284C7" />
          <circle cx="30.5" cy="39" r="0.8" fill="#F8FAFC" />
          <circle cx="43.5" cy="39" r="0.8" fill="#F8FAFC" />

          {/* Front Tool Pocket with mini pencil / tool */}
          <rect x="32" y="42" width="10" height="7" rx="2" fill="#0F172A" />
          <line x1="35" y1="39" x2="35" y2="43" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="39" y1="38" x2="39" y2="43" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />

          {/* Worker Head & Face */}
          <circle
            cx="37"
            cy="23"
            r="10"
            fill="#FDDCB5"
            stroke="#1F2A44"
            strokeWidth="1.5"
          />

          {/* Rosy Cheeks */}
          <circle cx="30.5" cy="26" r="2" fill="#FF3B7C" opacity="0.75" />
          <circle cx="43.5" cy="26" r="2" fill="#FF3B7C" opacity="0.75" />

          {/* Expressive Eyes */}
          {isSuccess ? (
            /* Joyful Closed Crescent Eyes (⌒ ⌒) indicating proud accomplishment */
            <>
              <path d="M31 23 Q34 19 37 23" stroke="#1F2A44" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M38 23 Q41 19 44 23" stroke="#1F2A44" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : isRefreshing ? (
            /* Concentrating & Focused Hammering Eyes (> <) */
            <>
              <path d="M31 22 L36 24 L31 26" stroke="#1F2A44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M44 22 L39 24 L44 26" stroke="#1F2A44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          ) : isReady ? (
            /* Wide Focused Eyes ready to strike */
            <>
              <circle cx="34" cy="22" r="2.8" fill="#1F2A44" />
              <circle cx="33" cy="21" r="1.1" fill="#FFFFFF" />
              <circle cx="41" cy="22" r="2.8" fill="#1F2A44" />
              <circle cx="40" cy="21" r="1.1" fill="#FFFFFF" />
            </>
          ) : (
            /* Normal Friendly Eyes looking towards the nail */
            <>
              <circle cx="34" cy="22" r="2.4" fill="#1F2A44" />
              <circle cx="35" cy="21" r="0.9" fill="#FFFFFF" />
              <circle cx="41" cy="22" r="2.4" fill="#1F2A44" />
              <circle cx="42" cy="21" r="0.9" fill="#FFFFFF" />
            </>
          )}

          {/* Mouth */}
          {isSuccess ? (
            /* Big Proud Smile: "تم بنجاح!" */
            <path d="M33 27 Q37 33 41 27" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" fill="#EF4444" />
          ) : isRefreshing ? (
            /* Determined teeth-gritting / strike expression */
            <path d="M34 26 Q38 29 41 26" stroke="#1F2A44" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          ) : isReady ? (
            <ellipse cx="37" cy="27" rx="2" ry="2.4" fill="#1F2A44" />
          ) : (
            <ellipse cx="37" cy="27" rx="1.6" ry={1 + progress * 1.2} fill="#1F2A44" />
          )}

          {/* Safety Hard-Hat / Builder Helmet (خوذة الأمان) */}
          <path
            d="M24 20 C24 9 50 9 50 20 Z"
            fill="#EA580C"
            stroke="#1F2A44"
            strokeWidth="1.8"
          />
          <path
            d="M22 20 C22 18 52 18 52 20 L50 22 L24 22 Z"
            fill="#F97316"
            stroke="#1F2A44"
            strokeWidth="1.5"
          />
          {/* Reflective Strip */}
          <path
            d="M27 15 Q37 11 47 15"
            stroke="#FEF08A"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="37" cy="15" r="2.2" fill="#FFFFFF" stroke="#1F2A44" strokeWidth="1" />

          {/* ======================================================== */}
          {/* 5. GESTURE OF COMPLETION ("حركة تدل على أنه تم")          */}
          {/* Left Arm: Thumbs up gesture on completion!              */}
          {/* ======================================================== */}
          {isSuccess ? (
            <motion.g
              initial={{ scale: 0, x: 5 }}
              animate={{ scale: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              transform="translate(25, 34)"
            >
              {/* Arm reaching out with thumbs up */}
              <path d="M3 6 L-5 4 L-8 1" stroke="#EA580C" strokeWidth="4.2" strokeLinecap="round" fill="none" />
              {/* Glove / Fist */}
              <circle cx="-8" cy="1" r="3.2" fill="#FDDCB5" stroke="#1F2A44" strokeWidth="1.2" />
              {/* Clear Thumbs Up pointing upwards */}
              <path d="M-8 1 L-8 -4.5" stroke="#FDDCB5" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M-8 1 L-8 -4.5" stroke="#1F2A44" strokeWidth="1" strokeLinecap="round" />
            </motion.g>
          ) : (
            /* Left hand resting on waist during pulling/hammering */
            <path d="M27 38 C23 41 23 45 26 47" stroke="#1F2A44" strokeWidth="2.8" strokeLinecap="round" fill="none" />
          )}

          {/* ======================================================== */}
          {/* 6. RIGHT ARM & HAMMER (يطرق المسمار بنشاط ثم يريح المطرقة)*/}
          {/* ======================================================== */}
          <motion.g
            animate={
              isSuccess
                ? { rotate: -65, y: -4 } // Rests hammer proudly on shoulder
                : isRefreshing
                ? { rotate: [-55, 14, -55] } // Energetic hammer striking down on the nail!
                : isReady
                ? { rotate: -25 }
                : { rotate: progress * -30 }
            }
            transition={
              isSuccess
                ? { type: 'spring', stiffness: 220, damping: 18 }
                : isRefreshing
                ? { repeat: Infinity, duration: 0.32, ease: 'easeInOut' }
                : { type: 'spring', stiffness: 200, damping: 20 }
            }
            style={{ transformOrigin: '46px 35px' }}
          >
            {/* Worker Arm */}
            <path
              d="M46 35 Q56 31 66 33"
              stroke="#EA580C"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Hand holding hammer */}
            <circle cx="66" cy="33" r="3" fill="#FDDCB5" stroke="#1F2A44" strokeWidth="1" />

            {/* Hammer (المطرقة) */}
            <g transform="translate(66, 33) rotate(-18)">
              {/* Wooden Handle */}
              <line x1="0" y1="0" x2="18" y2="0" stroke="#78350F" strokeWidth="3.2" strokeLinecap="round" />
              {/* Steel Hammer Head */}
              <rect x="15" y="-8" width="7" height="16" rx="1.5" fill="#475569" stroke="#1E293B" strokeWidth="1.2" />
              {/* Striking Face */}
              <rect x="22" y="-7" width="2.5" height="14" rx="0.8" fill="#94A3B8" />
              {/* Claw */}
              <path d="M15 -6 C10 -8 8 -5 7 -2" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            </g>
          </motion.g>

          {/* ======================================================== */}
          {/* 7. CELEBRATION SPARKLES ON SUCCESS                       */}
          {/* ======================================================== */}
          {isSuccess && (
            <>
              <motion.path
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25 }}
                d="M16 16 L17 18 L19 19 L17 20 L16 22 L15 20 L13 19 L15 18 Z"
                fill="#059669"
              />
              <motion.path
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                d="M104 14 L105 16 L107 17 L105 18 L104 20 L103 18 L101 17 L103 16 Z"
                fill="#F59E0B"
              />
              <circle cx="56" cy="16" r="1.8" fill="#F59E0B" />
              <circle cx="108" cy="38" r="1.5" fill="#059669" />
            </>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

export default function PullToRefresh({
  onRefresh,
  children,
  audioEffectsEnabled = true,
  hapticFeedbackEnabled = true,
  className = '',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing' | 'success'>('idle');

  const startY = useRef(0);
  const currentY = useRef(0);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dead-zone: do not show indicator or trigger on slight drags (< 28px)
  const activationThreshold = 28; 
  // Increased pull threshold & max pull distance for generous animation visibility
  const pullThreshold = 98; // Increased pull distance to show animation nicely
  const maxPullDistance = 135; // Generous maximum visual pull offset

  const handleTouchStart = (e: TouchEvent) => {
    const container = containerRef.current;
    
    // Ignore pull-to-refresh if the touch started on Leaflet map, input, modal or marked container
    const target = e.target as HTMLElement;
    if (target && (target.closest('.leaflet-container') || target.closest('.no-pull-refresh') || target.closest('input') || target.closest('textarea') || target.closest('select'))) {
      return;
    }

    // Trigger only if scrolled to the absolute top
    const isAtTop = 
      window.scrollY <= 2 && 
      document.documentElement.scrollTop <= 2 && 
      document.body.scrollTop <= 2 && 
      (!container || container.scrollTop <= 2);

    if (isAtTop && pullState !== 'refreshing' && pullState !== 'success') {
      startY.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPullingRef.current || pullState === 'refreshing' || pullState === 'success') return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) {
      const resistance = 0.44;
      const rawDistance = diff * resistance;

      // Dead zone: do not start pulling or prevent default on tiny swipes
      if (rawDistance < activationThreshold) {
        setPullDistance(0);
        if (pullState !== 'idle') setPullState('idle');
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      // Smooth offset starting above the activation threshold
      const distance = Math.min(rawDistance - activationThreshold, maxPullDistance);
      setPullDistance(distance);

      if (distance >= (pullThreshold - activationThreshold)) {
        if (pullState !== 'ready') {
          setPullState('ready');
          triggerHaptic('soft', hapticFeedbackEnabled);
        }
      } else {
        if (pullState !== 'pulling') {
          setPullState('pulling');
        }
      }
    } else {
      isPullingRef.current = false;
      setPullDistance(0);
      setPullState('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || pullState === 'refreshing' || pullState === 'success') return;
    isPullingRef.current = false;

    if (pullDistance >= (pullThreshold - activationThreshold)) {
      setPullState('refreshing');
      setPullDistance(86); // Hold yellow mascot area during refresh
      
      triggerHaptic('sharp', hapticFeedbackEnabled);
      playConfirmSound(audioEffectsEnabled);

      try {
        await onRefresh();
        setPullState('success');
        triggerHaptic('sharp', hapticFeedbackEnabled);
        await new Promise((resolve) => setTimeout(resolve, 600));
      } catch (error) {
        console.error('Pull-to-refresh failed:', error);
      } finally {
        setPullState('idle');
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
      setPullState('idle');
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, pullState, audioEffectsEnabled, hapticFeedbackEnabled]);

  // Normalized progress from 0 to 1
  const progress = Math.min(
    Math.max(pullDistance / (pullThreshold - activationThreshold), 0),
    1
  );

  // The yellow strip is ONLY revealed when pulling or actively refreshing
  // When idle, it does NOT exist (completely hidden from DOM, 0 height, no border line)
  const isRevealed = 
    (pullDistance > 0 && (pullState === 'pulling' || pullState === 'ready')) || 
    pullState === 'refreshing' || 
    pullState === 'success';

  return (
    <div 
      ref={containerRef} 
      className={`w-full min-w-full relative overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ width: '100%', maxWidth: '100%' }}
    >
      {/* 
        The Yellow Pull Gap:
        Hidden completely when idle (does not exist in layout).
        Revealed ONLY on intentional pull or during active refresh,
        filling the entire screen width (w-full min-w-full) edge-to-edge with vibrant Algerian yellow (#FFD34D).
        Featuring the Cartoon Construction Worker hammering a nail, then gesturing "Done / Completed!".
      */}
      {isRevealed && (
        <div
          className="w-full min-w-full bg-[#FFD34D] dark:bg-[#E5A812] overflow-hidden flex items-center justify-center relative select-none pointer-events-none border-b-2 border-amber-500/30 shadow-inner"
          style={{
            height: pullState === 'refreshing' || pullState === 'success' 
              ? 86 
              : pullDistance,
            transition: isPullingRef.current ? 'none' : 'height 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
        >
          <WorkerHammeringMascot pullState={pullState} progress={progress} />
        </div>
      )}

      {/* Page Content */}
      <div 
        className="w-full min-w-full overflow-x-hidden relative"
        style={{ width: '100%', maxWidth: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}
