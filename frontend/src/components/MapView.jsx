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
import WindyLegend from "./WindyLegend.jsx";
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

export default function MapView({
  center = [11.4064, 76.6932], zoom = 11, riskData, district = "Nilgiris",
  onLocationSelect, onSearchSubmit, onQuickCity, loading, alerts, villages,
  onSelectHistoricalEvent, activeHistoricalEvent, onClearHistoricalEvent,
}) {
  const [riskVisible, setRiskVisible] = useState(true);
  const [windParticlesVisible, setWindParticlesVisible] = useState(true);
  const [radarLoopVisible, setRadarLoopVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState("wind");
  const [mapStyle, setMapStyle] = useState("dark");
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [activeForecastStep, setActiveForecastStep] = useState(null);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [satModalOpen, setSatModalOpen] = useState(false);
  const [showAiInfo, setShowAiInfo] = useState(false);
  const [activeModel, setActiveModel] = useState("ecmwf");
  const [osmInfra, setOsmInfra] = useState({ hospitals: true, shelters: true, fire: false, rivers: true });
  const [clickedPos, setClickedPos] = useState(null);
  const [mode, setMode] = useState("simulation"); // "realtime" | "simulation"
  const mapRef = useRef(null);

  const handleOsmInfraToggle = (type, value) => setOsmInfra((p) => ({ ...p, [type]: value }));

  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
  };

  // Button actions (100% working functional buttons)
  const handleZoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const handleToggle3D = () => {
    setMapStyle((prev) => (prev === "satellite" ? "dark" : "satellite"));
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  const currentTile = TILE_LAYERS[mapStyle] || TILE_LAYERS.osm;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* ── Top-center Logo & Satellite Archive Trigger ── */}
      <div className="w-logo-container">
        <div className="w-logo">
          <span className="w-logo-icon">🌊</span>
          <span className="w-logo-text">HydraMind</span>
          <span className="w-logo-tag">.ai</span>
        </div>

        <button className="w-sat-archive-btn" onClick={() => setSatModalOpen(true)}>
          <span className="icon">🛰️</span>
          <span>India Satellite Flood Archive</span>
        </button>
      </div>

      {/* ── Top-left Search ── */}
      <WindySearch
        onSelectLocation={onLocationSelect}
        onSearchSubmit={onSearchSubmit}
        onQuickCity={onQuickCity}
        loading={loading}
      />

      {/* ── Top-right Mode Toggle (Real-time vs Simulation) ── */}
      <div className="w-mode-toggle">
        <button className={`w-mode-btn ${mode === "realtime" ? "active" : ""}`} onClick={() => setMode("realtime")}>
          <span className="dot realtime-dot"></span> Live Data
        </button>
        <button className={`w-mode-btn ${mode === "simulation" ? "active" : ""}`} onClick={() => setMode("simulation")}>
          <span className="dot sim-dot"></span> Cyclone Simulation
        </button>
      </div>

      {/* ── Right Sidebar (layer buttons) ── */}
      <WindyRightSidebar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        onMoreLayers={() => setLayersPanelOpen((o) => !o)}
      />

      {/* ── Layers Panel (expanded) ── */}
      {layersPanelOpen && (
        <WindyLayersPanel
          onClose={() => setLayersPanelOpen(false)}
          riskVisible={riskVisible} onRiskToggle={setRiskVisible}
          windParticlesVisible={windParticlesVisible} onWindParticlesToggle={setWindParticlesVisible}
          radarLoopVisible={radarLoopVisible} onRadarLoopToggle={setRadarLoopVisible}
          mapStyle={mapStyle} onMapStyleChange={setMapStyle}
          osmInfra={osmInfra} onOsmInfraToggle={handleOsmInfraToggle}
        />
      )}

      {/* ── Floating Info Panel ── */}
      <WindyInfoPanel activeFilter={activeFilter} center={clickedPos || center} />

      {/* ── Active Historical Satellite Overlay Card ── */}
      {activeHistoricalEvent && (
        <SatelliteMetadataCard event={activeHistoricalEvent} onClose={onClearHistoricalEvent} />
      )}

      {/* ── AI Pipeline Info Card Toggle ── */}
      {showAiInfo && (
        <div className="w-ai-info-modal">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#38bdf8", fontSize: "14px" }}>🧠 HydraMind Multi-Model AI Pipeline</strong>
            <button className="w-layers-close" onClick={() => setShowAiInfo(false)}>✕</button>
          </div>
          <p style={{ margin: "8px 0", fontSize: "12px", color: "#cbd5e1" }}>
            Real-time ensemble of <strong>LSTM Time-Series</strong> (rainfall trends) + <strong>XGBoost Classifier</strong> (150m grid terrain & soil susceptibility) + <strong>U-Net Segmentation</strong> (Sentinel-1 SAR inundation).
          </p>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            Active Forecast Resolution: <strong>{activeModel.toUpperCase()}</strong> | Active District: <strong>{district}</strong>
          </div>
        </div>
      )}

      {/* ── Bottom Legend ── */}
      <WindyLegend activeFilter={activeFilter} />

      {/* ── Bottom Timeline Bar (Only in Simulation Mode) ── */}
      {mode === "simulation" && <WindyBottomBar onStepChange={setActiveForecastStep} />}

      {/* ── Live Evacuation & Risk Guidance Command Center (Only in Real-Time Mode) ── */}
      {mode === "realtime" && (
        <LiveEvacuationPanel
          center={center}
          onSelectLocation={onLocationSelect}
          onToggleRisk={() => setRiskVisible((r) => !r)}
        />
      )}

      {/* ── Bottom-right Map Control Buttons (100% Functional) ── */}
      <div className="w-bottom-right">
        <button className="w-ctrl-btn" onClick={handleZoomIn} title="Zoom In (＋)">＋</button>
        <div className="w-ctrl-divider" />
        <button className="w-ctrl-btn" onClick={handleZoomOut} title="Zoom Out (−)">−</button>
        <div className="w-ctrl-divider" />
        <button className={`w-ctrl-btn ${showAiInfo ? "active" : ""}`} onClick={() => setShowAiInfo((s) => !s)} title="AI Pipeline Info (ℹ)">ℹ</button>
        <div className="w-ctrl-divider" />
        <button className="w-ctrl-btn" onClick={handleToggleFullscreen} title="Toggle Fullscreen Mode (⛶)">⛶</button>
      </div>

      {/* ── Forecast Model Selector Bar (100% Working) ── */}
      <div className="w-model-bar">
        <button className={`w-model-btn ${activeModel === "ecmwf" ? "active" : ""}`} onClick={() => setActiveModel("ecmwf")}>
          ECMWF <span style={{fontSize:9,opacity:0.6}}>9km</span>
        </button>
        <button className={`w-model-btn ${activeModel === "gfs" ? "active" : ""}`} onClick={() => setActiveModel("gfs")}>
          GFS <span style={{fontSize:9,opacity:0.6}}>22km</span>
        </button>
        <button className={`w-model-btn ${activeModel === "icon" ? "active" : ""}`} onClick={() => setActiveModel("icon")}>
          ICON <span style={{fontSize:9,opacity:0.6}}>13km</span>
        </button>
      </div>

      {/* ── Historical Satellite Archive Modal ── */}
      <SatelliteArchiveModal
        isOpen={satModalOpen}
        onClose={() => setSatModalOpen(false)}
        onSelectHistoricalEvent={onSelectHistoricalEvent}
      />

      {/* ── Global View Scale Banner ── */}
      {mapZoom <= 6 && (
        <div className="w-global-view-banner">
          🌍 GLOBAL ATMOSPHERIC VIEW • Select search result or city to auto-zoom to local neighborhood
        </div>
      )}

      {/* ── The Map ── */}
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
        <TileLayer key={mapStyle} url={currentTile.url} maxZoom={currentTile.maxZoom} maxNativeZoom={currentTile.maxNativeZoom} noWrap={true} subdomains="abc" className={currentTile.className ?? ""} />
        
        {/* Dynamic Layer Rendering based on Mode */}
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
        
        <OSMInfrastructureLayer district={district} center={center} visibleTypes={osmInfra} riskData={riskData} />
        
        {/* Render Low Floor Basin Inundation Polygons, Safe Refuge Havens & Evacuation Corridors */}
        <SatellitePolygonLayer polygons={activeHistoricalEvent?.inundation_polygons} forecastStep={activeForecastStep} />
        
        {riskVisible && <RiskHeatmap data={riskData?.risk_map} />}
        <WindyPicker activeFilter={activeFilter} />
      </MapContainer>
    </div>
  );
}
