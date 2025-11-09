import asyncio
import logging
import signal
import sys
import threading
import time
import uuid
import os
from typing import Dict, Any, Optional

from flask import request, jsonify
from app.utils.middleware.response_format import resp_success, resp_failure
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# LiveKit imports
from livekit import api
from livekit.api import LiveKitAPI, ListRoomsRequest
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import groq, silero

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Lazy import optional plugins
OPTIONAL_PLUGINS = {
    'deepgram': None,
    'azure': None,
    'openai': None,
    'anthropic': None,
    'elevenlabs': None,
    'google': None
}

for plugin in OPTIONAL_PLUGINS.keys():
    try:
        OPTIONAL_PLUGINS[plugin] = __import__(f'livekit.plugins.{plugin}', fromlist=[plugin])
    except ImportError:
        pass

DEFAULT_CONFIG = {
    "stt": {"provider": "groq", "apiKey": ""},
    "llm": {"provider": "groq", "apiKey": ""},
    "tts": {"provider": "groq", "apiKey": ""},
    "liveKit": {"apiKey": "", "secret": "", "serverUrl": ""}
}

def load_config_from_env():
    """Load configuration from environment variables"""
    config = {
        "stt": {
            "provider": os.getenv("STT_PROVIDER", "groq"),
            "apiKey": os.getenv("STT_API_KEY", "")
        },
        "llm": {
            "provider": os.getenv("LLM_PROVIDER", "groq"),
            "apiKey": os.getenv("LLM_API_KEY", "")
        },
        "tts": {
            "provider": os.getenv("TTS_PROVIDER", "groq"),
            "apiKey": os.getenv("TTS_API_KEY", "")
        },
        "liveKit": {
            "apiKey": os.getenv("LIVEKIT_API_KEY", ""),
            "secret": os.getenv("LIVEKIT_API_SECRET", ""),
            "serverUrl": os.getenv("LIVEKIT_SERVER_URL", "")
        }
    }
    return config

# Global variables for multi-user management
user_configs = {}  # Store configs per nodeId
user_agents = {}   # Store agent threads per nodeId
user_shutdown_events = {}  # Store shutdown events per nodeId

