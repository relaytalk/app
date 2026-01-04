// /app/utils/callService.js - COMPLETE FIXED VERSION
import { supabase } from './supabase.js';

class CallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.isCaller = false;
        this.userId = null;
        this.currentRoomId = null;

        this.callState = 'idle';
        this.callStartTime = null;

        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ];

        this.onCallStateChange = null;
        this.onRemoteStream = null;
        this.onCallEvent = null;
    }

    async initialize(userId) {
        this.userId = userId;
        console.log("📞 CallService initialized for user:", userId);
        return true;
    }

    async initiateCall(friendId, type = 'voice') {
        try {
            this.isCaller = true;

            // 1. Create call record
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.currentRoomId = roomId;

            console.log("📞 Creating call record...");
            const { data: call, error } = await supabase
                .from('calls')
                .insert({
                    room_id: roomId,
                    caller_id: this.userId,
                    receiver_id: friendId,
                    call_type: type,
                    status: 'ringing',
                    initiated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            this.currentCall = call;

            // 2. Update presence to 'in-call'
            await this.updateCallPresence('in-call');

            // 3. Get user media with error handling
            console.log("🎤 Requesting microphone...");
            this.localStream = await this.getLocalMedia(type === 'video');

            // 4. Create peer connection
            console.log("🔗 Creating peer connection...");
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers,
                iceTransportPolicy: 'all'
            });

            // 5. Add local tracks
            this.localStream.getTracks().forEach(track => {
                const newTrack = this.peerConnection.addTrack(track, this.localStream);
                console.log(`✅ Added ${track.kind} track:`, {
                    trackId: newTrack ? newTrack.id : 'unknown',
                    enabled: track.enabled,
                    label: track.label || 'default'
                });
            });

            // 6. Setup event handlers
            this.setupPeerConnection();

            // 7. Create offer
            console.log("📤 Creating offer...");
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video'
            });

            await this.peerConnection.setLocalDescription(offer);

            // 8. Save offer to DB
            await supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id);

            // 9. Listen for answer
            this.listenForAnswer();

            // 10. Update state
            this.updateState('ringing');

            console.log("✅ Call initiated successfully");
            return call;

        } catch (error) {
            console.error("❌ Initiate call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async answerCall(callId) {
        try {
            this.isCaller = false;

            // 1. Get call data
            console.log("📞 Getting call data...");
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) throw error;
            this.currentCall = call;
            this.currentRoomId = call.room_id;

            // 2. Update presence to 'in-call'
            await this.updateCallPresence('in-call');

            // 3. Get user media
            console.log("🎤 Requesting microphone...");
            this.localStream = await this.getLocalMedia(call.call_type === 'video');

            // 4. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers,
                iceTransportPolicy: 'all'
            });

            // 5. Add local tracks
            this.localStream.getTracks().forEach(track => {
                const newTrack = this.peerConnection.addTrack(track, this.localStream);
                console.log(`✅ Added ${track.kind} track:`, {
                    trackId: newTrack ? newTrack.id : 'unknown',
                    enabled: track.enabled,
                    label: track.label || 'default'
                });
            });

            // 6. Setup event handlers
            this.setupPeerConnection();

            // 7. Set remote offer
            const offer = JSON.parse(call.sdp_offer);
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            // 8. Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // 9. Save answer to DB
            await supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);

            // 10. Listen for ICE candidates
            this.listenForAnswer();

            // 11. Update state
            this.updateState('active');

            return true;

        } catch (error) {
            console.error("❌ Answer call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async updateCallPresence(status) {
        try {
            if (!this.userId || !this.currentRoomId) return;

            console.log(`👁️ Updating call presence: ${status}`);

            // Update presence via RPC function
            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: this.userId,
                p_room_id: this.currentRoomId,
                p_status: status
            });

            if (error) {
                console.log("Note: Could not update call presence via function:", error.message);
            }
        } catch (error) {
            console.log("Presence update note:", error.message);
        }
    }

    async getLocalMedia(video = false) {
        try {
            console.log("🎤 Requesting microphone permission...");

            // List available devices first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            console.log("Available audio devices:", audioDevices.map(d => d.label || 'Unnamed'));

            // Use simple constraints for maximum compatibility
            const constraints = {
                audio: {
                    echoCancellation: { ideal: true },
                    noiseSuppression: { ideal: true },
                    autoGainControl: { ideal: true },
                    channelCount: { ideal: 1 },
                    sampleRate: { ideal: 48000 }
                },
                video: video ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                } : false
            };

            console.log("Using media constraints:", JSON.stringify(constraints, null, 2));
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Verify stream has audio
            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();
            
            console.log("✅ Media stream obtained:");
            console.log(`   Audio tracks: ${audioTracks.length}`);
            console.log(`   Video tracks: ${videoTracks.length}`);
            
            audioTracks.forEach((track, i) => {
                console.log(`   Audio track ${i}:`, {
                    id: track.id.substring(0, 10) + '...',
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState,
                    label: track.label || 'default'
                });
                
                // Monitor track events
                track.onmute = () => console.log(`Audio track ${i} muted`);
                track.onunmute = () => console.log(`Audio track ${i} unmuted`);
                track.onended = () => console.log(`Audio track ${i} ended`);
            });

            return stream;

        } catch (error) {
            console.error("❌ Microphone access denied:", error);
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                constraint: error.constraintName
            });

            let errorMessage = "Microphone access is required for calls. ";

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += "Please allow microphone access in your browser settings.";
            } else if (error.name === 'NotFoundError') {
                errorMessage += "No microphone found on your device.";
            } else if (error.name === 'NotReadableError') {
                errorMessage += "Microphone is in use by another application.";
            } else if (error.name === 'OverconstrainedError') {
                errorMessage += `Cannot use requested microphone settings: ${error.constraintName}`;
            } else {
                errorMessage += error.message;
            }

            this.showPermissionError(errorMessage);
            throw new Error(errorMessage);
        }
    }

    showPermissionError(message) {
        // Remove existing error if any
        const existing = document.getElementById('callPermissionError');
        if (existing) existing.remove();

        const errorDiv = document.createElement('div');
        errorDiv.id = 'callPermissionError';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(26, 26, 46, 0.95);
            border: 1px solid #ff3b30;
            border-radius: 20px;
            padding: 30px;
            color: white;
            z-index: 99999;
            max-width: 400px;
            text-align: center;
            backdrop-filter: blur(20px);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        `;

        errorDiv.innerHTML = `
            <h3 style="color: #ff3b30; margin-bottom: 15px;">⚠️ Microphone Required</h3>
            <p style="color: #a0a0c0; margin-bottom: 20px;">${message}</p>
            <button onclick="this.parentElement.remove();" 
                    style="padding: 12px 25px; background: #667eea; color: white; 
                           border: none; border-radius: 10px; cursor: pointer;">
                OK
            </button>
        `;

        document.body.appendChild(errorDiv);
    }

    setupPeerConnection() {
        // ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                console.log("🧊 Generated ICE candidate:", event.candidate.type);
                this.sendIceCandidate(event.candidate);
            } else if (!event.candidate) {
                console.log("🧊 ICE gathering complete");
            }
        };

        // Remote stream - FIXED AUDIO HANDLING
        this.peerConnection.ontrack = (event) => {
            console.log("🎯 WebRTC Track Received:", {
                kind: event.track.kind,
                trackId: event.track.id.substring(0, 10) + '...',
                streamId: event.streams[0]?.id?.substring(0, 10) + '...'
            });

            // Create new stream if needed
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
                console.log("📡 Created new remote media stream");
            }

            // Add the track to our stream
            this.remoteStream.addTrack(event.track);
            console.log(`✅ Added ${event.track.kind} track to remote stream`);

            // Handle audio tracks specifically
            if (event.track.kind === 'audio') {
                console.log("🔊 Audio track details:", {
                    enabled: event.track.enabled,
                    muted: event.track.muted,
                    readyState: event.track.readyState,
                    label: event.track.label || 'default'
                });

                // Ensure audio track is enabled
                event.track.enabled = true;

                // Monitor audio track events
                event.track.onmute = () => {
                    console.log("🔇 Remote audio track muted");
                    if (this.onCallEvent) {
                        this.onCallEvent('audio_muted', { track: event.track });
                    }
                };

                event.track.onunmute = () => {
                    console.log("🔊 Remote audio track unmuted");
                    if (this.onCallEvent) {
                        this.onCallEvent('audio_unmuted', { track: event.track });
                    }
                };

                event.track.onended = () => {
                    console.log("⏹️ Remote audio track ended");
                    if (this.onCallEvent) {
                        this.onCallEvent('audio_ended', { track: event.track });
                    }
                };
            }

            // Notify about the updated stream
            if (this.onRemoteStream && this.remoteStream.active) {
                // Clone the stream to ensure we have the latest version
                const streamClone = new MediaStream();
                this.remoteStream.getTracks().forEach(track => {
                    streamClone.addTrack(track);
                });
                
                // Send the cloned stream
                setTimeout(() => {
                    this.onRemoteStream(streamClone);
                }, 100);
            }
        };

        // Connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("🔗 Peer connection state:", state);

            if (state === 'connected') {
                console.log("✅ WebRTC connection established!");
                this.updateState('active');
                this.callStartTime = Date.now();
                
                // Log connection statistics
                setTimeout(() => this.logConnectionStats(), 1000);
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                console.log("❌ WebRTC connection lost:", state);
                this.endCall();
            }
        };

        // ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log("🧊 ICE connection state:", state);
            
            if (state === 'connected' || state === 'completed') {
                console.log("✅ ICE connection successful");
            } else if (state === 'failed' || state === 'disconnected') {
                console.log("❌ ICE connection failed");
                this.endCall();
            }
        };

        // ICE gathering state
        this.peerConnection.onicegatheringstatechange = () => {
            console.log("🧊 ICE gathering state:", this.peerConnection.iceGatheringState);
        };

        // Signaling state
        this.peerConnection.onsignalingstatechange = () => {
            console.log("📡 Signaling state:", this.peerConnection.signalingState);
        };
    }

    async logConnectionStats() {
        if (!this.peerConnection) return;
        
        try {
            const stats = await this.peerConnection.getStats();
            console.log("📊 WebRTC Connection Statistics:");
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    console.log("🎵 Inbound Audio Stats:", {
                        packetsReceived: report.packetsReceived,
                        bytesReceived: report.bytesReceived,
                        jitter: report.jitter,
                        packetsLost: report.packetsLost
                    });
                }
            });
        } catch (error) {
            console.log("Could not get connection stats:", error);
        }
    }

    async sendIceCandidate(candidate) {
        if (!this.currentCall) return;

        const receiverId = this.isCaller ? 
            this.currentCall.receiver_id : 
            this.currentCall.caller_id;

        try {
            // Use httpSend() instead of send()
            await supabase
                .channel(`call-${this.currentCall.room_id}`)
                .httpSend({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: {
                        callId: this.currentCall.id,
                        candidate: candidate.toJSON(),
                        senderId: this.userId,
                        receiverId: receiverId,
                        timestamp: Date.now()
                    }
                });
            console.log("📨 Sent ICE candidate to:", receiverId.substring(0, 8) + '...');
        } catch (error) {
            console.log("Failed to send ICE candidate:", error);
        }
    }

    listenForAnswer() {
        if (!this.currentCall) return;

        const channel = supabase.channel(`call-${this.currentCall.room_id}`);

        // Listen for ICE candidates
        channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
            const { candidate, senderId } = payload.payload;
            
            // Only process if from the other party
            if (senderId !== this.userId && this.peerConnection) {
                console.log("📨 Received ICE candidate from:", senderId.substring(0, 8) + '...');
                try {
                    await this.peerConnection.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );
                    console.log("✅ Added ICE candidate");
                } catch (error) {
                    console.log("Failed to add ICE candidate:", error);
                }
            }
        });

        // Listen for call updates
        channel.on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${this.currentCall.id}`
        }, async (payload) => {
            const call = payload.new;
            console.log("📞 Call update received:", {
                status: call.status,
                hasAnswer: !!call.sdp_answer
            });

            // Caller receives answer
            if (this.isCaller && call.sdp_answer) {
                try {
                    const answer = JSON.parse(call.sdp_answer);
                    console.log("📥 Setting remote description from answer");
                    await this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                    this.updateState('active');
                } catch (error) {
                    console.log("Failed to set answer:", error);
                }
            }

            // Call ended or rejected
            if (call.status === 'ended' || call.status === 'rejected') {
                console.log("📞 Call ended remotely");
                this.endCall();
            }
        });

        channel.subscribe();
        console.log("👂 Listening for call updates on channel:", `call-${this.currentCall.room_id}`);
    }

    async endCall() {
        console.log("📞 Ending call...");

        if (this.currentCall) {
            try {
                const duration = this.callStartTime ? 
                    Math.floor((Date.now() - this.callStartTime) / 1000) : 0;

                console.log("💾 Saving call end to database...");
                await supabase
                    .from('calls')
                    .update({
                        status: 'ended',
                        ended_at: new Date().toISOString(),
                        duration: duration,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentCall.id);

                // Update presence back to online
                await this.updateCallPresence('online');

                if (this.onCallEvent) {
                    this.onCallEvent('call_ended', { 
                        duration,
                        callId: this.currentCall.id 
                    });
                }

                console.log("✅ Call ended successfully, duration:", duration, "seconds");

            } catch (error) {
                console.error("Error ending call:", error);
            }
        }

        this.cleanup();
    }

    async toggleMute() {
        if (!this.localStream) return false;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.log("❌ No audio tracks to mute");
            return false;
        }
        
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;

        audioTracks.forEach(track => {
            track.enabled = newState;
        });

        console.log("🎤 Microphone", newState ? "🔊 unmuted" : "🔇 muted");
        
        // Notify about mute state change
        if (this.onCallEvent) {
            this.onCallEvent('local_audio_toggled', { muted: !newState });
        }
        
        return newState; // Returns true if unmuted, false if muted
    }

    updateState(state) {
        console.log("📞 Call state changed:", state);
        this.callState = state;
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
    }

    cleanup() {
        console.log("🧹 Cleaning up call resources...");

        // Close peer connection
        if (this.peerConnection) {
            console.log("🔌 Closing peer connection");
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Stop local stream tracks
        if (this.localStream) {
            console.log("⏹️ Stopping local stream");
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`   Stopped ${track.kind} track`);
            });
            this.localStream = null;
        }

        // Stop remote stream tracks
        if (this.remoteStream) {
            console.log("⏹️ Stopping remote stream");
            this.remoteStream.getTracks().forEach(track => {
                track.stop();
                console.log(`   Stopped remote ${track.kind} track`);
            });
            this.remoteStream = null;
        }

        // Reset state
        this.currentCall = null;
        this.currentRoomId = null;
        this.callState = 'idle';
        this.callStartTime = null;
        this.isCaller = false;
        
        console.log("✅ Cleanup complete");
    }

    setOnCallStateChange(callback) { 
        this.onCallStateChange = callback; 
    }

    setOnRemoteStream(callback) { 
        this.onRemoteStream = callback; 
    }

    setOnCallEvent(callback) { 
        this.onCallEvent = callback; 
    }
}

const callService = new CallService();
export default callService;