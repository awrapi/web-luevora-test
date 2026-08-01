/**
 * Helper untuk menentukan tampilan kontak:
 * - Jika nama sudah dikonfirmasi (saved_name): tampilkan NAMA sebagai
 *   baris utama (primary), dan nomor/ID/username platform sebagai baris kedua (secondary).
 * - Jika nama belum diketahui: tampilkan NOMOR (WA/Tele) atau @username (IG)
 *   sebagai baris utama. push_name (display name platform) sebagai baris kedua kecil.
 *
 * PENTING: push_name (nama profil WA/IG/TG) BUKAN nama yang dikonfirmasi.
 * Hanya saved_name yang boleh dipakai sebagai "nama" di header utama.
 */

export const formatPhone = (phone) => {
  if (!phone) return '-';
  let clean = String(phone).replace('@s.whatsapp.net', '');
  if (clean.startsWith('62')) return '0' + clean.substring(2);
  return clean;
};

/**
 * Tentukan apakah kontak ini berasal dari Instagram (bukan WA/Tele).
 * Kontak dianggap IG jika punya instagram_username dan TIDAK punya
 * whatsapp_phone / telegram_id / phone berupa angka.
 */
export const isInstagramContact = (item) => {
  if (!item) return false;
  const hasIg = !!item.instagram_username;
  const hasWa = !!item.whatsapp_phone;
  const hasTele = !!item.telegram_id;
  const hasNumericPhone = !!(item.phone && /^\d+$/.test(String(item.phone).replace('@s.whatsapp.net', '')));
  return hasIg && !hasWa && !hasTele && !hasNumericPhone;
};

/**
 * @param {object} item - lead/customer/contact object
 * @returns {{ primary: string, secondary: string|null, isIg: boolean }}
 *   primary   -> nama dikonfirmasi (saved_name) ATAU identifier platform sebagai fallback
 *   secondary -> identifier platform saat nama diketahui; push_name saat nama belum diketahui; null jika keduanya kosong
 */
export const getContactDisplay = (item) => {
  if (!item) return { primary: '-', secondary: null, isIg: false };

  const isIg = isInstagramContact(item);
  const hasIg = !!item.instagram_username;

  // Identifier platform (nomor WA / TG / @username IG)
  let identifier = '-';
  if (isIg) {
    identifier = `@${item.instagram_username}`;
  } else if (item.whatsapp_phone) {
    identifier = formatPhone(item.whatsapp_phone);
  } else if (item.telegram_id) {
    identifier = item.telegram_id;
  } else if (item.phone && /^\d+$/.test(String(item.phone).replace('@s.whatsapp.net', ''))) {
    identifier = formatPhone(item.phone);
  } else if (hasIg) {
    identifier = `@${item.instagram_username}`;
  } else if (item.phone) {
    identifier = item.phone;
  }

  // Nama — HANYA saved_name yang dianggap sebagai nama dikonfirmasi.
  // push_name (display name platform) TIDAK dipakai sebagai nama utama.
  const confirmedName = item.saved_name || null;

  if (confirmedName) {
    // Nama dikonfirmasi → nama sebagai primary, identifier sebagai secondary
    return { primary: confirmedName, secondary: identifier, isIg };
  } else {
    // Nama belum dikonfirmasi → identifier sebagai primary,
    // push_name sebagai secondary (tulisan kecil) jika ada
    const pushName = item.push_name || item.first_name || null;
    return { primary: identifier, secondary: pushName, isIg };
  }
};

export default getContactDisplay;
