import React from "react";
import { TileLayer } from "react-leaflet";

const OWM_KEY = "bd5e378503939ddaee76f12ad7a97608";

/**
 * Official Real-Time Live OpenWeatherMap Global Wind Speed Tile Layer.
 * Renders live wind speed color heatmaps across the ENTIRE WORLD MAP.
 */
export default function WindHeatmapLayer() {
  return (
    <TileLayer
      key="owm-wind"
      url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
      opacity={0.8}
      zIndex={410}
      maxZoom={19}
      attribution="© OpenWeatherMap"
      keepBuffer={8}
      updateWhenZooming={false}
      updateWhenIdle={true}
    />
  );
}
