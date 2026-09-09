import React from "react";

export default function SatelliteMetadataCard({ event, onClose }) {
  if (!event) return null;

  const { title, date, satellite, rainfall_max_mm, soil_moisture_pct, description } = event;

  return (
    <div className="sat-info-card">
      <div className="sat-info-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>🛰️</span>
          <div>
            <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.5px" }}>ACTIVE HISTORICAL SATELLITE DATASET</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>{title}</div>
          </div>
        </div>
        <button className="w-layers-close" onClick={onClose} title="Clear satellite overlay">✕</button>
      </div>

      <div className="sat-info-body">
        <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4 }}>{description}</p>
        
        <div className="sat-info-grid">
          <div className="sat-info-item">
            <span className="label">Sensor / Radar</span>
            <span className="val">{satellite?.sensor}</span>
          </div>
          <div className="sat-info-item">
            <span className="label">Pass Timestamp</span>
            <span className="val">{satellite?.pass_date}</span>
          </div>
          <div className="sat-info-item">
            <span className="label">Spatial Resolution</span>
            <span className="val">{satellite?.resolution}</span>
          </div>
          <div className="sat-info-item">
            <span className="label">Flood Extent</span>
            <span className="val" style={{ color: "#00f0ff", fontWeight: 700 }}>{satellite?.flood_extent_sqkm} km²</span>
          </div>
          <div className="sat-info-item">
            <span className="label">24h Peak Rain</span>
            <span className="val">{rainfall_max_mm} mm</span>
          </div>
          <div className="sat-info-item">
            <span className="label">Soil Saturation</span>
            <span className="val">{soil_moisture_pct}%</span>
          </div>
        </div>

        <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
          <span style={{ color: "#94a3b8" }}>Source: {satellite?.provider}</span>
          <a href={satellite?.download_url} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
            🔗 Open Earthdata Portal ↗
          </a>
        </div>
      </div>
    </div>
  );
}
