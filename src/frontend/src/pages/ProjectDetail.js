import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// Placeholder charts
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate API fetch
    setLoading(true);
    setTimeout(() => {
      // Placeholder data
      setProject({
        id: id,
        name: `Project ${id}`,
        description: 'A project to track agile metrics',
        startDate: '2023-01-01',
        metrics: {
          velocity: [10, 12, 14, 13, 16, 18, 17],
          burndown: [100, 85, 70, 60, 45, 30, 10],
          cycletime: [3.2, 2.8, 2.5, 2.7, 2.2, 2.0, 1.8]
        }
      });
      setLoading(false);
    }, 500);
  }, [id]);

  if (loading) return <div className="text-center mt-5"><h3>Loading project details...</h3></div>;
  if (error) return <div className="alert alert-danger mt-3">{error}</div>;
  if (!project) return <div className="alert alert-warning mt-3">Project not found</div>;

  // Chart data
  const velocityData = {
    labels: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7'],
    datasets: [
      {
        label: 'Velocity (Story Points)',
        data: project.metrics.velocity,
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.4)',
        borderColor: 'rgba(75,192,192,1)',
      },
    ],
  };

  const burndownData = {
    labels: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7'],
    datasets: [
      {
        label: 'Remaining Work',
        data: project.metrics.burndown,
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };

  return (
    <div className="project-detail">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{project.name}</h1>
        <div>
          <button className="btn btn-outline-primary me-2">Edit</button>
          <button className="btn btn-primary">Refresh Metrics</button>
        </div>
      </div>
      
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Project Information</h5>
              <p className="card-text">{project.description}</p>
              <p><strong>Start Date:</strong> {project.startDate}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Quick Stats</h5>
              <p><strong>Average Velocity:</strong> {Math.round(project.metrics.velocity.reduce((a, b) => a + b, 0) / project.metrics.velocity.length)} points</p>
              <p><strong>Latest Cycle Time:</strong> {project.metrics.cycletime[project.metrics.cycletime.length - 1]} days</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="row">
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Velocity Trend</h5>
              <Line data={velocityData} />
            </div>
          </div>
        </div>
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Burndown Chart</h5>
              <Bar data={burndownData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail; 