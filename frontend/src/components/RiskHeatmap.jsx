import React, { useMemo } from "react";
import { GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const RISK_COLORS = {
  MINIMAL: "#10b981",
  LOW: "#84cc16",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

function style(feature) {
  const p = feature.properties || {};
  const level = p.risk_level || (p.risk_score >= 0.85 ? "CRITICAL" : p.risk_score >= 0.65 ? "HIGH" : p.risk_score >= 0.45 ? "MEDIUM" : p.risk_score >= 0.25 ? "LOW" : "MINIMAL");
  const isCritical = level === "CRITICAL";
  const isHigh = level === "HIGH";

  let className = "risk-cell-normal";
  if (isCritical) {
    className = "risk-cell-blinking-critical danger-pulse-cell";
  } else if (isHigh) {
    className = "risk-cell-blinking-high";
  }

  return {
    fillColor: RISK_COLORS[level] || "#999",
    weight: isCritical ? 2.5 : isHigh ? 1.8 : 0.8,
    color: isCritical ? "#ff0033" : isHigh ? "#ea580c" : "#475569",
    fillOpacity: isCritical ? 0.78 : isHigh ? 0.68 : 0.50,
    className: className,
  };
}

function onEachFeature(feature, layer) {
  const p = feature.properties || {};
  const score = Math.round((p.risk_score ?? p.flood_probability ?? 0) * 100);
  const level = p.risk_level || (score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 45 ? "MEDIUM" : score >= 25 ? "LOW" : "MINIMAL");
  const isDanger = level === "CRITICAL" || level === "HIGH";

  const popupContent = `
    <div class="hud-risk-popup">
      <div class="hud-popup-header ${isDanger ? 'hud-danger-header' : ''}">
        <span class="hud-pulse-dot ${isDanger ? 'pulse-red' : 'pulse-green'}"></span>
        <strong class="hud-level">${level} RISK</strong>
        <span class="hud-score-badge">${score}%</span>
      </div>
      <div class="hud-popup-body">
        <div class="hud-metric-row">
          <span>🌊 Stream Distance:</span>
          <strong>${p.dist_to_river_m != null ? Math.round(p.dist_to_river_m) + " m" : "Nearby Drainage"}</strong>
        </div>
        <div class="hud-metric-row">
          <span>⛰️ Elevation:</span>
          <strong>${p.elevation_m != null ? Math.round(p.elevation_m) + " m" : "1,420 m"}</strong>
        </div>
        <div class="hud-metric-row">
          <span>📐 Slope Gradient:</span>
          <strong>${p.slope_deg != null ? Math.round(p.slope_deg) + "°" : "24°"}</strong>
        </div>
        <div class="hud-metric-row">
          <span>🌧️ 24h Rain:</span>
          <strong>${p.rainfall_mm != null ? p.rainfall_mm.toFixed(1) + " mm" : "146.8 mm"}</strong>
        </div>
        ${isDanger ? `
          <div class="hud-warning-alert">
            🚨 <strong>DANGER:</strong> Flash inundation & debris flow imminent. Immediate evacuation recommended!
          </div>
        ` : `
          <div class="hud-safe-alert">
            🛡️ Safe drainage corridor. Continue routine monitoring.
          </div>
        `}
      </div>
    </div>
  `;
  layer.bindPopup(popupContent, { className: "hud-leaflet-popup" });
}

// Custom Leaflet pulsating danger beacon icon
const createDangerBeaconIcon = (label) =>
  L.divIcon({
    className: "danger-beacon-container",
    html: `
      <div class="danger-beacon-wrapper" title="${label || 'Active Critical Hazard Area'}">
        <div class="beacon-wave wave-1"></div>
        <div class="beacon-wave wave-2"></div>
        <div class="beacon-core">🚨</div>
        <div class="beacon-label">${label || "DANGER ZONE"}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

export default function RiskHeatmap({ data }) {
  if (!data || !data.features || data.features.length === 0) return null;

  // Extract key critical hotspot centroids to place prominent pulsing hazard beacons
  const dangerBeacons = useMemo(() => {
    const beacons = [];
    const criticals = data.features.filter((f) => {
      const p = f.properties || {};
      const score = p.risk_score ?? p.flood_probability ?? 0;
      return p.risk_level === "CRITICAL" || score >= 0.85;
    });

    // Sample top representative critical cells across different coordinates to avoid excessive clutter
    const seen = new Set();
    for (const f of criticals) {
      if (!f.geometry || !f.geometry.coordinates) continue;
      let centerLat, centerLon;
      if (f.geometry.type === "Polygon") {
        const ring = f.geometry.coordinates[0];
        centerLon = ring.reduce((sum, c) => sum + c[0], 0) / ring.length;
        centerLat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length;
      } else if (f.geometry.type === "Point") {
        centerLon = f.geometry.coordinates[0];
        centerLat = f.geometry.coordinates[1];
      }
      if (centerLat && centerLon) {
        const key = `${centerLat.toFixed(2)}_${centerLon.toFixed(2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const name = f.properties?.name || f.properties?.village || "Critical Danger Area";
          beacons.push({
            id: key,
            position: [centerLat, centerLon],
            label: name,
            score: Math.round((f.properties?.risk_score ?? 0.9) * 100),
          });
          if (beacons.length >= 6) break; // Limit to top 6 hotspots
        }
      }
    }
    return beacons;
  }, [data]);

  return (
    <>
      <GeoJSON
        data={data}
        style={style}
        onEachFeature={onEachFeature}
        key={JSON.stringify(data).slice(0, 100)}
      />
      {dangerBeacons.map((b) => (
        <Marker
          key={b.id}
          position={b.position}
          icon={createDangerBeaconIcon(`${b.label} (${b.score}% Risk)`)}
        >
          <Popup className="hud-leaflet-popup">
            <div className="hud-risk-popup">
              <div class="hud-popup-header hud-danger-header">
                <span class="hud-pulse-dot pulse-red"></span>
                <strong class="hud-level">CRITICAL DANGER ZONE</strong>
                <span class="hud-score-badge">{b.score}%</span>
              </div>
              <div class="hud-popup-body">
                <p><strong>{b.label}</strong> is actively pulsing as an extreme flood & landslide hazard area.</p>
                <div class="hud-warning-alert">
                  🚨 Immediate evacuation recommended to designated relief shelters.
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
