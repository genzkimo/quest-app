/**
 * Helper utility to convert coordinates and location strings to simplified, readable text
 * (Neighborhood, City, District) instead of raw numeric latitude/longitude coordinates or ISO symbols.
 */

export function cleanLocationName(
 location?: string,
 coords?: { lat: number; lng: number } | null,
 fallbackWilaya: string = 'الجزائر العاصمة',
 lang: 'ar' | 'fr' | 'en' = 'ar'
): string {
 // 1. If coordinates object provided and location is missing or coordinate-based
 if (coords && (!location || isCoordinateString(location))) {
 return resolveNeighborhoodFromCoords(coords.lat, coords.lng, fallbackWilaya, lang);
 }

 // 2. If location is missing
 if (!location || location.trim() === '' || location === 'N/A') {
 return fallbackWilaya;
 }

 // 3. If location string contains raw coordinates like "Lat: 36.7525, Lng: 3.0420" or "36.7525, 3.0420"
 if (isCoordinateString(location)) {
 const extracted = extractCoordsFromString(location);
 if (extracted) {
 return resolveNeighborhoodFromCoords(extracted.lat, extracted.lng, fallbackWilaya, lang);
 }
 return fallbackWilaya;
 }

 // 4. Already a clean text location (e.g., "حي الياسمين، وهران" or "باب الزوار، الجزائر")
 return location.trim();
}

export function isCoordinateString(str: string): boolean {
 if (!str) return false;
 const lower = str.toLowerCase();
 return (
 lower.includes('lat:') ||
 lower.includes('lng:') ||
 lower.includes('tagged:') ||
 /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(str.trim())
 );
}

export function extractCoordsFromString(str: string): { lat: number; lng: number } | null {
 try {
 const matches = str.match(/(-?\d+\.\d+)/g);
 if (matches && matches.length >= 2) {
 const lat = parseFloat(matches[0]);
 const lng = parseFloat(matches[1]);
 if (!isNaN(lat) && !isNaN(lng)) {
 return { lat, lng };
 }
 }
 } catch {
 // ignore
 }
 return null;
}

/**
 * Maps lat/lng in Algeria to friendly district/neighborhood names in text.
 */
export function resolveNeighborhoodFromCoords(
 lat: number,
 lng: number,
 fallbackWilaya: string = '',
 lang: 'ar' | 'fr' | 'en' = 'ar'
): string {
 // Ben Srour / M'Sila Region (35.0 to 35.8 N, 4.0 to 5.0 E)
 if (lat >= 35.0 && lat <= 35.8 && lng >= 4.0 && lng <= 5.0) {
 if (lat >= 35.10 && lat <= 35.30 && lng >= 4.40 && lng <= 4.70) {
 return lang === 'ar' ? 'بن سرور، المسيلة' : 'Ben Srour, M\'Sila';
 }
 return lang === 'ar' ? 'المسيلة' : 'M\'Sila';
 }

 // Algiers Region (36.65 to 36.85 N, 2.8 to 3.3 E)
 if (lat >= 36.65 && lat <= 36.85 && lng >= 2.8 && lng <= 3.3) {
 if (lat >= 36.75 && lng >= 3.15) return lang === 'ar' ? 'باب الزوار، الجزائر' : 'Bab Ezzouar, Alger';
 if (lat >= 36.74 && lng >= 3.03 && lng <= 3.10) return lang === 'ar' ? 'حيدرة، الجزائر' : 'Hydra, Alger';
 if (lat >= 36.77 && lng >= 3.04 && lng <= 3.08) return lang === 'ar' ? 'الجزائر وسط (شارع ديدوش)' : 'Alger Centre';
 if (lat >= 36.78 && lng >= 3.05) return lang === 'ar' ? 'القصبة وباب الوادي' : 'Casbah / Bab El Oued';
 if (lat >= 36.72 && lng >= 3.08) return lang === 'ar' ? 'القبة، الجزائر' : 'Kouba, Alger';
 if (lat >= 36.73 && lng >= 3.20) return lang === 'ar' ? 'الدار البيضاء وبرج الكيفان' : 'Dar El Beïda, Alger';
 if (lat >= 36.70 && lng <= 3.00) return lang === 'ar' ? 'الشراقة ودالي إبراهيم' : 'Chéraga / Dély Ibrahim';
 return lang === 'ar' ? 'الجزائر العاصمة' : 'Alger';
 }

 // Oran Region (35.50 to 35.85 N, -0.80 to -0.40 E)
 if (lat >= 35.50 && lat <= 35.85 && lng >= -0.80 && lng <= -0.40) {
 if (lat >= 35.68 && lng >= -0.63) return lang === 'ar' ? 'حي عقيد لطفي، وهران' : 'Akid Lotfi, Oran';
 if (lat >= 35.65 && lng <= -0.62) return lang === 'ar' ? 'السانية ووسط مدينة وهران' : 'Es Sénia / Oran Centre';
 return lang === 'ar' ? 'ولاية وهران' : 'Oran';
 }

 // Constantine Region (36.25 to 36.45 N, 6.50 to 6.75 E)
 if (lat >= 36.25 && lat <= 36.45 && lng >= 6.50 && lng <= 6.75) {
 return lang === 'ar' ? 'قسنطينة' : 'Constantine';
 }

 // Annaba
 if (lat >= 36.80 && lat <= 37.00 && lng >= 7.60 && lng <= 7.90) {
 return lang === 'ar' ? 'عنابة' : 'Annaba';
 }

 // Blida
 if (lat >= 36.35 && lat <= 36.60 && lng >= 2.70 && lng <= 3.00) {
 return lang === 'ar' ? 'البليدة' : 'Blida';
 }

 // Setif
 if (lat >= 36.10 && lat <= 36.30 && lng >= 5.30 && lng <= 5.55) {
 return lang === 'ar' ? 'سطيف' : 'Sétif';
 }

 // General fallback by wilaya name if available, else standard text
 if (fallbackWilaya && !isCoordinateString(fallbackWilaya)) {
 return `${fallbackWilaya}`;
 }

 return lang === 'ar' ? 'موقع جغرافي محدد' : 'Tagged Location';
}

