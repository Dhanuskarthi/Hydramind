"""
Offline script: builds a flat feature table (one row per grid cell) that
ml_models/train_susceptibility.py can train on.

This reuses the exact same services as the live API (backend/app/services)
so the features an offline model is trained on are guaranteed to match
the features the API computes at inference time.

Usage:
    cd hydramind
    python data_processing/build_training_table.py --district "Chennai, India" --out data/chennai_grid.csv

You still need to supply historical flood labels yourself (e.g. from
NDMA/NRSC damage reports or Dartmouth Flood Observatory) and join them
onto `grid_id` before training - this script only builds the X side.
"""
import argparse
import asyncio
import sys
from pathlib import Path

# allow importing the backend package when run from the repo root
sys.path.append(str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.osm_service import OSMService          # noqa: E402
from app.services.dem_service import DEMService           # noqa: E402
from app.services.rainfall_service import RainfallService # noqa: E402
from app.services.soil_service import SoilService         # noqa: E402
from app.utils.grid import create_grid                    # noqa: E402


async def main(district: str, out_path: str, cell_size: int):
    osm = OSMService()
    dem = DEMService()
    rainfall = RainfallService()
    soil = SoilService()

    osm_data = osm.fetch_district_data(district)
    if osm_data is None:
        raise SystemExit(f"Could not fetch OSM data for '{district}'")

    bounds = tuple(osm_data["boundary"].total_bounds)
    grid = create_grid(bounds, cell_size_m=cell_size)
    grid = osm.calculate_features(grid, osm_data)

    dem_src = dem.fetch_dem(bounds)
    grid = dem.calculate_terrain_features(grid, dem_src)

    center_lat = (bounds[1] + bounds[3]) / 2
    center_lon = (bounds[0] + bounds[2]) / 2
    rainfall_now = await rainfall.get_forecast(center_lat, center_lon)
    soil_props = soil.get_soil_properties(center_lat, center_lon)

    for key, value in rainfall_now.items():
        grid[f"rainfall_{key}"] = value
    for key, value in soil_props.items():
        grid[f"soil_{key}"] = value

    grid.drop(columns="geometry").to_csv(out_path, index=False)
    print(f"Wrote {len(grid)} rows -> {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--district", required=True, help='e.g. "Chennai, India"')
    parser.add_argument("--out", default="training_table.csv")
    parser.add_argument("--cell-size", type=int, default=150)
    args = parser.parse_args()

    asyncio.run(main(args.district, args.out, args.cell_size))
