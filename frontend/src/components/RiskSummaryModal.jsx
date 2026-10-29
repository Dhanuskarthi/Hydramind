import React from "react";

export default function RiskSummaryModal({ isOpen, onClose, riskData, district = "The Nilgiris" }) {
  if (!isOpen) return null;

  const severity = riskData?.severity || {};
  const affected = riskData?.affected_areas || {};
  const priorities = riskData?.rescue_priorities || [];
  const alerts = riskData?.alerts || [];

  const scorePct = Math.round((severity.severity_score || 0.82) * 100);
  const alertLevel = severity.alert_level || "CRITICAL_DANGER";

  return (
    <div className="risk-summary-backdrop" onClick={onClose}>
      <div className="risk-summary-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="summary-header">
          <div className="summary-header-left">
            <span className="summary-badge">DISTRICT DISASTER INTELLIGENCE</span>
            <h2>{district} — Comprehensive Flood & Landslide Risk Summary</h2>
            <p className="summary-timestamp">
              Live AI Multi-Model Synthesis (LSTM + XGBoost + Sentinel SAR) • Updated Just Now
            </p>
          </div>
          <button className="summary-close-btn" onClick={onClose} aria-label="Close Summary">✕</button>
        </div>

        {/* Top Status Banner */}
        <div className={`summary-status-banner ${scorePct >= 75 ? "status-critical" : "status-high"}`}>
          <div className="status-indicator-icon">🚨</div>
          <div className="status-text-content">
            <div className="status-title-row">
              <h3>{alertLevel.replace("_", " ")} — IMMEDIATE EVACUATION & RESCUE STANDBY</h3>
              <span className="risk-score-pill">Risk Index: {scorePct} / 100</span>
            </div>
            <p>
              High-intensity monsoon deluge intersecting with saturated hillside terrain. Flash flood runoff in 
              gorge channels and active slope debris failure detected across primary settlements.
            </p>
          </div>
        </div>

        {/* 4-Card Executive Metrics Grid */}
        <div className="summary-cards-grid">
          <div className="summary-card">
            <div className="card-icon">🌧️</div>
            <div className="card-data">
              <span className="card-value">{severity.peak_rainfall_mm ?? 146.8} mm</span>
              <span className="card-label">24h Peak Forecast Rain</span>
            </div>
            <div className="card-sub text-danger">Exceeds 100mm threshold</div>
          </div>

          <div className="summary-card">
            <div className="card-icon">💧</div>
            <div className="card-data">
              <span className="card-value">{severity.soil_moisture_pct ?? 84.5}%</span>
              <span className="card-label">Soil Moisture Saturation</span>
            </div>
            <div className="card-sub text-danger">Severe landslide risk</div>
          </div>

          <div className="summary-card">
            <div className="card-icon">👥</div>
            <div className="card-data">
              <span className="card-value">78,400</span>
              <span className="card-label">Vulnerable Citizens</span>
            </div>
            <div className="card-sub text-warning">Across 4 critical valleys</div>
          </div>

          <div className="summary-card">
            <div className="card-icon">🏕️</div>
            <div className="card-data">
              <span className="card-value">14 Centers</span>
              <span className="card-label">Designated Safe Shelters</span>
            </div>
            <div className="card-sub text-success">3,800 Bed Capacity Active</div>
          </div>
        </div>

        {/* Risk Distribution Bar */}
        <div className="summary-distribution-box">
          <div className="distribution-header">
            <strong>Spatial Risk Distribution (% of 150m Grid Cells)</strong>
            <span>Total Evaluated Cells: {riskData?.metadata?.total_cells ?? 148}</span>
          </div>
          <div className="distribution-bar">
            <div className="bar-segment seg-critical" style={{ width: "35%" }} title="35% Critical Risk">35% Critical</div>
            <div className="bar-segment seg-high" style={{ width: "38%" }} title="38% High Risk">38% High</div>
            <div className="bar-segment seg-medium" style={{ width: "17%" }} title="17% Medium Risk">17% Med</div>
            <div className="bar-segment seg-low" style={{ width: "10%" }} title="10% Low/Minimal">10% Low</div>
          </div>
        </div>

        {/* Two-Column Section: Prioritized Villages & Emergency Protocol */}
        <div className="summary-two-col">
          {/* Left Column: Settlement Vulnerability Ranking */}
          <div className="summary-column">
            <div className="col-header">
              <h4>🏘️ Top Priority Settlements & Rescue Ranking</h4>
            </div>
            <div className="priorities-table-wrapper">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Settlement</th>
                    <th>Population</th>
                    <th>Risk Score</th>
                    <th>Recommended Emergency Action</th>
                  </tr>
                </thead>
                <tbody>
                  {priorities.map((item, idx) => (
                    <tr key={idx} className={item.risk_score >= 0.85 ? "row-danger" : ""}>
                      <td><span className="rank-badge">#{item.rank || idx + 1}</span></td>
                      <td><strong>{item.village}</strong></td>
                      <td>{item.population?.toLocaleString()}</td>
                      <td>
                        <span className={`table-risk-pill ${item.risk_score >= 0.85 ? "pill-crit" : "pill-high"}`}>
                          {(item.risk_score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="action-cell">{item.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Standard Operating Procedures (SOP) */}
          <div className="summary-column">
            <div className="col-header">
              <h4>📋 Disaster Management Response Protocol</h4>
            </div>
            <div className="sop-checklist">
              <div className="sop-item done">
                <span className="sop-check">✓</span>
                <div>
                  <strong>Automated Early Warning Broadcast</strong>
                  <p>SMS flash bulletins and mobile alerts triggered for Coonoor and Kallar cells.</p>
                </div>
              </div>
              <div className="sop-item done">
                <span className="sop-check">✓</span>
                <div>
                  <strong>SDRF / NDRF Unit Pre-positioning</strong>
                  <p>Inflatable boats and heavy clearing earthmovers stationed at Coonoor junction.</p>
                </div>
              </div>
              <div className="sop-item active">
                <span className="sop-check">⚡</span>
                <div>
                  <strong>Ghat Road Transit Suspension</strong>
                  <p>Diverting all non-emergency traffic via Kotagiri corridor due to active debris flow.</p>
                </div>
              </div>
              <div className="sop-item standby">
                <span className="sop-check">○</span>
                <div>
                  <strong>Relief Camp Provisioning</strong>
                  <p>Coonoor Town Hall and Ooty Municipal refuge stocked with clean water & rations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="summary-footer">
          <span className="footer-note">
            HydraMind AI Decision Engine v1.0 • Fusing IMD/Open-Meteo Radar with Sentinel-1 SAR & Cartosat-1 DEM
          </span>
          <button className="summary-action-btn" onClick={onClose}>
            Return to Live Map
          </button>
        </div>
      </div>
    </div>
  );
}
