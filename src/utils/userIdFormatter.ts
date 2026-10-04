/**
 * Utility to format and generate 12-character user identifiers.
 * Standard format: "QST-" + 8 alphanumeric characters = 12 characters (e.g. "QST-9X2M8K4P").
 */

export const generateShortId12 = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `QST-${code}`; // exactly 12 characters
};

export const formatDisplayId12 = (user?: { shortId?: string; id?: string } | string | null): string => {
  if (!user) return 'QST-00000000';
  
  if (typeof user === 'string') {
    const clean = user.trim().toUpperCase();
    if (clean.startsWith('QST-') && clean.length === 12) return clean;
    if (clean.length === 12) return clean;
    const alphanumeric = clean.replace(/[^A-Z0-9]/g, '');
    if (alphanumeric.startsWith('QST')) {
      return (alphanumeric.slice(0, 3) + '-' + alphanumeric.slice(3, 11)).padEnd(12, '0');
    }
    return `QST-${alphanumeric.slice(0, 8).padEnd(8, '0')}`;
  }

  const shortId = user.shortId?.trim().toUpperCase();
  if (shortId) {
    if (shortId.startsWith('QST-') && shortId.length === 12) {
      return shortId;
    }
    if (shortId.length === 12) {
      return shortId;
    }
    // If it's an older 8-char shortId (e.g. QST-ABCD), extend deterministically to 12 chars using user.id
    if (shortId.startsWith('QST-')) {
      const extraPart = (user.id || 'QUESTSYNDICATE').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const needed = 12 - shortId.length;
      return shortId + extraPart.slice(0, needed).padEnd(needed, '0');
    }
    const alphanumeric = shortId.replace(/[^A-Z0-9]/g, '');
    return `QST-${alphanumeric.slice(0, 8).padEnd(8, '0')}`;
  }

  if (user.id) {
    const cleanUid = user.id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `QST-${cleanUid.slice(0, 8).padEnd(8, '0')}`;
  }

  return 'QST-00000000';
};
