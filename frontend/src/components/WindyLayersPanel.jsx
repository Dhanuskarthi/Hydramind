import React from "react";

const SECTIONS = [
  {
    key: "animated", label: "ANIMATED OVERLAYS",
    items: [
      { key: "wind", label: "Wind Particles", dot: "#a78bfa", badge: "CANVAS", badgeBg: "rgba(167,139,250,0.15)", badgeColor: "#a78bfa" },
      { key: "radar", label: "Radar Loop", dot: "#38bdf8", badge: "LIVE", badgeBg: "rgba(56,189,248,0.15)", badgeColor: "#38bdf8" },
    ],
  },
  {
    key: "osm", label: "INFRASTRUCTURE",
    items: [
      { key: "hospitals", label: "Hospitals", dot: "#ef4444", badge: "OSM", badgeBg: "rgba(239,68,68,0.12)", badgeColor: "#ef4444" },
      { key: "shelters", label: "Shelters", dot: "#3b82f6", badge: "OSM", badgeBg: "rgba(59,130,246,0.12)", badgeColor: "#3b82f6" },
      { key: "fire", label: "Fire Stations", dot: "#f97316", badge: "OSM", badgeBg: "rgba(249,115,22,0.12)", badgeColor: "#f97316" },
      { key: "rivers", label: "Rivers & Canals", dot: "#00b4d8", badge: "OSM", badgeBg: "rgba(0,180,216,0.12)", badgeColor: "#00b4d8" },
    ],
  },
  {
    key: "risk", label: "AI RISK",
    items: [
      { key: "risk", label: "Flood Risk Grid", dot: "#f87171", badge: "150M", badgeBg: "rgba(248,113,113,0.12)", badgeColor: "#f87171" },
    ],
  },
  {
    key: "basemap", label: "BASEMAP",
    items: [
      { key: "osm", label: "OpenStreetMap", dot: "#4ade80" },
      { key: "dark", label: "Dark Mode", dot: "#7c3aed" },
      { key: "hydro", label: "Humanitarian", dot: "#38bdf8" },
      { key: "satellite", label: "Satellite", dot: "#fbbf24" },
    ],
  },
];

export default function WindyLayersPanel({
  onClose, riskVisible, onRiskToggle, windParticlesVisible, onWindParticlesToggle,
  radarLoopVisible, onRadarLoopToggle, mapStyle, onMapStyleChange,
  osmInfra, onOsmInfraToggle,
}) {
  function isChecked(key) {
    if (key === "wind") return windParticlesVisible;
    if (key === "radar") return radarLoopVisible;
    if (key === "risk") return riskVisible;
    return osmInfra[key] ?? false;
  }

  function handleToggle(sectionKey, itemKey, checked) {
    if (sectionKey === "animated") {
      if (itemKey === "wind") onWindParticlesToggle(checked);
      if (itemKey === "radar") onRadarLoopToggle(checked);
    } else if (sectionKey === "osm") onOsmInfraToggle(itemKey, checked);
    else if (sectionKey === "risk") onRiskToggle(checked);
    else if (sectionKey === "basemap") onMapStyleChange(itemKey);
  }

  return (
    <div className="w-layers-panel">
      <div className="w-layers-header">
        <span>Map Layers</span>
        <button className="w-layers-close" onClick={onClose}>✕</button>
      </div>
      <div className="w-layers-body">
        {SECTIONS.map((section) => (
          <div key={section.key} className="w-layers-section">
            <div className="w-layers-section-label">{section.label}</div>
            {section.items.map((item) => {
              const isBasemap = section.key === "basemap";
              const checked = isBasemap ? mapStyle === item.key : isChecked(item.key);
              return (
                <label key={item.key} className={`w-layers-row ${checked ? "active" : ""}`}>
                  {isBasemap ? (
                    <input type="radio" name="basemap" checked={checked} onChange={() => handleToggle(section.key, item.key, true)} />
                  ) : (
                    <input type="checkbox" checked={checked} onChange={(e) => handleToggle(section.key, item.key, e.target.checked)} />
                  )}
                  <span className="w-layers-dot" style={{ background: item.dot, boxShadow: `0 0 6px ${item.dot}66` }} />
                  <span className="w-layers-name">{item.label}</span>
                  {item.badge && (
                    <span className="w-layers-badge" style={{ background: item.badgeBg, color: item.badgeColor }}>{item.badge}</span>
                  )}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
