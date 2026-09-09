import React from "react";

export default function VillagePanel({ villages }) {
  return (
    <div className="panel">
      <h3>Villages</h3>
      {villages.length === 0 && <p className="muted">No village data loaded yet.</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Risk</th>
            <th>Population</th>
          </tr>
        </thead>
        <tbody>
          {villages.map((v) => (
            <tr key={v.name}>
              <td>{v.name}</td>
              <td className={`risk-${v.risk_level?.toLowerCase()}`}>{v.risk_level}</td>
              <td>{v.population}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
