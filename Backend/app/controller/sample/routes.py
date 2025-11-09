from flask import Blueprint, request
from flask_json_schema import JsonSchema, JsonValidationError
from app import app
from app.controller.sample.services import Service
from app.utils.validators.admin_schema import admin_schema
from app.utils.middleware.response_format import resp_validation_failure

schema = JsonSchema(app)

# Create a service object
service = Service.get_instance()

# Sample blueprint
router = Blueprint('SampleRoute', __name__)

# Sample POST API request
@router.route('/create', methods=['POST'])
@schema.validate(admin_schema['owner_schema'])
def sample_create():
    return service.sample_create(request)

# Sample GET API request
@router.route('/get', methods=['GET'])
def sample_get():
    return service.sample_get(request)

# Error handling
@router.errorhandler(JsonValidationError)
def validation_error(e):
    return resp_validation_failure('Validation error', [error.message for error in e.errors])