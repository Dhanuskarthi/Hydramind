-- =============================================================================
-- HydraMind — PostGIS Database Schema
-- =============================================================================
-- Run inside psql after PostGIS is enabled:
--     psql -U hydramind -d hydramind -f schema.sql
--
-- PostGIS is required for geometry columns and spatial queries.
--     CREATE EXTENSION IF NOT EXISTS postgis;
--     CREATE EXTENSION IF NOT EXISTS postgis_topology;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- ---------------------------------------------------------------------------
-- 1. Rainfall — hourly observations per location
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rainfall (
    id                  BIGSERIAL PRIMARY KEY,
    location            GEOMETRY(Point, 4326) NOT NULL,
    district            TEXT,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rainfall_mm         FLOAT       NOT NULL,   -- current precipitation (mm/hr)
    soil_moisture_pct   FLOAT,                  -- 0–100 %
    humidity_pct        FLOAT,
    source              TEXT        DEFAULT 'Open-Meteo',

    -- Spatial index
    CONSTRAINT rainfall_recorded_at_location UNIQUE (recorded_at, location)
);
CREATE INDEX IF NOT EXISTS idx_rainfall_location  ON rainfall USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_rainfall_time      ON rainfall (recorded_at DESC);


-- ---------------------------------------------------------------------------
-- 2. Villages — administrative boundaries (Survey of India / Bhuvan)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS villages (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT         NOT NULL,
    district        TEXT,
    state           TEXT,
    boundary        GEOMETRY(MultiPolygon, 4326),
    centroid        GEOMETRY(Point, 4326)
                        GENERATED ALWAYS AS (ST_Centroid(boundary)) STORED,
    population      INTEGER,
    area_sqkm       FLOAT
                        GENERATED ALWAYS AS (ST_Area(boundary::GEOGRAPHY) / 1e6) STORED
);
CREATE INDEX IF NOT EXISTS idx_villages_boundary ON villages USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_villages_district ON villages (district);


-- ---------------------------------------------------------------------------
-- 3. Rivers — river and drainage network (from OSM / CWC)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rivers (
    id          BIGSERIAL PRIMARY KEY,
    osm_id      BIGINT UNIQUE,
    name        TEXT,
    waterway    TEXT,   -- river | stream | drain | canal
    geometry    GEOMETRY(LineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rivers_geom ON rivers USING GIST (geometry);


-- ---------------------------------------------------------------------------
-- 4. Roads — road network (OSM)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roads (
    id          BIGSERIAL PRIMARY KEY,
    osm_id      BIGINT UNIQUE,
    name        TEXT,
    highway     TEXT,   -- primary | secondary | residential …
    passable    BOOLEAN DEFAULT TRUE,
    geometry    GEOMETRY(LineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST (geometry);


-- ---------------------------------------------------------------------------
-- 5. Hospitals — medical infrastructure
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
    id          BIGSERIAL PRIMARY KEY,
    osm_id      BIGINT UNIQUE,
    name        TEXT,
    district    TEXT,
    beds        INTEGER,
    location    GEOMETRY(Point, 4326) NOT NULL,
    at_risk     BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals USING GIST (location);


-- ---------------------------------------------------------------------------
-- 6. Flood predictions — AI model output per grid cell
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flood_predictions (
    id                  BIGSERIAL PRIMARY KEY,
    grid_id             TEXT         NOT NULL,
    district            TEXT         NOT NULL,
    cell_geometry       GEOMETRY(Polygon, 4326) NOT NULL,

    -- XGBoost output
    flood_probability   FLOAT        NOT NULL CHECK (flood_probability BETWEEN 0 AND 1),
    risk_level          TEXT         NOT NULL
                            CHECK (risk_level IN ('MINIMAL','LOW','MEDIUM','HIGH','CRITICAL')),

    -- LSTM input used
    rain_forecast_mm    FLOAT,
    soil_moisture_pct   FLOAT,
    elevation_m         FLOAT,
    slope_deg           FLOAT,
    dist_to_river_m     FLOAT,

    -- U-Net inundation flag (True = this cell overlaps flood mask)
    inundated           BOOLEAN      DEFAULT FALSE,

    predicted_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    model_version       TEXT         DEFAULT '1.0.0'
);
CREATE INDEX IF NOT EXISTS idx_flood_pred_cell   ON flood_predictions USING GIST (cell_geometry);
CREATE INDEX IF NOT EXISTS idx_flood_pred_time   ON flood_predictions (predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_flood_pred_district ON flood_predictions (district, predicted_at DESC);


-- ---------------------------------------------------------------------------
-- 7. Alerts — generated notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id          BIGSERIAL PRIMARY KEY,
    type        TEXT    NOT NULL,   -- FLOOD_WARNING | VILLAGE_RISK | ROAD_CLOSED …
    severity    TEXT    NOT NULL,   -- CRITICAL | HIGH | MEDIUM | LOW
    district    TEXT,
    village     TEXT,
    message     TEXT    NOT NULL,
    dispatched  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_village ON alerts (village, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity, created_at DESC);


-- ---------------------------------------------------------------------------
-- 8. Evacuation shelters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shelters (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT    NOT NULL,
    district    TEXT,
    capacity    INTEGER,
    location    GEOMETRY(Point, 4326) NOT NULL,
    is_safe     BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_shelters_location ON shelters USING GIST (location);


-- ---------------------------------------------------------------------------
-- Useful spatial queries (for reference / Postman testing)
-- ---------------------------------------------------------------------------

-- Q1: Hospitals inside the current flood prediction zone
-- SELECT h.name, h.location
-- FROM hospitals h
-- JOIN flood_predictions fp
--   ON ST_Within(h.location, fp.cell_geometry)
-- WHERE fp.risk_level IN ('HIGH', 'CRITICAL')
--   AND fp.predicted_at > NOW() - INTERVAL '1 hour';

-- Q2: Villages intersecting a U-Net flood polygon
-- SELECT v.name, v.population
-- FROM villages v
-- JOIN flood_predictions fp
--   ON ST_Intersects(v.boundary, fp.cell_geometry)
-- WHERE fp.inundated = TRUE
--   AND fp.predicted_at > NOW() - INTERVAL '1 hour'
-- ORDER BY v.population DESC;

-- Q3: Nearest safe shelter for a given point (e.g. 13.08°N, 80.27°E)
-- SELECT name, ST_Distance(location::GEOGRAPHY, ST_SetSRID(ST_MakePoint(80.27, 13.08), 4326)::GEOGRAPHY) AS dist_m
-- FROM shelters
-- WHERE is_safe = TRUE
-- ORDER BY dist_m
-- LIMIT 3;
