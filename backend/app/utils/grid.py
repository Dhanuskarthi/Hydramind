"""
Utilities to build a regular spatial grid (default 150m cells) over a
bounding box, which is the common spatial unit every data source
(OSM, DEM, rainfall, soil...) gets attached to.
"""
from shapely.geometry import box
import geopandas as gpd

METERS_PER_DEGREE = 111_000  # rough conversion, fine at village scale


def create_grid(bounds, cell_size_m: int = 150) -> gpd.GeoDataFrame:
    """
    bounds: (minx, miny, maxx, maxy) in EPSG:4326 (lon/lat)
    Returns a GeoDataFrame of square polygons covering the bounds.
    """
    minx, miny, maxx, maxy = bounds
    cell_deg = cell_size_m / METERS_PER_DEGREE

    cells = []
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cells.append(box(x, y, x + cell_deg, y + cell_deg))
            y += cell_deg
        x += cell_deg

    grid = gpd.GeoDataFrame(
        {"grid_id": [f"GRID_{i}" for i in range(len(cells))]},
        geometry=cells,
        crs="EPSG:4326",
    )
    return grid


def bbox_from_point(lat: float, lon: float, radius_m: int = 1000):
    """Small bounding box helper for single-village queries."""
    d = radius_m / METERS_PER_DEGREE
    return (lon - d, lat - d, lon + d, lat + d)
