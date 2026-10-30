// Bulletproof scroll-locking utility that freezes background scrolling on mobile & desktop
// without causing layout shifts, scroll jumps, or stranding fixed modals at the top of the page.

let lockCount = 0;
let prevBodyOverflow = '';
let prevDocOverflow = '';
let prevBodyTouchAction = '';

/**
 * Checks whether an element or any of its ancestors is an intended scroll container.
 * This guarantees that content inside modals or full-screen views (like reviews or public profile)
 * can always be freely scrolled on touch devices.
 */
function isScrollableElement(el: HTMLElement | null): boolean {
  if (!el) return false;
  let curr: HTMLElement | null = el;

  while (curr && curr !== document.body && curr !== document.documentElement) {
    if (curr.getAttribute('data-allow-scroll') === 'true' || curr.classList.contains('modal-scroll-area')) {
      return true;
    }

    const className = typeof curr.className === 'string' ? curr.className : '';
    if (
      className.includes('overflow-y-auto') ||
      className.includes('overflow-auto') ||
      className.includes('overflow-y-scroll') ||
      className.includes('overflow-scroll')
    ) {
      return true;
    }

    try {
      const style = window.getComputedStyle(curr);
      const oy = style.overflowY;
      const ox = style.overflowX;
      if (oy === 'auto' || oy === 'scroll' || ox === 'auto' || ox === 'scroll') {
        if (curr.scrollHeight > curr.clientHeight || curr.scrollWidth > curr.clientWidth) {
          return true;
        }
      }
    } catch {
      // Ignore errors in reading computed styles
    }

    curr = curr.parentElement;
  }

  return false;
}

const preventBackgroundTouch = (e: TouchEvent) => {
  const target = e.target as HTMLElement | null;

  // If the touch target is inside any scrollable container, never prevent scroll!
  if (isScrollableElement(target)) {
    return;
  }

  // Only prevent default on non-scrollable backdrop areas
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

    // Prevent background touch scrolling on mobile (only on shaded non-scrollable backdrop areas)
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

/**
 * Emergency reset to safely clear any leaked lock states across view transitions.
 */
export function forceUnlockAllScroll(): void {
  if (typeof document === 'undefined') return;
  lockCount = 0;
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  window.removeEventListener('touchmove', preventBackgroundTouch);
}
