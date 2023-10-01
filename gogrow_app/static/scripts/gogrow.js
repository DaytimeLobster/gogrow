// Define global variables
var map = null; // Map object
var icons = {}; // Object to store icons
var iconDirectory = '/icons'; // Directory path for icons
var markerListBody = document.querySelector('#marker-list-body'); // DOM element for the marker list
let markerInstances = []; // Array to store marker instances
let lineInstances = []; // Array to store line instances

// Function to set text color based on background color
function setTextColorBasedOnBgColor(bgColor, element) {
    // Calculate the color based on the brightness of the background color
    var color = (parseInt(bgColor.slice(1), 16) > 0xffffff / 2) ? 'black' : 'white';
    // Set the text color of the element
    element.style.color = color;
}

let customTheme = null; // Variable to store custom theme

// Function to fetch custom theme
async function fetchCustomTheme() {
    try {
        // If custom theme is already fetched, return early
        if (customTheme !== null) return;

        const response = await fetch('/custom_theme');
        if (!response.ok) throw new Error(response.statusText);

        const cssVariables = await response.text();

        // Create a style element to inject the CSS variables into the document
        const style = document.createElement('style');
        style.textContent = `:root { ${cssVariables} }`;

        // Append the style element to the document head
        document.head.appendChild(style);

        // Store the style element so we can re-use it later
        customTheme = style;
    } catch (error) {
        console.error('Error fetching custom theme:', error);
    }
}

// Function to change the theme
function changeTheme(theme) {
    console.log(`Changing theme to: ${theme}`);
    let themes = ['light', 'dark', 'beach', 'forest', 'sunset', 'amethyst', 'custom'];
    // Remove all theme classes from the body
    themes.forEach((t) => {
        document.body.classList.remove(`${t}-mode`);
    });
    // Add the selected theme class to the body
    document.body.classList.add(`${theme}-mode`);

    // Remove the custom theme if it was applied
    if (customTheme !== null && document.head.contains(customTheme)) {
        document.head.removeChild(customTheme);
    }

    // Fetch the custom theme if the user selected the custom theme
    if (theme === 'custom') {
        fetchCustomTheme();
    }
}

// Function to initialize the index page
async function initializeIndexPage() {
    console.log("Initializing index page...");
    // Apply the saved theme
    const theme = await getSetting('Theme', 'mode');
    console.log(`Applying theme: ${theme}`);
    changeTheme(theme);
}

// Function to get a setting from the server
async function getSetting(section, key) {
    const response = await fetch(`/settings/get?section=${section}&key=${key}`);
    if (response.ok) {
        const data = await response.json();
        return data.value;
    } else {
        console.error("Error getting setting:", response.statusText);
        return null;
    }
}

// Function to apply the saved map background
async function applySavedMapBackground() {
    const texture = await getSetting('background', 'texture');
    changeMapBackground(texture);
}

// Function to change the map background
function changeMapBackground(texture) {
    document.getElementById('map').style.backgroundImage = `url('/static/textures/${texture}')`;
    document.getElementById('map').style.backgroundSize = 'cover';
}

// Function to load an image
async function loadImage() {
    try {
        const response = await fetch('/get_image_url');
        if (response.ok) {
            imageUrl = await response.text();
            addImageOverlay(imageUrl);
        }
    } catch (err) {
        console.error('Error loading image:', err);
    }
}

let imageOverlay = null; // Variable to store the image overlay

// Create the map using L.CRS.Simple as the coordinate reference system
map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -3
});

// Listen for the end of any movement or zoom events and re-calculate the size of the map
map.on('moveend zoomend', function () {
    map.invalidateSize();
});

// Function to add an image overlay to the map
function addImageOverlay(imageUrl) {
    return new Promise((resolve) => {
        if (imageOverlay) {
            // If an image overlay already exists, remove it from the map
            map.removeLayer(imageOverlay);

            // Clear existing markers and lines from the map
            clearExistingMarkers();
        }

        // Create an image element to getthe dimensions
        const img = new Image();
        img.src = imageUrl;
        img.onload = function () {
            const imageWidth = this.width;
            const imageHeight = this.height;

            // Define the image bounds using the original dimensions
            const imageBounds = [
                [0, 0],
                [imageHeight, imageWidth]
            ];

            // Add a new image overlay to the map using the provided image URL and bounds
            imageOverlay = L.imageOverlay(imageUrl, imageBounds).addTo(map);

            // Set the map view to the center of the image with an appropriate zoom level
            map.setView([imageHeight / 2, imageWidth / 2], -2);

            resolve(); // Resolve the promise when the image is loaded
        };
    });
}

