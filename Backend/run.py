from app import app
from flask import make_response
from flask import json, jsonify
app.config.from_object('config')
# Configuration is handled internally by the app via /set-config endpoint

HOST = '0.0.0.0'
PORT = app.config.get('PORT', 5013)
DEBUG = True

print(f"Starting Flask app at: http://{HOST}:{PORT}")
app.run(host=HOST, port=PORT, debug=DEBUG)
