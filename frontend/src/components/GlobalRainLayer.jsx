import React, { useState, useEffect, useRef } from "react";
import { TileLayer, useMap } from "react-leaflet";

/**
 * Moving Cyclone Rain Layer.
 * Rain follows the cyclone center from the forecast step.
 * Storm cells are concentrated within the cyclone radius.
 * Rain intensity reduces after landfall (landPct > 0).
 */

function CanvasRainOverlays({ forecastStep }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const rainMm = typeof forecastStep?.rainMm === "number" ? forecastStep.rainMm : 50;
  const cycloneLat = forecastStep?.lat ?? 12.4;
  const cycloneLon = forecastStep?.lon ?? 81.2;
  const windKts = forecastStep?.windKts ?? 90;
  const landPct = forecastStep?.landPct ?? 0;

  const strengthFactor = Math.max(0.15, 1.0 - landPct / 120);
  const cycloneRadiusDeg = (1.8 + (windKts / 60) * 0.8) * strengthFactor;

  useEffect(() => {
    if (!map) return;

    const pane = map.getPanes().overlayPane;
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "420";
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");

    // Rain drops in geo-space
    const DROP_COUNT = Math.max(60, Math.round(280 * strengthFactor));
    const drops = [];

    function resetDrop(d) {
      const angle = Math.random() * Math.PI * 2;
      const rNorm = 0.1 + Math.pow(Math.random(), 0.7) * 0.9;
      const r = rNorm * cycloneRadiusDeg;
      const spiral = rNorm * 0.5;
      d.geoLat = cycloneLat + Math.sin(angle + spiral) * r;
      d.geoLon = cycloneLon + Math.cos(angle + spiral) * r;
      d.rNorm = rNorm;
      d.length = 5 + Math.random() * 14;
      d.speed = 0.003 + Math.random() * 0.005;
      d.opacity = (0.12 + (1 - rNorm) * 0.4) * strengthFactor;
      d.width = rNorm < 0.35 ? 1.5 : 1;
      d.windAngle = Math.atan2(
        d.geoLat - cycloneLat, d.geoLon - cycloneLon
      ) + Math.PI * 0.55;
    }

    for (let i = 0; i < DROP_COUNT; i++) {
      const d = {};
      resetDrop(d);
      drops.push(d);
    }

    function resizeCanvas() {
      const size = map.getSize();
      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.style.transform = `translate3d(${topLeft.x}px, ${topLeft.y}px, 0px)`;
    }

    resizeCanvas();
    map.on("move", resizeCanvas);
    map.on("zoom", resizeCanvas);
    map.on("resize", resizeCanvas);

    let pulseAngle = 0;

    function render() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bounds = map.getBounds();
      const tl = map.latLngToLayerPoint(bounds.getNorthWest());
      pulseAngle += 0.018;

      // ── Storm cell blobs around moving cyclone center ──
      const cells = [
        { dLat: 0, dLon: 0, intensity: 1.0 },          // Eye wall
        { dLat: 0.4, dLon: -0.3, intensity: 0.8 },     // Inner band N
        { dLat: -0.5, dLon: 0.5, intensity: 0.65 },    // Inner band S
        { dLat: 0.9, dLon: 0.7, intensity: 0.45 },     // Outer band NE
        { dLat: -0.3, dLon: -0.8, intensity: 0.35 },   // Outer band W
        { dLat: 1.3, dLon: -0.4, intensity: 0.25 },    // Far outer
      ];

      cells.forEach((cell, idx) => {
        const cellLat = cycloneLat + cell.dLat * cycloneRadiusDeg * 0.5;
        const cellLon = cycloneLon + cell.dLon * cycloneRadiusDeg * 0.5;
        const pt = map.latLngToLayerPoint([cellLat, cellLon]);
        const x = pt.x - tl.x;
        const y = pt.y - tl.y;

        if (x < -300 || x > w + 300 || y < -300 || y > h + 300) return;

        const cellR = cycloneRadiusDeg * 0.3 * cell.intensity;
        const edgePt = map.latLngToLayerPoint([cellLat, cellLon + cellR]);
        const pixelR = Math.abs(edgePt.x - pt.x);
        const pulseR = pixelR + Math.sin(pulseAngle + idx * 1.2) * pixelR * 0.06;

        const op = Math.min(0.55, 0.12 + (rainMm / 100) * cell.intensity) * strengthFactor;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, pulseR);

        if (cell.intensity > 0.7) {
          grad.addColorStop(0, `rgba(217, 70, 239, ${op * 0.8})`);
          grad.addColorStop(0.3, `rgba(239, 68, 68, ${op * 0.65})`);
          grad.addColorStop(0.6, `rgba(245, 158, 11, ${op * 0.4})`);
          grad.addColorStop(1, "rgba(56, 189, 248, 0)");
        } else {
          grad.addColorStop(0, `rgba(245, 158, 11, ${op * 0.6})`);
          grad.addColorStop(0.4, `rgba(16, 185, 129, ${op * 0.35})`);
          grad.addColorStop(1, "rgba(56, 189, 248, 0)");
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, pulseR, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Rain streaks ──
      ctx.globalCompositeOperation = "lighter";
      drops.forEach((d) => {
        d.geoLat -= d.speed * (0.5 + rainMm / 180);
        d.geoLon += d.speed * 0.25;

        const pt = map.latLngToLayerPoint([d.geoLat, d.geoLon]);
        const x = pt.x - tl.x;
        const y = pt.y - tl.y;
        const endX = x + Math.cos(d.windAngle) * d.length;
        const endY = y + Math.sin(d.windAngle) * d.length;

        ctx.strokeStyle = `rgba(180, 210, 255, ${d.opacity * Math.min(1, rainMm / 30)})`;
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        const dist = Math.sqrt(
          (d.geoLat - cycloneLat) ** 2 + (d.geoLon - cycloneLon) ** 2
        );
        if (dist > cycloneRadiusDeg * 1.15 || x < -100 || x > w + 100) {
          resetDrop(d);
        }
      });
      ctx.globalCompositeOperation = "source-over";

      animFrameRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.off("move", resizeCanvas);
      map.off("zoom", resizeCanvas);
      map.off("resize", resizeCanvas);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, rainMm, cycloneLat, cycloneLon, windKts, landPct, strengthFactor, cycloneRadiusDeg]);

  return null;
}

export default function GlobalRainLayer({ forecastStep }) {
  const [radarPath, setRadarPath] = useState(null);

  useEffect(() => {
    async function fetchRadar() {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const data = await res.json();
        if (data?.radar?.past?.length > 0) {
          setRadarPath(data.radar.past[data.radar.past.length - 1].path);
        }
      } catch (err) {
        console.error("Failed to load RainViewer radar", err);
      }
    }
    fetchRadar();
  }, []);

  const tileUrl = radarPath
    ? `https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/1_1.png`
    : null;

  return (
    <>
      {tileUrl && (
        <TileLayer
          key={radarPath}
          url={tileUrl}
          opacity={0.45}
          zIndex={415}
          maxZoom={19}
          maxNativeZoom={6}
          attribution="© RainViewer"
        />
      )}
      <CanvasRainOverlays forecastStep={forecastStep} />
    </>
  );
}
