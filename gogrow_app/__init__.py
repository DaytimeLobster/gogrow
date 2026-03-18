"""
The flask application package.
"""

import os
import logging
from flask import Flask, redirect, jsonify, request, url_for, render_template, send_from_directory
from flask_wtf.csrf import CSRFProtect

app = Flask(__name__)
# debug must be False in production; controlled via environment variable only
app.debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

versionNum = "1.0.2"

app.config['STATIC_FOLDER'] = os.path.join(app.root_path, 'static')
# WTF_CSRF_CHECK_DEFAULT=False lets us selectively protect only HTML form routes
# while leaving JSON API endpoints unaffected
app.config['WTF_CSRF_CHECK_DEFAULT'] = False

csrf = CSRFProtect(app)

logger = logging.getLogger(__name__)

@app.route('/static/<path:path>')
def serve_static(path):
    static_folder = app.config['STATIC_FOLDER']
    if path.startswith('icons'):
        return send_from_directory(os.path.join(static_folder, 'icons'), path[len('icons/'):])
    else:
        return send_from_directory(static_folder, path)

@app.route('/version')
def version():
    return f"{versionNum}"

logger.info("GoGrow static folder configured")
logger.info(f"Running GoGrow version {versionNum}")


import gogrow_app.views