// Function to calculate Euclidean distance between two points
function euclideanDistance(point1, point2) {
    const [x1, y1] = point1;
    const [x2, y2] = point2;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Function to clear existing markers and lines from the map
function clearExistingMarkers() {
    // Remove existing marker instances from the map and clear the array
    for (const markerId in markerInstances) {
        const marker = markerInstances[markerId];
        console.log(`Clearing previous image marker with UUID: ${markerId}`);
        map.removeLayer(marker);
    }
    markerInstances = [];

    // Remove existing line instances from the map and clear the array
    console.log('Clearing lineInstances...');
    for (const lineId in lineInstances) {
        const line = lineInstances[lineId];
        console.log(`Removing line with UUID: ${lineId}`);
        map.removeLayer(line);
    }
    lineInstances = [];
    console.log('lineInstances cleared');

    // Clear the marker list table
    while (markerListBody.firstChild) {
        markerListBody.removeChild(markerListBody.firstChild);
    }

}

// Function to load markers and lines from a folder
async function loadFeatures(folderName) {
    if (!folderName) {
        console.warn('loadFeatures called without a folder name');
        return;
    }

    // Clear existing markers and lines from the map
    clearExistingMarkers();

    try {
        // Fetch markers
        const markerResponse = await fetch(`/markers/${folderName}`);
        const markers = await markerResponse.json();
        for (const marker of markers) {
            createMarker(marker);
        }

        // Fetch lines
        const lineResponse = await fetch(`/lines/${folderName}`);
        const lines = await lineResponse.json();
        // Create lines and add them to the map
        for (const line of lines) {
            createLine(line);
        }
    } catch (error) {
        console.error('Error fetching markers and lines:', error);
    }
}

// Custom Icon class extending L.Icon
class SvgIcon extends L.Icon {
    constructor(options) {
        super(options);
        this._iconUrl = options.iconUrl;
        this._iconColor = options.iconColor || '#000000'; // Default color is black
    }

    // Override the createIcon method to load SVG icon dynamically
    createIcon(oldIcon) {
        const icon = (oldIcon && oldIcon.tagName === 'IMG') ? oldIcon : document.createElement('img');
        this._setIconStyles(icon, 'icon');

        // Fetch the SVG icon file
        fetch(`${'.' + this._iconUrl}`)
            .then(res => res.text())
            .then(data => {
                const parser = new DOMParser();
                const svg = parser.parseFromString(data, "image/svg+xml");
                svg.documentElement.style.fill = this._iconColor;
                icon.src = 'data:image/svg+xml;base64,' + btoa(svg.documentElement.outerHTML);
            });
        return icon;
    }
}

// Function to load folders from the server
async function loadFolders() {
    try {
        const response = await fetch('/get_folders');
        if (response.ok) {
            console.log("Folders Loaded")
            const folderList = await response.json();
            displayFolders(folderList);
        }
    } catch (err) {
        console.error('Error loading folders:', err);
    }
}

// Function to display the folder list on the page
function displayFolders(folderList) {
    const folderListElement = document.getElementById('folder-list');
    folderListElement.innerHTML = '';
    folderList.forEach(folder => {
        const listItem = document.createElement('li');
        const button = document.createElement('button');
        button.textContent = folder;
        button.addEventListener('click', () => {
            loadImageAndDatabase(folder);

            // Highlight the selected folder
            const allFolders = folderListElement.querySelectorAll('button');
            allFolders.forEach((btn) => btn.classList.remove('selected-folder'));
            button.classList.add('selected-folder');
        });

        // Create the image element for the thumbnail
        const thumbnail = document.createElement('img');
        thumbnail.src = `/img/${folder}/thumbnail-${folder}.png`;
        thumbnail.alt = `${folder} thumbnail`;
        thumbnail.style.width = '60px'; // Set width for the thumbnail
        thumbnail.style.height = '60px'; // Set height for the thumbnail
        thumbnail.style.padding = '10px'; // Set padding for the thumbnail
        thumbnail.style.display = 'inline-block';

        // Apply inline-block style to the button
        button.style.display = 'inline-block';

        // Remove the bullet point from the list item
        listItem.style.listStyleType = 'none';

        // Append the thumbnail and button to the list item
        listItem.appendChild(thumbnail);
        listItem.appendChild(button);
        folderListElement.appendChild(listItem);
    });
}

// Function to load image and database for a selected folder
async function loadImageAndDatabase(folderName) {
    try {
        const response = await fetch(`/get_image_url/${folderName}`);
        if (response.ok) {
            const imageUrl = await response.text();

            // Clear existing markers and reset the markerCounter before loading new markers
            clearExistingMarkers();
            markerCounter = 1;

            // Load the image overlay and features (markers and lines)
            await Promise.all([addImageOverlay(imageUrl), loadFeatures(folderName)]);

            // Set the selected folder name in the HTML element
            document.getElementById('selected-folder-name').textContent = folderName;
        } else {
            console.error("Error loading image from folder:", folderName);
        }
    } catch (err) {
        console.error('Error loading image and database:', err);
    }
}

// Function to generate a random UUID
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Function to update a marker's information
async function updateMarker(markerUUID, description, iconType, iconColor, notes) {
    try {
        // Update the markers data in the local storage
        let markersData = JSON.parse(localStorage.getItem('markersData')) || [];
        let markerIndex = markersData.findIndex(marker => marker.markerId === markerUUID);
        if (markerIndex >= 0) {
            markersData[markerIndex].info = description;
            markersData[markerIndex].iconType = iconType;
            markersData[markerIndex].iconColor = iconColor;
            markersData[markerIndex].markerNotes = notes;
            localStorage.setItem('markersData', JSON.stringify(markersData));
        }

        // Send the updated marker data to the server
        const response = await fetch('/update_marker', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uuid: markerUUID,
                info: description,
                iconType: iconType,
                iconColor: iconColor,
                markerNotes: notes,
            }),
        });

        if (response.ok) {
            console.log(`Marker ${markerUUID} updated successfully.`);
        } else {
            console.error(`Error updating marker ${markerUUID}.`);
        }
    } catch (err) {
        console.error(`Error updating marker ${markerUUID}:`, err);
    }
}

