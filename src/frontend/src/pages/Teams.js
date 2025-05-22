import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Teams = () => {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [teamIntegrations, setTeamIntegrations] = useState({});
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
    // Fetch teams
    const fetchTeams = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/teams');
        const teamsData = response.data?.items || [];
        setTeams(teamsData);
        
        // Fetch integrations for each team
        const integrationsPromises = teamsData.map(team => 
          api.get(`/teams/${team.id}/integrations`)
            .then(response => ({ 
              teamId: team.id, 
              integrations: response.data || [] 
            }))
            .catch(error => ({ 
              teamId: team.id, 
              integrations: [] 
            }))
        );
        
        const integrationsResults = await Promise.all(integrationsPromises);
        
        // Create an object mapping team ID to integrations
        const integrationsMap = {};
        integrationsResults.forEach(result => {
          integrationsMap[result.teamId] = result.integrations;
        });
        
        setTeamIntegrations(integrationsMap);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setError('Failed to load teams. Please try again later.');
        setTeams([]);
        setLoading(false);
      }
    };
    
    fetchTeams();
  }, []);

  // Filter teams based on search term
  const filteredTeams = Array.isArray(teams) ? teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.description && team.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ) : [];

  // Get integration icon based on type
  const getIntegrationIcon = (type) => {
    const typeLC = type.toLowerCase();
    if (typeLC === 'github' || typeLC === 'gitlab') {
      return 'fe fe-git-branch';
    } else if (typeLC === 'jira') {
      return 'fe fe-layout';
    } else if (typeLC === 'trello') {
      return 'fe fe-trello';
    } else {
      return 'fe fe-package';
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
  
  // Get maturity level badge color
  const getMaturityColor = (level) => {
    switch (level) {
      case 1: return 'bg-danger';
      case 2: return 'bg-warning';
      case 3: return 'bg-info';
      case 4: return 'bg-primary';
      case 5: return 'bg-success';
      default: return 'bg-secondary';
    }
  };
  
  // Get maturity level text
  const getMaturityText = (level) => {
    switch (level) {
      case 1: return 'Initial';
      case 2: return 'Emerging';
      case 3: return 'Defined';
      case 4: return 'Measured';
      case 5: return 'Optimizing';
      default: return 'Unknown';
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
        <h1 className="h2">Teams</h1>
        <div className="btn-toolbar mb-2 mb-md-0">
          <Link to="/teams/new" className="btn btn-sm btn-primary">
            <i className="bi bi-plus-circle me-1"></i> New Team
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
              <i className="fe fe-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Teams list */}
      <div className="row">
        {filteredTeams.length === 0 ? (
          <div className="col-12 text-center my-5">
            <div className="card shadow-sm p-5">
              <h4 className="text-muted">No teams found</h4>
              <p className="mb-4">Create your first team to get started tracking your agile maturity</p>
              <div>
                <Link to="/teams/new" className="btn btn-primary">
                  <i className="fe fe-plus-circle me-1"></i> Create New Team
                </Link>
              </div>
            </div>
          </div>
        ) : (
          filteredTeams.map(team => (
            <div key={team.id} className="col-md-6 col-lg-4 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title mb-0">{team.name}</h5>
                    <span className={`badge ${getMaturityColor(team.maturity_level)} rounded-pill`}>
                      Level {team.maturity_level}: {getMaturityText(team.maturity_level)}
                    </span>
                  </div>
                  <p className="card-text text-muted">
                    {team.description || 'No description provided'}
                  </p>
                  <div className="mt-3">
                    <span className={`badge ${team.active ? 'bg-success' : 'bg-secondary'} me-2`}>
                      {team.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="card-footer bg-white border-top-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      {teamIntegrations[team.id] && teamIntegrations[team.id].length > 0 ? (
                        teamIntegrations[team.id].slice(0, 3).map((integration, idx) => (
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
                    <Link to={`/teams/${team.id}`} className="btn btn-sm btn-outline-primary">
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

export default Teams; 