import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Setup = () => {
  const { currentUser, setupComplete, hasIntegration, completeSetup, addIntegration } = useAuth();
  const navigate = useNavigate();
  
  // Determine initial step based on current state
  const [step, setStep] = useState(setupComplete ? 2 : 1);
  const [loading, setLoading] = useState(true);
  const [accountDetails, setAccountDetails] = useState({
    name: '',
    company: '',
    role: '',
    teamSize: ''
  });
  const [integration, setIntegration] = useState({
    type: 'github',
    apiKey: '',
    name: '',
    repository: '',
    board: ''
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [error, setError] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [trelloBoards, setTrelloBoards] = useState([]);
  const [fetchingBoards, setFetchingBoards] = useState(false);
  
  // Fetch latest user status from the API on component mount
  useEffect(() => {
    const fetchUserStatus = async () => {
      try {
        console.log("Setup: Fetching user status");
        
        // Use axios instead of fetch
        const response = await api.get('/auth/me');
        
        const userData = response.data;
        console.log("Setup: User data from API:", userData);
        
        // If user has already fully completed setup, redirect to dashboard
        if (userData.setup_complete && userData.has_integration) {
          console.log("Setup: User has completed setup and has integrations, redirecting to dashboard");
          navigate('/');
          return;
        }
        
        // If user has completed account setup but not integrations, go to step 2
        if (userData.setup_complete && !userData.has_integration) {
          console.log("Setup: User has completed setup but no integrations, going to step 2");
          setStep(2);
        } else {
          console.log("Setup: User has not completed setup, starting at step 1");
        }
        
      } catch (error) {
        console.error('Setup: Error checking user status:', error);
        // If there's an error, we'll just continue with the default step
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserStatus();
  }, [navigate]);

  useEffect(() => {
    // Prefill name from the user data if available
    if (currentUser && currentUser.name) {
      setAccountDetails(prev => ({
        ...prev,
        name: currentUser.name
      }));
    }
  }, [currentUser, setupComplete, hasIntegration, navigate]);

  // Add effect to fetch repositories or boards when a valid API key is entered
  useEffect(() => {
    // Only fetch when API key is long enough
    if (integration.apiKey && integration.apiKey.length > 20) {
      if (integration.type === 'github') {
        fetchGitHubRepositories(integration.apiKey);
      } else if (integration.type === 'trello') {
        fetchTrelloBoards(integration.apiKey);
      }
    }
  }, [integration.type, integration.apiKey]);

  // Function to fetch GitHub repositories
  const fetchGitHubRepositories = async (apiKey) => {
    setFetchingRepos(true);
    setError(''); // Clear any previous errors
    
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
      setError('Failed to fetch repositories: ' + (error.response?.data?.detail || 'Please check your API key'));
      setRepositories([]);
    } finally {
      setFetchingRepos(false);
    }
  };

  // Function to fetch Trello boards
  const fetchTrelloBoards = async (apiKey) => {
    setFetchingBoards(true);
    setError(''); // Clear any previous errors
    
    try {
      console.log('Fetching Trello boards with API key length:', apiKey.length);
      const response = await api.post('/integrations/trello/boards', { api_key: apiKey });
      
      if (response.data && response.data.boards) {
        console.log(`Found ${response.data.boards.length} boards`);
        setTrelloBoards(response.data.boards);
      } else {
        console.log('No boards found in response:', response.data);
        setTrelloBoards([]);
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
      setError('Failed to fetch boards: ' + (error.response?.data?.detail || 'Please check your API key'));
      setTrelloBoards([]);
    } finally {
      setFetchingBoards(false);
    }
  };

  const handleAccountInfoSubmit = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleIntegrationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // First, complete the account setup if needed
      if (!setupComplete) {
        console.log("Completing setup with data:", {
          full_name: accountDetails.name,
          company: accountDetails.company,
          role: accountDetails.role,
          team_size: accountDetails.teamSize
        });
        
        await completeSetup({
          full_name: accountDetails.name,
          company: accountDetails.company,
          role: accountDetails.role,
          team_size: accountDetails.teamSize
        });
      }
      
      // Create a default team for the user
      console.log("Creating default team");
      let teamId = 1; // Default fallback
      
      try {
        const teamName = integration.name ? `${integration.name} Team` : 'Default Team';
        const teamResponse = await api.post('/teams', {
          name: teamName,
          description: `Created automatically during setup for ${integration.type} integration`
        });
        
        console.log("Team created successfully:", teamResponse.data);
        teamId = teamResponse.data.id;
      } catch (teamError) {
        console.error('Error creating team:', teamError);
        // Continue with default team ID if team creation fails
      }
      
      console.log("Adding integration:", {
        type: integration.type,
        name: integration.name,
        repository: integration.repository,
        board: integration.board,
        teamId: teamId
      });
      
      // Then add the integration with the correct field names and team ID
      await addIntegration({
        type: integration.type,
        name: integration.name,
        apiKey: integration.apiKey,
        repository: integration.repository,
        board: integration.board,
        project_id: teamId, // Use the team ID as project_id
        team_id: teamId,    // Also include team_id
        config: integration.type === 'github' ? 
          { repository: integration.repository } : 
          integration.type === 'trello' ? 
            { board_id: integration.board } : 
            {}
      });
      
      // Redirect to dashboard
      navigate('/');
    } catch (error) {
      console.error('Integration setup failed:', error);
      
      // Display a user-friendly error message
      setError(error.message || 'Failed to setup integration. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Get API key instructions based on the selected integration type
  const getApiKeyInstructions = () => {
    switch(integration.type) {
      case 'github':
        return (
          <>
            <h5>How to get your GitHub API Key:</h5>
            <ol className="mt-3">
              <li>Log in to your GitHub account</li>
              <li>Go to <b>Settings</b> &gt; <b>Developer settings</b> &gt; <b>Personal access tokens</b></li>
              <li>Click <b>Generate new token</b></li>
              <li>Give your token a descriptive name</li>
              <li>Select the following scopes: <code>repo</code>, <code>read:user</code>, <code>user:email</code></li>
              <li>Click <b>Generate token</b></li>
              <li>Copy the token immediately (you won't be able to see it again!)</li>
            </ol>
            <div className="alert alert-warning mt-3">
              <i className="fe fe-alert-triangle me-2"></i>
              Keep your token secure! Don't share it publicly or commit it to repositories.
            </div>
          </>
        );
      
      case 'jira':
        return (
          <>
            <h5>How to get your Jira API Key:</h5>
            <ol className="mt-3">
              <li>Log in to your Atlassian account</li>
              <li>Go to <b>Account Settings</b> &gt; <b>Security</b></li>
              <li>Under <b>API token</b>, click <b>Create and manage API tokens</b></li>
              <li>Click <b>Create API token</b></li>
              <li>Give your token a descriptive label</li>
              <li>Click <b>Create</b></li>
              <li>Copy your API token</li>
            </ol>
            <div className="alert alert-info mt-3">
              <i className="fe fe-info me-2"></i>
              You'll also need your Jira email address and Jira URL to use this integration.
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
                  <li>Copy the <b>API Key</b> shown at the top</li>
                </ol>
              </li>
              <li>
                <strong>Generate a Token:</strong>
                <ol>
                  <li>On the same page, scroll down to the "Token" section</li>
                  <li>Click the link to <b>generate a Token</b></li>
                  <li>Click <b>Allow</b> to grant access to your Trello account</li>
                  <li>Copy the <b>Token</b> shown</li>
                </ol>
              </li>
              <li>
                <strong>Combine the Key and Token:</strong>
                <ol>
                  <li>Format: <code>your_api_key:your_token</code></li>
                  <li>Example: <code>1234567890abcdef:abcdef1234567890</code></li>
                  <li>Paste this combined string in the API Key field</li>
                </ol>
              </li>
              <li>
                <strong>Board Access:</strong>
                <ol>
                  <li>Make sure to grant access to the boards you want to track</li>
                  <li>You can manage board access in your Trello account settings</li>
                  <li>The boards you have access to will appear in the dropdown after entering your API key</li>
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

  return (
    <div className="container">
      <div className="row justify-content-center mt-4">
        <div className="col-md-8">
          <div className="card shadow">
            <div className="card-body p-4">
              <div className="text-center mb-4">
                <img 
                  src="/assets/img/AgileTrack.webp" 
                  alt="AgileTrack Logo" 
                  height="50" 
                  className="mb-3"
                />
                <h2>Welcome to AgileTrack</h2>
                <p className="text-muted">Complete setup to start tracking your projects</p>
              </div>
              
              {/* Display error if any */}
              {error && (
                <div className="alert alert-danger mb-4" role="alert">
                  {error}
                </div>
              )}
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="progress">
                  <div 
                    className="progress-bar" 
                    role="progressbar" 
                    style={{ width: step === 1 ? '50%' : '100%' }}
                    aria-valuenow={step === 1 ? 50 : 100} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
                <div className="d-flex justify-content-between mt-2">
                  <div className={step >= 1 ? 'text-primary' : 'text-muted'}>
                    <small>Account Information</small>
                  </div>
                  <div className={step >= 2 ? 'text-primary' : 'text-muted'}>
                    <small>Connect Integration</small>
                  </div>
                </div>
              </div>
              
              {/* Step 1: Account Information */}
              {step === 1 && (
                <form onSubmit={handleAccountInfoSubmit}>
                  <h4 className="mb-3">Account Information</h4>
                  
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">Your Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      value={accountDetails.name}
                      onChange={(e) => setAccountDetails({...accountDetails, name: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="company" className="form-label">Company Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="company"
                      value={accountDetails.company}
                      onChange={(e) => setAccountDetails({...accountDetails, company: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="role" className="form-label">Your Role</label>
                    <select
                      className="form-select"
                      id="role"
                      value={accountDetails.role}
                      onChange={(e) => setAccountDetails({...accountDetails, role: e.target.value})}
                      required
                    >
                      <option value="">Select your role</option>
                      <option value="developer">Developer</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="product_manager">Product Manager</option>
                      <option value="scrum_master">Scrum Master</option>
                      <option value="project_manager">Project Manager</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="teamSize" className="form-label">Team Size</label>
                    <select
                      className="form-select"
                      id="teamSize"
                      value={accountDetails.teamSize}
                      onChange={(e) => setAccountDetails({...accountDetails, teamSize: e.target.value})}
                      required
                    >
                      <option value="">Select team size</option>
                      <option value="1-5">1-5</option>
                      <option value="6-10">6-10</option>
                      <option value="11-25">11-25</option>
                      <option value="26-50">26-50</option>
                      <option value="51+">51+</option>
                    </select>
                  </div>
                  
                  <div className="d-flex justify-content-end">
                    <button type="submit" className="btn btn-primary">
                      Continue
                    </button>
                  </div>
                </form>
              )}
              
              {/* Step 2: Integration Setup */}
              {step === 2 && (
                <form onSubmit={handleIntegrationSubmit}>
                  <h4 className="mb-3">Connect an Integration</h4>
                  <p className="text-muted mb-4">
                    AgileTrack requires at least one integration to import and monitor your projects.
                  </p>
                  
                  <div className="mb-3">
                    <label htmlFor="integrationType" className="form-label">Integration Type</label>
                    <select 
                      id="integrationType" 
                      className="form-select"
                      value={integration.type}
                      onChange={(e) => setIntegration({...integration, type: e.target.value})}
                      required
                    >
                      <option value="github">GitHub</option>
                      <option value="jira">Jira</option>
                      <option value="trello">Trello</option>
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="integrationName" className="form-label">Integration Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      id="integrationName"
                      value={integration.name}
                      onChange={(e) => setIntegration({...integration, name: e.target.value})}
                      placeholder="Enter a name for this integration"
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="apiKey" className="form-label">API Key</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      id="apiKey"
                      value={integration.apiKey}
                      onChange={(e) => setIntegration({...integration, apiKey: e.target.value})}
                      required
                      placeholder="Enter your API key"
                    />
                    <div className="form-text">
                      <button 
                        type="button" 
                        className="btn btn-link p-0 text-decoration-none"
                        onClick={() => setShowApiKeyModal(true)}
                      >
                        How to get your API key
                      </button>
                    </div>
                  </div>
                  
                  {/* Repository Selection Dropdown - Only show for GitHub when repositories are loaded */}
                  {integration.type === 'github' && (
                    <div className="mb-3">
                      <label htmlFor="repository" className="form-label">Repository</label>
                      {fetchingRepos ? (
                        <div className="d-flex align-items-center">
                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <span>Loading repositories...</span>
                        </div>
                      ) : repositories.length > 0 ? (
                        <select
                          id="repository"
                          className="form-select"
                          value={integration.repository}
                          onChange={(e) => setIntegration({...integration, repository: e.target.value})}
                          required
                        >
                          <option value="">Select a repository</option>
                          {repositories.map(repo => (
                            <option key={repo.id} value={repo.name}>
                              {repo.name} {repo.private ? '(Private)' : '(Public)'}
                            </option>
                          ))}
                        </select>
                      ) : integration.apiKey && integration.apiKey.length > 10 ? (
                        <div className="alert alert-warning">
                          No repositories found or API key is invalid. Please check your API key and try again.
                        </div>
                      ) : (
                        <div className="form-text text-muted">
                          Enter a valid GitHub API key above to load your repositories.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Board Selection Dropdown - Only show for Trello when boards are loaded */}
                  {integration.type === 'trello' && (
                    <div className="mb-3">
                      <label htmlFor="board" className="form-label">Board</label>
                      {fetchingBoards ? (
                        <div className="d-flex align-items-center">
                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          <span>Loading boards...</span>
                        </div>
                      ) : trelloBoards.length > 0 ? (
                        <select
                          id="board"
                          className="form-select"
                          value={integration.board}
                          onChange={(e) => setIntegration({...integration, board: e.target.value})}
                          required
                        >
                          <option value="">Select a board</option>
                          {trelloBoards.map(board => (
                            <option key={board.id} value={board.id}>
                              {board.name}
                            </option>
                          ))}
                        </select>
                      ) : integration.apiKey && integration.apiKey.length > 10 ? (
                        <div className="alert alert-warning">
                          No boards found or API key is invalid. Please check your API key and try again.
                        </div>
                      ) : (
                        <div className="form-text text-muted">
                          Enter a valid Trello API key above to load your boards.
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="d-flex justify-content-between">
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={loading || 
                        (integration.type === 'github' && !integration.repository) ||
                        (integration.type === 'trello' && !integration.board)}
                    >
                      {loading ? 'Connecting...' : 'Complete Setup'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Key Instructions Modal */}
      {showApiKeyModal && (
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
                  {getApiKeyInstructions()}
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
      )}
    </div>
  );
};

export default Setup; 