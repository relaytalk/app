// /app/utils/callService.js - COMPLETE WORKING VERSION
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
        this.speakerMode = false; // false = earpiece, true = loudspeaker
        this.isInCall = false;
        
        this.callState = 'idle';
        this.callStartTime = null;
        
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        
        this.onCallStateChange = null;
        this.onRemoteStream = null;
        this.onCallEvent = null;
        this.onSpeakerModeChange = null;
    }

    async initialize(userId) {
        this.userId = userId;
        console.log("📞 CallService initialized for user:", userId);
        return true;
    }

    async initiateCall(friendId, type = 'voice') {
        try {
            console.log("🚀 Starting call to:", friendId);
            
            this.isCaller = true;
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.currentRoomId = roomId;
            
            console.log("📝 Creating call in database...");
            
            const { data: call, error } = await supabase
                .from('calls')
                .insert({
                    room_id: roomId,
                    caller_id: this.userId,
                    receiver_id: friendId,
                    call_type: type,
                    status: 'ringing',
                    audio_mode: 'mic', // Default to microphone mode
                    initiated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error("❌ Database error:", error);
                throw error;
            }
            
            this.currentCall = call;
            console.log("✅ Call created with ID:", call.id);

            // Get microphone stream
            await this.getLocalMedia();

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

            // Add microphone track
            if (this.localStream && this.localStream.getAudioTracks().length > 0) {
                this.localStream.getAudioTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
                console.log("🎤 Added microphone track to peer connection");
            }

            // Setup event handlers
            this.setupPeerConnection();

            // Create and save offer
            console.log("📨 Creating SDP offer...");
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video'
            });
            await this.peerConnection.setLocalDescription(offer);

            console.log("💾 Saving SDP offer to database...");
            await supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id);

            // Listen for answer
            this.listenForAnswer();
            
            this.isInCall = true;
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
            console.log("📞 Answering call:", callId);
            
            this.isCaller = false;

            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) throw error;
            
            this.currentCall = call;
            this.currentRoomId = call.room_id;
            console.log("✅ Call found:", call.id);

            // Get microphone stream
            await this.getLocalMedia();

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

            // Add microphone track
            if (this.localStream && this.localStream.getAudioTracks().length > 0) {
                this.localStream.getAudioTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
                console.log("🎤 Added microphone track to peer connection");
            }

            // Setup event handlers
            this.setupPeerConnection();

            // Set remote offer
            console.log("📥 Setting remote description...");
            if (!call.sdp_offer) {
                throw new Error("No SDP offer found in call");
            }
            
            const offer = JSON.parse(call.sdp_offer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Create and save answer
            console.log("📤 Creating SDP answer...");
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            console.log("💾 Saving SDP answer to database...");
            await supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    audio_mode: this.speakerMode ? 'speaker' : 'mic',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);

            // Listen for connection updates
            this.listenForAnswer();
            
            this.isInCall = true;
            this.updateState('active');
            this.callStartTime = Date.now();
            
            console.log("✅ Call answered successfully");
            return true;

        } catch (error) {
            console.error("❌ Answer call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async getLocalMedia() {
        try {
            // Clean up existing stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            console.log("🎤 Requesting microphone access...");
            
            // Always get microphone - speaker mode only affects OUTPUT
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            console.log("✅ Microphone access granted");

        } catch (error) {
            console.error("❌ Error getting microphone:", error.name, error.message);
            
            // Show user-friendly error
            if (error.name === 'NotAllowedError') {
                throw new Error("Microphone access denied. Please allow microphone permissions.");
            } else if (error.name === 'NotFoundError') {
                throw new Error("No microphone found on this device.");
            } else {
                throw error;
            }
        }
    }

    setupPeerConnection() {
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.sendIceCandidate(event.candidate);
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log("🔊 Received remote audio stream");
            this.remoteStream = event.streams[0];

            if (this.onRemoteStream) {
                this.onRemoteStream(this.remoteStream);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("🔗 Connection state:", state);

            if (state === 'connected') {
                this.updateState('active');
                this.callStartTime = Date.now();
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                console.log("🔌 Connection lost, ending call");
                this.endCall();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log("🧊 ICE connection state:", this.peerConnection.iceConnectionState);
        };
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
            console.log("⚠️ Failed to send ICE candidate:", error);
        }
    }

    listenForAnswer() {
        if (!this.currentCall) {
            console.log("❌ No current call to listen for");
            return;
        }

        try {
            const channel = supabase.channel(`call-${this.currentCall.room_id}`);

            // Listen for ICE candidates
            channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
                const { candidate, senderId } = payload.payload;
                if (senderId !== this.userId && this.peerConnection) {
                    try {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (error) {
                        console.log("⚠️ Failed to add ICE candidate:", error);
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
                console.log("📊 Call updated - Status:", call.status);

                // If we're the caller and an answer was received
                if (this.isCaller && call.sdp_answer && this.peerConnection) {
                    try {
                        const answer = JSON.parse(call.sdp_answer);
                        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                        this.updateState('active');
                    } catch (error) {
                        console.log("⚠️ Failed to set answer:", error);
                    }
                }

                // If call was ended or rejected
                if (call.status === 'ended' || call.status === 'rejected') {
                    this.endCall();
                }
            });

            channel.subscribe();
            console.log("👂 Subscribed to call channel:", this.currentCall.room_id);
            
        } catch (error) {
            console.error("❌ Failed to set up channel listener:", error);
        }
    }

    async toggleSpeakerMode() {
        console.log("🔊 Toggling speaker mode. Current:", this.speakerMode);
        
        // Toggle the mode
        this.speakerMode = !this.speakerMode;
        
        console.log("✅ New speaker mode:", this.speakerMode ? "SPEAKER (Loudspeaker)" : "MICROPHONE (Earpiece)");
        
        // Update database with new audio mode
        if (this.currentCall) {
            try {
                const { error } = await supabase
                    .from('calls')
                    .update({
                        audio_mode: this.speakerMode ? 'speaker' : 'mic',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentCall.id);

                if (error) {
                    console.warn("⚠️ Failed to update audio mode in database:", error);
                } else {
                    console.log("💾 Audio mode updated in database:", this.speakerMode ? 'speaker' : 'mic');
                }
            } catch (error) {
                console.error("❌ Error updating audio mode:", error);
            }
        }
        
        // Notify UI
        if (this.onSpeakerModeChange) {
            this.onSpeakerModeChange(this.speakerMode);
        }
        
        return this.speakerMode;
    }

    async toggleMute() {
        if (!this.localStream) {
            console.log("❌ No local stream to mute");
            return false;
        }
        
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.log("❌ No audio tracks to mute");
            return false;
        }
        
        const isMuted = !audioTracks[0].enabled;
        const newState = !isMuted;
        
        console.log("🎤 Setting microphone to:", newState ? "unmuted" : "muted");
        
        audioTracks.forEach(track => {
            track.enabled = newState;
        });
        
        return !newState; // Return true if now muted, false if now unmuted
    }

    async endCall() {
        console.log("📞 Ending call");
        
        if (this.currentCall) {
            try {
                const duration = this.callStartTime ? 
                    Math.floor((Date.now() - this.callStartTime) / 1000) : 0;

                const { error } = await supabase
                    .from('calls')
                    .update({
                        status: 'ended',
                        ended_at: new Date().toISOString(),
                        duration: duration,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentCall.id);

                if (error) {
                    console.error("❌ Error updating call status in database:", error);
                } else {
                    console.log("💾 Call ended in database. Duration:", duration, "seconds");
                }

                if (this.onCallEvent) {
                    this.onCallEvent('call_ended', { duration });
                }

            } catch (error) {
                console.error("❌ Error in endCall:", error);
            }
        }

        this.cleanup();
    }

    updateState(state) {
        console.log("📊 Call state updating to:", state);
        this.callState = state;
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
    }

    cleanup() {
        console.log("🧹 Cleaning up call resources");
        
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
        this.isInCall = false;
        this.callState = 'idle';
        this.callStartTime = null;
        this.isCaller = false;
        this.speakerMode = false;
        
        console.log("✅ Call service cleaned up");
    }

    // Getters
    getSpeakerMode() {
        return this.speakerMode;
    }

    getMuteState() {
        if (!this.localStream) return false;
        const audioTracks = this.localStream.getAudioTracks();
        return audioTracks.length > 0 ? !audioTracks[0].enabled : false;
    }

    // Setter methods
    setOnCallStateChange(callback) { 
        this.onCallStateChange = callback; 
    }
    
    setOnRemoteStream(callback) { 
        this.onRemoteStream = callback; 
    }
    
    setOnCallEvent(callback) { 
        this.onCallEvent = callback; 
    }
    
    setOnSpeakerModeChange(callback) { 
        this.onSpeakerModeChange = callback; 
    }
}

const callService = new CallService();
export default callService;