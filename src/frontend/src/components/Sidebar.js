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
              <i className="fe fe-home me-2"></i>
              Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/teams" className={`nav-link ${isActive('/teams')}`}>
              <i className="fe fe-users me-2"></i>
              Teams
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/integrations" className={`nav-link ${isActive('/integrations')}`}>
              <i className="fe fe-link me-2"></i>
              Integrations
            </Link>
          </li>
        </ul>
        
        <h6 className="sidebar-heading mt-3">
          <span>Reports</span>
        </h6>
        <ul className="nav flex-column">
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-bar-chart-2 me-2"></i>
              Velocity
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-calendar me-2"></i>
              Sprint Burndown
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-award me-2"></i>
              Team Performance
            </a>
          </li>
          <li className="nav-item">
            <a className="nav-link" href="#">
              <i className="fe fe-trending-up me-2"></i>
              Agile Maturity
            </a>
          </li>
        </ul>
        
        <h6 className="sidebar-heading mt-3">
          <span>Administration</span>
        </h6>
        <ul className="nav flex-column">
          <li className="nav-item">
            <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
              <i className="fe fe-settings me-2"></i>
              Settings
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Sidebar; 