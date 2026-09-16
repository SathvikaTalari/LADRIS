# GIS Coordinate Integration Guide

## Current GIS Support

The system includes:
- `geom` column in `projects` table (TEXT type storing WKT/GeoJSON)
- `/dashboard/gis-projects` endpoint returning geometry
- PostGIS optional but recommended for spatial queries
- Sample seed data includes geometry (though currently placeholder)

## Option 1: Use Existing Coordinates (Recommended)

If your source data already contains latitude/longitude:

### For CSV/API Sources
Add to your field mapping:
```yaml
# In your source YAML config:
geom: "WELL_KNOWN_TEXT_OR_GEOJSON_COLUMN"
# Example:
# geom: "the_geom"
# or for separate lat/lon:
# latitude: "LATITUDE_COLUMN"
# longitude: "LONGITUDE_COLUMN"
```

### For Database Sources
Modify your SELECT query:
```sql
SELECT
  ...,
  ST_AsText(geom) AS geom,  -- Convert PostGIS geometry to WKT
  -- OR separate columns:
  ST_X(geom) AS longitude,
  ST_Y(geom) AS latitude
FROM your_table
```

### ETL Processing
The ETL pipeline (`app/etl/pipeline.py`) will:
1. Store `geom` as WKT string in TEXT column
2. Make it available via `/dashboard/gis-projects`
3. The ML model can use latitude/longitude as numeric features if mapped

## Option 2: Add PostGIS for Advanced Spatial Queries

### Enable PostGIS Extension
```bash
# In Docker container:
docker exec <container_id> psql -U postgres -d land_delay -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Or manually:
psql -U postgres -d land_delay -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Update Schema (Optional)
You can change the `geom` column to proper PostGIS type:
```sql
ALTER TABLE projects 
ALTER COLUMN geom TYPE GEOMETRY(POINT, 4326) 
USING ST_GeomFromText(geom, 4326);
```

### Spatial Queries Example
```sql
-- Find projects within 10km of a point
SELECT p.* 
FROM projects p
WHERE ST_DWithin(
    p.geom::geometry,
    ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326),  -- Bangalore
    10000  -- meters
);
```

## Option 3: Geocode from Administrative Boundaries

If you only have district/state names:

### Simple Approach (Python)
```python
from geopy.geocoders import Nominatim
geolocator = Nominatim(user_agent="land-delay-predictor")

def geocode_district(state, district):
    location = geolocator.geocode(f"{district}, {state}, India")
    if location:
        return location.latitude, location.longitude
    return None, None
```

### Batch Processing
1. Extract unique (state, district) pairs from `projects` table
2. Geocode using Nominatim or government GIS APIs
3. Update `geom` column:
   ```sql
   UPDATE projects 
   SET geom = 'POINT(lon lat)' 
   WHERE district = ? AND state = ?
   ```

### Government GIS Sources
- **Bhuvan** (ISRO): https://bhuvan.nrsc.gov.in/
- **India Water Resources Information System**: https://indiawris.gov.in/
- **State Spatial Data Infrastructures**

## Using GIS in Dashboards

### Power BI
1. Import data from `/dashboard/gis-projects`
2. Ensure geometry column is recognized as spatial
3. Use Map visual → Set Location to geometry field
4. Size/Color by risk_score or predicted_delay_days

### Superset
1. Enable "geospatial" in dataset settings
2. Use deck.gl or Kepler.gl visualizations
3. Mapbox integration available

### Grafana
- Use WorldPing panel or Tileset with geojson
- SimpleJSON datasource supports geojson features

## Sample Geometry Formats Accepted

### WKT (Well-Known Text)
```
POINT(77.5946 12.9716)
LINESTRING(77.5 12.9, 77.6 13.0)
POLYGON((77.5 12.9, 77.6 12.9, 77.6 13.0, 77.5 13.0, 77.5 12.9))
```

### GeoJSON
```json
{
  "type": "Point",
  "coordinates": [77.5946, 12.9716]
}
```

## Validation

Check geometry ingestion:
```sql
SELECT geom FROM projects WHERE geom IS NOT NULL LIMIT 5;
```

Test endpoint:
```bash
curl -s "http://localhost:8000/dashboard/gis-projects" | jq '.[0].geometry'
```

## Performance Tips

1. Index geometry column if using PostGIS:
   ```sql
   CREATE INDEX idx_projects_geom ON projects USING GIST (geom);
   ```

2. For large datasets, consider materialized view for dashboard queries

3. Cache geocoding results to avoid rate limits