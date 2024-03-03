from flask import Flask, render_template, jsonify, request
import duckdb
import geopandas as gpd
import json

from utils import *

app = Flask(__name__)

# Database connection
con = duckdb.connect(database='data/my_spatial_db.duckdb', read_only=True)
con.execute("INSTALL 'spatial';")
con.execute("LOAD 'spatial';")

@app.route('/')
def index():
    # Serve the main page with the Mapbox GL JS map
    return render_template('index.html')

def fetch_density_data(table_name):
    # Get bounding box parameters from the request
    bbox = request.args.get('bbox', '')
    if bbox:
        bbox = [float(coord) for coord in bbox.split(',')]
        bbox_polygon = f"POLYGON(({bbox[0]} {bbox[1]}, {bbox[2]} {bbox[1]}, {bbox[2]} {bbox[3]}, {bbox[0]} {bbox[3]}, {bbox[0]} {bbox[1]}))"
    else:
        # Default bounding box that covers the whole world if not specified
        bbox_polygon = "POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))"

    query = f"""
    SELECT GEOID, ppl_densit, ST_AsText(geom) AS geom_wkt
    FROM {table_name}
    WHERE ST_Intersects(geom, ST_GeomFromText('{bbox_polygon}'));
    """

    query_result = con.execute(query).fetchdf()

    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    gdf.drop(columns=['geom_wkt'], inplace=True)
    
    geojson_data = json.loads(gdf.to_json())
    
    return jsonify(geojson_data)


@app.route('/state_density_data')
def state_density_data():
    return fetch_density_data('state_ppl_density')

@app.route('/county_density_data')
def county_density_data():
    return fetch_density_data('w_county_ppl_density')

@app.route('/tract_density_data')
def tract_density_data():
    return fetch_density_data('wa_tract_ppl_density')

@app.route('/stats_in_view')
def stats_in_view():
    try:
        minLon = request.args.get('minLon', type=float)
        minLat = request.args.get('minLat', type=float)
        maxLon = request.args.get('maxLon', type=float)
        maxLat = request.args.get('maxLat', type=float)

        # Ensure spatial extension is loaded
        con.execute("LOAD 'spatial';")

        # Query to calculate average and median
        stats_query = f"""
        SELECT 
            AVG(median_inc) AS average_income, 
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_inc) AS median_income
        FROM seattle_pop_income
        WHERE ST_Intersects(geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}))
        """

        result = con.execute(stats_query).fetchdf()

        if result.empty:
            return jsonify({"average_income": 0, "median_income": 0})

        # Extracting the first row as it contains our results
        stats = result.iloc[0].to_dict()

        return jsonify(stats)
    except Exception as e:
        print(f"Error in stats_in_view: {e}")
        return jsonify({"error": "An error occurred processing your request."}), 500
    

if __name__ == '__main__':
    app.run(debug=True)
