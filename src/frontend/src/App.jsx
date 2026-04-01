import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = "/v1/management";

function App() {
  const [workflows, setWorkflows] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const wfRes = await fetch(`${API_BASE}/workflows`);
      const schRes = await fetch(`${API_BASE}/schedules`);
      setWorkflows(await wfRes.json());
      setSchedules(await schRes.json());
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  const runWorkflow = async (name) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/workflows/${name}/run`, { method: 'POST' });
      alert(`Workflow ${name} iniciado`);
    } catch (err) {
      alert("Error al iniciar workflow");
    }
    setLoading(false);
  };

  const deleteSchedule = async (id) => {
    try {
      await fetch(`${API_BASE}/schedules/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert("Error al eliminar agendamiento");
    }
  };

  return (
    <div className="dashboard-container">
      <header>
        <div className="logo">
          <h1>TAG AUTOMATION DASHBOARD</h1>
        </div>
        <div className="status-badge">
          System Online
        </div>
      </header>

      <section className="workflows-section">
        <h2>Available Workflows</h2>
        <div className="workflow-grid">
          {workflows.map(wf => (
            <div key={wf.name} className="workflow-card">
              <h3>{wf.label}</h3>
              <p>Execute business logic manually.</p>
              <button
                className="btn-primary"
                onClick={() => runWorkflow(wf.name)}
                disabled={loading}
              >
                {loading ? "Running..." : "Run Now"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="schedules-section">
        <h2>Active Schedules</h2>
        <div className="schedule-list">
          {schedules.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>No active schedules found.</p>
          ) : (
            schedules.map(sch => (
              <div key={sch.id} className="schedule-item">
                <div>
                  <strong>{sch.workflow_name}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {sch.cron_expression ? `Cron: ${sch.cron_expression}` : `Every ${sch.interval_minutes} minutes`}
                  </div>
                </div>
                <button
                  className="btn-danger"
                  style={{ background: 'var(--danger)', color: 'white' }}
                  onClick={() => deleteSchedule(sch.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
