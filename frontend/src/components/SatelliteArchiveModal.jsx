import React, { useEffect, useState } from "react";
import { fetchHistoricalSatellites, fetchHistoricalSatelliteEvent } from "../services/api.js";

const DEFAULT_SATELLITE_CATALOG = [
  {
    id: "chennai_2015",
    title: "Chennai Historic Floods (Dec 2015)",
    district: "Chennai",
    state: "Tamil Nadu",
    date: "2015-12-01",
    sensor: "Sentinel-1A SAR C-Band (IW)",
    provider: "ESA Copernicus / ISRO Bhuvan",
    flood_extent_sqkm: 348.5,
    rainfall_max_mm: 494.0,
    center: { lat: 13.0827, lon: 80.2707, zoom: 12 },
    satellite: {
      sensor: "Sentinel-1A SAR C-Band (IW Mode)",
      provider: "ESA Copernicus Open Access / ISRO Bhuvan",
      resolution: "10m SAR Dual-Pol (VV/VH)",
      pass_date: "2015-12-03T06:12:00Z",
      flood_extent_sqkm: 348.5,
      affected_pop_est: 1850000,
      download_url: "https://scihub.copernicus.eu/",
    },
    soil_moisture_pct: 94.5,
    description: "Unprecedented monsoon deluge causing severe overflow of Adyar & Cooum rivers, submerging Velachery & Kotturpuram.",
    inundation_polygons: [
      {
        type: "Feature",
        properties: { area: "Adyar Basin & Kotturpuram", depth_est_m: 2.8, severity: "CRITICAL" },
        geometry: {
          type: "Polygon",
          coordinates: [[[80.220, 13.010], [80.265, 13.015], [80.275, 13.030], [80.250, 13.035], [80.215, 13.020], [80.220, 13.010]]]
        }
      },
      {
        type: "Feature",
        properties: { area: "Velachery & Chembarambakkam Spills", depth_est_m: 2.2, severity: "HIGH" },
        geometry: {
          type: "Polygon",
          coordinates: [[[80.210, 12.970], [80.235, 12.975], [80.245, 12.990], [80.220, 12.998], [80.205, 12.980], [80.210, 12.970]]]
        }
      }
    ]
  },
  {
    id: "kerala_2018",
    title: "Kerala Great Deluge (Aug 2018)",
    district: "Kerala",
    state: "Kerala",
    date: "2018-08-16",
    sensor: "Sentinel-1 SAR & NASA GPM",
    provider: "ESA Copernicus EMS (EMSR304) / ISRO",
    flood_extent_sqkm: 890.2,
    rainfall_max_mm: 310.0,
    center: { lat: 10.1004, lon: 76.3570, zoom: 11 },
    satellite: {
      sensor: "Sentinel-1 SAR C-Band & NASA GPM IMERG",
      provider: "ESA Copernicus EMS (EMSR304) / ISRO Bhuvan",
      resolution: "10m SAR Groundwater & Surface Water",
      pass_date: "2018-08-16T18:30:00Z",
      flood_extent_sqkm: 890.2,
      affected_pop_est: 5400000,
      download_url: "https://emergency.copernicus.eu/EMSR304",
    },
    soil_moisture_pct: 98.2,
    description: "Massive gate discharge across 35 dams sending extreme floods along Periyar & Chalakudy River deltas.",
    inundation_polygons: [
      {
        type: "Feature",
        properties: { area: "Aluva & Periyar River Basin", depth_est_m: 3.4, severity: "CRITICAL" },
        geometry: {
          type: "Polygon",
          coordinates: [[[76.320, 10.080], [76.370, 10.100], [76.390, 10.140], [76.340, 10.150], [76.300, 10.110], [76.320, 10.080]]]
        }
      },
      {
        type: "Feature",
        properties: { area: "Kochi International Airport Submergence", depth_est_m: 1.9, severity: "HIGH" },
        geometry: {
          type: "Polygon",
          coordinates: [[[76.390, 10.145], [76.425, 10.155], [76.435, 10.170], [76.400, 10.175], [76.385, 10.160], [76.390, 10.145]]]
        }
      }
    ]
  },
  {
    id: "assam_2020",
    title: "Assam Brahmaputra Inundation (July 2020)",
    district: "Assam",
    state: "Assam",
    date: "2020-07-22",
    sensor: "Sentinel-1 SAR & ISRO RISAT-1",
    provider: "ISRO Bhuvan DMSP / ESA",
    flood_extent_sqkm: 1240.0,
    rainfall_max_mm: 240.0,
    center: { lat: 26.5775, lon: 93.1711, zoom: 10 },
    satellite: {
      sensor: "Sentinel-1 SAR & ISRO RISAT-1",
      provider: "ISRO Bhuvan DMSP / ESA Copernicus",
      resolution: "15m C-Band SAR Active Microwave",
      pass_date: "2020-07-21T11:45:00Z",
      flood_extent_sqkm: 1240.0,
      affected_pop_est: 2800000,
      download_url: "https://bhuvan-app1.nrsc.gov.in/disaster/",
    },
    soil_moisture_pct: 91.0,
    description: "Brahmaputra breach flooding 85% of Kaziranga National Park and 28 districts across Assam valley.",
    inundation_polygons: [
      {
        type: "Feature",
        properties: { area: "Kaziranga National Park Core Zone", depth_est_m: 2.5, severity: "CRITICAL" },
        geometry: {
          type: "Polygon",
          coordinates: [[[93.100, 26.540], [93.250, 26.570], [93.350, 26.620], [93.200, 26.640], [93.080, 26.580], [93.100, 26.540]]]
        }
      }
    ]
  },
  {
    id: "bihar_2019",
    title: "Bihar Kosi & Ganga Flood (Sept 2019)",
    district: "Patna",
    state: "Bihar",
    date: "2019-09-29",
    sensor: "Sentinel-1 SAR & NASA MODIS",
    provider: "NASA Earthdata Near Real-Time",
    flood_extent_sqkm: 620.0,
    rainfall_max_mm: 215.0,
    center: { lat: 25.5941, lon: 85.1376, zoom: 12 },
    satellite: {
      sensor: "Sentinel-1 SAR & NASA MODIS Terra",
      provider: "NASA Earthdata Near Real-Time (NRT) Flood",
      resolution: "250m Surface Water Classification",
      pass_date: "2019-09-29T05:30:00Z",
      flood_extent_sqkm: 620.0,
      affected_pop_est: 2200000,
      download_url: "https://earthdata.nasa.gov/",
    },
    soil_moisture_pct: 89.0,
    description: "Severe storm waterlogging in capital Patna with Ganga river backing up into urban drainage channels.",
    inundation_polygons: [
      {
        type: "Feature",
        properties: { area: "Patna Rajendra Nagar & Kankarbagh", depth_est_m: 1.8, severity: "HIGH" },
        geometry: {
          type: "Polygon",
          coordinates: [[[85.120, 25.580], [85.160, 25.590], [85.170, 25.610], [85.135, 25.615], [85.110, 25.595], [85.120, 25.580]]]
        }
      }
    ]
  },
  {
    id: "delhi_2023",
    title: "Yamuna Delhi Floods (July 2023)",
    district: "Delhi",
    state: "Delhi NCR",
    date: "2023-07-13",
    sensor: "Sentinel-1B SAR & Sentinel-2",
    provider: "ESA Copernicus Sentinel Hub",
    flood_extent_sqkm: 115.0,
    rainfall_max_mm: 153.0,
    center: { lat: 28.6562, lon: 77.2410, zoom: 13 },
    satellite: {
      sensor: "Sentinel-1B SAR & Sentinel-2 MSI",
      provider: "ESA Copernicus Sentinel Hub",
      resolution: "10m Multi-Spectral & SAR Fusion",
      pass_date: "2023-07-13T10:20:00Z",
      flood_extent_sqkm: 115.0,
      affected_pop_est: 450000,
      download_url: "https://scihub.copernicus.eu/",
    },
    soil_moisture_pct: 86.4,
    description: "Yamuna water level reached historical high of 208.66m, overtopping banks into ITO, Ring Road & Old Delhi.",
    inundation_polygons: [
      {
        type: "Feature",
        properties: { area: "Yamuna Bank, Kashmere Gate & Ring Road", depth_est_m: 2.1, severity: "CRITICAL" },
        geometry: {
          type: "Polygon",
          coordinates: [[[77.225, 28.640], [77.250, 28.650], [77.260, 28.675], [77.235, 28.680], [77.215, 28.655], [77.225, 28.640]]]
        }
      }
    ]
  }
];

