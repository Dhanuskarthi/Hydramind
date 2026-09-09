import React from "react";

const SEVERITY_CLASS = {
  LOW: "alert-low",
  MEDIUM: "alert-medium",
  HIGH: "alert-high",
  CRITICAL: "alert-critical",
};

export default function AlertPanel({ alerts }) {
  return (
    <div className="panel">
      <h3>Live Alerts</h3>
      {alerts.length === 0 && <p className="muted">No active alerts.</p>}
      {alerts.map((a) => (
        <div key={a.id} className={`alert ${SEVERITY_CLASS[a.severity] || ""}`}>
          <strong>{a.village}</strong> — {a.severity}
          <p>{a.message}</p>
        </div>
      ))}
    </div>
  );
}