// Function to add a new marker to the map and table
async function addMarker(lat, lng, info, iconType, iconColor, markerNotes, folderName) {
    // Define the new marker data without markerId
    let newMarkerData = { lat, lng, info, iconType, iconColor, markerNotes: markerNotes || '' };
    folderName = folderName || sessionStorage.getItem('selectedFolder');

    // Send the new marker data to the server
    try {
        const response = await fetch(`/markers/${folderName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newMarkerData),
        });

        if (response.ok) {
            const jsonResponse = await response.json();
            const markerId = jsonResponse.marker_id;
            console.log('Marker added successfully with ID:', markerId);

            // Create and add the marker to the map only if the server's response is OK
            createMarker({ ...newMarkerData, markerId });
        } else {
            console.error('Error adding marker.');
        }
    } catch (err) {
        console.error('Error adding marker:', err);
    }
}

// Function to create a marker
function createMarker(newMarkerData) {
    // Create a new marker with the specified icon
    var marker = L.marker(
        [newMarkerData.lat, newMarkerData.lng],
        {
            icon: new SvgIcon({
                iconUrl: `${iconDirectory}/${newMarkerData.iconType}`,
                iconSize: [30, 30],
                iconAnchor: [12, 41],
                popupAnchor: [0, -34],
                iconColor: newMarkerData.iconColor
            }),
            className: 'leaflet-svg-icon'
        }
    );

    // Set the marker popup content
    marker.bindPopup(`
    <div class="markerPopup">
        <div><b>Info:</b></div>
        <div style="margin-bottom: 10px;">${newMarkerData.info}</div>
        <div><b>Notes:</b></div>
        <div style="border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            ${newMarkerData.markerNotes}
        </div>
    </div>
`);

    // Set the ID of the marker instance
    marker.options.uuid = newMarkerData.markerId;

    // Add the marker instance to the markerInstances object
    markerInstances[marker.options.uuid] = marker;

    // Add the marker to the map
    marker.addTo(map);

    console.log(`Placing marker with UUID: ${newMarkerData.markerId}" - marker icon: ${iconDirectory}/${newMarkerData.iconType}`);

    // Add a new row to the table
    const newRow = markerListBody.insertRow();
    const truncatedUUID = newMarkerData.markerId.slice(0, 8); // Truncate UUID to the first 8 characters
    newRow.innerHTML = `
    <td class="idNum" data-full-uuid="${newMarkerData.markerId}">${truncatedUUID}</td> 
    <td class="description" contenteditable="false">${newMarkerData.info}</td>
    <td>${newMarkerData.iconType.replace('.svg', '')}</td>
    <td class="icon-color-cell" style="background-color: ${newMarkerData.iconColor} !important;">${newMarkerData.iconColor}</td>
    <td class="notes" data-uuid="${newMarkerData.markerId}" data-description="${newMarkerData.info}" contenteditable="false">${newMarkerData.markerNotes}</td>
    <td><img class="delete-marker-icon" src="/icons/trash.svg" alt="Delete Icon" style="cursor:pointer;width:20px;height:20px;"></td>`;

    // Add event listener to the line ID cell
    newRow.querySelector('td:first-child').addEventListener('click', function () {
        const markerId = this.dataset.fullUuid;
        const marker = markerInstances[markerId];
        if (marker) {
            marker.openPopup();
        }
    });

    // Set the text color of the icon-color-cell based on its background color
    setTextColorBasedOnBgColor(newMarkerData.iconColor, newRow.querySelector('.icon-color-cell'));

    // Return the marker instance
    return marker;
}

// Function to delete a marker
async function deleteMarker(markerUUID) {
    return new Promise(async (resolve, reject) => {
        // Find the marker instance by uuid
        const markerInstance = Object.values(markerInstances).find(marker => marker.options.uuid == markerUUID);

        if (markerInstance) {
            // Remove the marker from the map
            map.removeLayer(markerInstance);
            // Remove the marker instance from the markerInstances object
            delete markerInstances[markerUUID];
            console.log('Deleting marker with id:', markerUUID);

            // Remove the marker from the table
            const rows = Array.from(markerListBody.querySelectorAll('tr'));
            const row = rows.find(r => r.querySelector('td:first-child').dataset.fullUuid == markerUUID);
            markerListBody.removeChild(row);

            // Update the local storage
            let markersData = JSON.parse(localStorage.getItem('markersData')) || [];
            markersData = markersData.filter(marker => marker.markerUUID !== markerUUID);
            localStorage.setItem('markersData', JSON.stringify(markersData));

            // Send the request to the server to delete the marker
            fetch('/delete_marker', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'id': markerUUID
                })
            })
                .then(response => {
                    if (response.ok) {
                        return response.text();
                    } else {
                        throw new Error(`Error deleting marker ${markerUUID}.`);
                    }
                })
                .then(data => {
                    console.log(`Marker ${markerUUID} deleted successfully:`, data);
                    resolve();
                })
                .catch(error => {
                    console.error(`Error deleting marker ${markerUUID}:`, error);
                    reject(error);
                });
        }
    });
}
async function addLine(startLatLng, endLatLng, info, color, notes, folderName) {
    // Extract lat and lng from LatLng objects
    let start_lat = startLatLng.lat;
    let start_lng = startLatLng.lng;
    let end_lat = endLatLng.lat;
    let end_lng = endLatLng.lng;

    // Update newLineData with extracted values
    let newLineData = { start_lat, start_lng, end_lat, end_lng, info, color, notes: notes || '' };
    folderName = folderName || sessionStorage.getItem('selectedFolder');

    try {
        const response = await fetch(`/lines/${folderName}`, { // Update the URL to include folderName
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newLineData),
        });

        if (response.ok) {
            const jsonResponse = await response.json();
            const lineId = jsonResponse.line_id;
            console.log('Line added successfully with ID:', lineId);

            // Create and add the line to the map only if the server's response is OK
            let line = createLine({ ...newLineData, lineId });

        } else {
            console.error('Error adding line.');
        }
    } catch (err) {
        console.error('Error adding line:', err);
    }
}

