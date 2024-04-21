from flask import Flask, render_template, jsonify, request, session,g
import duckdb
import geopandas as gpd
import json
import utils
import os
import reverse_geocoder as rg
import uuid
import pytz
from datetime import datetime  

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi


app = Flask(__name__)
app.secret_key = 'abc'
# app.logger.setLevel(logging.DEBUG)

pdt = pytz.timezone('America/Los_Angeles')

# Database connection
con = duckdb.connect(database='data/my_spatial_db.duckdb', read_only=True)
con.execute("INSTALL 'spatial';")
con.execute("LOAD 'spatial';")


# mongo_url = app.config['MONGO_URL']
mongo_url = os.getenv('MONGO_URL', 'mongodb+srv://chuchuli:GiUlmbOEHSWc66OG@accessiblemap.lsu6nk2.mongodb.net/?retryWrites=true&w=majority&appName=AccessibleMap')

client = MongoClient(mongo_url)
db = client.get_database('accessible_map') 
collection = db['logs']


@app.route('/log', methods=['POST'])
def log_event():
    try:
        data = request.get_json()
        
        document = {
            "uuid": data.get('uuid', str(uuid.uuid4())),
            "user_id": data.get('user_id', None),
            # "session_id": data.get('session_id', None),
            "session_id": session.get('session_id', None),
            "page": session.get('page', None),
            "timestamp": data.get('timestamp', datetime.now(pdt).isoformat()),
            "key_stroke": data.get('key_stroke', None),
            "zoom_level": data.get('zoom_level', None),
            "lng": data.get('lng', None),
            "lat": data.get('lat', None),
            "stats": data.get('stats', {}),
        }
        
        collection.insert_one(document)
        print("Success ...")
        return jsonify({"status": "success", "message": "Event logged"}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"status": "error", "message": "Error logging event"}), 500


def get_viewport_params():
    if 'viewport' not in g:
        g.viewport = {
            'screen_left': request.args.get('screenLeft', type=float),
            'screen_right': request.args.get('screenRight', type=float),
            'screen_top': request.args.get('screenTop', type=float),
            'screen_bottom': request.args.get('screenBottom', type=float),
            'zoom_level': request.args.get('zoom', type=float)
        }
    return g.viewport


# Helper function to construct location strings based on zoom level
def construct_location(location, zoom_level):
    table = {
        "CA": "Canada",
        "PR": "Puerto Rico",
        "MX": "Mexico",
        "BS": "The Bahamas",
        "TC": "Turks and Caicos Islands",
        "VG": "British Virgin Islands",
        "CU": "Cuba",
        "BM": "Bermuda",
        "": "undefined"
    }
    if zoom_level >= 6:
        if location['cc'] != 'US':
            return f"{location['name']}, {table[location['cc']]}"
        return f"{location['admin2']}, {location['admin1']}"
    else:
        if location['cc'] != 'US':
            return f"{location['admin1']}, {table[location['cc']]}"
        return f"{location['admin1']}, {location['cc']}"
    


@app.route('/')
def index():
    if 'session_id' not in session or 'page' not in session or session['page'] != "index":
        session['session_id'] = str(uuid.uuid4())
        session['page'] = "index"
        session.permanent = True
        
    return render_template('index.html')

# @app.route('/experiment')
# def experiment():
#     # Serve the main page with the Mapbox GL JS map
#     return render_template('experiment.html')


@app.route('/walk')
def experiment():
    if 'session_id' not in session or 'page' not in session or session['page'] != "walk":
        session['session_id'] = str(uuid.uuid4())
        session['page'] = "walk"
        session.permanent = True
    
    return render_template('walk.html')

def fetch_density_data(table_name, accuracy, value_column='ppl_densit'):
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
    SELECT GEOID, {value_column}, ST_AsText(ST_Simplify(geom, {accuracy} )) AS geom_wkt
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
    accuracy = 0.01
    return fetch_density_data('state', accuracy, "ppl_densit")

@app.route('/county_density_data')
def county_density_data():
    accuracy = 0.001
    return fetch_density_data('county', accuracy, "ppl_densit")

@app.route('/state_walk_data')
def state_walk_data():
    accuracy = 0.01
    return fetch_density_data('state', accuracy, "walk_to_wo")

@app.route('/county_walk_data')
def county_walk_data():
    accuracy = 0.001
    return fetch_density_data('county', accuracy, "walk_to_wo")

# @app.route('/tract_density_data')
# def tract_density_data():
#     accuracy = 0.001
#     return fetch_density_data('wa_tract', accuracy)


