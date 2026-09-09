const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function fetchWithTimeout(url, options = {}) {
  const { timeout = 3000 } = options;
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
    console.warn("Backend AI engine offline, returning mock data");
    return [];
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
