import React from "react";

const LAYERS = [
  { id: "wind", label: "Wind", icon: "💨", color: "#a78bfa" },
  { id: "rain", label: "Rain, thunder", icon: "🌧️", color: "#38bdf8" },
  { id: "temp", label: "Temperature", icon: "🌡️", color: "#f97316" },
  { id: "soil", label: "Soil moisture", icon: "💧", color: "#4ade80" },
];

export default function WindyRightSidebar({ activeFilter, onFilterChange, onMoreLayers }) {
  return (
    <div className="w-right-sidebar">
      {LAYERS.map((l, i) => (
        <button
          key={l.id}
          className={`w-layer-btn ${activeFilter === l.id ? "active" : ""}`}
          style={{ "--lyr-color": l.color }}
          onClick={() => onFilterChange(l.id)}
        >
          <span className="w-layer-icon">{l.icon}</span>
          <span className="w-layer-label">{l.label}</span>
        </button>
      ))}
      <button className="w-more-layers-btn" onClick={onMoreLayers}>
        More layers...
      </button>
    </div>
  );
}
