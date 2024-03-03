
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

@app.route('/state_density_data')
def state_density_data():
    query = """
    SELECT GEOID, state_name, ppl_densit, c_lat, c_lon, ST_AsText(geom) AS geom_wkt
    FROM state_ppl_density;
    """
    query_result = con.execute(query).fetchdf()

    #convert the query result to a GeoDataFrame. Specify the 'geom_wkt' column as the geometry source.
    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    #drop the 'geom_wkt' column as it's no longer needed after conversion and to avoid sending redundant data
    gdf.drop(columns=['geom_wkt'], inplace=True)
    
    geojson_data = json.loads(gdf.to_json())
    
    return jsonify(geojson_data)


@app.route('/county_density_data')
def county_density_data():
    query = """
    SELECT GEOID, ppl_densit, ST_AsText(geom) AS geom_wkt
     FROM w_county_ppl_density;
    """
    query_result = con.execute(query).fetchdf()

    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    
    gdf.drop(columns=['geom_wkt'], inplace=True)
    
    geojson_data = json.loads(gdf.to_json())
    
    return jsonify(geojson_data)



@app.route('/tract_density_data')
def tract_density_data():
    query = """
    SELECT GEOID, ppl_densit, ST_AsText(geom) AS geom_wkt
    FROM wa_tract_ppl_density;
    """

    query_result = con.execute(query).fetchdf()

    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    
    gdf.drop(columns=['geom_wkt'], inplace=True)
    
    geojson_data = json.loads(gdf.to_json())
    
    return jsonify(geojson_data)


if __name__ == '__main__':
    app.run(debug=True)
