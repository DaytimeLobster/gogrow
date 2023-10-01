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