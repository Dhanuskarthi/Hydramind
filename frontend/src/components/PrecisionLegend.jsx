import React, { useState } from "react";

const RISK_LEVELS = [
  {
    level: "CRITICAL",
    range: "≥ 85%",
    color: "#ef4444",
    glow: "#ff0033",
    blinking: true,
    impact: "Severe flash flood & landslide hazard. Immediate evacuation.",
    icon: "🚨",
  },
  {
    level: "HIGH",
    range: "65% – 84%",
    color: "#f97316",
    glow: "#ea580c",
    blinking: true,
    impact: "Deep water inundation & slope instability. Rescue standby.",
    icon: "⚠️",
  },
  {
    level: "MEDIUM",
    range: "45% – 64%",
    color: "#eab308",
    glow: "#ca8a04",
    blinking: false,
    impact: "Drainage overflow & saturated soil. Precautionary watch.",
    icon: "⚡",
  },
  {
    level: "LOW",
    range: "25% – 44%",
    color: "#84cc16",
    glow: "#65a30d",
    blinking: false,
    impact: "Minor runoff accumulation. Normal monitoring.",
    icon: "🌱",
  },
  {
    level: "MINIMAL",
    range: "< 25%",
    color: "#10b981",
    glow: "#059669",
    blinking: false,
    impact: "Safe elevated terrain. No active hazard.",
    icon: "🛡️",
  },
];

const LAYER_UNITS = {
  wind: {
    title: "Wind Velocity",
    unit: "km/h",
    stops: [
      { val: "0", col: "#3b82f6" },
      { val: "15", col: "#06b6d4" },
      { val: "35", col: "#10b981" },
      { val: "55", col: "#facc15" },
      { val: "85+", col: "#ef4444" },
    ],
  },
  rain: {
    title: "Precipitation Rate",
    unit: "mm/h",
    stops: [
      { val: "0", col: "#bae6fd" },
      { val: "2.5", col: "#38bdf8" },
      { val: "10", col: "#0284c7" },
      { val: "25", col: "#7c3aed" },
      { val: "50+", col: "#dc2626" },
    ],
  },
  soil: {
    title: "Soil Moisture Saturation",
    unit: "%",
    stops: [
      { val: "0%", col: "#92400e" },
      { val: "25%", col: "#ca8a04" },
      { val: "50%", col: "#4ade80" },
      { val: "75%", col: "#0ea5e9" },
      { val: "95%+", col: "#1d4ed8" },
    ],
  },
};

export default function PrecisionLegend({ activeFilter = "rain", blinkingActive = true }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`precision-legend-box ${collapsed ? "collapsed" : ""}`}>
      <div className="legend-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="legend-title-group">
          <span className="legend-icon">📊</span>
          <span className="legend-title">Precision Map Keys & Legend</span>
          {blinkingActive && (
            <span className="live-danger-indicator" title="Critical hazard zones are pulsing red on map">
              <span className="pulse-dot"></span> Danger Blinking Active
            </span>
          )}
        </div>
        <button className="legend-toggle-btn" aria-label="Toggle Legend">
          {collapsed ? "▲ Expand" : "▼ Collapse"}
        </button>
      </div>

      {!collapsed && (
        <div className="legend-content">
          {/* ── 1. Flood Risk Scale ── */}
          <div className="legend-section">
            <div className="section-label">AI Flood & Landslide Probability (150m Grid)</div>
            <div className="risk-scale-list">
              {RISK_LEVELS.map((item) => (
                <div key={item.level} className={`risk-row ${item.blinking && blinkingActive ? "row-blinking" : ""}`}>
                  <div className="risk-color-pill" style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.glow}` }}>
                    {item.range}
                  </div>
                  <div className="risk-details">
                    <div className="risk-name">
                      <span className="risk-icon">{item.icon}</span>
                      <strong>{item.level}</strong>
                      {item.blinking && <span className="danger-chip">Active Danger Zone</span>}
                    </div>
                    <div className="risk-desc">{item.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. Active Meteorological Layer Scale ── */}
          {LAYER_UNITS[activeFilter] && (
            <div className="legend-section">
              <div className="section-label">
                {LAYER_UNITS[activeFilter].title} ({LAYER_UNITS[activeFilter].unit})
              </div>
              <div className="gradient-bar-container">
                <div className="gradient-stops">
                  {LAYER_UNITS[activeFilter].stops.map((st, i) => (
                    <div key={i} className="stop-item">
                      <span className="stop-color" style={{ backgroundColor: st.col }}></span>
                      <span className="stop-val">{st.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Critical Infrastructure Symbols ── */}
          <div className="legend-section infra-key-section">
            <div className="section-label">Critical Infrastructure & Lifelines</div>
            <div className="infra-grid">
              <span className="infra-item">🏥 <strong>Hospitals</strong> (Capacity & Status)</span>
              <span className="infra-item">🏕️ <strong>Designated Safe Shelters</strong></span>
              <span className="infra-item">🚒 <strong>Fire & Rescue Stations</strong></span>
              <span className="infra-item">👮 <strong>Police Headquarters</strong></span>
              <span className="infra-item">🌊 <strong>River Network & Drainage</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