function createLine(newLineData) {
    // Create LatLng objects from the latitude and longitude values
    let startLatLng = L.latLng(newLineData.start_lat, newLineData.start_lng);
    let endLatLng = L.latLng(newLineData.end_lat, newLineData.end_lng);

    // Create a new line with the specified color
    var line = L.polyline([startLatLng, endLatLng], { color: newLineData.color }).addTo(map);

    // Set the line popup content
    line.bindPopup(`
    <div class="linePopup">
        <div><b>Info:</b></div>
        <div style="margin-bottom: 10px;">${newLineData.info}</div>
        <div><b>Notes:</b></div>
        <div style="border: 1px solid #ccc; padding: 5px; border-radius: 5px;">
            ${newLineData.notes}
        </div>
    </div>
`);

    console.log('Adding line with id:', newLineData.lineId);

    // Set the ID of the line instance
    line.options.uuid = newLineData.lineId;

    // Add the line instance to the lineInstances object
    lineInstances[line.options.uuid] = line;
    console.log('Line added to lineInstances:', line.options.uuid);

    // Add a new row to the marker list table
    const newRow = markerListBody.insertRow();
    const truncatedUUID = newLineData.lineId.slice(0, 8); // Truncate UUID to the first 8 characters
    newRow.innerHTML = `
    <td class="idNum" data-full-uuid="${newLineData.lineId}">${truncatedUUID}</td> 
    <td class="description" contenteditable="false">${newLineData.info}</td>
    <td>line</td>
    <td class="line-color-cell" style="background-color: ${newLineData.color} !important;">${newLineData.color}</td>
    <td class="notes" data-uuid="${newLineData.lineId}" data-description="${newLineData.info}" contenteditable="false">${newLineData.notes}</td>
    <td><img class="delete-line-icon" src="/icons/trash.svg" alt="Delete Icon" style="cursor:pointer;width:20px;height:20px;"></td>`;

    // Add event listener to the line ID cell
    newRow.querySelector('td:first-child').addEventListener('click', function () {
        const lineId = this.dataset.fullUuid;
        const line = lineInstances[lineId];
        if (line) {
            line.openPopup();
        }
    });
    setTextColorBasedOnBgColor(newLineData.color, newRow.querySelector('.line-color-cell'));
    // Return the line instance
    return line;
}

