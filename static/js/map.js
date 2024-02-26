mapboxgl.accessToken = 'pk.eyJ1IjoiY3Jlc2NlbmRvY2h1IiwiYSI6ImNpdGR5MWZ5aDAycjIyc3A5ZHoxZzRwMGsifQ.nEaSxm520v7TpKAy2GG_kA'; 
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/crescendochu/clhdvk3i400ea01rhep06ap9r',
    center: [-122.335167, 47.608013], // Seattle coordinates
    zoom: 10
});

map.on('load', function () {
    map.addSource('seattle', {
        type: 'geojson',
        data: '/seattle_pop_income_data'
    });

    map.addLayer({
        id: 'seattle-layer',
        type: 'fill',
        source: 'seattle',
        layout: {},
        paint: {
            'fill-color': '#088',
            'fill-opacity': 0.5,
            'fill-outline-color': 'white'
        }
    });

    updateHighlight();
});


function updateHighlight() {
    var bounds = map.getBounds();
    var url = `/polygons_in_view?minLon=${bounds.getWest()}&minLat=${bounds.getSouth()}&maxLon=${bounds.getEast()}&maxLat=${bounds.getNorth()}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                // Assuming data[0].geometry is the correct GeoJSON object
                // No need for JSON.parse if the server response is already an object
                var feature = {
                    type: 'Feature',
                    properties: data[0].properties, // Assuming properties are set correctly in the server response
                    geometry: data[0].geometry // Directly using the geometry object
                };

                if (map.getSource('highlight')) {
                    map.getSource('highlight').setData({ type: 'FeatureCollection', features: [feature] });
                } else {
                    map.addSource('highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [feature] } });
                    map.addLayer({
                        id: 'highlight',
                        type: 'fill',
                        source: 'highlight',
                        layout: {},
                        paint: {
                            'fill-color': '#00ff00', // Green
                            'fill-opacity': 0.5
                        }
                    });
                }
            }
        })
        .catch(error => console.error('Error fetching highlight data:', error));
}


map.on('load', updateHighlight);
map.on('moveend', updateHighlight);