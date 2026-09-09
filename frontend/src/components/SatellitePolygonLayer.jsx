import React, { useState } from "react";
import { GeoJSON, Polygon, Polyline, Tooltip, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Default Low-Lying Floor Inundation Polygons (Adyar & Velachery Floors)
export const DEFAULT_LOW_FLOOR_POLYGONS = [
  {
    type: "Feature",
    properties: { area: "Adyar Low-Lying River Basin Floor", depth_est_m: 2.8, severity: "CRITICAL" },
    geometry: {
      type: "Polygon",
      coordinates: [[[80.220, 13.010], [80.265, 13.015], [80.275, 13.030], [80.250, 13.035], [80.215, 13.020], [80.220, 13.010]]]
    }
  },
  {
    type: "Feature",
    properties: { area: "Velachery Low Floor Inundation Zone", depth_est_m: 2.2, severity: "HIGH" },
    geometry: {
      type: "Polygon",
      coordinates: [[[80.210, 12.970], [80.235, 12.975], [80.245, 12.990], [80.220, 12.998], [80.205, 12.980], [80.210, 12.970]]]
    }
  }
];

// High-Safety Refuge Zones (Elevated Grounds / Safe Havens)
const DEFAULT_SAFE_REFUGE_ZONES = [
  {
    name: "Kotturpuram High-Elevation Relief Shelter",
    priority: "SAFE REFUGE",
    elevation: "+42m MSL",
    capacity: 1200,
    coordinates: [
      [13.0285, 80.2380],
      [13.0310, 80.2440],
      [13.0260, 80.2480],
      [13.0235, 80.2410],
      [13.0285, 80.2380]
    ]
  },
  {
    name: "Adyar High Ground Evacuation Haven",
    priority: "SAFE REFUGE",
    elevation: "+38m MSL",
    capacity: 950,
    coordinates: [
      [13.0020, 80.2480],
      [13.0080, 80.2540],
      [13.0040, 80.2580],
      [12.9990, 80.2520],
      [13.0020, 80.2480]
    ]
  }
];

// Evacuation Paths connecting Low-Lying Floor Areas to High-Safety Zones
const EVACUATION_CORRIDORS = [
  {
    id: "route-1",
    name: "Velachery Low Basin ➔ Adyar High Refuge",
    priority: "PRIORITY 1 EVACUATION CORRIDOR",
    path: [
      [12.9815, 80.2180], // Low floor flooded basin
      [12.9920, 80.2320],
      [13.0040, 80.2520]  // High safety refuge
    ]
  },
  {
    id: "route-2",
    name: "Adyar Floor ➔ High Refuge Haven",
    priority: "CRITICAL RESCUE ROUTE",
    path: [
      [13.005, 80.225],
      [13.012, 80.238],
      [13.018, 80.244],
    ],
  },
];

export default function SatellitePolygonLayer({ polygons, forecastStep }) {
  const map = useMap();
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend() {
      setCurrentZoom(map.getZoom());
    },
  });

  const isLocalZoom = currentZoom >= 7;
  const activePolygons = (polygons && polygons.length > 0) ? polygons : DEFAULT_LOW_FLOOR_POLYGONS;

  const rainMm = typeof forecastStep?.rainMm === "number" ? forecastStep.rainMm : 88;
  const isPeakHour = typeof forecastStep?.status === "string" ? forecastStep.status.includes("CRITICAL") : true;
  const forecastLabel = forecastStep?.time ? `[${forecastStep.time}]` : "";

  const geojsonFeatureCollection = {
    type: "FeatureCollection",
    features: activePolygons,
  };

  const polygonStyle = (feature) => {
    const isCritical = isPeakHour || feature?.properties?.severity === "CRITICAL";
    return {
      color: isCritical ? "#ef4444" : "#f97316",
      weight: isCritical ? 3.5 : 2.5,
      opacity: 0.95,
      fillColor: isCritical ? `rgba(239, 68, 68, ${Math.min(0.7, 0.3 + rainMm / 160)})` : "rgba(249, 115, 22, 0.38)",
      fillOpacity: Math.min(0.65, 0.3 + rainMm / 150),
      dashArray: "6, 6",
    };
  };

  const onEachFeature = (feature, layer) => {
    const props = feature?.properties || {};
    const isCritical = isPeakHour || props.severity === "CRITICAL";
    const prioLabel = isCritical ? "PRIORITY 1: LOW-LYING CRITICAL INUNDATION" : "PRIORITY 2: SEVERE OVERFLOW ZONE";
    const depthVal = (props.depth_est_m ? props.depth_est_m * (rainMm / 70) : (rainMm / 28)).toFixed(1);

    layer.bindTooltip(
      `<div class="prio-badge ${isCritical ? 'critical' : 'high'}">
        ${isCritical ? '🚨' : '⚠️'} ${prioLabel} ${forecastLabel}
      </div>
      <div style="font-size: 10px; margin-top: 2px; color: #cbd5e1;">
        Basin Floor: <strong>${props.area || "Low-Lying Zone"}</strong> | Est Depth: <strong>${depthVal}m</strong> (${rainMm}mm/h rain)
      </div>`,
      { permanent: isLocalZoom, direction: "center", className: "map-priority-tooltip" }
    );

    layer.bindPopup(`
      <div style="font-family: 'Inter', sans-serif; padding: 6px; color: #0f172a; min-width: 220px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="background: ${isCritical ? '#dc2626' : '#ea580c'}; color: #fff; font-weight: 800; font-size: 9px; padding: 3px 8px; border-radius: 10px; text-transform: uppercase;">
            ${isCritical ? 'PRIORITY 1: CRITICAL INUNDATION' : 'PRIORITY 2: SEVERE RISK'}
          </span>
          <span style="font-size: 10px; color: #64748b; font-weight: 600;">Low Floor Basin</span>
        </div>
        <h4 style="margin: 0 0 4px; font-size: 14px; color: #0f172a; font-weight: 700;">🛰️ ${props.area || "Low-Lying Flood Zone"}</h4>
        <p style="margin: 3px 0; font-size: 11px; color: #475569;"><strong>Forecast Step:</strong> ${forecastStep?.label || "12:00 PM - PEAK SURGE"}</p>
        <p style="margin: 3px 0; font-size: 11px; color: #475569;"><strong>Est. Flood Depth:</strong> ${depthVal} m</p>
        <p style="margin: 3px 0; font-size: 11px; color: #475569;"><strong>Precipitation Intensity:</strong> ${rainMm} mm/h</p>
        <span class="osm-tag" style="background: #fef2f2; color: #dc2626;">Source: Sentinel-1 SAR Dual-Pol Inundation</span>
      </div>
    `);
  };

  return (
    <>
      {/* ── 1. Low Floor Satellite Inundation Polygons (Priority 1 & 2) ── */}
      <GeoJSON
        key={`${activePolygons.map(p => p.properties?.area).join("-")}-${isLocalZoom}`}
        data={geojsonFeatureCollection}
        style={polygonStyle}
        onEachFeature={onEachFeature}
      />

      {/* ── 2. High Safety Refuge Zones (High Elevation Safe Havens) ── */}
      {DEFAULT_SAFE_REFUGE_ZONES.map((zone, idx) => (
        <Polygon
          key={`safe-zone-${idx}-${isLocalZoom}`}
          positions={zone.coordinates}
          pathOptions={{
            color: "#10b981",
            weight: 3.5,
            opacity: 0.95,
            fillColor: "rgba(16, 185, 129, 0.35)",
            fillOpacity: 0.5,
          }}
        >
          <Tooltip permanent={isLocalZoom} direction="center" className="map-priority-tooltip">
            <div>
              <div className="prio-badge safe">
                🛡️ HIGH SAFETY REFUGE (SAFE ZONE)
              </div>
              <div style={{ fontSize: "10px", marginTop: "2px", color: "#a7f3d0" }}>
                {zone.name} • Elevation: <strong>{zone.elevation}</strong>
              </div>
            </div>
          </Tooltip>
          <Popup>
            <div style={{ fontFamily: "'Inter', sans-serif", padding: "6px", color: "#0f172a" }}>
              <span style={{ background: "#059669", color: "#fff", fontWeight: 800, fontSize: "9px", padding: "3px 8px", borderRadius: "10px", textTransform: "uppercase" }}>
                🛡️ HIGH SAFETY REFUGE ZONE
              </span>
              <h4 style={{ margin: "6px 0 4px", fontSize: "14px", color: "#0f172a", fontWeight: 700 }}>{zone.name}</h4>
              <p style={{ margin: "2px 0", fontSize: "11.5px", color: "#334155" }}><strong>Elevation:</strong> {zone.elevation} (Above Flood Surge)</p>
              <p style={{ margin: "2px 0", fontSize: "11.5px", color: "#334155" }}><strong>Refuge Capacity:</strong> {zone.capacity} persons</p>
              <span className="osm-tag" style={{ background: "#ecfdf5", color: "#059669" }}>Priority Safe Evacuation Point</span>
            </div>
          </Popup>
        </Polygon>
      ))}

      {/* ── 3. Priority Evacuation Corridors (Low Floor ➔ High Safety) ── */}
      {EVACUATION_CORRIDORS.map((route) => (
        <Polyline
          key={`${route.id}-${isLocalZoom}`}
          positions={route.path}
          pathOptions={{
            color: "#00f0ff",
            weight: 5,
            opacity: 0.95,
            dashArray: "10, 8",
          }}
        >
          <Tooltip permanent={isLocalZoom} direction="top" className="map-priority-tooltip">
            <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              ⚡ {route.priority}: LOW FLOOR ➔ SAFE HIGH GROUND
            </div>
          </Tooltip>
        </Polyline>
      ))}
    </>
  );
}
