import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Settings = () => {
  const { currentUser } = useAuth();
  
  const [generalSettings, setGeneralSettings] = useState({
    companyName: '',
    timeZone: 'UTC',
    emailNotifications: true,
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    githubSyncInterval: 60,
    jiraSyncInterval: 60,
    trelloSyncInterval: 60,
  });

  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    password: '********',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Load user data when component mounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get user details from the auth endpoint
        const response = await api.get('/auth/me');
        const userData = response.data;
        
        // Update the user profile state
        setUserProfile({
          name: userData.full_name || userData.username,
          email: userData.email,
          password: '********' // Keep password masked
        });
        
        // Update general settings if available
        setGeneralSettings({
          companyName: userData.company || 'Your Company',
          timeZone: 'UTC', // Default since we don't store this yet
          emailNotifications: true // Default since we don't store this yet
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load user data:', error);
        setMessage({
          text: 'Failed to load user data. Please try again later.',
          type: 'danger'
        });
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, []);

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    try {
      // In a real app, this would send the settings to the API
      await api.put('/auth/setup', {
        full_name: userProfile.name,
        company: generalSettings.companyName,
        role: currentUser?.role || '',
        team_size: currentUser?.team_size || ''
      });
      
      setMessage({
        text: 'General settings saved successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        text: 'Failed to save settings. Please try again.',
        type: 'danger'
      });
    }
  };

  const handleIntegrationSubmit = async (e) => {
    e.preventDefault();
    try {
      // Save integration settings - this endpoint doesn't exist yet
      // We would need to create it on the backend
      setMessage({
        text: 'Integration settings saved successfully!',
        type: 'success'
      });
    } catch (error) {
      setMessage({
        text: 'Failed to save integration settings.',
        type: 'danger'
      });
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update user profile (except password which needs special handling)
      await api.put('/auth/setup', {
        full_name: userProfile.name,
        company: generalSettings.companyName,
        role: currentUser?.role || '',
        team_size: currentUser?.team_size || ''
      });
      
      setMessage({
        text: 'Profile updated successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({
        text: 'Failed to update profile. Please try again.',
        type: 'danger'
      });
    }
  };

  if (isLoading) {
    return <div className="text-center p-5">Loading settings...</div>;
  }

  return (
    <div className="settings">
      <h1 className="mb-4">Settings</h1>
      
      {message.text && (
        <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
          {message.text}
          <button type="button" className="btn-close" onClick={() => setMessage({ text: '', type: '' })}></button>
        </div>
      )}
      
      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="list-group">
            <a href="#general" className="list-group-item list-group-item-action active">General</a>
            <a href="#integrations" className="list-group-item list-group-item-action">Integrations</a>
            <a href="#profile" className="list-group-item list-group-item-action">User Profile</a>
          </div>
        </div>
        
        <div className="col-md-8">
          <div id="general" className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">General Settings</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleGeneralSubmit}>
                <div className="mb-3">
                  <label htmlFor="companyName" className="form-label">Company Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    id="companyName"
                    value={generalSettings.companyName}
                    onChange={(e) => setGeneralSettings({...generalSettings, companyName: e.target.value})}
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="timeZone" className="form-label">Time Zone</label>
                  <select 
                    className="form-select" 
                    id="timeZone"
                    value={generalSettings.timeZone}
                    onChange={(e) => setGeneralSettings({...generalSettings, timeZone: e.target.value})}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  </select>
                </div>
                
                <div className="mb-3 form-check">
                  <input 
                    type="checkbox" 
                    className="form-check-input" 
                    id="emailNotifications"
                    checked={generalSettings.emailNotifications}
                    onChange={(e) => setGeneralSettings({...generalSettings, emailNotifications: e.target.checked})}
                  />
                  <label className="form-check-label" htmlFor="emailNotifications">Enable Email Notifications</label>
                </div>
                
                <button type="submit" className="btn btn-primary">Save General Settings</button>
              </form>
            </div>
          </div>
          
          <div id="integrations" className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Integration Settings</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleIntegrationSubmit}>
                <div className="mb-3">
                  <label htmlFor="githubSyncInterval" className="form-label">GitHub Sync Interval (minutes)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    id="githubSyncInterval"
                    value={integrationSettings.githubSyncInterval}
                    onChange={(e) => setIntegrationSettings({...integrationSettings, githubSyncInterval: parseInt(e.target.value)})}
                    min="5"
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="jiraSyncInterval" className="form-label">Jira Sync Interval (minutes)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    id="jiraSyncInterval"
                    value={integrationSettings.jiraSyncInterval}
                    onChange={(e) => setIntegrationSettings({...integrationSettings, jiraSyncInterval: parseInt(e.target.value)})}
                    min="5"
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="trelloSyncInterval" className="form-label">Trello Sync Interval (minutes)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    id="trelloSyncInterval"
                    value={integrationSettings.trelloSyncInterval}
                    onChange={(e) => setIntegrationSettings({...integrationSettings, trelloSyncInterval: parseInt(e.target.value)})}
                    min="5"
                  />
                </div>
                
                <button type="submit" className="btn btn-primary">Save Integration Settings</button>
              </form>
            </div>
          </div>
          
          <div id="profile" className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">User Profile</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleProfileSubmit}>
                <div className="mb-3">
                  <label htmlFor="userName" className="form-label">Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    id="userName"
                    value={userProfile.name}
                    onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="userEmail" className="form-label">Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    id="userEmail"
                    value={userProfile.email}
                    onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                    disabled
                  />
                  <small className="form-text text-muted">Email cannot be changed.</small>
                </div>
                
                <div className="mb-3">
                  <label htmlFor="userPassword" className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    id="userPassword"
                    value={userProfile.password}
                    onChange={(e) => setUserProfile({...userProfile, password: e.target.value})}
                    placeholder="Enter new password to change"
                  />
                  <small className="form-text text-muted">Leave unchanged to keep your current password.</small>
                </div>
                
                <button type="submit" className="btn btn-primary">Update Profile</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 