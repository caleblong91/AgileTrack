import axios from 'axios';

// Create a common axios instance for API calls
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor to automatically add the token to all requests
api.interceptors.request.use(
  (config) => {
    // Fetch token on each request to ensure we have the latest
    const token = localStorage.getItem('token');
    if (token) {
      // Ensure exact format required by FastAPI: "Bearer " + token (with a space)
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('Adding token to request:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is a 401 and we haven't retried already
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      console.log('401 error detected:', error.response.data);
      originalRequest._retry = true;
      
      // Clear token and notify user
      localStorage.removeItem('token');
      
      // Only redirect to login if we're not already there
      if (!window.location.pathname.includes('/login')) {
        console.log('Redirecting to login page');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 