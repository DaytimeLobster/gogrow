// Function to initialize the settings page
function initializeSettingsPage() {
    // Immediately invoked async function
    (async function () {
        // Retrieve the saved background texture setting
        const texture = await getSetting('background', 'texture');
        document.getElementById('map-background-select').value = texture;

        // Apply the saved theme
        const theme = await getSetting('Theme', 'mode');
        console.log(`Applying theme: ${theme}`);
        changeTheme(theme);
    })();
}

// store the custom theme style element
let customTheme = null;

// fetch the custom theme CSS variables and apply them to the document
async function fetchCustomTheme() {
    try {
        // If the custom theme has already been fetched, return early
        if (customTheme !== null) return;

        // Fetch the custom theme CSS variables
        const response = await fetch('/custom_theme');
        if (!response.ok) throw new Error(response.statusText);

        const cssVariables = await response.text();

        // Create a style element to inject the CSS variables into the document
        const style = document.createElement('style');
        style.textContent = `:root { ${cssVariables} }`;

        // Append the style element to the document head
        document.head.appendChild(style);

        // Store the style element for later use
        customTheme = style;
    } catch (error) {
        console.error('Error fetching custom theme:', error);
    }
}

// Function to change the theme of the page
function changeTheme(theme) {
    console.log(`Changing theme to: ${theme}`);
    const themes = ['light', 'dark', 'beach', 'forest', 'sunset', 'amethyst', 'custom'];

    // Remove the existing theme classes from the body
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

// Initialize the settings page
initializeSettingsPage();

// Change the theme without any arguments (will use the default theme)
changeTheme();

// Function to display a flash message on the page
function flashMessage(message, type = 'info', duration = 5000) {
    const flashMessageContainer = document.getElementById('flash-message-container');

    // Create a new message div
    const messageDiv = document.createElement('div');
    messageDiv.className = `flash-message flash-message-${type}`;
    messageDiv.textContent = message;

    // Append the message div to the container
    flashMessageContainer.appendChild(messageDiv);

    // Remove the message div after the specified duration
    setTimeout(() => {
        messageDiv.remove();
    }, duration);
}

// Function to retrieve a specific setting value
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

// Function to update a specific setting value
async function updateSetting(section, key, value) {
    const response = await fetch('/settings/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            section: section,
            key: key,
            value: value
        })
    });

    // Display a flash message indicating the success or failure of the setting update
    flashMessage(`Setting "${section}.${key}" updated to "${value}".`, 'success');

    if (!response.ok) {
        console.error("Error updating setting:", response.statusText);
    }
}

// Function to fetch the available textures from the server
async function fetchTextures() {
    try {
        const response = await fetch('/textures');
        if (response.ok) {
            const textureFiles = await response.json();
            populateTextureDropdown(textureFiles);
        } else {
            console.error('Error fetching textures:', response.status);
        }
    } catch (err) {
        console.error('Error fetching textures:', err);
    }
}

// Function to populate the map background texture dropdown
function populateTextureDropdown(textureFiles) {
    const select = document.getElementById('map-background-select');

    if (select) {
        // Clear the dropdown
        select.innerHTML = "";

        // Create and append an option for each texture file
        textureFiles.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            select.appendChild(option);
        });
    }
}

// Fetch the available textures on page load
fetchTextures();

// Function to initialize event listeners for settings
function initializeSettingsListeners() {
    const updateBackgroundBtn = document.getElementById('update-background-btn');
    const updateThemeBtn = document.getElementById('update-theme-btn');

    if (updateBackgroundBtn) {
        // Event listener for updating the background texture
        updateBackgroundBtn.addEventListener('click', async function () {
            const selectedTexture = document.getElementById('map-background-select').value;

            if (!selectedTexture) {
                flashMessage('Please select a texture from the dropdown.', 'warning');
                return;
            }

            console.log('Updating setting:', 'background', 'texture', selectedTexture);
            await updateSetting('background', 'texture', selectedTexture);
            flashMessage(`Map background changed to "${selectedTexture}".`, 'success');
        });
    }

    if (updateThemeBtn) {
        // Event listener for updating the theme
        updateThemeBtn.addEventListener('click', async function () {
            const selectedTheme = document.getElementById('theme-select').value;
            await updateSetting('Theme', 'mode', selectedTheme);
            flashMessage(`Theme changed to "${selectedTheme}".`, 'success');
            changeTheme(selectedTheme);
        });
    }
}

