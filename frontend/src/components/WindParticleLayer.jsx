import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/**
 * Realistic Moving Cyclone Wind Particle Layer.
 * 
 * KEY BEHAVIORS:
 * - Cyclone CENTER MOVES along a track as the timeline progresses
 * - Cyclone WEAKENS when it hits land (fewer particles, lower speed, larger eye)
 * - Cyclone RADIUS SHRINKS after landfall
 * - Color shifts from intense (ocean) to muted (inland dissipation)
 * - Realistic Rankine vortex with eye wall, spiral rain bands
 */
export default function WindParticleLayer({ forecastStep }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Extract cyclone state from forecast step
  let cycloneLat = 12.4;
  let cycloneLon = 81.2;
  let windKts = 90;
  let landPct = 0;
  let category = "Cat-2";
  let phase = "OCEAN";
  
  try {
    cycloneLat = forecastStep?.lat ?? 12.4;
    cycloneLon = forecastStep?.lon ?? 81.2;
    windKts = forecastStep?.windKts ?? 90;
    landPct = forecastStep?.landPct ?? 0;
    category = forecastStep?.category ?? "Cat-2";
    phase = forecastStep?.phase ?? "OCEAN";
  } catch (err) {
    return <div style={{position: 'absolute', zIndex: 9999, background: 'red', color: 'white'}}>{err.toString()}</div>;
  }

  // Derived physics
  const isOverLand = landPct > 20;
  const strengthFactor = Math.max(0.1, 1.0 - landPct / 120); // Weakens over land
  const cycloneRadiusDeg = (1.8 + (windKts / 60) * 0.8) * strengthFactor; // Shrinks over land

  useEffect(() => {
    if (!map) return;

    const pane = map.getPanes().overlayPane;
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "410";
    pane.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");

    // Particle count scales with wind strength
    const PARTICLE_COUNT = Math.max(80, Math.round(400 * strengthFactor));
    const particles = [];

    function resetParticle(p) {
      const angle = Math.random() * Math.PI * 2;
      const rNorm = 0.12 + Math.pow(Math.random(), 0.65) * 0.88;
      const r = rNorm * cycloneRadiusDeg;
      p.geoLat = cycloneLat + Math.sin(angle) * r;
      p.geoLon = cycloneLon + Math.cos(angle) * r;
      p.age = 0;
      p.maxAge = 35 + Math.random() * 55;
      p.speedScale = 0.5 + Math.random() * 0.7;
      p.rNorm = rNorm;
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = {};
      resetParticle(p);
      particles.push(p);
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

    let t = 0;

    function animate() {
      const w = canvas.width;
      const h = canvas.height;

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0, 0, 0, ${isOverLand ? 0.18 : 0.10})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const bounds = map.getBounds();
      const tl = map.latLngToLayerPoint(bounds.getNorthWest());
      t += 0.007;

      ctx.lineCap = "round";
      
      const eyeWallR = isOverLand ? 0.35 : 0.25;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const layerPt = map.latLngToLayerPoint([p.geoLat, p.geoLon]);
        const prevX = layerPt.x - tl.x;
        const prevY = layerPt.y - tl.y;

        // Physics relative to current cyclone center
        const dLat = p.geoLat - cycloneLat;
        const dLon = p.geoLon - cycloneLon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon) || 0.001;
        const rNorm = Math.min(dist / cycloneRadiusDeg, 1.0);

        // Rankine vortex
        let vMagnitude;
        if (rNorm < eyeWallR) {
          vMagnitude = (rNorm / eyeWallR) * 1.0;
        } else {
          vMagnitude = Math.pow(eyeWallR / rNorm, 0.55);
        }

        // Wind speed scaled by knots and land weakening
        const speedFactor = vMagnitude * (windKts * 0.00025) * p.speedScale * strengthFactor;

        // Counter-clockwise tangential + inward spiral
        const tangLat = -dLon / dist;
        const tangLon = dLat / dist;
        // More disorganized spiral over land
        const inflowStr = isOverLand ? 0.2 + rNorm * 0.2 : 0.1 + rNorm * 0.12;
        const inflowLat = -dLat / dist * inflowStr;
        const inflowLon = -dLon / dist * inflowStr;

        p.geoLat += (tangLat + inflowLat) * speedFactor;
        p.geoLon += (tangLon + inflowLon) * speedFactor;
        p.age++;

        const newPt = map.latLngToLayerPoint([p.geoLat, p.geoLon]);
        const newX = newPt.x - tl.x;
        const newY = newPt.y - tl.y;

        // Life alpha
        const lifeAlpha = Math.sin((p.age / p.maxAge) * Math.PI);
        // Over-land particles are more transparent (dissipating)
        const baseAlpha = isOverLand ? 0.35 : 0.55;
        const alpha = lifeAlpha * (baseAlpha + vMagnitude * 0.35) * strengthFactor;

        // Color by storm intensity & distance from center
        let r, g, b;
        if (windKts >= 100 && rNorm < 0.3) {
          r = 239; g = 68; b = 120; // Intense eye wall
        } else if (windKts >= 64 && rNorm < 0.4) {
          r = 249; g = 115; b = 22; // Orange hurricane
        } else if (rNorm < 0.55) {
          r = 250; g = 204; b = 21; // Yellow mid-bands
        } else if (rNorm < 0.75) {
          r = 56; g = 189; b = 248; // Cyan outer
        } else {
          r = 120; g = 160; b = 210; // Faint far outer
        }

        // Over land: shift colors to grey/muted
        if (isOverLand) {
          r = Math.round(r * 0.7 + 100 * 0.3);
          g = Math.round(g * 0.7 + 120 * 0.3);
          b = Math.round(b * 0.7 + 140 * 0.3);
        }

        const lineW = rNorm < 0.3 ? 2.2 : rNorm < 0.55 ? 1.6 : 1.0;
        ctx.lineWidth = lineW;
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(newX, newY);
        ctx.stroke();

        // Reset if particle drifts out
        const newDist = Math.sqrt(
          (p.geoLat - cycloneLat) ** 2 + (p.geoLon - cycloneLon) ** 2
        );
        if (p.age >= p.maxAge || newDist > cycloneRadiusDeg * 1.15 || newDist < 0.03) {
          resetParticle(p);
        }
      }

      // Draw cyclone eye (darker and larger over land = disorganized)
      ctx.globalCompositeOperation = "source-over";
      const eyePt = map.latLngToLayerPoint([cycloneLat, cycloneLon]);
      const eyeX = eyePt.x - tl.x;
      const eyeY = eyePt.y - tl.y;
      const eyeDeg = cycloneRadiusDeg * (isOverLand ? 0.12 : 0.07);
      const eyeEdge = map.latLngToLayerPoint([cycloneLat, cycloneLon + eyeDeg]);
      const eyePixelR = Math.max(3, Math.abs(eyeEdge.x - eyePt.x));

      // Eye is only visible for strong storms
      if (windKts >= 50) {
        const eyeGrad = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, eyePixelR * 2.5);
        eyeGrad.addColorStop(0, `rgba(0, 0, 0, ${isOverLand ? 0.2 : 0.45})`);
        eyeGrad.addColorStop(0.5, `rgba(0, 0, 0, ${isOverLand ? 0.05 : 0.12})`);
        eyeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, eyePixelR * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Eye wall glow
        if (windKts >= 64) {
          const wallDeg = cycloneRadiusDeg * eyeWallR;
          const wallEdge = map.latLngToLayerPoint([cycloneLat, cycloneLon + wallDeg]);
          const wallR = Math.max(6, Math.abs(wallEdge.x - eyePt.x));
          const pulse = 0.25 + Math.sin(t * 5) * 0.12;
          ctx.strokeStyle = `rgba(239, 68, 120, ${pulse * strengthFactor})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, wallR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.off("move", resizeCanvas);
      map.off("zoom", resizeCanvas);
      map.off("resize", resizeCanvas);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, cycloneLat, cycloneLon, windKts, landPct, strengthFactor, cycloneRadiusDeg, isOverLand]);

  return null;
}
