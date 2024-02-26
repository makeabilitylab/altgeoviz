mapboxgl.accessToken = 'pk.eyJ1IjoiY3Jlc2NlbmRvY2h1IiwiYSI6ImNpdGR5MWZ5aDAycjIyc3A5ZHoxZzRwMGsifQ.nEaSxm520v7TpKAy2GG_kA'; 
var map = new mapboxgl.Map({
    container: 'map',
    // style: 'mapbox://styles/crescendochu/clhdvk3i400ea01rhep06ap9r',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-122.335167, 47.608013], // Seattle coordinates
    zoom: 10
});

function updateHighlight() {
    var bounds = map.getBounds();
    var url = `/polygons_in_view?minLon=${bounds.getWest()}&minLat=${bounds.getSouth()}&maxLon=${bounds.getEast()}&maxLat=${bounds.getNorth()}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                var feature = {
                    type: 'Feature',
                    properties: data[0].properties,
                    geometry: data[0].geometry
                };

                if (map.getSource('highlight')) {
                    map.getSource('highlight').setData({ type: 'FeatureCollection', features: [feature] });
                } else {
                    map.addSource('highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [feature] } });
                    map.addLayer({
                        id: 'highlight',
                        type: 'fill',
                        source: 'highlight',
                        paint: {
                            'fill-color': '#B2D235',
                            'fill-opacity': 0.8
                        }
                    });
                }
            }
        })
        .catch(error => console.error('Error fetching highlight data:', error));
}

map.on('load', function () {
    fetch('/seattle_pop_income_data')
        .then(response => response.json())
        .then(data => {
            map.addSource('seattle', {
                type: 'geojson',
                data: data
            });

            map.addLayer({
                id: 'seattle-layer',
                type: 'fill',
                source: 'seattle',
                paint: {
                    'fill-color': '#88C0D0',
                    'fill-opacity': 0.2,
                }
            });

            map.addLayer({
                id: 'seattle-outline',
                type: 'line',
                source: 'seattle', // Use the same source as your fill layer
                layout: {},
                paint: {
                    'line-color': '#88C0D0',
                    'line-width': 1 // Set the thickness of the border
                }
            });

            // Call updateHighlight here to ensure it's only called after the map is loaded
            updateHighlight();
        })
        .catch(error => console.error('Error loading GeoJSON data:', error));
});

// Attach updateHighlight to moveend event after map is loaded
map.on('moveend', updateHighlight);
