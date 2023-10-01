var iconDirectory = '/icons'; // Directory for icons

let dropdown = document.getElementById('folder-selector'); // Dropdown element

initializeDetailsPage();

async function initializeDetailsPage() {
    // Apply the saved theme
    const theme = await getSetting('Theme', 'mode');
    changeTheme(theme);

    // Load folders when the page loads
    loadFolders();
}

// Function to retrieve a specific setting value from the server
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

let customTheme = null;

// Function to fetch the custom theme CSS variables from the server
async function fetchCustomTheme() {
    try {
        // If we already fetched the theme, return early
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

// Function to change the theme of the page
function changeTheme(theme) {
    console.log(`Changing theme to: ${theme}`);
    let themes = ['light', 'dark', 'beach', 'forest', 'sunset', 'amethyst', 'custom'];
    themes.forEach((t) => {
        document.body.classList.remove(`${t}-mode`);
    });
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

// Function to load the available folders
async function loadFolders() {
    try {
        const response = await fetch('/get_folders');
        const folders = await response.json();

        // Populate the dropdown menu
        dropdown.innerHTML = '';
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder;
            dropdown.appendChild(option);
        });

        // Select the first option in the dropdown by default
        if (dropdown.options.length > 0) {
            dropdown.selectedIndex = 0;
            dropdown.dispatchEvent(new Event('change'));
        }
    } catch (error) {
        console.error('Error fetching folders:', error);
    }
}

let currentFolder; // Current selected folder

// Event listener for folder selection change
document.getElementById('folder-selector').addEventListener('change', function () {
    currentFolder = this.value;
    loadMarkersAndLines(this.value);
});

// Function to load markers and lines for the selected folder
async function loadMarkersAndLines(folderName) {
    if (!folderName) {
        console.warn('loadMarkersAndLines called without a folder name');
        return;
    }

    try {
        const markersResponse = await fetch(`/markers/${folderName}`);
        const markersData = await markersResponse.json();

        const linesResponse = await fetch(`/lines/${folderName}`);
        const linesData = await linesResponse.json();

        const tableBody = document.getElementById('details-marker-table-body');
        tableBody.innerHTML = '';

        for (const marker of markersData) {
            const row = await createMarkerRow(marker, 'marker');
            tableBody.appendChild(row);
        }

        for (const line of linesData) {
            console.log('loadMarkersAndLines Loaded line color:', line.color);
            const row = await createMarkerRow(line, 'line');
            tableBody.appendChild(row);
        }

        // Attach click event listeners to the rows
        const rows = tableBody.querySelectorAll('tr');
        for (const row of rows) {
            row.addEventListener('click', selectMarker);
        }
    } catch (error) {
        console.error('Error fetching markers and lines:', error);
    }
}

// Function to set text color based on background color
function setTextColorBasedOnBgColor(bgColor, element) {
    var color = (parseInt(bgColor.slice(1), 16) > 0xffffff / 2) ? 'black' : 'white';
    element.style.color = color;
}

// Function to create a table cell with the provided text
function createCell(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
}

// Function to create a marker row
async function createMarkerRow(item, type) {
    let row = document.createElement('tr');

    let idCell = document.createElement('td');
    if (type === 'marker') {
        idCell.textContent = truncateUUID(item.markerId, 8);
        row.dataset.markerId = item.markerId;
    } else {
        idCell.textContent = truncateUUID(item.lineId, 8);
        row.dataset.lineId = item.lineId;
    }
    row.appendChild(idCell);

    let iconCell = document.createElement('td');
    if (type === 'marker') {
        const imgElement = document.createElement('img');
        imgElement.src = await loadSvgIcon(item.iconType, item.iconColor);
        imgElement.setAttribute('data-icon-type', item.iconType);
        iconCell.appendChild(imgElement);
    } else {
        iconCell.textContent = "line";
        iconCell.style.color = item.color;
        row.dataset.lineColor = item.color;
    }
    row.appendChild(iconCell);

    let descCell = document.createElement('td');
    descCell.textContent = item.info;
    descCell.className = 'desc-cell';
    row.appendChild(descCell);

    let notesCell = document.createElement('td');
    notesCell.textContent = item.markerNotes || item.notes;
    row.appendChild(notesCell);

    let colorCell = document.createElement('td');
    colorCell.textContent = item.iconColor;
    colorCell.style.display = 'none';
    colorCell.className = 'icon-color-cell';
    row.appendChild(colorCell);
    console.log('createMarkerRow Color value:', item.color);

    row.addEventListener('click', selectMarker);

    return row;
}

// Function to create a line row
function createLineRow(line) {
    const row = document.createElement('tr');

    row.appendChild(createCell(truncateUUID(line.lineId, 8)));
    row.dataset.lineId = line.lineId;

    const iconCell = createCell('');
    row.appendChild(iconCell);

    const infoCell = createCell(line.info);
    infoCell.className = 'desc-cell';
    row.appendChild(infoCell);

    const colorCell = createCell(line.color);
    colorCell.textContent = line.color;
    colorCell.style.backgroundColor = line.color;
    setTextColorBasedOnBgColor(line.color, colorCell);
    colorCell.style.display = 'none';
    colorCell.className = 'icon-color-cell';
    row.appendChild(colorCell);

    console.log('createLineRow Color value:', line.color);

    row.appendChild(createCell(line.notes));

    return row;
}

// Function to load an SVG icon with the provided name and color
async function loadSvgIcon(iconName, color) {
    try {
        const response = await fetch(`${iconDirectory}/${iconName}`);
        let svgText = await response.text();

        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

        svgDoc.querySelector('svg').style.fill = color;

        const serializer = new XMLSerializer();
        svgText = serializer.serializeToString(svgDoc.documentElement);

        return 'data:image/svg+xml;base64,' + btoa(svgText);
    } catch (error) {
        console.error(`Error loading SVG icon: ${iconName}`, error);
        return '';
    }
}

// Function to create an icon cell with the provided icon name and color
async function createIconCell(iconName, color) {
    const cell = document.createElement('td');
    const iconElement = document.createElement('img');
    iconElement.src = await loadSvgIcon(iconName, color);
    iconElement.setAttribute('data-icon-type', iconName);
    cell.appendChild(iconElement);
    return cell;
}

// Function to truncate a UUID to the specified length
function truncateUUID(uuid, length) {
    return uuid.substring(0, length);
}

// Function to handle the selection of a marker or line row
function selectMarker(event) {
    const row = event.target.closest('tr');
    const markerId = row.dataset.markerId;
    const lineId = row.dataset.lineId;
    const iconColorCell = row.querySelector('.icon-color-cell');

    if ((!markerId && !lineId) || !iconColorCell) {
        console.error('Error selecting marker: missing data');
        return;
    }

    if (markerId) {
        const type = 'marker';
        let iconType;
        const imgElement = row.querySelector('img');
        if (imgElement) {
            iconType = imgElement.dataset.iconType;
        }
        const rowData = {
            id: markerId,
            iconType: iconType,
            info: row.children[2].textContent,
            color: iconColorCell.textContent,
            notes: row.children[3].textContent
        };
        console.log('selectMarker: Icon type:', iconType);

        openEditModal(rowData, type);
    } else if (lineId) {
        const type = 'line';
        const rowData = {
            id: lineId,
            info: row.children[2].textContent,
            color: row.dataset.lineColor,
            notes: row.children[3].textContent
        };
        openEditModal(rowData, type);
    }

    document.querySelectorAll('#details-marker-table tbody tr').forEach(row => {
        row.classList.remove('highlight');
    });

    row.classList.add('highlight');
}

// Event listener for cancel button click outside of the openEditModal function
document.getElementById('edit-marker-cancel').addEventListener('click', () => {
    document.querySelectorAll('#details-marker-table tbody tr').forEach(row => {
        row.classList.remove('highlight');
    });
    document.getElementById('edit-marker-modal').style.display = 'none';
});

// Function to open the edit modal for a marker or line
function openEditModal(item, type) {
    console.log('Color value in openEditModal:', item.color);
    console.log('Type value in openEditModal:', type);

    // Populate the modal with the current marker or line info
    document.getElementById('edit-marker-description').value = item.info;
    document.getElementById('edit-marker-notes').value = item.notes;
    document.getElementById('edit-marker-icon-color').value = item.color;

    if (type === 'marker') {
        loadIconOptions(item.iconType);
        document.getElementById('edit-marker-icon-type').style.display = 'block';  // Show for markers
        document.getElementById('edit-marker-icon-type').disabled = false; // Enable for markers
    } else {
        document.getElementById('edit-marker-icon-type').style.display = 'none';  // Hide for lines
        document.getElementById('edit-marker-icon-type').disabled = true; // Disable for lines
    }

    // Show the modal
    document.getElementById('edit-marker-modal').style.display = 'block';

    // Remove any existing event listeners
    const editSubmitButton = document.getElementById('edit-marker-submit');
    const newSubmitButton = editSubmitButton.cloneNode(true);
    editSubmitButton.parentNode.replaceChild(newSubmitButton, editSubmitButton);

    // When the submit button is clicked, update the marker or line info
    newSubmitButton.addEventListener('click', () => {
        // Update the item object with the new info
        item.info = document.getElementById('edit-marker-description').value;
        item.notes = document.getElementById('edit-marker-notes').value;
        item.color = document.getElementById('edit-marker-icon-color').value;
        if (type === 'marker') {
            item.iconType = document.getElementById('edit-marker-icon-type').value;
        }

        // Send the updated marker or line back to the server
        const endpoint = type === 'marker' ? '/update_marker' : '/update_line';

        let body;
        if (type === 'marker') {
            body = JSON.stringify({
                id: item.id,
                info: item.info,
                markerNotes: item.notes,
                iconColor: item.color,
                iconType: item.iconType
            });
        } else if (type === 'line') {
            body = JSON.stringify({
                id: item.id,
                info: item.info,
                color: item.color,
                notes: item.notes
            });
        }

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                // Hide the modal and reload the markers and lines
                document.getElementById('edit-marker-modal').style.display = 'none';
                loadMarkersAndLines(currentFolder);
            })
            .catch((error) => {
                console.error('There has been a problem with your fetch operation:', error);
            });
    });
}

