import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const NewTeam = () => {
  const navigate = useNavigate();
  const [teamData, setTeamData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // API instance with auth token
  const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTeamData({
      ...teamData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Log the request payload for debugging
      console.log('Sending team data:', teamData);
      
      // Ensure the team name is not empty
      if (!teamData.name || teamData.name.trim() === '') {
        setError('Team name cannot be empty');
        setLoading(false);
        return;
      }
      
      // Send as a plain object, not a FormData
      const response = await api.post('/teams', {
        name: teamData.name,
        description: teamData.description || ''
      });
      
      console.log('Team created successfully:', response.data);
      
      // Redirect to the new team's detail page
      navigate(`/teams/${response.data.id}`);
    } catch (error) {
      console.error('Error creating team:', error);
      
      // More detailed error handling
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        
        // Extract validation errors if available
        const errorDetail = error.response.data.detail;
        if (Array.isArray(errorDetail)) {
          // Handle Pydantic validation errors which come as an array
          const errorMessages = errorDetail.map(err => {
            return `Field: ${err.loc.join('.')} - ${err.msg}`;
          }).join('; ');
          setError(`Validation errors: ${errorMessages}`);
        } else {
          setError(
            error.response.data.detail || 
            `Server error: ${error.response.status} ${error.response.statusText}`
          );
        }
      } else if (error.request) {
        // The request was made but no response was received
        setError('No response received from server. Please check your network connection.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError(`Error: ${error.message}`);
      }
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
        <h1 className="h2">Create New Team</h1>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">Team Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    name="name"
                    value={teamData.name}
                    onChange={handleChange}
                    required
                    placeholder="Enter team name"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    value={teamData.description}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Enter team description"
                    disabled={loading}
                  ></textarea>
                </div>
                <div className="d-flex justify-content-between">
                  <Link to="/teams" className="btn btn-outline-secondary">
                    Cancel
                  </Link>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Team'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">About Teams</h5>
              <p className="card-text">
                Teams are the core organizational unit in AgileTrack. Each team can:
              </p>
              <ul>
                <li>Track their agile maturity</li>
                <li>Connect to various integrations</li>
                <li>Monitor velocity and other metrics</li>
                <li>View reports and track improvements</li>
              </ul>
              <p className="card-text">
                After creating a team, you'll be able to add integrations to start tracking metrics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTeam; 