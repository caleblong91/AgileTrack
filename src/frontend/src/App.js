import React, { Suspense, lazy } from 'react'; // Imported Suspense and lazy
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Moved to top with other imports

// Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages - Lazy Loaded
const Dashboard = lazy(() => import('./pages/Dashboard'));
// Import for Projects removed - keep this comment to avoid breaking dependencies
const Teams = lazy(() => import('./pages/Teams'));
const TeamDetail = lazy(() => import('./pages/TeamDetail'));
const NewTeam = lazy(() => import('./pages/NewTeam'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Setup = lazy(() => import('./pages/Setup'));

// Loading fallback component
const PageLoadingFallback = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading page...</span>
    </div>
  </div>
);

// Layout component for authenticated pages with sidebar and navbar
const AuthenticatedLayout = () => {
  return (
    <div className="d-flex flex-column h-100">
      <Navbar />
      <div className="container-fluid">
        <div className="row">
          <Sidebar />
          <div className="col-md-9 col-lg-10 ms-sm-auto px-md-4 py-4">
            <Suspense fallback={<PageLoadingFallback />}> {/* Added Suspense here */}
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/teams/new" element={<NewTeam />} />
                <Route path="/teams/:id" element={<TeamDetail />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<PageLoadingFallback />}> {/* Added Suspense here for public routes */}
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/setup" element={<Setup />} />
            
            {/* Protected routes */}
            {/* The AuthenticatedLayout already has its own Suspense for its internal routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/*" element={<AuthenticatedLayout />} />
            </Route>
            
            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App; 