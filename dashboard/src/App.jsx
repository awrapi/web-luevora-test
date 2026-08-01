import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/shared/ProtectedRoute';

// Layouts
import CourseLayout from '@/layouts/CourseLayout';
import RentalLayout from '@/layouts/RentalLayout';
import RetailLayout from '@/layouts/RetailLayout';
import TravelLayout from '@/layouts/TravelLayout';

// Route configs
import {
  sharedRoutes,
  businessRoutes,
  publicRoutes,
  fallbackRoute,
} from '@/router';

/**
 * ================================================================
 * Layout Resolver
 * ================================================================
 * Reads the tenant's business_type from AuthContext and renders
 * the appropriate layout component. Each layout wraps <Outlet />,
 * which renders the matched child route.
 *
 * ARCHITECTURE DECISION:
 * Business-specific routes are placed BEFORE shared routes so
 * that when both define the same path (e.g., /dashboard),
 * the business-specific version takes precedence.
 * ================================================================
 */
const layoutMap = {
  course: CourseLayout,
  rent: RentalLayout,
  retail: RetailLayout,
  travel: TravelLayout,
};

const LayoutResolver = () => {
  const { businessType } = useAuth();
  const LayoutComponent = layoutMap[businessType] || TravelLayout;

  // Merge routes: business-specific first (overrides), then shared
  const typeRoutes = businessRoutes[businessType] || [];

  // Create a set of paths that are overridden by business-specific routes
  const overriddenPaths = new Set(typeRoutes.map((r) => r.path));

  // Filter shared routes to exclude those that are overridden
  const filteredShared = sharedRoutes.filter(
    (r) => !r.path || !overriddenPaths.has(r.path)
  );

  // Final merged routes: business-specific + remaining shared
  const mergedRoutes = [...typeRoutes, ...filteredShared];

  return (
    <ProtectedRoute>
      <Routes>
        <Route element={<LayoutComponent />}>
          {mergedRoutes.map((route) => (
            <Route
              key={route.path || 'index'}
              index={route.index}
              path={route.path}
              element={route.element}
            />
          ))}
        </Route>
      </Routes>
    </ProtectedRoute>
  );
};

/**
 * ================================================================
 * App Component
 * ================================================================
 * Root component that sets up:
 *   1. AuthProvider — global auth + business_type state
 *   2. BrowserRouter — client-side routing
 *   3. Public routes — login (no auth required)
 *   4. Protected routes — wrapped in LayoutResolver
 * ================================================================
 */
const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ===== PUBLIC ROUTES (no auth) ===== */}
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}

          {/* ===== PROTECTED ROUTES (auth required, dynamic layout) ===== */}
          <Route path="/*" element={<LayoutResolver />} />

          {/* ===== FALLBACK ===== */}
          <Route path={fallbackRoute.path} element={fallbackRoute.element} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
