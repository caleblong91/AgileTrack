import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Imported useCallback, useMemo
// REMOVED: import axios from 'axios'; 
import api from '../../services/api'; // IMPORTED global api instance
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// Create a persistent cache using localStorage
const localStorageCache = {
  get: function(key) {
    try {
      const cachedData = localStorage.getItem(`agiletrack_${key}`);
      if (!cachedData) return null;
      
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if data is less than 3 days old (259200000 ms)
      // This ensures data persists between login sessions
      if (Date.now() - timestamp < 259200000) {
        return data;
      }
      return null;
    } catch (error) {
      return null;
    }
  },
  set: function(key, value) {
    try {
      const cacheObject = {
        data: value,
        timestamp: Date.now()
      };
      localStorage.setItem(`agiletrack_${key}`, JSON.stringify(cacheObject));
    } catch (error) {
      // Silent fail on storage errors
    }
  },
  clear: function() {
    // Clear all agiletrack caches
    Object.keys(localStorage)
      .filter(key => key.startsWith('agiletrack_'))
      .forEach(key => localStorage.removeItem(key));
  }
};

// Create a simple in-memory cache for the current session
const metricsCache = {
  data: {},
  timestamps: {},
  set: function(key, value) {
    this.data[key] = value;
    this.timestamps[key] = Date.now();
  },
  get: function(key) {
    // Check if data exists and is less than 4 hours old (14400000 ms)
    if (this.data[key] && Date.now() - this.timestamps[key] < 14400000) {
      return this.data[key];
    }
    return null;
  }
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState({
    teams: true,
    integrations: true,
    metrics: true,
    summary: true
  });
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [summary, setSummary] = useState({
    teamIntegrations: 0,
    maturityLevel: 0,
    teamVelocity: 0
  });

  // API base URL
  // REMOVED: const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
  
  // REMOVED: Local API instance with auth token
  // const api = axios.create({
  //   baseURL: API_BASE_URL,
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${localStorage.getItem('token')}`
  //   }
  // });

  // Fetch teams
  const fetchTeams = async (forceRefresh = false) => {
    try {
      setSectionLoading(prev => ({ ...prev, teams: true }));
      
      // Try to get teams from localStorage cache
      const cacheKey = 'teams';
      let teamsData = null;
      
      if (!forceRefresh) {
        teamsData = localStorageCache.get(cacheKey);
      }
      
      // If no cache or force refresh, fetch from API
      if (!teamsData) {
        const teamsResponse = await api.get('/teams');
        teamsData = teamsResponse.data;
        
        // Save to localStorage cache
        localStorageCache.set(cacheKey, teamsData);
      }
      
      setTeams(teamsData);
      
      // Set the first team as selected if none is selected
      if (teamsData.length > 0 && !selectedTeam) {
        // Try to get last selected team from local storage
        const lastSelectedTeamId = localStorage.getItem('agiletrack_selected_team');
        
        if (lastSelectedTeamId) {
          const lastTeam = teamsData.find(t => t.id === parseInt(lastSelectedTeamId));
          if (lastTeam) {
            setSelectedTeam(lastTeam);
          } else {
            setSelectedTeam(teamsData[0]);
          }
        } else {
          setSelectedTeam(teamsData[0]);
        }
      }
      
      return teamsData;
    } catch (error) {
      return [];
    } finally {
      setSectionLoading(prev => ({ ...prev, teams: false }));
    }
  };

  // Fetch integrations for the selected team
  const fetchIntegrations = async (teamId, forceRefresh = false) => {
    if (!teamId) return [];
    
    try {
      console.log(`Fetching integrations for team ${teamId}, forceRefresh=${forceRefresh}`);
      setSectionLoading(prev => ({ ...prev, integrations: true }));
      
      // Try to get integrations from localStorage cache
      const cacheKey = `team_${teamId}_integrations`;
      let integrationsData = null;
      
      if (!forceRefresh) {
        integrationsData = localStorageCache.get(cacheKey);
        console.log(`Cache for ${cacheKey}:`, integrationsData);
      }
      
      // If no cache or force refresh, fetch from API
      if (!integrationsData) {
        console.log(`Making API call to /teams/${teamId}/integrations`);
        const integrationsResponse = await api.get(`/teams/${teamId}/integrations`);
        integrationsData = integrationsResponse.data;
        console.log(`API response for integrations:`, integrationsData);
        
        // Save to localStorage cache
        localStorageCache.set(cacheKey, integrationsData);
      }
      
      console.log(`Setting integrations state:`, integrationsData);
      setIntegrations(integrationsData);
      
      // Update summary data related to integrations
      setSummary(prev => ({
        ...prev,
        teamIntegrations: integrationsData.length,
      }));
      
      return integrationsData;
    } catch (error) {
      console.error(`Error fetching integrations for team ${teamId}:`, error);
      return [];
    } finally {
      setSectionLoading(prev => ({ ...prev, integrations: false }));
    }
  };

  // Fetch metrics for all integrations in parallel
  const fetchMetrics = async (integrationsData, forceRefresh = false) => {
    try {
      setSectionLoading(prev => ({ ...prev, metrics: true }));
      
      if (!integrationsData || integrationsData.length === 0) {
        return {};
      }
      
      // Filter to only valid integrations that can fetch metrics
      const validIntegrations = integrationsData.filter(integration => 
        integration.type.toLowerCase() !== 'github' || 
        (integration.config && integration.config.repository && integration.config.repository.trim() !== '')
      );
      
      if (validIntegrations.length === 0) {
        return {};
      }
      
      // Prepare promises for all integration metrics
      const metricPromises = validIntegrations.map(integration => {
        // Check localStorage cache first
        const cacheKey = `metrics_${integration.id}`;
        let cachedData = null;
        
        if (!forceRefresh) {
          cachedData = localStorageCache.get(cacheKey);
          
          // Also check in-memory cache for the current session
          if (!cachedData) {
            cachedData = metricsCache.get(cacheKey);
          }
        }
        
        if (cachedData) {
          return Promise.resolve({ 
            integrationId: integration.id, 
            data: cachedData 
          });
        }
        
        // Fetch from API if not in cache
        return api.post(`/integrations/${integration.id}/metrics`, { days: 30 })
          .then(response => {
            if (response.data && !response.data.metrics.error) {
              const metricsData = response.data.metrics;
              
              // Verify we got actual metric values and not just an empty object
              if (Object.keys(metricsData).length > 0) {
                // Save to both caches
                metricsCache.set(cacheKey, metricsData);
                localStorageCache.set(cacheKey, metricsData);
                
                return { 
                  integrationId: integration.id, 
                  data: metricsData 
                };
              }
            }
            
            return { 
              integrationId: integration.id, 
              data: null
            };
          })
          .catch(error => {
            return { 
              integrationId: integration.id, 
              data: null
            };
          });
      });
      
      // Add a timeout to ensure we don't wait forever
      const timeoutPromise = new Promise(resolve => {
        setTimeout(() => resolve([]), 10000); // 10-second timeout
      });
      
      // Wait for all promises to resolve or timeout
      const results = await Promise.race([
        Promise.all(metricPromises),
        timeoutPromise
      ]);
      
      // Convert to object format - only include valid metrics
      const metricsData = {};
      results.forEach(result => {
        // Make sure we only process results with valid data
        if (result && result.integrationId && result.data) {
          metricsData[result.integrationId] = result.data;
        }
      });
      
      // Only update metrics if we got data
      if (Object.keys(metricsData).length > 0) {
        setMetrics(metricsData);
        
        // Calculate summary data from metrics
        calculateSummaryFromMetrics(metricsData);
        
        // Cache the complete metrics set for this team
        if (selectedTeam) {
          localStorageCache.set(`team_${selectedTeam.id}_metrics`, metricsData);
        }
      }
      
      return metricsData;
    } catch (error) {
      return {};
    } finally {
      // Ensure section loading states are reset
      setSectionLoading(prev => ({ ...prev, metrics: false, summary: false }));
    }
  };

  // Calculate summary values from metrics data
  const calculateSummaryFromMetrics = (metricsData) => {
    setSectionLoading(prev => ({ ...prev, summary: true }));
    
    try {
      let totalVelocity = 0;
      let velocityCount = 0;
      
      // Find the corresponding integration for each metric
      Object.entries(metricsData).forEach(([integrationId, metricSet]) => {
        const integration = integrations.find(i => i.id === parseInt(integrationId));
        if (!integration) return;
        
        // Calculate velocity
        if (integration.type === 'github' && metricSet.pr_count) {
          totalVelocity += metricSet.pr_count;
          velocityCount++;
        } else if (integration.type === 'jira' && metricSet.completed_story_points) {
          totalVelocity += metricSet.completed_story_points;
          velocityCount++;
        }
      });
      
      const avgVelocity = velocityCount > 0 ? Math.round(totalVelocity / velocityCount) : 0;
      const agileMaturity = calculateAgileMaturity(metricsData);
      
      setSummary(prev => ({
        ...prev,
        maturityLevel: agileMaturity,
        teamVelocity: avgVelocity
      }));
      
      // Cache the summary data for this team
      if (selectedTeam) {
        localStorageCache.set(`team_${selectedTeam.id}_summary`, {
          maturityLevel: agileMaturity,
          teamVelocity: avgVelocity
        });
      }
    } catch (error) {
      // Silent error handling
    } finally {
      // Always make sure to reset the summary loading state
      setSectionLoading(prev => ({ ...prev, summary: false }));
    }
  };

  // Force refresh all data
  const forceRefreshAll = async () => {
    setLoading(true);
    
    try {
      // Clear relevant localStorage cache entries
      localStorageCache.clear();
      
      // Reload all data from API
      const teamsData = await fetchTeams(true);
      
      if (selectedTeam) {
        const integrationsData = await fetchIntegrations(selectedTeam.id, true);
        await fetchMetrics(integrationsData, true);
      }
    } catch (error) {
      console.error('Error during force refresh:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle team change - wrapped in useCallback
  const handleTeamChange = useCallback(async (teamId) => {
    const team = teams.find(t => t.id === parseInt(teamId));
    if (!team) return;
    
    setSelectedTeam(team);
    localStorage.setItem('agiletrack_selected_team', team.id);
    
    // Clear previous metrics when changing teams
    setMetrics({});
    
    // Fetch data for the new team
    // fetchIntegrations and fetchMetrics are defined outside useCallback, 
    // but they rely on state and props. If they were passed as props, 
    // they'd need useCallback too. Here, they are part of the component's closure.
    // The dependencies for handleTeamChange should include functions it calls if they could change.
    // However, fetchIntegrations and fetchMetrics are stable in terms of reference (defined once per component instance).
    // Their behavior changes based on state, which is fine.
    const integrationsData = await fetchIntegrations(team.id); // Assuming fetchIntegrations is stable or memoized if it were a prop
    await fetchMetrics(integrationsData); // Same for fetchMetrics
  }, [teams, fetchIntegrations, fetchMetrics]); // Added dependencies: teams, and the fetch functions if they were not stable

  // Make sure the section loading indicators are reset properly
  // Add this helper function to reset all section loading states
  const resetAllSectionLoading = () => {
    setSectionLoading({
      teams: false,
      integrations: false,
      metrics: false,
      summary: false
    });
  };

  // Update useEffect to handle loading states properly
  useEffect(() => {
    // REMOVED: localStorageCache.clear(); // This was clearing the cache on every dashboard load.
    
    const loadData = async () => {
      // Start with showing loading state
      setLoading(true);
      setSectionLoading({
        teams: true,
        integrations: true,
        metrics: true,
        summary: true
      });
      
      try {
        // Always fetch fresh data from API
        const teamsResponse = await api.get('/teams');
        const teamsData = teamsResponse.data || [];
        setTeams(teamsData);
        setSectionLoading(prev => ({ ...prev, teams: false }));
        
        // Exit early if no teams found
        if (!teamsData || teamsData.length === 0) {
          setLoading(false);
          resetAllSectionLoading();
          return;
        }
        
        // Get last selected team or use first team
        let currentTeam = null;
        const lastSelectedTeamId = localStorage.getItem('agiletrack_selected_team');
        if (lastSelectedTeamId) {
          currentTeam = teamsData.find(t => t.id === parseInt(lastSelectedTeamId)) || teamsData[0];
        } else {
          currentTeam = teamsData[0];
        }
        setSelectedTeam(currentTeam);
        
        // Directly fetch integrations from API
        console.log(`Fetching integrations for team ${currentTeam.id}`);
        const integrationsResponse = await api.get(`/teams/${currentTeam.id}/integrations`);
        const integrationsData = integrationsResponse.data || [];
        console.log(`Received integrations:`, integrationsData);
        
        setIntegrations(integrationsData);
        setSectionLoading(prev => ({ ...prev, integrations: false }));
        setSummary(prev => ({ ...prev, teamIntegrations: integrationsData.length }));
        
        // Only try to fetch metrics if we have integrations
        if (integrationsData && integrationsData.length > 0) {
          // Fetch metrics directly without caching
          console.log(`Fetching metrics for ${integrationsData.length} integrations`);
          const metricsData = {};
          
          // Create promises for all integration metrics requests
          const metricsPromises = integrationsData.map(integration => {
            return api.post(`/integrations/${integration.id}/metrics`, { days: 30 })
              .then(response => {
                console.log(`Received metrics for integration ${integration.id}:`, response.data);
                if (response.data && response.data.metrics) {
                  metricsData[integration.id] = response.data.metrics;
                }
              })
              .catch(error => {
                console.error(`Error fetching metrics for integration ${integration.id}:`, error);
              });
          });
          
          // Wait for all metrics to be fetched
          await Promise.all(metricsPromises);
          
          // Update metrics state
          setMetrics(metricsData);
          calculateSummaryFromMetrics(metricsData);
        }
        
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
        resetAllSectionLoading();
      }
    };
    
    // Execute data loading
    loadData();
    
    // REMOVED: Automatic refresh interval
    // const refreshTimer = setInterval(() => {
    //   loadData(); // Reload everything periodically
    // }, 60000); 
    //
    // return () => clearInterval(refreshTimer);
  }, []);

  // Effect to update integrations when selected team changes
  useEffect(() => {
    if (selectedTeam) {
      fetchIntegrations(selectedTeam.id);
    }
  }, [selectedTeam]);

  // Helper function to calculate agile maturity based on metrics
  const calculateAgileMaturity = useCallback((metricsData) => {
    if (Object.keys(metricsData).length === 0) {
      return selectedTeam?.maturity_level ? selectedTeam.maturity_level * 20 : 65; // Default value if no data
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
    
    return scoreCount > 0 ? Math.round(maturityScore / scoreCount) : (selectedTeam?.maturity_level ? selectedTeam.maturity_level * 20 : 65);
  }, [selectedTeam, integrations]); // Added selectedTeam and integrations as calculateAgileMaturity implicitly depends on them via calculateSummaryFromMetrics

  // Generate chart data from real metrics - result is memoized
  const chartMetrics = useMemo(() => {
    // Default values
    const defaultData = {
      velocity: 0,
      quality: 0,
      collaboration: 0,
      techDebt: 0,
      continuousImprovement: 0
    };
    
    // Before using mock data, check if we at least have integrations but no metrics yet
    if (Object.keys(metrics).length === 0) {
      // If we have integrations but no metrics, show minimal defaults
      if (integrations.length > 0) {
        return {
          ...defaultData,
          velocity: summary.teamVelocity || 0,
          quality: 50,  // Use neutral values instead of biased mock values
          collaboration: 50,
          techDebt: 50,
          continuousImprovement: 50
        };
      }
      
      // Only use optimistic mock data if we truly have no integrations
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
  }, [metrics, integrations, summary.teamVelocity]); // Dependencies for chartMetrics calculation
  
  const chartData = useMemo(() => ({
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
  }), [chartMetrics]); // chartData depends on chartMetrics

  // Get improvement suggestions based on metrics - result is memoized
  const improvementMetrics = useMemo(() => {
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
          description: `Team closes ${Math.round(metricSet.issue_close_rate * 100)}% of issues`,
          severity: metricSet.issue_close_rate < 0.5 ? 'danger' : 'warning',
          source: integration.name
        });
      }
    });
    
    // If no real improvements found, decide what to show
    if (improvements.length === 0) {
      if (integrations.length > 0) {
        // Show "waiting for data" message if we have integrations but no metrics yet
        improvements.push(
          {
            title: 'Metrics Data Pending',
            description: 'Waiting for integration metrics data to analyze',
            severity: 'info',
            source: 'System'
          }
        );
      } else {
        // Only use mock data if we truly have no integrations
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
    }
    
    return improvements.slice(0, 3); // Return top 3 items
  }, [metrics, integrations]); // Dependencies for improvementMetrics
  
  // Get suggestions based on metrics that need improvement - result is memoized
  const suggestions = useMemo(() => {
    const suggestions = [];
    
    improvementMetrics.forEach(metric => { // Use memoized improvementMetrics
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
  }, [improvementMetrics]); // Dependency for suggestions


  // Helper function to render a loading indicator for a specific section
  const renderSectionLoading = (section) => {
    if (!sectionLoading[section]) return null;
    
    return (
      <div className="section-loading" style={{position: "absolute", top: "10px", right: "10px", display: "flex", alignItems: "center"}}>
        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="small text-muted">Loading...</span>
      </div>
    );
  };

  // Replace the metrics waiting panel with a minimal version
  const renderMetricsWaitingPanel = () => {
    return (
      <div className="text-center p-4">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mb-0">Loading metrics data...</p>
      </div>
    );
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

  // Debug logs for rendering state
  console.log("Dashboard render state:", { 
    selectedTeam, 
    integrations: integrations.length, 
    integrationsList: integrations,
    metrics: Object.keys(metrics).length 
  });

  return (
    <div>
      <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
        <h1 className="h2">Dashboard</h1>
        <div className="btn-toolbar mb-2 mb-md-0">
          {/* Team Selector */}
          <div className="me-3">
            <select 
              className="form-select form-select-sm" 
              value={selectedTeam?.id}
              onChange={(e) => handleTeamChange(e.target.value)}
              aria-label="Select Team"
            >
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          
          <button 
            className="btn btn-sm btn-primary me-2" 
            onClick={() => {
              if (selectedTeam) {
                // Fetch fresh integrations and metrics
                fetchIntegrations(selectedTeam.id, true).then(integrationsData => {
                  fetchMetrics(integrationsData, true);
                });
              }
            }}
            disabled={sectionLoading.metrics || sectionLoading.integrations}
          >
            {sectionLoading.metrics || sectionLoading.integrations ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Refreshing...
              </>
            ) : (
              <>
                <i className="fe fe-refresh-cw me-1"></i>
                Refresh Data
              </>
            )}
          </button>
          
          <Link to="/integrations" className="btn btn-sm btn-outline-primary me-2">
            <i className="fe fe-link me-1"></i>
            Manage Integrations
          </Link>
          
          <Link to="/teams/new" className="btn btn-sm btn-primary">
            <i className="fe fe-plus me-1"></i> New Team
          </Link>
        </div>
      </div>

      {/* Team Info */}
      {selectedTeam && (
        <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
          <div className="flex-grow-1">
            <h4 className="alert-heading mb-1">Team: {selectedTeam.name}</h4>
            <p className="mb-0">Maturity Level: {selectedTeam.maturity_level || '?'}/5</p>
          </div>
          <Link to={`/teams/${selectedTeam.id}`} className="btn btn-sm btn-outline-primary">
            View Team Details
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Integrations</h5>
              <h2 className="display-4">{summary.teamIntegrations}</h2>
              <p className="text-muted">
                <small>Connected to this team</small>
              </p>
              {renderSectionLoading('integrations')}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Agile Maturity</h5>
              <h2 className="display-4">{summary.maturityLevel}%</h2>
              <p className="text-muted">
                <small>Based on team metrics</small>
              </p>
              {renderSectionLoading('metrics')}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Team Velocity</h5>
              <h2 className="display-4">{summary.teamVelocity || '-'}</h2>
              <p className="text-muted">
                <small>PRs/Issues per month (avg)</small>
              </p>
              {renderSectionLoading('metrics')}
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Integration Summary */}
      {integrations.length > 0 ? (
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center" style={{position: "relative"}}>
                <h5 className="mb-0">Integration Metrics Summary for {selectedTeam?.name}</h5>
                {renderSectionLoading('metrics')}
              </div>
              <div className="card-body">
                {Object.entries(metrics).length > 0 ? (
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
                          
                          // Check if this is a "no activity" metrics set
                          if (metricSet.no_activity) {
                            return (
                              <tr key={integrationId}>
                                <td>{integration.name}</td>
                                <td>{integration.type}</td>
                                <td colSpan={5} className="text-center text-muted">
                                  No activity in the last 30 days
                                </td>
                              </tr>
                            );
                          }
                          
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
                ) : (
                  <div>
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Integration</th>
                            <th>Type</th>
                            <th>Repository</th>
                            <th>Status</th>
                            <th>Last Sync</th>
                          </tr>
                        </thead>
                        <tbody>
                          {integrations.map(integration => (
                            <tr key={integration.id}>
                              <td>{integration.name}</td>
                              <td>{integration.type}</td>
                              <td>{integration.config?.repository || 'N/A'}</td>
                              <td>
                                <span className={`badge ${integration.active ? 'bg-success' : 'bg-secondary'}`}>
                                  {integration.active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>{integration.last_sync || 'Never'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="alert alert-info mt-3">
                      <h6 className="alert-heading">Metrics Loading</h6>
                      <p className="mb-0">Metrics for your integrations are being processed. This may take a few minutes for the first sync.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-body text-center p-5">
                <h4 className="mb-3">No Integrations Found</h4>
                <p className="mb-4">
                  To see metrics for {selectedTeam?.name}, you need to connect to data sources such as GitHub, Jira, or Trello.
                </p>
                <div className="row justify-content-center">
                  <div className="col-md-8">
                    <div className="card bg-light mb-4">
                      <div className="card-body">
                        <h5 className="card-title">How to add an integration:</h5>
                        <ol className="text-start">
                          <li>Click the <strong>Manage Integrations</strong> button above</li>
                          <li>Select "Add New Integration"</li>
                          <li>Choose your integration type (GitHub, Jira, etc.)</li>
                          <li>Provide your API credentials and configuration</li>
                          <li>Link the integration to this team</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
                <Link to="/integrations" className="btn btn-primary btn-lg">
                  <i className="fe fe-link me-1"></i> Add Your First Integration
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="row mb-4">
        <div className="col-md-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Agile Maturity Overview</h5>
              {renderSectionLoading('metrics')}
            </div>
            <div className="card-body">
              <div style={{ height: '300px' }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics & Improvement Suggestions */}
      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center" style={{position: "relative"}}>
              <h5 className="mb-0">Top Metrics to Improve for {selectedTeam?.name}</h5>
              {renderSectionLoading('metrics')}
            </div>
            <div className="card-body">
              {improvementMetrics.length > 0 ? (
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
              ) : (
                <div className="text-center p-3">
                  <p className="text-muted mb-0">
                    {Object.entries(metrics).length > 0 
                      ? "No improvements needed at this time. Great job!" 
                      : "Add integrations to see potential improvements"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center" style={{position: "relative"}}>
              <h5 className="mb-0">Improvement Suggestions for {selectedTeam?.name}</h5>
              {renderSectionLoading('metrics')}
            </div>
            <div className="card-body">
              {suggestions.length > 0 ? (
                <div className="list-group">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className="list-group-item list-group-item-action">
                      <div className="d-flex w-100 justify-content-between">
                        <h6 className="mb-1">{suggestion.title}</h6>
                        <small className={`text-${suggestion.priority === 'high' ? 'danger' : 'warning'}`}>
                          {suggestion.priority === 'high' ? 'High Priority' : 'Medium Priority'}
                        </small>
                      </div>
                      <p className="mb-1 small">{suggestion.description}</p>
                      {suggestion.source !== 'Default' && (
                        <small className="text-info">Source: {suggestion.source}</small>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-3">
                  <p className="text-muted mb-0">
                    {Object.entries(metrics).length > 0 
                      ? "No suggestions available at this time" 
                      : "Add integrations to see suggestions for improvement"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* End of dashboard */}
    </div>
  );
};

export default Dashboard; 