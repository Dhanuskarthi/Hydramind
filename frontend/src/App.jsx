import React, { useEffect, useState } from "react";
import MapView from "./components/MapView.jsx";
import { fetchRiskMap, fetchAlerts, fetchVillages } from "./services/api.js";

const DEFAULT_DISTRICT = "Nilgiris";
const REFRESH_MS = 2 * 60 * 1000;

const DISTRICT_COORDS = {
  nilgiris: { lat: 11.4064, lon: 76.6932, zoom: 11 },
  "the nilgiris": { lat: 11.4064, lon: 76.6932, zoom: 11 },
  ooty: { lat: 11.4064, lon: 76.6932, zoom: 12 },
  coonoor: { lat: 11.3530, lon: 76.7959, zoom: 12 },
  kotagiri: { lat: 11.4229, lon: 76.8641, zoom: 12 },
  kallar: { lat: 11.3667, lon: 76.8833, zoom: 13 },
  chennai: { lat: 13.0827, lon: 80.2707, zoom: 11 },
  mumbai: { lat: 19.0760, lon: 72.8777, zoom: 11 },
  kerala: { lat: 10.8505, lon: 76.2711, zoom: 9 },
  delhi: { lat: 28.6139, lon: 77.2090, zoom: 11 },
  kolkata: { lat: 22.5726, lon: 88.3639, zoom: 11 },
  bengaluru: { lat: 12.9716, lon: 77.5946, zoom: 11 },
  hyderabad: { lat: 17.3850, lon: 78.4867, zoom: 11 },
};

export default function App() {
  const [district, setDistrict] = useState(DEFAULT_DISTRICT);
  const [customCenter, setCustomCenter] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeHistoricalEvent, setActiveHistoricalEvent] = useState(null);

  async function loadAll(d) {
    setLoading(true);
    setError(null);
    try {
      const [risk, alertList, villageData] = await Promise.all([
        fetchRiskMap(d),
        fetchAlerts(),
        fetchVillages(d),
      ]);
      setRiskData(risk);
      setAlerts(alertList);
      setVillages(villageData.villages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(district);
    const interval = setInterval(() => loadAll(district), REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  const handleLocationSelect = (loc) => {
    if (!loc) return;
    let lat, lon, name;
    if (Array.isArray(loc)) {
      lat = loc[0];
      lon = loc[1];
      name = "Selected Region";
    } else if (typeof loc === "object") {
      lat = loc.lat ?? loc.latitude;
      lon = loc.lon ?? loc.lng ?? loc.longitude;
      name = loc.name || loc.cityName || "Selected Region";
    }

    if (typeof lat === "number" && !isNaN(lat) && typeof lon === "number" && !isNaN(lon)) {
      if (name) setDistrict(name);
      setCustomCenter({ lat, lon, zoom: loc?.zoom || 11 });
      setActiveHistoricalEvent(null);
      if (name) loadAll(name);
    }
  };

  const handleSearchSubmit = (val) => {
    setDistrict(val);
    const dKey = val.trim().toLowerCase();
    const preset = DISTRICT_COORDS[dKey];
    if (preset) {
      setCustomCenter({ lat: preset.lat, lon: preset.lon, zoom: 13 });
    } else {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=1`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data[0]) {
            setCustomCenter({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), zoom: 14 });
          }
        })
        .catch(() => {});
    }
    setActiveHistoricalEvent(null);
    loadAll(val);
  };

  const handleQuickCity = (city) => {
    setDistrict(city || "Nilgiris");
    const dKey = (city || "").trim().toLowerCase();
    const preset = DISTRICT_COORDS[dKey];
    if (preset) {
      setCustomCenter({ lat: preset.lat, lon: preset.lon, zoom: 13 });
    } else {
      setCustomCenter(null);
    }
    setActiveHistoricalEvent(null);
    loadAll(city || "Nilgiris");
  };

  const handleSelectHistoricalEvent = (event) => {
    setActiveHistoricalEvent(event);
    if (event && event.center) {
      setDistrict(event.district || "Nilgiris");
      setCustomCenter({ lat: event.center.lat, lon: event.center.lon, zoom: event.center.zoom || 12 });
      loadAll(event.district || "Nilgiris");
    }
  };

  const handleClearHistoricalEvent = () => {
    setActiveHistoricalEvent(null);
  };

  const dKey = (district || "Nilgiris").trim().toLowerCase();
  const preset = DISTRICT_COORDS[dKey];
  const coords = customCenter || preset || { lat: 11.4064, lon: 76.6932, zoom: 11 };

  return (
    <div className="windy-app">
      {/* Full-screen map fills viewport — all UI floats on top */}
      <MapView
        riskData={riskData}
        center={[coords.lat, coords.lon]}
        zoom={coords.zoom}
        district={district}
        onLocationSelect={handleLocationSelect}
        onSearchSubmit={handleSearchSubmit}
        onQuickCity={handleQuickCity}
        loading={loading}
        alerts={alerts}
        villages={villages}
        activeHistoricalEvent={activeHistoricalEvent}
        onSelectHistoricalEvent={handleSelectHistoricalEvent}
        onClearHistoricalEvent={handleClearHistoricalEvent}
      />
    </div>
  );
}
