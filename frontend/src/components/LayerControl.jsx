import React, { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/current-conditions/${lat}/${lon}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Filter Definitions ──────────────────────────────────────
const FILTERS = [
  {
    id: "rain",
    label: "Rainfall",
    icon: "🌧️",
    color: "#38bdf8",
    glow: "rgba(56,189,248,0.35)",
    bg: "rgba(56,189,248,0.12)",
    desc: "Precipitation mm/hr",
  },
  {
    id: "wind",
    label: "Wind Vector",
    icon: "💨",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.35)",
    bg: "rgba(167,139,250,0.12)",
    desc: "Speed & Particle Flow",
  },
  {
    id: "temp",
    label: "Temperature",
    icon: "🌡️",
    color: "#f97316",
    glow: "rgba(249,115,22,0.35)",
    bg: "rgba(249,115,22,0.12)",
    desc: "Thermal Gradient",
  },
  {
    id: "soil",
    label: "Soil Moisture",
    icon: "💧",
    color: "#4ade80",
    glow: "rgba(74,222,128,0.35)",
    bg: "rgba(74,222,128,0.12)",
    desc: "Saturation %",
  },
];

const LAYER_SECTIONS = [
  {
    key: "animated",
    label: "✨ Animated Overlays",
    items: [
      { key: "wind", label: "Windy Particles Flow", dot: "#00c8ff", badge: "CANVAS" },
      { key: "radar", label: "Animated Radar Loop", dot: "#38bdf8", badge: "LOOPING" },
    ],
  },
  {
    key: "osm",
    label: "🏙️ OSM Infrastructure",
    items: [
      { key: "hospitals", label: "Hospitals & Medical Centers", dot: "#ef4444", badge: "OSM" },
      { key: "shelters", label: "Evacuation Shelters", dot: "#3b82f6", badge: "OSM" },
      { key: "fire", label: "Fire & Rescue Stations", dot: "#f97316", badge: "OSM" },
      { key: "rivers", label: "River Channels & Canals", dot: "#00b4d8", badge: "OSM" },
    ],
  },
  {
    key: "risk",
    label: "🔴 AI Risk Layers",
    items: [
      { key: "risk", label: "Flood Risk Grid", dot: "#f87171", badge: "150M GRID" },
    ],
  },
  {
    key: "basemap",
    label: "🗺 Basemap Style",
    items: [
      { key: "osm",       label: "OpenStreetMap",        dot: "#4ade80" },
      { key: "dark",      label: "CartoDB Dark Matter",  dot: "#7c3aed" },
      { key: "hydro",     label: "CartoDB Voyager (Hydro)", dot: "#38bdf8" },
      { key: "satellite", label: "Esri Satellite",       dot: "#fbbf24" },
    ],
  },
];

