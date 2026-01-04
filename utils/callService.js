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

        this.callState = 'idle';
        this.callStartTime = null;

        // Reliable STUN servers
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
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

            // 2. Get user media FIRST - SIMPLE is better
            console.log("🎤 Getting microphone access...");
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true, // Just true for maximum compatibility
                video: type === 'video'
            });

            console.log("✅ Got media stream with tracks:", this.localStream.getTracks().length);

            // 3. Create peer connection
            console.log("🔗 Creating peer connection...");
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
            });

            // 4. Add local tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                console.log(`Adding ${track.kind} track to peer connection`);
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 5. Setup peer connection event handlers
            this.setupPeerConnection();

            // 6. Create and send offer
            console.log("📤 Creating offer...");
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video'
            });

            await this.peerConnection.setLocalDescription(offer);

            // 7. Save offer to database
            await supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id);

            // 8. Listen for answer via database changes
            this.listenForCallUpdates();

            // 9. Update state
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

            // 2. Get user media
            console.log("🎤 Getting microphone access...");
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: call.call_type === 'video'
            });

            console.log("✅ Got media stream with tracks:", this.localStream.getTracks().length);

            // 3. Create peer connection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers
            });

            // 4. Add local tracks
            this.localStream.getTracks().forEach(track => {
                console.log(`Adding ${track.kind} track to peer connection`);
                this.peerConnection.addTrack(track, this.localStream);
            });

            // 5. Setup peer connection event handlers
            this.setupPeerConnection();

            // 6. Set remote description (the offer from caller)
            const offer = JSON.parse(call.sdp_offer);
            console.log("📥 Setting remote description...");
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );

            // 7. Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // 8. Save answer to database
            console.log("📤 Saving answer to database...");
            await supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);

            // 9. Listen for ICE candidates
            this.listenForCallUpdates();

            // 10. Update state
            this.updateState('active');

            console.log("✅ Call answered successfully");
            return true;

        } catch (error) {
            console.error("❌ Answer call failed:", error);
            this.cleanup();
            throw error;
        }
    }

    setupPeerConnection() {
        console.log("🔧 Setting up peer connection handlers...");

        // ICE Candidate handler
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                console.log("🧊 ICE candidate generated");
                this.sendIceCandidate(event.candidate);
            } else if (!event.candidate) {
                console.log("✅ ICE gathering complete");
            }
        };

        // REMOTE STREAM - THIS IS WHERE AUDIO COMES FROM
        this.peerConnection.ontrack = (event) => {
            console.log("🎯 Received remote track:", event.track.kind);
            
            // Create a new stream from the incoming tracks
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            
            // Add the track to our stream
            this.remoteStream.addTrack(event.track);
            
            // CRITICAL: Enable the track
            event.track.enabled = true;
            
            console.log("🔊 Remote audio track added. Enabled:", event.track.enabled);
            
            // Send the stream to the UI
            if (this.onRemoteStream) {
                // Create a fresh stream reference
                const streamForUI = new MediaStream();
                this.remoteStream.getTracks().forEach(track => {
                    streamForUI.addTrack(track);
                });
                
                // Send it after a small delay
                setTimeout(() => {
                    console.log("📨 Sending remote stream to UI");
                    this.onRemoteStream(streamForUI);
                }, 100);
            }
        };

        // Connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("🔗 Peer connection state:", state);

            if (state === 'connected') {
                console.log("✅ WebRTC connection established!");
                this.updateState('active');
                this.callStartTime = Date.now();
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
            } else if (state === 'failed') {
                console.log("❌ ICE connection failed");
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
            console.log("📨 Sending ICE candidate to:", receiverId.substring(0, 8) + '...');
            
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

    listenForCallUpdates() {
        if (!this.currentCall) return;

        const channel = supabase.channel(`call-${this.currentCall.room_id}`);
        const roomId = this.currentCall.room_id;

        console.log("👂 Listening for call updates on channel: call-" + roomId);

        // Listen for ICE candidates from the other user
        channel.on('broadcast', { event: 'ice-candidate' }, async (payload) => {
            const { candidate, senderId } = payload.payload;
            
            // Only process if from the other person
            if (senderId !== this.userId && this.peerConnection) {
                console.log("📨 Received ICE candidate from other user");
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.log("Failed to add ICE candidate:", error);
                }
            }
        });

        // Listen for database changes (call status, SDP answers)
        channel.on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${this.currentCall.id}`
        }, async (payload) => {
            const call = payload.new;
            console.log("📞 Call updated:", call.status);

            // If we're the caller and we receive an answer
            if (this.isCaller && call.sdp_answer) {
                try {
                    const answer = JSON.parse(call.sdp_answer);
                    console.log("📥 Setting remote description from answer");
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                    this.updateState('active');
                } catch (error) {
                    console.log("Failed to set answer:", error);
                }
            }

            // If call was ended or rejected
            if (call.status === 'ended' || call.status === 'rejected') {
                console.log("📞 Call ended remotely");
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

                if (this.onCallEvent) {
                    this.onCallEvent('call_ended', { duration });
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
        if (audioTracks.length === 0) return false;
        
        const isMuted = audioTracks[0]?.enabled === false;
        const newState = !isMuted;

        audioTracks.forEach(track => {
            track.enabled = newState;
        });

        console.log("🎤 Microphone", newState ? "unmuted" : "muted");
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
        console.log("🧹 Cleaning up call resources...");

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Stop remote stream
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
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