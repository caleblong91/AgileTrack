import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

// Charts
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
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
    const fetchProjectData = async () => {
      try {
        setLoading(true);
        
        // Fetch project details
        const projectResponse = await api.get(`/projects/${id}`);
        setProject(projectResponse.data);
        
        try {
          // Fetch project integrations
          const integrationsResponse = await api.get(`/projects/${id}/integrations`);
          setIntegrations(integrationsResponse.data || []);
        } catch (integrationError) {
          console.error('Error fetching integrations:', integrationError);
          // Don't fail the whole page if integrations fail
          setIntegrations([]);
        }
        
        try {
          // Fetch project metrics
          const metricsResponse = await api.get(`/projects/${id}/metrics`);
          setMetrics(metricsResponse.data || null);
        } catch (metricsError) {
          console.error('Error fetching metrics:', metricsError);
          // Don't fail the whole page if metrics fail
          setMetrics(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching project details:', error);
        setError('Failed to load project details. Please try again later.');
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [id]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="alert alert-danger mt-4" role="alert">
        <h4 className="alert-heading">Error</h4>
        <p>{error}</p>
        <hr />
        <Link to="/projects" className="btn btn-outline-danger">
          Back to Projects
        </Link>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="alert alert-warning mt-4" role="alert">
        <h4 className="alert-heading">Project Not Found</h4>
        <p>The project you're looking for doesn't exist or you don't have access to it.</p>
        <hr />
        <Link to="/projects" className="btn btn-outline-warning">
          Back to Projects
        </Link>
      </div>
    );
  }

  // Make sure integrations is always an array
  const integrationsArray = Array.isArray(integrations) ? integrations : [];

  // Default metrics data structure if real data isn't available yet
  const metricsData = metrics || {
    velocity: [0, 0, 0, 0, 0],
    burndown: [0, 0, 0, 0, 0],
    cycletime: [0, 0, 0, 0, 0],
    sprints: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5']
  };

  // Chart data
  const velocityData = {
    labels: metricsData.sprints || ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'],
    datasets: [
      {
        label: 'Velocity (Story Points)',
        data: metricsData.velocity || [0, 0, 0, 0, 0],
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.4)',
        borderColor: 'rgba(75,192,192,1)',
      },
    ],
  };

  const burndownData = {
    labels: metricsData.sprints || ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'],
    datasets: [
      {
        label: 'Remaining Work',
        data: metricsData.burndown || [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };

  const averageVelocity = metricsData.velocity && metricsData.velocity.length > 0
    ? Math.round(metricsData.velocity.reduce((a, b) => a + b, 0) / metricsData.velocity.length)
    : 0;
    
  const latestCycleTime = metricsData.cycletime && metricsData.cycletime.length > 0
    ? metricsData.cycletime[metricsData.cycletime.length - 1]
    : 0;

  return (
    <div className="project-detail">
      <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
        <h1 className="h2">{project.name}</h1>
        <div>
          <Link to={`/projects/${id}/edit`} className="btn btn-sm btn-outline-primary me-2">
            <i className="bi bi-pencil me-1"></i> Edit
          </Link>
          <button className="btn btn-sm btn-primary">
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh Metrics
          </button>
        </div>
      </div>
      
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Project Information</h5>
              <p className="card-text">{project.description || 'No description provided'}</p>
              <div className="d-flex">
                <span className={`badge ${project.active ? 'bg-success' : 'bg-secondary'} me-2`}>
                  {project.active ? 'Active' : 'Inactive'}
                </span>
                {integrationsArray.length > 0 ? (
                  integrationsArray.map(integration => (
                    <span key={integration.id} className="badge bg-info me-2">
                      {integration.type}
                    </span>
                  ))
                ) : (
                  <span className="badge bg-warning">No Integrations</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Quick Stats</h5>
              <div className="d-flex justify-content-between mb-2">
                <span>Average Velocity:</span>
                <span className="fw-bold">{averageVelocity} points</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Latest Cycle Time:</span>
                <span className="fw-bold">{latestCycleTime} days</span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Integrations:</span>
                <span className="fw-bold">{integrationsArray.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {integrationsArray.length > 0 ? (
        <div className="row">
          <div className="col-md-6 mb-4">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Velocity Trend</h5>
                <Line data={velocityData} />
              </div>
            </div>
          </div>
          <div className="col-md-6 mb-4">
            <div className="card h-100 shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Burndown Chart</h5>
                <Bar data={burndownData} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-info mt-3">
          <h4 className="alert-heading">No Integrations Set Up</h4>
          <p>This project doesn't have any integrations configured yet. Add integrations to start tracking metrics.</p>
          <hr />
          <Link to="/integrations" className="btn btn-info">Configure Integrations</Link>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail; 