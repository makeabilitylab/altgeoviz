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
    "NW": "top-left",
    "NE": "top-right",
    "SW": "bottom-left",
    "SE": "bottom-right",
    "W": "left",
    "E": "right",
    "N": "top",
    "S": "bottom",
    "C": "center",
    "left_diagonal": "diagonally from top-left to bottom-right",
    "right_diagonal": "diagonally from bottom-left to top-right",
    "horizontal": "horizontally through the center",
    "vertical": "vertically through the center"
}

const MAPTYPE = "choropleth map";

const MAPBOUNDS = [
    [-128.0, 22.0], // Southwest
    [-64.0, 52.0]   // Northeast
];

const ZOOM_LEVEL_TRACT = 7;
const ZOOM_LEVEL_COUNTY = 5;
const ZOOM_LEVEL_STATE = 0;

const constructGeoUnit = (zoom) => {
    let zoomText = "";
    
    if (zoom >= ZOOM_LEVEL_TRACT) {
        zoomText = "census tract";
    } else if (zoom >= ZOOM_LEVEL_COUNTY) {
        zoomText = "county";
    } else {
        zoomText = "state";
    }
    return zoomText;
}

const constructBoundary = async (screenLeft, screenRight, screenTop, screenBottom, zoom) => {
    // call the api /get_boundary by passing the bounds of the map
    let url = `/reverse_geocode?screenLeft=${screenLeft}&screenRight=${screenRight}&screenTop=${screenTop}&screenBottom=${screenBottom}&zoom=${zoom}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data['response']) {
            return data['response'];
        } else {
            return "Failed to retrieve boundary information.";
        }
    } catch (error) {
        console.error("Error fetching boundary data:", error);
        return "An error occurred while fetching boundary information.";
    }
}

const constructZoom = (zoom) => {
    // Zoom in to interact with the data at [next level]; zoom out to interact with the data at [previous level].
    let zoomText = "";
    if (zoom >= ZOOM_LEVEL_TRACT) {
        zoomText = "Zoom out to interact with the data at county level.";
    } else if (zoom >= ZOOM_LEVEL_COUNTY) {
        zoomText = "Zoom out to interact with the data at state level. Zoom in to interact with the data at census tract level.";
    } else {
        zoomText = "Zoom in to interact with the data at county level.";
    }
    return zoomText;
}

const constructTrend = async (screenLeft, screenRight, screenTop, screenBottom, zoom) => {
    // var url = `/stats_in_view?minLon=${screenLeft}&minLat=${screenBottom}&maxLon=${screenRight}&maxLat=${screenTop}&zoom=${zoom}`;
    var url = `/stats_in_view?screenLeft=${screenLeft}&screenBottom=${screenBottom}&screenRight=${screenRight}&screenTop=${screenTop}&zoom=${zoom}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log(data);

        if (response.ok) {
            let highs = [];
            let lows = [];

            let content = "";

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

            // census track level
            // min, max
            let minText = "";
            let maxText = "";
            if (zoom >= ZOOM_LEVEL_TRACT) {
                minText += "The census tract with the lowest population density is " + data.min.text + ", located in the " + REGION_MAP[data.min.section] + ", with a population density of " + data.min.value.toFixed(1) + " people per square mile.";
                maxText += "The census tract with the highest population density is " + data.max.text + ", located in the " + REGION_MAP[data.max.section] + ", with a population density of " + data.max.value.toFixed(1) + " people per square mile.";
            } else if (zoom >= ZOOM_LEVEL_COUNTY) {
                minText += "The county with the lowest population density is " + data.min.text + ", with a population density of " + data.min.value.toFixed(1) + " people per square mile.";
                maxText += "The county with the highest population density is " + data.max.text + ", with a population density of " + data.max.value.toFixed(1) + " people per square mile.";
            } else {
                minText += "The state with the lowest population density is " + data.min.text + ", with a population density of " + data.min.value.toFixed(1) + " people per square mile.";
                maxText += "The state with the highest population density is " + data.max.text + ", with a population density of " + data.max.value.toFixed(1) + " people per square mile.";
            }

            let average = `The average population density in the view is ${data.average.toFixed(1)} people per square mile.`;
            content += `<p>${minText}</p><p>${maxText}</p><p>${average}</p>`;

            return {
                geocode: data.geocode,
                trend: content
            };
        }
    } catch (error) {
        console.error("Error fetching trend data:", error);
        return "An error occurred while fetching trend information.";
    }
}

datasetName = "population density";


function setupKeyControls() {
    let inDetailedView = false; // State for managing the detailed view
    let statsDisplay = document.getElementById('stats-display');

    window.addEventListener('keydown', function(event) {
        if (document.activeElement === statsDisplay) {
            switch (event.key) {
                case 'i':
                    if (!inDetailedView) {
                        // Switch to detailed view
                        statsDisplay.innerHTML = `<p>${statsTrend.trend}</p><p>Press k to go back.</p>`;
                        inDetailedView = true;
                    }
                    break;
                case 'k':
                    if (inDetailedView) {
                        // Revert to initial overview
                        statsDisplay.innerHTML = `<p>Overview...</p><p>Press i for more info.</p>`;
                        inDetailedView = false;
                    }
                    break;
                default:
                    // Redirect all other keys to the map container
                    map.getCanvas().focus();
                    break;
            }
        }
    });
}

async function updateStats() {
    let zoom = map.getZoom();
    let bounds = map.getBounds();
    let inDetailedView = false; // State to manage detailed view

    const screenLeft = bounds.getWest() < MAPBOUNDS[0][0] ? MAPBOUNDS[0][0] : bounds.getWest();
    const screenRight = bounds.getEast() > MAPBOUNDS[1][0] ? MAPBOUNDS[1][0] : bounds.getEast();
    const screenTop = bounds.getNorth() > MAPBOUNDS[1][1] ? MAPBOUNDS[1][1] : bounds.getNorth();
    const screenBottom = bounds.getSouth() < MAPBOUNDS[0][1] ? MAPBOUNDS[0][1] : bounds.getSouth();

    const statsDisplay = document.getElementById('stats-display');
    statsDisplay.innerHTML = '<p>Information is loading...</p>';
    statsDisplay.setAttribute('aria-busy', 'true');
    statsDisplay.setAttribute('tabindex', '-1');  // Make the div programmatically focusable

    try {
        let overview = "This is a " + MAPTYPE + " of " + datasetName + " at a " + constructGeoUnit(zoom) + " level.";
        let zoomText = constructZoom(zoom);
        let statsTrend = await constructTrend(screenLeft, screenRight, screenTop, screenBottom, zoom);

        let initialStatsDisplay = `
            <p>${overview}</p>
            <p>${statsTrend.geocode}</p>
            <p>${zoomText}</p>
            <p>Press i to hear more information.</p>
            <p>Press m to interact with the map.</p>
        `;

        statsDisplay.innerHTML = initialStatsDisplay;
        // statsDisplay.setAttribute('aria-busy', 'false');
        statsDisplay.focus(); // Focus the stats display for screen reader announcement

        setupKeyControls(); // Set up key handling
    } catch (error) {
        console.error("Error updating stats:", error);
        statsDisplay.innerHTML = '<p>Error loading info. Please try again.</p>';
    }
}





function fetchAndUpdateData() {
    var bounds = map.getBounds();
    var zoom = map.getZoom();
    var sourceURL = '/state_density_data'; 

    if (zoom >= 7) {
        sourceURL = '/tract_density_data';
    } else if (zoom >= 5) {
        sourceURL = '/county_density_data';
    }

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
        } 
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
