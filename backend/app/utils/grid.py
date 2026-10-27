"""
Utilities to build a regular spatial grid (default 150m cells) over a
bounding box, which is the common spatial unit every data source
(OSM, DEM, rainfall, soil...) gets attached to.
"""
from shapely.geometry import box
import geopandas as gpd

METERS_PER_DEGREE = 111_000  # rough conversion, fine at village scale


def create_grid(bounds, cell_size_m: int = 150, max_cells: int = 1600) -> gpd.GeoDataFrame:
    """
    bounds: (minx, miny, maxx, maxy) in EPSG:4326 (lon/lat)
    Returns a GeoDataFrame of square polygons covering the bounds.
    Dynamically scales cell size if the bounding box is huge to protect
    memory and prevent browser/Render freezing (capped at max_cells).
    """
    minx, miny, maxx, maxy = bounds
    width_deg = max(maxx - minx, 0.005)
    height_deg = max(maxy - miny, 0.005)

    cell_deg = max(cell_size_m / METERS_PER_DEGREE, 0.001)
    
    # Calculate initial grid resolution
    nx = int(width_deg / cell_deg) + 1
    ny = int(height_deg / cell_deg) + 1
    total_estimated = nx * ny

    # If bounds cover an entire huge district, adapt cell_deg so we stay within ~1600 cells
    if total_estimated > max_cells:
        scale_factor = (total_estimated / max_cells) ** 0.5
        cell_deg = cell_deg * scale_factor

    cells = []
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cells.append(box(x, y, min(x + cell_deg, maxx), min(y + cell_deg, maxy)))
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
