"""
Terrain layer (elevation, slope) from a Digital Elevation Model.

Uses OpenTopography's free `globaldem` endpoint (SRTM 30m). Requires a
free API key - see backend/.env.example. If no key is configured the
service degrades gracefully and returns None so the rest of the
pipeline still runs (the risk engine treats missing terrain as neutral).
"""
import logging
import tempfile
import numpy as np
import rasterio
import requests

from app.config import settings

logger = logging.getLogger(__name__)

OPENTOPO_URL = "https://portal.opentopography.org/API/globaldem"


class DEMService:
    def fetch_dem(self, bounds):
        """bounds = (minx, miny, maxx, maxy) in lon/lat. Returns an open rasterio dataset or None."""
        if not settings.OPENTOPOGRAPHY_API_KEY:
            logger.info("No OPENTOPOGRAPHY_API_KEY set - skipping terrain layer.")
            return None

        params = {
            "demtype": "SRTMGL1",
            "west": bounds[0],
            "south": bounds[1],
            "east": bounds[2],
            "north": bounds[3],
            "outputFormat": "GTiff",
            "API_Key": settings.OPENTOPOGRAPHY_API_KEY,
        }
        try:
            resp = requests.get(OPENTOPO_URL, params=params, timeout=30)
            resp.raise_for_status()
            tmp = tempfile.NamedTemporaryFile(suffix=".tif", delete=False)
            tmp.write(resp.content)
            tmp.flush()
            return rasterio.open(tmp.name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("DEM fetch failed: %s", exc)
            return None

    def calculate_terrain_features(self, grid, dem_src):
        """Sample elevation + slope at each grid cell centroid."""
        grid = grid.copy()

        if dem_src is None:
            grid["elevation_m"] = None
            grid["slope_deg"] = None
            return grid

        elevation = dem_src.read(1).astype("float64")
        transform = dem_src.transform

        # slope via simple gradient (good enough for risk scoring, not for engineering use)
        gy, gx = np.gradient(elevation, transform.e, transform.a)
        slope_deg = np.degrees(np.arctan(np.sqrt(gx ** 2 + gy ** 2)))

        elevations, slopes = [], []
        for point in grid.geometry.centroid:
            row, col = dem_src.index(point.x, point.y)
            if 0 <= row < elevation.shape[0] and 0 <= col < elevation.shape[1]:
                elevations.append(float(elevation[row, col]))
                slopes.append(float(slope_deg[row, col]))
            else:
                elevations.append(None)
                slopes.append(None)

        grid["elevation_m"] = elevations
        grid["slope_deg"] = slopes
        return grid