// Function to load the available icon options for markers
async function loadIconOptions(currentIconType) {
    try {
        const response = await fetch('/icon_filenames');
        const iconFilenames = await response.json();

        const select = document.getElementById('edit-marker-icon-type');
        select.innerHTML = '';
        for (const filename of iconFilenames) {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename;
            if (filename === currentIconType) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    } catch (error) {
        console.error('Error loading icon options:', error);
    }
}

// Function to export the current folder data as a CSV file
async function exportCSV() {
    try {
        const response = await fetch(`/export/${currentFolder}`);
        if (!response.ok) { // If HTTP status is not ok
            const data = await response.json();
            throw new Error(data.error); // Use error message from the server
        }
        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentFolder}.csv`;
        a.click();
    } catch (error) {
        console.error('Error exporting CSV:', error);
    }
}

let sortAscending = true;

// Function to sort the table based on the selected column
function sortTable(n) {
    const table = document.getElementById("details-marker-table-body");
    let rows, switching, i, x, y, shouldSwitch;

    switching = true;
    // Make a loop that will continue until no switching has been done:
    while (switching) {
        switching = false;
        rows = table.rows;
        // Loop through all table rows (except the headers):
        for (i = 0; i < (rows.length - 1); i++) {
            shouldSwitch = false;
            // Get the two elements we want to compare,
            // one from the current row and one from the next:
            x = rows[i].getElementsByTagName("TD")[n];
            y = rows[i + 1].getElementsByTagName("TD")[n];
            // Check if the two rows should switch place:
            if (sortAscending ? x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase() : x.innerHTML.toLowerCase() < y.innerHTML.toLowerCase()) {
                // If so, mark as a switch and break the loop:
                shouldSwitch = true;
                break;
            }
        }
        if (shouldSwitch) {
            // If a switch has been marked, make the switch
            // and mark that a switch has been done:
            rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
            switching = true;
        }
    }
    // Flip the sorting order for next time
    sortAscending = !sortAscending;
}

// Event listener for search input keyup
document.getElementById('search-input').addEventListener('keyup', function (e) {
    const searchValue = e.target.value.toLowerCase();

    // Get the marker and line rows each time a keyup event occurs
    const markerRows = document.querySelectorAll('#details-marker-table-body tr');
    const lineRows = document.querySelectorAll('#details-line-table-body tr');

    // Combine markerRows and lineRows into a single array
    const allRows = [...markerRows, ...lineRows];

    allRows.forEach(function (row) {
        const descCell = row.querySelector('.desc-cell');
        if (descCell && descCell.textContent.toLowerCase().includes(searchValue)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});

// Event listeners for sortable headers
document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', function () {
        sortTable(header.cellIndex);
    });
});

// Event listener for export button click
document.getElementById('export-button').addEventListener('click', exportCSV);

document.getElementById('edit-marker-modal').style.display = 'none';