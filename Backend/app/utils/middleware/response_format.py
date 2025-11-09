from flask import jsonify

def resp_success(message, data=None):
    """Format success response"""
    response = {
        'status': 'success',
        'message': message
    }
    if data is not None:
        response['data'] = data
    return jsonify(response), 200

def resp_failure(message, error=None):
    """Format failure response"""
    response = {
        'status': 'failure',
        'message': message
    }
    if error is not None:
        response['error'] = error
    return jsonify(response), 400

def resp_validation_failure(message, errors=None):
    """Format validation failure response"""
    response = {
        'status': 'validation_error',
        'message': message
    }
    if errors is not None:
        response['errors'] = errors
    return jsonify(response), 422

def resp_page_not_found(message, error=None):
    """Format page not found response"""
    response = {
        'status': 'not_found',
        'message': message
    }
    if error is not None:
        response['error'] = error
    return jsonify(response), 404