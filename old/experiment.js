NAME = "percentage of walk to work";

// Map configuration and initialization
const mapboxConfig = {
    accessToken: 'pk.eyJ1IjoiY3Jlc2NlbmRvY2h1IiwiYSI6ImNpdGR5MWZ5aDAycjIyc3A5ZHoxZzRwMGsifQ.nEaSxm520v7TpKAy2GG_kA',
    styleUrl: 'mapbox://styles/mapbox/light-v10',
    initialView: {
        center: [-98.5795, 39.8283], // Geographic center of the contiguous United States
        zoom: 4
    },
    bounds: [
        [-128.0, 22.0], // Southwest corner of the continental US
        [-64.0, 52.0]   // Northeast corner
    ]
};

// Set Mapbox access token from configuration
mapboxgl.accessToken = mapboxConfig.accessToken;

const map = new mapboxgl.Map({
    container: 'map',
    style: mapboxConfig.styleUrl,
    center: mapboxConfig.initialView.center,
    zoom: mapboxConfig.initialView.zoom,
    dragRotate: false,
    maxBounds: mapboxConfig.bounds
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


map.on('zoomend', () => {
    const statsDisplay = document.getElementById('stats-display');
    statsDisplay.innerHTML = '<p>Map view changed. Press l to hear information about current view.</p>';
});

map.on('moveend', () => {
    const statsDisplay = document.getElementById('stats-display');
    statsDisplay.innerHTML = '<p>Map view changed. Press l to hear information about current view.</p>';
});

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

// const ZOOM_LEVEL_TRACT = 7;
const ZOOM_LEVEL_COUNTY = 6;
const ZOOM_LEVEL_STATE = 0;

const constructGeoUnit = (zoom) => {
    let zoomText = "";

    if (zoom >= ZOOM_LEVEL_COUNTY) {
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
    if (zoom >= ZOOM_LEVEL_COUNTY) {
        zoomText = "Zoom out to interact with the data at state level.";
    } else {
        zoomText = "Zoom in to interact with the data at county level.";
    }
    return zoomText;
}

const constructTrend = async (screenLeft, screenRight, screenTop, screenBottom, zoom) => {
    // var url = `/stats_in_view?minLon=${screenLeft}&minLat=${screenBottom}&maxLon=${screenRight}&maxLat=${screenTop}&zoom=${zoom}`;
    var url = `/stats_in_view?screenLeft=${screenLeft}&screenBottom=${screenBottom}&screenRight=${screenRight}&screenTop=${screenTop}&zoom=${zoom}&value_column=walk_to_wo`;

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
                content += NAME + ' is high ';
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
                content += '<p>- No regions with particularly high ' + NAME + '.</p>';
            }

            if (lows.length > 0) {
                content += NAME + ' is low ';
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
                content += '<p>- No regions with particularly low' + NAME + '.</p>';
            }

            // census track level
            // min, max
            let minText = "";
            let maxText = "";

            if (zoom > ZOOM_LEVEL_COUNTY) {
                minText += "The county with the lowest percentage is " + data.min.text + ", with a percentage of " + data.min.value.toFixed(1) + " people per square mile.";
                maxText += "The county with the highest percentage is " + data.max.text + ", with a percentageof " + data.max.value.toFixed(1) + " people per square mile.";
            } else {
                minText += "The state with the lowest percentage is " + data.min.text + ", with a percentage of " + data.min.value.toFixed(1) + " people per square mile.";
                maxText += "The state with the highest percentage is " + data.max.text + ", with a percentage of " + data.max.value.toFixed(1) + " people per square mile.";
            }
            let average = `The average percentage in the view is ${data.average.toFixed(1)} people per square mile.`;
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

datasetName = NAME;


var statsTrend = null;
var inDetailedView = false;
var statsDisplay = document.getElementById('stats-display'); 
var initialStatsDisplay = '';

async function updateStats() {
    let zoom = map.getZoom();
    let bounds = map.getBounds();
    const statsDisplay = document.getElementById('stats-display');

    const screenLeft = bounds.getWest() < MAPBOUNDS[0][0] ? MAPBOUNDS[0][0] : bounds.getWest();
    const screenRight = bounds.getEast() > MAPBOUNDS[1][0] ? MAPBOUNDS[1][0] : bounds.getEast();
    const screenTop = bounds.getNorth() > MAPBOUNDS[1][1] ? MAPBOUNDS[1][1] : bounds.getNorth();
    const screenBottom = bounds.getSouth() < MAPBOUNDS[0][1] ? MAPBOUNDS[0][1] : bounds.getSouth();

    statsDisplay.innerHTML = '<p>Information is loading...</p>';

    try {
        let overview = "This is a " + MAPTYPE + " of " + datasetName + " in the US at a " + constructGeoUnit(zoom) + " level.";
        let zoomText = constructZoom(zoom);
        statsTrend = await constructTrend(screenLeft, screenRight, screenTop, screenBottom, zoom);

        initialStatsDisplay = `
            <p>${overview}</p>
            <p>${statsTrend.geocode}</p>
            <p>Press i to hear more information.</p>
            <p>Press m to interact with the map.</p>
            <p>${zoomText}</p>
        `;

        statsDisplay.innerHTML = initialStatsDisplay;
        statsDisplay.focus(); 
    } catch (error) {
        console.error("Error updating stats:", error);
        statsDisplay.innerHTML = '<p>Error loading information. Please try again.</p>';
    }
}


function handleKeypress(event) {
    const statsDisplay = document.getElementById('stats-display');
    if (event.key === 'l') {
        fetchAndUpdateData();

     } else if (event.key === 'i' && !inDetailedView) {
        if (statsTrend !== null) { // Ensure statsTrend is available
            statsDisplay.innerHTML = `<p>${statsTrend.trend}</p>
            <p>Press k to go back.</p>
            <p>Press m to interact with the map.</p>`;
            statsDisplay.focus();
            inDetailedView = true;
        } else {
            // Optionally handle the case where statsTrend is not ready
            statsDisplay.innerHTML = `<p>Data not available yet. Please wait...</p>`;
            statsDisplay.focus();
            inDetailedView = false;
        }
    } else if (event.key === 'm' && !inDetailedView) {
        map.getCanvas().focus();
        inDetailedView = false;
    } else if (event.key === 'k' && inDetailedView) {
        statsDisplay.innerHTML = initialStatsDisplay;
        statsDisplay.focus();
        inDetailedView = false;
    } else if (event.key === 'm' && inDetailedView) {
        map.getCanvas().focus();
        inDetailedView = false;
    }
}

// Attach event listener
window.addEventListener('keypress', handleKeypress);

function fetchAndUpdateData() {
    var bounds = map.getBounds();
    var zoom = map.getZoom();
    var sourceURL = '/state_walk_data'; 

    if (zoom >= 6) {
        sourceURL = '/county_walk_data';
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
                ['get', 'walk_to_wo'],
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

    // Fetch and update data initially
    fetchAndUpdateData();


    map.on('data', function (e) {
        if (e.sourceId !== 'stateDensity' || !e.isSourceLoaded) return;
    
        let data = map.querySourceFeatures('stateDensity');

        let min = Math.min(...data.map(f => f.properties.walk_to_wo));
        let max = Math.max(...data.map(f => f.properties.walk_to_wo));

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
            ['get', 'walk_to_wo'],
            ...colorStops
        ]);
    });
});

window.onload = function() {
    map.on('load', function() {
        const elementsToHide = document.querySelectorAll('.mapboxgl-ctrl-attrib a, .mapboxgl-ctrl-logo');

        elementsToHide.forEach(function(element) {
            element.setAttribute('aria-hidden', 'true'); // Hide from screen readers
            element.setAttribute('role', 'presentation'); // Mark as presentational
        });
    });
};

