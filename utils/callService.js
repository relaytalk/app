// /app/utils/callService.js - FINAL FIXED VERSION
import { supabase } from './supabase.js';

class CallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.userId = null;
        this.speakerMode = false;
        this.isInCall = false;
        this.callStartTime = null;
    }

    async initialize(userId) {
        this.userId = userId;
        console.log("📞 CallService initialized for:", userId);
        return true;
    }

    async initiateCall(friendId, type = 'voice') {
        try {
            console.log("Starting call to:", friendId);
            
            // Get microphone stream
            await this.getLocalMedia();
            
            // Create room ID
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log("Creating call in database...");
            
            // Create call record
            const callData = {
                room_id: roomId,
                caller_id: this.userId,
                receiver_id: friendId,
                call_type: type,
                status: 'ringing',
                audio_mode: 'mic',
                initiated_at: new Date().toISOString()
            };
            
            const { data: call, error } = await supabase
                .from('calls')
                .insert(callData)
                .select()
                .single();

            if (error) {
                console.error("Database error:", error);
                throw error;
            }
            
            this.currentCall = call;
            console.log("✅ Call created:", call.id);

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            // Add microphone track
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle incoming audio
            this.peerConnection.ontrack = (event) => {
                console.log("🔊 Received remote audio stream");
                this.remoteStream = event.streams[0];
                
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }
            };

            // Create and set local description
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            // Save SDP offer
            await this.updateCallInDatabase({
                sdp_offer: JSON.stringify(offer)
            });

            this.isInCall = true;
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
            console.log("Answering call:", callId);
            
            // Get call from database
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) throw error;
            
            this.currentCall = call;

            // Get microphone stream
            await this.getLocalMedia();

            // Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            // Add microphone track
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle incoming audio
            this.peerConnection.ontrack = (event) => {
                console.log("🔊 Received remote audio stream");
                this.remoteStream = event.streams[0];
                
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }
            };

            // Set remote description from offer
            if (call.sdp_offer) {
                const offer = JSON.parse(call.sdp_offer);
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            }

            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Update call status
            await this.updateCallInDatabase({
                sdp_answer: JSON.stringify(answer),
                status: 'active',
                audio_mode: this.speakerMode ? 'speaker' : 'mic',
                started_at: new Date().toISOString()
            });

            this.isInCall = true;
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
            // Stop existing stream if any
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            console.log("🎤 Requesting microphone access...");
            
            // Always get microphone
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
            console.error("❌ Error getting microphone:", error);
            throw error;
        }
    }

    async toggleSpeakerMode() {
        console.log("🔊 Toggling speaker mode. Current:", this.speakerMode);
        
        // Toggle the mode
        this.speakerMode = !this.speakerMode;
        
        console.log("✅ New speaker mode:", this.speakerMode ? "SPEAKER 🔊" : "MICROPHONE 🎤");
        
        // Update database with new audio mode
        if (this.currentCall) {
            await this.updateCallInDatabase({
                audio_mode: this.speakerMode ? 'speaker' : 'mic'
            });
        }
        
        // Notify UI
        if (this.onSpeakerModeChange) {
            this.onSpeakerModeChange(this.speakerMode);
        }
        
        return this.speakerMode;
    }

    async updateCallInDatabase(updates) {
        if (!this.currentCall) return;
        
        try {
            updates.updated_at = new Date().toISOString();
            
            const { error } = await supabase
                .from('calls')
                .update(updates)
                .eq('id', this.currentCall.id);
            
            if (error) {
                console.error("❌ Failed to update call:", error);
            } else {
                console.log("💾 Database updated:", updates);
            }
        } catch (error) {
            console.error("❌ Error updating call:", error);
        }
    }

    async toggleMute() {
        if (!this.localStream) return false;
        
        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length === 0) return false;
        
        const isMuted = !audioTracks[0].enabled;
        const newState = !isMuted;
        
        console.log("🎤 Microphone", newState ? "unmuted" : "muted");
        
        audioTracks.forEach(track => {
            track.enabled = newState;
        });
        
        return !newState; // Return true if muted
    }

    async endCall() {
        console.log("📞 Ending call");
        
        if (this.currentCall) {
            const duration = this.callStartTime ? 
                Math.floor((Date.now() - this.callStartTime) / 1000) : 0;
            
            await this.updateCallInDatabase({
                status: 'ended',
                ended_at: new Date().toISOString(),
                duration: duration
            });
            
            if (this.onCallEvent) {
                this.onCallEvent('call_ended', { duration });
            }
        }
        
        this.cleanup();
    }

    cleanup() {
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
        this.isInCall = false;
        this.speakerMode = false;
        this.callStartTime = null;
        
        console.log("🧹 Cleanup complete");
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
    setOnCallStateChange(callback) { this.onCallStateChange = callback; }
    setOnRemoteStream(callback) { this.onRemoteStream = callback; }
    setOnCallEvent(callback) { this.onCallEvent = callback; }
    setOnSpeakerModeChange(callback) { this.onSpeakerModeChange = callback; }
}

const callService = new CallService();
export default callService;