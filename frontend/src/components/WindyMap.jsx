import React, { useState } from "react";

const OVERLAYS = [
  { id: "wind", label: "🌀 Wind Particles", icon: "💨" },
  { id: "rain", label: "🌧 Rain & Thunder", icon: "⛈" },
  { id: "radar", label: "📡 Live Weather Radar", icon: "📡" },
  { id: "clouds", label: "☁ Clouds & Satellite", icon: "☁" },
  { id: "temp", label: "🌡 Temperature", icon: "🌡" },
  { id: "waves", label: "🌊 Sea Waves & Surge", icon: "🌊" },
];

export default function WindyMap({ lat = 11.4064, lon = 76.6932, zoom = 11 }) {
  const [currentOverlay, setCurrentOverlay] = useState("wind");
  const [product, setProduct] = useState("ecmwf"); // ecmwf, gfs

  // Construct Windy Embed URL dynamically
  const embedUrl = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=650&height=450&zoom=${zoom}&level=surface&overlay=${currentOverlay}&product=${product}&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=true&metricWind=default&metricTemp=default&radarRange=-1`;

  return (
    <div className="windy-container">
      {/* Animated Filter Toolbar */}
      <div className="windy-toolbar">
        <div className="windy-overlay-buttons">
          <span className="windy-toolbar-label">Windy Animated Layers:</span>
          {OVERLAYS.map((ov) => (
            <button
              key={ov.id}
              className={`windy-btn ${currentOverlay === ov.id ? "active" : ""}`}
              onClick={() => setCurrentOverlay(ov.id)}
            >
              {ov.label}
            </button>
          ))}
        </div>
        <div className="windy-model-selector">
          <span className="windy-toolbar-label">Model:</span>
          <button
            className={`windy-model-btn ${product === "ecmwf" ? "active" : ""}`}
            onClick={() => setProduct("ecmwf")}
            title="ECMWF 9km (Highest accuracy)"
          >
            ECMWF
          </button>
          <button
            className={`windy-model-btn ${product === "gfs" ? "active" : ""}`}
            onClick={() => setProduct("gfs")}
            title="GFS 22km (Global Forecast System)"
          >
            GFS
          </button>
        </div>
      </div>

      {/* Windy Animated Live Iframe */}
      <iframe
        title="Windy Animated Weather Map"
        src={embedUrl}
        className="windy-iframe"
        frameBorder="0"
        allowFullScreen
      />
    </div>
  );
}
