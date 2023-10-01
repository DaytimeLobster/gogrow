# GoGrow Technical Documentation

GoGrow is a python flask application consisting of several Python modules, javascript, HTML and .CSS files that handle various functionalities, including configuration management, database operations, file handling, and API endpoints, structure of the web pages, and styling of the elements on them. This documentation provides an overview of the key components and their functions.

Keep in mind many of these functions, endpoints, and settings may be deprecated or obsolete now or in the near future, or in need of refactoring - therefore much of what follows is subject to change at any time. 

## File Structure

The backend code follows a specific file structure:

- `gogrow_app/` directory: Contains the core application files.
- `app.py`: Initializes the Flask application and defines routes.
- `settings.py`: Imports configuration data from `config.cfg`.
- `__init__.py`: Initializes the Flask application package and serves the static folder.
- `views.py`: Contains the main views and routes for the application.

## Dependencies

Gogrow depends on Python 3.11. If installing and using as a flask application, please make sure you have installed the right version of Python. 

The following Python packages are used in the backend, and will be installed automatically using pip if you follow the installation instructions in the included readme:

- altgraph
- bleach
- blinker
- click
- colorama
- dnspython
- Flask
- importlib-metadata
- itsdangerous
- Jinja2
- MarkupSafe
- pefile
- Pillow
- pip
- pyinstaller
- pyinstaller-hooks-contrib
- pywin32-ctypes
- setuptools
- six
- waitress
- webencodings
- Werkzeug
- zipp
- imageio
- numpy
- rawpy
- certifi
- charset-normalizer
- idna
- psutil
- requests
- urllib3

## Configuration Files

The application utilizes two configuration files: `config.cfg` and `settings.py`. These files are used to manage various settings and configurations for the application. 

### `config.cfg`

The `config.cfg` file is where you can modify the settings to fit your application, like the custom theme and where the icon and thumbnail directories are located. It is recommended for securtity purposes to change the secret key.
The config.cfg file uses an INI-style format with sections and keys - below is an example `config.cfg` with a terrible theme:

```
[AppSettings]
secret_key = YOUR_SECRET_KEY

[Directories]
icon_dir = icons
thumbnail_dir = thumbs

[ImageSettings]
image_folder = default_folder

[background]
texture = denim.png

[Theme]
mode = dark

[Custom Theme]
primary-bg = #ff0099
primary-text = #ffffff
secondary-bg = #00ffcc
secondary-text = #000000
table-row-bg = #9900ff
table-row-alt-bg = #ff9900
table-row-text = #ffffff
details-head-text = #ffffff
details-body-text = #000000
details-footer-text = #ffffff
about-head-text = #000000
about-body-text = #ffffff
about-footer-text = #000000
error-head-text = #ffffff
error-body-text = #000000
error-footer-text = #ffffff
right-side-column = #000000
edit-marker-modal = #ffffff
primary-hover-text = #ffcc00
primary-hover-bg = #3300ff
tertiary-bg = #00ffff
tertiary-bg-text = #000000
tertiary-bg-alt = #ffccff
tertiary-bg-alt-text = #000000
primary-btn-bg = #00ff00
primary-btn-text = #000000
secondary-btn-bg = #ff00cc
secondary-btn-text = #ffffff
```


### `settings.py`

The `settings.py` file is responsible for loading the configuration settings from `config.cfg` and applying them to the application.

```python
import os
import secrets
import configparser
from gogrow_app import app

def load_app_settings():
    config = configparser.ConfigParser()
    config.read(os.path.join(app.root_path, 'config.cfg'))

    app.secret_key = config.get('AppSettings', 'secret_key', fallback=secrets.token_hex(16))
    app.config['ICON_DIR'] = os.path.join(app.root_path, config.get('Directories', 'icon_dir', fallback='icons'))
    app.config['THUMBNAIL_DIR'] = os.path.join(app.root_path, config.get('Directories', 'thumbnail_dir', fallback='thumbs'))
    app.config['IMAGE_FOLDER'] = config.get('ImageSettings', 'image_folder', fallback='default_folder')

print("Settings.py importing configuration data from config.cfg...")
load_app_settings()
IMAGE_FOLDER = app.config['IMAGE_FOLDER']
ICON_DIR = app.config['ICON_DIR']
THUMBNAIL_DIR = app.config['THUMBNAIL_DIR']
```

# GoGrow Front End Technical Documentation

The frontend code of the application handles various functionalities related to map display, marker management, theme, and image handling. This documentation attempts to provide an overview of the key components and their functions. Apologies ahead of time - a bit could probably be refactored and simplified. 

## Global Variables

