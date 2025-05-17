import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar from '../../components/Navbar';

// Wrap component with BrowserRouter for Link components
const renderWithRouter = (ui) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Navbar Component', () => {
  test('renders the application name', () => {
    renderWithRouter(<Navbar />);
    const appName = screen.getByText('AgileTrack');
    expect(appName).toBeInTheDocument();
  });

  test('renders navigation links', () => {
    renderWithRouter(<Navbar />);
    const dashboardLink = screen.getByText('Dashboard');
    const projectsLink = screen.getByText('Projects');
    const integrationsLink = screen.getByText('Integrations');
    
    expect(dashboardLink).toBeInTheDocument();
    expect(projectsLink).toBeInTheDocument();
    expect(integrationsLink).toBeInTheDocument();
  });

  test('renders user dropdown', () => {
    renderWithRouter(<Navbar />);
    const userDropdown = screen.getByText('Admin');
    expect(userDropdown).toBeInTheDocument();
  });
}); 