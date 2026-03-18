import os
import secrets
import configparser
import logging
from gogrow_app import app

logger = logging.getLogger(__name__)

_PLACEHOLDER = 'YOUR_SECRET_KEY'

def _ensure_secret_key(config, config_path):
    """
    If the secret key is still the placeholder (or missing), generate a real one
    and persist it back to config.cfg so it survives restarts.
    """
    current = config.get('AppSettings', 'secret_key', fallback=_PLACEHOLDER)
    if not current or current == _PLACEHOLDER:
        new_key = secrets.token_hex(32)
        if not config.has_section('AppSettings'):
            config.add_section('AppSettings')
        config.set('AppSettings', 'secret_key', new_key)
        with open(config_path, 'w') as f:
            config.write(f)
        logger.info("Generated and saved a new secret key to config.cfg")
        return new_key
    return current

def load_app_settings():
    config_path = os.path.join(app.root_path, 'config.cfg')
    config = configparser.ConfigParser()
    config.read(config_path)

    app.secret_key = _ensure_secret_key(config, config_path)
    app.config['ICON_DIR'] = os.path.join(app.root_path, config.get('Directories', 'icon_dir', fallback='icons'))
    app.config['THUMBNAIL_DIR'] = os.path.join(app.root_path, config.get('Directories', 'thumbnail_dir', fallback='thumbs'))
    app.config['IMAGE_FOLDER'] = config.get('ImageSettings', 'image_folder', fallback='default_folder')

logger.info("Settings.py importing configuration data from config.cfg...")
load_app_settings()
IMAGE_FOLDER = app.config['IMAGE_FOLDER']
ICON_DIR = app.config['ICON_DIR']
THUMBNAIL_DIR = app.config['THUMBNAIL_DIR']