async function deleteLine(lineUUID) {
    return new Promise(async (resolve, reject) => {
        // Find the line instance by uuid
        const lineInstance = Object.values(lineInstances).find(line => line.options.uuid == lineUUID);

        if (lineInstance) {
            // Remove the line from the map
            map.removeLayer(lineInstance);
            // Remove the line instance from the lineInstances object
            delete lineInstances[lineUUID];
            console.log('Deleting line with id:', lineUUID);

            // Remove the line from the table
            const rows = Array.from(markerListBody.querySelectorAll('tr'));
            const row = rows.find(r => r.querySelector('td:first-child').dataset.fullUuid == lineUUID);
            markerListBody.removeChild(row);

            // Update the local storage
            let linesData = JSON.parse(localStorage.getItem('linesData')) || [];
            linesData = linesData.filter(line => line.lineUUID !== lineUUID);
            localStorage.setItem('linesData', JSON.stringify(linesData));

            // Send the request to the server to delete the line
            fetch('/delete_line', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'id': lineUUID
                })
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    console.log('Line successfully deleted from the server');
                    resolve();
                })
                .catch(error => {
                    console.error('There was an error deleting the line from the server:', error);
                    reject(error);
                });
        } else {
            console.error(`Line with UUID ${lineUUID} not found.`);
            reject(new Error(`Line with UUID ${lineUUID} not found.`));
        }
    });
}

