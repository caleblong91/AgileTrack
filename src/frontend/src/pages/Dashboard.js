import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalIntegrations: 0,
    avgAgileMaturity: 0
  });

  useEffect(() => {
    // Fetch data
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // For now, use mock data since the backend API might not be ready
        // In a real app, we would use the commented code below
        // const projectsResponse = await axios.get('/projects');
        // const projectsData = projectsResponse.data;
        
        // Mock data for development
        const projectsData = [
          { id: 1, name: 'E-commerce Platform', active: true },
          { id: 2, name: 'Mobile Banking App', active: true },
          { id: 3, name: 'Customer Portal', active: false },
          { id: 4, name: 'Internal Dashboard', active: true },
          { id: 5, name: 'API Gateway', active: true },
          { id: 6, name: 'Legacy System Migration', active: false },
        ];
        
        setProjects(projectsData);
        
        // Calculate summary data
        setSummary({
          totalProjects: projectsData.length,
          activeProjects: projectsData.filter(p => p.active).length,
          totalIntegrations: 5, // This would come from a real API call
          avgAgileMaturity: 72 // This would be calculated from real data
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        
        // Set default/mock data in case of error
        const mockProjects = [
          { id: 1, name: 'Sample Project 1', active: true },
          { id: 2, name: 'Sample Project 2', active: false },
        ];
        
        setProjects(mockProjects);
        
        setSummary({
          totalProjects: 2,
          activeProjects: 1,
          totalIntegrations: 3,
          avgAgileMaturity: 65
        });
        
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Sample chart data - in a real app, this would come from the API
  const chartData = {
    labels: ['Velocity', 'Quality', 'Collaboration', 'Technical Debt', 'Continuous Improvement'],
    datasets: [
      {
        label: 'Agile Maturity Metrics',
        data: [78, 65, 83, 59, 75],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(153, 102, 255, 0.6)'
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    },
    maintainAspectRatio: false
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
        <h1 className="h2">Dashboard</h1>
        <div className="btn-toolbar mb-2 mb-md-0">
          <Link to="/projects/new" className="btn btn-sm btn-primary">
            <i className="fe fe-plus me-1"></i> New Project
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Total Projects</h5>
              <h2 className="display-4">{summary.totalProjects}</h2>
              <p className="text-muted">
                <small>{summary.activeProjects} active</small>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Integrations</h5>
              <h2 className="display-4">{summary.totalIntegrations}</h2>
              <p className="text-muted">
                <small>Across all projects</small>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Agile Maturity</h5>
              <h2 className="display-4">{summary.avgAgileMaturity}%</h2>
              <p className="text-muted">
                <small>Average across projects</small>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Team Velocity</h5>
              <h2 className="display-4">24</h2>
              <p className="text-muted">
                <small>Story points/sprint (avg)</small>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5>Agile Maturity Overview</h5>
            </div>
            <div className="card-body">
              <div style={{ height: '300px' }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5>Recent Projects</h5>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                {projects && Array.isArray(projects) && projects.slice(0, 5).map(project => (
                  <li key={project.id} className="list-group-item d-flex justify-content-between align-items-center">
                    <Link to={`/projects/${project.id}`} className="text-decoration-none">
                      {project.name}
                    </Link>
                    <span className={`badge ${project.active ? 'bg-success' : 'bg-secondary'} rounded-pill`}>
                      {project.active ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-footer">
              <Link to="/projects" className="btn btn-sm btn-outline-primary">View All Projects</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics & Improvement Suggestions */}
      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5>Top Metrics to Improve</h5>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <h6>Pull Request Review Time</h6>
                    <small className="text-muted">Average time to review PRs is 36 hours</small>
                  </div>
                  <span className="badge bg-warning rounded-pill">Needs Attention</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <h6>Technical Debt Ratio</h6>
                    <small className="text-muted">28% of sprint capacity used for tech debt</small>
                  </div>
                  <span className="badge bg-danger rounded-pill">Critical</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <h6>Sprint Commitment Accuracy</h6>
                    <small className="text-muted">Teams complete 73% of committed work</small>
                  </div>
                  <span className="badge bg-warning rounded-pill">Needs Attention</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5>Improvement Suggestions</h5>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item">
                  <h6>Implement PR Size Limits</h6>
                  <p className="text-muted small mb-0">
                    Consider enforcing smaller PRs (max 400 lines) to improve review times.
                  </p>
                </li>
                <li className="list-group-item">
                  <h6>Dedicate Tech Debt Time</h6>
                  <p className="text-muted small mb-0">
                    Allocate 20% of each sprint specifically for technical debt reduction.
                  </p>
                </li>
                <li className="list-group-item">
                  <h6>Refine Story Point Estimation</h6>
                  <p className="text-muted small mb-0">
                    Conduct estimation calibration exercises to improve commitment accuracy.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 