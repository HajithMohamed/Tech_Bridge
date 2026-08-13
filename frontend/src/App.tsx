import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import FacultyConnectionsPage from './pages/FacultyConnectionsPage';
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
import ResourceRequestPage from './pages/ResourceRequestPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import MyResourceRequestsPage from './pages/MyResourceRequestsPage';
import MyActivityPage from './pages/MyActivityPage';
import PublicProviderProfilePage from './pages/PublicProviderProfilePage';
import ImpactDashboardPage from './pages/ImpactDashboardPage';
import StudentProfilePage from './pages/StudentProfilePage';
import ProviderResourceRequestsPage from './pages/ProviderResourceRequestsPage';
import ProtectedRoute from './components/ProtectedRoute';
import PortalLayout from './components/PortalLayout';

const App = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/connections" element={<FacultyConnectionsPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<PortalLayout />}>
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/opportunities" element={<OpportunityFeedPage />} />
      <Route path="/opportunities/:id" element={<OpportunityDetailPage />} />
      <Route path="/resources" element={<ResourceHubPage />} />
      <Route path="/providers/:id" element={<PublicProviderProfilePage />} />
      <Route path="/impact" element={<ProtectedRoute><ImpactDashboardPage /></ProtectedRoute>} />
      <Route path="/provider" element={<ProtectedRoute allowedRoles={['provider']}><ProviderDashboardPage /></ProtectedRoute>} />
      <Route path="/provider/opportunities" element={<ProtectedRoute allowedRoles={['provider']}><ProviderPortalPage /></ProtectedRoute>} />
      <Route path="/provider/resources" element={<ProtectedRoute allowedRoles={['provider']}><ProviderResourcesPage /></ProtectedRoute>} />
      <Route path="/provider/applications" element={<ProtectedRoute allowedRoles={['provider']}><ProviderApplicationsPage /></ProtectedRoute>} />
      <Route path="/provider/profile" element={<ProtectedRoute allowedRoles={['provider']}><ProviderProfilePage /></ProtectedRoute>} />
      <Route path="/provider/resource-requests" element={<ProtectedRoute allowedRoles={['provider']}><ProviderResourceRequestsPage /></ProtectedRoute>} />
      <Route path="/resources/list" element={<ProtectedRoute><ResourceListingPage /></ProtectedRoute>} />
      <Route path="/resources/:id/request" element={<ProtectedRoute allowedRoles={['student']}><ResourceRequestPage /></ProtectedRoute>} />
      <Route path="/my-applications" element={<ProtectedRoute allowedRoles={['student']}><MyApplicationsPage /></ProtectedRoute>} />
      <Route path="/my-resource-requests" element={<ProtectedRoute allowedRoles={['student']}><MyResourceRequestsPage /></ProtectedRoute>} />
      <Route path="/my-activity" element={<ProtectedRoute allowedRoles={['student']}><MyActivityPage /></ProtectedRoute>} />
      <Route path="/student-profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfilePage /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
