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
