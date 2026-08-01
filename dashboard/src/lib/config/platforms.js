/**
 * Platform definitions for Connect Platform page.
 * Migrated from legacy admin.php connect-platform tab.
 *
 * To integrate a real platform:
 *   1. Set `available: true`
 *   2. Implement `checkStatus()` in ConnectPlatform.jsx
 *   3. Implement `onConnect()` handler
 */
export const PLATFORMS = [
  {
    id: 'meta', // Dipertahankan 'meta' untuk backend compatibility
    title: 'Zernio WhatsApp',
    subtitle: 'Unified Messaging API',
    icon: 'MessageCircle',
    iconBg: 'bg-green-600',
    borderColor: 'border-green-200',
    available: true,
    description: 'Hubungkan WhatsApp Business API Resmi melalui Zernio. Semua koneksi dan manajemen auth dilakukan melalui sistem OAuth Zernio.',
    chips: [
      { label: 'WhatsApp', color: 'text-green-600', dotColor: 'bg-green-500' },
      { label: 'Zernio', icon: 'Zap' },
    ],
  },
  {
    id: 'instagram',
    title: 'Zernio Instagram',
    subtitle: 'Unified Messaging API',
    icon: 'Instagram',
    iconBg: 'bg-pink-600',
    borderColor: 'border-pink-300',
    available: true,
    description: 'Terima dan balas Direct Message (DM) Instagram secara otomatis menggunakan agen AI, di-handle melalui Zernio API.',
    chips: [
      { label: 'Instagram DM', icon: 'Instagram' },
      { label: 'Zernio', icon: 'Zap' },
    ],
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    subtitle: 'Telegram Bot API',
    icon: 'Send',
    iconBg: 'bg-sky-500',
    borderColor: 'border-sky-200',
    available: true,
    description: 'Hubungkan Telegram Bot API resmi untuk menerima dan membalas pesan kustomer dengan kapabilitas AI.',
    chips: [
      { label: 'Telegram', icon: 'Send' },
      { label: 'Bot API', icon: 'Cpu' },
    ],
  },
  {
    id: 'email',
    title: 'Email Integration',
    subtitle: 'IMAP & SMTP Server',
    icon: 'Mail',
    iconBg: 'bg-indigo-600',
    borderColor: 'border-indigo-300',
    available: true,
    description: 'Hubungkan server Email bisnis Anda melalui IMAP/SMTP untuk menerima dan mengirim pesan langsung dari CRM beserta fitur AI Auto-Reply.',
    chips: [
      { label: 'IMAP', icon: 'Download' },
      { label: 'SMTP', icon: 'Upload' },
    ],
  },
  {
    id: 'tiktok',
    title: 'TikTok',
    subtitle: 'TikTok Shop & DM',
    icon: 'Music2',
    iconBg: 'bg-gray-900',
    borderColor: 'border-gray-200',
    available: false,
    description: 'Terima dan balas pesan dari TikTok DM dan TikTok Shop secara otomatis. Integrasi TikTok Business API sedang dalam pengembangan.',
    chips: [
      { label: 'TikTok DM', icon: 'Music2' },
      { label: 'TikTok Shop', icon: 'Store' },
    ],
  },
  {
    id: 'line',
    title: 'LINE',
    subtitle: 'LINE Messaging API',
    icon: 'MessageSquare',
    iconBg: 'bg-green-500',
    borderColor: 'border-green-200',
    available: false,
    description: 'Integrasi dengan LINE Official Account untuk menerima dan membalas pesan. Sedang dalam tahap pengembangan.',
    chips: [
      { label: 'LINE Official', icon: 'MessageSquare' },
    ],
  },
];
