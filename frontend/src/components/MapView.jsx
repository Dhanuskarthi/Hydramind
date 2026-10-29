import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import RiskHeatmap from "./RiskHeatmap.jsx";
import WindParticleLayer from "./WindParticleLayer.jsx";
import WindHeatmapLayer from "./WindHeatmapLayer.jsx";
import RadarAnimationPlayer from "./RadarAnimationPlayer.jsx";
import OSMInfrastructureLayer from "./OSMInfrastructureLayer.jsx";
import RainRadarLayer from "./RainRadarLayer.jsx";
import GlobalRainLayer from "./GlobalRainLayer.jsx";
import TempHeatmapLayer from "./TempHeatmapLayer.jsx";
import SoilMoistureLayer from "./SoilMoistureLayer.jsx";
import SatellitePolygonLayer from "./SatellitePolygonLayer.jsx";
import SatelliteArchiveModal from "./SatelliteArchiveModal.jsx";
import SatelliteMetadataCard from "./SatelliteMetadataCard.jsx";
import WindyRightSidebar from "./WindyRightSidebar.jsx";
import WindyBottomBar from "./WindyBottomBar.jsx";
import WindyInfoPanel from "./WindyInfoPanel.jsx";
import WindySearch from "./WindySearch.jsx";
import PrecisionLegend from "./PrecisionLegend.jsx";
import RiskSummaryModal from "./RiskSummaryModal.jsx";
import AIPredictorModal from "./AIPredictorModal.jsx";
import WindyLayersPanel from "./WindyLayersPanel.jsx";
import WindyPicker from "./WindyPicker.jsx";
import LiveEvacuationPanel from "./LiveEvacuationPanel.jsx";

function MapController({ center, zoom, mapRef, setMapZoom }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      mapRef.current = map;
      if (center) map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map, mapRef]);

  useMapEvents({
    zoomend() {
      if (setMapZoom) setMapZoom(map.getZoom());
    },
  });

  return null;
}

