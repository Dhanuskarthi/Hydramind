import React, { useEffect, useRef, useState } from "react";

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

// ── Filter Config ─────────────────────────────────────────
const FILTERS = [
  {
    id: "rain",
    label: "Rain",
    color: "#38bdf8",
    glow: "rgba(56,189,248,0.7)",
    legendColors: ["#00eeff","#00bbcc","#0066ff","#7700ff"],
    legendLabels: ["0", "10", "20", "40+ mm/h"],
    unit: "mm/h",
    // Animated icon: rain drops
    IconAnim: ({ active }) => <RainIcon active={active} />,
  },
  {
    id: "temp",
    label: "Temp",
    color: "#f97316",
    glow: "rgba(249,115,22,0.7)",
    legendColors: ["#0000ff","#00aaff","#00ff88","#ffff00","#ff6600","#ff0000","#990000"],
    legendLabels: ["-50", "-25", "0", "25", "50°C"],
    unit: "°C",
    IconAnim: ({ active }) => <TempIcon active={active} />,
  },
  {
    id: "wind",
    label: "Wind",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.7)",
    legendColors: ["#3b82f6","#22d3ee","#4ade80","#facc15","#f97316","#ef4444"],
    legendLabels: ["0", "5", "15", "30", "50+ m/s"],
    unit: "m/s",
    IconAnim: ({ active }) => <WindIcon active={active} />,
  },
  {
    id: "soil",
    label: "Soil",
    color: "#4ade80",
    glow: "rgba(74,222,128,0.7)",
    legendColors: ["#b45309","#ca8a04","#4ade80","#0ea5e9","#1d4ed8"],
    legendLabels: ["0%", "25%", "50%", "75%", "100%"],
    unit: "%",
    IconAnim: ({ active }) => <SoilIcon active={active} />,
  },
];

// ── Animated SVG Icons ────────────────────────────────────

function RainIcon({ active }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Cloud */}
      <path d="M8 18 Q6 18 6 15 Q6 11 10 11 Q11 7 16 7 Q21 7 22 11 Q25 11 25 15 Q25 18 23 18 Z"
        fill={active ? "#38bdf8" : "#4a5670"} opacity={active ? 1 : 0.7} />
      {/* Rain drops with animation */}
      {[10, 14, 18, 22].map((x, i) => (
        <line key={i} x1={x} y1={20} x2={x - 2} y2={27}
          stroke={active ? "#38bdf8" : "#4a5670"}
          strokeWidth="2" strokeLinecap="round"
          opacity={active ? 1 : 0.5}
          style={active ? { animation: `rainDrop ${0.6 + i * 0.15}s ease-in infinite`, animationDelay: `${i * 0.12}s` } : {}}
        />
      ))}
    </svg>
  );
}

function TempIcon({ active }) {
  const col = active ? "#f97316" : "#4a5670";
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
      {/* Thermometer tube */}
      <rect x="11" y="2" width="6" height="18" rx="3" fill={active ? "rgba(249,115,22,0.2)" : "rgba(74,86,112,0.2)"} stroke={col} strokeWidth="1.5" />
      {/* Mercury fill — animated height */}
      <rect x="13" y={active ? "8" : "14"} width="2" height={active ? "12" : "6"} rx="1"
        fill={col}
        style={active ? { transition: "all 0.4s ease" } : {}} />
      {/* Bulb */}
      <circle cx="14" cy="24" r="5" fill={col} opacity={active ? 1 : 0.7} />
      {/* Tick marks */}
      {[6, 10, 14].map((y, i) => (
        <line key={i} x1="18" y1={y} x2="21" y2={y} stroke={col} strokeWidth="1.5" opacity={0.8} />
      ))}
    </svg>
  );
}

function WindIcon({ active }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {[
        { y: 10, w: 20, delay: "0s" },
        { y: 16, w: 24, delay: "0.2s" },
        { y: 22, w: 16, delay: "0.4s" },
      ].map((line, i) => (
        <g key={i}>
          <line x1="4" y1={line.y} x2={4 + line.w} y2={line.y}
            stroke={active ? "#a78bfa" : "#4a5670"}
            strokeWidth="2.5" strokeLinecap="round"
            style={active ? {
              animation: `windFlow 1.2s ease-in-out infinite`,
              animationDelay: line.delay,
            } : {}}
          />
          {/* Curl at end */}
          <path d={`M${4 + line.w} ${line.y} Q${4 + line.w + 4} ${line.y} ${4 + line.w + 4} ${line.y + 4}`}
            stroke={active ? "#a78bfa" : "#4a5670"}
            strokeWidth="2" fill="none" strokeLinecap="round"
            opacity={0.7}
          />
        </g>
      ))}
    </svg>
  );
}

