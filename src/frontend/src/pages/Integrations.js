import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Integrations = () => {
  const { integrations: contextIntegrations, addIntegration } = useAuth();
  const [integrations, setIntegrations] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentIntegration, setCurrentIntegration] = useState(null);
  const [newIntegration, setNewIntegration] = useState({
    type: 'github',
    name: '',
    apiKey: '',
    repository: '',
    board: '',  // Add board field for Trello
    token: '',  // Add token field for Trello
    teamId: ''
  });
  const [editIntegration, setEditIntegration] = useState({
    id: null,
    type: '',
    name: '',
    apiKey: '',
    repository: '',
    token: '',  // Add token field for Trello
    teamId: ''
  });
  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [repositories, setRepositories] = useState([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [trelloBoards, setTrelloBoards] = useState([]);
  const [fetchingBoards, setFetchingBoards] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedIntegrationType, setSelectedIntegrationType] = useState(null);

  // Load integrations from AuthContext when component mounts
  useEffect(() => {
    console.log('Context integrations:', contextIntegrations);
    // Ensure we have a valid array and handle potential null/undefined values
    const safeIntegrations = Array.isArray(contextIntegrations) ? contextIntegrations : [];
    console.log('Setting safe integrations:', safeIntegrations);
    setIntegrations(safeIntegrations);
    
    // If we don't have any integrations, try to fetch them directly
    if (!safeIntegrations.length) {
      console.log('No integrations found in context, fetching directly...');
      api.get('/integrations')
        .then(response => {
          const integrationsData = response.data?.items || response.data || [];
          console.log('Directly fetched integrations:', integrationsData);
          if (Array.isArray(integrationsData)) {
            setIntegrations(integrationsData);
          }
        })
        .catch(error => {
          console.error('Error fetching integrations directly:', error);
        });
    }
    
    // Fetch available teams when component mounts
    fetchTeams();
  }, [contextIntegrations]);

  // Fetch teams from the API
  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const response = await api.get('/teams');
      // Handle both array and object responses
      const teamsData = response.data?.items || response.data || [];
      console.log('Fetched teams data:', teamsData);
      
      // Ensure we have a valid array
      if (Array.isArray(teamsData)) {
        setTeams(teamsData);
        
        // If we have teams, set the first one as default for new integrations
        if (teamsData.length > 0) {
          setNewIntegration(prev => ({ 
            ...prev, 
            teamId: teamsData[0].id.toString() 
          }));
        }
      } else {
        console.error('Invalid teams data received:', teamsData);
        setTeams([]);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setMessage({
        text: 'Failed to fetch teams: ' + (error.response?.data?.detail || 'Unknown error'),
        type: 'danger'
      });
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  };

  // Function to fetch GitHub repositories
  const fetchGitHubRepositories = async (apiKey) => {
    if (!apiKey || apiKey === '************') return;
    
    setFetchingRepos(true);
    setMessage(prevMessage => ({
      ...prevMessage,
      text: prevMessage.text && prevMessage.type === 'danger' ? '' : prevMessage.text,
      type: prevMessage.type === 'danger' ? '' : prevMessage.type
    }));
    
    try {
      console.log('Fetching GitHub repositories with API key length:', apiKey.length);
      const response = await api.post('/integrations/github/repositories', { api_key: apiKey });
      
      if (response.data && response.data.repositories) {
        console.log(`Found ${response.data.repositories.length} repositories`);
        setRepositories(response.data.repositories);
      } else {
        console.log('No repositories found in response:', response.data);
        setRepositories([]);
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setMessage({
        text: 'Failed to fetch repositories: ' + (error.response?.data?.detail || 'Please check your API key'),
        type: 'danger'
      });
      setRepositories([]);
    } finally {
      setFetchingRepos(false);
    }
  };

  // Function to fetch Trello boards
  const fetchTrelloBoards = async (apiKey, token) => {
    if (!apiKey || apiKey === '************') return;
    
    setFetchingBoards(true);
    setMessage(prevMessage => ({
      ...prevMessage,
      text: prevMessage.text && prevMessage.type === 'danger' ? '' : prevMessage.text,
      type: prevMessage.type === 'danger' ? '' : prevMessage.type
    }));
    
    try {
      console.log('Fetching Trello boards with API key length:', apiKey.length);
      const response = await api.post('/integrations/trello/boards', { 
        api_key: apiKey,
        token: token
      });
      
      if (response.data && response.data.boards) {
        console.log(`Found ${response.data.boards.length} boards`);
        setTrelloBoards(response.data.boards);
      } else {
        console.log('No boards found in response:', response.data);
        setTrelloBoards([]);
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
      setMessage({
        text: 'Failed to fetch boards: ' + (error.response?.data?.detail || error.message || 'Please check your API key and token'),
        type: 'danger'
      });
      setTrelloBoards([]);
    } finally {
      setFetchingBoards(false);
    }
  };

  // Listen for API key changes in Add form
  useEffect(() => {
    // Only fetch when adding GitHub integration and API key changes
    if (newIntegration.type === 'github' && newIntegration.apiKey && newIntegration.apiKey.length > 20) {
      fetchGitHubRepositories(newIntegration.apiKey);
    }
    // Fetch Trello boards when adding Trello integration and API key or token changes
    else if (newIntegration.type === 'trello' && newIntegration.apiKey && newIntegration.token) {
      fetchTrelloBoards(newIntegration.apiKey, newIntegration.token);
    }
  }, [newIntegration.type, newIntegration.apiKey, newIntegration.token]);

  // Handle API key change in Edit form
  const handleEditApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setEditIntegration({...editIntegration, apiKey: newApiKey});
    
    // Only fetch repositories if:
    // 1. It's a GitHub integration
    // 2. The API key is not the masked placeholder (************)
    // 3. The API key is long enough to be valid (typically 40+ chars for GitHub)
    if (editIntegration.type === 'github' && 
        newApiKey !== '************' && 
        newApiKey.length > 20) {
      console.log('Calling fetchGitHubRepositories from handleEditApiKeyChange');
      fetchGitHubRepositories(newApiKey);
    }
    // Fetch Trello boards if it's a Trello integration
    else if (editIntegration.type === 'trello' && 
             newApiKey !== '************' &&
             editIntegration.token) {
      fetchTrelloBoards(newApiKey, editIntegration.token);
    }
  };

  // Add handler for token changes
  const handleTokenChange = (e) => {
    const newToken = e.target.value;
    setEditIntegration({...editIntegration, token: newToken});
    
    // Fetch Trello boards if it's a Trello integration and we have both API key and token
    if (editIntegration.type === 'trello' && 
        editIntegration.apiKey !== '************' &&
        newToken) {
      fetchTrelloBoards(editIntegration.apiKey, newToken);
    }
  };

  const handleAddIntegration = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create integration data object
      const integrationData = {
        name: newIntegration.name,
        type: newIntegration.type,
        api_key: newIntegration.apiKey,
        project_id: newIntegration.projectId,
        team_id: newIntegration.teamId,
        config: {
          ...(newIntegration.type === 'github' ? { repository: newIntegration.repository } : {}),
          ...(newIntegration.type === 'trello' ? { board_id: newIntegration.board, token: newIntegration.token } : {})
        }
      };
      
      console.log('Creating integration with data:', {...integrationData, api_key: 'MASKED'});
      
      // Call the API to create the integration
      const response = await api.post('/integrations', integrationData);
      
      if (response.data) {
        // Add team_id to the response data if it's missing
        const newIntegrationData = {
          ...response.data,
          team_id: parseInt(integrationData.team_id),
          config: integrationData.config // Ensure we preserve the config
        };
        
        // Add to local state
        setIntegrations([...integrations, newIntegrationData]);
        
        setMessage({
          text: 'Integration added successfully',
          type: 'success'
        });
      }
      
      setShowAddModal(false);
      setNewIntegration({ 
        type: 'github', 
        name: '', 
        apiKey: '', 
        repository: '', 
        board: '',
        token: '',
        teamId: teams.length > 0 ? teams[0].id.toString() : '' 
      });
      setRepositories([]);
    } catch (error) {
      console.error('Error adding integration:', error);
      setMessage({ 
        text: 'Failed to add integration: ' + (error.response?.data?.detail || 'Unknown error'), 
        type: 'danger' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (integration) => {
    setCurrentIntegration(integration);
    
    // Get the team ID from either team_id or project_id
    const teamId = integration.team_id || integration.project_id;
    
    setEditIntegration({
      id: integration.id,
      type: integration.type,
      name: integration.name,
      apiKey: '************', // Mask the API key for security
      repository: integration.config?.repository || '', // Get repository from config if available
      board: integration.config?.board_id || '', // Get board_id from config if available
      token: integration.config?.token || '',  // Get token from config if available
      teamId: teamId ? teamId.toString() : ''
    });
    
    // If we have an existing repository, pre-fetch repositories list if possible
    if (integration.type === 'github') {
      // We can't use the masked API key to fetch repos, so we'll need to wait for user to enter a new one
      setRepositories([]);
    }
    
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Create update data object with all required fields from the model
      const updateData = {
        name: editIntegration.name,
        type: editIntegration.type,
        api_key: editIntegration.apiKey,
        project_id: parseInt(editIntegration.teamId),  // Backend still expects project_id, not team_id
        team_id: parseInt(editIntegration.teamId),
        config: {
          ...(editIntegration.type === 'github' ? { repository: editIntegration.repository } : {}),
          ...(editIntegration.type === 'trello' ? { board_id: editIntegration.board, token: editIntegration.token } : {})
        }
      };
      
      console.log('Sending update data:', {...updateData, api_key: updateData.api_key ? 'MASKED' : 'EMPTY'});
      
      const response = await api.put(`/integrations/${editIntegration.id}`, updateData);
      
      // Update the local state with the edited integration
      setIntegrations(integrations.map(integration => 
        integration.id === editIntegration.id 
          ? { 
              ...integration, 
              name: editIntegration.name, 
              type: editIntegration.type,
              team_id: parseInt(editIntegration.teamId),
              config: updateData.config // Use the same config we sent to the API
            }
          : integration
      ));
      
      setMessage({ 
        text: 'Integration updated successfully', 
        type: 'success' 
      });
      
      setShowEditModal(false);
      setRepositories([]);
    } catch (error) {
      console.error('Error updating integration:', error);
      
      // More detailed error logging for debugging
      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
      }
      
      setMessage({ 
        text: 'Failed to update integration: ' + (error.response?.data?.detail || error.message || 'Unknown error'), 
        type: 'danger' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncIntegration = async (integration) => {
    try {
      console.log('Starting sync for integration:', integration);
      
      // Get the latest integration data
      const response = await api.get(`/integrations/${integration.id}`);
      const integrationData = response.data;
      console.log('Latest integration data:', integrationData);
      
      // Ensure we have a config object
      const config = integrationData.config || {};
      
      // Prepare metrics request data based on integration type
      const metricsRequestData = {
        days: 30
      };
      
      if (integrationData.type === 'trello') {
        metricsRequestData.board_id = config.board_id || integrationData.board_id;
      } else if (integrationData.type === 'jira') {
        metricsRequestData.project_key = config.project_key || integrationData.project_key;
      }
      
      console.log('Metrics request data:', metricsRequestData);
      
      // Get metrics
      const metricsResponse = await api.post(`/integrations/${integration.id}/metrics`, metricsRequestData);
      console.log('Metrics response:', metricsResponse.data);
      
      // Update the integration in the list
      setIntegrations(prevIntegrations => 
        prevIntegrations.map(prev => 
          prev.id === integration.id 
            ? { ...prev, last_sync: new Date().toISOString() }
            : prev
        )
      );
      
      // Show success message
      setMessage({
        type: 'success',
        text: `Successfully synced ${integration.name} integration`
      });
    } catch (error) {
      console.error('Error syncing integration:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to sync integration'
      });
    }
  };

  const handleRemoveIntegration = async (integration) => {
    if (!window.confirm(`Are you sure you want to remove the "${integration.name}" integration?`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      await api.delete(`/integrations/${integration.id}`);
      
      // Remove from local state
      setIntegrations(integrations.filter(i => i.id !== integration.id));
      
      setMessage({
        text: `Integration "${integration.name}" has been removed`,
        type: 'success'
      });
    } catch (error) {
      console.error('Error removing integration:', error);
      setMessage({
        text: 'Failed to remove integration: ' + (error.response?.data?.detail || 'Unknown error'),
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    // Ensure integrations is an array and not empty
    if (!Array.isArray(integrations)) {
      console.error('Integrations is not an array:', integrations);
      setMessage({
        text: 'Invalid integrations data',
        type: 'danger'
      });
      return;
    }

    if (integrations.length === 0) {
      setMessage({
        text: 'No integrations to sync',
        type: 'warning'
      });
      return;
    }
    
    setLoading(true);
    setMessage({
      text: 'Syncing all integrations...',
      type: 'info'
    });
    
    try {
      let hasErrors = false;
      let errorMessages = [];
      
      // Sync each integration one by one
      for (const integration of integrations) {
        if (!integration || !integration.id) {
          console.warn('Invalid integration object:', integration);
          continue;
        }

        try {
          const response = await api.post(`/integrations/${integration.id}/metrics`, {
            days: 30 // Default to 30 days of data
          });
          
          // Check if there was an error in the metrics
          if (response.data.metrics && response.data.metrics.error) {
            hasErrors = true;
            
            // Provide more context for empty repository errors
            let errorMessage = response.data.metrics.error;
            if (errorMessage.includes("GitHub repository is empty") && integration.config?.repository) {
              errorMessage = `Empty repository: ${integration.config.repository}`;
            }
            
            errorMessages.push(`${integration.name || 'Unnamed'}: ${errorMessage}`);
          }
        } catch (err) {
          hasErrors = true;
          errorMessages.push(`${integration.name || 'Unnamed'}: ${err.response?.data?.detail || 'Failed to sync'}`);
        }
      }
      
      // Refresh the list
      const response = await api.get('/integrations');
      if (Array.isArray(response.data)) {
        setIntegrations(response.data);
      } else {
        console.error('Invalid response data:', response.data);
        setMessage({
          text: 'Failed to refresh integrations list: Invalid response format',
          type: 'danger'
        });
        return;
      }
      
      if (hasErrors) {
        setMessage({
          text: `Completed with issues: ${errorMessages.join('; ')}`,
          type: 'warning'
        });
      } else {
        setMessage({
          text: 'All integrations synced successfully',
          type: 'success'
        });
      }
    } catch (error) {
      console.error('Error during sync all:', error);
      setMessage({
        text: 'Failed to sync all integrations: ' + (error.response?.data?.detail || 'Unknown error'),
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  // Add this before the return statement
  console.log('Current integrations state:', integrations);

  // Add function to get API key instructions
  const getApiKeyInstructions = (type) => {
    switch(type) {
      case 'github':
        return (
          <>
            <h5>How to set up GitHub Integration:</h5>
            <ol className="mt-3">
              <li>
                <strong>Get your Personal Access Token:</strong>
                <ol>
                  <li>Log in to your GitHub account</li>
                  <li>Go to <b>Settings</b> &gt; <b>Developer settings</b> &gt; <b>Personal access tokens</b></li>
                  <li>Click <b>Generate new token</b> (Classic)</li>
                  <li>Give your token a descriptive name (e.g., "AgileTrack Integration")</li>
                </ol>
              </li>
              <li>
                <strong>Configure Token Permissions:</strong>
                <ol>
                  <li>Set an expiration date (recommended: 1 year)</li>
                  <li>Select the following scopes:
                    <ul>
                      <li><code>repo</code> - Full control of private repositories</li>
                      <li><code>read:user</code> - Read access to user profile data</li>
                      <li><code>user:email</code> - Read access to user email addresses</li>
                    </ul>
                  </li>
                  <li>Click <b>Generate token</b></li>
                </ol>
              </li>
              <li>
                <strong>Use the Token:</strong>
                <ol>
                  <li>Copy the token immediately (you won't be able to see it again!)</li>
                  <li>Paste the token in the API Key field</li>
                  <li>Your repositories will appear in the dropdown after entering a valid token</li>
                </ol>
              </li>
              <li>
                <strong>Repository Access:</strong>
                <ol>
                  <li>Make sure the token has access to the repositories you want to track</li>
                  <li>For organization repositories, ensure you have the necessary permissions</li>
                  <li>The repositories you have access to will appear in the dropdown after entering your token</li>
                </ol>
              </li>
            </ol>
            <div className="alert alert-info mt-3">
              <i className="fe fe-info me-2"></i>
              <strong>Note:</strong> The token grants access to your GitHub account, so keep it secure. You can revoke access at any time from your GitHub settings.
            </div>
            <div className="alert alert-warning mt-3">
              <i className="fe fe-alert-triangle me-2"></i>
              <strong>Important:</strong> Make sure you have the necessary permissions on the GitHub repositories you want to track. You need at least "Read" access to view repository data.
            </div>
          </>
        );
      
      case 'trello':
        return (
          <>
            <h5>How to set up Trello Integration:</h5>
            <ol className="mt-3">
              <li>
                <strong>Get your API Key:</strong>
                <ol>
                  <li>Log in to your Trello account</li>
                  <li>Visit the <a href="https://trello.com/app-key" target="_blank" rel="noopener noreferrer">Trello API Key Generation page</a></li>
                  <li>Copy the <b>API Key</b> shown at the top of the page</li>
                </ol>
              </li>
              <li>
                <strong>Generate a Token:</strong>
                <ol>
                  <li>On the same page, scroll down to the "Token" section</li>
                  <li>Click the link that says <b>"Token"</b> (it will be a clickable link)</li>
                  <li>You'll be asked to authorize the application - click <b>"Allow"</b></li>
                  <li>Copy the <b>Token</b> that appears</li>
                </ol>
              </li>
              <li>
                <strong>Enter Your Credentials:</strong>
                <ol>
                  <li>Paste your API Key in the "API Key" field</li>
                  <li>Paste your Token in the "Token" field</li>
                  <li>Your Trello boards will appear in the dropdown after entering both credentials</li>
                </ol>
              </li>
              <li>
                <strong>Board Access:</strong>
                <ol>
                  <li>Make sure you have access to the boards you want to track</li>
                  <li>You can manage board access in your Trello account settings</li>
                  <li>The boards you have access to will appear in the dropdown after entering your credentials</li>
                </ol>
              </li>
            </ol>
            <div className="alert alert-info mt-3">
              <i className="fe fe-info me-2"></i>
              <strong>Note:</strong> The token grants access to your Trello account, so keep it secure. You can revoke access at any time from your Trello account settings.
            </div>
            <div className="alert alert-warning mt-3">
              <i className="fe fe-alert-triangle me-2"></i>
              <strong>Important:</strong> Make sure you have the necessary permissions on the Trello boards you want to track. You need at least "Read" access to view board data.
            </div>
          </>
        );
      
      default:
        return <p>Please select an integration type to see instructions.</p>;
    }
  };

  // Add API Key Instructions Modal
  const renderApiKeyModal = () => {
    if (!showApiKeyModal) return null;

    return (
      <>
        <div 
          className="modal show d-block" 
          tabIndex="-1" 
          role="dialog" 
          style={{ zIndex: 1050 }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">API Key Instructions</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowApiKeyModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                {getApiKeyInstructions(selectedIntegrationType)}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => setShowApiKeyModal(false)}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
        <div 
          className="modal-backdrop fade show" 
          style={{ zIndex: 1040 }}
          onClick={() => setShowApiKeyModal(false)}
        ></div>
      </>
    );
  };

  return (
    <div className="integrations">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Integrations</h1>
        <div>
          <button 
            className="btn btn-outline-primary me-2" 
            onClick={handleSyncAll}
            disabled={loading || integrations.length === 0}
          >
            {loading ? 'Syncing...' : 'Sync All'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowAddModal(true)}
            disabled={loading}
          >
            Add Integration
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show mb-4`} role="alert">
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ text: '', type: '' })}></button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Connected Services</h5>
          
          {(!integrations || !Array.isArray(integrations) || integrations.length === 0) ? (
            <div className="text-center py-4 text-muted">
              <p>No integrations connected yet.</p>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowAddModal(true)}
                disabled={loading}
              >
                Connect your first integration
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Team</th>
                    <th>Status</th>
                    <th>Last Sync</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Ensure we have a valid array before mapping
                    const safeIntegrations = Array.isArray(integrations) ? integrations : [];
                    console.log('Rendering integrations:', safeIntegrations);
                    return safeIntegrations.map(integration => {
                      if (!integration || typeof integration !== 'object') {
                        console.warn('Invalid integration object:', integration);
                        return null;
                      }
                      
                      // Find the team name for this integration
                      const teamId = integration.team_id || integration.project_id;
                      const team = Array.isArray(teams) ? teams.find(t => t.id === teamId) : null;
                      const teamName = team ? team.name : 'Unknown';
                      
                      return (
                        <tr key={integration.id || Math.random()}>
                          <td>{integration.name || 'Unnamed'}</td>
                          <td>{integration.type || 'Unknown'}</td>
                          <td>{teamName}</td>
                          <td>
                            <span className={`badge ${integration.active ? 'bg-success' : 'bg-secondary'}`}>
                              {integration.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{integration.last_sync || 'Never'}</td>
                          <td>
                            <button 
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => handleSyncIntegration(integration)}
                              disabled={loading}
                            >
                              Sync
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-secondary me-2"
                              onClick={() => handleEditClick(integration)}
                              disabled={loading}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger me-1"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the integration "${integration.name}"?`)) {
                                  api.delete(`/integrations/${integration.id}`)
                                    .then(() => {
                                      // Remove from state
                                      setIntegrations(integrations.filter(i => i.id !== integration.id));
                                      alert(`Integration "${integration.name}" deleted successfully`);
                                    })
                                    .catch(error => {
                                      console.error('Error deleting integration:', error);
                                      alert(`Error deleting integration: ${error.response?.data?.detail || error.message}`);
                                    });
                                }
                              }}
                            >
                              <i className="fe fe-trash-2"></i> Delete
                            </button>
                            {integration.config && !integration.config.repository && integration.type.toLowerCase() === 'github' && (
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleEditClick(integration)}
                                title="This GitHub integration needs a repository to be configured"
                              >
                                <i className="fe fe-alert-triangle"></i> Configure
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }).filter(Boolean); // Remove any null entries
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Integration Modal */}
      {showAddModal && (
        <>
          <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Add Integration</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowAddModal(false)}
                    aria-label="Close"
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleAddIntegration}>
                    {/* Team Selection */}
                    <div className="mb-3">
                      <label htmlFor="teamSelection" className="form-label">Team</label>
                      {teamsLoading ? (
                        <div className="d-flex align-items-center">
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          <span>Loading teams...</span>
                        </div>
                      ) : teams.length > 0 ? (
                        <select 
                          id="teamSelection" 
                          className="form-select"
                          value={newIntegration.teamId}
                          onChange={(e) => setNewIntegration({...newIntegration, teamId: e.target.value})}
                          disabled={loading}
                          required
                        >
                          <option value="">Select a team</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="alert alert-warning">
                          No teams found. Please <a href="/teams/new">create a team</a> first.
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <label htmlFor="integrationType" className="form-label">Integration Type</label>
                      <select 
                        id="integrationType" 
                        className="form-select"
                        value={newIntegration.type}
                        onChange={(e) => setNewIntegration({...newIntegration, type: e.target.value})}
                        disabled={loading}
                      >
                        <option value="github">GitHub</option>
                        <option value="jira">Jira</option>
                        <option value="trello">Trello</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="integrationName" className="form-label">Name (Optional)</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        id="integrationName"
                        value={newIntegration.name}
                        onChange={(e) => setNewIntegration({...newIntegration, name: e.target.value})}
                        placeholder="Enter a name for this integration"
                        disabled={loading}
                      />
                    </div>
                    
                    {/* GitHub-specific fields */}
                    {newIntegration.type === 'github' && (
                      <div className="mb-3">
                        <label htmlFor="repository" className="form-label">Repository</label>
                        {fetchingRepos ? (
                          <div className="d-flex align-items-center">
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            <span>Loading repositories...</span>
                          </div>
                        ) : repositories.length > 0 ? (
                          <>
                            <select
                              className="form-select"
                              id="repository"
                              value={newIntegration.repository}
                              onChange={(e) => setNewIntegration({...newIntegration, repository: e.target.value})}
                              disabled={loading}
                              required
                            >
                              <option value="">Select a repository</option>
                              {repositories.map(repo => (
                                <option key={repo.id} value={repo.id}>
                                  {repo.name} {repo.private ? '(Private)' : ''}
                                </option>
                              ))}
                            </select>
                            <small className="form-text text-muted">
                              Found {repositories.length} repositories for your account
                            </small>
                          </>
                        ) : (
                          <div>
                            <input 
                              type="text" 
                              className="form-control" 
                              id="repository"
                              value={newIntegration.repository}
                              onChange={(e) => setNewIntegration({...newIntegration, repository: e.target.value})}
                              placeholder="username/repository"
                              disabled={loading}
                              required
                            />
                            <small className="form-text text-muted">
                              Format: username/repository (e.g., octocat/Hello-World)
                              {newIntegration.apiKey.length > 0 && newIntegration.apiKey.length < 20 && 
                                " - Enter a valid API key to see your repositories"}
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Trello-specific fields */}
                    {newIntegration.type === 'trello' && (
                      <>
                        <div className="mb-3">
                          <label htmlFor="board" className="form-label">Board</label>
                          {fetchingBoards ? (
                            <div className="d-flex align-items-center">
                              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                              <span>Loading boards...</span>
                            </div>
                          ) : trelloBoards.length > 0 ? (
                            <>
                              <select
                                className="form-select"
                                id="board"
                                value={newIntegration.board}
                                onChange={(e) => setNewIntegration({...newIntegration, board: e.target.value})}
                                disabled={loading}
                                required
                              >
                                <option value="">Select a board</option>
                                {trelloBoards.map(board => (
                                  <option key={board.id} value={board.id}>
                                    {board.name}
                                  </option>
                                ))}
                              </select>
                              <small className="form-text text-muted">
                                Found {trelloBoards.length} boards for your account
                              </small>
                            </>
                          ) : (
                            <div>
                              <input 
                                type="text" 
                                className="form-control" 
                                id="board"
                                value={newIntegration.board}
                                onChange={(e) => setNewIntegration({...newIntegration, board: e.target.value})}
                                placeholder="Enter board ID"
                                disabled={loading}
                                required
                              />
                              <small className="form-text text-muted">
                                Enter your Trello board ID or enter a valid API key and token to see your boards
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="mb-3">
                          <label htmlFor="token" className="form-label">Token</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            id="token"
                            value={newIntegration.token}
                            onChange={(e) => setNewIntegration({...newIntegration, token: e.target.value})}
                            placeholder="Enter your Trello token"
                            required
                          />
                          <small className="form-text text-muted">
                            Your Trello token is required to access your boards
                          </small>
                        </div>
                      </>
                    )}
                    
                    <div className="mb-3">
                      <label htmlFor="apiKey" className="form-label">API Key</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        id="apiKey"
                        value={newIntegration.apiKey}
                        onChange={(e) => setNewIntegration({...newIntegration, apiKey: e.target.value})}
                        required
                        placeholder="Enter your API key"
                      />
                      <div className="form-text">
                        <button 
                          type="button" 
                          className="btn btn-link p-0 text-decoration-none"
                          onClick={() => {
                            setSelectedIntegrationType(newIntegration.type);
                            setShowApiKeyModal(true);
                          }}
                        >
                          How to get your API key
                        </button>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setShowAddModal(false)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={loading || teams.length === 0}
                      >
                        {loading ? 'Connecting...' : 'Connect'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div 
            className="modal-backdrop fade show" 
            style={{ zIndex: 1040 }}
            onClick={() => !loading && setShowAddModal(false)}
          ></div>
        </>
      )}

      {/* Edit Integration Modal */}
      {showEditModal && currentIntegration && (
        <>
          <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ zIndex: 1050 }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit Integration</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setShowEditModal(false)}
                    aria-label="Close"
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleEditSubmit}>
                    {/* Team Selection */}
                    <div className="mb-3">
                      <label htmlFor="editTeamSelection" className="form-label">Team</label>
                      {teamsLoading ? (
                        <div className="d-flex align-items-center">
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          <span>Loading teams...</span>
                        </div>
                      ) : teams.length > 0 ? (
                        <select 
                          id="editTeamSelection" 
                          className="form-select"
                          value={editIntegration.teamId}
                          onChange={(e) => setEditIntegration({...editIntegration, teamId: e.target.value})}
                          disabled={loading}
                          required
                        >
                          <option value="">Select a team</option>
                          {teams.map(team => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="alert alert-warning">
                          No teams found. Please create a team first.
                        </div>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <label htmlFor="editIntegrationType" className="form-label">Integration Type</label>
                      <select 
                        id="editIntegrationType" 
                        className="form-select"
                        value={editIntegration.type}
                        onChange={(e) => setEditIntegration({...editIntegration, type: e.target.value})}
                        disabled={true} // Type cannot be changed
                      >
                        <option value="github">GitHub</option>
                        <option value="jira">Jira</option>
                        <option value="trello">Trello</option>
                      </select>
                      <small className="form-text text-muted">Integration type cannot be changed.</small>
                    </div>
                    <div className="mb-3">
                      <label htmlFor="editIntegrationName" className="form-label">Name</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        id="editIntegrationName"
                        value={editIntegration.name}
                        onChange={(e) => setEditIntegration({...editIntegration, name: e.target.value})}
                        placeholder="Enter a name for this integration"
                        disabled={loading}
                      />
                    </div>
                    
                    {/* GitHub-specific fields */}
                    {editIntegration.type === 'github' && (
                      <div className="mb-3">
                        <label htmlFor="editRepository" className="form-label">Repository</label>
                        {fetchingRepos ? (
                          <div className="d-flex align-items-center">
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            <span>Loading repositories...</span>
                          </div>
                        ) : repositories.length > 0 ? (
                          <>
                            <select
                              className="form-select"
                              id="editRepository"
                              value={editIntegration.repository}
                              onChange={(e) => setEditIntegration({...editIntegration, repository: e.target.value})}
                              disabled={loading}
                              required
                            >
                              <option value="">Select a repository</option>
                              {repositories.map(repo => (
                                <option key={repo.id} value={repo.id}>
                                  {repo.name} {repo.private ? '(Private)' : ''}
                                </option>
                              ))}
                            </select>
                            <small className="form-text text-muted">
                              Found {repositories.length} repositories for your account
                            </small>
                          </>
                        ) : (
                          <div>
                            <input 
                              type="text" 
                              className="form-control" 
                              id="editRepository"
                              value={editIntegration.repository || ''}
                              onChange={(e) => setEditIntegration({...editIntegration, repository: e.target.value})}
                              placeholder="username/repository"
                              disabled={loading}
                              required
                            />
                            <small className="form-text text-muted">
                              Format: username/repository (e.g., octocat/Hello-World)
                              {editIntegration.apiKey === '************' && 
                                " - Enter a new API key to see your repositories"}
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Trello-specific fields in Edit form */}
                    {editIntegration.type === 'trello' && (
                      <>
                        <div className="mb-3">
                          <label htmlFor="editBoard" className="form-label">Board</label>
                          {fetchingBoards ? (
                            <div className="d-flex align-items-center">
                              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                              <span>Loading boards...</span>
                            </div>
                          ) : trelloBoards.length > 0 ? (
                            <>
                              <select
                                className="form-select"
                                id="editBoard"
                                value={editIntegration.board}
                                onChange={(e) => setEditIntegration({...editIntegration, board: e.target.value})}
                                disabled={loading}
                                required
                              >
                                <option value="">Select a board</option>
                                {trelloBoards.map(board => (
                                  <option key={board.id} value={board.id}>
                                    {board.name}
                                  </option>
                                ))}
                              </select>
                              <small className="form-text text-muted">
                                Found {trelloBoards.length} boards for your account
                              </small>
                            </>
                          ) : (
                            <div>
                              <input 
                                type="text" 
                                className="form-control" 
                                id="editBoard"
                                value={editIntegration.board || ''}
                                onChange={(e) => setEditIntegration({...editIntegration, board: e.target.value})}
                                placeholder="Enter board ID"
                                disabled={loading}
                                required
                              />
                              <small className="form-text text-muted">
                                Enter your Trello board ID or enter a valid API key and token to see your boards
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="mb-3">
                          <label htmlFor="editToken" className="form-label">Token</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            id="editToken"
                            value={editIntegration.token}
                            onChange={handleTokenChange}
                            placeholder="Enter your Trello token"
                            disabled={loading}
                          />
                          <small className="form-text text-muted">
                            Enter a new token to update it, or leave unchanged to keep the current token
                          </small>
                        </div>
                      </>
                    )}
                    
                    <div className="mb-3">
                      <label htmlFor="editApiKey" className="form-label">API Key</label>
                      <input 
                        type="text" 
                        className="form-control" 
                        id="editApiKey"
                        value={editIntegration.apiKey}
                        onChange={handleEditApiKeyChange}
                        placeholder="Enter new API key (leave masked to keep current)"
                        disabled={loading}
                      />
                      <small className="form-text text-muted">Leave unchanged to keep current API key.</small>
                    </div>
                    <div className="modal-footer">
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => setShowEditModal(false)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={loading || teams.length === 0}
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div 
            className="modal-backdrop fade show" 
            style={{ zIndex: 1040 }}
            onClick={() => !loading && setShowEditModal(false)}
          ></div>
        </>
      )}

      {renderApiKeyModal()}
    </div>
  );
};

export default Integrations; 