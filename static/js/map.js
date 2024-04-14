mapboxgl.accessToken = 'pk.eyJ1IjoiY3Jlc2NlbmRvY2h1IiwiYSI6ImNpdGR5MWZ5aDAycjIyc3A5ZHoxZzRwMGsifQ.nEaSxm520v7TpKAy2GG_kA';

const bounds = [
    [-128.0, 22.0], // Southwest
    [-64.0, 52.0]   // Northeast
];

var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
    center: [-98.5795, 39.8283],
    dragRotate: false,
    zoom: 4,
    maxBounds: bounds,
});

//disable map rotation and changing pitch
window.addEventListener('keydown', function(event) {
    console.log("Event captured: ", event.key, "Shift pressed: ", event.shiftKey);
    if (event.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        console.log("Blocking this event");
        event.preventDefault();
        event.stopPropagation();
    }
}, true);

function calculateColor(value, min, max) {
    const colors = [
        { threshold: 0, color: '#F2F12D' },
        { threshold: 36, color: '#EED322' },
        { threshold: 72, color: '#E6B71E' },
        { threshold: 124, color: '#DA9C20' },
        { threshold: 188, color: '#CA8323' },
        { threshold: 290, color: '#B86B25' },
        { threshold: 500, color: '#A25626' },
        { threshold: 750, color: '#8B4225' },
        { threshold: 1000, color: '#723122' },
        { threshold: 1500, color: '#79264E' },
    ];
    const normalizedValue = (value - min) / (max - min);
    const maxThreshold = colors[colors.length - 1].threshold;
    const normalizedThreshold = normalizedValue * maxThreshold;
    for (let i = 0; i < colors.length - 1; i++) {
        if (normalizedThreshold >= colors[i].threshold && normalizedThreshold < colors[i + 1].threshold) {
            return colors[i].color;
        }
    }
    return colors[colors.length - 1].color;
}


REGION_MAP = {
    "NW": "Northwest",
    "NE": "Northeast",
    "SW": "Southwest",
    "SE": "Southeast",
    "W": "West",
    "E": "East",
    "N": "North",
    "S": "South",
    "C": "Central",
    "left_diagonal": "diagonally from Northwest to Southeast",
    "right_diagonal": "diagonally from Southwest to Northeast",
    "horizontal": "horizontally across the center",
    "vertical": "vertically through the center"
}

