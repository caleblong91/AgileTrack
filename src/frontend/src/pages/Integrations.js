import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Integrations = () => {
  const { integrations: contextIntegrations, addIntegration } = useAuth();
  const [integrations, setIntegrations] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentIntegration, setCurrentIntegration] = useState(null);
  const [newIntegration, setNewIntegration] = useState({
    type: 'github',
    name: '',
    apiKey: '',
    repository: '',
  });
  const [editIntegration, setEditIntegration] = useState({
    id: null,
    type: '',
    name: '',
    apiKey: '',
    repository: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [repositories, setRepositories] = useState([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);

  // Load integrations from AuthContext when component mounts
  useEffect(() => {
    setIntegrations(contextIntegrations);
  }, [contextIntegrations]);

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

  // Listen for API key changes in Add form
  useEffect(() => {
    // Only fetch when adding GitHub integration and API key changes
    if (newIntegration.type === 'github' && newIntegration.apiKey && newIntegration.apiKey.length > 20) {
      fetchGitHubRepositories(newIntegration.apiKey);
    }
  }, [newIntegration.type, newIntegration.apiKey]);

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
  };

  const handleAddIntegration = (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Add integration through the context
      const integrationData = {
        type: newIntegration.type,
        name: newIntegration.name,
        apiKey: newIntegration.apiKey
      };
      
      // Add config for GitHub integrations
      if (newIntegration.type === 'github' && newIntegration.repository) {
        integrationData.config = {
          repository: newIntegration.repository
        };
      }
      
      addIntegration(integrationData);
      
      setShowAddModal(false);
      setNewIntegration({ type: 'github', name: '', apiKey: '', repository: '' });
      setRepositories([]);
      setLoading(false);
    } catch (error) {
      console.error('Error adding integration:', error);
      setMessage({ 
        text: 'Failed to add integration: ' + (error.response?.data?.detail || 'Unknown error'), 
        type: 'danger' 
      });
      setLoading(false);
    }
  };

  const handleEditClick = (integration) => {
    setCurrentIntegration(integration);
    setEditIntegration({
      id: integration.id,
      type: integration.type,
      name: integration.name,
      apiKey: '************', // Mask the API key for security
      repository: integration.config?.repository || '' // Get repository from config if available
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
      // Only update if the API key has been changed (not still masked)
      const updateData = {
        name: editIntegration.name,
        type: editIntegration.type,
        project_id: currentIntegration.project_id,
        config: {
          ...currentIntegration.config, // Preserve existing config
          repository: editIntegration.repository // Add/update repository
        }
      };
      
      // Only include API key if it's been changed (not masked)
      if (editIntegration.apiKey !== '************') {
        updateData.api_key = editIntegration.apiKey;
      }
      
      const response = await api.put(`/integrations/${editIntegration.id}`, updateData);
      
      // Update the local state with the edited integration
      setIntegrations(integrations.map(integration => 
        integration.id === editIntegration.id 
          ? { 
              ...integration, 
              name: editIntegration.name, 
              type: editIntegration.type,
              config: {
                ...integration.config,
                repository: editIntegration.repository
              }
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
      setMessage({ 
        text: 'Failed to update integration: ' + (error.response?.data?.detail || 'Unknown error'), 
        type: 'danger' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncIntegration = async (integration) => {
    setLoading(true);
    
    try {
      // Call the metrics endpoint to trigger a sync
      const response = await api.post(`/integrations/${integration.id}/metrics`, {
        days: 30 // Default to 30 days of data
      });
      
      // Check if there was an error in the metrics
      if (response.data.metrics && response.data.metrics.error) {
        let errorMessage = response.data.metrics.error;
        let errorType = 'warning';
        
        // Check for specific error messages and provide more helpful context
        if (errorMessage.includes("GitHub repository is empty")) {
          errorType = 'info';
          errorMessage = `${errorMessage} You'll need to push code to "${integration.config?.repository || 'your repository'}" before metrics can be collected.`;
        }
        
        setMessage({
          text: `Sync issue: ${errorMessage}`,
          type: errorType
        });
      } else {
        setMessage({ 
          text: `Synced "${integration.name}" successfully`, 
          type: 'success' 
        });
      }
      
      // Refresh integrations list
      const integrationsResponse = await api.get('/integrations');
      setIntegrations(integrationsResponse.data);
    } catch (error) {
      console.error('Error syncing integration:', error);
      setMessage({ 
        text: 'Failed to sync: ' + (error.response?.data?.detail || 'Unknown error'), 
        type: 'danger' 
      });
    } finally {
      setLoading(false);
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
            
            errorMessages.push(`${integration.name}: ${errorMessage}`);
          }
        } catch (err) {
          hasErrors = true;
          errorMessages.push(`${integration.name}: ${err.response?.data?.detail || 'Failed to sync'}`);
        }
      }
      
      // Refresh the list
      const response = await api.get('/integrations');
      setIntegrations(response.data);
      
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
          
          {integrations.length === 0 ? (
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
                    <th>Status</th>
                    <th>Last Sync</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map(integration => (
                    <tr key={integration.id}>
                      <td>{integration.name}</td>
                      <td>{integration.type}</td>
                      <td>
                        <span className={`badge ${integration.active ? 'bg-success' : 'bg-secondary'}`}>
                          {integration.active ? 'Connected' : 'Inactive'}
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
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemoveIntegration(integration)}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
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
                        disabled={loading}
                      />
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
                        disabled={loading}
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
                        disabled={loading}
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
    </div>
  );
};

export default Integrations; 