// Toggle markers visibility
function toggleMarkers() {
    const toggleButton = document.getElementById('toggle-markers-btn');
    const isVisible = toggleButton.dataset.visible === 'true';

    Object.values(markerInstances).forEach(function (marker) {
        if (isVisible) {
            marker.setOpacity(0);
        } else {
            marker.setOpacity(1);
        }
    });

    toggleButton.dataset.visible = isVisible ? 'false' : 'true';
    toggleButton.textContent = isVisible ? 'Show Markers' : 'Hide Markers';
}

// Event listener for toggle markers button
document.getElementById('toggle-markers-btn').addEventListener('click', function () {
    toggleMarkers();
});

// Toggle lines visibility
function toggleLines() {
    const toggleButton = document.getElementById('toggle-lines-btn');
    const isVisible = toggleButton.dataset.visible === 'true';

    Object.values(lineInstances).forEach(function (line) {
        if (isVisible) {
            line.setStyle({ opacity: 0, dashArray: '0' });
        } else {
            line.setStyle({ opacity: 1, dashArray: '' });
        }
    });

    toggleButton.dataset.visible = isVisible ? 'false' : 'true';
    toggleButton.textContent = isVisible ? 'Show Lines' : 'Hide Lines';
}

function getSnappedPoint(point) {
    const snappingTolerance = 1.5;
    let snappedPoint = point;

    // Calculate the distance to each start and end point of each line
    for (const lineId in lineInstances) {
        const line = lineInstances[lineId];
        const startPoint = line.getLatLngs()[0];
        const endPoint = line.getLatLngs()[1];

        if (euclideanDistance([point.lat, point.lng], [startPoint.lat, startPoint.lng]) < snappingTolerance) {
            snappedPoint = startPoint;
            break;
        }

        if (euclideanDistance([point.lat, point.lng], [endPoint.lat, endPoint.lng]) < snappingTolerance) {
            snappedPoint = endPoint;
            break;
        }
    }

    return snappedPoint;
}

// Event listener for toggle lines button
document.getElementById('toggle-lines-btn').addEventListener('click', function () {
    toggleLines();
});

// Event listener for delete marker or delete line icon
document.querySelector('#marker-list-body').addEventListener('click', async function (event) {
    if (event.target.matches('.delete-marker-icon') || event.target.matches('.delete-line-icon')) {
        const rowElement = event.target.closest('tr');
        const uuid = rowElement.querySelector('td:first-child').dataset.fullUuid; // Access the full UUID
        const description = rowElement.querySelector('td:nth-child(2)').textContent;

        // Truncate UUID to the first 8 characters
        const truncatedUUID = uuid.slice(0, 8);

        if (event.target.matches('.delete-marker-icon')) {
            if (confirm(`Are you sure you want to delete Marker ${truncatedUUID} with description "${description}"?`)) {
                await deleteMarker(uuid);
            }
        } else if (event.target.matches('.delete-line-icon')) {
            if (confirm(`Are you sure you want to delete Line ${truncatedUUID} with description "${description}"?`)) {
                await deleteLine(uuid);
            }
        }
    }
});

let addMode = 'marker'; // Possible values: 'marker', 'line'

