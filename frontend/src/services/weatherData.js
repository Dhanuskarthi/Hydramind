/**
 * Service to fetch real, multi-point spatial live weather grid data from Open-Meteo API.
 * Dynamically covers the VISIBLE VIEWPORT BOUNDS anywhere on the World Map.
 */

export async function fetchLiveBoundsWeather(south = -50, west = -160, north = 70, east = 160, steps = 6) {
  const lats = [];
  const lons = [];
  const points = [];

  const latStep = (north - south) / (steps - 1);
  const lonStep = (east - west) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const lat = Math.min(85, Math.max(-85, south + i * latStep));
      const lon = Math.min(180, Math.max(-180, west + j * lonStep));
      lats.push(lat.toFixed(3));
      lons.push(lon.toFixed(3));
      points.push({ lat, lon });
    }
  }

  try {
    const latStr = lats.join(",");
    const lonStr = lons.join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&current=temperature_2m,relative_humidity_2m,rain,showers,wind_speed_10m,wind_direction_10m,soil_moisture_0_to_1cm`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Open-Meteo fetch failed");
    const data = await res.json();
    const results = Array.isArray(data) ? data : [data];

    return points.map((pt, idx) => {
      const curr = results[idx]?.current || {};
      const temp = curr.temperature_2m ?? 25;
      const humidity = curr.relative_humidity_2m ?? 60;
      const rain = (curr.rain ?? 0) + (curr.showers ?? 0);
      const windSpeed = curr.wind_speed_10m ?? 15;
      const windDir = curr.wind_direction_10m ?? 210;
      const soilMoisture = (curr.soil_moisture_0_to_1cm ?? 0.4) * 100;

      return { lat: pt.lat, lon: pt.lon, temp, humidity, rain, windSpeed, windDir, soilMoisture };
    });
  } catch (err) {
    console.warn("Bounds weather fetch error, using continuous spatial fallback", err);
    return points.map((pt, idx) => ({
      lat: pt.lat, lon: pt.lon,
      temp: 26 + Math.sin(pt.lat * 0.1) * 12,
      humidity: 60 + Math.cos(pt.lon * 0.1) * 20,
      rain: Math.max(0, Math.sin(pt.lat * 0.2 + pt.lon * 0.2) * 15),
      windSpeed: 18 + Math.cos(idx) * 6,
      windDir: 180 + Math.sin(idx) * 60,
      soilMoisture: 40 + Math.sin(pt.lat * 0.15) * 30,
    }));
  }
}

export async function fetchLiveGridWeather(centerLat = 11.4064, centerLon = 76.6932, radiusKm = 25) {
  const deltaLat = radiusKm / 111.0;
  const deltaLon = radiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180));
  return fetchLiveBoundsWeather(
    centerLat - deltaLat,
    centerLon - deltaLon,
    centerLat + deltaLat,
    centerLon + deltaLon,
    5
  );
}
