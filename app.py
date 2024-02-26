# app.py

from flask import Flask, render_template, jsonify, request
import duckdb
import geopandas as gpd
import json

app = Flask(__name__)

# Ensure you adjust the database connection string as needed
con = duckdb.connect(database='data/my_spatial_db.duckdb', read_only=True)
con.execute("INSTALL 'spatial';")
con.execute("LOAD 'spatial';")

@app.route('/')
def index():
    # Serve the main page with the Mapbox GL JS map
    return render_template('index.html')

@app.route('/seattle_pop_income_data')
def seattle_pop_income_data():
    con.execute("LOAD 'spatial';")  
    # Query the spatial data from DuckDB
    query_result = con.execute("SELECT GEOID10, ST_AsText(geom) AS geom_wkt FROM seattle_pop_income").fetchdf()
    # Convert the query result to a GeoDataFrame
    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    # Convert the GeoDataFrame to GeoJSON
    geojson_data = json.loads(gdf.to_json())
    return jsonify(geojson_data)

@app.route('/polygons_in_view')
def polygons_in_view():
    try:
        minLon = request.args.get('minLon', type=float)
        minLat = request.args.get('minLat', type=float)
        maxLon = request.args.get('maxLon', type=float)
        maxLat = request.args.get('maxLat', type=float)

        # Ensure spatial extension is loaded
        con.execute("LOAD 'spatial';")

        # Query for the maximum median income polygon
        max_query = f"""
        SELECT *, ST_AsGeoJSON(geom) AS geojson FROM seattle_pop_income
        WHERE ST_Intersects(geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}))
        ORDER BY median_inc DESC
        LIMIT 1
        """

        # Query for the minimum median income polygon
        min_query = f"""
        SELECT *, ST_AsGeoJSON(geom) AS geojson FROM seattle_pop_income
        WHERE ST_Intersects(geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}))
        ORDER BY median_inc ASC
        LIMIT 1
        """

        # Combine the queries
        combined_query = f"({max_query}) UNION ALL ({min_query});"

        result = con.execute(combined_query).fetchdf()

        if result.empty:
            return jsonify([])  # Return an empty list if no results

        # Prepare the GeoJSON data for the response
        geojson_data = [{
            "type": "Feature",
            "properties": {
                "GEOID10": row["GEOID10"],
                "pop_densit": row["pop_densit"],
                "median_inc": row["median_inc"]
            },
            "geometry": json.loads(row["geojson"])
        } for index, row in result.iterrows()]

        return jsonify(geojson_data)
    except Exception as e:
        print(f"Error in polygons_in_view: {e}")
        return jsonify({"error": "An error occurred processing your request."}), 500

  
if __name__ == '__main__':
    app.run(debug=True)
