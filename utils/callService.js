// /app/utils/callService.js - GUARANTEED AUDIO VERSION
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
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.voipstunt.com:3478' }
        ];

        this.onCallStateChange = null;
        this.onRemoteStream = null;
        this.onCallEvent = null;
    }

    async initialize(userId) {
        this.userId = userId;
        return true;
    }

    async initiateCall(friendId, type = 'voice') {
        try {
            this.isCaller = true;

            // 1. Create call record
            const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.currentRoomId = roomId;

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

            // 2. Update presence
            await this.updateCallPresence('in-call');

            // 3. Get user media - SIMPLIFIED FOR RELIABILITY
            this.localStream = await this.getLocalMedia(type === 'video');

            // 4. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
            });

            // 5. Add local tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 6. Setup event handlers
            this.setupPeerConnection();

            // 7. Create offer
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

            return call;

        } catch (error) {
            console.error("Initiate call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async answerCall(callId) {
        try {
            this.isCaller = false;

            // 1. Get call data
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();

            if (error) throw error;
            this.currentCall = call;
            this.currentRoomId = call.room_id;

            // 2. Update presence
            await this.updateCallPresence('in-call');

            // 3. Get user media
            this.localStream = await this.getLocalMedia(call.call_type === 'video');

            // 4. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
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
            console.error("Answer call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    async updateCallPresence(status) {
        try {
            if (!this.userId || !this.currentRoomId) return;

            const { error } = await supabase.rpc('update_user_presence', {
                p_user_id: this.userId,
                p_room_id: this.currentRoomId,
                p_status: status
            });

            if (error) {
                console.log("Presence update error:", error.message);
            }
        } catch (error) {
            // Silent fail
        }
    }

    async getLocalMedia(video = false) {
        try {
            // ULTRA SIMPLE CONSTRAINTS - Most compatible
            const constraints = {
                audio: true, // Just true, let browser choose best
                video: video ? {
                    width: { min: 640, ideal: 1280 },
                    height: { min: 480, ideal: 720 },
                    facingMode: 'user'
                } : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Verify audio is working
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error("No audio track found in stream");
            }
            
            // Ensure audio track is enabled
            audioTracks.forEach(track => {
                track.enabled = true;
            });

            return stream;

        } catch (error) {
            console.error("Microphone access error:", error);
            throw error;
        }
    }

    setupPeerConnection() {
        // ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.sendIceCandidate(event.candidate);
            }
        };

        // CRITICAL FIX: Remote stream handling
        this.peerConnection.ontrack = (event) => {
            console.log("🎯 WebRTC track received:", event.track.kind);
            
            // Use the stream from the event directly
            if (event.streams && event.streams.length > 0) {
                this.remoteStream = event.streams[0];
                
                // Ensure audio tracks are enabled
                const audioTracks = this.remoteStream.getAudioTracks();
                audioTracks.forEach(track => {
                    track.enabled = true;
                    console.log("Audio track enabled:", track.enabled);
                });
                
                if (this.onRemoteStream) {
                    // Send the stream immediately
                    this.onRemoteStream(this.remoteStream);
                }
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
            // Silent fail
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
                    // Silent fail
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
        if (audioTracks.length === 0) return false;
        
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;

        audioTracks.forEach(track => {
            track.enabled = newState;
        });

        return newState;
    }

    updateState(state) {
        this.callState = state;
        if (this.onCallStateChange) {
            this.onCallStateChange(state);
        }
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