from flask import Blueprint, request
from flask_json_schema import JsonSchema, JsonValidationError
from app import app
from app.controller.processor.services import Service
from app.utils.middleware.response_format import resp_validation_failure, resp_failure, resp_success

schema = JsonSchema(app)

# Create a service object
service = Service.get_instance()

# Processor blueprint
router = Blueprint('processorRoute', __name__, url_prefix='/processor')

# Configuration Management Routes
# COMMENTED OUT - Now using environment variables for configuration
# @router.route('/set-config', methods=['POST'])
# def set_config():
#     """Set configuration data and auto-start agent for specific user"""
#     try:
#         data = request.get_json()
#         if not data:
#             return resp_failure("Invalid request", "Request body is required")
#         
#         # Ensure nodeId is provided
#         node_id = data.get('nodeId') or request.headers.get('X-Node-ID')
#         if not node_id:
#             return resp_failure("nodeId required", "Please provide nodeId in request body or X-Node-ID header")
#         
#         return service.set_config(request)
#     except Exception as e:
#         return resp_failure("Request processing failed", str(e))

@router.route('/get-config', methods=['GET'])
def get_config():
    """Get configuration data for specific user"""
    try:
        node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
        if not node_id:
            return resp_failure("nodeId required", "Please provide nodeId parameter or X-Node-ID header")
        
        return service.get_config(request)
    except Exception as e:
        return resp_failure("Request processing failed", str(e))

@router.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint - supports both global and user-specific checks"""
    return service.health_check(request)

# Token Service Routes
@router.route('/getToken', methods=['GET'])
def get_token():
    """Generate LiveKit access token for specific user"""
    try:
        node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
        if not node_id:
            return resp_failure("nodeId required", "Please provide nodeId parameter or X-Node-ID header")
        
        return service.get_token(request)
    except Exception as e:
        return resp_failure("Request processing failed", str(e))

@router.route('/getRooms', methods=['GET'])
def get_rooms():
    """Get list of active rooms for specific user"""
    try:
        node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
        if not node_id:
            return resp_failure("nodeId required", "Please provide nodeId parameter or X-Node-ID header")
        
        return service.get_rooms(request)
    except Exception as e:
        return resp_failure("Request processing failed", str(e))

# Additional Multi-User Management Routes
@router.route('/cleanup-user', methods=['DELETE'])
def cleanup_user():
    """Clean up resources for a specific user"""
    try:
        node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
        if not node_id:
            return resp_failure("nodeId required", "Please provide nodeId parameter or X-Node-ID header")
        
        success = service.cleanup_node(node_id)  # Updated method name
        if success:
            return resp_success("User resources cleaned up successfully", {"nodeId": node_id})
        else:
            return resp_failure("Failed to cleanup user resources", f"Could not cleanup resources for nodeId: {node_id}")
    except Exception as e:
        return resp_failure("Cleanup failed", str(e))

@router.route('/users', methods=['GET'])
def list_users():
    """List all active users and their status"""
    try:
        from app.controller.processor.services import user_configs, user_agents
        
        users_status = []
        for node_id in user_configs.keys():
            agent_manager = user_agents.get(node_id)
            agent_running = (agent_manager and 
                           agent_manager.agent_thread and 
                           agent_manager.agent_thread.is_alive())
            
            users_status.append({
                "nodeId": node_id,
                "config_available": True,
                "agent_running": agent_running,
                "agent_thread_name": agent_manager.agent_thread.name if agent_manager and agent_manager.agent_thread else None
            })
        
        return resp_success("Users list retrieved", {
            "total_users": len(users_status),
            "users": users_status
        })
    except Exception as e:
        return resp_failure("Failed to get users list", str(e))

# Error handling
@router.errorhandler(JsonValidationError)
def validation_error(e):
    return resp_validation_failure('Validation error', [error.message for error in e.errors])

# Middleware to log requests with nodeId
@router.before_request
def log_request_info():
    """Log request information including nodeId"""
    node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
    if hasattr(request, 'get_json') and request.get_json(silent=True):
        node_id = node_id or request.get_json().get('nodeId')
    
    logger = __import__('logging').getLogger(__name__)
    logger.info(f"ðŸ“ Request: {request.method} {request.path} | NodeID: {node_id or 'None'}")