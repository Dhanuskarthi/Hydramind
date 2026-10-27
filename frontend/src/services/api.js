const BASE_URL = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (typeof window !== "undefined" && (window.location.port === "3001" || window.location.port === "3000") ? "http://localhost:8000" : "");

async function fetchWithTimeout(url, options = {}) {
  // Allow enough time (45s) for Render free-tier cold-starts to wake up without getting stuck
  const { timeout = 45000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function fetchRiskMap(district) {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/predict?district_name=${encodeURIComponent(district)}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Risk map predict failed: ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Backend warming up or offline, returning graceful fallback:", err.message);
    return {
      district: district,
      risk_map: { type: "FeatureCollection", features: [] },
      severity: { severity_score: 0.35, alert_level: "MONITORING" },
      affected_areas: { villages_at_risk: [], infrastructure: {} },
      rescue_priorities: [],
      alerts: []
    };
  }
}

export async function fetchAlerts() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/alerts`);
    if (!res.ok) throw new Error(`Alerts request failed: ${res.status}`);
    return res.json();
  } catch (err) {
    return [];
  }
}

export async function fetchVillages(district) {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/villages/${encodeURIComponent(district)}`);
    if (!res.ok) throw new Error(`Villages request failed: ${res.status}`);
    return res.json();
  } catch (err) {
    return { villages: [] };
  }
}

export async function fetchCurrentConditions(lat, lon) {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/current-conditions/${lat}/${lon}`);
    if (!res.ok) throw new Error(`Conditions request failed: ${res.status}`);
    return res.json();
  } catch (err) {
    return {};
  }
}

export async function fetchHistoricalSatellites() {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/historical-satellites`);
    if (!res.ok) throw new Error(`Historical satellites failed: ${res.status}`);
    return res.json();
  } catch (err) {
    return [];
  }
}

export async function fetchHistoricalSatelliteEvent(eventId) {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/v1/historical-satellites/${eventId}`);
    if (!res.ok) throw new Error(`Satellite event failed: ${res.status}`);
    return res.json();
  } catch (err) {
    return null;
  }
}
