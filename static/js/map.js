mapboxgl.accessToken = 'pk.eyJ1IjoiY3Jlc2NlbmRvY2h1IiwiYSI6ImNpdGR5MWZ5aDAycjIyc3A5ZHoxZzRwMGsifQ.nEaSxm520v7TpKAy2GG_kA'; 
var map = new mapboxgl.Map({
    container: 'map',
    // style: 'mapbox://styles/crescendochu/clhdvk3i400ea01rhep06ap9r',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-122.335167, 47.608013], // Seattle coordinates
    zoom: 10
});

var popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});


function updateMapAndStats() {
    var bounds = map.getBounds();
    var url = `/data_in_view?minLon=${bounds.getWest()}&minLat=${bounds.getSouth()}&maxLon=${bounds.getEast()}&maxLat=${bounds.getNorth()}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const { highlights, stats } = data;

            // Update highlights
            if (highlights.length > 0) {
                map.getSource('highlight-max').setData({
                    type: 'FeatureCollection',
                    features: [highlights[0]]
                });
            } else {
                map.getSource('highlight-max').setData({ type: 'FeatureCollection', features: [] });
            }

            if (highlights.length > 1) {
                map.getSource('highlight-min').setData({
                    type: 'FeatureCollection',
                    features: [highlights[1]]
                });
            } else {
                map.getSource('highlight-min').setData({ type: 'FeatureCollection', features: [] });
            }

            // Update stats display, including max and min
            document.getElementById('stats-display').innerHTML = `
            <p>For the annual median household income per neighborhood in the current view: </p>
            <p>Average Income: <b>$${stats.average_income.toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0}).slice(1)} </b></p>
            <p>Median Income: <b>$${stats.median_income.toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0}).slice(1)}</b></p>
            <p>Maximum Median Income: <b>${highlights.length > 0 ? '$' + highlights[0].properties.median_inc.toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0}).slice(1) : 'N/A'}</b></p>
            <p>Minimum Median Income: <b>${highlights.length > 1 ? '$' + highlights[1].properties.median_inc.toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0}).slice(1) : 'N/A'} </b></p>
        `;        
        })
        .catch(error => console.error('Error fetching data:', error));
}



// map.on('mouseenter', 'seattle-layer', (e) => {
//     if (!e.features.length) {
//         return;
//     }
//     var feature = e.features[0];

//     // Debug: Log the properties of the hovered feature
//     console.log(feature.properties);

//     var medianIncome = feature.properties.median_inc || 'Data not available';
//     var GEOID10 = feature.properties.GEOID10 || 'Data not available';

//     var popupContent = `
//         <p>Median Household Income:</p> 
//         <p>${medianIncome.toLocaleString(undefined, {style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
//     `;

//     popup.setLngLat(e.lngLat)
//         .setHTML(popupContent)
//         .addTo(map);

//     map.getCanvas().style.cursor = 'pointer';
// });


// map.on('mouseleave', 'seattle-layer', () => {
//     // Remove the popup when the mouse leaves the layer area.
//     popup.remove();

//     // Reset the cursor style.
//     map.getCanvas().style.cursor = '';
// });




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

            map.addSource('highlight-max', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addLayer({
                id: 'highlight-max',
                type: 'fill',
                source: 'highlight-max',
                paint: {
                    'fill-color': '#B2D235', // Green for max
                    'fill-opacity': 0.8
                }
            });
        
            map.addSource('highlight-min', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            map.addLayer({
                id: 'highlight-min',
                type: 'fill',
                source: 'highlight-min',
                paint: {
                    'fill-color': '#EF6074', // Red for min
                    'fill-opacity': 0.8
                }
            });        

            updateMapAndStats();
            
        })
        .catch(error => console.error('Error loading GeoJSON data:', error));
});

// Attach updateHighlight to moveend event after map is loaded
map.on('moveend', function() {
    updateMapAndStats();
    // updateStatsDisplay();
    // updateHighlight();
});


