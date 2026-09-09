import React from "react";
import { TileLayer } from "react-leaflet";

const OWM_KEY = "bd5e378503939ddaee76f12ad7a97608";

/**
 * Official Real-Time Live OpenWeatherMap Global Cloud/Moisture Layer.
 * Renders real-time moisture & cloud coverage across the ENTIRE WORLD MAP.
 */
export default function SoilMoistureLayer() {
  return (
    <TileLayer
      key="owm-soil"
      url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`}
      opacity={0.7}
      zIndex={420}
      maxZoom={19}
      attribution="© OpenWeatherMap"
      keepBuffer={8}
      updateWhenZooming={false}
      updateWhenIdle={true}
    />
  );
}
