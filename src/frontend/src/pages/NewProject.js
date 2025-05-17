import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const NewProject = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // API instance with auth token
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/projects', formData);
      
      // Navigate to the new project's detail page
      navigate(`/projects/${response.data.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
        <h1 className="h2">Create New Project</h1>
        <Link to="/projects" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left me-1"></i> Back to Projects
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">Project Name*</label>
              <input
                type="text"
                className="form-control"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter project name"
              />
              <div className="form-text">Give your project a descriptive name</div>
            </div>
            
            <div className="mb-4">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea
                className="form-control"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                placeholder="Describe the purpose of this project"
              />
            </div>
            
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              <Link to="/projects" className="btn btn-outline-secondary me-md-2">
                Cancel
              </Link>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewProject; 