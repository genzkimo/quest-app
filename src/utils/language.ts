export type SupportedLanguage = 'ar' | 'fr' | 'en';

/**
 * Detects the user's device / browser language.
 * Returns 'en' if English, 'fr' if French, and defaults to 'ar' for Arabic or any other language.
 */
export function getDeviceLanguage(): SupportedLanguage {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'ar';
  }

  const rawLangs: string[] = [];
  if (navigator.languages && navigator.languages.length > 0) {
    rawLangs.push(...navigator.languages);
  }
  if (navigator.language) {
    rawLangs.push(navigator.language);
  }
  if ((navigator as any).userLanguage) {
    rawLangs.push((navigator as any).userLanguage);
  }

  for (const l of rawLangs) {
    if (!l) continue;
    const lower = l.toLowerCase().trim();
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('ar')) return 'ar';
  }

  // Default fallback is Arabic
  return 'ar';
}