- `map`: Holds the map instance.
- `icons`: Stores the icon data.
- `iconDirectory`: Specifies the directory path for icons.
- `markerListBody`: Represents the body element of the marker list table.
- `markerInstances`: An array to store all marker instances.
- `lineInstances`: An array to store all line instances.

## Functions

### `setTextColorBasedOnBgColor(bgColor, element)`

- Description: Sets the text color of an element based on the background color.
- Parameters:
  - `bgColor`: The background color.
  - `element`: The element to modify.

### `initializeIndexPage()`

- Description: Initializes the index page.
- Actions:
  - Retrieves the saved theme setting and applies it.
  - Calls the `changeTheme` function.

### `getSetting(section, key)`

- Description: Retrieves a setting value from the backend.
- Parameters:
  - `section`: The section of the setting.
  - `key`: The key of the setting.
- Returns: The value of the setting.

### `applySavedMapBackground()`

- Description: Applies the saved map background texture.
- Actions:
  - Retrieves the saved background texture setting and calls the `changeMapBackground` function.

### `changeMapBackground(texture)`

- Description: Changes the map background texture.
- Parameters:
  - `texture`: The texture name.
- Actions:
  - Modifies the background image and size of the map element.

### `changeTheme(theme)`

- Description: Changes the theme of the application.
- Parameters:
  - `theme`: The theme name.
- Actions:
  - Modifies the body class to apply the selected theme.

### `loadImage()`

- Description: Loads the image to display as an overlay on the map.
- Actions:
  - Sends a request to the backend to retrieve the image URL.
  - Calls the `addImageOverlay` function to add the image overlay to the map.

### `addImageOverlay(imageUrl)`

- Description: Adds an image overlay to the map.
- Parameters:
  - `imageUrl`: The URL of the image to overlay.
- Returns: A promise that resolves when the image is loaded.
- Actions:
  - Removes any existing image overlay from the map.
  - Creates a new image overlay using the provided URL and bounds.
  - Sets the map view to the center of the image.

### `clearExistingMarkers()`

- Description: Clears existing markers from the map and the marker list.
- Actions:
  - Removes all marker instances from the map.
  - Clears the marker list table.

### `loadFeatures(folderName)`

- Description: Loads markers and lines for a specific folder.
- Parameters:
  - `folderName`: The name of the folder.
- Actions:
  - Fetches markers from the backend and creates marker instances.
  - Fetches lines from the backend and creates line instances.

## Usage

1. Define global variables such as `map`, `icons`, `iconDirectory`, `markerListBody`, `markerInstances`, and `lineInstances`.
2. Call the `initializeIndexPage` function to initialize the index page.
3. Use the `loadImage` function to load the image overlay.
4. Call the `clearExistingMarkers` function to clear existing markers.
5. Call the `loadFeatures` function to load markers and lines for a specific folder

### Class: `SvgIcon`

This class extends `L.Icon` and represents an SVG icon used as a Leaflet icon.

- `constructor(options)`: Creates a new `SvgIcon` instance.
  - `options.iconUrl`: The URL of the SVG icon.
  - `options.iconColor` (optional): The color of the icon. Defaults to `#000000`.
- `createIcon(oldIcon)`: Creates the icon element.
  - `oldIcon`: The existing icon element to reuse or `null`.
  - Returns: The created icon element.

### `loadFolders()`

This function loads the list of folders from the server and displays them on the page.

### `displayFolders(folderList)`

This function displays the list of folders on the page.

- `folderList`: An array of folder names.

### `loadImageAndDatabase(folderName)`

This function loads the image and database for a specific folder.

- `folderName`: The name of the folder.
- Returns: A Promise that resolves when the image and database are loaded.

### `uuidv4()`

This function generates a random UUID (Universally Unique Identifier).

- Returns: A randomly generated UUID.

### `updateMarker(markerUUID, description, iconType, iconColor, notes)`

This function updates a marker with new information.

- `markerUUID`: The UUID of the marker to update.
- `description`: The updated description of the marker.
- `iconType`: The updated icon type of the marker.
- `iconColor`: The updated icon color of the marker.
- `notes`: The updated notes of the marker.

### `addMarker(lat, lng, info, iconType, iconColor, markerNotes, folderName)`

This function adds a new marker to the map and table.

- `lat`: The latitude coordinate of the marker.
- `lng`: The longitude coordinate of the marker.
- `info`: The information or description of the marker.
- `iconType`: The icon type of the marker.
- `icon color`: The color of the marker icon.
- `markerNotes` (optional): The notes associated with the marker.
- `folderName` (optional): The name of the folder to associate the marker with.

### `createMarker(newMarkerData)`

