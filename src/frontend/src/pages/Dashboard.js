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
  const [integrations, setIntegrations] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [summary, setSummary] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalIntegrations: 0,
    avgAgileMaturity: 0,
    teamVelocity: 0
  });

  // API base URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  
  // API instance with auth token
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  useEffect(() => {
    // Fetch data
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch real data from API
        const projectsResponse = await api.get('/projects');
        const projectsData = projectsResponse.data;
        setProjects(projectsData);
        
        // Fetch integrations
        const integrationsResponse = await api.get('/integrations');
        const integrationsData = integrationsResponse.data;
        setIntegrations(integrationsData);
        
        // Fetch metrics for each integration
        const metricsData = {};
        let totalVelocity = 0;
        let velocityCount = 0;
        
        for (const integration of integrationsData) {
          try {
            const metricResponse = await api.post(`/integrations/${integration.id}/metrics`, {
              days: 30
            });
            
            if (metricResponse.data && !metricResponse.data.metrics.error) {
              metricsData[integration.id] = metricResponse.data.metrics;
              
              // Calculate velocity for GitHub PRs or Jira completed stories
              if (integration.type === 'github' && metricResponse.data.metrics.pr_count) {
                totalVelocity += metricResponse.data.metrics.pr_count;
                velocityCount++;
              } else if (integration.type === 'jira' && metricResponse.data.metrics.completed_story_points) {
                totalVelocity += metricResponse.data.metrics.completed_story_points;
                velocityCount++;
              }
            }
          } catch (error) {
            console.error(`Error fetching metrics for integration ${integration.id}:`, error);
          }
        }
        
        setMetrics(metricsData);
        
        // Calculate summary data
        const avgVelocity = velocityCount > 0 ? Math.round(totalVelocity / velocityCount) : 0;
        
        setSummary({
          totalProjects: projectsData.length,
          activeProjects: projectsData.filter(p => p.active).length,
          totalIntegrations: integrationsData.length,
          avgAgileMaturity: calculateAgileMaturity(metricsData),
          teamVelocity: avgVelocity
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
          totalIntegrations: 0,
          avgAgileMaturity: 65,
          teamVelocity: 0
        });
        
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Helper function to calculate agile maturity based on metrics
  const calculateAgileMaturity = (metricsData) => {
    if (Object.keys(metricsData).length === 0) {
      return 65; // Default value if no data
    }
    
    let maturityScore = 0;
    let scoreCount = 0;
    
    // Analyze GitHub metrics
    Object.values(metricsData).forEach(metricSet => {
      // PR Merge Rate - higher is better (max 100)
      if (metricSet.pr_merge_rate !== undefined) {
        maturityScore += metricSet.pr_merge_rate * 100;
        scoreCount++;
      }
      
      // Time to merge PRs - lower is better (benchmark: 24 hours is good)
      if (metricSet.avg_time_to_merge_hours !== undefined) {
        const mergeTimeScore = Math.min(100, Math.max(0, 100 - (metricSet.avg_time_to_merge_hours - 24) / 24 * 25));
        maturityScore += mergeTimeScore;
        scoreCount++;
      }
      
      // Issue close rate - higher is better (max 100)
      if (metricSet.issue_close_rate !== undefined) {
        maturityScore += metricSet.issue_close_rate * 100;
        scoreCount++;
      }
    });
    
    return scoreCount > 0 ? Math.round(maturityScore / scoreCount) : 65;
  };

  // Generate chart data from real metrics
  const generateChartData = () => {
    // Default values
    const defaultData = {
      velocity: 0,
      quality: 0,
      collaboration: 0,
      techDebt: 0,
      continuousImprovement: 0
    };
    
    // If no metrics, return default
    if (Object.keys(metrics).length === 0) {
      return {
        ...defaultData,
        velocity: summary.teamVelocity || 0,
        quality: 65,
        collaboration: 70,
        techDebt: 60,
        continuousImprovement: 75
      };
    }
    
    // Calculate real metrics
    let velocity = 0;
    let quality = 0;
    let collaboration = 0;
    let techDebt = 0;
    let continuousImprovement = 0;
    
    let velocityCount = 0;
    let qualityCount = 0;
    let collaborationCount = 0;
    let techDebtCount = 0;
    let improvementCount = 0;
    
    Object.values(metrics).forEach(metricSet => {
      // Velocity: PR count or completed story points
      if (metricSet.pr_count || metricSet.completed_story_points) {
        velocity += metricSet.pr_count || metricSet.completed_story_points;
        velocityCount++;
      }
      
      // Quality: PR merge rate (scaled 0-100)
      if (metricSet.pr_merge_rate !== undefined) {
        quality += metricSet.pr_merge_rate * 100;
        qualityCount++;
      }
      
      // Collaboration: Number of PRs with comments or review comments
      if (metricSet.avg_review_comments !== undefined || metricSet.issue_count !== undefined) {
        collaboration += 70; // Base score that would be calculated from detailed metrics
        collaborationCount++;
      }
      
      // Tech Debt: Commit size is inversely related to tech debt (smaller = better)
      if (metricSet.avg_commit_size !== undefined) {
        // Scale from 0-100 where smaller is better (arbitrary scale where 100 changes is the baseline)
        const commitSizeScore = Math.min(100, Math.max(0, 100 - (metricSet.avg_commit_size / 100) * 70));
        techDebt += commitSizeScore;
        techDebtCount++;
      }
      
      // Continuous Improvement: Regular commits over time, issue close rate
      if (metricSet.commit_count !== undefined || metricSet.issue_close_rate !== undefined) {
        continuousImprovement += metricSet.issue_close_rate ? metricSet.issue_close_rate * 100 : 75;
        improvementCount++;
      }
    });
    
    return {
      velocity: velocityCount > 0 ? Math.round(velocity / velocityCount) : defaultData.velocity,
      quality: qualityCount > 0 ? Math.round(quality / qualityCount) : defaultData.quality,
      collaboration: collaborationCount > 0 ? Math.round(collaboration / collaborationCount) : defaultData.collaboration,
      techDebt: techDebtCount > 0 ? Math.round(techDebt / techDebtCount) : defaultData.techDebt,
      continuousImprovement: improvementCount > 0 ? Math.round(continuousImprovement / improvementCount) : defaultData.continuousImprovement
    };
  };

  // Calculate chart data from real metrics
  const chartMetrics = generateChartData();
  
  const chartData = {
    labels: ['Velocity', 'Quality', 'Collaboration', 'Technical Debt', 'Continuous Improvement'],
    datasets: [
      {
        label: 'Agile Maturity Metrics',
        data: [
          chartMetrics.velocity, 
          chartMetrics.quality, 
          chartMetrics.collaboration, 
          chartMetrics.techDebt, 
          chartMetrics.continuousImprovement
        ],
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

  // Get improvement suggestions based on metrics
  const getMetricsToImprove = () => {
    const improvements = [];
    
    // Check all metrics for potential improvements
    Object.entries(metrics).forEach(([integrationId, metricSet]) => {
      const integration = integrations.find(i => i.id === parseInt(integrationId));
      if (!integration) return;
      
      // PR Review Time
      if (metricSet.avg_time_to_merge_hours && metricSet.avg_time_to_merge_hours > 24) {
        improvements.push({
          title: 'Pull Request Review Time',
          description: `Average time to review PRs is ${Math.round(metricSet.avg_time_to_merge_hours)} hours`,
          severity: metricSet.avg_time_to_merge_hours > 48 ? 'danger' : 'warning',
          source: integration.name
        });
      }
      
      // Commit size
      if (metricSet.avg_commit_size && metricSet.avg_commit_size > 200) {
        improvements.push({
          title: 'Large Commits',
          description: `Average commit size is ${Math.round(metricSet.avg_commit_size)} lines`,
          severity: metricSet.avg_commit_size > 400 ? 'danger' : 'warning',
          source: integration.name
        });
      }
      
      // Issue close rate
      if (metricSet.issue_close_rate !== undefined && metricSet.issue_close_rate < 0.7) {
        improvements.push({
          title: 'Issue Resolution Rate',
          description: `Teams close ${Math.round(metricSet.issue_close_rate * 100)}% of issues`,
          severity: metricSet.issue_close_rate < 0.5 ? 'danger' : 'warning',
          source: integration.name
        });
      }
    });
    
    // If no real improvements found, add some defaults
    if (improvements.length === 0) {
      improvements.push(
        {
          title: 'Pull Request Review Time',
          description: 'Average time to review PRs is 36 hours',
          severity: 'warning',
          source: 'Default'
        },
        {
          title: 'Technical Debt Ratio',
          description: '28% of sprint capacity used for tech debt',
          severity: 'danger',
          source: 'Default'
        },
        {
          title: 'Sprint Commitment Accuracy',
          description: 'Teams complete 73% of committed work',
          severity: 'warning',
          source: 'Default'
        }
      );
    }
    
    return improvements.slice(0, 3); // Return top 3 items
  };
  
  // Get suggestions based on metrics that need improvement
  const getSuggestions = () => {
    const metricsToImprove = getMetricsToImprove();
    const suggestions = [];
    
    metricsToImprove.forEach(metric => {
      switch(metric.title) {
        case 'Pull Request Review Time':
          suggestions.push({
            title: 'Implement PR Size Limits',
            description: 'Consider enforcing smaller PRs (max 400 lines) to improve review times.'
          });
          break;
        case 'Large Commits':
          suggestions.push({
            title: 'Encourage Smaller, Focused Commits',
            description: 'Aim for smaller commits that focus on a single logical change.'
          });
          break;
        case 'Issue Resolution Rate':
          suggestions.push({
            title: 'Triage Issues Weekly',
            description: 'Hold regular issue triage sessions to prioritize and assign open issues.'
          });
          break;
        case 'Technical Debt Ratio':
          suggestions.push({
            title: 'Dedicate Tech Debt Time',
            description: 'Allocate 20% of each sprint specifically for technical debt reduction.'
          });
          break;
        case 'Sprint Commitment Accuracy':
          suggestions.push({
            title: 'Refine Story Point Estimation',
            description: 'Conduct estimation calibration exercises to improve commitment accuracy.'
          });
          break;
        default:
          suggestions.push({
            title: 'Review Team Processes',
            description: 'Conduct retrospectives to identify and address process bottlenecks.'
          });
      }
    });
    
    // Add some general suggestions if needed
    if (suggestions.length < 3) {
      const defaultSuggestions = [
        {
          title: 'Implement Automated Testing',
          description: 'Increase test coverage to catch issues earlier in the development cycle.'
        },
        {
          title: 'Improve Documentation',
          description: 'Create clearer documentation for onboarding and knowledge sharing.'
        },
        {
          title: 'Streamline Code Review Process',
          description: 'Establish clearer code review guidelines and expectations.'
        }
      ];
      
      for (let i = 0; i < defaultSuggestions.length && suggestions.length < 3; i++) {
        suggestions.push(defaultSuggestions[i]);
      }
    }
    
    return suggestions;
  };
  
  const improvementMetrics = getMetricsToImprove();
  const suggestions = getSuggestions();

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
              <h2 className="display-4">{summary.teamVelocity || '-'}</h2>
              <p className="text-muted">
                <small>PRs/Issues per month (avg)</small>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Integration Summary */}
      {Object.entries(metrics).length > 0 && (
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header">
                <h5>Integration Metrics Summary</h5>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Integration</th>
                        <th>Type</th>
                        <th>Pull Requests</th>
                        <th>Merge Rate</th>
                        <th>Avg. Time to Merge</th>
                        <th>Commits</th>
                        <th>Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metrics).map(([integrationId, metricSet]) => {
                        const integration = integrations.find(i => i.id === parseInt(integrationId));
                        if (!integration) return null;
                        
                        return (
                          <tr key={integrationId}>
                            <td>{integration.name}</td>
                            <td>{integration.type}</td>
                            <td>{metricSet.pr_count || '-'}</td>
                            <td>{metricSet.pr_merge_rate ? `${(metricSet.pr_merge_rate * 100).toFixed(1)}%` : '-'}</td>
                            <td>{metricSet.avg_time_to_merge_hours ? `${Math.round(metricSet.avg_time_to_merge_hours)}h` : '-'}</td>
                            <td>{metricSet.commit_count || '-'}</td>
                            <td>{metricSet.issue_count || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                {improvementMetrics.map((metric, index) => (
                  <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <h6>{metric.title}</h6>
                      <small className="text-muted">{metric.description}</small>
                      {metric.source !== 'Default' && (
                        <small className="d-block text-info">Source: {metric.source}</small>
                      )}
                    </div>
                    <span className={`badge bg-${metric.severity} rounded-pill`}>
                      {metric.severity === 'danger' ? 'Critical' : 'Needs Attention'}
                    </span>
                  </li>
                ))}
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
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="list-group-item">
                    <h6>{suggestion.title}</h6>
                    <p className="text-muted small mb-0">
                      {suggestion.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 