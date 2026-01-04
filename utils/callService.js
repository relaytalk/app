// /app/utils/callService.js - FINAL CLEAN VERSION
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
        this.audioBuffer = null; // For smoother audio playback

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
                this.peerConnection.addTrack(track, this.localStream);
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
                this.peerConnection.addTrack(track, this.localStream);
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

            // Update presence via RPC function
            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: this.userId,
                p_room_id: this.currentRoomId,
                p_status: status
            });

            if (error) {
                console.log("Note: Could not update call presence:", error.message);
            }
        } catch (error) {
            console.log("Presence update note:", error.message);
        }
    }

    async getLocalMedia(video = false) {
        try {
            // Use simple constraints for maximum compatibility
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: video ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                } : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            return stream;

        } catch (error) {
            console.error("❌ Microphone access denied:", error);

            let errorMessage = "Microphone access is required for calls. ";

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += "Please allow microphone access in your browser settings.";
            } else if (error.name === 'NotFoundError') {
                errorMessage += "No microphone found on your device.";
            } else if (error.name === 'NotReadableError') {
                errorMessage += "Microphone is in use by another application.";
            } else {
                errorMessage += error.message;
            }

            this.showPermissionError(errorMessage);
            throw new Error(errorMessage);
        }
    }

    showPermissionError(message) {
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
                this.sendIceCandidate(event.candidate);
            }
        };

        // Remote stream with buffering for smoother audio
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            
            // Create buffered audio context for smoother playback
            if (event.track.kind === 'audio') {
                this.setupAudioBuffering();
            }
            
            if (this.onRemoteStream) {
                this.onRemoteStream(this.remoteStream);
            }
        };

        // Connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;

            if (state === 'connected') {
                this.updateState('active');
                this.callStartTime = Date.now();
            } else if (state === 'disconnected' || state === 'failed') {
                this.endCall();
            }
        };

        // ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            if (state === 'failed') {
                this.endCall();
            }
        };
    }

    setupAudioBuffering() {
        // This helps with audio cutting by creating a small buffer
        if (!this.audioBuffer && this.remoteStream) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(this.remoteStream);
            
            // Create a small delay node (300ms buffer)
            const delayNode = audioContext.createDelay(0.3); // 300ms buffer
            delayNode.delayTime.value = 0.3;
            
            // Connect source -> delay -> destination
            source.connect(delayNode);
            delayNode.connect(audioContext.destination);
            
            this.audioBuffer = { audioContext, source, delayNode };
            
            console.log("✅ Audio buffering enabled (300ms delay)");
        }
    }

    async sendIceCandidate(candidate) {
        if (!this.currentCall) return;

        const receiverId = this.isCaller ? 
            this.currentCall.receiver_id : 
            this.currentCall.caller_id;

        try {
            await supabase
                .channel(`call-${this.currentCall.room_id}`)
                .httpSend({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: {
                        callId: this.currentCall.id,
                        candidate: candidate.toJSON(),
                        senderId: this.userId,
                        receiverId: receiverId
                    }
                });
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
            if (senderId !== this.userId && this.peerConnection) {
                try {
                    await this.peerConnection.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );
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

            // Caller receives answer
            if (this.isCaller && call.sdp_answer) {
                try {
                    const answer = JSON.parse(call.sdp_answer);
                    await this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                    this.updateState('active');
                } catch (error) {
                    console.log("Failed to set answer:", error);
                }
            }

            // Call ended
            if (call.status === 'ended' || call.status === 'rejected') {
                this.endCall();
            }
        });

        channel.subscribe();
    }

    async endCall() {
        console.log("📞 Ending call...");

        if (this.currentCall) {
            try {
                const duration = this.callStartTime ? 
                    Math.floor((Date.now() - this.callStartTime) / 1000) : 0;

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
                    this.onCallEvent('call_ended', { duration });
                }

            } catch (error) {
                console.error("Error ending call:", error);
            }
        }

        this.cleanup();
    }

    async toggleMute() {
        if (!this.localStream) return false;

        const audioTracks = this.localStream.getAudioTracks();
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;

        audioTracks.forEach(track => {
            track.enabled = newState;
        });

        return newState;
    }

    updateState(state) {
        console.log("📞 Call state changed:", state);
        this.callState = state;
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
    }

    cleanup() {
        console.log("🧹 Cleaning up call...");

        // Clean up audio buffer
        if (this.audioBuffer) {
            try {
                this.audioBuffer.source.disconnect();
                this.audioBuffer.audioContext.close();
            } catch (error) {
                console.log("Error closing audio context:", error);
            }
            this.audioBuffer = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        this.currentCall = null;
        this.currentRoomId = null;
        this.callState = 'idle';
        this.callStartTime = null;
        this.isCaller = false;
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