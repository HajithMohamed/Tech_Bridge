import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OpportunityFeedPage from './pages/OpportunityFeedPage';
import OpportunityDetailPage from './pages/OpportunityDetailPage';
import ProviderPortalPage from './pages/ProviderPortalPage';
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
        element={<ProtectedRoute allowedRoles={['provider']}><ProviderPortalPage /></ProtectedRoute>}
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
