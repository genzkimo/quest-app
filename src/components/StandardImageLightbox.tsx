import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { lockBodyScroll } from '../utils/scrollLock';

export interface StandardImageLightboxProps {
  imageUrl: string | null;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  caption?: string;
  badge?: React.ReactNode;
  lang?: 'ar' | 'en' | string;
}

export default function StandardImageLightbox({
  imageUrl,
  onClose,
  title,
  subtitle,
  caption,
  badge,
  lang = 'ar'
}: StandardImageLightboxProps) {
  const isRtl = lang === 'ar';

  useEffect(() => {
    if (imageUrl) {
      return lockBodyScroll();
    }
  }, [imageUrl]);

  return (
    <AnimatePresence>
      {imageUrl && (
        <div
          className="fixed inset-0 bg-black/85 dark:bg-black/95 backdrop-blur-md z-[100000] flex flex-col items-center justify-center p-3 sm:p-4 overscroll-contain select-none animate-fadeIn"
          style={{ touchAction: 'none' }}
          onClick={onClose}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="max-w-sm sm:max-w-md w-full bg-white dark:bg-[#151F32] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
            style={{ touchAction: 'pan-y' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Connected Instagram-style Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-slate-800/80 bg-white dark:bg-[#151F32]">
              {/* Close Button + Badge */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-90"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                {badge}
              </div>

              {/* Title / Info */}
              <div className="text-right">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                  {title || (isRtl ? 'معاينة الصورة' : 'Image Preview')}
                </h4>
                {subtitle && (
                  <span className="text-[10px] text-gray-400 dark:text-slate-400 font-medium block">
                    {subtitle}
                  </span>
                )}
              </div>
            </div>

            {/* 2. Connected 3:4 Aspect Ratio Photo (Standard Pinch to zoom + Pan, Strictly bounded) */}
            <div className="w-full aspect-[3/4] relative bg-black overflow-hidden flex items-center justify-center select-none touch-none">
              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={4}
                centerOnInit={true}
                centerZoomedOut={true}
                limitToBounds={true}
                doubleClick={{ disabled: false, mode: 'toggle', step: 1.5 }}
                panning={{ disabled: false }}
                pinch={{ disabled: false }}
              >
                <TransformComponent
                  wrapperClass="!w-full !h-full flex items-center justify-center overflow-hidden"
                  contentClass="!w-full !h-full flex items-center justify-center"
                >
                  <img
                    src={imageUrl}
                    alt={title || 'Preview'}
                    className="w-full h-full object-contain pointer-events-auto select-none"
                    referrerPolicy="no-referrer"
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>

            {/* 3. Connected Instagram-style Caption Footer */}
            {caption && (
              <div className="px-4 py-3 bg-white dark:bg-[#151F32] border-t border-gray-100 dark:border-slate-800/80 text-right">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line line-clamp-3">
                  {caption}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