function updateStats(sourceURL) {
    let bounds = map.getBounds();
    let url = `/stats_in_view?minLon=${bounds.getWest()}&minLat=${bounds.getSouth()}&maxLon=${bounds.getEast()}&maxLat=${bounds.getNorth()}&sourceURL=${sourceURL}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            // highlights 
            console.log(data.highlights.max.geometry);
               
                if(data.highlights.max) {
                    
                    map.getSource('highlight-max').setData({
                        type: 'FeatureCollection',
                        features: [data.highlights.max]
                    });
                } else {
                    map.getSource('highlight-max').setData({
                        type: 'FeatureCollection',
                        features: []
                    });
                }

                if(data.highlights.min) {
                    map.getSource('highlight-min').setData({
                        type: 'FeatureCollection',
                        features: [data.highlights.min]
                    });
                } else {
                    map.getSource('highlight-min').setData({
                        type: 'FeatureCollection',
                        features: []
                    });
                }

            // stats + alt text
            let content = '<p>In the current view, the spatial trends are:</p>';

            console.log(data);
            
            let highs = [];
            let lows = [];
            for (const [section, trends] of Object.entries(data.trends)) {
                if (trends.high && trends.high.length > 0) {
                    highs.push(section);
                }
                if (trends.low && trends.low.length > 0) {
                    lows.push(section);
                }
            }

            if (highs.length > 0) {
                content += '- Population density is high ';
                highs.forEach((section, index) => {
                    // Check if the section is one of the special cases
                    if (["left_diagonal", "right_diagonal", "horizontal", "vertical"].includes(section)) {
                        // For special cases, add directly without "in the"
                        if (index === 0) { // First item or single item
                            content += `${REGION_MAP[section]}`;
                        } else if (index === highs.length - 1) { // Last item
                            content += `${highs.length > 1 ? ', and ' : ' and '}${REGION_MAP[section]}`;
                        } else { // Middle items
                            content += `, ${REGION_MAP[section]}`;
                        }
                    } else {
                        // For regular cases, start with "in the"
                        if (index === 0) {
                            content += `in the ${REGION_MAP[section]}`;
                        } else if (index === highs.length - 1) { // Last item
                            content += `${highs.length > 1 ? ', and the ' : ' and the '}${REGION_MAP[section]}`;
                        } else { // Middle items
                            content += `, the ${REGION_MAP[section]}`;
                        }
                    }
                });
                content += `.</p>`;
            } else {
                content += '<p>- No regions with particularly high population density.</p>';
            }

            if (lows.length > 0) {
                content += '- Population density is low ';
                lows.forEach((section, index) => {
                    // Check if the section is one of the special cases
                    if (["left_diagonal", "right_diagonal", "horizontal", "vertical"].includes(section)) {
                        // For special cases, add directly without "in the"
                        if (index === 0) { // First item or single item
                            content += `${REGION_MAP[section]}`;
                        } else if (index === lows.length - 1) { // Last item
                            content += `${lows.length > 1 ? ', and ' : ' and '}${REGION_MAP[section]}`;
                        } else { // Middle items
                            content += `, ${REGION_MAP[section]}`;
                        }
                    }
                    else {
                        // For regular cases, start with "in the"
                        if (index === 0) {
                            content += `in the ${REGION_MAP[section]}`;
                        } else if (index === lows.length - 1) { // Last item
                            content += `${lows.length > 1 ? ', and the ' : ' and the '}${REGION_MAP[section]}`;
                        } else { // Middle items
                            content += `, the ${REGION_MAP[section]}`;
                        }
                    }
                }); 
                content += `.</p>`;
            } else {
                content += '<p>- No regions with particularly low population density.</p>';
            }


            content += `<p>In the current view, 
            the <b>average</b> population density is ${data.average != null ? parseFloat(data.average).toFixed(2) : 'Not available'} per square mile, 
            the <b>median</b> is ${data.median != null ? parseFloat(data.median).toFixed(2) : 'Not available'}, 
            the <b>maximum</b> is ${data.max != null ? parseFloat(data.max).toFixed(2) : 'Not available'},
            the <b>minimum</b> is ${data.min && data.min != null ? parseFloat(data.min).toFixed(2) : 'Not available'}.</p>`;

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

    map.on('data', function (e) {
        if (e.sourceId === 'stateDensity' && e.isSourceLoaded) {
            map.off('data', arguments.callee);
            updateStats(sourceURL.replace(/^\//, ''));
        }
    });
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
                0, '#F6D2A9',
                50, '#F5B78E',
                100, '#F19C7C',
                250, '#EA8171',
                500, '#DD686C',
                750, '#CA5268',
                1000, '#B13F64',
                2000, '#9C3F5D',
                5000, '#853F56',
            ],
            'fill-opacity': 0.75
        }
    });

    map.addSource('highlight-max', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({
        id: 'highlight-max-outline',
        type: 'line',
        source: 'highlight-max',
        layout: {},
        paint: {
            'line-color': '#B2D235',
            'line-width': 2 
        }
    });

    map.addSource('highlight-min', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'highlight-min',
        type: 'line',
        source: 'highlight-min',
        paint: {
            'line-color': '#EF6074', // Red for min
            'line-width': 2
        }
    });        

    // Fetch and update data initially
    fetchAndUpdateData();


    map.on('data', function (e) {
        if (e.sourceId !== 'stateDensity' || !e.isSourceLoaded) return;
    
        let data = map.querySourceFeatures('stateDensity');
    
        let min = Math.min(...data.map(f => f.properties.ppl_densit));
        let max = Math.max(...data.map(f => f.properties.ppl_densit));

        const colorStops = [
            0, '#F6D2A9',
            25, '#F5B78E',
            50, '#F19C7C',
            100, '#EA8171',
            200, '#DD686C',
            500, '#CA5268',
            1000, '#B13F64',
            2000, '#9C3F5D',
            5000, '#853F56',
        ].map(stop => {
            if (typeof stop === 'number') {
                // Scale the number to fit within the current min-max range
                return min + (stop / 3000) * (max - min);
            }
            return stop;
        });
    
        map.setPaintProperty('density-layer', 'fill-color', [
            'interpolate',
            ['linear'],
            ['get', 'ppl_densit'],
            ...colorStops
        ]);
    });
    

    map.on('zoomend', fetchAndUpdateData);

    map.on('moveend', fetchAndUpdateData);
});
