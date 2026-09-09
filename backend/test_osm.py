import osmnx as ox
import traceback

def extract_village_infrastructure(lat, lon, radius=200):
    print(f"Extracting infrastructure within {radius} meters of {lat}, {lon}...")
    
    # 1. Download Buildings within the radius
    try:
        buildings = ox.features_from_point((lat, lon), tags={'building': True}, dist=radius)
        if not buildings.empty:
            print(f"✅ Found {len(buildings)} buildings within {radius}m.")
            # Print the first few building footprints
            print(buildings[['geometry']].head(3))
        else:
            print(f"⚠️ No buildings found within {radius}m.")
    except Exception as e:
        print(f"Failed to fetch buildings: {e}")

    # 2. Download Roads / Drive network within the radius
    try:
        # network_type can be 'all', 'drive', 'walk', 'bike'
        G = ox.graph.graph_from_point((lat, lon), dist=radius, network_type="all")
        print(f"\n✅ Found Road Network graph: {G.number_of_nodes()} nodes and {G.number_of_edges()} edges within {radius}m.")
    except Exception as e:
        print(f"Failed to fetch road network: {e}")

    # 3. Download Waterways / Drainage
    try:
        waterways = ox.features_from_point(
            (lat, lon), 
            tags={'waterway': True, 'natural': ['water', 'wetland']}, 
            dist=radius
        )
        if not waterways.empty:
            print(f"\n✅ Found {len(waterways)} waterway/drainage features within {radius}m.")
        else:
            print(f"\n⚠️ No waterways found within {radius}m.")
    except Exception as e:
        pass


if __name__ == "__main__":
    # Test Coordinates: Munnar, Kerala (A hilly town/village area prone to landslides/flooding)
    TEST_LAT = 10.0889
    TEST_LON = 77.0595
    
    # Alternatively, you can use the bounding box logic you pasted:
    # bbox = -122.43, 37.78, -122.41, 37.79
    # G = ox.graph.graph_from_bbox(bbox, network_type="drive_service")
    
    extract_village_infrastructure(TEST_LAT, TEST_LON, radius=200)
