import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Imported useMemo, useCallback
import { useParams, Link } from 'react-router-dom';
// REMOVED: import axios from 'axios';
import api from '../services/api'; // IMPORTED global api instance

// Charts
import { Line, Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TeamDetail = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [projects, setProjects] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // REMOVED: Local API instance with auth token
  // const api = axios.create({
  //   baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${localStorage.getItem('token')}`
  //   }
  // });

  // Memoize metricsData to prevent re-computation if metrics prop hasn't changed
  const metricsData = useMemo(() => {
    const defaultMetrics = {
      velocity: [0, 0, 0, 0, 0],
      burndown: [0, 0, 0, 0, 0],
      cycletime: [0, 0, 0, 0, 0],
      sprints: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'],
      maturity_metrics: {
        collaboration_score: 0,
        technical_practices_score: 0,
        delivery_predictability: 0,
        quality_score: 0,
        overall_maturity: 0
      }
    };
    // Ensure maturity_metrics is always defined
    const currentMetrics = metrics || defaultMetrics;
    if (!currentMetrics.maturity_metrics) {
      currentMetrics.maturity_metrics = defaultMetrics.maturity_metrics;
    }
    return currentMetrics;
  }, [metrics]);

  // Get maturity level color - useCallback as it's a pure function
  const getMaturityColor = useCallback((level) => {
    switch (Math.round(level)) {
      case 1: return 'bg-danger';
      case 2: return 'bg-warning';
      case 3: return 'bg-info';
      case 4: return 'bg-primary';
      case 5: return 'bg-success';
      default: return 'bg-secondary';
    }
  }, []); // Empty dependency array as it has no external dependencies
  
  // Get maturity level text - useCallback
  const getMaturityText = useCallback((level) => {
    switch (Math.round(level)) {
      case 1: return 'Initial';
      case 2: return 'Emerging';
      case 3: return 'Defined';
      case 4: return 'Measured';
      case 5: return 'Optimizing';
      default: return 'Unknown';
    }
  }, []); // Empty dependency array

  // Chart data - memoized
  const velocityData = useMemo(() => ({
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
  }), [metricsData]);

  const burndownData = useMemo(() => ({
    labels: metricsData.sprints || ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5'],
    datasets: [
      {
        label: 'Remaining Work',
        data: metricsData.burndown || [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  }), [metricsData]);
  
  const maturityData = useMemo(() => ({
    labels: [
      'Collaboration',
      'Technical Practices',
      'Delivery Predictability',
      'Quality',
      'Overall Maturity'
    ],
    datasets: [
      {
        label: 'Maturity Assessment',
        data: [
          metricsData.maturity_metrics.collaboration_score || 0,
          metricsData.maturity_metrics.technical_practices_score || 0,
          metricsData.maturity_metrics.delivery_predictability || 0,
          metricsData.maturity_metrics.quality_score || 0,
          metricsData.maturity_metrics.overall_maturity || 0
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgb(54, 162, 235)',
        pointBackgroundColor: 'rgb(54, 162, 235)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(54, 162, 235)',
        fill: true
      }
    ]
  }), [metricsData]);
  
  // Radar chart options - this is static, so no useMemo needed unless it becomes dynamic or complex
  const radarOptions = {
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  const averageVelocity = useMemo(() => (
    metricsData.velocity && metricsData.velocity.length > 0
      ? Math.round(metricsData.velocity.reduce((a, b) => a + b, 0) / metricsData.velocity.length)
      : 0
  ), [metricsData.velocity]);
    
  const latestCycleTime = useMemo(() => (
    metricsData.cycletime && metricsData.cycletime.length > 0
      ? metricsData.cycletime[metricsData.cycletime.length - 1]
      : 0
  ), [metricsData.cycletime]);

  // Memoize recommended focus areas
  const recommendedFocusAreas = useMemo(() => {
    // Ensure maturity_metrics exists before trying to access it
    if (!metricsData.maturity_metrics) return []; 
    return Object.entries(metricsData.maturity_metrics)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
  }, [metricsData.maturity_metrics]);

  useEffect(() => {
    const fetchTeamData = async () => {
      setLoading(true);
      setError(null); // Reset error state on new fetch

      try {
        const promises = [
          api.get(`/teams/${id}`),           // 0: Team details
          api.get(`/teams/${id}/projects`),    // 1: Team projects
          api.get(`/teams/${id}/integrations`),// 2: Team integrations
          api.get(`/teams/${id}/metrics`)      // 3: Team metrics
        ];

        // Use Promise.allSettled to ensure all promises complete, even if some fail
        // This allows us to get partial data if, for example, metrics fail but team details succeed.
        const results = await Promise.allSettled(promises);

        // Process team details (critical)
        if (results[0].status === 'fulfilled') {
          setTeam(results[0].value.data);
        } else {
          // If team details fail, it's a critical error for this page
          console.error('Error fetching team details:', results[0].reason);
          setError(`Failed to load essential team details: ${results[0].reason?.response?.data?.detail || results[0].reason?.message || 'Unknown error'}`);
          setLoading(false);
          return; // Stop further processing if team details fail
        }

        // Process projects
        if (results[1].status === 'fulfilled') {
          setProjects(results[1].value.data || []);
        } else {
          console.error('Error fetching projects:', results[1].reason);
          setProjects([]); // Set to empty array on error
        }

        // Process integrations
        if (results[2].status === 'fulfilled') {
          setIntegrations(results[2].value.data || []);
        } else {
          console.error('Error fetching integrations:', results[2].reason);
          setIntegrations([]); // Set to empty array on error
        }

        // Process metrics
        if (results[3].status === 'fulfilled') {
          setMetrics(results[3].value.data || null);
        } else {
          console.error('Error fetching metrics:', results[3].reason);
          setMetrics(null); // Set to null on error
        }

      } catch (err) {
        // This catch block is for errors not directly from Promise.allSettled (e.g., issues setting up promises)
        // or if we were using Promise.all and a critical error occurred.
        console.error('Unexpected error during fetchTeamData:', err);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamData();
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
        <Link to="/teams" className="btn btn-outline-danger">
          Back to Teams
        </Link>
      </div>
    );
  }
  
  if (!team) {
    return (
      <div className="alert alert-warning mt-4" role="alert">
        <h4 className="alert-heading">Team Not Found</h4>
        <p>The team you're looking for doesn't exist or you don't have access to it.</p>
        <hr />
        <Link to="/teams" className="btn btn-outline-warning">
          Back to Teams
        </Link>
      </div>
    );
  }

  // Make sure arrays are initialized
  const integrationsArray = Array.isArray(integrations) ? integrations : [];
  const projectsArray = Array.isArray(projects) ? projects : [];

  return (
    <div className="team-detail">
      <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
        <div>
          <h1 className="h2">{team.name}</h1>
          <div className="mt-1">
            <span className={`badge ${getMaturityColor(team.maturity_level)} me-2`}>
              Maturity Level {team.maturity_level}: {getMaturityText(team.maturity_level)}
            </span>
            <span className={`badge ${team.active ? 'bg-success' : 'bg-secondary'}`}>
              {team.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div>
          <Link to={`/teams/${id}/edit`} className="btn btn-sm btn-outline-primary me-2">
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
              <h5 className="card-title">Team Information</h5>
              <p className="card-text">{team.description || 'No description provided'}</p>
              
              <h6 className="mt-4 mb-2">Integrations</h6>
              <div className="d-flex flex-wrap">
                {integrationsArray.length > 0 ? (
                  integrationsArray.map((integration, idx) => (
                    <span key={idx} className="badge bg-info me-2 mb-2 p-2">
                      <i className={`bi bi-${integration.type.toLowerCase() === 'github' ? 'github' : 'gear'} me-1`}></i> {integration.type}
                    </span>
                  ))
                ) : (
                  <p className="text-muted">No integrations configured</p>
                )}
              </div>
              
              <h6 className="mt-4 mb-2">Projects</h6>
              <div className="list-group">
                {projectsArray.length > 0 ? (
                  projectsArray.map(project => (
                    <Link key={project.id} to={`/projects/${project.id}`} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                      {project.name}
                      <span className={`badge ${project.active ? 'bg-success' : 'bg-secondary'} rounded-pill`}>
                        {project.active ? 'Active' : 'Inactive'}
                      </span>
                    </Link>
                  ))
                ) : (
                  <p className="text-muted">No projects assigned to this team</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm mb-4">
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
              <div className="d-flex justify-content-between mb-2">
                <span>Projects:</span>
                <span className="fw-bold">{projectsArray.length}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span>Integrations:</span>
                <span className="fw-bold">{integrationsArray.length}</span>
              </div>
            </div>
          </div>
          
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">Recommended Focus Areas</h5>
              <ul className="list-group list-group-flush">
                {recommendedFocusAreas.map(([key, value], idx) => (
                  <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                    {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    <span className={`badge ${getMaturityColor(value)} rounded-pill`}>{value.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
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
          <div className="col-md-12 mb-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Agile Maturity Assessment</h5>
                <div style={{ maxHeight: '500px' }}>
                  <Radar data={maturityData} options={radarOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-info mt-3">
          <h4 className="alert-heading">No Integrations Set Up</h4>
          <p>This team doesn't have any integrations configured yet. Add integrations to start tracking metrics.</p>
          <hr />
          <Link to="/integrations" className="btn btn-info">Configure Integrations</Link>
        </div>
      )}
    </div>
  );
};

export default TeamDetail; 