This function creates a new marker on the map and adds it to the marker list table.

- `newMarkerData`: An object containing the marker data, including `lat`, `lng`, `info`, `iconType`, `iconColor`, and `markerNotes`.
- Returns: The created marker instance.

### `deleteMarker(markerUUID)`

This function deletes a marker from the map and table.

- `markerUUID`: The UUID of the marker to delete.
- Returns: A Promise that resolves when the marker is successfully deleted.

### `loadFolders()`

This function loads the list of folders from the server and displays them on the page.

### `displayFolders(folderList)`

This function displays the list of folders on the page.

- `folderList`: An array of folder names.

### `loadImageAndDatabase(folderName)`

This function loads the image and database for a specific folder.

- `folderName`: The name of the folder.
- Returns: A Promise that resolves when the image and database are loaded.

### `uuidv4()`

This function generates a random UUID (Universally Unique Identifier).

- Returns: A randomly generated UUID.

### `addLine(startLatLng, endLatLng, info, color, notes, folderName)`

This function adds a new line to the map and table.

- `startLatLng`: The start coordinates of the line as a `LatLng` object.
- `endLatLng`: The end coordinates of the line as a `LatLng` object.
- `info`: Additional information about the line.
- `color`: The color of the line.
- `notes` (optional): The notes associated with the line.
- `folderName` (optional): The name of the folder to associate the line with.

### `createLine(newLineData)`

This function creates a new line on the map and adds it to the marker list table.

- `newLineData`: An object containing the line data, including `start_lat`, `start_lng`, `end_lat`, `end_lng`, `info`, `color`, and `notes`.
- Returns: The created line instance.

### `deleteLine(lineUUID)`

This function deletes a line from the map and table.

- `lineUUID`: The UUID of the line to delete.
- Returns: A Promise that resolves when the line is successfully deleted.

### `toggleMarkers()`

This function toggles the visibility of the markers on the map.

### `toggleLines()`

This function toggles the visibility of the lines on the map.

### Event Listener: `document.querySelector('#marker-list-body').addEventListener('click', async function (event)`

This event listener handles the click event on the marker list table. It identifies if the click was made on a delete icon for a marker or line, retrieves the UUID and description of the corresponding item, and prompts the user to confirm the deletion. If confirmed, it calls the `deleteMarker()` or `deleteLine()` function accordingly.

### Variable: `addMode`

This variable stores the current add mode, which can be either 'marker' or 'line'. It is initially set to 'marker' and can be toggled by clicking the toggle add mode button. The add mode determines whether clicking on the map creates a marker or a line.

### Event Listener: `window.addEventListener('load', async function ()`

This event listener executes when the page finishes loading. It initializes the map, loads the icons, and sets up event listeners for form submission, map clicks, input changes, and sidebar toggling.

### Event Listener: `document.getElementById('toggle-add-mode').addEventListener('click', function ()`

This event listener handles the click event on the toggle add mode button. It toggles the add mode between 'marker' and 'line', and updates the button text accordingly.

### Event Listener: `sidebarToggler.addEventListener('click', toggleSidebar)`, `navSidebarToggler.addEventListener('click', toggleSidebar)`, `hideSidebarBtn.addEventListener('click', toggleSidebar)`

These event listeners handle the click events on the sidebar toggler buttons. They toggle the visibility of the sidebar and adjust the map view accordingly.

### Event Listener: `document.querySelector('#marker-list-body').addEventListener('click', function (event)`

This event listener handles the click event on the note cell of the marker list table. When clicked, it creates a modal to display the note associated with the marker or line. The modal is appended to the body and can be closed by clicking the close button.

### Event Listener: `window.addEventListener('beforeunload', function ()`

This event listener handles the beforeunload event and closes any open popups on the map.

### Event Listener: `document.querySelector('#marker-list-body').addEventListener('click', function (event)`

This event listener handles the click event on the ID cell of the marker list table. When clicked, it highlights the clicked ID cell by adding the 'highlight' class and removes the highlight from other ID cells.


# GoGrow Back End Technical Documentation

## Lines
```
lines(selected_dir=None): Handles GET and POST requests related to lines.
GET: Retrieves lines from the database.
POST: Adds a new line to the database.
update_line(): Updates an existing line in the database.
get_lines(image_folder=None): Retrieves lines from the database.
delete_line(): Deletes a line from the database.
```

## Markers
```
get_markers(image_folder=None): Retrieves markers from the database.
markers(selected_dir=None): Handles GET and POST requests related to markers.
GET: Retrieves markers from the database.
POST: Adds a new marker to the database.
update_marker(): Updates an existing marker in the database.
delete_marker(): Deletes a marker from the database.
```

