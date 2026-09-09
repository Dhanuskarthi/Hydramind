import React from "react";

const LEGENDS = {
  wind: {
    unit: "m/s",
    stops: [
      { color: "#3b82f6", label: "0" },
      { color: "#22d3ee", label: "5" },
      { color: "#4ade80", label: "10" },
      { color: "#facc15", label: "15" },
      { color: "#f97316", label: "30" },
      { color: "#ef4444", label: "40" },
      { color: "#991b1b", label: "60" },
    ],
  },
  rain: {
    unit: "mm/h",
    stops: [
      { color: "#e0f2fe", label: "0" },
      { color: "#7dd3fc", label: "1" },
      { color: "#38bdf8", label: "5" },
      { color: "#0284c7", label: "10" },
      { color: "#6366f1", label: "20" },
      { color: "#7c3aed", label: "30" },
      { color: "#dc2626", label: "40" },
    ],
  },
  temp: {
    unit: "°C",
    stops: [
      { color: "#1e3a5f", label: "-40" },
      { color: "#3b82f6", label: "-20" },
      { color: "#22d3ee", label: "0" },
      { color: "#4ade80", label: "10" },
      { color: "#facc15", label: "20" },
      { color: "#f97316", label: "30" },
      { color: "#dc2626", label: "40" },
      { color: "#7f1d1d", label: "50" },
    ],
  },
  soil: {
    unit: "%",
    stops: [
      { color: "#92400e", label: "0" },
      { color: "#ca8a04", label: "25" },
      { color: "#4ade80", label: "50" },
      { color: "#0ea5e9", label: "75" },
      { color: "#1d4ed8", label: "100" },
    ],
  },
};

export default function WindyLegend({ activeFilter }) {
  const legend = LEGENDS[activeFilter];
  if (!legend) return null;

  return (
    <div className="w-legend">
      <span className="w-legend-unit">{legend.unit}</span>
      <div className="w-legend-bar">
        {legend.stops.map((s, i) => (
          <div key={i} className="w-legend-stop" style={{ background: s.color }}>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
