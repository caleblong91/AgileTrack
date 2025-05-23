import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Projects = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [projectIntegrations, setProjectIntegrations] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // API instance with auth token
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  useEffect(() => {
    // Fetch projects
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/projects');
        const projectsData = response.data || [];
        setProjects(projectsData);
        
        // Fetch integrations for each project
        const integrationsPromises = projectsData.map(project => 
          api.get(`/projects/${project.id}/integrations`)
            .then(response => ({ 
              projectId: project.id, 
              integrations: response.data || [] 
            }))
            .catch(error => ({ 
              projectId: project.id, 
              integrations: [] 
            }))
        );
        
        const integrationsResults = await Promise.all(integrationsPromises);
        
        // Create an object mapping project ID to integrations
        const integrationsMap = {};
        integrationsResults.forEach(result => {
          integrationsMap[result.projectId] = result.integrations;
        });
        
        setProjectIntegrations(integrationsMap);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects. Please try again later.');
        setProjects([]);
        setLoading(false);
      }
    };
    
    fetchProjects();
  }, []);

  // Filter projects based on search term
  const filteredProjects = Array.isArray(projects) ? projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ) : [];

  // Get integration icon based on type
  const getIntegrationIcon = (type) => {
    const typeLC = type.toLowerCase();
    if (typeLC === 'github' || typeLC === 'gitlab') {
      return 'bi-git';
    } else if (typeLC === 'jira') {
      return 'bi-kanban';
    } else if (typeLC === 'trello') {
      return 'bi-trello';
    } else {
      return 'bi-plugin';
    }
  };
  
  // Get integration color based on type
  const getIntegrationColor = (type) => {
    const typeLC = type.toLowerCase();
    if (typeLC === 'github') {
      return 'bg-dark';
    } else if (typeLC === 'gitlab') {
      return 'bg-danger';
    } else if (typeLC === 'jira') {
      return 'bg-primary';
    } else if (typeLC === 'trello') {
      return 'bg-info';
    } else {
      return 'bg-secondary';
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
        <h1 className="h2">Projects</h1>
        <div className="btn-toolbar mb-2 mb-md-0">
          <Link to="/projects/new" className="btn btn-sm btn-primary">
            <i className="bi bi-plus-circle me-1"></i> New Project
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mt-4 mb-4" role="alert">
          <h4 className="alert-heading">Error</h4>
          <p>{error}</p>
        </div>
      )}

      {/* Search bar */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Projects list */}
      <div className="row">
        {filteredProjects.length === 0 ? (
          <div className="col-12 text-center my-5">
            <div className="card shadow-sm p-5">
              <h4 className="text-muted">No projects found</h4>
              <p className="mb-4">Create your first project to get started tracking your team's metrics</p>
              <div>
                <Link to="/projects/new" className="btn btn-primary">
                  <i className="bi bi-plus-circle me-1"></i> Create New Project
                </Link>
              </div>
            </div>
          </div>
        ) : (
          filteredProjects.map(project => (
            <div key={project.id} className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title mb-0">{project.name}</h5>
                    <span className={`badge ${project.active ? 'bg-success' : 'bg-secondary'} rounded-pill`}>
                      {project.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="card-text text-muted">
                    {project.description || 'No description provided'}
                  </p>
                </div>
                <div className="card-footer bg-white border-top-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      {projectIntegrations[project.id] && projectIntegrations[project.id].length > 0 ? (
                        projectIntegrations[project.id].slice(0, 3).map((integration, idx) => (
                          <span key={idx} className={`badge ${getIntegrationColor(integration.type)} rounded-pill me-1`}>
                            <i className={`bi ${getIntegrationIcon(integration.type)} me-1`}></i> {integration.type}
                          </span>
                        ))
                      ) : (
                        <span className="badge bg-warning rounded-pill">
                          <i className="bi bi-exclamation-circle me-1"></i> No Integrations
                        </span>
                      )}
                    </div>
                    <Link to={`/projects/${project.id}`} className="btn btn-sm btn-outline-primary">
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Projects; 