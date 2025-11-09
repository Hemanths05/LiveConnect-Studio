import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import {
  useVoiceAssistant,
  useTrackTranscription,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
// import CustomVisualizer from './CustomVisualizer';

interface PlaygroundPanelProps {
  liveKitOnWorkspace: boolean;
  username: string;
  setUsername: (username: string) => void;
  isAudioConnected: boolean;
  isMuted: boolean;
  audioControlsToggle: (() => void) | null;
  connectAudio: () => void;
  disconnectAudio: () => void;
  resetFlow: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
  type: 'user' | 'agent' | 'system';
}

// Component that contains LiveKit hooks - only rendered when inside LiveKitRoom
const LiveKitConnectedPanel: React.FC<{
  username: string;
  isAudioConnected: boolean;
  isMuted: boolean;
  audioControlsToggle: (() => void) | null;
}> = ({ username, isAudioConnected, isMuted, audioControlsToggle }) => {
  const [message, setMessage] = useState('');
  const [transcripts, setTranscripts] = useState<Map<string, ChatMessage>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // LiveKit hooks - safe to use here as this component is only rendered inside LiveKitRoom
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const localParticipant = useLocalParticipant();
  const { segments: userTranscriptions } = useTrackTranscription({
    publication: localParticipant.microphoneTrack,
    source: Track.Source.Microphone,
    participant: localParticipant.localParticipant,
  });

  // Handle initial system message when connected
  useEffect(() => {
    if (isAudioConnected) {
      setChatMessages([
        {
          id: 'system-1',
          sender: 'System',
          text: 'You joined the voice chat',
          timestamp: Date.now(),
          isLocal: false,
          type: 'system',
        },
      ]);
      setTranscripts(new Map());
    } else {
      setChatMessages([]);
      setTranscripts(new Map());
    }
  }, [isAudioConnected]);

  // Update chat messages with real-time transcriptions
  useEffect(() => {
    if (!isAudioConnected) return;

    // Store agent transcripts in Map
    agentTranscriptions?.forEach((segment) => {
      const existingMsg = transcripts.get(segment.id);
      transcripts.set(segment.id, {
        id: segment.id,
        sender: 'Agent',
        text: segment.final ? segment.text : `${segment.text} ...`,
        timestamp: existingMsg?.timestamp ?? segment.firstReceivedTime,
        isLocal: false,
        type: 'agent',
      });
    });

    // Store user transcripts in Map
    userTranscriptions?.forEach((segment) => {
      const existingMsg = transcripts.get(segment.id);
      transcripts.set(segment.id, {
        id: segment.id,
        sender: username || 'You',
        text: segment.final ? segment.text : `${segment.text} ...`,
        timestamp: existingMsg?.timestamp ?? segment.firstReceivedTime,
        isLocal: true,
        type: 'user',
      });
    });

    // Convert Map to array and sort by timestamp
    const transcriptionMessages = Array.from(transcripts.values());
    transcriptionMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Keep system messages and add transcription messages
    setChatMessages(prev => {
      const systemMessages = prev.filter(msg => msg.type === 'system');
      return [...systemMessages, ...transcriptionMessages];
    });
  }, [agentTranscriptions, userTranscriptions, isAudioConnected, username, transcripts]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() === '' || !isAudioConnected) return;

    const newMessage: ChatMessage = {
      id: `manual-${Date.now()}`,
      sender: username,
      text: message,
      timestamp: Date.now(),
      isLocal: true,
      type: 'user',
    };

    setChatMessages((prev) => [...prev, newMessage]);
    setMessage('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const getMessageStyle = (msg: ChatMessage) => {
    switch (msg.type) {
      case 'agent':
        return 'bg-purple-100 text-purple-800';
      case 'user':
        return msg.isLocal ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800';
      case 'system':
        return 'bg-gray-50 text-gray-600 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSenderLabel = (msg: ChatMessage) => {
    switch (msg.type) {
      case 'agent':
        return 'Agent';
      case 'user':
        return msg.isLocal ? 'You' : msg.sender;
      case 'system':
        return 'System';
      default:
        return msg.sender;
    }
  };

  return (
    <>
      {/* Fixed Height Chat Section with Internal Scrolling */}
      {isAudioConnected && (
        <div className="flex flex-col border-t border-gray-200 pt-4" style={{ height: '300px' }}>
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex-shrink-0">Live Conversation</h3>
          
          {/* Fixed height scrollable chat container */}
          <div 
            className="flex-1 overflow-y-auto mb-3 space-y-2 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" 
            style={{ minHeight: '0', maxHeight: '200px' }}
          >
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'system' ? 'justify-center' : msg.isLocal ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs rounded-lg px-3 py-2 text-sm ${getMessageStyle(msg)} ${
                    msg.type === 'system' ? 'text-center text-xs' : ''
                  }`}
                >
                  {msg.type !== 'system' && !msg.isLocal && (
                    <div className="font-semibold text-xs mb-1">
                      {getSenderLabel(msg)}
                    </div>
                  )}
                  <div className={msg.type === 'system' ? 'text-xs' : ''}>{msg.text}</div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.type === 'agent' ? 'text-purple-600' :
                      msg.isLocal ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Fixed message input at bottom */}
          <form onSubmit={handleSendMessage} className="flex space-x-2 flex-shrink-0">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              disabled={!isAudioConnected}
            />
            <button
              type="submit"
              disabled={!isAudioConnected || message.trim() === ''}
              className={`p-2 rounded-md ${
                !isAudioConnected || message.trim() === ''
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200 flex-shrink-0">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Active Components</h3>
        <div className="space-y-2">
          <div className="bg-blue-50 p-2 rounded text-sm text-blue-700 flex items-center justify-between">
            <span>LiveKit Audio</span>
            <span className={`w-2 h-2 rounded-full ${
              isAudioConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}></span>
          </div>
          {isAudioConnected && (
            <div className="bg-purple-50 p-2 rounded text-sm text-purple-700 flex items-center justify-between">
              <span>Voice Assistant</span>
              <span className={`w-2 h-2 rounded-full ${
                state === 'listening' || state === 'thinking' || state === 'speaking' ? 'bg-green-500' : 'bg-yellow-500'
              }`}></span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const PlaygroundPanel: React.FC<PlaygroundPanelProps> = ({
  liveKitOnWorkspace,
  username,
  setUsername,
  isAudioConnected,
  isMuted,
  audioControlsToggle,
  connectAudio,
  disconnectAudio,
  resetFlow,
}) => {
  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Playground</h2>
        </div>

        {liveKitOnWorkspace ? (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-4 flex-shrink-0">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Audio Connection</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={isAudioConnected}
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      isAudioConnected ? disconnectAudio() : connectAudio();
                    }}
                    className={`px-3 py-2 text-sm rounded-md font-medium ${
                      isAudioConnected
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isAudioConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isAudioConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {isAudioConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-1 h-10">
                    {isAudioConnected ? (
                      <div></div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        Audio disconnected
                      </div>
                    )}
                  </div>
                  <div className="text-center ml-4">
                    <Mic className={`w-8 h-8 mx-auto mb-2 ${isMuted ? 'text-red-400' : 'text-green-400'}`} />
                    <p className="text-sm text-gray-600">
                      {isMuted ? 'Muted' : isAudioConnected ? 'Listening...' : 'Not connected'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={audioControlsToggle || (() => {})}
                  disabled={!isAudioConnected}
                  className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium mt-3 ${
                    !isAudioConnected 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isMuted 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Unmute</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Mute</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Only render LiveKit-dependent components when connected */}
            {isAudioConnected && (
              <LiveKitConnectedPanel
                username={username}
                isAudioConnected={isAudioConnected}
                isMuted={isMuted}
                audioControlsToggle={audioControlsToggle}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Mic className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-sm text-gray-500">Drag LiveKit component to workspace to enable audio controls</p>
          </div>
        )}

        <button 
          onClick={(e) => {
            e.preventDefault();
            resetFlow();
          }}
          className="w-full text-blue-600 hover:text-blue-700 text-sm py-2 border-t border-gray-200 mt-6 font-medium flex-shrink-0"
        >
          Reset Flow
        </button>
      </div>
    </div>
  );
};

export default PlaygroundPanel;