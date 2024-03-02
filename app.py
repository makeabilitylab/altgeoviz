# app.py

from flask import Flask, render_template, jsonify, request
import duckdb
import geopandas as gpd
import json

app = Flask(__name__)

#database connection
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
    # Adjust the query to include the median_inc column
    query_result = con.execute("SELECT GEOID10, ST_AsText(geom) AS geom_wkt, median_inc FROM seattle_pop_income").fetchdf()
    
    # Convert the query result to a GeoDataFrame. Specify the 'geom_wkt' column as the geometry source.
    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    
    # Drop the 'geom_wkt' column as it's no longer needed after conversion and to avoid sending redundant data
    gdf.drop(columns=['geom_wkt'], inplace=True)
    
    # Convert the GeoDataFrame to GeoJSON. This will include all remaining columns (GEOID10 and median_inc) in the properties of the GeoJSON features.
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
    

@app.route('/data_in_view')
def data_in_view():
    try:
        minLon = request.args.get('minLon', type=float)
        minLat = request.args.get('minLat', type=float)
        maxLon = request.args.get('maxLon', type=float)
        maxLat = request.args.get('maxLat', type=float)

        # Ensure spatial extension is loaded
        con.execute("LOAD 'spatial';")

        # Query for highlight polygons
        highlight_query = f"""
        (SELECT *, ST_AsGeoJSON(geom) AS geojson FROM seattle_pop_income
        WHERE ST_Intersects(geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}))
        ORDER BY median_inc DESC
        LIMIT 1)
        UNION ALL
        (SELECT *, ST_AsGeoJSON(geom) AS geojson FROM seattle_pop_income
        WHERE ST_Intersects(geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}))
        ORDER BY median_inc ASC
        LIMIT 1);
        """
        highlights_result = con.execute(highlight_query).fetchdf()

        # Prepare the GeoJSON data for the highlights
        geojson_highlights = [{
            "type": "Feature",
            "properties": {
                "GEOID10": row["GEOID10"],
                "pop_densit": row["pop_densit"],
                "median_inc": row["median_inc"]
            },
            "geometry": json.loads(row["geojson"])
        } for index, row in highlights_result.iterrows()]

        # Query to calculate average and median income
        stats_query = f"""
        SELECT 
            AVG(median_inc) AS average_income, 
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY median_inc) AS median_income
        FROM seattle_pop_income
        WHERE ST_Intersects(geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}));
        """
        stats_result = con.execute(stats_query).fetchdf()

        stats = {"average_income": 0, "median_income": 0} if stats_result.empty else stats_result.iloc[0].to_dict()

        # Combine both results into one response
        response_data = {
            "highlights": geojson_highlights,
            "stats": stats
        }

        return jsonify(response_data)
    except Exception as e:
        print(f"Error in data_in_view: {e}")
        return jsonify({"error": "An error occurred processing your request."}), 500


if __name__ == '__main__':
    app.run(debug=True)
