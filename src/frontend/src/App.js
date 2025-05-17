import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Dashboard from './pages/Dashboard';
// Import for Projects removed - keep this comment to avoid breaking dependencies
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import NewTeam from './pages/NewTeam';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Setup from './pages/Setup';

// Auth Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout component for authenticated pages with sidebar and navbar
const AuthenticatedLayout = () => {
  return (
    <div className="d-flex flex-column h-100">
      <Navbar />
      <div className="container-fluid">
        <div className="row">
          <Sidebar />
          <div className="col-md-9 col-lg-10 ms-sm-auto px-md-4 py-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/new" element={<NewTeam />} />
              <Route path="/teams/:id" element={<TeamDetail />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
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
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/setup" element={<Setup />} />
          
          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<AuthenticatedLayout />} />
          </Route>
          
          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App; 