function SoilIcon({ active }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Ground layer */}
      <rect x="3" y="18" width="26" height="11" rx="2" fill={active ? "rgba(74,222,128,0.25)" : "rgba(74,86,112,0.2)"} />
      <rect x="3" y="22" width="26" height="7" rx="0" fill={active ? "rgba(74,222,128,0.15)" : "rgba(74,86,112,0.1)"} />
      {/* Water drops */}
      {active && [8, 14, 20, 26].map((x, i) => (
        <ellipse key={i} cx={x} cy={24 + (i % 2)} rx="2" ry="2.5"
          fill="#4ade80" opacity="0.8"
          style={{ animation: `soilPulse 1.5s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
        />
      ))}
      {!active && [8, 14, 20, 26].map((x, i) => (
        <ellipse key={i} cx={x} cy={24} rx="2" ry="2.5" fill="#4a5670" opacity="0.5" />
      ))}
      {/* Plant */}
      <path d="M16 18 L16 10" stroke={active ? "#4ade80" : "#4a5670"} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 14 Q12 12 11 8" stroke={active ? "#4ade80" : "#4a5670"} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M16 12 Q20 10 21 6" stroke={active ? "#4ade80" : "#4a5670"} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── Legend Bar at bottom ──────────────────────────────────
function LegendBar({ filter }) {
  if (!filter) return null;
  const grad = `linear-gradient(90deg, ${filter.legendColors.join(",")})`;
  return (
    <div className="ow-legend-bar">
      <div className="ow-legend-gradient" style={{ background: grad }} />
      <div className="ow-legend-labels">
        {filter.legendLabels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="ow-legend-unit">{filter.unit}</div>
    </div>
  );
}

// ── Main Sidebar Component ────────────────────────────────
export default function WeatherSidebar({ activeWeatherFilter, onWeatherFilterChange, center }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

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

  const activeFilter = FILTERS.find((f) => f.id === activeWeatherFilter);

  // Live values from backend (or defaults)
  const rain  = weather?.rainfall?.current_rainfall_mm ?? 0;
  const wind  = weather?.wind?.speed_kmh ?? 0;
  const temp  = weather?.temperature?.celsius ?? 30;
  const soil  = weather?.rainfall?.soil_moisture_pct ?? 45;

  const liveValues = { rain, wind: (wind / 3.6).toFixed(1), temp, soil };

  return (
    <>
      {/* ── Left Filter Sidebar ── */}
      <div className="ow-sidebar">
        {FILTERS.map((f) => {
          const isActive = activeWeatherFilter === f.id;
          return (
            <button
              key={f.id}
              className={`ow-sidebar-btn ${isActive ? "active" : ""}`}
              style={{ "--sb-color": f.color, "--sb-glow": f.glow }}
              onClick={() => onWeatherFilterChange(f.id)}
              title={f.label}
            >
              <div className="ow-sidebar-icon">
                <f.IconAnim active={isActive} />
              </div>
              <span className="ow-sidebar-label">{f.label}</span>
              {isActive && <div className="ow-sidebar-active-bar" />}
            </button>
          );
        })}
      </div>

      {/* ── Live Value Tooltip (shown when filter is active) ── */}
      {activeFilter && (
        <div
          className="ow-live-badge"
          style={{ "--badge-color": activeFilter.color, "--badge-glow": activeFilter.glow }}
          onClick={() => setInfoExpanded((e) => !e)}
        >
          <div className="ow-live-badge-main">
            <span className="ow-live-dot" />
            <span className="ow-live-value">
              {activeFilter.id === "rain"  && `${rain.toFixed(1)} mm/h`}
              {activeFilter.id === "wind"  && `${liveValues.wind} m/s`}
              {activeFilter.id === "temp"  && `${temp.toFixed(1)} °C`}
              {activeFilter.id === "soil"  && `${soil.toFixed(0)} %`}
            </span>
            <span className="ow-live-label">{activeFilter.label}</span>
          </div>

          {infoExpanded && (
            <div className="ow-live-expanded">
              {activeFilter.id === "rain" && <>
                <div className="ow-live-row"><span>1hr</span><b>{(weather?.rainfall?.rainfall_1hr_mm ?? 0).toFixed(1)} mm</b></div>
                <div className="ow-live-row"><span>3hr</span><b>{(weather?.rainfall?.rainfall_3hr_mm ?? 0).toFixed(1)} mm</b></div>
                <div className="ow-live-row"><span>24hr</span><b>{(weather?.rainfall?.rainfall_24hr_mm ?? 0).toFixed(1)} mm</b></div>
              </>}
              {activeFilter.id === "wind" && <>
                <div className="ow-live-row"><span>Dir</span><b>{(weather?.wind?.direction_deg ?? 0).toFixed(0)}°</b></div>
                <div className="ow-live-row"><span>Gust</span><b>{(wind * 1.3 / 3.6).toFixed(1)} m/s</b></div>
              </>}
              {activeFilter.id === "temp" && <>
                <div className="ow-live-row"><span>Feels</span><b>{(weather?.temperature?.feels_like_c ?? temp).toFixed(0)}°C</b></div>
                <div className="ow-live-row"><span>Humidity</span><b>{(weather?.temperature?.humidity_pct ?? 65).toFixed(0)}%</b></div>
              </>}
              {activeFilter.id === "soil" && <>
                <div className="ow-live-row"><span>Status</span><b>{soil < 30 ? "Dry" : soil < 65 ? "Moist" : "Saturated"}</b></div>
                <div className="ow-live-row"><span>Flood Risk</span><b style={{ color: soil > 70 ? "#f87171" : "#4ade80" }}>{soil > 70 ? "HIGH" : soil > 50 ? "MED" : "LOW"}</b></div>
              </>}
              <div className="ow-live-row muted"><span>{loading ? "Updating…" : "Open-Meteo Live"}</span></div>
            </div>
          )}
        </div>
      )}

      {/* ── Legend Bar ── */}
      <LegendBar filter={activeFilter} />
    </>
  );
}
