mapboxgl.accessToken = 'pk.eyJ1IjoiY3Jlc2NlbmRvY2h1IiwiYSI6ImNpdGR5MWZ5aDAycjIyc3A5ZHoxZzRwMGsifQ.nEaSxm520v7TpKAy2GG_kA';

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    center: [-98.5795, 39.8283],
    zoom: 4
});

function updateStats(sourceURL) {
    let bounds = map.getBounds();
    let url = `/stats_in_view?minLon=${bounds.getWest()}&minLat=${bounds.getSouth()}&maxLon=${bounds.getEast()}&maxLat=${bounds.getNorth()}&sourceURL=${sourceURL}`;
    console.log(url);
    fetch(url)
        .then(response => response.json())
        .then(data => {
            let content = 'Hello world! <br>';

            console.log(data);

            for (const [section, trends] of Object.entries(data)) {
                // Check if the 'high' trend exists for this section and add it to the content string
                if (trends.high && trends.high.length > 0) {
                    content += `<strong>${section} - High:</strong> Decision based on: ${trends.high.join(', ')}<br>`;
                }

                // Check if the 'low' trend exists for this section and add it to the content string
                if (trends.low && trends.low.length > 0) {
                    content += `<strong>${section} - Low:</strong> Decision based on: ${trends.low.join(', ')}<br>`;
                }
            }
            document.getElementById('stats-display').innerHTML = content;
        })
        .catch(error => console.error('Error fetching data:', error));
}

function fetchAndUpdateData() {
    var bounds = map.getBounds();
    var zoom = map.getZoom();
    var sourceURL = '/state_density_data'; // Default to state-level data

    if (zoom >= 7) {
        sourceURL = '/tract_density_data';
    } else if (zoom >= 5) {
        sourceURL = '/county_density_data';
    }

    // Construct the URL with bounds and zoom level if your API supports it
    var apiURL = `${sourceURL}?bbox=${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}&zoom=${zoom}`;

    map.getSource('stateDensity').setData(apiURL);

    // remove '/' from the beginning of the sourceURL
    updateStats(sourceURL.replace(/^\//, ''));
}

map.on('load', function () {
    map.addSource('stateDensity', {
        type: 'geojson',
        data: {
            "type": "FeatureCollection",
            "features": []
        } // Start with an empty GeoJSON FeatureCollection
    });

    map.addLayer({
        'id': 'density-layer',
        'type': 'fill',
        'source': 'stateDensity',
        'layout': {},
        'paint': {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'ppl_densit'],
                0, '#F2F12D',    
                36, '#EED322',   
                72, '#E6B71E',     
                124, '#DA9C20', 
                188, '#CA8323',   
                290, '#B86B25',   
                500, '#A25626',    
                750, '#8B4225',   
                1000, '#723122',  
            ],
            'fill-opacity': 0.75
        }
    });

    // Fetch and update data initially
    fetchAndUpdateData();

    // Update data on zoom end to avoid too many requests during zooming
    map.on('zoomend', fetchAndUpdateData);

    // Update data when the map is panned
    map.on('moveend', fetchAndUpdateData);
});