class UserAgentManager:
    """Manages individual user agent instances"""
    
    def __init__(self, node_id: str, config: Dict[str, Any]):
        self.node_id = node_id
        self.config = config
        self.agent_thread = None
        self.shutdown_event = threading.Event()
        self.assistant = None
        
    def start_agent(self):
        """Start LiveKit agent for this node"""
        if self.agent_thread is None or not self.agent_thread.is_alive():
            self.agent_thread = threading.Thread(
                target=self._run_livekit_agent, 
                daemon=True,
                name=f"Agent-{self.node_id}"
            )
            self.agent_thread.start()
            logger.info(f"âœ… LiveKit agent started for node {self.node_id}")
    
    def stop_agent(self):
        """Stop LiveKit agent for this node"""
        if self.agent_thread and self.agent_thread.is_alive():
            logger.info(f"ðŸ›‘ Stopping LiveKit agent for node {self.node_id}")
            self.shutdown_event.set()
            self.agent_thread.join(timeout=5)
            if self.agent_thread.is_alive():
                logger.warning(f"Agent thread for {self.node_id} did not stop gracefully")
    
    def restart_agent(self):
        """Restart agent with new configuration"""
        logger.info(f"ðŸ”„ Restarting LiveKit agent for node {self.node_id}")
        self.stop_agent()
        time.sleep(1)  # Brief pause
        self.shutdown_event.clear()
        self.start_agent()
    
    def _run_livekit_agent(self):
        """Run LiveKit agent in separate thread"""
        try:
            logger.info(f"ðŸš€ Starting LiveKit Agent for node {self.node_id}")
            
            # Create event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            async def agent_main():
                worker_options = await self._create_worker_options()
                if worker_options and not self.shutdown_event.is_set():
                    from livekit.agents import Worker
                    worker = Worker(worker_options)
                    await worker.run()
            
            loop.run_until_complete(agent_main())
            
        except Exception as e:
            logger.error(f"LiveKit agent error for node {self.node_id}: {e}")
        finally:
            logger.info(f"LiveKit agent stopped for node {self.node_id}")
    
    async def _create_worker_options(self) -> Optional[WorkerOptions]:
        """Create worker options with node-specific configuration"""
        while not self.shutdown_event.is_set():
            try:    
                if self._validate_config(self.config):
                    livekit_config = self.config.get("liveKit", {})
                    return WorkerOptions(
                        entrypoint_fnc=self._entrypoint,
                        api_key=livekit_config["apiKey"],
                        api_secret=livekit_config["secret"],
                        ws_url=livekit_config["serverUrl"],
                    )
                logger.warning(f"Invalid configuration for node {self.node_id}, retrying in 5 seconds...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Error creating worker options for node {self.node_id}: {str(e)}")
                await asyncio.sleep(5)
        return None
    
    def _validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate the configuration and return True if valid"""
        required_livekit = ["apiKey", "secret", "serverUrl"]
        if not all(config.get("liveKit", {}).get(key) for key in required_livekit):
            logger.error(f"LiveKit credentials missing in config for node {self.node_id}")
            return False
        return True
    
    async def _entrypoint(self, ctx: JobContext) -> None:
        """Main entrypoint for the LiveKit agent"""
        try:
            logger.info(f"Starting voice assistant agent for node {self.node_id}")
            
            # Initialize assistant with node-specific config
            self.assistant = VoiceAssistant(self.config, self.node_id)
            
            # Wait for valid configuration
            while not self.shutdown_event.is_set():
                try:
                    if await self.assistant.initialize():
                        break
                    logger.warning(f"Configuration is not valid for node {self.node_id}, waiting 5 seconds...")
                    await asyncio.sleep(5)
                except Exception as e:
                    logger.error(f"Error while waiting for valid config for node {self.node_id}: {str(e)}")
                    await asyncio.sleep(5)
            
            if self.shutdown_event.is_set():
                return
            
            # Connect to LiveKit
            logger.info(f"Connecting to LiveKit for node {self.node_id}...")
            await ctx.connect()
            logger.info(f"Successfully connected to LiveKit for node {self.node_id}")
            
            # Create agent
            agent = Agent(
                instructions=f"""
                    You are a friendly voice assistant built by LiveKit for node {self.node_id}.
                    Start every conversation by greeting the user.
                    Only use the `lookup_weather` tool if the user specifically asks for weather information.
                    Never assume a location or provide weather data without a request.
                    """,
                tools=[self._lookup_weather],
            )
            
            # Create session
            session = AgentSession(
                vad=silero.VAD.load(),
                stt=self.assistant.stt,
                llm=self.assistant.llm,
                tts=self.assistant.tts,
            )
            
            # Start session
            logger.info(f"Starting agent session for node {self.node_id}...")
            await session.start(agent=agent, room=ctx.room)
            
            # Generate initial greeting
            logger.info(f"Generating initial reply for node {self.node_id}...")
            await session.generate_reply(
                instructions="Say hello, then ask the user how their day is going and how you can help."
            )
            
        except Exception as e:
            logger.error(f"Error in agent execution for node {self.node_id}: {str(e)}", exc_info=True)
            raise
    
    @function_tool
    async def _lookup_weather(
        self,
        context: RunContext,
        location: str,
    ) -> Dict[str, Any]:
        """Used to look up weather information."""
        try:
            return {"weather": "sunny", "temperature": 70, "location": location}
        except Exception as e:
            logger.error(f"Weather lookup failed for node {self.node_id}: {str(e)}")
            return {"error": "Unable to fetch weather information"}


class Service:
    _instance = None

    def __init__(self):
        if Service._instance is None:
            Service._instance = self
            # Auto-load configuration from environment variables
            self._auto_load_env_config()
        else:
            raise Exception("Only once created an object you can go with that instance")
    
    def _auto_load_env_config(self):
        """Auto-load configuration from environment variables on startup"""
        try:
            env_config = load_config_from_env()
            node_id = os.getenv("NODE_ID", "default-node")
            
            # Validate that we have the required LiveKit credentials
            if (env_config["liveKit"]["apiKey"] and 
                env_config["liveKit"]["secret"] and 
                env_config["liveKit"]["serverUrl"]):
                
                logger.info(f"🔧 Auto-loading configuration from environment for node: {node_id}")
                
                # Store config for this node
                user_configs[node_id] = env_config
                
                # Create and start agent manager
                agent_manager = UserAgentManager(node_id, env_config)
                user_agents[node_id] = agent_manager
                agent_manager.start_agent()
                
                logger.info(f"✅ Auto-started LiveKit agent for node: {node_id}")
            else:
                logger.warning("⚠️  LiveKit credentials not found in environment variables. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_SERVER_URL")
                
        except Exception as e:
            logger.error(f"❌ Failed to auto-load environment configuration: {e}")

    @staticmethod
    def get_instance():
        if Service._instance is None:
            Service._instance = Service()
        return Service._instance

    def set_config(self, request):
        """Set configuration data for a specific node and auto-start agent"""
        try:
            data = request.get_json()
            
            # Extract nodeId from request
            node_id = data.get('nodeId') or request.headers.get('X-Node-ID')
            if not node_id:
                return resp_failure("nodeId is required", "Please provide nodeId in request body or X-Node-ID header")
            
            logger.info(f"ðŸ“¥ Received Configuration Data for node {node_id}")
            
            # Validate the overall structure
            required_top_level = ["liveKit", "stt", "llm", "tts"]
            if not all(key in data for key in required_top_level):
                return resp_failure("Invalid configuration", "Missing required top-level keys")
            
            # Store config for this node
            user_configs[node_id] = data
            
            # Stop existing agent if running
            if node_id in user_agents:
                user_agents[node_id].stop_agent()
            
            # Create and start new agent manager
            agent_manager = UserAgentManager(node_id, data)
            user_agents[node_id] = agent_manager
            agent_manager.start_agent()
            
            return resp_success("Config stored and agent started", {
                "status": "ok", 
                "nodeId": node_id
            })
            
        except Exception as e:
            logger.error(f"Error setting config: {e}")
            return resp_failure("Failed to set config", str(e))

    def get_config(self, request):
        """Get configuration data for a specific node"""
        try:
            node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
            if not node_id:
                return resp_failure("nodeId is required", "Please provide nodeId parameter or X-Node-ID header")
            
            config = user_configs.get(node_id, {})
            return resp_success("Configuration retrieved successfully", {
                "config": config,
                "nodeId": node_id
            })
            
        except Exception as e:
            logger.error(f"Error getting config: {e}")
            return resp_failure("Failed to get config", str(e))

    def health_check(self, request):
        """Health check endpoint with multi-node status"""
        try:
            node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
            
            if node_id:
                # Health check for specific node
                agent_manager = user_agents.get(node_id)
                config_available = node_id in user_configs
                agent_running = (agent_manager and 
                               agent_manager.agent_thread and 
                               agent_manager.agent_thread.is_alive())
                
                health_data = {
                    "status": "ok",
                    "nodeId": node_id,
                    "services": {
                        "config": config_available,
                        "token": True,
                        "agent": agent_running
                    },
                    "config_available": config_available
                }
            else:
                # Overall health check
                health_data = {
                    "status": "ok",
                    "total_nodes": len(user_configs),
                    "active_agents": sum(1 for manager in user_agents.values() 
                                       if manager.agent_thread and manager.agent_thread.is_alive()),
                    "services": {
                        "config": True,
                        "token": True,
                        "multi_node": True
                    }
                }
            
            return resp_success("Health check completed", health_data)
            
        except Exception as e:
            logger.error(f"Error in health check: {e}")
            return resp_failure("Health check failed", str(e))

    def get_token(self, request):
        """Generate LiveKit access token for a specific node"""
        try:
            node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
            if not node_id:
                return resp_failure("nodeId is required", "Please provide nodeId parameter or X-Node-ID header")
            
            # Get node-specific LiveKit config
            node_config = user_configs.get(node_id)
            if not node_config:
                return resp_failure(
                    "Configuration not found", 
                    f"No configuration found for nodeId: {node_id}"
                )
            
            api_key, secret, server_url = self._get_livekit_config_for_node(node_id)
            
            if not api_key or not secret:
                return resp_failure(
                    "LiveKit configuration not available", 
                    f"Please configure LiveKit credentials for nodeId: {node_id}"
                )
            
            name = request.args.get("name", f"user-{node_id}")
            room = request.args.get("room", None)
            
            # Generate room name if not provided
            if not room:
                room = f"room-{node_id}-{str(uuid.uuid4())[:8]}"
            
            # Create access token
            token = api.AccessToken(api_key, secret) \
                .with_identity(name) \
                .with_name(name) \
                .with_grants(api.VideoGrants(
                    room_join=True,
                    room=room
                ))
            
            token_data = {
                "token": token.to_jwt(),
                "room": room,
                "serverUrl": server_url,
                "nodeId": node_id
            }
        
            return resp_success("Token generated successfully", token_data)
            
        except Exception as e:
            logger.error(f"Error generating token: {e}")
            return resp_failure("Failed to generate token", str(e))

    def get_rooms(self, request):
        """Get list of active rooms for a specific node"""
        try:
            node_id = request.args.get('nodeId') or request.headers.get('X-Node-ID')
            if not node_id:
                return resp_failure("nodeId is required", "Please provide nodeId parameter or X-Node-ID header")
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            rooms = loop.run_until_complete(self._get_rooms_async(node_id))
            loop.close()
            
            return resp_success("Rooms retrieved successfully", {
                "rooms": rooms,
                "nodeId": node_id
            })
            
        except Exception as e:
            logger.error(f"Error fetching rooms: {e}")
            return resp_failure("Failed to fetch rooms", str(e))

    def _get_livekit_config_for_node(self, node_id: str):
        """Get LiveKit configuration for a specific node"""
        try:
            node_config = user_configs.get(node_id, {})
            livekit_config = node_config.get('liveKit', {})
            api_key = livekit_config.get('apiKey')
            secret = livekit_config.get('secret')
            server_url = livekit_config.get('serverUrl')
            
            if not api_key or not secret:
                logger.warning(f"LiveKit credentials not found for node {node_id}")
                return None, None, None
                
            return api_key, secret, server_url
            
        except Exception as e:
            logger.error(f"Error processing config for node {node_id}: {e}")
            return None, None, None

    async def _get_rooms_async(self, node_id: str):
        """Get list of active rooms for a specific node"""
        api_key, secret, server_url = self._get_livekit_config_for_node(node_id)
        if not api_key or not secret:
            return []
        
        try:
            livekit_api = LiveKitAPI(
                url=server_url if server_url else None,
                api_key=api_key,
                api_secret=secret
            )
            rooms = await livekit_api.room.list_rooms(ListRoomsRequest())
            await livekit_api.aclose()
            return [room.name for room in rooms.rooms]
        except Exception as e:
            logger.error(f"Error fetching rooms for node {node_id}: {e}")
            return []

    def cleanup_node(self, node_id: str):
        """Clean up resources for a specific node"""
        try:
            # Stop agent
            if node_id in user_agents:
                user_agents[node_id].stop_agent()
                del user_agents[node_id]
            
            # Remove config
            if node_id in user_configs:
                del user_configs[node_id]
            
            logger.info(f"ðŸ§¹ Cleaned up resources for node {node_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error cleaning up node {node_id}: {e}")
            return False


class VoiceAssistant:
    def __init__(self, config: Dict[str, Any] = None, node_id: str = None):
        self.config = config or DEFAULT_CONFIG
        self.node_id = node_id
        self.stt = None
        self.llm = None
        self.tts = None
        self._initialized = False

    async def initialize(self) -> bool:
        """Initialize the assistant with node-specific configuration"""
        try:
            if not self.config:
                return False
            
            service = Service.get_instance()
            if not self._validate_config(self.config):
                return False
            
            await self._initialize_stt()
            await self._initialize_llm()
            await self._initialize_tts()
            
            self._initialized = True
            logger.info(f"Voice assistant initialized for node {self.node_id}")
            return True
            
        except Exception as e:
            logger.error(f"Initialization failed for node {self.node_id}: {str(e)}")
            self._initialized = False
            return False

    def _validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate the configuration"""
        required_livekit = ["apiKey", "secret", "serverUrl"]
        if not all(config.get("liveKit", {}).get(key) for key in required_livekit):
            logger.error(f"LiveKit credentials missing for node {self.node_id}")
            return False
        return True

    async def _initialize_stt(self) -> None:
        """Initialize STT service"""
        stt_config = self.config.get("stt", {})
        provider = stt_config.get("provider", "groq").lower()
        api_key = stt_config.get("apiKey", "")
        
        logger.info(f"Initializing STT with provider: {provider} for node {self.node_id}")
        
        if provider == "groq":
            self.stt = groq.STT(api_key=api_key)
        elif provider == "deepgram":
            if plugin := self._get_plugin("deepgram"):  # Changed from service._get_plugin
                self.stt = plugin.STT(api_key=api_key)
        elif provider == "azure":
            if plugin := self._get_plugin("azure"):  # Changed from service._get_plugin
                self.stt = plugin.STT(api_key=api_key)
        else:
            logger.warning(f"Unsupported STT provider: {provider}, defaulting to groq for node {self.node_id}")
            self.stt = groq.STT(api_key=api_key)

    async def _initialize_llm(self) -> None:
        """Initialize LLM service"""
        llm_config = self.config.get("llm", {})
        provider = llm_config.get("provider", "groq").lower()
        api_key = llm_config.get("apiKey", "")
        
        logger.info(f"Initializing LLM with provider: {provider} for node {self.node_id}")
        
        if provider == "groq":
            self.llm = groq.LLM(api_key=api_key)
        elif provider == "openai":
            if plugin := self._get_plugin("openai"):  # Changed from service._get_plugin
                self.llm = plugin.LLM(api_key=api_key)
        elif provider == "anthropic":
            if plugin := self._get_plugin("anthropic"):  # Changed from service._get_plugin
                self.llm = plugin.LLM(api_key=api_key)
        elif provider == "azure":
            if plugin := self._get_plugin("azure"):  # Changed from service._get_plugin
                self.llm = plugin.LLM(api_key=api_key)
        elif provider == "gemini":
            if plugin := self._get_plugin("google"):  # Changed from service._get_plugin
                self.llm = plugin.LLM(api_key=api_key)
        else:
            logger.warning(f"Unsupported LLM provider: {provider}, defaulting to groq for node {self.node_id}")
            self.llm = groq.LLM(api_key=api_key)

    async def _initialize_tts(self) -> None:
        """Initialize TTS service"""
        tts_config = self.config.get("tts", {})
        provider = tts_config.get("provider", "groq").lower()
        api_key = tts_config.get("apiKey", "")
        
        logger.info(f"Initializing TTS with provider: {provider} for node {self.node_id}")
        
        if provider == "groq":
            self.tts = groq.TTS(api_key=api_key)
        elif provider == "elevenlabs":
            if plugin := self._get_plugin("elevenlabs"):  # Changed from service._get_plugin
                self.tts = plugin.TTS(api_key=api_key)
        elif provider == "openai":
            if plugin := self._get_plugin("openai"):  # Changed from service._get_plugin
                self.tts = plugin.TTS(api_key=api_key)
        elif provider == "azure":
            if plugin := self._get_plugin("azure"):  # Changed from service._get_plugin
                self.tts = plugin.TTS(api_key=api_key)
        elif provider == "google":
            if plugin := self._get_plugin("google"):  # Changed from service._get_plugin
                self.tts = plugin.TTS(api_key=api_key)
        elif provider == "deepgram":
            if plugin := self._get_plugin("deepgram"):
                self.tts = plugin.TTS(api_key=api_key)
        else:
            logger.warning(f"Unsupported TTS provider: {provider}, defaulting to groq for node {self.node_id}")
            self.tts = groq.TTS(api_key=api_key)

    def _get_plugin(self, plugin_name: str):
        """Get an optional plugin if available"""
        plugin = OPTIONAL_PLUGINS.get(plugin_name.lower())
        if plugin is None:
            logger.warning(f"Plugin {plugin_name} is not available")
        return plugin


# Set up signal handlers
def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info("ðŸ›‘ Received shutdown signal, stopping all services...")
    
    # Stop all node agents
    for node_id, agent_manager in user_agents.items():
        agent_manager.stop_agent()
    
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

logger.info("ðŸŽ¯ Multi-Node Unified LiveKit Services initialized")
logger.info("ðŸ“‹ Available services:")
logger.info("   â€¢ Configuration API (/set-config) - requires nodeId")
logger.info("   â€¢ Token Service (/getToken, /getRooms) - requires nodeId")
logger.info("   â€¢ LiveKit Agent (auto-start per node)")
logger.info("   â€¢ Health Check (/health) - supports multi-node")