@app.route('/get_state')
def get_state():
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)
    zoom = request.args.get('zoom', type=float)  # Capture zoom level as an integer.
    print(f"Received lat: {lat}, lon: {lon}, zoom: {zoom}")  # Debug print

    if zoom >= 6:
        # Fetch county and state information
        query = """
        SELECT county_nam, state_name
        FROM county
        WHERE ST_Contains(geom, ST_Point(?, ?));
        """
    else:
        # Fetch state information
        query = """
        SELECT state_name
        FROM state
        WHERE ST_Contains(geom, ST_Point(?, ?));
        """

    result = con.execute(query, (lon, lat)).fetchdf()

    if not result.empty:
        if zoom >= 6:
            # Return both county and state names if zoom level is greater than 6
            county_name = result['county_nam'].iloc[0]
            state_name = result['state_name'].iloc[0]
            return jsonify({"county": county_name, "state": state_name})
        else:
            # Return only the state name if zoom level is 6 or less
            return jsonify({"state": result['state_name'].iloc[0]})
    else:
        return jsonify({"state": "No state found"})





def reverse_helper(lon, lat): 
    result = rg.search((lat, lon))
    return result[0]

def reverse_geocode(screen_left, screen_right, screen_top, screen_bottom, zoom_level):
    top_left = (screen_top, screen_left)
    top_right = (screen_top, screen_right)
    bottom_left = (screen_bottom, screen_left)
    bottom_right = (screen_bottom, screen_right)
    
    try:
        top_left_res, top_right_res, bottom_left_res, bottom_right_res = rg.search([top_left, top_right, bottom_left, bottom_right])
    except RuntimeError as e:
        print(f"Error using multiprocessing in reverse geocoding: {e}")
        # Fallback to single-process method if multiprocessing fails
        top_left_res, top_right_res, bottom_left_res, bottom_right_res = [rg.search_single(loc) for loc in [top_left, top_right, bottom_left, bottom_right]]

    
    # Constructing location description for each corner using the helper
    top_left_location = construct_location(top_left_res, zoom_level)
    top_right_location = construct_location(top_right_res, zoom_level)
    bottom_left_location = construct_location(bottom_left_res, zoom_level)
    bottom_right_location = construct_location(bottom_right_res, zoom_level)
    
    # Construct the response
    response = f"The current view is bounded by {top_left_location} on the top-left, {top_right_location} on the top-right, {bottom_right_location} on the bottom-right, and {bottom_left_location} on the bottom-left."
    
    return response


@app.route('/stats_in_view')
def stats_in_view():

    viewport = get_viewport_params()
    min_lon = viewport['screen_left']
    min_lat = viewport['screen_bottom']
    max_lon = viewport['screen_right']
    max_lat = viewport['screen_top']
    zoom_level = viewport['zoom_level']
    value_column = request.args.get('value_column', 'ppl_densit')

    # geocode text 
    geotext = reverse_geocode(min_lon, max_lon, max_lat, min_lat, zoom_level)

    # Fetch the data from the map that is bounded by the min/max of longitude and latitude
    table_name = session.get('global_table_name', None)

    if table_name == "county":
        stats_query = f"""
        SELECT 
            GEOID, {value_column}, c_lat, c_lon, state_name, county_nam
        FROM {table_name}
        WHERE ST_Intersects(geom, ST_MakeEnvelope({min_lon}, {min_lat}, {max_lon}, {max_lat}));
        """
    else:
        stats_query = f"""
        SELECT 
            GEOID, {value_column}, c_lat, c_lon, state_name
        FROM {table_name}
        WHERE ST_Intersects(geom, ST_MakeEnvelope({min_lon}, {min_lat}, {max_lon}, {max_lat}));
        """
    result = con.execute(stats_query).fetchdf()

    map_instance = utils.Map(min_lon, min_lat, max_lon, max_lat)
    polygons = []
    for index, row in result.iterrows():
        if 'county_nam' not in row:
            
            polygon = utils.Polygon(
                row['GEOID'],
                float(row[f"{value_column}"]), # doesn't need to change ppl_density in polygon
                (float(row['c_lon']), float(row['c_lat'])),
                row['state_name']
                )
        else:
            polygon = utils.Polygon(
                row['GEOID'],
                float(row[f"{value_column}"]),
                (float(row['c_lon']), float(row['c_lat'])),
                row['state_name'],
                row['county_nam']
                )
        polygons.append(polygon)
        
    map_instance.set_polygons(polygons)
    map_instance.calculate_section_densities()
    map_instance.rank_sections()
    map_instance.find_high_density_clusters()    
    map_min = map_instance.find_min()
    map_max = map_instance.find_max()

    

    return jsonify({
        "geocode": geotext, 
        "trends": map_instance.trends,
        "min": {
            "value": map_min['ppl_densit'],
            # "text": construct_location(reverse_helper(map_min['centroid'][0], map_min['centroid'][1]), zoom_level),
            "text": map_min['state_name'],
            "section": map_min['section']
        },
        "max": {
            "value": map_max['ppl_densit'],
            # "text": construct_location(reverse_helper(map_max['centroid'][0], map_max['centroid'][1]), zoom_level),
            "text": map_max['state_name'],
            "section": map_max['section']
        },
        "average": map_instance.calculate_mean()
    })
    


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)