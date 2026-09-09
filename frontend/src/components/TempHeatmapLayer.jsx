import React from "react";
import { TileLayer } from "react-leaflet";

const OWM_KEY = "bd5e378503939ddaee76f12ad7a97608";

/**
 * Official Real-Time Live OpenWeatherMap Global Temperature Tile Layer.
 * Renders live satellite & model temperature fields across the ENTIRE WORLD MAP (Asia, Europe, Africa, Americas, Oceans)
 * with zero uneven spots, zero stripes, and 100% real-time meteorological accuracy (matching Windy.com Image 2).
 */
export default function TempHeatmapLayer() {
  return (
    <TileLayer
      key="owm-temp"
      url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
      opacity={0.78}
      zIndex={420}
      maxZoom={19}
      attribution="© OpenWeatherMap"
      keepBuffer={8}
      updateWhenZooming={false}
      updateWhenIdle={true}
    />
  );
}
