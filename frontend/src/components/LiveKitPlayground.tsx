import React, { useState, useEffect, useRef } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  TranscriptionSegment,
} from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, Settings } from 'lucide-react';

interface ParticipantInfo {
  identity: string;
  videoTrack: HTMLVideoElement | null;
  audioTrack: MediaStreamTrack | null;
  isLocal: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

interface ChatMessage {
  id: string;
  name: string;
  message: string;
  timestamp: number;
  isSelf: boolean;
  isTranscription?: boolean;
}

export const LiveKitPlayground: React.FC = () => {
  const [username, setUsername] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [participants, setParticipants] = useState<Map<string, ParticipantInfo>>(new Map());
  const [currentMessage, setCurrentMessage] = useState('');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<Map<string, ChatMessage>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const roomRef = useRef<Room | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Audio visualization functions
  const setupAudioVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      
      startAudioVisualization();
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
    }
  };

  const startAudioVisualization = () => {
    if (!analyserRef.current) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateVisualization = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setIsUserSpeaking(average > 10); // Threshold for speaking detection
      
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };
    
    updateVisualization();
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  // Chat functions
  const sendMessage = async () => {
    if (!currentMessage.trim() || !roomRef.current) return;
    
    try {
      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'chat',
          message: currentMessage.trim(),
        })),
        {
          reliable: true,
        }
      );
      
      // Add message to local messages immediately
      const newMessage: ChatMessage = {
        id: `chat-${Date.now()}`,
        name: 'You',
        message: currentMessage.trim(),
        timestamp: Date.now(),
        isSelf: true,
        isTranscription: false,
      };
      setMessages(prev => [...prev, newMessage]);
      setCurrentMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Monitor agent audio for speaking detection
  const monitorAgentAudio = (track: any) => {
    if (!track || !track.mediaStreamTrack) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      
      // Check if the track has a MediaStream
      if (track.mediaStreamTrack instanceof MediaStreamTrack) {
        const stream = new MediaStream([track.mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const checkAgentAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setIsAgentSpeaking(average > 5); // Lower threshold for agent detection
          requestAnimationFrame(checkAgentAudio);
        };
        
        checkAgentAudio();
      }
    } catch (error) {
      console.error('Error monitoring agent audio:', error);
    }
  };


  // Convert transcripts Map to sorted messages array
  useEffect(() => {
    const allMessages = Array.from(transcripts.values());
    allMessages.sort((a, b) => a.timestamp - b.timestamp);
    setMessages(allMessages);
  }, [transcripts]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);


  const updateParticipants = () => {
    const room = roomRef.current;
    if (!room) return;

    const newParticipants = new Map<string, ParticipantInfo>();

    const localParticipant = room.localParticipant;
    if (localParticipant) {
      // Get video and audio tracks using the correct API
      const videoPublication = localParticipant.getTrackPublication(Track.Source.Camera);
      const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);

      newParticipants.set(localParticipant.identity, {
        identity: localParticipant.identity,
        videoTrack: null,
        audioTrack: audioPublication?.track?.mediaStreamTrack || null,
        isLocal: true,
        videoEnabled: videoPublication?.isMuted === false,
        audioEnabled: audioPublication?.isMuted === false,
      });
    }

    // Safely iterate through remote participants
    if (room.remoteParticipants) {
      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        const videoPublication = participant.getTrackPublication(Track.Source.Camera);
        const audioPublication = participant.getTrackPublication(Track.Source.Microphone);

        newParticipants.set(participant.identity, {
          identity: participant.identity,
          videoTrack: null,
          audioTrack: audioPublication?.track?.mediaStreamTrack || null,
          isLocal: false,
          videoEnabled: videoPublication?.isMuted === false,
          audioEnabled: audioPublication?.isMuted === false,
        });
      });
    }

    setParticipants(newParticipants);
  };

  const attachTrack = (
    track: any,
    element: HTMLVideoElement | HTMLAudioElement
  ) => {
    track.attach(element);
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      
      // Clear any pending operations on unmount
    };
  }, []);

  const handleJoinRoom = async () => {
    if (!username.trim() || !roomName.trim()) {
      alert('Please enter both username and room name');
      return;
    }

    setIsConnecting(true);

    try {
      // Get token from your backend server
      const response = await fetch(`https://liveconnect-studio.fly.dev/api/v1/livekit_ms/processor/getToken?name=${encodeURIComponent(username.trim())}&room=${encodeURIComponent(roomName.trim())}&nodeId=default-node`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get token');
      }

      const responseData = await response.json();
      const { token, serverUrl } = responseData.data;

      const room = new Room();
      roomRef.current = room;

      room
        .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          console.log('Track subscribed:', track.kind);
          
          // Handle audio track for agent speech
          if (track.kind === Track.Kind.Audio && participant && !participant.isLocal) {
            if (remoteAudioRef.current) {
              track.attach(remoteAudioRef.current);
              // Monitor agent audio for speaking detection
              monitorAgentAudio(track);
            }
          }
          
          updateParticipants();
        })
        .on(RoomEvent.TrackUnsubscribed, (track, _publication, _participant) => {
          console.log('Track unsubscribed:', track.kind);
          updateParticipants();
        })
        .on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('Participant connected:', participant.identity);
          updateParticipants();
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('Participant disconnected:', participant.identity);
          updateParticipants();
        })
        .on(RoomEvent.LocalTrackPublished, (publication) => {
          console.log('Local track published:', publication.kind);
          
          // Auto-attach video track when published
          if (publication.kind === Track.Kind.Video && publication.track && localVideoRef.current) {
            console.log('Auto-attaching video track');
            attachTrack(publication.track, localVideoRef.current);
          }
          
          updateParticipants();
        })
        .on(RoomEvent.LocalTrackUnpublished, (publication) => {
          console.log('Local track unpublished:', publication.kind);
          
          // Auto-detach video track when unpublished
          if (publication.kind === Track.Kind.Video && localVideoRef.current) {
            console.log('Auto-detaching video track');
            localVideoRef.current.srcObject = null;
          }
          
          updateParticipants();
        })
        .on(RoomEvent.DataReceived, (payload, participant) => {
          if (!participant || participant.isLocal) return;
          
          try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            if (data.type === 'message') {
              const message: ChatMessage = {
                id: Date.now().toString(),
                name: 'Agent',
                message: data.message || data.content,
                timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
                isSelf: false,
                isTranscription: false,
              };
              setMessages(prev => [...prev, message]);
            } else if (data.type === 'chat') {
              const message: ChatMessage = {
                id: Date.now().toString(),
                name: 'Agent',
                message: data.message,
                timestamp: Date.now(),
                isSelf: false,
                isTranscription: false,
              };
              setMessages(prev => [...prev, message]);
            }
          } catch (error) {
            console.error('Error parsing data message:', error);
          }
        })
        .on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant, publication) => {
          console.log('Transcription received:', segments, 'from:', participant?.identity);
          
          setTranscripts(prevTranscripts => {
            const newTranscripts = new Map(prevTranscripts);
            
            segments.forEach((segment) => {
              const isLocal = participant?.identity === room.localParticipant.identity;
              const existingMsg = newTranscripts.get(segment.id);
              
              const message: ChatMessage = {
                id: segment.id,
                name: isLocal ? 'You' : 'Agent',
                message: segment.final ? segment.text : `${segment.text} ...`,
                timestamp: existingMsg?.timestamp ?? Date.now(),
                isSelf: isLocal,
                isTranscription: true,
              };
              
              newTranscripts.set(segment.id, message);
            });
            
            return newTranscripts;
          });
        })
        .on(RoomEvent.Disconnected, (reason) => {
          console.log('Room disconnected:', reason);
          setIsConnected(false);
          setParticipants(new Map());
          setMessages([]);
          setMessages([]);
          setTranscripts(new Map());
          stopAudioVisualization();
        })
        .on(RoomEvent.Connected, () => {
          console.log('Room connected successfully');
        });

      console.log('Connecting to room:', serverUrl);
      await room.connect(serverUrl, token, {
        autoSubscribe: true,
      });
      console.log('Connected to room successfully');

      console.log('Enabling camera and microphone...');
      await room.localParticipant.enableCameraAndMicrophone();
      console.log('Camera and microphone enabled');

      // Note: Transcription will be handled by the backend agent
      console.log('Room setup complete - transcription handled by backend');

      // Safely get video track
      const videoPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (videoPublication && videoPublication.track && localVideoRef.current) {
        console.log('Attaching video track to local video element');
        attachTrack(videoPublication.track, localVideoRef.current);
      }

      // Setup audio visualization
      await setupAudioVisualization();

      // Note: User transcription will be handled by the backend agent
      // The backend will send user transcriptions through the same TranscriptionReceived event

      setIsConnected(true);
      updateParticipants();
      
      // Add system message when connected
      setMessages([
        {
          id: 'system-1',
          name: 'System',
          message: 'You joined the voice chat',
          timestamp: Date.now(),
          isSelf: false,
          isTranscription: false,
        },
      ]);
      
      console.log('Room setup complete');
    } catch (error) {
      console.error('Error joining room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      alert(`Failed to join room: ${errorMessage}. Please check your configuration and console for details.`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveRoom = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
    setParticipants(new Map());
    setMessages([]);
    setTranscripts(new Map());
    
    stopAudioVisualization();
  };

  const toggleMic = () => {
    if (roomRef.current) {
      roomRef.current.localParticipant.setMicrophoneEnabled(!isMicEnabled);
      setIsMicEnabled(!isMicEnabled);
      updateParticipants();
    }
  };

  const toggleCamera = () => {
    if (roomRef.current) {
      roomRef.current.localParticipant.setCameraEnabled(!isCameraEnabled);
      setIsCameraEnabled(!isCameraEnabled);
      updateParticipants();
    }
  };

  const debugVideoTrack = () => {
    if (!roomRef.current) {
      console.log('No room available');
      return;
    }
    
    const localParticipant = roomRef.current.localParticipant;
    console.log('Local participant:', localParticipant);
    console.log('Camera enabled state:', isCameraEnabled);
    
    const videoPublication = localParticipant.getTrackPublication(Track.Source.Camera);
    console.log('Video publication:', videoPublication);
    
    if (videoPublication) {
      console.log('Video track:', videoPublication.track);
      console.log('Video muted:', videoPublication.isMuted);
      console.log('Video enabled:', videoPublication.isEnabled);
      
      if (videoPublication.track && localVideoRef.current) {
        console.log('Manually attaching video track');
        attachTrack(videoPublication.track, localVideoRef.current);
      }
    }
    
    console.log('Video element:', localVideoRef.current);
    console.log('Video element srcObject:', localVideoRef.current?.srcObject);
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl">
      {!isConnected ? (
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 max-w-md w-full">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">LiveConnect Playground</h2>
            
            <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Enter your username"
                disabled={isConnecting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Enter room name"
                disabled={isConnecting}
              />
          </div>
          <button
            onClick={handleJoinRoom}
            disabled={isConnecting}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Joining...' : 'Join Room'}
          </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-[800px] flex flex-col">
          {/* Header */}
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
            <div className="text-slate-300">
              <span className="font-semibold">Room:</span> {roomName} |
              <span className="font-semibold ml-2">User:</span> {username}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-400">Settings</span>
              </div>
              <button
                onClick={handleLeaveRoom}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex">
            {/* Left Side - Video, Audio, and Chat */}
            <div className="flex-1 p-6 space-y-6">
              {/* Video Section */}
              <div className="bg-slate-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">VIDEO</h3>
                  <button 
                    onClick={debugVideoTrack}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Debug Video
                  </button>
                </div>
            <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 px-3 py-1 rounded text-white text-sm">
                {username} (You)
              </div>
              {!isCameraEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <VideoOff className="w-12 h-12 text-slate-600" />
                </div>
              )}
                </div>
              </div>

              {/* Audio Section */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">AUDIO</h3>
                <div className="flex items-center justify-center h-20 bg-slate-900 rounded-lg">
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-cyan-400 rounded-full transition-all duration-150 ${
                          isAgentSpeaking ? 'audio-bar h-8' : 'h-2'
                        }`}
                        style={{
                          animationDelay: `${i * 50}ms`,
                          height: isAgentSpeaking ? `${Math.random() * 20 + 10}px` : '8px'
                        }}
                      />
                    ))}
                  </div>
                </div>
            </div>

              {/* Chat Section - Moved here from right sidebar */}
              <div className="bg-slate-800 rounded-lg p-4 flex flex-col" style={{ height: '400px' }}>
                <h3 className="text-lg font-semibold text-white mb-4 flex-shrink-0">CHAT</h3>
                <div className="bg-slate-900 rounded-lg p-4 overflow-y-auto flex-1" style={{ minHeight: '0' }}>
                  {messages.length === 0 ? (
                    <div className="text-slate-400 text-center py-8">
                      Start a conversation with the agent
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message, index, allMsg) => {
                        const hideName = index >= 1 && allMsg[index - 1].name === message.name;
                        
                        return (
                          <div
                            key={message.id}
                            className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-md px-4 py-3 rounded-lg ${
                                message.isSelf
                                  ? 'bg-cyan-500 text-white'
                                  : 'bg-slate-700 text-cyan-300'
                              } ${message.isTranscription ? 'opacity-90' : ''}`}
                            >
                              {!hideName && (
                                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                                  {message.name}
                                  {message.isTranscription && (
                                    <span className="text-sm opacity-75">🎤</span>
                                  )}
                                </div>
                              )}
                              <div className="text-base whitespace-pre-line">
                                {message.message}
                              </div>
                              <div
                                className={`text-sm mt-2 ${
                                  message.isSelf ? 'text-blue-100' : 'text-cyan-600'
                                }`}
                              >
                                {new Date(message.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>
                
                {/* Message Input */}
                <div className="mt-4 space-y-2">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-base"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!currentMessage.trim()}
                      className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition flex items-center gap-2 text-base"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-sm text-slate-400 text-center">
                    💡 For testing: Agent responses will appear here automatically when they speak
                  </div>
                </div>
              </div>

          </div>

            {/* Right Side - Controls Only */}
            <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
              {/* Controls Section */}
              <div className="p-6 space-y-6">
                {/* Screen Share */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">SCREEN</h4>
                  <button className="w-full bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-lg transition flex items-center justify-center gap-2">
                    <Video className="w-5 h-5" />
                    Press the button above to share your screen
                  </button>
                </div>

                {/* Camera */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">CAMERA</h4>
                  <div className="space-y-3">
                    <select className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white px-3 py-2 text-sm">
                      <option>HD Webcam</option>
                    </select>
                    <div className="bg-slate-900 rounded-lg h-24 flex items-center justify-center">
                      <Video className="w-10 h-10 text-slate-600" />
                    </div>
                    <button
                      onClick={toggleCamera}
                      className={`w-full p-3 rounded-lg transition ${
                        isCameraEnabled
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                    >
                      {isCameraEnabled ? <Video className="w-6 h-6 mx-auto" /> : <VideoOff className="w-6 h-6 mx-auto" />}
                    </button>
                  </div>
                </div>

                {/* Microphone */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">MICROPHONE</h4>
                  <div className="space-y-3">
                    <select className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white px-3 py-2 text-sm">
                      <option>Microphone</option>
                    </select>
                    <div className="bg-slate-900 rounded-lg h-16 flex items-center justify-center">
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: 12 }, (_, i) => (
                          <div
                            key={i}
                            className={`w-1 bg-cyan-400 rounded-full transition-all duration-150 ${
                              isUserSpeaking ? 'audio-bar h-6' : 'h-2'
                            }`}
                            style={{
                              animationDelay: `${i * 30}ms`,
                              height: isUserSpeaking ? `${Math.random() * 15 + 5}px` : '8px'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={toggleMic}
                      className={`w-full p-3 rounded-lg transition ${
                        isMicEnabled
                          ? 'bg-slate-700 hover:bg-slate-600 text-white'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                      }`}
                    >
                      {isMicEnabled ? <Mic className="w-6 h-6 mx-auto" /> : <MicOff className="w-6 h-6 mx-auto" />}
                    </button>
                  </div>
                </div>

                {/* Color Theme */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">COLOR</h4>
                  <div className="flex space-x-2">
                    {['#06b6d4', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'].map((color) => (
                      <div
                        key={color}
                        className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-600 hover:border-white transition"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden audio elements */}
      <audio ref={localAudioRef} autoPlay />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

