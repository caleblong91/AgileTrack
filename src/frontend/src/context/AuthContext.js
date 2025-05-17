import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const savedToken = localStorage.getItem('token');
    
    if (savedToken) {
      setToken(savedToken);
      
      // Get user data from API
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch user data from API
  const fetchUserData = async () => {
    try {
      console.log("Fetching user data from API");
      const response = await api.get('/auth/me');
      const userData = response.data;
      
      console.log("User data received:", userData);
      
      // Update state based on API response
      setCurrentUser({
        id: userData.id,
        email: userData.email,
        name: userData.full_name || userData.username,
        setup_complete: userData.setup_complete,
        has_integration: userData.has_integration
      });
      
      // Set these flags directly from the API response
      setSetupComplete(userData.setup_complete);
      setHasIntegration(userData.has_integration);
      
      console.log("Updated state - setupComplete:", userData.setup_complete, "hasIntegration:", userData.has_integration);
      
      // Also fetch integrations if the user has them
      if (userData.has_integration) {
        fetchIntegrations();
      }
      
      setLoading(false);
      
      // Return the user data for use in components
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      console.error('Error details:', error.response?.data || 'No response data');
      logout();
      setLoading(false);
      return null;
    }
  };

  // Fetch user's integrations
  const fetchIntegrations = async () => {
    try {
      const response = await api.get('/integrations');
      setIntegrations(response.data);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  // Register a new user
  const register = async (email, username, password, fullName) => {
    try {
      console.log("Registering new user with data:", { 
        email, 
        username, 
        password: "REDACTED", 
        full_name: fullName 
      });
      
      const response = await api.post('/auth/register', {
        email,
        username,
        password,
        full_name: fullName
      });
      
      console.log("Registration successful:", response.status);
      
      // After registration, log in the user
      return await login(email, password);
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.response?.data) {
        console.error('Registration error details:', 
          typeof error.response.data === 'object' 
            ? JSON.stringify(error.response.data) 
            : error.response.data
        );
      }
      
      // Re-throw the error for the component to handle
      throw error;
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      console.log("Attempting to login with:", { email });
      const response = await api.post('/auth/login', {
        email,
        password
      });
      
      console.log("Login response received:", response.status);
      const { access_token } = response.data;
      
      // Log token details (safely)
      console.log("Token received length:", access_token.length);
      console.log("Token first 10 chars:", access_token.substring(0, 10) + "...");
      
      // Save token to localStorage
      localStorage.setItem('token', access_token);
      setToken(access_token);
      console.log("Token saved, fetching user data");
      
      // Make a test request to verify token works
      try {
        const testResponse = await api.get('/auth/me');
        console.log("Test token verification successful:", testResponse.status);
      } catch (testError) {
        console.error("Test token verification failed:", testError);
      }
      
      // Fetch user data
      const userData = await fetchUserData();
      
      console.log("Login complete, returning user data:", userData);
      // Return the actual user data from the API
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      console.error('Login error details:', error.response?.data || 'No response data');
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setSetupComplete(false);
    setHasIntegration(false);
    setIntegrations([]);
  };

  // Complete setup
  const completeSetup = async (setupData) => {
    try {
      const response = await api.put('/auth/setup', setupData);
      
      const userData = response.data;
      setCurrentUser({
        ...currentUser,
        name: userData.full_name
      });
      
      setSetupComplete(true);
      return true;
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  };

  // Add integration
  const addIntegration = async (integrationData) => {
    try {
      // Mask sensitive info in logs
      const logData = {
        ...integrationData,
        apiKey: "REDACTED",
        api_key: "REDACTED"
      };
      console.log("Attempting to add integration:", logData);
      
      // Prepare the API request data
      const integrationRequestData = {
        name: integrationData.name,
        type: integrationData.type,
        api_key: integrationData.apiKey, // Convert camelCase to snake_case
        project_id: integrationData.project_id || 1, // Default to project 1 if not specified
        config: integrationData.config || {} // Include config if provided
      };
      
      // For GitHub, ensure repository is in config if provided
      if (integrationData.type === 'github' && integrationData.repository) {
        integrationRequestData.config = {
          ...integrationRequestData.config,
          repository: integrationData.repository
        };
      }
      
      console.log("Sending integration request with project_id:", integrationRequestData.project_id);
      
      // Add the integration via API
      const response = await api.post('/integrations', integrationRequestData);
      const newIntegration = response.data;
      
      console.log("Integration added successfully:", {
        id: newIntegration.id,
        name: newIntegration.name,
        type: newIntegration.type
      });
      
      // Update has_integration status on user
      await api.put('/auth/has-integration');
      
      // Update local state
      setIntegrations(prev => [...prev, newIntegration]);
      setHasIntegration(true);
      
      return newIntegration;
    } catch (error) {
      console.error('Error adding integration:', error);
      
      // Format error message for proper display
      let errorMessage = 'Failed to add integration. Please try again.';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.detail) {
          // For validation errors which can be a complex object
          errorMessage = 'Validation error: Please check your input.';
          console.error('Validation error details:', JSON.stringify(error.response.data));
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  // Get all integrations
  const getIntegrations = () => {
    return integrations;
  };

  const value = {
    currentUser,
    setupComplete,
    hasIntegration,
    integrations,
    register,
    login,
    logout,
    completeSetup,
    addIntegration,
    getIntegrations
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 