// Event listener when the page loads
window.addEventListener('load', async function () {
    // Initialize the map and icons
    console.log("Image/Map Generated... Fetching icons");
    const response = await fetch('/icon_filenames');
    const iconNames = await response.json();

    icons = {};

    iconNames.forEach(iconName => {
        icons[iconName] = new SvgIcon({
            iconUrl: iconDirectory + '/' + iconName,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [0, -34]
        });
    });

    // Load subfolders in the image directory from the server
    await loadFolders();

    // Event listeners for form submission
    document.getElementById('upload-form').addEventListener('submit', function (event) {
        var fileInput = this.querySelector('input[type="file"]');
        if (!fileInput.files.length) {
            event.preventDefault();
            alert('Please select a file before uploading.');
        }
        // Add CSS class to ID cells
        const idCells = document.querySelectorAll('.id-cell');
        idCells.forEach(function (cell) {
            cell.classList.add('clickable');
        });
    });

    // Keep track of the points for the line
    let linePoints = [];
    let tempLine = null;

    // Listen for the end of any movement or zoom events and re-calculate the size of the map
    map.on('moveend zoomend', function () {
        map.invalidateSize();
    });

    // Event listener for map clicks
    map.on('click', function (e) {
        if (addMode === 'marker') {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;
            var popupContent = `
        <b>Choose Marker Icon:</b>
        <select id="marker-icon-type">
            ${Object.keys(icons).map(iconType => `<option value="${iconType}">${iconType}</option>`).join('')}
        </select><br>
        <b>Choose Marker Color:</b>
        <input type="color" id="marker-icon-color" value="#000000"><br>
        <b>Enter Marker Information:</b>
        <input type="text" id="marker-info" placeholder="Enter marker information..."><br>
        <b>Enter Marker Notes:</b>
        <textarea id="marker-notes" rows="4" cols="30" placeholder="Enter marker notes..."></textarea><br>
        <button id="add-marker-btn">Add Marker</button>`;

            var popup = L.popup()
                .setLatLng([lat, lng])
                .setContent(popupContent)
                .openOn(map);

            document.getElementById('add-marker-btn').addEventListener('click', function () {
                var info = document.getElementById('marker-info').value;
                var iconType = document.getElementById('marker-icon-type').value.replace('.svg', '');
                var iconColor = document.getElementById('marker-icon-color').value;
                var markerNotes = document.getElementById('marker-notes').value;
                addMarker(lat, lng, info, `${iconType}.svg`, iconColor, markerNotes);
                map.closePopup();
            });
        } else if (addMode === 'line') {
            // Snap the point if it's close to an existing point
            let snappedPoint = getSnappedPoint(e.latlng);

            // Use snappedPoint as the starting point
            linePoints.push(snappedPoint);

            if (linePoints.length === 1) {
                // Create a temporary line starting and ending at the first clicked point
                tempLine = L.polyline([linePoints[0], linePoints[0]], { color: 'red' }).addTo(map);
            } else if (linePoints.length > 1) {
                // Update the temporary line's end point
                tempLine.setLatLngs([linePoints[0], snappedPoint]);

                if (linePoints.length === 2) {
                    var startLatLng = linePoints[0];
                    var endLatLng = snappedPoint;;

                    // Create popup for the line
                    var popupContent = `
                <b>Choose Line Color:</b>
                <input type="color" id="line-color" value="#000000"><br>
                <b>Enter Line Information:</b>
                <input type="text" id="line-info" placeholder="Enter line information..."><br>
                <b>Enter Line Notes:</b>
                <textarea id="line-notes" rows="4" cols="30" placeholder="Enter line notes..."></textarea><br>
                <button id="add-line-btn">Add Line</button>`;

                    var popup = L.popup()
                        .setLatLng(endLatLng)
                        .setContent(popupContent)
                        .openOn(map);

                    document.getElementById('add-line-btn').addEventListener('click', function () {
                        var info = document.getElementById('line-info').value;
                        var color = document.getElementById('line-color').value;
                        var notes = document.getElementById('line-notes').value;
                        addLine(startLatLng, endLatLng, info, color, notes);

                        // If there is a temporary line, remove it
                        if (tempLine) {
                            map.removeLayer(tempLine);
                            tempLine = null;
                        }

                        map.closePopup();
                    });

                    map.on('popupclose', function () {
                        // If there is a temporary line, remove it
                        if (tempLine) {
                            map.removeLayer(tempLine);
                            tempLine = null;
                        }

                        // Clear the line points
                        linePoints = [];
                    });
                }
            }
        }
    });

    // Event listener for updating marker data in the marker list table
    markerListBody.addEventListener('input', function (event) {
        var target = event.target;
        var row = target.parentNode.parentNode;
        var markerUUID = row.querySelector('td:nth-child(2)').textContent;
        var description = row.querySelector('.description').textContent;
        var iconType = row.querySelector('td:nth-child(3)').textContent;
        var iconColor = row.querySelector('td:nth-child(4)').textContent;
        var notes = row.querySelector('td:nth-child(5)').textContent;
        updateMarker(markerUUID, description, iconType, iconColor, notes);
    });

    // Event listener for toggling add mode between marker and line
    document.getElementById('toggle-add-mode').addEventListener('click', function () {
        if (addMode === 'marker') {
            addMode = 'line';
            this.textContent = 'Switch to Marker Mode';
        } else {
            addMode = 'marker';
            this.textContent = 'Switch to Line Mode';
        }
    });

    // Event listeners for toggling the sidebar
    var sidebar = document.querySelector('.sidebar');
    var mapViewContainer = document.querySelector('.map-markers-view-container');
    var navSidebarToggler = document.querySelector('.nav-sidebar-toggler');
    var sidebarToggler = document.querySelector('.sidebar-toggler');
    var hideSidebarBtn = document.getElementById('hide-sidebar-btn');

    sidebarToggler.addEventListener('click', toggleSidebar);
    navSidebarToggler.addEventListener('click', toggleSidebar);
    hideSidebarBtn.addEventListener('click', toggleSidebar);

    // Function to toggle the sidebar visibility
    function toggleSidebar() {
        console.log("Sidebar toggled");
        sidebar.classList.toggle('collapsed');
        if (sidebar.classList.contains('collapsed')) {
            mapViewContainer.style.left = '0';
            mapViewContainer.style.width = '100%';
            hideSidebarBtn.textContent = "Show Sidebar";
        } else {
            mapViewContainer.style.left = '275px';
            mapViewContainer.style.width = 'calc(100% - 275px)';
            hideSidebarBtn.textContent = "Hide This Sidebar";
        }

        // Redraw the map after a delay to allow the sidebar transition to finish
        setTimeout(function () {
            map.invalidateSize();
        }, 200); // may need to adjust the timing later on this
    }
});

