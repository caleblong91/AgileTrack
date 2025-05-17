import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { currentUser, setupComplete, hasIntegration } = useAuth();

  // If not logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  // If logged in but setup not complete, redirect to setup
  if (!setupComplete) {
    return <Navigate to="/setup" replace />;
  }
  
  // If logged in and setup complete but no integration, redirect to setup
  if (!hasIntegration) {
    return <Navigate to="/setup" replace />;
  }
  
  // If everything is set up correctly, render the protected content
  return <Outlet />;
};

export default ProtectedRoute; 