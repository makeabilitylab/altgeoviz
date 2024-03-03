from flask import Flask, jsonify, request, render_template
import psycopg2
import psycopg2.extras
import json
import logging

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

            return jsonify(feature_collection)
        except Exception as e:
            return jsonify({"error": str(e)})
        finally:
            if conn:
                conn.close()
    else:
        return jsonify({"error": "Invalid bbox parameter"})

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

if __name__ == '__main__':
    app.run(debug=True)
