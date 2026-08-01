/**
 * ================================================================
 * Business Type Configuration
 * ================================================================
 * Maps each business_type to its layout, routes, and navigation.
 * Navigation is grouped into:
 * 1. Main (Dashboard, Leads, etc.)
 * 2. Store (Business assets + Knowledge Base + Banking)
 * 3. System (Connect + Config)
 * ================================================================
 */

const SHARED_SYSTEM_MENU = [
  { path: '/connect-platform', label: 'Connect Platform', icon: 'Share2' },
  { path: '/configuration', label: 'Configuration', icon: 'Settings' },
  { path: '/billing', label: 'AI Billing', icon: 'Wallet' },
];

const SHARED_STORE_ITEMS = [
  { path: '/knowledge-base', label: 'Knowledge Base', icon: 'Database' },
];

const SHARED_INBOX_ITEMS = [
  { path: '/notifications', label: 'Notifikasi', icon: 'Bell' },
  { path: '/leads', label: 'Leads Inbox', icon: 'Inbox' },
  { path: '/customers', label: 'Customer Chat', icon: 'MessageSquare' },
  { path: '/email', label: 'Email Inbox', icon: 'Mail' },
];

const SHARED_MAIN_ITEMS = [
  { path: '/transactions', label: 'Transactions', icon: 'ClipboardCheck' },
  { path: '/customer-list', label: 'Customer Data', icon: 'Users' },
  { path: '/crm-database', label: 'CRM Database', icon: 'Contact' },
  { path: '/offers', label: 'Offers', icon: 'Tag' },
];

export const BUSINESS_TYPES = {
  course: {
    key: 'course',
    label: 'Course / Les',
    layoutComponent: 'CourseLayout',
    navGroups: [
      {
        group: 'Main',
        items: [
          { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
          { path: '/schedule', label: 'Jadwal', icon: 'Calendar' },
          { path: '/reschedule', label: 'Reschedule', icon: 'RefreshCw' },
          ...SHARED_MAIN_ITEMS
        ]
      },
      {
        group: 'Inbox',
        items: SHARED_INBOX_ITEMS
      },
      {
        group: 'Store',
        items: [
          { path: '/products', label: 'Daftar Kursus', icon: 'BookOpen' },
          ...SHARED_STORE_ITEMS
        ]
      },
      {
        group: 'System',
        items: SHARED_SYSTEM_MENU
      }
    ],
  },

  rent: {
    key: 'rent',
    label: 'Rental / Sewa',
    layoutComponent: 'RentalLayout',
    navGroups: [
      {
        group: 'Main',
        items: [
          { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
          { path: '/rental-requests', label: 'Rental Requests', icon: 'Package' },
          ...SHARED_MAIN_ITEMS
        ]
      },
      {
        group: 'Inbox',
        items: SHARED_INBOX_ITEMS
      },
      {
        group: 'Store',
        items: [
          { path: '/assets', label: 'Aset / Inventaris', icon: 'Box' },
          ...SHARED_STORE_ITEMS
        ]
      },
      {
        group: 'System',
        items: SHARED_SYSTEM_MENU
      }
    ],
  },

  retail: {
    key: 'retail',
    label: 'Retail / Toko',
    layoutComponent: 'RetailLayout',
    navGroups: [
      {
        group: 'Main',
        items: [
          { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
          ...SHARED_MAIN_ITEMS
        ]
      },
      {
        group: 'Inbox',
        items: SHARED_INBOX_ITEMS
      },
      {
        group: 'Store',
        items: [
          { path: '/inventory', label: 'Inventaris Toko', icon: 'Package' },
          ...SHARED_STORE_ITEMS
        ]
      },
      {
        group: 'System',
        items: SHARED_SYSTEM_MENU
      }
    ],
  },

  travel: {
    key: 'travel',
    label: 'Travel / Wisata',
    layoutComponent: 'TravelLayout',
    navGroups: [
      {
        group: 'Main',
        items: [
          { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
          { path: '/central-info', label: 'Central Information', icon: 'Activity' },
          { path: '/transactions', label: 'Transactions', icon: 'ClipboardCheck' },
          { path: '/customer-list', label: 'Customer Data', icon: 'Users' },
          { path: '/crm-database', label: 'CRM Database', icon: 'Contact' },
        ]
      },
      {
        group: 'Inbox',
        items: SHARED_INBOX_ITEMS
      },
      {
        group: 'Store',
        items: [
          { path: '/bookings', label: 'Inventory', icon: 'MapPin' },
          ...SHARED_STORE_ITEMS
        ]
      },
      {
        group: 'System',
        items: SHARED_SYSTEM_MENU
      }
    ],
  },
};

export const getBusinessConfig = (type) => {
  return BUSINESS_TYPES[type] || BUSINESS_TYPES.travel;
};

export default BUSINESS_TYPES;