// Event listener for applying the saved map background on page load
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('map')) {
        applySavedMapBackground();
    }
});

// Event listener for opening a modal for the marker/line notes
document.querySelector('#marker-list-body').addEventListener('click', function (event) {
    if (event.target.matches('.notes')) {
        // Remove any existing modals
        const existingModal = document.querySelector('.note-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const note = event.target.textContent;
        const description = event.target.dataset.description;
        const uuid = event.target.dataset.uuid;

        // Create a modal for the note
        const noteModal = document.createElement('div');
        noteModal.classList.add('note-modal');

        // Create a content wrapper
        const noteContentWrapper = document.createElement('div');
        noteContentWrapper.style.display = 'flex';
        noteContentWrapper.style.flexDirection = 'column';
        noteContentWrapper.style.alignItems = 'center';
        noteModal.appendChild(noteContentWrapper);

        // Create the header
        const noteHeader = document.createElement('div');
        noteHeader.classList.add('note-header');
        noteHeader.style.display = 'flex';
        noteHeader.style.justifyContent = 'space-between';
        noteHeader.style.width = '60%';
        noteHeader.style.maxWidth = '800px';
        const headerText = document.createElement('span');
        headerText.textContent = 'Notes for: ' + uuid.slice(0, 8) + ' - ' + description;
        noteHeader.appendChild(headerText);

        // Create the close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.classList.add('close-button');
        closeButton.style.alignSelf = 'center';
        closeButton.style.fontSize = '28px';
        closeButton.style.padding = '12px';
        closeButton.style.margin = '12px';

        // Event listener for note modal close button
        closeButton.addEventListener('click', function () {
            noteModal.remove();
        });
        noteHeader.appendChild(closeButton);

        noteContentWrapper.appendChild(noteHeader);

        const noteContent = document.createElement('div');
        noteContent.classList.add('note-content');
        noteContent.textContent = note;
        noteContentWrapper.appendChild(noteContent);

        // Append the modal to the body
        document.body.appendChild(noteModal);
    }
});
window.addEventListener('beforeunload', function () {
    map.closePopup();
});
// Event listener for ID cell highlighting
document.querySelector('#marker-list-body').addEventListener('click', function (event) {
    if (event.target.matches('.id-cell')) {
        // Remove highlight class from all ID cells
        const idCells = document.querySelectorAll('.id-cell');
        idCells.forEach(function (cell) {
            cell.classList.remove('highlight');
        });

        // Add highlight class to the clicked ID cell
        event.target.classList.add('highlight');
    }
});

loadFolders();
applySavedMapBackground();
initializeIndexPage();