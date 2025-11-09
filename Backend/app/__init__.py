from flask import Flask, jsonify, request
from flask_cors import CORS
from app.utils.middleware.response_format import resp_page_not_found

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
app.config.from_object('config')

from app.controller.processor.routes import router as processor_routes
from app.controller.sample.routes import router as sample_routes

# Common URL prefix
url_prefix = '/api/v1/livekit_ms'

@app.route(url_prefix, methods=['GET'])
def healthcheck():
    return jsonify({'status': 'success', 'Message': 'Welcome to LiveKit Services'}), 200

# Root endpoint with service information
@app.route("/")
def index():
    return jsonify({
        "service": "Unified LiveKit Services",
        "version": "1.0.0",
        "description": "Agent starts automatically when configuration is set",
        "endpoints": {
            "config": {
                "note": "Configuration loaded from .env file on startup",
                "get": "GET /api/v1/livekit_ms/processor/get-config"
            },
            "token": {
                "get_token": "GET /api/v1/livekit_ms/processor/getToken?name=USER&room=ROOM",
                "get_rooms": "GET /api/v1/livekit_ms/processor/getRooms"
            },
            "health": "GET /api/v1/livekit_ms/processor/health"
        }
    })

# Register blueprint(imported blueprint)
app.register_blueprint(sample_routes, url_prefix=url_prefix+'/sample')
app.register_blueprint(processor_routes, url_prefix=url_prefix+'/processor')

@app.errorhandler(404)
def resource_not_found(error):
    return resp_page_not_found('Page not found', str(error))