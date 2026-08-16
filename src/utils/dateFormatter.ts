export function formatArabicDate(dateInput: string | number | Date | undefined, lang: 'ar' | 'fr' | 'en' = 'ar'): string {
  if (!dateInput) return lang === 'ar' ? 'الآن' : (lang === 'fr' ? 'À l\'instant' : 'Just now');
  if (typeof dateInput === 'string' && (dateInput.includes('منذ') || dateInput.includes('ago') || dateInput === 'الآن')) {
    return dateInput;
  }
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) {
    return lang === 'ar' ? 'الآن' : (lang === 'fr' ? "À l'instant" : 'Just now');
  }
  if (diffMins < 60) {
    return lang === 'ar' ? `منذ ${diffMins} دقيقة` : (lang === 'fr' ? `Il y a ${diffMins} min` : `${diffMins}m ago`);
  }

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // Time formatting
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  let period = '';

  if (lang === 'ar') {
    period = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    const hourStr = String(hours);
    const timeStr = `${hourStr}:${minutes} ${period}`;

    if (isToday) {
      return `اليوم، ${timeStr}`;
    }
    if (isYesterday) {
      return `أمس، ${timeStr}`;
    }

    const monthsAr = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${date.getDate()} ${monthsAr[date.getMonth()]}، ${timeStr}`;
  } else if (lang === 'fr') {
    const hourStr = String(hours).padStart(2, '0');
    const timeStr = `${hourStr}h${minutes}`;
    if (isToday) return `Aujourd'hui, ${timeStr}`;
    if (isYesterday) return `Hier, ${timeStr}`;
    const monthsFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${date.getDate()} ${monthsFr[date.getMonth()]}, ${timeStr}`;
  } else {
    // English
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hourStr = String(hours);
    const timeStr = `${hourStr}:${minutes} ${ampm}`;
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthsEn[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
  }
}

export function formatJoinedDate(dateInput?: string | Date, lang: 'ar' | 'fr' | 'en' = 'ar'): string {
  if (!dateInput) {
    if (lang === 'ar') return 'انضم حديثاً';
    if (lang === 'fr') return 'Rejoint récemment';
    return 'Joined recently';
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    if (lang === 'ar') return 'انضم حديثاً';
    if (lang === 'fr') return 'Rejoint récemment';
    return 'Joined recently';
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (lang === 'ar') {
    if (diffDays < 1) return 'انضم اليوم';
    if (diffDays === 1) return 'انضم أمس';
    if (diffDays < 7) return `انضم منذ ${diffDays} أيام`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      if (weeks <= 1) return 'انضم منذ أسبوع';
      if (weeks === 2) return 'انضم منذ أسبوعين';
      return `انضم منذ ${weeks} أسابيع`;
    }
    if (diffMonths < 12) {
      if (diffMonths <= 1) return 'انضم منذ شهر';
      if (diffMonths === 2) return 'انضم منذ شهرين';
      if (diffMonths >= 3 && diffMonths <= 10) return `انضم منذ ${diffMonths} أشهر`;
      return `انضم منذ ${diffMonths} شهراً`;
    }
    try {
      const formatter = new Intl.DateTimeFormat('ar-DZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return `انضم في ${formatter.format(date)}`;
    } catch {
      return `انضم في ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }
  } else if (lang === 'fr') {
    if (diffDays < 1) return "Rejoint aujourd'hui";
    if (diffDays === 1) return "Rejoint hier";
    if (diffDays < 30) return `Rejoint il y a ${diffDays} jours`;
    if (diffMonths < 12) return `Rejoint il y a ${diffMonths} mois`;
    try {
      const formatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      return `Rejoint le ${formatter.format(date)}`;
    } catch {
      return `Rejoint le ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }
  } else {
    if (diffDays < 1) return 'Joined today';
    if (diffDays === 1) return 'Joined yesterday';
    if (diffDays < 30) return `Joined ${diffDays} days ago`;
    if (diffMonths < 12) return `Joined ${diffMonths} months ago`;
    try {
      const formatter = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      return `Joined ${formatter.format(date)}`;
    } catch {
      return `Joined ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    }
  }
}

export function formatReviewDate(dateInput?: string | Date, lang: 'ar' | 'fr' | 'en' = 'ar'): string {
  if (!dateInput) {
    if (lang === 'ar') return 'حديثاً';
    if (lang === 'fr') return 'Récemment';
    return 'Recently';
  }

  if (typeof dateInput === 'string') {
    if (dateInput === 'الآن بالذات' || dateInput === 'Just Now' || dateInput === 'Just now') {
      return lang === 'ar' ? 'الآن' : (lang === 'fr' ? 'À l\'instant' : 'Just now');
    }
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (lang === 'ar') {
    if (diffMinutes < 5) return 'الآن';
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    if (diffWeeks === 1) return 'منذ أسبوع';
    if (diffWeeks === 2) return 'منذ أسبوعين';
    if (diffWeeks < 4) return `منذ ${diffWeeks} أسابيع`;
    if (diffMonths === 1) return 'منذ شهر';
    if (diffMonths === 2) return 'منذ شهرين';
    if (diffMonths < 12) return `منذ ${diffMonths} أشهر`;
    try {
      const formatter = new Intl.DateTimeFormat('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' });
      return formatter.format(date);
    } catch {
      return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }
  } else if (lang === 'fr') {
    if (diffMinutes < 5) return "À l'instant";
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    if (diffWeeks < 4) return `Il y a ${diffWeeks} sem`;
    if (diffMonths < 12) return `Il y a ${diffMonths} mois`;
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
  } else {
    if (diffMinutes < 5) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

