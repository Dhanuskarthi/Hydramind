import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { fetchLiveGridWeather } from "../services/weatherData.js";

/**
 * Concentrated Rain Radar Heatmap Layer.
 * Renders live precipitation data as smooth gradient blobs ONLY where there is actual rainfall,
 * instead of blanketing the entire viewport.
 */

// Cyclone center to match global cyclone system
const CYCLONE_CENTER = [12.8, 81.0];

export default function RainRadarLayer({ center = [13.0827, 80.2707] }) {
  const map = useMap();
  const rafRef = useRef(null);
  const [gridData, setGridData] = useState([]);

  const lat = center[0];
  const lon = center[1];

  useEffect(() => {
    let active = true;
    fetchLiveGridWeather(lat, lon, 45).then((data) => {
      if (active) setGridData(data);
    });
    return () => { active = false; };
  }, [lat, lon]);

  useEffect(() => {
    if (!map || gridData.length === 0) return;

    const pane = map.getPanes().overlayPane;
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "430";
    pane.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    let t = 0;

    function resize() {
      const size = map.getSize();
      const bounds = map.getBounds();
      const tl = map.latLngToLayerPoint(bounds.getNorthWest());
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.transform = `translate3d(${tl.x}px,${tl.y}px,0)`;
    }

    resize();
    map.on("move", resize);
    map.on("zoom", resize);
    map.on("resize", resize);

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      t += 0.016;

      const currentZoom = map.getZoom();
      const bounds = map.getBounds();
      const tl = map.latLngToLayerPoint(bounds.getNorthWest());

      // Only render points that actually have rainfall > 0
      gridData.forEach((pt, i) => {
        const rainVal = pt.rain;
        if (rainVal < 0.5) return; // Skip dry cells

        const layerPoint = map.latLngToLayerPoint([pt.lat, pt.lon]);
        const x = layerPoint.x - tl.x;
        const y = layerPoint.y - tl.y;

        // Dynamic radius based on zoom
        const radius = Math.pow(2, currentZoom - 10) * 90;

        if (x < -radius || x > w + radius || y < -radius || y > h + radius) return;

        const pulse = 0.85 + 0.15 * Math.sin(t * 2 + i);
        const rEffective = radius * pulse;

        // Color scale based on rain intensity
        let r = 2, g = 132, b = 199, alpha = 0.35;
        if (rainVal > 25) { r = 239; g = 68; b = 68; alpha = 0.55; }
        else if (rainVal > 12) { r = 234; g = 179; b = 8; alpha = 0.5; }
        else if (rainVal > 3) { r = 34; g = 197; b = 94; alpha = 0.42; }

        const grad = ctx.createRadialGradient(x, y, 0, x, y, rEffective);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.arc(x, y, rEffective, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off("move", resize);
      map.off("zoom", resize);
      map.off("resize", resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, gridData]);

  return null;
}
