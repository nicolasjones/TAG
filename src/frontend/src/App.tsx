import React, { useState, useEffect } from 'react';
import { Workflow, Schedule } from './types';
import './App.css';

const API_BASE = "/api"; // Rewritten via firebase.json to the 'api' function

const App: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const wfRes = await fetch(`${API_BASE}/workflows`);
      const schRes = await fetch(`${API_BASE}/schedules`);
      
      const wfData = await wfRes.json();
      const schData = await schRes.json();
      
      setWorkflows(wfData || []);
      setSchedules(schData || []);
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  const runWorkflow = async (name: string) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/run/${name}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      alert(`Workflow ${name} iniciado`);
    } catch (err) {
      alert("Error al iniciar workflow");
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este agendamiento?")) return;
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
          System Online (TS)
        </div>
      </header>

      <section className="workflows-section">
        <h2>Available Workflows (TypeScript)</h2>
        <div className="workflow-grid">
          {workflows.map(wf => (
            <div key={wf.name} className="workflow-card">
              <h3>{wf.label || wf.name}</h3>
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
        <h2>Active Schedules (Firestore)</h2>
        <div className="schedule-list">
          {schedules.length === 0 ? (
            <p style={{ padding: '1rem', color: 'gray' }}>No active schedules found.</p>
          ) : (
            schedules.map(sch => (
              <div key={sch.id} className="schedule-item">
                <div>
                  <strong>{sch.workflow_name}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'gray' }}>
                    {sch.cron_expression ? `Cron: ${sch.cron_expression}` : `Every ${sch.interval_minutes} minutes`}
                  </div>
                </div>
                <button
                  className="btn-danger"
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