function MapClickHandler({ setClickedPos }) {
  useMapEvents({
    click(e) {
      setClickedPos([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

const TILE_LAYERS = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, maxNativeZoom: 19, className: "" },
  dark: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, maxNativeZoom: 19, className: "dark-tiles" },
  hydro: { url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", maxZoom: 19, maxNativeZoom: 19, className: "" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", maxZoom: 19, maxNativeZoom: 19, className: "" },
};

const NILGIRIS_HOTSPOTS = [
  { name: "Nilgiris (All)", loc: "Nilgiris", coords: [11.4064, 76.6932], zoom: 11 },
  { name: "Coonoor Ghat", loc: "Coonoor", coords: [11.3530, 76.7959], zoom: 13 },
  { name: "Ooty Peak", loc: "Ooty", coords: [11.4064, 76.6932], zoom: 13 },
  { name: "Kotagiri Slopes", loc: "Kotagiri", coords: [11.4229, 76.8641], zoom: 13 },
  { name: "Kallar Basin", loc: "Kallar", coords: [11.3667, 76.8833], zoom: 14 },
];

export default function MapView({
  center = [11.4064, 76.6932],
  zoom = 11,
  riskData,
  district = "Nilgiris",
  onLocationSelect,
  onSearchSubmit,
  onQuickCity,
  loading,
  alerts = [],
  villages = [],
  onSelectHistoricalEvent,
  activeHistoricalEvent,
  onClearHistoricalEvent,
}) {
  const [riskVisible, setRiskVisible] = useState(true);
  const [windParticlesVisible, setWindParticlesVisible] = useState(true);
  const [radarLoopVisible, setRadarLoopVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState("rain");
  const [mapStyle, setMapStyle] = useState("dark");
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [activeForecastStep, setActiveForecastStep] = useState(null);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [activeModel, setActiveModel] = useState("ecmwf");
  const [osmInfra, setOsmInfra] = useState({ hospitals: true, shelters: true, fire: false, rivers: true });
  const [clickedPos, setClickedPos] = useState(null);
  const [mode, setMode] = useState("realtime"); // "realtime" | "simulation"

  // Modals
  const [satModalOpen, setSatModalOpen] = useState(false);
  const [riskSummaryOpen, setRiskSummaryOpen] = useState(false);
  const [predictorOpen, setPredictorOpen] = useState(false);
  const [showAiInfo, setShowAiInfo] = useState(false);

  const mapRef = useRef(null);

  const handleOsmInfraToggle = (type, value) => setOsmInfra((p) => ({ ...p, [type]: value }));
  const handleFilterChange = (filterId) => setActiveFilter(filterId);

  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  const currentTile = TILE_LAYERS[mapStyle] || TILE_LAYERS.osm;

  // Count active danger alerts
  const criticalCount = riskData?.risk_map?.features?.filter(
    (f) => f.properties?.risk_level === "CRITICAL"
  ).length || 8;

  return (
    <div className="command-map-container" style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* ══════════════════════════════════════════════════════════════════════════════
          TOP COMMAND NAVIGATION BAR (Professional Emergency Operations Header)
         ══════════════════════════════════════════════════════════════════════════════ */}
      <header className="command-header">
        {/* Brand & Status */}
        <div className="header-brand-group">
          <div className="brand-logo">
            <span className="brand-icon">🌊</span>
            <div className="brand-text-col">
              <span className="brand-title">HYDRAMIND <span className="brand-tag">EOC</span></span>
              <span className="brand-sub">DISASTER RISK MAPPING & AI EARLY WARNING</span>
            </div>
          </div>
          <div className="live-status-pill">
            <span className="status-ping-dot"></span>
            <span className="status-text">RADAR ACTIVE: <strong>{district.toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Primary Navigation Actions */}
        <nav className="header-nav-bar">
          <button
            className={`nav-tab-btn ${!riskSummaryOpen && !predictorOpen && !satModalOpen ? "active" : ""}`}
            onClick={() => {
              setRiskSummaryOpen(false);
              setPredictorOpen(false);
              setSatModalOpen(false);
            }}
          >
            <span className="tab-icon">🗺️</span>
            <span>Live Risk Map</span>
          </button>

          <button
            className={`nav-tab-btn highlight-tab ${riskSummaryOpen ? "active" : ""}`}
            onClick={() => setRiskSummaryOpen(true)}
            title="Open comprehensive district flood risk analysis & statistics"
          >
            <span className="tab-icon">📊</span>
            <span>Risk Summary</span>
            <span className="tab-counter-badge">{criticalCount} Hotspots</span>
          </button>

          <button
            className={`nav-tab-btn ai-tab ${predictorOpen ? "active" : ""}`}
            onClick={() => setPredictorOpen(true)}
            title="Simulate custom rainfall, slope & soil parameters to predict risk"
          >
            <span className="tab-icon">🧠</span>
            <span>AI Predictor</span>
            <span className="tab-new-pill">Interactive</span>
          </button>

          <button
            className={`nav-tab-btn ${satModalOpen ? "active" : ""}`}
            onClick={() => setSatModalOpen(true)}
            title="View India historical satellite radar flood imagery"
          >
            <span className="tab-icon">🛰️</span>
            <span>Satellite Archive</span>
          </button>

          <button
            className="nav-tab-btn"
            onClick={() => setLayersPanelOpen((prev) => !prev)}
            title="Toggle terrain, infrastructure and hydrology layers"
          >
            <span className="tab-icon">⚙️</span>
            <span>Layers</span>
          </button>
        </nav>

        {/* Hotspots Quick Jumper */}
        <div className="hotspots-quick-bar">
          <span className="hotspots-label">📍 Hotspots:</span>
          {NILGIRIS_HOTSPOTS.map((h) => (
            <button
              key={h.name}
              className={`hotspot-chip ${district.toLowerCase().includes(h.loc.toLowerCase()) ? "active" : ""}`}
              onClick={() => {
                if (onQuickCity) onQuickCity(h.loc);
                if (onLocationSelect) onLocationSelect({ lat: h.coords[0], lon: h.coords[1], zoom: h.zoom, name: h.name });
              }}
            >
              {h.name}
            </button>
          ))}
        </div>

        {/* Mode Toggle (Live vs Simulation) */}
        <div className="header-mode-toggle">
          <button
            className={`mode-btn ${mode === "realtime" ? "active" : ""}`}
            onClick={() => setMode("realtime")}
          >
            <span className="dot realtime-dot"></span> Live EOC
          </button>
          <button
            className={`mode-btn ${mode === "simulation" ? "active" : ""}`}
            onClick={() => setMode("simulation")}
          >
            <span className="dot sim-dot"></span> Simulation
          </button>
        </div>
      </header>

      {/* ── Search Bar (Top Left below Header) ── */}
      <WindySearch
        onSelectLocation={onLocationSelect}
        onSearchSubmit={onSearchSubmit}
        onQuickCity={onQuickCity}
        loading={loading}
      />

      {/* ── Right Weather Sidebar (Rain, Wind, Soil, Temp) ── */}
      <WindyRightSidebar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        onMoreLayers={() => setLayersPanelOpen((o) => !o)}
      />

      {/* ── Layers Control Drawer ── */}
      {layersPanelOpen && (
        <WindyLayersPanel
          onClose={() => setLayersPanelOpen(false)}
          riskVisible={riskVisible}
          onRiskToggle={setRiskVisible}
          windParticlesVisible={windParticlesVisible}
          onWindParticlesToggle={setWindParticlesVisible}
          radarLoopVisible={radarLoopVisible}
          onRadarLoopToggle={setRadarLoopVisible}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
          osmInfra={osmInfra}
          onOsmInfraToggle={handleOsmInfraToggle}
        />
      )}

      {/* ── Floating Atmospheric Info Panel ── */}
      <WindyInfoPanel activeFilter={activeFilter} center={clickedPos || center} />

      {/* ── Active Historical Satellite Overlay Card ── */}
      {activeHistoricalEvent && (
        <SatelliteMetadataCard event={activeHistoricalEvent} onClose={onClearHistoricalEvent} />
      )}

      {/* ── AI Pipeline Info Card ── */}
      {showAiInfo && (
        <div className="w-ai-info-modal">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#38bdf8", fontSize: "14px" }}>🧠 HydraMind Multi-Model AI Pipeline</strong>
            <button className="w-layers-close" onClick={() => setShowAiInfo(false)}>✕</button>
          </div>
          <p style={{ margin: "8px 0", fontSize: "12px", color: "#cbd5e1" }}>
            Real-time ensemble of <strong>LSTM Time-Series</strong> (35% rainfall trends) + <strong>XGBoost Geospatial Classifier</strong> (65% 150m grid terrain & soil susceptibility) + <strong>U-Net Segmentation</strong> (Sentinel-1 SAR inundation).
          </p>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            Active Forecast Model: <strong>{activeModel.toUpperCase()}</strong> | Territory: <strong>{district}</strong>
          </div>
        </div>
      )}

      {/* ── Bottom Precision Map Keys & Legend (Exact %, Colors & Danger Pulse) ── */}
      <PrecisionLegend activeFilter={activeFilter} blinkingActive={riskVisible} />

      {/* ── Simulation Timeline Bar (Only in Simulation Mode) ── */}
      {mode === "simulation" && <WindyBottomBar onStepChange={setActiveForecastStep} />}

      {/* ── Live Evacuation & Risk Guidance Command Center ── */}
      {mode === "realtime" && (
        <LiveEvacuationPanel
          center={center}
          onSelectLocation={onLocationSelect}
          onToggleRisk={() => setRiskVisible((r) => !r)}
        />
      )}

      {/* ── Bottom-Right Control Cluster ── */}
      <div className="w-bottom-right">
        <button className="w-ctrl-btn" onClick={handleZoomIn} title="Zoom In (＋)">＋</button>
        <div className="w-ctrl-divider" />
        <button className="w-ctrl-btn" onClick={handleZoomOut} title="Zoom Out (−)">−</button>
        <div className="w-ctrl-divider" />
        <button className={`w-ctrl-btn ${showAiInfo ? "active" : ""}`} onClick={() => setShowAiInfo((s) => !s)} title="AI Pipeline Architecture (ℹ)">ℹ</button>
        <div className="w-ctrl-divider" />
        <button className="w-ctrl-btn" onClick={handleToggleFullscreen} title="Toggle Fullscreen Mode (⛶)">⛶</button>
      </div>

      {/* ── Forecast Numerical Model Selector ── */}
      <div className="w-model-bar">
        <button className={`w-model-btn ${activeModel === "ecmwf" ? "active" : ""}`} onClick={() => setActiveModel("ecmwf")}>
          ECMWF <span style={{ fontSize: 9, opacity: 0.6 }}>9km</span>
        </button>
        <button className={`w-model-btn ${activeModel === "gfs" ? "active" : ""}`} onClick={() => setActiveModel("gfs")}>
          GFS <span style={{ fontSize: 9, opacity: 0.6 }}>22km</span>
        </button>
        <button className={`w-model-btn ${activeModel === "icon" ? "active" : ""}`} onClick={() => setActiveModel("icon")}>
          ICON <span style={{ fontSize: 9, opacity: 0.6 }}>13km</span>
        </button>
      </div>

      {/* ── Historical Satellite Archive Modal ── */}
      <SatelliteArchiveModal
        isOpen={satModalOpen}
        onClose={() => setSatModalOpen(false)}
        onSelectHistoricalEvent={onSelectHistoricalEvent}
      />

      {/* ── Executive Risk Summary Modal ── */}
      <RiskSummaryModal
        isOpen={riskSummaryOpen}
        onClose={() => setRiskSummaryOpen(false)}
        riskData={riskData}
        district={district}
      />

      {/* ── Interactive Input-Based AI Predictor Modal ── */}
      <AIPredictorModal
        isOpen={predictorOpen}
        onClose={() => setPredictorOpen(false)}
        onApplyToMap={(scenario) => {
          // When scenario is applied, center on a high-risk Nilgiris hotspot like Coonoor
          if (onQuickCity) onQuickCity("Coonoor");
          setRiskVisible(true);
        }}
      />

      {/* ── Global View Scale Banner ── */}
      {mapZoom <= 6 && (
        <div className="w-global-view-banner">
          🌍 GLOBAL ATMOSPHERIC VIEW • Select search result or city to auto-zoom to local neighborhood
        </div>
      )}

      {/* ── Leaflet Map Container ── */}
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={3}
        maxZoom={19}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <MapController center={center} zoom={zoom} mapRef={mapRef} setMapZoom={setMapZoom} />
        <MapClickHandler setClickedPos={setClickedPos} />
        <TileLayer
          key={mapStyle}
          url={currentTile.url}
          maxZoom={currentTile.maxZoom}
          maxNativeZoom={currentTile.maxNativeZoom}
          noWrap={true}
          subdomains="abc"
          className={currentTile.className ?? ""}
        />

        {/* Dynamic Weather & Atmospheric Layers */}
        {activeFilter === "wind" && windParticlesVisible && (
          mode === "simulation" ? (
            <WindParticleLayer forecastStep={activeForecastStep} center={center} mode={mode} />
          ) : (
            <WindHeatmapLayer />
          )
        )}
        {activeFilter === "rain" && (
          mode === "simulation" ? (
            <GlobalRainLayer forecastStep={activeForecastStep} />
          ) : (
            <RainRadarLayer center={center} />
          )
        )}
        {activeFilter === "temp" && <TempHeatmapLayer center={center} />}
        {activeFilter === "soil" && <SoilMoistureLayer center={center} />}
        {radarLoopVisible && mode === "realtime" && <RadarAnimationPlayer isPlaying={true} />}

        {/* Infrastructure & Emergency Shelters */}
        <OSMInfrastructureLayer district={district} center={center} visibleTypes={osmInfra} riskData={riskData} />

        {/* Satellite Historical Inundation Polygons */}
        <SatellitePolygonLayer polygons={activeHistoricalEvent?.inundation_polygons} forecastStep={activeForecastStep} />

        {/* High-Precision Risk Heatmap with Blinking Danger Cells & Pulsing Hazard Beacons */}
        {riskVisible && <RiskHeatmap data={riskData?.risk_map} />}

        <WindyPicker activeFilter={activeFilter} />
      </MapContainer>
    </div>
  );
}
