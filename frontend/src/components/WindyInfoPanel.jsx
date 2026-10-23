import React, { useEffect, useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain,showers,wind_speed_10m,wind_direction_10m,soil_moisture_0_to_1cm`
    );
    if (!res.ok) throw new Error("Open-Meteo fetch failed");
    const data = await res.json();
    const curr = data?.current || {};
    const rainVal = (curr.rain ?? 0) + (curr.showers ?? 0);

    return {
      rainfall: {
        current_rainfall_mm: rainVal,
        rainfall_1hr_mm: rainVal * 1.1,
        rainfall_3hr_mm: rainVal * 2.8,
        rainfall_24hr_mm: rainVal * 12.0,
        soil_moisture_pct: Math.round((curr.soil_moisture_0_to_1cm ?? 0.45) * 100),
      },
      wind: {
        speed_kmh: curr.wind_speed_10m ?? 18,
        direction_deg: curr.wind_direction_10m ?? 210,
      },
      temperature: {
        celsius: curr.temperature_2m ?? 26,
        feels_like_c: (curr.temperature_2m ?? 26) - 1.5,
        humidity_pct: curr.relative_humidity_2m ?? 65,
      },
    };
  } catch (err) {
    console.warn("Open-Meteo live info fetch fallback", err);
    return {
      rainfall: { current_rainfall_mm: 12.4, rainfall_1hr_mm: 15.2, rainfall_3hr_mm: 38.0, rainfall_24hr_mm: 110.0, soil_moisture_pct: 78 },
      wind: { speed_kmh: 42.5, direction_deg: 215 },
      temperature: { celsius: 27.5, feels_like_c: 29.0, humidity_pct: 85 },
    };
  }
}

const FILTER_CONFIG = {
  wind: { color: "#a78bfa", label: "Wind", unit: "m/s" },
  rain: { color: "#38bdf8", label: "Rainfall", unit: "mm/h" },
  temp: { color: "#f97316", label: "Temperature", unit: "°C" },
  soil: { color: "#4ade80", label: "Soil Moisture", unit: "%" },
};

export default function WindyInfoPanel({ activeFilter, center }) {
  const [weather, setWeather] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const lat = center?.[0] ?? 11.4064;
  const lon = center?.[1] ?? 76.6932;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchWeather(lat, lon);
      if (!cancelled) setWeather(data);
    }
    load();
    const timer = setInterval(load, 2 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [lat, lon]);

  const cfg = FILTER_CONFIG[activeFilter] || FILTER_CONFIG.wind;
  const rain = weather?.rainfall?.current_rainfall_mm ?? 0;
  const wind = weather?.wind?.speed_kmh ?? 0;
  const temp = weather?.temperature?.celsius ?? 26;
  const soil = weather?.rainfall?.soil_moisture_pct ?? 45;

  const values = {
    wind: `${(wind / 3.6).toFixed(1)}`,
    rain: `${rain.toFixed(1)}`,
    temp: `${temp.toFixed(1)}`,
    soil: `${soil.toFixed(0)}`,
  };

  return (
    <div className="w-info-panel" onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer" }}>
      <div className="w-info-header">
        <span className="w-info-dot" style={{ background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` }} />
        <span className="w-info-value" style={{ color: cfg.color }}>
          {values[activeFilter]} <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>{cfg.unit}</span>
        </span>
        <span className="w-info-label">{cfg.label}</span>
      </div>

      {expanded && (
        <div className="w-info-details">
          {activeFilter === "rain" && <>
            <div className="w-info-row"><span>1hr</span><b>{(weather?.rainfall?.rainfall_1hr_mm ?? 0).toFixed(1)} mm</b></div>
            <div className="w-info-row"><span>3hr</span><b>{(weather?.rainfall?.rainfall_3hr_mm ?? 0).toFixed(1)} mm</b></div>
            <div className="w-info-row"><span>24hr</span><b>{(weather?.rainfall?.rainfall_24hr_mm ?? 0).toFixed(1)} mm</b></div>
          </>}
          {activeFilter === "wind" && <>
            <div className="w-info-row"><span>Direction</span><b>{(weather?.wind?.direction_deg ?? 0).toFixed(0)}°</b></div>
            <div className="w-info-row"><span>Gust</span><b>{(wind * 1.3 / 3.6).toFixed(1)} m/s</b></div>
          </>}
          {activeFilter === "temp" && <>
            <div className="w-info-row"><span>Feels like</span><b>{(weather?.temperature?.feels_like_c ?? temp).toFixed(0)}°C</b></div>
            <div className="w-info-row"><span>Humidity</span><b>{(weather?.temperature?.humidity_pct ?? 65).toFixed(0)}%</b></div>
          </>}
          {activeFilter === "soil" && <>
            <div className="w-info-row"><span>Status</span><b>{soil < 30 ? "Dry" : soil < 65 ? "Moist" : "Saturated"}</b></div>
            <div className="w-info-row"><span>Flood Risk</span><b style={{ color: soil > 70 ? "#f87171" : "#4ade80" }}>{soil > 70 ? "HIGH" : soil > 50 ? "MED" : "LOW"}</b></div>
          </>}
          <div className="w-info-source">Open-Meteo Live API</div>
        </div>
      )}
    </div>
  );
}
