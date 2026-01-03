// /app/utils/callService.js - SIMPLIFIED VERSION
import { supabase } from './supabase.js';

class CallService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.isCaller = false;
        this.callType = 'voice';
        this.userId = null;
        
        this.callState = 'idle';
        this.callStartTime = null;
        this.callTimer = null;
        
        // STUN servers
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ];
        
        // Callbacks
        this.onCallStateChange = null;
        this.onRemoteStream = null;
        this.onCallEvent = null;
    }

    // Initialize
    async initialize(userId) {
        this.userId = userId;
        return true;
    }

    // Start a call
    async initiateCall(friendId, type = 'voice') {
        try {
            this.callType = type;
            this.isCaller = true;
            
            // 1. Create call record
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
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
            
            // 2. Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video'
            });
            
            // 3. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
            });
            
            // Add tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Setup event handlers
            this.setupPeerConnection();
            
            // 4. Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // 5. Save offer to DB
            await supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id);
            
            // 6. Setup listener for answer
            this.listenForAnswer();
            
            // 7. Update state
            this.updateState('ringing');
            
            return call;
            
        } catch (error) {
            console.error("Initiate call error:", error);
            this.cleanup();
            throw error;
        }
    }

    // Answer a call
    async answerCall(callId) {
        try {
            this.isCaller = false;
            
            // 1. Get call
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();
            
            if (error) throw error;
            this.currentCall = call;
            this.callType = call.call_type || 'voice';
            
            // 2. Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: this.callType === 'video'
            });
            
            // 3. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
            });
            
            // Add tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // Setup event handlers
            this.setupPeerConnection();
            
            // 4. Set remote offer
            const offer = JSON.parse(call.sdp_offer);
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );
            
            // 5. Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // 6. Save answer to DB
            await supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);
            
            // 7. Update state
            this.updateState('active');
            this.startTimer();
            
            return true;
            
        } catch (error) {
            console.error("Answer call error:", error);
            this.cleanup();
            throw error;
        }
    }

    // Setup peer connection events
    setupPeerConnection() {
        if (!this.peerConnection) return;
        
        // ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.sendIceCandidate(event.candidate);
            }
        };
        
        // Remote stream
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            if (this.onRemoteStream) {
                this.onRemoteStream(this.remoteStream);
            }
        };
        
        // Connection state
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("Connection state:", state);
            
            if (state === 'connected') {
                this.updateState('active');
                this.startTimer();
            } else if (state === 'disconnected' || state === 'failed') {
                this.endCall();
            }
        };
    }

    // Listen for answer (for caller)
    listenForAnswer() {
        if (!this.currentCall) return;
        
        supabase
            .channel(`call-${this.currentCall.room_id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `id=eq.${this.currentCall.id}`
            }, async (payload) => {
                const call = payload.new;
                
                if (call.sdp_answer && this.isCaller) {
                    const answer = JSON.parse(call.sdp_answer);
                    await this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                    
                    this.updateState('active');
                    this.startTimer();
                }
            })
            .subscribe();
    }

    // Send ICE candidate
    async sendIceCandidate(candidate) {
        if (!this.currentCall) return;
        
        const receiverId = this.isCaller ? 
            this.currentCall.receiver_id : 
            this.currentCall.caller_id;
        
        await supabase
            .channel(`call-${this.currentCall.room_id}`)
            .send({
                type: 'broadcast',
                event: 'ice-candidate',
                payload: {
                    candidate: candidate.toJSON(),
                    senderId: this.userId,
                    receiverId: receiverId
                }
            });
    }

    // End call
    async endCall() {
        if (!this.currentCall) return;
        
        try {
            // Update DB
            await supabase
                .from('calls')
                .update({
                    status: 'ended',
                    ended_at: new Date().toISOString(),
                    duration: this.callStartTime ? 
                        Math.floor((Date.now() - this.callStartTime) / 1000) : 0,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentCall.id);
            
            // Send call ended event
            if (this.onCallEvent) {
                this.onCallEvent('call_ended', {});
            }
            
        } catch (error) {
            console.error("Error updating call end:", error);
        }
        
        this.cleanup();
    }

    // Toggle mute
    async toggleMute() {
        if (!this.localStream) return;
        
        const audioTracks = this.localStream.getAudioTracks();
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;
        
        audioTracks.forEach(track => {
            track.enabled = newState;
        });
        
        return newState;
    }

    // Update state
    updateState(state) {
        this.callState = state;
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
    }

    // Start timer
    startTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            // Timer logic
        }, 1000);
    }

    // Cleanup
    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        this.currentCall = null;
        this.callState = 'idle';
        this.callStartTime = null;
    }

    // Setters for callbacks
    setOnCallStateChange(callback) { this.onCallStateChange = callback; }
    setOnRemoteStream(callback) { this.onRemoteStream = callback; }
    setOnCallEvent(callback) { this.onCallEvent = callback; }
}

// Export singleton
const callService = new CallService();
export default callService;