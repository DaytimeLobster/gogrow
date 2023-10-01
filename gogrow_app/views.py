from datetime import datetime
from gogrow_app import app
import os
import glob
import sqlite3
from sqlite3 import Error
import json
from flask import Flask, redirect, jsonify, request, url_for, render_template, send_from_directory, session, flash, send_file, Response, get_flashed_messages
from werkzeug.utils import secure_filename
from PIL import Image
import traceback
from logging.handlers import RotatingFileHandler
from gogrow_app.settings import app, IMAGE_FOLDER, ICON_DIR, THUMBNAIL_DIR  #settings.py imports config data that is pulled from config.cfg in the app's root dir
import uuid
import shutil
import configparser
from configparser import NoSectionError, NoOptionError
import csv
from io import StringIO
import tarfile
import bleach
import pathlib
from pathlib import Path
import re
import rawpy
import imageio

app_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(app_dir, 'config.cfg')

config = configparser.ConfigParser()
config.read(config_path)

@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Perform any necessary checks here (database connection, subsystem status, etc.) - will expand on this later
        # If everything is okay, return a successful response
        return jsonify({"status": "healthy"}), 200
    except Exception as e:
        # Print the error and return an error response
        print(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route('/details')
def details():
    """Renders the details page."""
    return render_template(
        'details.html',
        title='Details',
        year=datetime.now().year,
        message='Details view for marker data.'
    )

@app.route('/settings')
def settings():
    """Renders the settings page."""
    return render_template(
        'settings.html',
        title='Settings',
        year=datetime.now().year,
        message='Useful configuration settings'
    )

@app.route('/about')
def about():
    """Renders the about page."""
    return render_template(
        'about.html',
        title='About',
        year=datetime.now().year,
        message='About the app and how to use it!'
    )

@app.route('/journal')
def journal():
    """Renders the journal page."""
    return render_template(
        'journal.html',
        title='Journal',
        year=datetime.now().year,
        message='Your shared GoGrow journal'
    )

def sanitize_input(input_str):
    return bleach.clean(input_str)

def validate_latitude(lat):
    if not -90 <= lat <= 90:
        raise ValueError("Invalid latitude value")

def validate_longitude(lng):
    if not -180 <= lng <= 180:
        raise ValueError("Invalid longitude value")

def is_safe_path(basedir, path, follow_symlinks=True):
    # Create the full path
    full_path = os.path.join(basedir, path)

    # Resolve symbolic links
    if follow_symlinks:
        full_path = os.path.realpath(full_path)

    # Normalize paths for proper comparison
    basedir = str(pathlib.Path(basedir).resolve())
    full_path = str(pathlib.Path(full_path).resolve())

    # Check if the full path is within the basedir
    return full_path.startswith(basedir)

class InvalidDirectoryError(Exception):
    """Exception raised for invalid directory."""
    pass

@app.errorhandler(InvalidDirectoryError)
def handle_invalid_directory(error):
    return jsonify(error=str(error)), 400

def read_config():
    config = configparser.ConfigParser()
    config.read(config_path)
    return config

def write_config(config):
    with open(config_path, 'w') as configfile:
        config.write(configfile)

def update_setting(section, key, value):
    if not config.has_section(section):
        config.add_section(section)
    config.set(section, key, value);
    with open(config_path, 'w') as config_file:
        config.write(config_file)

def get_setting(section, key):
    try:
        return config.get(section, key)
    except (NoSectionError, NoOptionError):
        return None

@app.route('/settings/update', methods=['POST'])
def update_settings():
    section = request.form.get('section')
    key = request.form.get('key')
    value = request.form.get('value')
    print('Updating setting:', section, key, value)
    update_setting(section, key, value)
    return jsonify(success=True)

@app.route('/settings/get', methods=['GET'])
def get_settings():
    section = request.args.get('section')
    key = request.args.get('key')
    value = get_setting(section, key)
    return jsonify(value=value)

@app.route('/custom_theme', methods=['GET'])
def custom_theme():
    theme = get_custom_theme()
    if theme is not None:
        return theme
    else:
        return "/* No custom theme defined */", 404

def is_valid_color(value):
    # Matches hex color codes and some named colors
    color_regex = re.compile('^#(?:[0-9a-fA-F]{3}){1,2}$|^[a-zA-Z]+$|^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$|^rgba\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(0(\.\d+)?|1(\.0+)?)\)$')
    return color_regex.match(value) is not None

def get_custom_theme():
    try:
        # Get the 'Custom Theme' section from the config
        custom_theme = config['Custom Theme']

        # Prepare a string of CSS variables
        css_variables = []
        for key, value in custom_theme.items():
            if not is_valid_color(value):
                print(f"Invalid value for {key}: {value}")
                continue
            css_variables.append(f"--{key}: {value};")

        return "\n".join(css_variables)
    except KeyError:
        return None

@app.route('/textures')
def get_textures():
    textures_path = os.path.join(app.static_folder, 'textures')
    texture_files = [f for f in os.listdir(textures_path) if os.path.isfile(os.path.join(textures_path, f))]
    return jsonify(texture_files)

def get_image_folder_path():
    folder_name = session.get('image_folder')
    if folder_name is None:
        print("Getting image folder path from settings.py")
        folder_name = IMAGE_FOLDER
    return folder_name

@app.route('/set_image_folder', methods=['GET'])
def set_image_folder():
    image_folder = request.args.get('image_folder', None)
    if image_folder:
        session['image_folder'] = image_folder
    return "OK", 200

def get_icon_files():
    icon_files = os.listdir(ICON_DIR)
    
    # sort the list in alphabetical order
    icon_files = sorted(icon_files)

    return icon_files

def create_thumbnail(image_path, thumbnail_path, thumbnail_size):
    try:
        img = Image.open(image_path)
        img.thumbnail(thumbnail_size)
        # Save the thumbnail in the new directory
        img.save(os.path.join(THUMBNAIL_DIR, thumbnail_path), "JPEG")
    except Exception as e:
        app.logger.error(f'Error creating thumbnail: {e}')

def update_image_folder_path(new_image_folder):
    config = configparser.ConfigParser()
    config.read(os.path.join(app.root_path, 'config.cfg'))
    config.set('ImageSettings', 'image_folder', new_image_folder)
    with open(os.path.join(app.root_path, 'config.cfg'), 'w') as configfile:
        config.write(configfile)

def init_markers_db(db_path):
    conn = None
    try:
        # Check if the database already exists
        if not os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            c = conn.cursor()

            c.execute('''CREATE TABLE IF NOT EXISTS markers
                         (id TEXT PRIMARY KEY, lat REAL, lng REAL, info TEXT, iconType TEXT, iconColor TEXT, markerNotes TEXT)''')
            conn.commit()
            print(f"init_markers_db() will attempt to create a 'markers' table in the database, if the table does not exist : {db_path}")
    except Exception as e:
        print(f"Error initializing markers database: {e}")
    finally:
        if conn:
            conn.close()

def init_lines_db(db_path):
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        c.execute('''
            CREATE TABLE IF NOT EXISTS lines
            (id TEXT PRIMARY KEY, start_lat REAL, start_lng REAL, end_lat REAL, end_lng REAL, info TEXT, color TEXT, notes TEXT)
        ''')

        conn.commit()
        print(f"init_lines_db() will attempt to create a 'lines' table in the database, if the table does not exist : {db_path}")

    except Exception as e:
        print(f"Error initializing lines database: {e}")
    finally:
        if conn:
            conn.close()

@app.route('/lines/<selected_dir>', methods=['GET', 'POST'])
def lines(selected_dir=None):
    if selected_dir is not None:
        if not is_safe_path(app.root_path, selected_dir):
            raise InvalidDirectoryError("Invalid directory")
    
    conn = None
    try:
        if request.method == 'GET':
            # Update the session's image_folder with the new selected folder
            session['image_folder'] = selected_dir

            # Pass the folder name to get_lines function
            return get_lines(image_folder=selected_dir)
        elif request.method == 'POST':
            image_folder = session.get('image_folder', get_image_folder_path())
            db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

            init_lines_db(db_path)

            data = request.get_json()
            start_lat = data['start_lat']
            start_lng = data['start_lng']
            end_lat = data['end_lat']
            end_lng = data['end_lng']
            info = data['info']
            color = data['color']
            notes = data['notes']

            line_id = str(uuid.uuid4())

            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('''
                INSERT INTO lines (id, start_lat, start_lng, end_lat, end_lng, info, color, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (line_id, start_lat, start_lng, end_lat, end_lng, info, color, notes))
            conn.commit()

            return jsonify({'line_id': line_id}), 200
    except Exception as e:
            print(f"Error adding line: {e}")
            return "", 500
    finally:
        if conn:
            conn.close()

@app.route('/update_line', methods=['POST'])
def update_line():
    conn = None
    try:
        data = request.get_json()
        line_id = data['id']
        info = data['info']
        color = data['color']
        notes = data['notes']
        image_folder = session.get('image_folder', get_image_folder_path())
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('UPDATE lines SET info=?, color=?, notes=? WHERE id=?', (info, color, notes, line_id))
        conn.commit()
        print(f"Line(s) Updated")
        return 'OK', 200
    except Exception as e:
        print(f"Error updating line: {e}")
        return "", 500
    finally:
        if conn:
            conn.close()

def get_lines(image_folder=None):
    conn = None
    try:
        if image_folder is None:
            image_folder = get_image_folder_path()

        image_folder = session.get('image_folder', image_folder)
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        # Initialize the lines database
        init_lines_db(db_path)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('SELECT * FROM lines')
        lines = c.fetchall()

        # Convert the tuples to JSON objects
        line_list = [
            {
                'lineId': line[0],
                'start_lat': line[1],
                'start_lng': line[2],
                'end_lat': line[3],
                'end_lng': line[4],
                'info': line[5],
                'color': line[6],
                'notes': line[7]
            } for line in lines
        ]
        return jsonify(line_list)  # Return the JSON object

    except sqlite3.OperationalError as e:
        app.logger.error(f"Error getting lines from database: {e}")
        app.logger.error(traceback.format_exc())
        return jsonify([])  # Return an empty list as a JSON object
    finally:
        if conn:
            conn.close()

@app.route('/delete_line', methods=['POST'])
def delete_line():
    conn = None
    try:
        data = request.get_json()
        line_id = data['id']
        image_folder = session.get('image_folder', get_image_folder_path())
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')
        print(f"Deleting line from DB: {db_path}")

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('DELETE FROM lines WHERE id=?', (line_id,))
        conn.commit()

        print(f"Line {line_id} deleted")
        return 'OK', 200

    except Exception as e:
        print(f"Error deleting line: {e}")
        return "", 500
    finally:
        if conn:
            conn.close()

@app.route('/get_icon_directory', methods=['GET'])
def get_icon_directory():
    return ICON_DIR

@app.route('/icon_filenames')
def icon_filenames():
    icon_files = get_icon_files()
    return jsonify(icon_files)

@app.route('/get_image_url/<selected_dir>')
def get_image_url(selected_dir=None):
    try:
        image_directory = os.path.join(os.path.dirname(__file__), "img")
        print(f"Image directory: {image_directory}")
        image_dirs = os.listdir(image_directory)
        print(f"Image subdirectories: {image_dirs}")

        if selected_dir in image_dirs:
            # Get the most recent image in the directory based on its creation time
            image_files = glob.glob(os.path.join(image_directory, selected_dir, "*"))
            print(f"Files in image directory: {image_files}")

            # Filter out any database file, thumbnail and subdirectories in the directory
            image_files = [file for file in image_files if os.path.isfile(file) and not file.endswith(".db") and 'thumbnail-' not in file]

            latest_image = max(image_files, key=os.path.getctime)
            print(f"Latest image: {os.path.relpath(latest_image, os.path.dirname(__file__))}")
            return os.path.relpath(latest_image, os.path.dirname(__file__)), 200
        else:
            return "", 404

    except Exception as e:
        print(f"Error getting image URL: {e}")
        return "", 500


def get_markers(image_folder=None):
    conn = None
    try:
        if image_folder is None:
            image_folder = get_image_folder_path()

        image_folder = session.get('image_folder', image_folder)
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        # Initialize the markers database
        init_markers_db(db_path)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('SELECT * FROM markers')
        markers = c.fetchall()

        # Convert the tuples to JSON objects
        marker_list = [
            {
                'markerId': marker[0],
                'lat': marker[1],
                'lng': marker[2],
                'info': marker[3],
                'iconType': marker[4],
                'iconColor': marker[5],
                'markerNotes': marker[6]
            } for marker in markers
        ]
        return jsonify(marker_list)  # Return the JSON object

    except sqlite3.OperationalError as e:
        app.logger.error(f"Error getting markers from database: {e}")
        app.logger.error(traceback.format_exc())
        return jsonify([])  # Return an empty list as a JSON object
    finally:
        if conn:
            conn.close()

@app.route('/markers/<selected_dir>', methods=['GET', 'POST'])  
def markers(selected_dir=None):
    image_base_path = os.path.join(app.root_path, 'img')
    
    if selected_dir is not None:
        print(f"selected_dir: {selected_dir}")
        print(f"resolved selected_dir: {os.path.realpath(os.path.join(image_base_path, selected_dir))}")
        if not is_safe_path(image_base_path, selected_dir):
            raise InvalidDirectoryError("Invalid directory")    
        conn = None
    try:
        if request.method == 'GET':
            # Update the session's image_folder with the new selected folder
            session['image_folder'] = selected_dir

            # Pass the folder name to get_markers function
            return get_markers(image_folder=selected_dir)
        elif request.method == 'POST':
            # Call init_markers_db before adding a new marker
            image_folder = session.get('image_folder', get_image_folder_path())
            db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')
            print(f"initializing database {image_folder}")
            init_markers_db(db_path)

            data = request.get_json()
            lat = data['lat']
            lng = data['lng']
            info = data['info']
            iconType = data['iconType']
            iconColor = data['iconColor']
            markerNotes = data['markerNotes']
            
            # Generate a UUID for the new marker
            marker_id = str(uuid.uuid4())

            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('INSERT INTO markers (id, lat, lng, info, iconType, iconColor, markerNotes) VALUES (?, ?, ?, ?, ?, ?, ?)', (marker_id, lat, lng, info, iconType, iconColor, markerNotes))

            conn.commit()
            return jsonify({'marker_id': marker_id}), 200

    except Exception as e:
            print(f"Error adding marker: {e}")
            return "", 500
    finally:
        if conn:
            conn.close()


@app.route('/update_marker', methods=['POST'])
def update_marker():
    conn = None
    try:
        data = request.get_json()
        
        # validate input
        required_fields = {'id', 'info', 'iconType', 'iconColor', 'markerNotes'}
        if not all(field in data for field in required_fields):
            return "Invalid input data", 400

        marker_id = data['id']
        info = data['info']
        icon_type = data['iconType']
        icon_color = data['iconColor']
        marker_notes = data['markerNotes']
        image_folder = session.get('image_folder', get_image_folder_path())
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('UPDATE markers SET info=?, iconType=?, iconColor=?, markerNotes=? WHERE id=?', (info, icon_type, icon_color, marker_notes, marker_id))
        conn.commit()

        print(f"Marker(s) Updated")
        return 'OK', 200

    except Exception as e:
        print(f"Error updating marker: {e}")
        return "An internal server error occurred", 500
    finally:
        if conn:
            conn.close()

@app.route('/delete_marker', methods=['POST'])
def delete_marker():
    conn = None
    try:
        data = request.get_json()
        marker_id = data['id']
        image_folder = session.get('image_folder', get_image_folder_path())
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')
        print(f"Deleting marker from DB: {db_path}")

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('DELETE FROM markers WHERE id=?', (marker_id,))
        conn.commit()

        print(f"Marker {marker_id} deleted")
        return 'OK', 200

    except Exception as e:
        print(f"Error deleting marker: {e}")
        return "", 500
    finally:
        if conn:
            conn.close()

@app.route('/markers/<selected_dir>/<marker_id>', methods=['GET'])
def get_marker(selected_dir=None, marker_id=None):
    if selected_dir is not None and marker_id is not None:
        if not is_safe_path(app.root_path, selected_dir):
            raise InvalidDirectoryError("Invalid directory")
        
        conn = None
        try:
            session['image_folder'] = selected_dir
            db_path = os.path.join(app.root_path, 'img', selected_dir, f'{selected_dir}.db')

            init_markers_db(db_path)

            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('SELECT * FROM markers WHERE id = ?', (marker_id, ))
            marker = c.fetchone()

            if marker is not None:
                marker_dict = {
                    'markerId': marker[0],
                    'lat': marker[1],
                    'lng': marker[2],
                    'info': marker[3],
                    'iconType': marker[4],
                    'iconColor': marker[5],
                    'markerNotes': marker[6]
                }
                return jsonify(marker_dict)

            return jsonify({}), 404  # return not found if no marker with that id exists
        except Exception as e:
            app.logger.error(f"Error getting marker: {e}")
            app.logger.error(traceback.format_exc())
            return "", 500
        finally:
            if conn:
                conn.close()

@app.route('/lines/<selected_dir>/<line_id>', methods=['GET'])
def get_line(selected_dir=None, line_id=None):
    if selected_dir is not None and line_id is not None:
        if not is_safe_path(app.root_path, selected_dir):
            raise InvalidDirectoryError("Invalid directory")
    
        conn = None
        try:
            session['image_folder'] = selected_dir
            db_path = os.path.join(app.root_path, 'img', selected_dir, f'{selected_dir}.db')

            init_lines_db(db_path)

            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('SELECT * FROM lines WHERE id = ?', (line_id, ))
            line = c.fetchone()

            if line is not None:
                line_dict = {
                    'lineId': line[0],
                    'start_lat': line[1],
                    'start_lng': line[2],
                    'end_lat': line[3],
                    'end_lng': line[4],
                    'info': line[5],
                    'color': line[6],
                    'notes': line[7]
                }
                return jsonify(line_dict)

            return jsonify({}), 404  # return not found if no line with that id exists
        except Exception as e:
            app.logger.error(f"Error getting line: {e}")
            app.logger.error(traceback.format_exc())
            return "", 500
        finally:
            if conn:
                conn.close()

@app.route('/', methods=['GET', 'POST'])
def index():
    # Create the image directory if it doesn't exist
    image_directory = os.path.join(app.root_path, 'img')
    if not os.path.exists(image_directory):
        os.makedirs(image_directory)
        print("Base image directory not detected - creating /img directory")

    # Create the backups directory if it doesn't exist
    backup_directory = os.path.join(app.root_path, 'backups')
    if not os.path.exists(backup_directory):
        os.makedirs(backup_directory)
        print("Backups directory not detected - creating /backups directory")

    # Initialize image_url with the result of the get_image_url() function
    selected_dir = session.get('image_folder', '')
    image_url = get_image_url(selected_dir)[0] if selected_dir else None
    print(f"Index() initializing: getting image url : {image_url}")

    icon_files = get_icon_files()

    if request.method == 'POST':
        if request.files:
            image = request.files.get("image")
            if image:
                filename = secure_filename(image.filename)
                if not allowed_file(filename):
                    flash('Invalid file type. Please upload a PNG or JPG file.', 'danger')
                    return
                
                if not is_safe_path(image_directory, filename):
                    flash('Invalid file path.', 'danger')
                    return 

                process_image_upload(image, image_directory)

    # For both GET and POST requests
    image_url = session.get('uploaded_image_url', None)
    markers = get_markers(image_folder=selected_dir) if selected_dir else []

    try:
        return render_template('index.html', image_url=image_url, icon_files=icon_files, markers=markers)
    except Exception as e:
        # Log the error and show a flash message
        app.logger.error(f'Error rendering template: {e}')
        print("Index() function error")
        flash('An error occurred while rendering the template. Please try again.', 'danger')
        return render_template('index.html', image_url=image_url, icon_files=icon_files, markers=markers)

def process_image_upload(image, image_directory):
    try:
        filename = secure_filename(image.filename)

        if not is_safe_path(image_directory, filename):
            flash('Invalid file path.', 'danger')
            return  # Stop the function

        file_directory = create_directories_if_needed(image_directory, filename)

        # Check if the uploaded file is a .dng or .raw file
        if filename.lower().endswith(('.dng', '.raw')):
            # Convert the .dng or .raw file to a .jpg file
            converted_filename = os.path.splitext(filename)[0] + '.jpg'
            save_dng_raw_image_as_jpeg(image, file_directory, converted_filename)
        else:
            save_image_and_thumbnail(image, file_directory, filename)

        update_session_variables(filename, file_directory)
        init_markers_db(os.path.join(file_directory, f'{os.path.splitext(filename)[0]}.db'))
    except Exception as e:
        # Log the error and show a flash message
        app.logger.error(f'Error saving image: {e}')
        flash('An error occurred while saving the image. Please try again.', 'danger')

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'dng', 'raw'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_directories_if_needed(image_directory, filename):
    # Secure the filename before using it
    filename = secure_filename(filename)
    file_directory = os.path.join(image_directory, os.path.splitext(filename)[0])
    if not os.path.exists(file_directory):
        os.makedirs(file_directory)
        print("New file directory created")
    return file_directory

def save_image_and_thumbnail(image, file_directory, filename):
    image.save(os.path.join(file_directory, filename))
    thumbnail_filename = f"thumbnail-{os.path.splitext(filename)[0]}.png"
    create_thumbnail(os.path.join(file_directory, filename), os.path.join(file_directory, thumbnail_filename), (200, 200))
    print("New thumbnail image saved")

def update_session_variables(filename, file_directory):
    image_url = f'/img/{os.path.splitext(filename)[0]}/{filename}'
    session['uploaded_image_url'] = image_url
    session['uploaded_image_folder'] = os.path.splitext(filename)[0]
    session['uploaded_image_filename'] = os.path.splitext(filename)[0]
    print("Setting image URL, image_folder, and image_filename to this session")
    session['image_folder'] = session.get('uploaded_image_folder')

def create_thumbnail(input_path, output_path, size):
    image = Image.open(input_path)
    image.thumbnail(size)
    image.save(output_path, "PNG")

@app.route('/img/<path:filename>')
def serve_image(filename):
    try:
        # Check if the requested file is a db file
        if os.path.splitext(filename)[1] == '.db':
            return render_template('error.html', error='File not found'), 404

        # Serve images from subdirectories
        img_folder, subpath = os.path.split(filename)
        response = send_from_directory(os.path.join(app.root_path, 'img', img_folder), subpath)

        # Add a cache busting parameter
        response.cache_control.no_cache = True
        response.cache_control.no_store = True
        response.cache_control.must_revalidate = True
        response.cache_control.public = True
        return response
        
    except FileNotFoundError:
        return render_template('error.html', error='File not found'), 404
    except Exception as e:
        # Log the error and show a flash message
        app.logger.error(f'Error serving image: {e}')
        print(f"An error occured while serving image")
        flash('An error occurred while serving the image. Please try again.', 'danger')
        return redirect(url_for('index'))

@app.route('/get_folders')
def image_folders():
    try:
        image_directory = os.path.join(app.root_path, 'img')
        folder_list = [f for f in os.listdir(image_directory) if os.path.isdir(os.path.join(image_directory, f))]
        return json.dumps(folder_list)
    except Exception as e:
        return render_template('error.html', error=str(e)), 500

@app.route('/icons/<path:icon_name>')
def serve_icon(icon_name):
    try:
        icon_path = os.path.join(ICON_DIR, icon_name)
        print(f"Serving icon: {icon_name} at {icon_path} ")
        return send_file(icon_path, mimetype='image/svg+xml')
    except FileNotFoundError:
        return render_template('error.html', error='File not found'), 404
    except Exception as e:
        # Log the error and show a flash message
        app.logger.error(f'Error serving icon: {e}')
        flash('An error occurred while serving the icon. Please try again.', 'danger')
        return redirect(url_for('index'))

@app.route('/export/<folder>', methods=['GET'])
def export(folder):
    
    # Validate the folder name
    if not is_valid_folder_name(folder):
        return jsonify({'error': 'Invalid folder name.'}), 400

    # Use the folder name to get the corresponding database
    db_path = os.path.join(app.root_path, 'img', folder, f'{folder}.db')
    
    # Check if the directory exists
    if not os.path.isdir(os.path.dirname(db_path)):
        return jsonify({'error': 'No image directory exists.'}), 400
        
    # Initialize the markers database
    init_markers_db(db_path)

    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    markers = c.execute('SELECT * FROM markers').fetchall()
    lines = c.execute('SELECT * FROM lines').fetchall()  # Fetch data from lines table
    conn.close()

    # Check if there are any markers or lines
    if not markers and not lines:
        return jsonify({'error': 'No markers or lines data to export.'}), 400

    def generate():
        data = StringIO()
        writer = csv.writer(data)
        
        # Write header
        writer.writerow(['markerId', 'lat', 'lng', 'info', 'iconType', 'iconColor', 'markerNotes'])
        
        # Write data
        for marker in markers:
            writer.writerow([marker[0], marker[1], marker[2], marker[3], marker[4], marker[5], marker[6]])
            yield data.getvalue()
            data.seek(0)
            data.truncate(0)

        # Write header for lines
        writer.writerow(['lineId', 'start_lat', 'start_lng', 'end_lat', 'end_lng', 'info', 'color', 'notes'])
        
        # Write data for lines
        for line in lines:
            writer.writerow([line[0], line[1], line[2], line[3], line[4], line[5], line[6], line[7]])
            yield data.getvalue()
            data.seek(0)
            data.truncate(0)

    return Response(generate(), mimetype='text/csv')


def is_valid_folder_name(folder_name):
    # Check for directory traversal
    if '..' in folder_name or '/' in folder_name:
        return False
    # Check for invalid characters
    if not re.match(r'^[\w-]+$', folder_name):
        return False
    # Check if the directory exists
    if not os.path.isdir(os.path.join(app.root_path, 'img', folder_name)):
        return False
    return True

@app.route('/export_journals/<folder>', methods=['GET'])
def export_journals(folder):
    
    # Validate the folder name
    if not is_valid_folder_name(folder):
        flash('Invalid folder name.', 'danger')
        return redirect(url_for('index'))

    # Use the folder name to get the corresponding database
    db_path = os.path.join(app.root_path, 'img', folder, f'{folder}.db')

    # Initialize the journals database
    init_journal_db(db_path)  # Make sure you have this function

    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    journals = c.execute('SELECT * FROM journals').fetchall()
    conn.close()

    def generate():
        data = StringIO()
        writer = csv.writer(data)
        
        # Write header for journals
        writer.writerow(['journalId', 'entry_date', 'linked_item_id', 'entry_title', 'entry_content'])
        
        # Write data for journals
        for journal in journals:
            writer.writerow([journal[0], journal[1], journal[2], journal[3], journal[4]])
            yield data.getvalue()
            data.seek(0)
            data.truncate(0)

    return Response(generate(), mimetype='text/csv')

@app.route('/backup', methods=['POST'])
def backup():
    selected_dir = request.form.get('directory')

    # Validate the directory name
    if not is_valid_folder_name(selected_dir):
        flash('Invalid directory name.', 'danger')
        return redirect(url_for('index'))
    try:
        selected_dir = request.form.get('directory')
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_filename = f"{selected_dir}_{timestamp}.tar.gz"
        backup_path = os.path.join(app.root_path, 'backups', backup_filename)
        
        with tarfile.open(backup_path, "w:gz") as tar:
            tar.add(os.path.join(app.root_path, 'img', selected_dir), arcname=os.path.basename(selected_dir))
            db_file_path = os.path.join(app.root_path, 'img', selected_dir+'.db')
            if os.path.exists(db_file_path):
                tar.add(db_file_path, arcname=os.path.basename(selected_dir+'.db'))

        return {'status': 'success', 'filename': backup_filename}, 200

    except Exception as e:
        print(f"Error creating backup: {e}")
        return {'status': 'error', 'message': str(e)}, 500

@app.route('/restore', methods=['POST'])
def restore():
    try:
        backup_file = request.form.get('backup_file')
        backup_path = os.path.join(app.root_path, 'backups', backup_file)

        if not os.path.exists(backup_path):
            return {'status': 'error', 'message': 'Backup file not found'}, 404

        with tarfile.open(backup_path, "r:gz") as tar:
            for member in tar.getmembers():
                # Prevent directory traversal
                if os.path.isabs(member.name) or ".." in member.name:
                    return {'status': 'error', 'message': 'Backup contains invalid paths'}, 400
                
                if member.type == tarfile.DIRTYPE and os.path.exists(os.path.join(app.root_path, 'img', member.name)):
                    # Directory with the same name exists
                    return {'status': 'error', 'message': 'A directory with the same name already exists. Please rename or delete it before proceeding.'}, 409

            # If there's no conflict, extract the backup
            tar.extractall(path=os.path.join(app.root_path, 'img'))

        return {'status': 'success'}, 200

    except Exception as e:
        print(f"Error restoring backup: {e}")
        return {'status': 'error', 'message': str(e)}, 500

@app.route('/backups')
def backups():
    try:
        backup_directory = os.path.join(app.root_path, 'backups')
        backup_files = [f for f in os.listdir(backup_directory) if os.path.isfile(os.path.join(backup_directory, f))]
        return json.dumps(backup_files)
    except Exception as e:
        return render_template('error.html', error=str(e)), 500

@app.errorhandler(ValueError)
def handle_invalid_directory(error):
    return jsonify(error=str(error)), 400

def init_journal_db(db_path):
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        c.execute('''
            CREATE TABLE IF NOT EXISTS journals (
                id TEXT PRIMARY KEY,
                entry_date TEXT NOT NULL,
                linked_item_id TEXT,
                entry_title TEXT NOT NULL,
                entry_content TEXT NOT NULL,
                is_favorite TEXT NOT NULL DEFAULT 'no'  -- Add the new column with a default value
            )
        ''')

        conn.commit()
        print(f"init_journal_db() will attempt to create a 'journals' table in the database, if the table does not exist : {db_path}")

    except Exception as e:
        print(f"Error initializing journal database: {e}")
    finally:
        if conn:
            conn.close()

@app.route('/journals/<selected_dir>', methods=['GET', 'POST'])
def journals(selected_dir=None):
    image_base_path = os.path.join(app.root_path, 'img')

    if selected_dir is not None:
        print(f"selected_dir: {selected_dir}")
        print(f"resolved selected_dir: {os.path.realpath(os.path.join(image_base_path, selected_dir))}")
        if not is_safe_path(image_base_path, selected_dir):
            raise InvalidDirectoryError("Invalid directory")

        # Also check path safety for POST method
        if request.method == 'POST' and not is_safe_path(image_base_path, selected_dir):
            raise InvalidDirectoryError("Invalid directory")
        conn = None
    try:
        if request.method == 'GET':
            # Update the session's image_folder with the new selected folder
            session['image_folder'] = selected_dir

            # Pass the folder name to get_journals function
            return get_journals(image_folder=selected_dir)
        elif request.method == 'POST':
            # Call init_journal_db before adding a new journal entry
            image_folder = session.get('image_folder', get_image_folder_path())
            db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')
            print(f"initializing database {image_folder}")
            init_journal_db(db_path)

            data = request.get_json()
            entry_title = data['entry_title']
            entry_content = data['entry_content']
            linked_item_id = data['linked_item_id']
            is_favorite = data['is_favorite'] or 'no'    
            # Generate a UUID for the new journal entry
            journal_id = str(uuid.uuid4())
    
            # Get the current date and time
            from datetime import datetime
            current_date = datetime.now().strftime('%B %d, %Y %H:%M')

            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('INSERT INTO journals (id, entry_date, linked_item_id, entry_title, entry_content, is_favorite) VALUES (?, ?, ?, ?, ?, ?)', (journal_id, current_date, linked_item_id, entry_title, entry_content, is_favorite))

            conn.commit()
            return jsonify({'journal_id': journal_id}), 200

    except Exception as e:
        print(f"Error adding journal: {e}")
        return "", 500
    finally:
        if conn:
            conn.close()

@app.route('/journals/<folder>/<id>', methods=['GET', 'PUT'])
def journal_entry(folder, id):
    
    # Safety check on path
    image_base_path = os.path.join(app.root_path, 'img')
    if not is_safe_path(image_base_path, folder):
        raise InvalidDirectoryError("Invalid directory")

    db_path = os.path.join(app.root_path, 'img', folder, f'{folder}.db')

    # Initialize the journal database
    init_journal_db(db_path)

    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    if request.method == 'GET':
        try:
            c.execute('SELECT * FROM journals WHERE id = ?', (id,))
            journal = c.fetchone()

            if journal is None:
                return jsonify({'error': 'Journal entry not found'}), 404

            # Convert the tuple to a JSON object
            journal_entry = {
                'journalId': journal[0],
                'entry_date': journal[1],
                'linked_item_id': journal[2],
                'entry_title': journal[3],
                'entry_content': journal[4],
                'is_favorite': journal[5]
            }
            
            return jsonify(journal_entry)

        except sqlite3.OperationalError as e:
            app.logger.error(f"Error getting journal entry from database: {e}")
            app.logger.error(traceback.format_exc())
            return jsonify({'error': 'Error getting journal entry'}), 500
        finally:
            if conn:
                conn.close()
    elif request.method == 'PUT':
        try:
            data = request.get_json()
            entry_title = data['entry_title']
            entry_content = data['entry_content']
            linked_item_id = data['linked_item_id']
            is_favorite = data['is_favorite']

            # Validate user inputs 
            c.execute('UPDATE journals SET entry_title=?, entry_content=?, linked_item_id=?, is_favorite=? WHERE id=?', (entry_title, entry_content, linked_item_id, is_favorite, id))
            conn.commit()

            print(f"Journal Updated")
            return 'OK', 200

        except Exception as e:
            print(f"Error updating journal: {e}")
            return "Internal Server Error", 500

        finally:
            if conn:
                conn.close()

def get_journals(image_folder=None):
    conn = None
    try:
        if image_folder is None:
            image_folder = get_image_folder_path()

        image_folder = session.get('image_folder', image_folder)
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        # Initialize the journal database
        init_journal_db(db_path)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('SELECT * FROM journals')
        journals = c.fetchall()

        # Convert the tuples to JSON objects
        journal_list = [
            {
                'id': journal[0],
                'entry_date': journal[1],
                'linked_item_id': journal[2],
                'entry_title': journal[3],
                'entry_content': journal[4],
                'is_favorite': journal[5]
            } for journal in journals
        ]
        return jsonify(journal_list)  # Return the JSON object

    except sqlite3.OperationalError as e:
        app.logger.error(f"Error getting journals from database: {e}")
        app.logger.error(traceback.format_exc())
        return jsonify([])  # Return an empty list as a JSON object
    finally:
        if conn:
            conn.close()

@app.route('/update_journal', methods=['POST'])
def update_journal():
    conn = None
    try:
        data = request.get_json()
        journal_id = data['id']
        entry_title = data['entry_title']
        entry_content = data['entry_content']
        linked_item_id = data['linked_item_id']
        is_favorite = data['is_favorite']
        image_folder = session.get('image_folder', get_image_folder_path())
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('UPDATE journals SET entry_title=?, entry_content=?, linked_item_id=?, is_favorite=? WHERE id=?', (entry_title, entry_content, linked_item_id, is_favorite, journal_id))
        conn.commit()

        print(f"Journal Updated")
        return 'OK', 200

    except Exception as e:
        print(f"Error updating journal: {e}")
        return "Internal Server Error", 500
    finally:
        if conn:
            conn.close()

@app.route('/delete_journal', methods=['POST'])
def delete_journal():
    conn = None
    try:
        data = request.get_json()
        journal_id = data['id']
        image_folder = session.get('image_folder', get_image_folder_path())
        db_path = os.path.join(app.root_path, 'img', image_folder, f'{image_folder}.db')

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute('DELETE FROM journals WHERE id=?', (journal_id,))
        conn.commit()

        print(f"Journal {journal_id} deleted")
        return 'OK', 200

    except Exception as e:
        print(f"Error deleting journal: {e}")
        return "Internal Server Error", 500
    finally:
        if conn:
            conn.close()

def save_dng_raw_image_as_jpeg(image, file_directory, filename):
    with rawpy.imread(image) as raw:
        rgb = raw.postprocess()
    imageio.imsave(os.path.join(file_directory, filename), rgb)
    thumbnail_filename = f"thumbnail-{os.path.splitext(filename)[0]}.png"
    create_thumbnail(os.path.join(file_directory, filename), os.path.join(file_directory, thumbnail_filename), (200, 200))
    print("New .dng or .raw image saved as .jpg and thumbnail image saved")

@app.route('/upload_image', methods=['POST'])
def upload_image():
    # check if the post request has the file part
    if 'image' not in request.files:
        return jsonify({'status': 'No image part in the request'}), 400

    image = request.files['image']

    if image.filename == '':
        return jsonify({'status': 'No image selected for uploading'}), 400

    if image and allowed_file(image.filename):
        # check the size of the file
        max_size = 5 * 1024 * 1024  # 5MB size limit for journal pics
        if request.content_length > max_size:
            return jsonify({'status': 'File size must be less than 1MB'}), 400

        filename = secure_filename(image.filename)
        image_folder = get_image_folder_path()

        # ensure that the images subfolder exists
        images_subfolder = os.path.join(app.root_path, 'img', image_folder, 'images')
        if not os.path.exists(images_subfolder):
            os.makedirs(images_subfolder)

        # save the image file to the images subfolder
        filepath = Path(images_subfolder) / filename

        # Check path safety before saving the image
        if not is_safe_path(images_subfolder, filename):
            raise InvalidDirectoryError("Invalid directory")

        image.save(filepath)

        # build a url for the uploaded image file
        # use 'serve_image' route and the path relative to the 'img' folder
        relative_path = Path(image_folder) / 'images' / filename
        image_url = url_for('serve_image', filename=str(relative_path))

        return jsonify({'status': 'OK', 'data': image_url}), 200

    return jsonify({'status': 'Allowed image types are -> png, jpg, jpeg, gif'}), 400