import React, { useState, useEffect, useRef } from "react";

/**
 * Cyclone Track Data — realistic Bay of Bengal cyclone making landfall near Chennai.
 * Each step has: cyclone center (lat/lon), category, wind speed, and land contact %.
 * The cyclone forms over ocean, intensifies, makes landfall, then weakens inland.
 */
export const CYCLONE_TRACK = [
  { step: 0, time: "06:00 AM", period: "Dawn", lat: 11.2, lon: 83.5,  windKts: 45,  category: "TS",    rainMm: 12,  landPct: 0,   label: "Tropical Storm forms over Bay of Bengal",   status: "MODERATE",     phase: "OCEAN" },
  { step: 1, time: "08:00 AM", period: "Morning", lat: 11.6, lon: 82.8,  windKts: 65,  category: "Cat-1", rainMm: 28,  landPct: 0,   label: "Intensifying — Cat-1, approaching coast",   status: "ELEVATED",     phase: "OCEAN" },
  { step: 2, time: "10:00 AM", period: "Morning", lat: 12.0, lon: 82.0,  windKts: 90,  category: "Cat-2", rainMm: 52,  landPct: 0,   label: "Cat-2 — Outer rain bands reaching coast",   status: "HIGH RISK",    phase: "APPROACHING" },
  { step: 3, time: "12:00 PM", period: "Noon",    lat: 12.4, lon: 81.2,  windKts: 115, category: "Cat-3", rainMm: 88,  landPct: 0,   label: "Cat-3 — Peak intensity, eye wall visible",  status: "CRITICAL 🚨",  phase: "PEAK" },
  { step: 4, time: "02:00 PM", period: "Afternoon", lat: 12.8, lon: 80.5, windKts: 110, category: "Cat-3", rainMm: 94, landPct: 15,  label: "LANDFALL — Eye wall crosses coastline",     status: "CRITICAL 🚨",  phase: "LANDFALL" },
  { step: 5, time: "04:00 PM", period: "Afternoon", lat: 13.1, lon: 80.1, windKts: 80,  category: "Cat-1", rainMm: 72, landPct: 55,  label: "Inland push — Rapid weakening begins",     status: "HIGH RISK",    phase: "INLAND" },
  { step: 6, time: "06:00 PM", period: "Evening",   lat: 13.3, lon: 79.7, windKts: 55,  category: "TS",    rainMm: 48, landPct: 85,  label: "Tropical Storm over land — heavy flooding", status: "ELEVATED",     phase: "WEAKENING" },
  { step: 7, time: "08:00 PM", period: "Night",     lat: 13.5, lon: 79.3, windKts: 35,  category: "TD",    rainMm: 28, landPct: 100, label: "Depression — Residual flooding continues",  status: "MODERATE",     phase: "DEPRESSION" },
  { step: 8, time: "10:00 PM", period: "Night",     lat: 13.6, lon: 79.0, windKts: 20,  category: "LOW",   rainMm: 12, landPct: 100, label: "Remnant low — Waters receding",             status: "LOW RISK",     phase: "DISSIPATING" },
  { step: 9, time: "12:00 AM", period: "Midnight",  lat: 13.7, lon: 78.8, windKts: 10,  category: "REM",   rainMm: 4,  landPct: 100, label: "Remnant circulation — Storm passed",        status: "SAFE",         phase: "REMNANT" },
];

// Legacy alias for backward compat
export const TWENTY_FOUR_HOUR_FORECAST = CYCLONE_TRACK;

export default function WindyBottomBar({ onStepChange, simulationMode }) {
  const [playing, setPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);

  const currentForecast = CYCLONE_TRACK[activeStep];

  useEffect(() => {
    if (onStepChange) {
      onStepChange(currentForecast);
    }
  }, [activeStep, onStepChange, currentForecast]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = 1800 / speed; // Slower for dramatic effect
    timerRef.current = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % CYCLONE_TRACK.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed]);

  const handleStepClick = (stepIdx) => {
    setActiveStep(stepIdx);
  };

  const handleSpeedToggle = () => {
    setSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
  };

  // Category color
  const catColors = {
    "REM": "#64748b", "LOW": "#64748b", "TD": "#94a3b8",
    "TS": "#facc15", "Cat-1": "#f97316", "Cat-2": "#ef4444", "Cat-3": "#dc2626",
  };
  const catColor = catColors[currentForecast.category] || "#64748b";

  return (
    <div className="w-bottom-bar">
      {/* ── Play / Pause ── */}
      <button
        className={`w-play-btn ${playing ? "playing" : ""}`}
        onClick={() => setPlaying((p) => !p)}
        title={playing ? "Pause Simulation" : "Play Cyclone Track Simulation"}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* ── Time + Cyclone Status ── */}
      <div className="w-time-badge-container">
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className={`w-time-current ${currentForecast.status.includes("CRITICAL") ? "critical-pulse" : ""}`}
            style={{ background: catColor }}>
            {currentForecast.time}
          </span>
          <span style={{
            fontSize: "10px", fontWeight: 800, color: catColor,
            background: `${catColor}22`, padding: "2px 6px", borderRadius: "4px",
          }}>
            {currentForecast.category} • {currentForecast.windKts}kt
          </span>
        </div>
        <span className="w-time-status">
          {currentForecast.phase} • {currentForecast.rainMm} mm/h
        </span>
      </div>

      {/* ── Timeline Scrubber ── */}
      <div className="w-timeline">
        <div className="w-timeline-track">
          <input
            type="range"
            min="0"
            max={CYCLONE_TRACK.length - 1}
            value={activeStep}
            onChange={(e) => setActiveStep(parseInt(e.target.value, 10))}
            className="w-scrubber-slider"
          />
          <div className="w-timeline-dates">
            {CYCLONE_TRACK.map((item, i) => (
              <div
                key={i}
                className={`w-timeline-day ${activeStep === i ? "active" : ""} ${item.status.includes("CRITICAL") ? "is-critical" : ""}`}
                onClick={() => handleStepClick(i)}
                title={item.label}
              >
                <span className="w-timeline-day-label">{item.time}</span>
                <span className="w-timeline-day-date">{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Speed Toggle ── */}
      <button className="w-speed-btn" onClick={handleSpeedToggle} title="Simulation Speed">
        ⚡ {speed}x
      </button>
    </div>
  );
}