export default function SatelliteArchiveModal({ isOpen, onClose, onSelectHistoricalEvent }) {
  const [events, setEvents] = useState(DEFAULT_SATELLITE_CATALOG);
  const [selectedId, setSelectedId] = useState("chennai_2015");

  useEffect(() => {
    if (isOpen) {
      fetchHistoricalSatellites()
        .then((data) => {
          if (data && data.length > 0) {
            setEvents(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunInference = async (ev) => {
    let fullEvent = ev;
    try {
      const data = await fetchHistoricalSatelliteEvent(ev.id);
      if (data && data.event) {
        fullEvent = data.event;
      }
    } catch (e) {}

    // Fallback to local full definition if needed
    if (!fullEvent.inundation_polygons) {
      fullEvent = DEFAULT_SATELLITE_CATALOG.find((item) => item.id === ev.id) || ev;
    }

    onSelectHistoricalEvent(fullEvent);
    onClose();
  };

  return (
    <div className="sat-modal-overlay" onClick={onClose}>
      <div className="sat-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="sat-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px" }}>🛰️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 700 }}>India Satellite Flood Archive</h3>
              <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>Free Open Data: Sentinel-1 SAR Dual-Pol, ISRO Bhuvan & NASA Earthdata</p>
            </div>
          </div>
          <button className="w-layers-close" onClick={onClose}>✕</button>
        </div>

        <div className="sat-modal-body">
          <div className="sat-grid">
            {events.map((ev) => {
              const isSelected = selectedId === ev.id;
              return (
                <div
                  key={ev.id}
                  className={`sat-card ${isSelected ? "active" : ""}`}
                  onClick={() => setSelectedId(ev.id)}
                >
                  <div className="sat-card-tag">{ev.state} • {ev.date}</div>
                  <h4 className="sat-card-title">{ev.title}</h4>
                  
                  <div className="sat-meta-row">
                    <span>📡 Sensor:</span> <strong>{ev.sensor}</strong>
                  </div>
                  <div className="sat-meta-row">
                    <span>🌐 Provider:</span> <span>{ev.provider}</span>
                  </div>
                  <div className="sat-meta-row">
                    <span>🌊 Extent:</span> <strong style={{ color: "#00f0ff" }}>{ev.flood_extent_sqkm} km²</strong>
                  </div>
                  <div className="sat-meta-row">
                    <span>🌧️ Max Rain:</span> <span>{ev.rainfall_max_mm} mm/24h</span>
                  </div>

                  <button
                    className="sat-run-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunInference(ev);
                    }}
                  >
                    ▶ Run AI Prototype Inference
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