function WeatherCard({ filter, weather, loading }) {
  const rain  = weather?.rainfall?.current_rainfall_mm ?? 0;
  const r1hr  = weather?.rainfall?.rainfall_1hr_mm ?? 0;
  const r3hr  = weather?.rainfall?.rainfall_3hr_mm ?? 0;
  const r24hr = weather?.rainfall?.rainfall_24hr_mm ?? 0;
  const soil  = weather?.rainfall?.soil_moisture_pct ?? 0;
  const precip = weather?.rainfall?.precipitation_probability_pct ?? 0;
  const windSpeed = weather?.wind?.speed_kmh ?? 0;
  const windDir   = weather?.wind?.direction_deg ?? 0;
  const temp      = weather?.temperature?.celsius ?? 0;
  const feelsLike = weather?.temperature?.feels_like_c ?? 0;
  const humidity  = weather?.temperature?.humidity_pct ?? 0;

  const col = filter.color;
  const statBox = (label, value) => (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      borderRadius: 7,
      padding: "6px 10px",
      display: "flex",
      flexDirection: "column",
      minWidth: 64,
    }}>
      <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#6b7a99" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#e2f0ff", marginTop: 2 }}>{value}</span>
    </div>
  );

  if (filter.id === "rain") return (
    <div className="ow-weather-card" style={{ "--accent": col }}>
      <div className="ow-card-row">
        <span style={{ fontSize: 32 }}>🌧️</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{rain.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7a99" }}>mm/hr</span></div>
          <div style={{ fontSize: 11, color: "#6b7a99" }}>{loading ? "Updating…" : "Open-Meteo Live"}</div>
        </div>
      </div>
      <div className="ow-card-stats">
        {statBox("1 hr", `${r1hr.toFixed(1)} mm`)}
        {statBox("3 hr", `${r3hr.toFixed(1)} mm`)}
        {statBox("24 hr", `${r24hr.toFixed(1)} mm`)}
        {statBox("Prob", `${precip.toFixed(0)}%`)}
      </div>
      <div className="ow-intensity-bar">
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: "linear-gradient(90deg,#38bdf8,#0ea5e9,#7c3aed,#dc2626)", position: "relative" }}>
          <div style={{ position: "absolute", top: -3, left: `${Math.min(rain / 50 * 100, 98)}%`, width: 10, height: 10, borderRadius: "50%", background: col, border: "2px solid #fff", transform: "translateX(-50%)", boxShadow: `0 0 8px ${col}` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b7a99", marginTop: 4 }}>
          <span>0 mm</span><span>Light</span><span>Heavy</span><span>50+ mm</span>
        </div>
      </div>
    </div>
  );

  if (filter.id === "wind") return (
    <div className="ow-weather-card" style={{ "--accent": col }}>
      <div className="ow-card-row">
        <span style={{ fontSize: 32 }}>💨</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{windSpeed.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 400, color: "#6b7a99" }}>km/h</span></div>
          <div style={{ fontSize: 11, color: "#6b7a99" }}>{loading ? "Updating…" : "Wind Speed & Direction"}</div>
        </div>
        {/* Compass Rose */}
        <div style={{ marginLeft: "auto", position: "relative", width: 44, height: 44 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "1.5px solid #2a3a5e", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{ position: "absolute", width: 2, height: 18, background: `linear-gradient(${col},transparent)`, borderRadius: 2, transformOrigin: "50% 100%", transform: `rotate(${windDir}deg)`, bottom: "50%" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
          </div>
          <div style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: "#6b7a99" }}>N</div>
        </div>
      </div>
      <div className="ow-card-stats">
        {statBox("Direction", `${windDir.toFixed(0)}°`)}
        {statBox("Beaufort", `${Math.min(Math.floor(windSpeed / 7), 12)} BFT`)}
        {statBox("Gust", `${(windSpeed * 1.3).toFixed(0)} km/h`)}
      </div>
    </div>
  );

  if (filter.id === "temp") return (
    <div className="ow-weather-card" style={{ "--accent": col }}>
      <div className="ow-card-row">
        <span style={{ fontSize: 32 }}>🌡️</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{temp.toFixed(1)}<span style={{ fontSize: 14 }}>°C</span></div>
          <div style={{ fontSize: 11, color: "#6b7a99" }}>{loading ? "Updating…" : "Thermal Gradient"}</div>
        </div>
      </div>
      <div className="ow-card-stats">
        {statBox("Feels Like", `${feelsLike.toFixed(0)}°C`)}
        {statBox("Humidity", `${humidity.toFixed(0)}%`)}
        {statBox("Category", temp < 20 ? "Cool" : temp < 30 ? "Warm" : temp < 40 ? "Hot" : "Extreme")}
      </div>
      <div className="ow-intensity-bar">
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: "linear-gradient(90deg,#38bdf8,#4ade80,#facc15,#f97316,#ef4444)", position: "relative" }}>
          <div style={{ position: "absolute", top: -3, left: `${Math.min(Math.max((temp + 10) / 60 * 100, 1), 98)}%`, width: 10, height: 10, borderRadius: "50%", background: col, border: "2px solid #fff", transform: "translateX(-50%)", boxShadow: `0 0 8px ${col}` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b7a99", marginTop: 4 }}>
          <span>-10°</span><span>10°</span><span>30°</span><span>50°</span>
        </div>
      </div>
    </div>
  );

  if (filter.id === "soil") return (
    <div className="ow-weather-card" style={{ "--accent": col }}>
      <div className="ow-card-row">
        <span style={{ fontSize: 32 }}>💧</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{soil.toFixed(0)}<span style={{ fontSize: 14, fontWeight: 400, color: "#6b7a99" }}>%</span></div>
          <div style={{ fontSize: 11, color: "#6b7a99" }}>{loading ? "Updating…" : "Soil Moisture Saturation"}</div>
        </div>
      </div>
      <div className="ow-card-stats">
        {statBox("Status", soil < 30 ? "Dry" : soil < 60 ? "Moist" : soil < 80 ? "Saturated" : "Flooded")}
        {statBox("Risk", soil > 70 ? "HIGH" : soil > 50 ? "MED" : "LOW")}
        {statBox("Precip %", `${precip.toFixed(0)}%`)}
      </div>
      <div className="ow-intensity-bar">
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: "linear-gradient(90deg,#d97706,#a3e635,#38bdf8,#7c3aed)", position: "relative" }}>
          <div style={{ position: "absolute", top: -3, left: `${Math.min(soil, 98)}%`, width: 10, height: 10, borderRadius: "50%", background: col, border: "2px solid #fff", transform: "translateX(-50%)", boxShadow: `0 0 8px ${col}` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6b7a99", marginTop: 4 }}>
          <span>0%</span><span>Dry</span><span>Moist</span><span>100%</span>
        </div>
      </div>
    </div>
  );

  return null;
}