/**
 * Resolves city/wilaya name only (without street/neighborhood precision).
 * Used when GPS location is coarse/inaccurate to show only the city.
 */
export function resolveCityFromCoords(
 lat: number,
 lng: number,
 lang: 'ar' | 'fr' | 'en' = 'ar'
): string {
 // Algiers Region (36.60 to 36.88 N, 2.8 to 3.35 E)
 if (lat >= 36.60 && lat <= 36.88 && lng >= 2.80 && lng <= 3.35) {
 return lang === 'ar' ? 'الجزائر العاصمة' : 'Alger';
 }
 // Oran Region (35.50 to 35.85 N, -0.80 to -0.40 E)
 if (lat >= 35.50 && lat <= 35.85 && lng >= -0.80 && lng <= -0.40) {
 return lang === 'ar' ? 'وهران' : 'Oran';
 }
 // Constantine Region (36.25 to 36.45 N, 6.50 to 6.75 E)
 if (lat >= 36.25 && lat <= 36.45 && lng >= 6.50 && lng <= 6.75) {
 return lang === 'ar' ? 'قسنطينة' : 'Constantine';
 }
 // M'Sila / Ben Srour Region (35.0 to 35.8 N, 4.0 to 5.0 E)
 if (lat >= 35.0 && lat <= 35.8 && lng >= 4.0 && lng <= 5.0) {
 return lang === 'ar' ? 'المسيلة' : 'M\'Sila';
 }
 // Annaba
 if (lat >= 36.80 && lat <= 37.00 && lng >= 7.60 && lng <= 7.90) {
 return lang === 'ar' ? 'عنابة' : 'Annaba';
 }
 // Blida
 if (lat >= 36.35 && lat <= 36.60 && lng >= 2.70 && lng <= 3.00) {
 return lang === 'ar' ? 'البليدة' : 'Blida';
 }
 // Setif
 if (lat >= 36.10 && lat <= 36.30 && lng >= 5.30 && lng <= 5.55) {
 return lang === 'ar' ? 'سطيف' : 'Sétif';
 }
 // Batna
 if (lat >= 35.45 && lat <= 35.70 && lng >= 6.05 && lng <= 6.35) {
 return lang === 'ar' ? 'باتنة' : 'Batna';
 }
 // Tlemcen
 if (lat >= 34.80 && lat <= 35.00 && lng >= -1.45 && lng <= -1.15) {
 return lang === 'ar' ? 'تلمسان' : 'Tlemcen';
 }
 // Bejaia
 if (lat >= 36.65 && lat <= 36.85 && lng >= 4.95 && lng <= 5.20) {
 return lang === 'ar' ? 'بجاية' : 'Béjaïa';
 }
 // Biskra
 if (lat >= 34.75 && lat <= 35.00 && lng >= 5.60 && lng <= 5.85) {
 return lang === 'ar' ? 'بسكرة' : 'Biskra';
 }
 // Tizi Ouzou
 if (lat >= 36.60 && lat <= 36.80 && lng >= 3.95 && lng <= 4.20) {
 return lang === 'ar' ? 'تيزي وزو' : 'Tizi Ouzou';
 }
 // Djelfa
 if (lat >= 34.55 && lat <= 34.80 && lng >= 3.15 && lng <= 3.40) {
 return lang === 'ar' ? 'الجلفة' : 'Djelfa';
 }
 // Chlef
 if (lat >= 36.10 && lat <= 36.30 && lng >= 1.20 && lng <= 1.45) {
 return lang === 'ar' ? 'الشلف' : 'Chlef';
 }
 // Tiaret
 if (lat >= 35.25 && lat <= 35.50 && lng >= 1.20 && lng <= 1.50) {
 return lang === 'ar' ? 'تيارت' : 'Tiaret';
 }
 // Ghardaia
 if (lat >= 32.35 && lat <= 32.60 && lng >= 3.55 && lng <= 3.85) {
 return lang === 'ar' ? 'غرداية' : 'Ghardaïa';
 }
 // Ouargla
 if (lat >= 31.80 && lat <= 32.10 && lng >= 5.20 && lng <= 6.20) {
 return lang === 'ar' ? 'ورقلة' : 'Ouargla';
 }
 // Fallback within Algerian borders
 if (lat >= 19.0 && lat <= 37.2 && lng >= -8.5 && lng <= 12.0) {
 return lang === 'ar' ? 'مدينة جزائرية' : 'Algerian City';
 }
 return lang === 'ar' ? 'المدينة' : 'City';
}
