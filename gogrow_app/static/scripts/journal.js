document.addEventListener('DOMContentLoaded', function () {

    // Define a class for SvgIcon that extends L.Icon
    class SvgIcon extends L.Icon {
        constructor(options) {
            super(options);
            this._iconUrl = options.iconUrl;
            this._iconColor = options.iconColor || '#000000'; // Default color is black
        }

        // Create the icon element and set its styles
        createIcon(oldIcon) {
            const icon = (oldIcon && oldIcon.tagName === 'IMG') ? oldIcon : document.createElement('img');
            this._setIconStyles(icon, 'icon');

            // Fetch the SVG icon file and modify its fill color
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

    // Asynchronously load the folders
    async function loadFolders() {
        try {
            const response = await fetch('/get_folders');
            const folders = await response.json();

            const dropdown = document.getElementById('image-directory');
            dropdown.innerHTML = '';

            // Populate the dropdown with folder options
            folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                dropdown.appendChild(option);
            });

            // Select the first option and trigger the 'change' event
            if (dropdown.options.length > 0) {
                dropdown.selectedIndex = 0;
                dropdown.dispatchEvent(new Event('change'));
            }

        } catch (error) {
            console.error('Error fetching folders:', error);
        }
    }

    var quill;

    // Initialize the journal page
    function initializeJournalPage() {
        // Register the Image Uploader module
        Quill.register('modules/imageUploader', ImageUploader);

        // Initialize Quill with required configurations
        quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Enter journal contents...',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block'],        // toggled buttons
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'script': 'sub' }, { 'script': 'super' }],      // superscript/subscript
                    [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults
                    [{ 'font': [] }],
                    [{ 'align': [] }],
                    ['clean'],                                         // remove formatting button
                    ['image']                                          // image button
                ],
                imageUploader: {
                    // Define the upload function for images
                    upload: file => {
                        return new Promise((resolve, reject) => {
                            const formData = new FormData();
                            formData.append("image", file);

                            // Send the image data to the server for uploading
                            fetch("/upload_image", {
                                method: "POST",
                                body: formData
                            }).then(response => response.json())
                                .then(result => {
                                    if (result.status === "OK") {
                                        resolve(result.data); // URL of the uploaded image
                                    } else {
                                        reject("Failed to upload image");
                                    }
                                }).catch(error => {
                                    reject(error);
                                });
                        });
                    }
                }
            }
        });

        let quillEditor = document.querySelector('.ql-editor');

        quillEditor.addEventListener('input', () => {
            if (quillEditor.textContent.trim() === '') {
                quillEditor.classList.remove('has-content');
            } else {
                quillEditor.classList.add('has-content');
            }
        });

        // On page load, trigger the input event to initialize the placeholder visibility
        quillEditor.dispatchEvent(new Event('input'));

        // Apply the saved theme
        (async function () {
            const theme = await getSetting('Theme', 'mode');
            console.log(`Applying theme: ${theme}`);
            changeTheme(theme);
        })();
    }

    // Retrieve settings from the server
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

    initializeJournalPage();
    changeTheme();

    let currentFolder;

    let markersAndLinesMap = new Map(); // Global variable to store markers and lines data (MAY NEED TO REMOVE THIS)

    // Load markers and lines for a given folder
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

            const itemsDropdown = document.getElementById('linked-item');
            itemsDropdown.innerHTML = ''; // Clear the dropdown

            // Add a default option for not associating an item
            let defaultOption = document.createElement('option');
            defaultOption.value = '';  // No associated item
            defaultOption.textContent = 'None';  // Displayed text
            itemsDropdown.appendChild(defaultOption);

            // Add marker options to the dropdown
            for (const marker of markersData) {
                const option = document.createElement('option');
                option.value = `Marker:${marker.markerId}`;
                // Include the marker's notes in the displayed text
                option.textContent = `Marker: ${marker.markerId.substring(0, 8)} - ${marker.info} - ${marker.markerNotes}`;
                option.style.color = marker.iconColor; // Assign the marker's color to its respective option text
                itemsDropdown.appendChild(option);
            }

            // Add line options to the dropdown
            for (const line of linesData) {
                const option = document.createElement('option');
                option.value = `Line:${line.lineId}`;
                // Include the line's notes in the displayed text
                option.textContent = `Line: ${line.lineId.substring(0, 8)} - ${line.info} - ${line.notes}`;
                option.style.color = line.color; // Assign the line's color to its respective option text
                itemsDropdown.appendChild(option);
            }

            // Handle the 'change' event of the items dropdown
            itemsDropdown.addEventListener('change', function () {
                const linkedItemId = this.value; // Keep the whole value including prefix
                const linkedItemText = this.options[this.selectedIndex].text;

                if (linkedItemId) {
                    const linkedItemsContainer = document.getElementById('linked-items-container');

                    // Check if the selected item already exists in the linked items container
                    const existingLinkedItem = Array.from(linkedItemsContainer.children).find(li => li.dataset.id === linkedItemId);

                    if (!existingLinkedItem) {
                        const linkedItemDiv = document.createElement('div');
                        linkedItemDiv.textContent = linkedItemText;
                        linkedItemDiv.dataset.id = linkedItemId; // Store the whole ID including prefix
                        linkedItemDiv.addEventListener('click', function () {
                            this.remove();
                        });

                        linkedItemsContainer.appendChild(linkedItemDiv);
                    } else {
                        // Notify the user that the item is already linked
                        alert('This item is already linked. Please select a different item.');
                    }
                }

                this.selectedIndex = 0; // Reset the dropdown selection
            });

        } catch (error) {
            console.error('Error fetching markers and lines:', error);
        }
    }

    let allJournalEntries = [];

    async function loadJournalEntries(folderName) {
        if (!folderName) {
            console.warn('loadJournalEntries called without a folder name');
            return;
        }

        try {
            // Fetch journal entries for the specified folder
            const response = await fetch(`/journals/${folderName}`);
            const journalData = await response.json();

            const list = document.getElementById('journal-entry-list');
            list.innerHTML = ''; // Clear the list

            // Create list items for each journal entry
            for (const journal of journalData) {
                console.log(journal);
                const listItem = document.createElement('li');
                listItem.textContent = `${journal.entry_date}: ${journal.entry_title}`;
                listItem.dataset.id = journal.id; // Store the journal entry id on the list item
                list.appendChild(listItem);
            }

            allJournalEntries = journalData;
            displayJournalEntries(allJournalEntries);

            // Attach click event listeners to the list items
            const listItems = list.querySelectorAll('li');
            for (const listItem of listItems) {
                listItem.addEventListener('click', selectJournalEntry);
            }

        } catch (error) {
            console.error('Error fetching journal entries:', error);
        }
    }

    async function deleteJournalEntry(journalId) {
        try {
            const response = await fetch(`/delete_journal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: journalId })
            });

            if (response.status === 200) {
                // Remove the journal from the allJournalEntries array and update the list
                allJournalEntries = allJournalEntries.filter(journal => journal.id !== journalId);
                displayJournalEntries(allJournalEntries);
                // Remove 'selected' class from any list items that have it
                const selectedListItem = document.querySelector('.selected');
                if (selectedListItem) {
                    selectedListItem.classList.remove('selected');
                }
                setEditMode(false);
                document.getElementById('journal-id').value = '';
            } else {
                console.error('Error deleting journal:', response);
            }
        } catch (error) {
            console.error('Error deleting journal:', error);
        }
    }

    function displayJournalEntries(journalEntries) {
        const list = document.getElementById('journal-entry-list');
        list.innerHTML = ''; // Clear the list

        // Sort the journal entries based on the is_favorite property
        const sortedEntries = journalEntries.sort((a, b) => {
            if (a.is_favorite === 'yes' && b.is_favorite !== 'yes') {
                return -1; // a comes first if it is favorited and b is not
            } else if (a.is_favorite !== 'yes' && b.is_favorite === 'yes') {
                return 1; // b comes first if it is favorited and a is not
            }
            return 0; // no change in order
        });

        for (const journal of sortedEntries) {
            const listItem = document.createElement('li');
            listItem.textContent = `${journal.entry_date}: ${journal.entry_title}`;
            listItem.dataset.id = journal.id; // Store the journal entry id on the list item

            if (journal.is_favorite === 'yes') {
                const starIcon = document.createElement('img');
                starIcon.src = '/icons/star.svg';
                starIcon.alt = 'Star Icon';
                starIcon.style.height = '15px';
                starIcon.style.width = '15px';
                starIcon.style.marginRight = '10px';
                listItem.prepend(starIcon);
            }

            list.appendChild(listItem);
        }

        // Attach click event listeners to the list items
        const listItems = list.querySelectorAll('li');
        for (const listItem of listItems) {
            listItem.addEventListener('click', selectJournalEntry);
        }
    }

    // Delete journal entry button click event listener
    document.getElementById('delete-journal').addEventListener('click', function () {
        const journalIdField = document.getElementById('journal-id');
        const journalId = journalIdField.value;

        if (!journalId) {
            console.warn('No journal selected to delete.');
            return;
        }

        const journal = allJournalEntries.find(journal => journal.id === journalId);
        if (!journal) {
            console.warn(`No journal found with ID: ${journalId}`);
            return;
        }

        if (window.confirm(`Do you really want to delete the journal "${journal.entry_title}"?`)) {
            if (window.confirm(`The deletion of a journal entry is final - there is NO WAY to restore a journal entry after deletion unless a backup has been made of the image directory from the settings page. Are you sure you want to delete journal "${journal.entry_title}"?`)) {
                deleteJournalEntry(journalId);
            }
        }
    });

    // Image directory dropdown change event listener
    document.getElementById('image-directory').addEventListener('change', async function () {
        currentFolder = this.value;

        // Update the thumbnail
        const thumbnailContainer = document.getElementById('thumbnail-container');
        thumbnailContainer.innerHTML = ''; // Clear the current thumbnail
        const thumbnail = document.createElement('img');
        thumbnail.src = `/img/${currentFolder}/thumbnail-${currentFolder}.png`;
        thumbnail.alt = `${currentFolder} thumbnail`;
        thumbnail.style.width = '99px';
        thumbnail.style.height = '99px';
        thumbnailContainer.appendChild(thumbnail);

        // Flexbox to center align the image
        thumbnailContainer.style.display = 'flex';
        thumbnailContainer.style.justifyContent = 'center';
        thumbnailContainer.style.alignItems = 'center';

        loadJournalEntries(currentFolder);

        // Clear the selected journal entry when changing folders
        setEditMode(false);
        document.getElementById('journal-id').value = '';

        await loadMarkersAndLines(currentFolder);
    });

    function setEditMode(isEditing) {
        const submitButton = document.getElementById('submit-journal');
        const journalTitle = document.getElementById('journal-title');
        const journalEntry = quill.root.innerHTML;
        const linkedItem = document.getElementById('linked-item');
        const journalIdField = document.getElementById('journal-id');

        const deleteButton = document.getElementById('delete-journal');

        if (isEditing) {
            submitButton.textContent = "Submit Journal Edits";
            deleteButton.disabled = false;
        } else {
            submitButton.textContent = "Submit New Journal";
            journalTitle.value = '';
            quill.setContents([]);
            linkedItem.selectedIndex = 0;
            journalIdField.value = '';
            deleteButton.disabled = true;

            // Reset the checkbox
            document.getElementById('is-favorite').checked = false;

            // Clear linked-items-container
            const linkedItemsContainer = document.getElementById('linked-items-container');
            while (linkedItemsContainer.firstChild) {
                linkedItemsContainer.removeChild(linkedItemsContainer.firstChild);
            }
        }
    }

    // Cancel journal button click event listener
    document.getElementById('cancel-journal').addEventListener('click', function () {
        setEditMode(false);
        document.getElementById('linked-item').selectedIndex = 0;

        // Reset the favorite checkbox
        document.getElementById('is-favorite').checked = false;

        // Remove 'selected' class from any list items that have it
        const selectedListItem = document.querySelector('.selected');
        if (selectedListItem) {
            selectedListItem.classList.remove('selected');
        }
    });

    // Journal search input event listener
    document.getElementById('journal-search-input').addEventListener('input', async function (event) {
        const searchTerm = event.target.value.toLowerCase();
        let filteredEntries;

        switch (searchModes[currentSearchModeIndex]) {
            case 'Titles':
                filteredEntries = allJournalEntries.filter(entry =>
                    entry.entry_title.toLowerCase().includes(searchTerm)
                );
                break;
            case 'Contents':
                filteredEntries = allJournalEntries.filter(entry =>
                    entry.entry_content.toLowerCase().includes(searchTerm)
                );
                break;
            case 'Dates':
                filteredEntries = allJournalEntries.filter(entry =>
                    entry.entry_date && entry.entry_date.toLowerCase().includes(searchTerm)
                );
                break;
            case 'Linked Item Notes':
                const itemsNotes = await fetchAllItemsNotes();
                filteredEntries = filterByLinkedItems(searchTerm, itemsNotes);
                break;
            case 'Linked Item Descriptions':
                const itemsDescriptions = await fetchAllItemsDescriptions();
                filteredEntries = filterByLinkedItems(searchTerm, itemsDescriptions);
                break;
            default:
                filteredEntries = allJournalEntries;
        }

        displayJournalEntries(filteredEntries);
    });

    async function fetchAllItemsNotes() {
        const markersResponse = await fetch(`/markers/${currentFolder}`);
        const markersData = await markersResponse.json();
        const linesResponse = await fetch(`/lines/${currentFolder}`);
        const linesData = await linesResponse.json();

        const items = new Map();
        for (const marker of markersData) {
            items.set(`Marker:${marker.markerId}`, marker.markerNotes.toLowerCase());
        }
        for (const line of linesData) {
            items.set(`Line:${line.lineId}`, line.notes.toLowerCase());
        }

        return items;
    }

    async function fetchAllItemsDescriptions() {
        const markersResponse = await fetch(`/markers/${currentFolder}`);
        const markersData = await markersResponse.json();
        const linesResponse = await fetch(`/lines/${currentFolder}`);
        const linesData = await linesResponse.json();

        const items = new Map();
        for (const marker of markersData) {
            items.set(`Marker:${marker.markerId}`, marker.info.toLowerCase());
        }
        for (const line of linesData) {
            items.set(`Line:${line.lineId}`, line.info.toLowerCase());
        }

        return items;
    }

    function filterByLinkedItems(searchTerm, items) {
        return allJournalEntries.filter(entry => {
            if (!entry.linked_item_id) {
                return false;
            }

            const linkedItems = entry.linked_item_id.split(',');
            for (const itemId of linkedItems) {
                const itemValue = items.get(itemId);
                if (itemValue && itemValue.includes(searchTerm)) {
                    return true;
                }
            }

            return false;
        });
    }

    async function selectJournalEntry(event) {
        setEditMode(false); // Reset the form

        // Remove 'selected' class from any list items that have it
        const selectedListItem = document.querySelector('.selected');
        if (selectedListItem) {
            selectedListItem.classList.remove('selected');
        }

        const journalId = event.target.dataset.id;
        const listItem = event.target;

        // Add 'selected' class to the clicked list item
        listItem.classList.add('selected');

        try {
            const response = await fetch(`/journals/${currentFolder}/${journalId}`);
            const journalData = await response.json();
            document.getElementById('journal-title').value = journalData.entry_title;
            quill.root.innerHTML = journalData.entry_content;

            const journalIdField = document.getElementById('journal-id');
            journalIdField.value = journalId;

            const isFavoriteCheckbox = document.getElementById('is-favorite');
            isFavoriteCheckbox.checked = journalData.is_favorite === 'yes';

            const listItem = event.target;
            if (journalData.is_favorite === 'yes') {
                listItem.classList.add('favorite');
            } else {
                listItem.classList.remove('favorite');
            }

            // Fetch the image URL
            const imageResponse = await fetch(`/get_image_url/${currentFolder}`);
            const imageUrl = await imageResponse.text();
            if (!imageUrl) {
                console.error('Error fetching image URL');
            }

            // Initialize itemDetails as an empty object
            let itemDetails = {};

            // Store imageUrl in itemDetails
            itemDetails.imageUrl = imageUrl;

            const linkedItemsContainer = document.getElementById('linked-items-container');
            linkedItemsContainer.innerHTML = ''; // Clear the container

            // Split the string into an array
            const linkedItems = journalData.linked_item_id.split(',');

            // Loop over the array and fetch details for each item
            for (const itemId of linkedItems) {
                // Skip this iteration of the loop if itemId is an empty string
                if (itemId === '') {
                    continue;
                }

                const [itemType, uuid] = itemId.split(':');
                let itemColor;
                let itemNotes;
                if (itemType === 'Marker') {
                    const markerResponse = await fetch(`/markers/${currentFolder}/${uuid}`);
                    itemDetails = await markerResponse.json();
                    itemColor = itemDetails.iconColor;
                    itemNotes = itemDetails.markerNotes;
                } else if (itemType === 'Line') {
                    const lineResponse = await fetch(`/lines/${currentFolder}/${uuid}`);
                    itemDetails = await lineResponse.json();
                    itemColor = itemDetails.color;
                    itemNotes = itemDetails.notes;
                }

                const isFavoriteCheckbox = document.getElementById('is-favorite'); // Checkbox for making it a favorite should be "checked" if it's a favorite already
                isFavoriteCheckbox.checked = journalData.is_favorite === 'yes';

                const listItem = event.target;
                listItem.classList.toggle('favorite', journalData.is_favorite === 'yes');

                // Create a new table row for this item and append it to the table
                const linkedItemRow = document.createElement('tr');
                linkedItemRow.dataset.id = itemId; // Store the whole ID including prefix

                // Add columns (cells) for each piece of data
                const typeCell = document.createElement('td');
                typeCell.textContent = itemType;
                typeCell.style.color = itemColor;
                linkedItemRow.appendChild(typeCell);

                const idCell = document.createElement('td');
                idCell.textContent = uuid.substring(0, 8);
                linkedItemRow.appendChild(idCell);

                const infoCell = document.createElement('td');
                infoCell.textContent = itemDetails.info;
                linkedItemRow.appendChild(infoCell);

                const notesCell = document.createElement('td');
                notesCell.textContent = itemNotes;
                linkedItemRow.appendChild(notesCell);

                const actionCell = document.createElement('td');
                const showMapButton = document.createElement('button');
                showMapButton.textContent = 'Show on Map';
                showMapButton.style.backgroundColor = 'var(--primary-btn-bg)';
                showMapButton.style.color = 'var(--primary-btn-text)';
                showMapButton.style.border = 'none';
                showMapButton.style.padding = '10px 20px';
                showMapButton.style.margin = '5px';
                showMapButton.style.cursor = 'pointer';
                showMapButton.style.borderRadius = '5px';
                showMapButton.style.transition = 'background-color 0.3s ease';

                showMapButton.addEventListener('mouseenter', function () {
                    this.style.backgroundColor = 'var(--primary-hover-bg)';
                    this.style.color = 'var(--primary-hover-text)';
                });

                showMapButton.addEventListener('mouseleave', function () {
                    this.style.backgroundColor = 'var(--primary-btn-bg)';
                    this.style.color = 'var(--primary-btn-text)';
                });

                showMapButton.addEventListener('click', ((details) => {
                    return () => showModalWithMap(details);
                })(itemDetails));

                actionCell.appendChild(showMapButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.style.backgroundColor = 'var(--primary-btn-bg)';
                deleteButton.style.color = 'var(--primary-btn-text)';
                deleteButton.style.border = 'none';
                deleteButton.style.padding = '10px 20px';
                deleteButton.style.margin = '5px';
                deleteButton.style.cursor = 'pointer';
                deleteButton.style.borderRadius = '5px';
                deleteButton.style.transition = 'background-color 0.3s ease';

                deleteButton.addEventListener('mouseenter', function () {
                    this.style.backgroundColor = 'var(--primary-hover-bg)';
                    this.style.color = 'var(--primary-hover-text)';
                });

                deleteButton.addEventListener('mouseleave', function () {
                    this.style.backgroundColor = 'var(--primary-btn-bg)';
                    this.style.color = 'var(--primary-btn-text)';
                });

                deleteButton.addEventListener('click', function () {
                    // Ask for confirmation
                    if (window.confirm('Do you really want to remove this item?')) {
                        // Remove the linked item from the table
                        linkedItemRow.remove();
                    }
                });
                actionCell.appendChild(deleteButton);

                linkedItemRow.appendChild(actionCell);

                linkedItemsContainer.appendChild(linkedItemRow);
            }

            setEditMode(true);
        } catch (error) {
            console.error('Error fetching journal entry:', error);
        }
    }

    // Global variable to keep track of the current modal
    let currentModal = null;

    async function showModalWithMap(itemDetails) {
        // Remove the current modal if it exists
        if (currentModal) {
            currentModal.remove();
        }

        // Create a modal and a div for the map
        const mapModal = document.createElement('div');
        mapModal.id = 'map-modal';
        mapModal.style.display = 'flex';
        mapModal.style.flexDirection = 'column';
        mapModal.style.justifyContent = 'space-between';
        mapModal.style.width = '300px';
        mapModal.style.height = '300px';
        mapModal.style.position = 'fixed';
        mapModal.style.zIndex = '1';
        mapModal.style.left = '50%';
        mapModal.style.top = '50%';
        mapModal.style.transform = 'translate(-50%, -50%)';
        mapModal.style.backgroundColor = 'var(--primary-bg)';

        const mapDiv = document.createElement('div');
        mapDiv.id = 'mapid';
        mapDiv.style.height = '100%';
        mapModal.appendChild(mapDiv);

        // Add details about the marker or line at the top of the modal
        const itemInfoContainer = document.createElement('div');
        itemInfoContainer.style.backgroundColor = 'var(--primary-bg)';
        itemInfoContainer.style.color = 'var(--primary-text)';
        itemInfoContainer.style.padding = '10px';
        itemInfoContainer.style.marginBottom = '10px';
        itemInfoContainer.style.borderRadius = '5px';

        const itemName = document.createElement('h3');
        itemName.textContent = `Info: ${itemDetails.info}`;
        itemName.style.marginBottom = '5px';

        const itemId = document.createElement('p');
        itemId.textContent = `ID: ${itemDetails.markerId || itemDetails.lineId}`; // ID can be either a markerId or lineId
        itemId.style.margin = '0';

        const itemDescription = document.createElement('p');
        itemDescription.textContent = `Notes: ${itemDetails.markerNotes || itemDetails.notes}`; // Description can be either markerNotes or notes
        itemDescription.style.marginTop = '5px';

        itemInfoContainer.appendChild(itemName);
        itemInfoContainer.appendChild(itemId);
        itemInfoContainer.appendChild(itemDescription);
        mapModal.appendChild(itemInfoContainer);
        mapModal.appendChild(mapDiv);

        // Create a close button
        const closeModalButton = document.createElement('button');
        closeModalButton.textContent = 'Close';
        closeModalButton.className = 'modal-close-button';
        closeModalButton.style.backgroundColor = 'var(--primary-btn-bg)';
        closeModalButton.style.color = 'var(--primary-btn-text)';
        closeModalButton.onmouseover = () => {
            closeModalButton.style.backgroundColor = 'var(--primary-hover-bg)';
            closeModalButton.style.color = 'var(--primary-hover-text)';
        };
        closeModalButton.onmouseout = () => {
            closeModalButton.style.backgroundColor = 'var(--primary-btn-bg)';
            closeModalButton.style.color = 'var(--primary-btn-text)';
        };
        closeModalButton.onclick = () => mapModal.remove();

        mapModal.appendChild(closeModalButton);

        document.body.appendChild(mapModal);

        // Set the current modal to the new modal
        currentModal = mapModal;

        document.body.appendChild(mapModal);

        // Initialize the map
        const map = L.map('mapid', {
            crs: L.CRS.Simple,
            minZoom: -3
        });

        try {
            // Get the URL of the latest image from the server
            const response = await fetch(`/get_image_url/${currentFolder}`);
            const imageUrl = await response.text();
            console.log(`Image URL: ${imageUrl}`);

            // Create a new image element
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

                // Add a new image overlay to the map
                L.imageOverlay(img.src, imageBounds).addTo(map);

                // Set the map view to the center of the image
                map.setView([imageHeight / 2, imageWidth / 2], -2);

                if (itemDetails.markerId) {
                    // Use the custom icon
                    const customIcon = new SvgIcon({
                        iconUrl: `./icons/${itemDetails.iconType}`,
                        iconSize: [30, 30],
                        iconColor: itemDetails.iconColor
                    });

                    L.marker([itemDetails.lat, itemDetails.lng], { icon: customIcon }).addTo(map);
                } else if (itemDetails.lineId) {
                    const line = [[itemDetails.start_lat, itemDetails.start_lng], [itemDetails.end_lat, itemDetails.end_lng]];
                    L.polyline(line, { color: itemDetails.color }).addTo(map);
                }
            };
        } catch (error) {
            console.error(`Failed to fetch image URL: ${error}`);
        }
    }

    const searchModes = ['Titles', 'Contents', 'Dates', 'Linked Item Notes', 'Linked Item Descriptions'];
    let currentSearchModeIndex = 0;

    document.getElementById('toggle-search-content').addEventListener('click', function () {
        // Update the search mode
        currentSearchModeIndex = (currentSearchModeIndex + 1) % searchModes.length;
        this.textContent = 'Searching ' + searchModes[currentSearchModeIndex];
    });

    // Submit button click
    document.getElementById('submit-journal').addEventListener('click', async function () {
        try {
            if (!currentFolder) {
                alert("You must upload an image in GoGrow before using the journal system");
                return;
            }

            const journalId = document.getElementById('journal-id').value;
            const journalTitle = document.getElementById('journal-title').value;
            const journalEntry = quill.root.innerHTML;

            if (journalTitle.trim() === '') {
                alert("Please enter a title for your journal entry.");
                return;
            }

            if (journalTitle.length > 100) {
                alert("Your title is too long. Please shorten it.");
                return;
            }

            // Collect the linked item ids
            const linkedItemsContainer = document.getElementById('linked-items-container');
            const linkedItems = Array.from(linkedItemsContainer.children).map(li => li.dataset.id);
            const linkedItemsString = linkedItems.join(',');
            const isFavorite = document.getElementById('is-favorite').checked ? 'yes' : 'no';

            const requestOptions = {
                method: journalId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: journalId,
                    entry_title: journalTitle,
                    entry_content: journalEntry,
                    linked_item_id: linkedItemsString || '',
                    is_favorite: isFavorite,
                })
            };


            const url = journalId ? `/journals/${currentFolder}/${journalId}` : `/journals/${currentFolder}`;
            const response = await fetch(url, requestOptions);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            // Clear the journal entry and refresh the entries list
            quill.setContents([]);
            setEditMode(false);
            // Remove 'selected' class from any list items that have it
            const selectedListItem = document.querySelector('.selected');
            if (selectedListItem) {
                selectedListItem.classList.remove('selected');
            }
            loadJournalEntries(currentFolder);

        } catch (error) {
            console.error('Error submitting journal entry:', error);
        }
    });

    document.getElementById('export-csv').addEventListener('click', function () {
        window.location.href = `/export_journals/${currentFolder}`;
    });

    document.addEventListener('DOMContentLoaded', function () {
        var icons = document.querySelectorAll('.ql-toolbar button svg');
        icons.forEach(function (icon) {
            icon.style.fill = '#fff';
        });
        loadMarkersAndLines(currentFolder);
    });
    loadFolders();
});