export default function LayerControl({
  onRiskToggle,
  riskVisible,
  windParticlesVisible,
  onWindParticlesToggle,
  radarLoopVisible,
  onRadarLoopToggle,
  activeWeatherFilter,
  onWeatherFilterChange,
  mapStyle,
  onMapStyleChange,
  osmInfra,
  onOsmInfraToggle,
  center,
}) {
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  const lat = center?.[0] ?? 13.0827;
  const lon = center?.[1] ?? 80.2707;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await fetchWeather(lat, lon);
      if (!cancelled) { setWeather(data); setLoading(false); }
    }
    load();
    const timer = setInterval(load, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [lat, lon]);

  const activeFilter = FILTERS.find((f) => f.id === activeWeatherFilter) || FILTERS[0];

  // Layer toggle lookup
  function isChecked(key) {
    if (key === "wind") return windParticlesVisible;
    if (key === "radar") return radarLoopVisible;
    if (key === "risk") return riskVisible;
    if (key === "hospitals") return osmInfra.hospitals;
    if (key === "shelters") return osmInfra.shelters;
    if (key === "fire") return osmInfra.fire;
    if (key === "rivers") return osmInfra.rivers;
    return false;
  }

  function handleToggle(sectionKey, itemKey, checked) {
    if (sectionKey === "animated") {
      if (itemKey === "wind") onWindParticlesToggle(checked);
      if (itemKey === "radar") onRadarLoopToggle(checked);
    } else if (sectionKey === "osm") {
      onOsmInfraToggle(itemKey, checked);
    } else if (sectionKey === "risk") {
      onRiskToggle(checked);
    } else if (sectionKey === "basemap") {
      onMapStyleChange(itemKey);
    }
  }

  return (
    <>
      {/* ── Bottom Filter Bar (OpenWeather style) ────────── */}
      <div className="ow-filter-bar">
        {/* Filter Tiles */}
        <div className="ow-filter-tiles">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`ow-filter-tile ${activeWeatherFilter === f.id ? "active" : ""}`}
              style={{
                "--tile-color": f.color,
                "--tile-glow": f.glow,
                "--tile-bg": f.bg,
              }}
              onClick={() => onWeatherFilterChange(f.id)}
            >
              <span className="ow-tile-icon">{f.icon}</span>
              <span className="ow-tile-label">{f.label}</span>
              <span className="ow-tile-desc">{f.desc}</span>
              {activeWeatherFilter === f.id && <span className="ow-tile-active-dot" />}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="ow-bar-divider" />

        {/* Layers Toggle Button */}
        <button
          className={`ow-layers-btn ${layerPanelOpen ? "active" : ""}`}
          onClick={() => setLayerPanelOpen((o) => !o)}
          title="Toggle Layers Panel"
        >
          <span style={{ fontSize: 18 }}>🗂</span>
          <span>Layers</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>{layerPanelOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* ── Weather Data Card (above bar) ─────────────────── */}
      <div className="ow-weather-card-container">
        <WeatherCard filter={activeFilter} weather={weather} loading={loading} />
      </div>

      {/* ── Layers Panel (slides up from bar) ─────────────── */}
      {layerPanelOpen && (
        <div className="ow-layers-panel">
          <div className="ow-layers-panel-header">
            <span>🗂 Map Layers & Infrastructure</span>
            <button className="ow-close-btn" onClick={() => setLayerPanelOpen(false)}>✕</button>
          </div>
          <div className="ow-layers-body">
            {LAYER_SECTIONS.map((section) => (
              <div key={section.key} className="ow-layer-section">
                <div className="ow-layer-section-label">{section.label}</div>
                {section.items.map((item) => {
                  const isBasemap = section.key === "basemap";
                  const checked = isBasemap ? mapStyle === item.key : isChecked(item.key);
                  return (
                    <label key={item.key} className={`ow-layer-row ${checked ? "active" : ""}`}>
                      {isBasemap ? (
                        <input
                          type="radio"
                          name="basemap"
                          checked={checked}
                          onChange={() => handleToggle(section.key, item.key, true)}
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => handleToggle(section.key, item.key, e.target.checked)}
                        />
                      )}
                      <span className="ow-layer-dot" style={{ background: item.dot, boxShadow: `0 0 6px ${item.dot}88` }} />
                      <span className="ow-layer-name">{item.label}</span>
                      {item.badge && (
                        <span className="ow-layer-badge" style={{
                          background: item.badge === "OSM" ? "rgba(74,222,128,0.15)" : "rgba(167,139,250,0.15)",
                          color: item.badge === "OSM" ? "#4ade80" : "#a78bfa",
                        }}>{item.badge}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
