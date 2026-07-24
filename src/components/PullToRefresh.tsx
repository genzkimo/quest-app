import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { playConfirmSound, triggerHaptic } from '../utils/audio';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  lang?: 'ar' | 'fr' | 'en';
  audioEffectsEnabled?: boolean;
  hapticFeedbackEnabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  lang = 'ar',
  audioEffectsEnabled = true,
  hapticFeedbackEnabled = true,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');

  const startY = useRef(0);
  const currentY = useRef(0);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pullThreshold = 75; // Minimum px to trigger a refresh
  const maxPullDistance = 120; // Maximum visual pull distance

  const handleTouchStart = (e: TouchEvent) => {
    const container = containerRef.current;
    
    // Ignore pull-to-refresh if the touch started on Leaflet map or any explicitly marked container
    const target = e.target as HTMLElement;
    if (target && (target.closest('.leaflet-container') || target.closest('.no-pull-refresh'))) {
      return;
    }

    // We only trigger pull-to-refresh if both the viewport (window) and the container are scrolled to the absolute top
    const isAtTop = 
      window.scrollY <= 2 && 
      document.documentElement.scrollTop <= 2 && 
      document.body.scrollTop <= 2 && 
      (!container || container.scrollTop <= 2);

    if (isAtTop && pullState !== 'refreshing') {
      startY.current = e.touches[0].clientY;
      isPullingRef.current = true;
      setPullState('pulling');
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPullingRef.current || pullState === 'refreshing') return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 0) {
      // Prevent browser default pull-to-refresh behaviors in Chrome/Safari mobile
      if (e.cancelable) {
        e.preventDefault();
      }

      // Add dampening / physical resistance to the pull gesture
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, maxPullDistance);
      setPullDistance(distance);

      if (distance >= pullThreshold) {
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
    if (!isPullingRef.current || pullState === 'refreshing') return;
    isPullingRef.current = false;

    if (pullDistance >= pullThreshold) {
      setPullState('refreshing');
      setPullDistance(55); // Pin the indicator mid-air during loading state
      
      triggerHaptic('sharp', hapticFeedbackEnabled);
      playConfirmSound(audioEffectsEnabled);

      try {
        await onRefresh();
      } catch (error) {
        console.error('Pull-to-refresh action failed:', error);
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

    // Attach passive: false to touch listeners to allow preventDefault for smooth drag
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, pullState, audioEffectsEnabled, hapticFeedbackEnabled]);

  const getStatusText = () => {
    if (lang === 'ar') {
      if (pullState === 'pulling') return 'اسحب للتحديث...';
      if (pullState === 'ready') return 'أفلت للتحديث الآن!';
      if (pullState === 'refreshing') return 'جاري تحديث البيانات...';
    } else if (lang === 'fr') {
      if (pullState === 'pulling') return 'Tirez pour rafraîchir...';
      if (pullState === 'ready') return 'Relâchez pour rafraîchir !';
      if (pullState === 'refreshing') return 'Mise à jour en cours...';
    } else {
      if (pullState === 'pulling') return 'Pull down to refresh...';
      if (pullState === 'ready') return 'Release to refresh!';
      if (pullState === 'refreshing') return 'Updating content...';
    }
    return '';
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto">
      {/* Pull To Refresh Top Visual Panel */}
      <motion.div
        style={{ height: pullDistance }}
        animate={{ height: pullDistance }}
        transition={isPullingRef.current ? { type: 'just' } : { type: 'spring', stiffness: 220, damping: 26 }}
        className="overflow-hidden flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800"
      >
        <div className="flex flex-col items-center justify-center space-y-1.5 py-3">
          <motion.div
            animate={pullState === 'refreshing' ? { rotate: 360 } : { rotate: pullDistance * 4 }}
            transition={pullState === 'refreshing' ? { repeat: Infinity, duration: 1, ease: 'linear' } : undefined}
          >
            <RefreshCw className={`w-5 h-5 transition-colors duration-200 ${
              pullState === 'ready' ? 'text-[#FF3B7C]' : pullState === 'refreshing' ? 'text-emerald-500 animate-pulse' : 'text-sky-400'
            }`} />
          </motion.div>
          <span className="text-[10px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 select-none">
            {getStatusText()}
          </span>
        </div>
      </motion.div>
      
      {/* Content wrapper with elastic spring transition */}
      <motion.div
        animate={{ 
          y: pullState === 'refreshing' ? 0 : pullDistance * 0.2,
          scale: pullState === 'refreshing' ? 1 : 1 - (pullDistance * 0.0003)
        }}
        transition={isPullingRef.current ? { type: 'just' } : { type: 'spring', stiffness: 220, damping: 26 }}
        className="w-full"
      >
        {children}
      </motion.div>
    </div>
  );
}