// Initialize the event listeners for settings if the required elements exist
if (document.getElementById('update-background-btn') && document.getElementById('update-theme-btn')) {
    initializeSettingsListeners();
}

// Function to fetch the available directories from the server
async function fetchDirectories() {
    try {
        const response = await fetch('/get_folders');
        if (response.ok) {
            const directories = await response.json();
            populateDirectoryDropdown(directories);
        } else {
            console.error('Error fetching directories:', response.status);
        }
    } catch (err) {
        console.error('Error fetching directories:', err);
    }
}

// Function to populate the backup directory dropdown
function populateDirectoryDropdown(directories) {
    const select = document.getElementById('directory-select');

    if (select) {
        // Clear the dropdown
        select.innerHTML = "";

        // Create and append an option for each directory
        directories.forEach(directory => {
            const option = document.createElement('option');
            option.value = directory;
            option.textContent = directory;
            select.appendChild(option);
        });
    }
}

// Fetch the available directories on page load
fetchDirectories();

// Event listener for the backup button
const backupBtn = document.getElementById('backup-btn');
if (backupBtn) {
    backupBtn.addEventListener('click', async function () {
        const selectedDirectory = document.getElementById('directory-select').value;

        if (!selectedDirectory) {
            flashMessage('Please select a directory from the dropdown.', 'warning');
            return;
        }

        const response = await fetch('/backup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                directory: selectedDirectory
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Backup successful! Saved as', data.filename);
            flashMessage(`Backup successful! Saved as "${data.filename}"`, 'success');
            fetchBackups();
        } else {
            console.error('Error creating backup:', data.message);
            flashMessage('Error creating backup.', 'error');
        }
    });
}

// Function to fetch the available backups from the server
async function fetchBackups() {
    try {
        const response = await fetch('/backups');
        if (response.ok) {
            const backupFiles = await response.json();
            populateBackupDropdown(backupFiles);
        } else {
            console.error('Error fetching backups:', response.status);
        }
    } catch (err) {
        console.error('Error fetching backups:', err);
    }
}

// Function to populate the backup dropdown
function populateBackupDropdown(backupFiles) {
    const select = document.getElementById('backup-select');

    if (select) {
        // Clear the dropdown
        select.innerHTML = "";

        // Create and append an option for each backup file
        backupFiles.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            select.appendChild(option);
        });
    }
}

// Event listener for the restore button
const restoreBtn = document.getElementById('restore-btn');
if (restoreBtn) {
    restoreBtn.addEventListener('click', async function () {
        const selectedBackup = document.getElementById('backup-select').value;

        if (!selectedBackup) {
            flashMessage('Please select a backup from the dropdown.', 'warning');
            return;
        }

        const confirmed = confirm('This will NOT overwrite existing directories with the same name - you must delete them first. Do you want to proceed with restoring a backup?');
        if (!confirmed) {
            return;
        }

        const response = await fetch('/restore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                backup_file: selectedBackup
            })
        });

        const data = await response.json();

        if (response.ok) {
            flashMessage(`Backup "${selectedBackup}" restored successfully!`, 'success');
        } else if (response.status === 409) {
            console.error('Error restoring backup:', data.message);
            flashMessage(data.message, 'error');
        } else {
            flashMessage('Error restoring backup.', 'error');
            console.error('Error restoring backup:', data.message);
        }
    });
}

// Fetch the available directories and backups on page load
fetchDirectories();
fetchBackups();