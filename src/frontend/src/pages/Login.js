import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Safely convert any value to a string for display
const safeString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Object]';
    }
  }
  return String(value);
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      
      // Attempt to login with API - this will return the user data directly from the server
      const userData = await login(email, password);
      
      // Add detailed console logging
      console.log("Login successful - User data:", userData);
      console.log("Setup complete:", userData?.setup_complete);
      console.log("Has integration:", userData?.has_integration);
      
      // Use userData directly from the API response to make navigation decisions
      if (userData && userData.setup_complete && userData.has_integration) {
        console.log("Redirecting to dashboard");
        navigate('/'); // Go to dashboard if setup is complete
      } else if (userData && userData.setup_complete) {
        console.log("Setup complete but no integration, redirecting to setup step 2");
        navigate('/setup');
      } else {
        console.log("Setup not complete, redirecting to setup");
        navigate('/setup'); // Go to setup if not complete
      }
    } catch (error) {
      console.error("Login error details:", error);
      
      // Safe error handling with safeString
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      
      if (error.message) {
        errorMessage = safeString(error.message);
      } else if (error.response?.data?.detail) {
        errorMessage = safeString(error.response.data.detail);
      }
      
      // Log error details for debugging
      if (error.response?.data) {
        console.error("Error response data:", safeString(error.response.data));
      }
      
      // Set a guaranteed string as the error
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="row justify-content-center mt-5">
        <div className="col-md-6">
          <div className="card shadow">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <img 
                  src="/assets/img/AgileTrack.webp" 
                  alt="AgileTrack Logo" 
                  height="60" 
                  className="mb-3"
                />
                <h2 className="fw-bold">Sign in to AgileTrack</h2>
                <p className="text-muted">Enter your credentials to access your account</p>
              </div>
              
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label htmlFor="password" className="form-label mb-0">Password</label>
                    <a href="#" className="small text-decoration-none">Forgot password?</a>
                  </div>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign in'}
                  </button>
                </div>
              </form>
              
              <div className="text-center mt-4">
                <p className="mb-0">
                  Don't have an account? <Link to="/signup" className="text-decoration-none">Sign up</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 