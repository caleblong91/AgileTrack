import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  
  // Check if the current path matches the link
  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };
  
  return (
    <nav id="sidebar" className="col-md-3 col-lg-2 d-md-block sidebar collapse">
      <div className="position-sticky">
        <ul className="nav flex-column mt-3">
          <li className="nav-item">
            <Link to="/" className={`nav-link ${isActive('/')}`}>
              <i className="fe fe-home"></i>
              Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/projects" className={`nav-link ${isActive('/projects')}`}>
              <i className="fe fe-folder"></i>
              Projects
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/integrations" className={`nav-link ${isActive('/integrations')}`}>
              <i className="fe fe-link"></i>
              Integrations
            </Link>
          </li>
        </ul>
        
        <h6 className="sidebar-heading">
          <span>Reports</span>
        </h6>
        <ul className="nav flex-column">
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-bar-chart-2"></i>
              Velocity
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-calendar"></i>
              Sprint Burndown
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-award"></i>
              Team Performance
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-trending-up"></i>
              Agile Maturity
            </a>
          </li>
        </ul>
        
        <h6 className="sidebar-heading">
          <span>Administration</span>
        </h6>
        <ul className="nav flex-column">
          <li className="nav-item">
            <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
              <i className="fe fe-settings"></i>
              Settings
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Sidebar; 