export function formatArabicDate(dateInput: string | Date | undefined, lang: 'ar' | 'fr' | 'en' = 'ar'): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const now = new Date();
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
    const hourStr = String(hours).padStart(2, '0');
    const timeStr = `${hourStr}:${minutes} ${period}`;

    if (isToday) {
      return `اليوم، ${timeStr}`;
    }
    if (isYesterday) {
      return `أمس، ${timeStr}`;
    }

    // Standard Algerian/North African month names
    try {
      const formatter = new Intl.DateTimeFormat('ar-DZ', {
        day: 'numeric',
        month: 'long',
      });
      return `${formatter.format(date)}، ${timeStr}`;
    } catch (e) {
      const monthsAr = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      return `${date.getDate()} ${monthsAr[date.getMonth()]}، ${timeStr}`;
    }
  } else if (lang === 'fr') {
    const hourStr = String(hours).padStart(2, '0');
    const timeStr = `${hourStr}h${minutes}`;
    if (isToday) return `Aujourd'hui, ${timeStr}`;
    if (isYesterday) return `Hier, ${timeStr}`;
    try {
      const formatter = new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'long',
      });
      return `${formatter.format(date)}, ${timeStr}`;
    } catch {
      return `${date.getDate()}/${date.getMonth() + 1}, ${timeStr}`;
    }
  } else {
    // English
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hourStr = String(hours).padStart(2, '0');
    const timeStr = `${hourStr}:${minutes} ${ampm}`;
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
      });
      return `${formatter.format(date)}, ${timeStr}`;
    } catch {
      return `${date.getMonth() + 1}/${date.getDate()}, ${timeStr}`;
    }
  }
}

export function formatJoinedDate(dateInput?: string | Date, lang: 'ar' | 'fr' | 'en' = 'ar'): string {
  if (!dateInput) {
    if (lang === 'ar') return 'تم الانضمام منذ فترة';
    if (lang === 'fr') return 'Rejoint il y a un moment';
    return 'Joined a while ago';
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return lang === 'ar' ? `تم الانضمام منذ ${dateInput}` : `Joined ${dateInput}`;
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (lang === 'ar') {
    let timeAgoStr = '';
    if (diffDays < 1) timeAgoStr = 'اليوم';
    else if (diffDays === 1) timeAgoStr = 'أمس';
    else if (diffDays < 7) timeAgoStr = `${diffDays} أيام`;
    else if (diffDays < 30) timeAgoStr = `${Math.floor(diffDays / 7)} أسابيع`;
    else if (diffMonths < 12) {
      if (diffMonths === 1) timeAgoStr = 'شهر';
      else if (diffMonths === 2) timeAgoStr = 'شهرين';
      else if (diffMonths >= 3 && diffMonths <= 10) timeAgoStr = `${diffMonths} أشهر`;
      else timeAgoStr = `${diffMonths} شهراً`;
    } else {
      if (diffYears === 1) timeAgoStr = 'سنة';
      else if (diffYears === 2) timeAgoStr = 'سنتين';
      else timeAgoStr = `${diffYears} سنوات`;
    }
    return `تم الانضمام منذ ${timeAgoStr}`;
  } else if (lang === 'fr') {
    let timeAgoStr = '';
    if (diffDays < 1) timeAgoStr = "aujourd'hui";
    else if (diffDays === 1) timeAgoStr = "hier";
    else if (diffDays < 30) timeAgoStr = `${diffDays} jours`;
    else if (diffMonths < 12) timeAgoStr = `${diffMonths} mois`;
    else timeAgoStr = `${diffYears} ans`;
    return `Rejoint il y a ${timeAgoStr}`;
  } else {
    let timeAgoStr = '';
    if (diffDays < 1) timeAgoStr = 'today';
    else if (diffDays === 1) timeAgoStr = 'yesterday';
    else if (diffDays < 30) timeAgoStr = `${diffDays} days ago`;
    else if (diffMonths < 12) timeAgoStr = `${diffMonths} months ago`;
    else timeAgoStr = `${diffYears} years ago`;
    return `Joined ${timeAgoStr}`;
  }
}

export function formatReviewDate(dateInput?: string | Date, lang: 'ar' | 'fr' | 'en' = 'ar'): string {
  if (!dateInput) {
    if (lang === 'ar') return 'حديثاً';
    if (lang === 'fr') return 'Récemment';
    return 'Recently';
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
    return date.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric' });
  } else if (lang === 'fr') {
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 30) return `Il y a ${diffDays} j`;
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
  } else {
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

