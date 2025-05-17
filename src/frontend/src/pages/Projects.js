import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Projects = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch projects
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/projects');
        setProjects(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setLoading(false);
      }
    };
    
    fetchProjects();
  }, []);

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            <i className="fe fe-plus me-1"></i> New Project
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div className="row mb-4">
        <div className="col">
          <div className="input-group">
            <span className="input-group-text">
              <i className="fe fe-search"></i>
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
            <h4 className="text-muted">No projects found</h4>
            <p>Create your first project to get started</p>
            <Link to="/projects/new" className="btn btn-primary">
              <i className="fe fe-plus me-1"></i> New Project
            </Link>
          </div>
        ) : (
          filteredProjects.map(project => (
            <div key={project.id} className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title">{project.name}</h5>
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
                    <small className="text-muted">5 integrations</small>
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