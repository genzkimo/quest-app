// Bulletproof scroll-locking utility that freezes background scrolling on mobile & desktop
// without causing layout shifts, scroll jumps, or stranding fixed modals at the top of the page.

let lockCount = 0;
let prevBodyOverflow = '';
let prevDocOverflow = '';
let prevBodyTouchAction = '';

const preventBackgroundTouch = (e: TouchEvent) => {
  const target = e.target as HTMLElement | null;
  // Allow scrolling only inside elements explicitly marked as scrollable or with overscroll-contain inside the modal
  if (target && (target.closest('[data-allow-scroll="true"]') || target.closest('.modal-scroll-area'))) {
    return;
  }
  if (e.cancelable) {
    e.preventDefault();
  }
};

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) {
    prevBodyOverflow = document.body.style.overflow;
    prevDocOverflow = document.documentElement.style.overflow;
    prevBodyTouchAction = document.body.style.touchAction;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Prevent background touch scrolling on mobile (especially on shaded backdrop areas)
    window.addEventListener('touchmove', preventBackgroundTouch, { passive: false });
  }
  lockCount++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0) {
      document.documentElement.style.overflow = prevDocOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.touchAction = prevBodyTouchAction;
      window.removeEventListener('touchmove', preventBackgroundTouch);
    }
  };
}
