import React, { useEffect, useState, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Animated Radar Frame Player for Leaflet (Windy-style Radar Loop).
 * Plays past radar observations & future nowcast frames smoothly with controls.
 */
export default function RadarAnimationPlayer({ isPlaying = true, onFrameChange }) {
  const map = useMap();
  const [frames, setFrames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const tileLayersRef = useRef({});
  const intervalRef = useRef(null);

  // 1. Fetch past + nowcast radar frames from RainViewer
  useEffect(() => {
    async function loadFrames() {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const data = await res.json();
        const past = data?.radar?.past ?? [];
        const nowcast = data?.radar?.nowcast ?? [];

        const all = [...past, ...nowcast].map((item) => ({
          time: item.time,
          path: item.path,
          url: `https://tilecache.rainviewer.com${item.path}/256/{z}/{x}/{y}/2/1_1.png`,
          timeLabel: new Date(item.time * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

        setFrames(all);
        if (all.length > 0) {
          setCurrentIndex(past.length > 0 ? past.length - 1 : 0);
        }
      } catch (e) {
        console.error("Failed to load radar frames", e);
      } finally {
        setLoading(false);
      }
    }
    loadFrames();
  }, []);

  // 2. Pre-render tile layers on Leaflet map for smooth frame switching
  useEffect(() => {
    if (!map || frames.length === 0) return;

    // Create a Leaflet TileLayer for each frame
    frames.forEach((frame, idx) => {
      if (!tileLayersRef.current[idx]) {
        const layer = L.tileLayer(frame.url, {
          opacity: idx === currentIndex ? 0.75 : 0,
          attribution: "© RainViewer",
          zIndex: 400,
          minNativeZoom: 0,
          maxNativeZoom: 7, // RainViewer radar tiles stop at zoom 7 -> Leaflet will scale tiles seamlessly!
          maxZoom: 19,
          errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        });
        layer.addTo(map);
        tileLayersRef.current[idx] = layer;
      }
    });

    return () => {
      Object.values(tileLayersRef.current).forEach((layer) => layer.remove());
      tileLayersRef.current = {};
    };
  }, [map, frames]);

  // 3. Update opacities on frame change
  useEffect(() => {
    Object.entries(tileLayersRef.current).forEach(([idxStr, layer]) => {
      const idx = parseInt(idxStr, 10);
      if (idx === currentIndex) {
        layer.setOpacity(0.78);
      } else {
        layer.setOpacity(0);
      }
    });

    if (frames[currentIndex] && onFrameChange) {
      onFrameChange(frames[currentIndex]);
    }
  }, [currentIndex, frames, onFrameChange]);

  // 4. Loop animation timer
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % frames.length);
    }, 700); // 700ms frame step speed

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, frames]);

  if (loading || frames.length === 0) return null;

  const currentFrame = frames[currentIndex];

  return (
    <div className="radar-player-bar">
      <button
        className="radar-play-btn"
        onClick={() => setCurrentIndex((prev) => (prev + 1) % frames.length)}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play Radar Loop"}
      </button>

      <div className="radar-timeline">
        <input
          type="range"
          min="0"
          max={frames.length - 1}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
        />
        <div className="radar-frame-info">
          <span>📡 Live Radar: <strong>{currentFrame?.timeLabel}</strong></span>
          <span>Frame {currentIndex + 1}/{frames.length}</span>
        </div>
      </div>
    </div>
  );
}
