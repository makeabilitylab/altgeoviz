from flask import Flask, render_template, jsonify, request, session
import duckdb
import geopandas as gpd
import json
import time  
import logging
import utils
import reverse_geocoder as rg

app = Flask(__name__)
app.secret_key = 'abc'
app.logger.setLevel(logging.DEBUG)

# Database connection
con = duckdb.connect(database='data/my_spatial_db.duckdb', read_only=True)
con.execute("INSTALL 'spatial';")
con.execute("LOAD 'spatial';")


@app.route('/')
def index():
    # Serve the main page with the Mapbox GL JS map
    return render_template('index.html')

def fetch_density_data(table_name,accuracy):
    session["global_table_name"] = table_name
    # Get bounding box parameters from the request
    bbox = request.args.get('bbox', '')
    if bbox:
        bbox = [float(coord) for coord in bbox.split(',')]
        bbox_polygon = f"POLYGON(({bbox[0]} {bbox[1]}, {bbox[2]} {bbox[1]}, {bbox[2]} {bbox[3]}, {bbox[0]} {bbox[3]}, {bbox[0]} {bbox[1]}))"
    else:
        # Default bounding box that covers the whole world if not specified
        bbox_polygon = "POLYGON((-180 -90, 180 -90, 180 90, -180 90, -180 -90))"
    


    query = f"""
    SELECT GEOID, ppl_densit, ST_AsText(ST_Simplify(geom, {accuracy} )) AS geom_wkt
    FROM {table_name}
    WHERE ST_Intersects(geom, ST_GeomFromText('{bbox_polygon}'));
    """
    

    start_time = time.time()
    query_result = con.execute(query).fetchdf()

    end_time = time.time()
    
    load_time = end_time - start_time
    app.logger.debug(f"Data load time: {load_time:.3f} seconds")

    gdf = gpd.GeoDataFrame(query_result, geometry=gpd.GeoSeries.from_wkt(query_result['geom_wkt']))
    gdf.drop(columns=['geom_wkt'], inplace=True)
    
    geojson_data = json.loads(gdf.to_json())
    
    return jsonify(geojson_data)


@app.route('/state_density_data')
def state_density_data():
    accuracy = 0.01
    return fetch_density_data('state_ppl_density', accuracy)

@app.route('/county_density_data')
def county_density_data():
    accuracy = 0.01
    # return fetch_density_data('w_county_ppl_density', accuracy)
    return fetch_density_data('county', accuracy)

@app.route('/tract_density_data')
def tract_density_data():
    accuracy = 0.001
    return fetch_density_data('wa_tract_ppl_density', accuracy)

@app.route('/stats_in_view')
def stats_in_view():
    minLon = request.args.get('minLon', type=float)
    minLat = request.args.get('minLat', type=float)
    maxLon = request.args.get('maxLon', type=float)
    maxLat = request.args.get('maxLat', type=float)
    
    # fetch the data from the map that is bounded by the min/max of longitude and latitude
    table_name = session.get('global_table_name', None)
    stats_query = f"""
    SELECT 
        GEOID, ppl_densit, c_lat, c_lon, ST_AsGeoJSON(ST_Simplify(tn.geom, 0.001)) AS geom
    FROM {table_name} AS tn
    WHERE ST_Intersects(tn.geom, ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}));
    """
    
    result = con.execute(stats_query).fetchdf()
    
    map = utils.Map(minLon, minLat, maxLon, maxLat)
    polygons = []
    for index, row in result.iterrows():
        polygon = utils.Polygon(
            row['GEOID'], 
            float(row['ppl_densit']), 
            (float(row['c_lon']), float(row['c_lat'])),
            row['geom'])
        polygons.append(polygon)
        
    map.set_polygons(polygons)
    map.calculate_section_densities()
    map.rank_sections()
    map.find_high_density_clusters()    
    map_min = map.find_min()
    map_max = map.find_max()

    return jsonify({
        "trends": map.trends,
        "min": map_min['ppl_densit'],
        "max": map_max['ppl_densit'],
        "average": map.calculate_mean(),
        "median": map.calculate_median(),
        "highlights": {
            "min": {
                "type": "Feature",
                "properties": {
                    "geoid": map_min['geoid'],
                    "ppl_densit": map_min['ppl_densit']
                },
                "geometry": map_min['geom']
            },
            "max": {
                "type": "Feature",
                "properties": {
                    "geoid": map_max['geoid'],
                    "ppl_densit": map_max['ppl_densit']
                },
                "geometry": map_max['geom']
            }
        }
    })
    
@app.route('/reverse_geocode')
def reverse_geocode():
    table = {
        "CA": "Canada",
        "PR": "Puerto Rico",
        "": "undefined"
    }
    
    def construct_location(location, zoom_level=0):
        if zoom_level >= 7:
            return f"{location['name']}, {location['admin1']}"
        elif zoom_level >= 5:
            if location['cc'] != 'US':
                return f"{location['name']}, {table[location['cc']]}"
            return f"{location['admin2']}, {location['admin1']}"
        else: 
            if location['cc'] != 'US':
                return f"{location['admin1']}, {table[location['cc']]}"
            return f"{location['admin1']}, {location['cc']}"
        
    
    screen_left = request.args.get('minLon', type=float)
    screen_right = request.args.get('maxLon', type=float)
    screen_top = request.args.get('maxLat', type=float)
    screen_bottom = request.args.get('minLat', type=float)
    zoom_level = request.args.get('zoom', type=float)
    
    # screen_left = request.args.get('screen_left', type=float)
    # screen_right = request.args.get('screen_right', type=float)
    # screen_top = request.args.get('screen_top', type=float)
    # screen_bottom = request.args.get('screen_bottom', type=float)
    
    top_left = (screen_top, screen_left)
    top_right = (screen_top, screen_right)
    bottom_left = (screen_bottom, screen_left)
    bottom_right = (screen_bottom, screen_right)
    
    top_left_res, top_right_res, bottom_left_res, bottom_right_res = rg.search([top_left, top_right, bottom_left, bottom_right])
    
    # construct the response
    response = f"The current view is bounded by {construct_location(top_left_res, zoom_level)} on the top-left, {construct_location(top_right_res, zoom_level)} on the top-right, {construct_location(bottom_left_res, zoom_level)} on the bottom-left, and {construct_location(bottom_right_res, zoom_level)} on the bottom-right."
    
    return jsonify({
        "response": response
    })
    
if __name__ == '__main__':
    app.run(debug=True, port=5001)
