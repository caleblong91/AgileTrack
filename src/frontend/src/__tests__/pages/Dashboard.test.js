import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import Dashboard from '../../pages/Dashboard';

// Mock axios
jest.mock('axios');

// Wrap component with BrowserRouter for Link components
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Reset axios mocks before each test
    jest.clearAllMocks();
  });

  test('renders loading spinner initially', () => {
    // Mock axios.get to return a Promise that never resolves
    axios.get.mockImplementation(() => new Promise(() => {}));
    
    renderWithRouter(<Dashboard />);
    const loadingSpinner = screen.getByRole('status');
    expect(loadingSpinner).toBeInTheDocument();
  });

  test('renders dashboard content after loading', async () => {
    // Mock axios.get to return sample project data
    axios.get.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Test Project 1', description: 'Test Description 1', active: true },
        { id: 2, name: 'Test Project 2', description: 'Test Description 2', active: false }
      ]
    });
    
    renderWithRouter(<Dashboard />);
    
    // Wait for loading to complete
    await waitFor(() => {
      const dashboardHeading = screen.getByText('Dashboard');
      expect(dashboardHeading).toBeInTheDocument();
    });
    
    // Check that summary cards are rendered
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Agile Maturity')).toBeInTheDocument();
    expect(screen.getByText('Team Velocity')).toBeInTheDocument();
    
    // Check that metrics and suggestions are rendered
    expect(screen.getByText('Top Metrics to Improve')).toBeInTheDocument();
    expect(screen.getByText('Improvement Suggestions')).toBeInTheDocument();
  });

  test('renders correct project count from API data', async () => {
    // Mock axios.get to return sample project data
    axios.get.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Test Project 1', description: 'Test Description 1', active: true },
        { id: 2, name: 'Test Project 2', description: 'Test Description 2', active: false }
      ]
    });
    
    renderWithRouter(<Dashboard />);
    
    // Wait for loading to complete and check project count
    await waitFor(() => {
      // Total projects should be 2
      const totalProjects = screen.getByText('2');
      expect(totalProjects).toBeInTheDocument();
      
      // Active projects should be 1
      const activeProjects = screen.getByText('1 active');
      expect(activeProjects).toBeInTheDocument();
    });
  });

  test('handles API error', async () => {
    // Mock axios.get to throw an error
    axios.get.mockRejectedValueOnce(new Error('API Error'));
    
    // Spy on console.error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderWithRouter(<Dashboard />);
    
    // Wait for loading to complete
    await waitFor(() => {
      // Dashboard title should still be rendered
      const dashboardHeading = screen.getByText('Dashboard');
      expect(dashboardHeading).toBeInTheDocument();
      
      // Console error should be called
      expect(console.error).toHaveBeenCalled();
    });
    
    // Restore console.error
    console.error.mockRestore();
  });
}); 