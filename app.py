from flask import Flask, jsonify, request, render_template, session
import psycopg2
import psycopg2.extras
import json
import logging
import utils

app = Flask(__name__)
app.logger.setLevel(logging.DEBUG)

# Database connection parameters
db_params = {
    'database': 'chuli',
    'user': 'chuli',
    'password': '1234',
    'host': 'localhost',
    'port': '5433'
}

def fetch_density_data(table_name, zoom):
    app.logger.debug(f'Received zoom level: {zoom}')
    bbox = request.args.get('bbox', '')
    bbox_values = bbox.split(',') if bbox else []

    if len(bbox_values) == 4:
        min_lon, min_lat, max_lon, max_lat = map(float, bbox_values)
        # accuracy = 0.01 if zoom >=7, else if  else 0.0001 
        if zoom >= 7:
            accuracy = 0.00001
            app.logger.debug(f"Using accuracy {accuracy}")
        elif zoom >= 5:
            accuracy = 0.001
            app.logger.debug(f"Using accuracy {accuracy}") 
        else:
            accuracy = 0.01
            app.logger.debug(f"Using accuracy {accuracy}") 

        try:
            conn = psycopg2.connect(**db_params)
            cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            query = f"""
            SELECT geoid, ppl_densit, ST_AsGeoJSON(ST_Simplify(geom, {accuracy}))::json AS geometry
            FROM {table_name}
            WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326);
            """
            cursor.execute(query, (min_lon, min_lat, max_lon, max_lat))

            rows = cursor.fetchall()
            features = [
                {
                    "type": "Feature",
                    "properties": {
                        "geoid": row['geoid'],
                        "ppl_densit": float(row['ppl_densit']),  # Convert to float
                    },
                    "geometry": row['geometry']
                } for row in rows
            ]

            feature_collection = {
                "type": "FeatureCollection",
                "features": features
            }
            
            # session['global_table_name'] = table_name
            return jsonify(feature_collection)
        except Exception as e:
            return jsonify({"error": str(e)})
        finally:
            if conn:
                conn.close()
    else:
        return jsonify({"error": "Invalid bbox parameter"})

@app.route('/geometry_bounds', methods=['GET'])
def get_geometry_bounds():
    table_name = request.args.get('table_name')
    if not table_name:
        return jsonify({"error": "Table name parameter is missing"})

    try:
        conn = psycopg2.connect(**db_params)
        cursor = conn.cursor()

        # Assuming the geometry column is named 'geom'
        query = f"""
        SELECT ST_AsText(ST_Extent(geom)) AS bbox
        FROM {table_name};
        """
        cursor.execute(query)
        bbox_text = cursor.fetchone()[0]

        if bbox_text:
            # Convert the bbox text into a more usable format, if needed
            bbox_values = bbox_text.strip('BOX()').split(',')
            min_corner, max_corner = bbox_values
            min_lon, min_lat = map(float, min_corner.split(' '))
            max_lon, max_lat = map(float, max_corner.split(' '))

            bbox = {
                "min_lon": min_lon,
                "min_lat": min_lat,
                "max_lon": max_lon,
                "max_lat": max_lat
            }
            return jsonify(bbox)
        else:
            return jsonify({"error": "Could not retrieve the bounding box"})
    except Exception as e:
        return jsonify({"error": str(e)})
    finally:
        if conn:
            conn.close()


@app.route('/')
def index():
    # Serve the main page with the Mapbox GL JS map
    return render_template('index.html')

@app.route('/state_density_data', methods=['GET'])
def get_state_data():
    zoom = request.args.get('zoom', default=5, type=int) 
    return fetch_density_data('population_density.state_ppl_density',zoom)

@app.route('/county_density_data', methods=['GET'])
def get_county_data():
    zoom = request.args.get('zoom', default=5, type=int) 
    return fetch_density_data('population_density.w_county_ppl_density',zoom)

@app.route('/tract_density_data', methods=['GET'])
def get_tract_data():
    zoom = request.args.get('zoom', default=5, type=int) 
    return fetch_density_data('population_density.wa_tract_ppl_density', zoom)

@app.route('/stats_in_view', methods=['GET'])
def stats_in_view():
    minLon = request.args.get('minLon', type=float)
    minLat = request.args.get('minLat', type=float)
    maxLon = request.args.get('maxLon', type=float)
    maxLat = request.args.get('maxLat', type=float)

    sourceURL = request.args.get('sourceURL', None)
    if sourceURL == "state_density_data":
        table_name = 'population_density.state_ppl_density'
    elif sourceURL == "county_density_data":
        table_name = 'population_density.w_county_ppl_density'
    elif sourceURL == "tract_density_data":
        table_name = 'population_density.wa_tract_ppl_density'
    else:
        return jsonify({"error": "Invalid sourceURL parameter"})
    
    # table_name = session.get('global_table_name', None)
    if table_name is None:
        return jsonify({"error": "No table name found in session"})
    
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    query = f"""
        SELECT 
            GEOID, ppl_densit, c_lat, c_lon
        FROM {table_name} AS tn
        WHERE ST_Intersects(tn.geom, ST_SetSRID(ST_MakeEnvelope({minLon}, {minLat}, {maxLon}, {maxLat}), 4269));
        """

    
    cursor.execute(query, (minLon, minLat, maxLon, maxLat))
    rows = cursor.fetchall()

    map = utils.Map(minLon, minLat, maxLon, maxLat)
    polygons = []
    
    for row in rows:
        polygon = utils.Polygon(row['geoid'], float(row['ppl_densit']), (float(row['c_lon']), float(row['c_lat'])))
        polygons.append(polygon)
        
    map.set_polygons(polygons)
    map.calculate_section_densities()
    map.rank_sections()
    map.find_high_density_clusters()
    
    return jsonify(map.trends)

if __name__ == '__main__':
    app.run(debug=True)