## Image Handling
```
process_image_upload(image, image_directory): Handles the image upload process.
allowed_file(filename): Checks if the file extension is allowed.
create_directories_if_needed(image_directory, filename): Creates directories if they don't exist.
save_image_and_thumbnail(image, file_directory, filename): Saves the uploaded image and its thumbnail.
update_session_variables(filename, file_directory): Updates session variables for the uploaded image.
create_thumbnail(input_path, output_path, size): Creates a thumbnail image.
```

## Other Routes
```
index(): Handles the main index page and image upload.
serve_image(filename): Serves images from the subdirectories.
get_icon_directory(): Retrieves the directory path for icons.
icon_filenames(): Retrieves a list of icon filenames.
serve_icon(icon_name): Serves icons.
get_image_url(selected_dir): Retrieves the URL of the latest image in the selected directory.
image_folders(): Retrieves a list of image folders.
export(folder): Exports markers and lines data as a CSV file.
details(): Renders the details page.
settings(): Renders the settings page.
about(): Renders the about page.
```

## API Endpoints
The backend provides the following API endpoints:
```
Lines API Endpoints
GET /lines/<selected_dir>

Description: Retrieves lines from the database for the specified directory.

Parameters:

selected_dir: The selected directory name (optional).
Returns: A JSON array of line objects.

POST /lines/<selected_dir>

Description: Adds a new line to the database for the specified directory.
Parameters:
- `selected_dir`: The selected directory name (optional).
- Request Body: JSON object containing line data.

Returns: A JSON object with the line_id of the newly added line.

POST /update_line

Description: Updates an existing line in the database.

Request Body: JSON object containing line data, including id, info, color, and notes.

Returns: Status code indicating the success of the operation.

POST /delete_line

Description: Deletes a line from the database.

Request Body: JSON object containing the id of the line to be deleted.

Returns: Status code indicating the success of the operation.
```

## Markers API Endpoints
```
GET /markers/<selected_dir>

Description: Retrieves markers from the database for the specified directory.

Parameters:
- `selected_dir`: The selected directory name (optional).

Returns: A JSON array of marker objects.

POST /markers/<selected_dir>

Description: Adds a new marker to the database for the specified directory.

Parameters:
- `selected_dir`: The selected directory name (optional).
- Request Body: JSON object containing marker data.

Returns: A JSON object with the marker_id of the newly added marker.

POST /update_marker

Description: Updates an existing marker in the database.

Request Body: JSON object containing marker data, including id, info, iconType, iconColor, and markerNotes.

Returns: Status code indicating the success of the operation.

POST /delete_marker

Description: Deletes a marker from the database.

Request Body: JSON object containing the id of the marker to be deleted.

Returns: Status code indicating the success of the operation.
```

## Other API Endpoints
```
GET /get_icon_directory

Description: Retrieves the directory path for icons.

Returns: The directory path as a string.

GET /icon_filenames

Description: Retrieves a list of icon filenames.

Returns: A JSON array of icon filenames.

GET /get_image_url/<selected_dir>

Description: Retrieves the URL of the latest image in the selected directory.

Parameters:
- `selected_dir`: The selected directory name.

Returns: The URL of the latest image as a string.

GET /get_folders

Description: Retrieves a list of image folders.

Returns: A JSON array of folder names.

GET /export/<folder>

Description: Exports markers and lines data as a CSV file for the specified folder.

Parameters:
- `folder`: The folder name.

Returns: The exported CSV file.
```
## Additional Routes
The backend also provides the following routes:
```
GET /: The main index page that allows image upload and displays the uploaded image, markers, and icons. Handles both GET and POST requests.
GET /serve_image/<path:filename>: Serves images from the subdirectories.
GET /serve_icon/<path:icon_name>: Serves icons.
GET /backups: Retrieves a list of backup files stored in the "backups" directory. Returns a JSON array of backup filenames.
```
## Backup and Restore Routes
The backend provides routes for creating backups and restoring from backups:
```
POST /backup

Description: Creates a backup of the selected directory and its associated database file. The backup is stored in the "backups" directory as a compressed tarball file (.tar.gz).

Request Body: Form data containing the directory parameter specifying the selected directory.

Returns: A JSON object with the status ("success" or "error") and filename of the created backup, or an error message if the backup creation fails.

POST /restore

Description: Restores a previously created backup by extracting the tarball file. It checks for any conflicts with existing directories before proceeding with the restoration.

Request Body: Form data containing the backup_file parameter specifying the backup file to restore.

Returns: A JSON object with the status ("success" or "error"), indicating the success of the restoration process, or an error message if the restoration fails.
```