admin_schema = {
    'owner_schema': {
        'type': 'object',
        'properties': {
            'email': {
                'type': 'string',
                'format': 'email'
            },
            'name': {
                'type': 'string',
                'minLength': 1
            }
        },
        'required': ['email']
    },
    'livekit_config_schema': {
        'type': 'object',
        'properties': {
            'liveKit': {
                'type': 'object',
                'properties': {
                    'apiKey': {'type': 'string', 'minLength': 1},
                    'secret': {'type': 'string', 'minLength': 1},
                    'serverUrl': {'type': 'string', 'minLength': 1}
                },
                'required': ['apiKey', 'secret', 'serverUrl']
            },
            'stt': {
                'type': 'object',
                'properties': {
                    'provider': {'type': 'string'},
                    'apiKey': {'type': 'string'}
                }
            },
            'llm': {
                'type': 'object',
                'properties': {
                    'provider': {'type': 'string'},
                    'apiKey': {'type': 'string'}
                }
            },
            'tts': {
                'type': 'object',
                'properties': {
                    'provider': {'type': 'string'},
                    'apiKey': {'type': 'string'}
                }
            }
        },
        'required': ['liveKit']
    }
}