datasetName = "percentage of people who walk to work";

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

document.getElementById('map-heading').focus();

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

const ZOOM_LEVEL_COUNTY = 6;
const ZOOM_LEVEL_STATE = 0;


function updateMapInfo(keyAction, actionType) {
    var center = map.getCenter();
    const statsDisplay = document.getElementById('stats-display');
    fetch(`/get_state?lat=${center.lat}&lon=${center.lng}&zoom=${map.getZoom()}`)
        .then(response => response.json())
        .then(data => {
            const zoomLevel = map.getZoom();
            let displayText;
            if (actionType === 'Zoomed' && zoomLevel >= 6) {
                displayText = `${actionType} ${keyAction}, now at county level, centered on ${data.county}, ${data.state}.`;
            } else if (actionType === 'Zoomed' && zoomLevel < 6) {
                displayText = `${actionType} ${keyAction}, now at state level, centered on ${data.state}.`;
            } else if (actionType === 'Moved' && zoomLevel >= 6) {
                // This else clause can be used for non-zoom related actions or to handle unexpected cases
                displayText = `${actionType} ${keyAction}, centered on ${data.county}, ${data.state}.`;
            } else {
                displayText = `${actionType} ${keyAction}, centered on ${data.state}.`;
            }
            statsDisplay.innerHTML = `<p>${displayText}</p>
            <p>Press i to get more information.</p>`;
        })
        .catch(error => console.error('Error fetching state:', error));
}

function getDirectionBasedOnKey(key) {
    switch(key) {
        case 'ArrowRight':
            return 'right';
        case 'ArrowLeft':
            return 'left';
        case 'ArrowUp':
            return 'up';
        case 'ArrowDown':
            return 'down';    
        default:
            return null; // Ignore other keys
    }
}

function getZoomBasedOnKey(key) { 
    switch(key) {
        case '=':
        case '+':
            return 'in';
        case '-':
        case '_':
            return 'out';
        default:
            return null;
    }
}

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
        zoomText = "You are currently at county level, zoom out to interact with the data at state level.";
    } else {
        zoomText = "You are currently at state level, zoom in to interact with the data at county level.";
    }
    return zoomText;
}

const constructTrend = async (screenLeft, screenRight, screenTop, screenBottom, zoom) => {
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
                content += datasetName + ' is high ';
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
                content += '<p>No regions with particularly high ' + datasetName + '.</p>';
            }

            if (lows.length > 0) {
                content += datasetName + ' is low ';
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
                content += '<p>- No regions with particularly low' + datasetName + '.</p>';
            }

            // census track level
            // min, max
            let minText = "";
            let maxText = "";
            
            if (zoom >= ZOOM_LEVEL_COUNTY) {
                minText += "The county with the lowest " + datasetName + " is " + data.min.text + ", with " + (data.min.value*100).toFixed(1) + "% of people who walk to work.";
                maxText += "The county with the highest " + datasetName + " is " + data.max.text + ", with " + (data.max.value*100).toFixed(1) + "% of people who walk to work.";
            } else {
                minText += "The state with the lowest " + datasetName + " is " + data.min.text + ", with " + (data.min.value*100).toFixed(1) + "% of people who walk to work.";
                maxText += "The state with the highest " + datasetName + " is " + data.max.text + ", with " + (data.max.value*100).toFixed(1) + "% of people who walk to work.";
            }

            let average = `The average ${datasetName} is ${(data.average*100).toFixed(1)}%.`;
            content += `<p>${average}</p><p>${maxText}</p><p>${minText}</p>`;

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

var statsTrend = null;
var inBoundaryView = false;
const statsDisplay = document.getElementById('stats-display'); 
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
        <p>In the current view: </p>
        <p>${statsTrend.trend}</p>
        <p>Press l to hear the boundary of the current view.</p>
        <p>Press m to interact with the map.</p>
    `;

        statsDisplay.innerHTML = initialStatsDisplay;
        statsDisplay.focus(); 
    } catch (error) {
        console.error("Error updating stats:", error);
        statsDisplay.innerHTML = '<p>Error loading information. Please try again.</p>';
    }
}

function updateStatsDisplay(htmlContent, focus = true) {
    statsDisplay.innerHTML = htmlContent;
    if (focus) {
        statsDisplay.focus();
    }
}

function handleBoundaryView() {
    if (statsTrend !== null) {
        updateStatsDisplay(`<p>${statsTrend.geocode}</p>
            <p>Press b to go back.</p>
            <p>Press m to interact with the map.</p>`);
        inBoundaryView = true;
    } else {
        updateStatsDisplay(`<p>Data not available yet. Please wait...</p>`);
        inBoundaryView = false;
    }
}

const helpMessage = `
    <p>Shortcut keys.</p>
    <p>Press i to learn about data trends in the current view.</p>
    <p>Press l to learn about the boudary of the current view. </p>
    <p>Press m to interact with the map.</p>
    <p>Use arrow keys to navigate the map up, down, left, right.</p>
    <p>Use + or - to zoom in or out.</p>
    <p>Press h to hear the short cut keys any time.</p>
`;


const logMessage = async (keystroke) => {
    const url = "/log"

    const center = map.getCenter();
    console.log(keystroke)
    
    const eventData = {
        user_id: "user101",
        session_id: "session5678",
        timestamp: new Date().toISOString(),
        key_stroke: keystroke,
        zoom_level: map.getZoom(),
        lng: center.lng,
        lat: center.lat,
        stats: document.getElementById('stats-display').innerText
    };

    try {
        // Making an API call to the Flask backend
        const response = await fetch('/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData) 
        });

        // Parsing the JSON response from the server
        const responseData = await response.json();

        // Log the response from the server (success message)
        console.log('Server Response:', responseData);
    } catch (error) {
        // Error handling
        console.error('Failed to log message:', error);
    }
}

function handleKeyboardEvent(event) {
    // Handle map rotation and pitch blocking
    if (event.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        return; // Stop further processing for rotation-blocking
    }

    // Handle direction and zoom interactions for the map
    const direction = getDirectionBasedOnKey(event.key);
    const zoomKey = getZoomBasedOnKey(event.key);

    if (direction) {
        map.once('moveend', () => updateMapInfo(direction, 'Moved'));
    }

    if (zoomKey) {
        map.once('zoomend', () => updateMapInfo(zoomKey, 'Zoomed'));
    }

    // Handle UI-specific interactions
    switch (event.key) {
        case 'i':
            fetchAndUpdateData();
            break;
        case 'l':
            if (!inBoundaryView) {
                handleBoundaryView();
            }
            break;
        case 'b':
            if (inBoundaryView) {
                updateStatsDisplay(initialStatsDisplay);
                inBoundaryView = false;
            }
            break;
        case 'm':
            if (!inBoundaryView) {
                map.getCanvas().focus();
            }
            break;
        case 'h':  // Handle help message display
            updateStatsDisplay(helpMessage);
            break;
    }

    logMessage(event.key);
}

window.addEventListener('keydown', handleKeyboardEvent);


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
                1, '#F5B78E',
                2, '#F19C7C',
                5, '#EA8171',
                10, '#DD686C',
                20, '#CA5268',
                30, '#B13F64',
                50, '#9C3F5D',
                100, '#853F56',
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
            1, '#F5B78E',
            2, '#F19C7C',
            5, '#EA8171',
            10, '#DD686C',
            20, '#CA5268',
            30, '#B13F64',
            50, '#9C3F5D',
            100, '#853F56',
        ].map(stop => {
            if (typeof stop === 'number') {
                // Scale the number to fit within the current min-max range
                return min + (stop / 100) * (max - min);
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

