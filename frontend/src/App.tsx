import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OpportunityFeedPage from './pages/OpportunityFeedPage';
import OpportunityDetailPage from './pages/OpportunityDetailPage';
import ProviderPortalPage from './pages/ProviderPortalPage';
import ProviderDashboardPage from './pages/ProviderDashboardPage';
import ProviderResourcesPage from './pages/ProviderResourcesPage';
import ProviderApplicationsPage from './pages/ProviderApplicationsPage';
import ProviderProfilePage from './pages/ProviderProfilePage';
import ResourceHubPage from './pages/ResourceHubPage';
import ResourceListingPage from './pages/ResourceListingPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import MyResourceRequestsPage from './pages/MyResourceRequestsPage';
import PublicProviderProfilePage from './pages/PublicProviderProfilePage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/opportunities"
        element={<ProtectedRoute><OpportunityFeedPage /></ProtectedRoute>}
      />
      <Route
        path="/opportunities/:id"
        element={<ProtectedRoute><OpportunityDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/provider"
        element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboardPage /></ProtectedRoute>}
      />
      <Route path="/provider/opportunities" element={<ProtectedRoute allowedRoles={['provider']}><ProviderPortalPage /></ProtectedRoute>} />
      <Route path="/provider/resources" element={<ProtectedRoute allowedRoles={['provider']}><ProviderResourcesPage /></ProtectedRoute>} />
      <Route path="/provider/applications" element={<ProtectedRoute allowedRoles={['provider']}><ProviderApplicationsPage /></ProtectedRoute>} />
      <Route path="/provider/profile" element={<ProtectedRoute allowedRoles={['provider']}><ProviderProfilePage /></ProtectedRoute>} />
      <Route path="/resources" element={<ProtectedRoute><ResourceHubPage /></ProtectedRoute>} />
      <Route path="/resources/list" element={<ProtectedRoute><ResourceListingPage /></ProtectedRoute>} />
      <Route path="/my-applications" element={<ProtectedRoute allowedRoles={['student']}><MyApplicationsPage /></ProtectedRoute>} />
      <Route path="/my-resource-requests" element={<ProtectedRoute allowedRoles={['student']}><MyResourceRequestsPage /></ProtectedRoute>} />
      <Route path="/providers/:id" element={<ProtectedRoute><PublicProviderProfilePage /></ProtectedRoute>} />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
