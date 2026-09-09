import React from "react";
import { GeoJSON } from "react-leaflet";

const RISK_COLORS = {
  MINIMAL: "#2ecc71",
  LOW: "#a9d651",
  MEDIUM: "#f1c40f",
  HIGH: "#e67e22",
  CRITICAL: "#e74c3c",
};

function style(feature) {
  const level = feature.properties.risk_level || "MINIMAL";
  return {
    fillColor: RISK_COLORS[level] || "#999",
    weight: 0.5,
    color: "#444",
    fillOpacity: 0.55,
  };
}

function onEachFeature(feature, layer) {
  const p = feature.properties;
  layer.bindPopup(
    `<b>Risk:</b> ${p.risk_level} (${(p.risk_score * 100).toFixed(0)}%)<br/>` +
      `<b>Distance to river:</b> ${p.dist_to_river_m ? p.dist_to_river_m.toFixed(0) + " m" : "n/a"}<br/>` +
      `<b>Buildings:</b> ${p.building_density ?? "n/a"}`
  );
}

export default function RiskHeatmap({ data }) {
  if (!data) return null;
  // key forces re-render when a fresh risk map arrives
  return <GeoJSON data={data} style={style} onEachFeature={onEachFeature} key={JSON.stringify(data).slice(0, 100)} />;
}
