/**
 * ================================================================
 * Router Configuration
 * ================================================================
 * Defines ALL routes grouped by business type.
 * The LayoutResolver in App.jsx dynamically wraps these routes
 * with the correct layout based on the tenant's business_type.
 *
 * Route Groups:
 *   - SHARED: Available to all business types
 *   - COURSE: Only for business_type = 'course'
 *   - RENTAL: Only for business_type = 'rental'
 *   - RETAIL: Only for business_type = 'retail'
 *   - TRAVEL: Only for business_type = 'travel'
 * ================================================================
 */

// ===== SHARED PAGES =====
import Dashboard from '@/pages/shared/Dashboard';
import AdminDashboard from '@/pages/shared/AdminDashboard';
import LeadsInbox from '@/pages/shared/LeadsInbox';
import CustomerList from '@/pages/shared/CustomerList';
import CustomerChat from '@/pages/shared/CustomerChat';
import FormerCustomers from '@/pages/shared/FormerCustomers';
import Copilot from '@/pages/shared/Copilot';
import Analytics from '@/pages/shared/Analytics';
import EmailInbox from '@/pages/shared/EmailInbox';
import WASession from '@/pages/shared/WASession';
import Login from '@/features/auth/pages/Login';
import Register from '@/features/auth/pages/Register';
import VerifyEmail from '@/features/auth/pages/VerifyEmail';
import LandingPage from '@/pages/main/LandingPage';
import PrivacyPolicy from '@/pages/main/PrivacyPolicy';
import TermsOfService from '@/pages/main/TermsOfService';
import FoundingAccess from '@/pages/main/FoundingAccess';
import NotFound from '@/pages/shared/NotFound';
import KnowledgeBase from '@/pages/shared/KnowledgeBase';
import ConnectPlatform from '@/pages/shared/ConnectPlatform';
import Configuration from '@/pages/shared/Configuration';
import InstagramCallback from '@/pages/shared/InstagramCallback';
import ZernioCallback from '@/pages/shared/ZernioCallback';
import Products from '@/pages/shared/Products';
import CRMDatabase from '@/pages/shared/CRMDatabase';
import Offers from '@/pages/Offers';
import NotificationCenter from '@/pages/shared/NotificationCenter';
import Billing from '@/pages/shared/Billing';
import Plans from '@/features/subscription/pages/Plans';

// ===== COURSE PAGES =====
import CourseDashboard from '@/pages/course/CourseDashboard';
import Schedule from '@/pages/course/schedule/schedule';
import Reschedule from '@/pages/course/Reschedule';
import DateRequests from '@/pages/course/DateRequests';
import CourseList from '@/pages/course/CourseList';

// ===== RENTAL PAGES =====
import RentalDashboard from '@/pages/rental/RentalDashboard';
import RentalRequests from '@/pages/rental/RentalRequests';
import AssetManagement from '@/pages/rental/AssetManagement';

// ===== RETAIL PAGES =====
import RetailDashboard from '@/pages/retail/RetailDashboard';
import Inventory from '@/pages/retail/Inventory';

// ===== TRAVEL PAGES =====
import TravelDashboard from '@/pages/travel/TravelDashboard';
import TravelBookings from '@/pages/travel/TravelBookings';
import CustomerRequests from '@/pages/travel/CustomerRequests';
import Transactions from '@/pages/travel/Transactions';
import CentralInfo from '@/pages/travel/CentralInfo';

/**
 * Shared routes — accessible by ALL business types.
 * These are mounted inside the dynamically resolved layout.
 */
export const sharedRoutes = [
  { index: true, element: <Dashboard /> },
  { path: 'dashboard', element: <Dashboard /> },
  { path: 'admin', element: <AdminDashboard /> },
  { path: 'leads', element: <LeadsInbox /> },
  { path: 'customers', element: <CustomerChat /> },
  { path: 'customer-chat', element: <CustomerChat /> },
  { path: 'email', element: <EmailInbox /> },
  { path: 'former-customers', element: <FormerCustomers /> },
  { path: 'copilot', element: <Copilot /> },
  { path: 'analytics', element: <Analytics /> },
  { path: 'wa-session', element: <WASession /> },

  // New Shared System/Store Routes
  { path: 'knowledge-base', element: <KnowledgeBase /> },
  { path: 'connect-platform', element: <ConnectPlatform /> },
  { path: 'configuration', element: <Configuration /> },

  // New Shared Main Routes
  { path: 'notifications', element: <NotificationCenter /> },
  { path: 'transactions', element: <Transactions /> },
  { path: 'customer-list', element: <CustomerList /> },
  { path: 'crm-database', element: <CRMDatabase /> },
  { path: 'offers', element: <Offers /> },
  { path: 'billing', element: <Billing /> },
  { path: 'instagram-callback', element: <InstagramCallback /> },
  { path: 'zernio-callback', element: <ZernioCallback /> },
  { path: 'subscription', element: <Plans /> },
];

/**
 * Business-type-specific routes.
 * Only loaded when the tenant's business_type matches.
 */
export const businessRoutes = {
  course: [
    { path: 'dashboard', element: <CourseDashboard /> },
    { path: 'schedule', element: <Schedule /> },
    { path: 'reschedule', element: <Reschedule /> },
    { path: 'date-requests', element: <DateRequests /> },
    { path: 'products', element: <Products /> },
    { path: 'courses', element: <CourseList /> },
  ],

  rent: [
    { path: 'dashboard', element: <RentalDashboard /> },
    { path: 'rental-requests', element: <RentalRequests /> },
    { path: 'assets', element: <AssetManagement /> },
  ],

  retail: [
    { path: 'dashboard', element: <RetailDashboard /> },
    { path: 'inventory', element: <Inventory /> },
  ],

  travel: [
    { path: 'dashboard', element: <TravelDashboard /> },
    { path: 'bookings', element: <TravelBookings /> },
    { path: 'customer-requests', element: <CustomerRequests /> },
    { path: 'central-info', element: <CentralInfo /> },
  ],
};

/**
 * Public routes — no auth required.
 */
export const publicRoutes = [
  { path: '/', element: <LandingPage /> },
  { path: 'login', element: <Login /> },
  { path: 'register', element: <Register /> },
  { path: 'verify-email', element: <VerifyEmail /> },
  { path: 'privacy-policy', element: <PrivacyPolicy /> },
  { path: 'terms-of-service', element: <TermsOfService /> },
  { path: 'founding-access', element: <FoundingAccess /> },
];

/**
 * Fallback route.
 */
export const fallbackRoute = { path: '*', element: <NotFound /> };
