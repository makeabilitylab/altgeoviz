from flask import Flask, jsonify, request, render_template
import psycopg2
import psycopg2.extras
import json

app = Flask(__name__)

# Database connection parameters
db_params = {
    'database': 'chuli',
    'user': 'chuli',
    'password': '1234',
    'host': 'localhost',
    'port': '5433'
}

def fetch_density_data(table_name):
    bbox = request.args.get('bbox', '')
    bbox_values = bbox.split(',') if bbox else []

    if len(bbox_values) == 4:
        min_lon, min_lat, max_lon, max_lat = map(float, bbox_values)
        try:
            conn = psycopg2.connect(**db_params)
            cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

            query = f"""
            SELECT geoid, ppl_densit, ST_AsGeoJSON(geom)::json AS geometry
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
    return fetch_density_data('population_density.state_ppl_density')

@app.route('/county_density_data', methods=['GET'])
def get_county_data():
    return fetch_density_data('population_density.w_county_ppl_density')

@app.route('/tract_density_data', methods=['GET'])
def get_tract_data():
    return fetch_density_data('population_density.wa_tract_ppl_density')

if __name__ == '__main__':
    app.run(debug=True)
