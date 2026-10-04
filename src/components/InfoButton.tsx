import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface InfoButtonProps {
  title: string;
  explanation: string;
  className?: string;
  iconClassName?: string;
}

export default function InfoButton({
  title,
  explanation,
  className = '',
  iconClassName = 'w-3.5 h-3.5',
}: InfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={`inline-flex items-center justify-center p-1 rounded-full text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-colors cursor-pointer select-none active:scale-90 ${className}`}
        title={title}
      >
        <Info className={iconClassName} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-4 shadow-xl max-w-xs w-full text-right space-y-2.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 bg-sky-50 dark:bg-sky-950/50 text-[#4FC3F7] rounded-lg">
                    <Info className="w-4 h-4 text-[#4FC3F7]" />
                  </div>
                  <h4 className="font-extrabold text-xs text-[#1F2A44] dark:text-white">
                    {title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                {explanation}
              </p>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-1.5 bg-[#1F2A44] text-white text-[11px] font-bold rounded-xl transition-all active:scale-95 cursor-pointer mt-1"
              >
                حسناً، فهمت
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
