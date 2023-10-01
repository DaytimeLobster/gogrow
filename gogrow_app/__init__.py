"""
The flask application package.
"""

import os
from flask import Flask, redirect, jsonify, request, url_for, render_template, send_from_directory
app = Flask(__name__)
app.debug = True

versionNum = "1.0.0"

app.config['STATIC_FOLDER'] = os.path.join(app.root_path, 'static')

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

print("__init__.py serving /static folder")

print(f"Running GoGrow version {versionNum}")


import gogrow_app.views

