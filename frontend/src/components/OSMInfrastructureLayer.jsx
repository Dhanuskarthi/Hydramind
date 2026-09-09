import React, { useMemo } from "react";
import { Marker, Popup, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";

/**
 * World-Level Infrastructure Layer with compact circular pin icons.
 * Covers major cities across ALL continents.
 * Includes evacuation routing from affected areas to nearest safe centers.
 */

// ── Compact Icon Factory ──
function createIcon(type) {
  const config = {
    hospital: { emoji: "🏥", bg: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", border: "#fca5a5", glow: "rgba(239,68,68,0.5)" },
    shelter:  { emoji: "🛡️", bg: "linear-gradient(135deg, #10b981 0%, #047857 100%)", border: "#6ee7b7", glow: "rgba(16,185,129,0.5)" },
    fire:     { emoji: "🚒", bg: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)", border: "#fed7aa", glow: "rgba(249,115,22,0.5)" },
    police:   { emoji: "🚔", bg: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", border: "#93c5fd", glow: "rgba(59,130,246,0.5)" },
  };
  const c = config[type];
  return L.divIcon({
    className: "infra-pin",
    html: `<div class="infra-dot" style="
      width:30px;height:30px;background:${c.bg};border:2px solid ${c.border};
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:15px;box-shadow:0 2px 8px ${c.glow},0 0 0 3px rgba(0,0,0,0.3);
      cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;">
      <span style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))">${c.emoji}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -19],
  });
}

const ICONS = {
  hospital: createIcon("hospital"),
  shelter: createIcon("shelter"),
  fire: createIcon("fire"),
  police: createIcon("police"),
};

// ── WORLD-LEVEL INFRASTRUCTURE DATABASE ──
const WORLD_INFRASTRUCTURE = {
  // ═══ INDIA ═══
  chennai: {
    hospitals: [
      { name: "Government General Hospital", lat: 13.0818, lon: 80.2785, beds: 3000, status: "OPERATIONAL" },
      { name: "Apollo Hospital Greams Rd", lat: 13.0604, lon: 80.2520, beds: 600, status: "OPERATIONAL" },
      { name: "MGM Healthcare", lat: 13.0725, lon: 80.2185, beds: 400, status: "ALERT" },
      { name: "Fortis Malar Hospital", lat: 13.0076, lon: 80.2568, beds: 250, status: "ELEVATED RISK" },
      { name: "Sri Ramachandra Hospital", lat: 13.0411, lon: 80.1442, beds: 800, status: "OPERATIONAL" },
    ],
    shelters: [
      { name: "Kotturpuram Relief Center", lat: 13.0235, lon: 80.2415, cap: 1200 },
      { name: "Velachery School Shelter", lat: 12.9815, lon: 80.2180, cap: 850 },
      { name: "Adyar High School Refuge", lat: 13.0062, lon: 80.2512, cap: 950 },
      { name: "YMCA Nandanam Center", lat: 13.0335, lon: 80.2365, cap: 600 },
      { name: "Guindy Community Hall", lat: 13.0048, lon: 80.2168, cap: 750 },
    ],
    fireStations: [
      { name: "Kilpauk Fire Station", lat: 13.0785, lon: 80.2410 },
      { name: "Mylapore Fire Station", lat: 13.0335, lon: 80.2690 },
      { name: "Velachery Fire Station", lat: 12.9780, lon: 80.2220 },
    ],
    police: [{ name: "Chennai Police HQ", lat: 13.0825, lon: 80.2750 }],
    rivers: [
      [[13.0125, 80.1850], [13.0180, 80.2150], [13.0195, 80.2400], [13.0090, 80.2720]],
      [[13.0750, 80.2000], [13.0710, 80.2450], [13.0680, 80.2800]],
    ],
  },
  mumbai: {
    hospitals: [
      { name: "KEM Hospital", lat: 19.0012, lon: 72.8428, beds: 1800, status: "OPERATIONAL" },
      { name: "Lilavati Hospital", lat: 19.0510, lon: 72.8290, beds: 323, status: "OPERATIONAL" },
      { name: "Sion Hospital", lat: 19.0412, lon: 72.8660, beds: 1200, status: "ALERT" },
    ],
    shelters: [
      { name: "Dharavi Community Hall", lat: 19.0420, lon: 72.8530, cap: 2000 },
      { name: "Bandra Relief Center", lat: 19.0596, lon: 72.8295, cap: 1500 },
    ],
    fireStations: [{ name: "Byculla Fire Brigade", lat: 18.9760, lon: 72.8320 }],
    police: [{ name: "Mumbai Police HQ", lat: 18.9328, lon: 72.8330 }],
    rivers: [],
  },
  delhi: {
    hospitals: [
      { name: "AIIMS New Delhi", lat: 28.5672, lon: 77.2100, beds: 2500, status: "OPERATIONAL" },
      { name: "Safdarjung Hospital", lat: 28.5682, lon: 77.2025, beds: 1600, status: "OPERATIONAL" },
    ],
    shelters: [{ name: "Rajghat Flood Relief", lat: 28.6406, lon: 77.2487, cap: 5000 }],
    fireStations: [{ name: "CP Fire Station", lat: 28.6315, lon: 77.2167 }],
    police: [{ name: "Delhi Police HQ", lat: 28.6260, lon: 77.2358 }],
    rivers: [[[28.72, 77.18], [28.68, 77.22], [28.65, 77.25], [28.60, 77.28]]],
  },
  kolkata: {
    hospitals: [{ name: "SSKM Hospital", lat: 22.5349, lon: 88.3413, beds: 1775, status: "OPERATIONAL" }],
    shelters: [{ name: "Salt Lake Stadium", lat: 22.5731, lon: 88.4095, cap: 10000 }],
    fireStations: [{ name: "Central Fire Station", lat: 22.5705, lon: 88.3633 }],
    police: [], rivers: [[[22.60, 88.28], [22.57, 88.33], [22.54, 88.36]]],
  },
  bengaluru: {
    hospitals: [{ name: "Victoria Hospital", lat: 12.9582, lon: 77.5737, beds: 950, status: "OPERATIONAL" }],
    shelters: [{ name: "Cubbon Park Shelter", lat: 12.9763, lon: 77.5929, cap: 2000 }],
    fireStations: [{ name: "Brigade Rd Fire Stn", lat: 12.9698, lon: 77.6047 }],
    police: [], rivers: [],
  },
  hyderabad: {
    hospitals: [{ name: "Osmania General Hospital", lat: 17.3680, lon: 78.4769, beds: 1168, status: "OPERATIONAL" }],
    shelters: [{ name: "Musi River Camp", lat: 17.3717, lon: 78.4915, cap: 2500 }],
    fireStations: [{ name: "Abids Fire Station", lat: 17.3923, lon: 78.4740 }],
    police: [], rivers: [[[17.39, 78.36], [17.38, 78.42], [17.37, 78.48]]],
  },
  kerala: {
    hospitals: [{ name: "Govt Medical College Kochi", lat: 9.9896, lon: 76.3020, beds: 2500, status: "OPERATIONAL" }],
    shelters: [{ name: "Aluva Relief Camp", lat: 10.1100, lon: 76.3575, cap: 3000 }],
    fireStations: [{ name: "Ernakulam Fire Stn", lat: 9.9816, lon: 76.2999 }],
    police: [], rivers: [[[10.18, 76.20], [10.14, 76.30], [10.08, 76.35]]],
  },

  // ═══ SOUTHEAST ASIA ═══
  dhaka: {
    hospitals: [{ name: "Dhaka Medical College", lat: 23.7262, lon: 90.3971, beds: 2300, status: "OPERATIONAL" }],
    shelters: [{ name: "Mirpur Stadium Shelter", lat: 23.8068, lon: 90.3656, cap: 8000 }],
    fireStations: [{ name: "Dhaka Central Fire", lat: 23.7280, lon: 90.4050 }],
    police: [], rivers: [[[23.78, 90.35], [23.74, 90.40], [23.70, 90.42]]],
  },
  bangkok: {
    hospitals: [{ name: "Siriraj Hospital", lat: 13.7579, lon: 100.4845, beds: 2300, status: "OPERATIONAL" }],
    shelters: [{ name: "Sanam Luang Shelter", lat: 13.7540, lon: 100.4933, cap: 3000 }],
    fireStations: [{ name: "Bangkok Fire Dept", lat: 13.7530, lon: 100.5030 }],
    police: [], rivers: [[[13.80, 100.47], [13.76, 100.50], [13.72, 100.52]]],
  },
  manila: {
    hospitals: [{ name: "Philippine General Hospital", lat: 14.5768, lon: 120.9843, beds: 1500, status: "OPERATIONAL" }],
    shelters: [{ name: "Rizal Memorial Center", lat: 14.5637, lon: 120.9905, cap: 5000 }],
    fireStations: [{ name: "Manila Central Fire", lat: 14.5900, lon: 120.9810 }],
    police: [], rivers: [],
  },

  // ═══ AMERICAS ═══
  houston: {
    hospitals: [
      { name: "Texas Medical Center", lat: 29.7069, lon: -95.3994, beds: 9200, status: "OPERATIONAL" },
      { name: "Memorial Hermann", lat: 29.7096, lon: -95.4006, beds: 1068, status: "OPERATIONAL" },
    ],
    shelters: [
      { name: "NRG Center Hurricane Shelter", lat: 29.6847, lon: -95.4107, cap: 10000 },
      { name: "George R Brown Convention", lat: 29.7516, lon: -95.3562, cap: 8000 },
    ],
    fireStations: [{ name: "Houston Fire Dept HQ", lat: 29.7540, lon: -95.3592 }],
    police: [{ name: "Houston Police HQ", lat: 29.7546, lon: -95.3572 }],
    rivers: [[[29.77, -95.42], [29.75, -95.38], [29.73, -95.34], [29.70, -95.30]]],
  },
  neworleans: {
    hospitals: [{ name: "Ochsner Medical Center", lat: 29.9419, lon: -90.1275, beds: 888, status: "OPERATIONAL" }],
    shelters: [{ name: "Superdome Emergency Shelter", lat: 29.9511, lon: -90.0812, cap: 20000 }],
    fireStations: [{ name: "NOFD Central", lat: 29.9540, lon: -90.0720 }],
    police: [], rivers: [[[29.97, -90.14], [29.95, -90.08], [29.93, -90.03]]],
  },
  miami: {
    hospitals: [{ name: "Jackson Memorial Hospital", lat: 25.7897, lon: -80.2107, beds: 1550, status: "OPERATIONAL" }],
    shelters: [{ name: "Miami-Dade Fairgrounds", lat: 25.7050, lon: -80.3900, cap: 6000 }],
    fireStations: [{ name: "Miami Fire Rescue HQ", lat: 25.7750, lon: -80.1950 }],
    police: [], rivers: [],
  },

  // ═══ EAST ASIA ═══
  tokyo: {
    hospitals: [{ name: "University of Tokyo Hospital", lat: 35.7126, lon: 139.7634, beds: 1217, status: "OPERATIONAL" }],
    shelters: [{ name: "Tokyo Dome Shelter", lat: 35.7056, lon: 139.7519, cap: 55000 }],
    fireStations: [{ name: "Tokyo Fire Dept HQ", lat: 35.6707, lon: 139.7516 }],
    police: [{ name: "Tokyo Metropolitan Police", lat: 35.6764, lon: 139.7529 }],
    rivers: [[[35.73, 139.72], [35.71, 139.76], [35.69, 139.79]]],
  },
  shanghai: {
    hospitals: [{ name: "Zhongshan Hospital", lat: 31.2000, lon: 121.4500, beds: 1800, status: "OPERATIONAL" }],
    shelters: [{ name: "Shanghai Stadium Shelter", lat: 31.1817, lon: 121.4406, cap: 56000 }],
    fireStations: [{ name: "Shanghai Fire Bureau", lat: 31.2304, lon: 121.4737 }],
    police: [], rivers: [[[31.28, 121.43], [31.24, 121.47], [31.20, 121.50]]],
  },

  // ═══ EUROPE ═══
  london: {
    hospitals: [{ name: "Royal London Hospital", lat: 51.5189, lon: -0.0577, beds: 825, status: "OPERATIONAL" }],
    shelters: [{ name: "ExCeL Emergency Shelter", lat: 51.5087, lon: 0.0299, cap: 5000 }],
    fireStations: [{ name: "London Fire Brigade HQ", lat: 51.4953, lon: -0.1235 }],
    police: [{ name: "Scotland Yard", lat: 51.5005, lon: -0.1246 }],
    rivers: [[[51.51, -0.14], [51.50, -0.08], [51.50, -0.02], [51.50, 0.03]]],
  },
  amsterdam: {
    hospitals: [{ name: "AMC Hospital", lat: 52.2945, lon: 4.9585, beds: 1002, status: "OPERATIONAL" }],
    shelters: [{ name: "RAI Convention Center", lat: 52.3406, lon: 4.8880, cap: 4000 }],
    fireStations: [{ name: "Brandweer Amsterdam", lat: 52.3480, lon: 4.9100 }],
    police: [], rivers: [],
  },

  // ═══ OCEANIA ═══
  sydney: {
    hospitals: [{ name: "Royal Prince Alfred Hospital", lat: -33.8890, lon: 151.1809, beds: 900, status: "OPERATIONAL" }],
    shelters: [{ name: "Sydney Olympic Park", lat: -33.8466, lon: 151.0693, cap: 80000 }],
    fireStations: [{ name: "City of Sydney Fire", lat: -33.8688, lon: 151.2093 }],
    police: [], rivers: [],
  },

  // ═══ AFRICA ═══
  lagos: {
    hospitals: [{ name: "Lagos University Hospital", lat: 6.5175, lon: 3.3933, beds: 800, status: "OPERATIONAL" }],
    shelters: [{ name: "Teslim Balogun Stadium", lat: 6.4472, lon: 3.3619, cap: 24000 }],
    fireStations: [{ name: "Lagos State Fire Service", lat: 6.4500, lon: 3.3900 }],
    police: [], rivers: [[[6.55, 3.35], [6.50, 3.39], [6.46, 3.42]]],
  },
  capetown: {
    hospitals: [{ name: "Groote Schuur Hospital", lat: -33.9410, lon: 18.4626, beds: 893, status: "OPERATIONAL" }],
    shelters: [{ name: "Cape Town Stadium", lat: -33.9034, lon: 18.4366, cap: 55000 }],
    fireStations: [{ name: "Cape Town Fire & Rescue", lat: -33.9249, lon: 18.4241 }],
    police: [], rivers: [],
  },
};

// ── Evacuation Routes (affected area → nearest safe center) ──
const EVACUATION_ROUTES = [
  { id: "evac-1", from: "Velachery Flood Zone", to: "Adyar High School Refuge",
    priority: 1, path: [[12.982, 80.218], [12.988, 80.228], [12.995, 80.238], [13.002, 80.248], [13.006, 80.251]] },
  { id: "evac-2", from: "Adyar River Basin", to: "Kotturpuram Relief Center",
    priority: 1, path: [[13.010, 80.225], [13.015, 80.232], [13.020, 80.238], [13.024, 80.242]] },
  { id: "evac-3", from: "Mylapore Low Area", to: "YMCA Nandanam Center",
    priority: 2, path: [[13.034, 80.269], [13.034, 80.258], [13.034, 80.248], [13.034, 80.237]] },
  { id: "evac-4", from: "Guindy Industrial Zone", to: "Guindy Community Hall",
    priority: 2, path: [[13.008, 80.208], [13.006, 80.212], [13.005, 80.217]] },
];

function infraPopup(type, item) {
  const t = {
    hospital: { icon: "🏥", label: "Hospital", color: "#ef4444" },
    shelter:  { icon: "🛡️", label: "Safe Refuge", color: "#10b981" },
    fire:     { icon: "🚒", label: "Fire & Rescue", color: "#f97316" },
    police:   { icon: "🚔", label: "Command Center", color: "#3b82f6" },
  }[type];
  const sc = item.status === "OPERATIONAL" ? "#10b981" : item.status === "ALERT" ? "#f59e0b" : "#ef4444";
  return `<div style="font-family:'Inter',sans-serif;padding:8px;min-width:190px;">
    <span style="background:${t.color};color:#fff;font-size:9px;font-weight:800;padding:3px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.5px">${t.icon} ${t.label}</span>
    <h4 style="margin:6px 0 4px;font-size:13px;font-weight:700;color:#f8fafc">${item.name}</h4>
    ${item.beds ? `<p style="margin:2px 0;font-size:11px;color:#94a3b8"><b style="color:#e2e8f0">Capacity:</b> ${item.beds} beds</p>` : ""}
    ${item.cap ? `<p style="margin:2px 0;font-size:11px;color:#94a3b8"><b style="color:#e2e8f0">Capacity:</b> ${item.cap} persons</p>` : ""}
    ${item.status ? `<p style="margin:2px 0;font-size:11px;color:#94a3b8"><b style="color:#e2e8f0">Status:</b> <span style="color:${sc};font-weight:700">${item.status}</span></p>` : ""}
    <div style="margin-top:5px;font-size:8px;font-weight:700;color:#0284c7;background:rgba(2,132,199,.12);padding:2px 7px;border-radius:8px;display:inline-block;text-transform:uppercase">📡 OpenStreetMap</div>
  </div>`;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function OSMInfrastructureLayer({ district = "Chennai", center = [13.0827, 80.2707], visibleTypes = {}, riskData }) {
  const cLat = center?.[0] ?? 13.0827;
  const cLon = center?.[1] ?? 80.2707;

  // Select nearest real city's land infrastructure so NO pins drop in open water
  const activeInfra = useMemo(() => {
    let closestKey = "chennai";
    let minDist = Infinity;

    Object.entries(WORLD_INFRASTRUCTURE).forEach(([key, city]) => {
      const firstLoc = city.hospitals?.[0] || city.shelters?.[0];
      if (firstLoc) {
        const d = getDistanceKm(cLat, cLon, firstLoc.lat, firstLoc.lon);
        if (d < minDist) {
          minDist = d;
          closestKey = key;
        }
      }
    });

    return WORLD_INFRASTRUCTURE[closestKey] || WORLD_INFRASTRUCTURE.chennai;
  }, [cLat, cLon]);

  const backendH = riskData?.affected_areas?.infrastructure?.hospitals_at_risk || [];
  const backendS = riskData?.affected_areas?.infrastructure?.evacuation_assets || [];

  const hospitals = backendH.length > 0 ? backendH.map(h => ({
    name: h.name, lat: h.geometry?.coordinates?.[1] ?? cLat, lon: h.geometry?.coordinates?.[0] ?? cLon,
    beds: "Live", status: h.status || "UNKNOWN"
  })) : (activeInfra.hospitals || []);

  const shelters = backendS.length > 0 ? backendS.map(s => ({
    name: s.name || "Shelter", lat: s.geometry?.coordinates?.[1] ?? cLat, lon: s.geometry?.coordinates?.[0] ?? cLon, cap: "TBD"
  })) : (activeInfra.shelters || []);

  const fireStations = activeInfra.fireStations || [];
  const police = activeInfra.police || [];
  const rivers = activeInfra.rivers || [];

  const showH = visibleTypes.hospitals !== false;
  const showS = visibleTypes.shelters !== false;
  const showF = visibleTypes.fire !== false;
  const showR = visibleTypes.rivers !== false;

  return (
    <>
      {showR && rivers.map((c, i) => (
        <Polyline key={`r-${i}`} positions={c}
          pathOptions={{ color: "#00b4d8", weight: 4, opacity: 0.7, dashArray: "8,4", lineCap: "round" }}>
          <Popup><div style={{ fontFamily: "'Inter',sans-serif", padding: "6px" }}>
            <span style={{ background: "#0284c7", color: "#fff", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 10 }}>🌊 HYDROLOGY</span>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8" }}>River/Canal — OpenStreetMap</p>
          </div></Popup>
        </Polyline>
      ))}

      {showH && hospitals.map((h, i) => (
        <Marker key={`h-${i}`} position={[h.lat, h.lon]} icon={ICONS.hospital}>
          <Popup><div dangerouslySetInnerHTML={{ __html: infraPopup("hospital", h) }} /></Popup>
        </Marker>
      ))}

      {showS && shelters.map((s, i) => (
        <Marker key={`s-${i}`} position={[s.lat, s.lon]} icon={ICONS.shelter}>
          <Popup><div dangerouslySetInnerHTML={{ __html: infraPopup("shelter", s) }} /></Popup>
        </Marker>
      ))}

      {showF && fireStations.map((f, i) => (
        <Marker key={`f-${i}`} position={[f.lat, f.lon]} icon={ICONS.fire}>
          <Popup><div dangerouslySetInnerHTML={{ __html: infraPopup("fire", f) }} /></Popup>
        </Marker>
      ))}

      {police.map((p, i) => (
        <Marker key={`p-${i}`} position={[p.lat, p.lon]} icon={ICONS.police}>
          <Popup><div dangerouslySetInnerHTML={{ __html: infraPopup("police", p) }} /></Popup>
        </Marker>
      ))}

      {EVACUATION_ROUTES.map((route) => (
        <React.Fragment key={route.id}>
          <Polyline positions={route.path}
            pathOptions={{ color: route.priority === 1 ? "#00f0ff" : "#a78bfa", weight: route.priority === 1 ? 4 : 3, opacity: 0.85, dashArray: "10,6", lineCap: "round" }}>
            <Popup><div style={{ fontFamily: "'Inter',sans-serif", padding: "8px", minWidth: 190 }}>
              <span style={{ background: route.priority === 1 ? "#00f0ff" : "#a78bfa", color: "#0f172a", fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 10, textTransform: "uppercase" }}>⚡ P{route.priority} EVACUATION</span>
              <p style={{ margin: "4px 0", fontSize: 12, color: "#f8fafc", fontWeight: 700 }}>{route.from} → {route.to}</p>
            </div></Popup>
          </Polyline>
          <CircleMarker center={route.path[0]} radius={5}
            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }} />
          <CircleMarker center={route.path[route.path.length - 1]} radius={6}
            pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.9, weight: 2 }} />
        </React.Fragment>
      ))}
    </>
  );
}
