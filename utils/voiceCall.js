// /app/utils/voiceCall.js
import { supabase } from './supabase.js';

class VoiceCallManager {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.currentCall = null;
        this.isCaller = false;
        
        // STUN/TURN servers (using free public servers)
        this.iceServers = [
            // Google's public STUN server
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            
            // Twilio's STUN (free)
            { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
            
            // For production, add your own TURN servers here
            // {
            //   urls: 'turn:your-turn-server.com:3478',
            //   username: 'your-username',
            //   credential: 'your-password'
            // }
        ];
        
        this.setupEventListeners();
    }
    
    // ========== SETUP EVENT LISTENERS ==========
    setupEventListeners() {
        // Listen for call invitations
        this.setupCallInvitationListener();
        
        // Listen for ICE candidates
        this.setupIceCandidateListener();
        
        // Listen for call updates
        this.setupCallUpdateListener();
    }
    
    // ========== INITIATE A CALL ==========
    async initiateCall(receiverId) {
        console.log('📞 Initiating call to:', receiverId);
        
        try {
            // 1. Generate unique room ID
            const roomId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // 2. Create call record in database
            const { data: call, error } = await supabase
                .from('calls')
                .insert({
                    room_id: roomId,
                    caller_id: await this.getCurrentUserId(),
                    receiver_id: receiverId,
                    status: 'initiated',
                    initiated_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            
            this.currentCall = call;
            this.isCaller = true;
            
            // 3. Get local audio stream
            await this.getUserMedia();
            
            // 4. Create peer connection
            await this.createPeerConnection();
            
            // 5. Add local stream to connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // 6. Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // 7. Save offer to database
            await supabase
                .from('calls')
                .update({ 
                    sdp_offer: JSON.stringify(offer),
                    status: 'ringing',
                    updated_at: new Date().toISOString()
                })
                .eq('id', call.id);
            
            console.log('✅ Call initiated, offer created:', offer.type);
            
            // 8. Show call UI
            this.showCallUI('ringing');
            
            // 9. Send notification to receiver
            await this.sendCallNotification(receiverId, call.id);
            
            return call;
            
        } catch (error) {
            console.error('❌ Failed to initiate call:', error);
            this.handleCallError(error);
            return null;
        }
    }
    
    // ========== ANSWER A CALL ==========
    async answerCall(callId) {
        console.log('📞 Answering call:', callId);
        
        try {
            // 1. Get call details
            const { data: call, error } = await supabase
                .from('calls')
                .select('*')
                .eq('id', callId)
                .single();
            
            if (error) throw error;
            
            this.currentCall = call;
            this.isCaller = false;
            
            // 2. Get local audio stream
            await this.getUserMedia();
            
            // 3. Create peer connection
            await this.createPeerConnection();
            
            // 4. Add local stream to connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // 5. Set remote description (caller's offer)
            const offer = JSON.parse(call.sdp_offer);
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // 6. Create and send answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // 7. Save answer to database
            await supabase
                .from('calls')
                .update({ 
                    sdp_answer: JSON.stringify(answer),
                    status: 'active',
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', callId);
            
            console.log('✅ Call answered, answer created:', answer.type);
            
            // 8. Show call UI
            this.showCallUI('active');
            
            // 9. Update call participants
            await this.addCallParticipant(callId, 'joined');
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to answer call:', error);
            this.handleCallError(error);
            return false;
        }
    }
    
    // ========== CREATE PEER CONNECTION ==========
    async createPeerConnection() {
        console.log('🔗 Creating peer connection...');
        
        try {
            // Create RTCPeerConnection
            this.peerConnection = new RTCPeerConnection({
                iceServers: this.iceServers,
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle',
                rtcpMuxPolicy: 'require'
            });
            
            // Set up event handlers
            this.setupPeerConnectionEvents();
            
            console.log('✅ Peer connection created');
            return this.peerConnection;
            
        } catch (error) {
            console.error('❌ Failed to create peer connection:', error);
            throw error;
        }
    }
    
    // ========== SETUP PEER CONNECTION EVENTS ==========
    setupPeerConnectionEvents() {
        if (!this.peerConnection) return;
        
        // ICE candidate event
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 New ICE candidate:', event.candidate);
                this.sendIceCandidate(event.candidate);
            }
        };
        
        // Track event (remote stream)
        this.peerConnection.ontrack = (event) => {
            console.log('🎵 Remote track received:', event.track.kind);
            
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                this.setupRemoteAudio(this.remoteStream);
            }
        };
        
        // Connection state change
        this.peerConnection.onconnectionstatechange = () => {
            console.log('📡 Connection state:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                console.log('✅ Peer connection established!');
                this.onCallConnected();
            } else if (this.peerConnection.connectionState === 'disconnected' ||
                       this.peerConnection.connectionState === 'failed' ||
                       this.peerConnection.connectionState === 'closed') {
                console.log('❌ Peer connection lost');
                this.endCall();
            }
        };
        
        // ICE connection state change
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('❄️ ICE connection state:', this.peerConnection.iceConnectionState);
        };
        
        // Signaling state change
        this.peerConnection.onsignalingstatechange = () => {
            console.log('📶 Signaling state:', this.peerConnection.signalingState);
        };
    }
    
    // ========== GET USER MEDIA (AUDIO) ==========
    async getUserMedia() {
        console.log('🎤 Requesting microphone access...');
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000,
                    sampleSize: 16
                },
                video: false
            });
            
            console.log('✅ Microphone access granted');
            
            // Setup local audio for echo cancellation testing
            this.setupLocalAudio(this.localStream);
            
            return this.localStream;
            
        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            throw error;
        }
    }
    
    // ========== SETUP LOCAL AUDIO ==========
    setupLocalAudio(stream) {
        // Create hidden audio element for local stream
        const audio = document.createElement('audio');
        audio.id = 'local-audio';
        audio.autoplay = true;
        audio.muted = true; // Mute to avoid echo
        audio.srcObject = stream;
        
        // Style it to be hidden
        audio.style.cssText = `
            position: absolute;
            opacity: 0;
            pointer-events: none;
            width: 1px;
            height: 1px;
        `;
        
        document.body.appendChild(audio);
    }
    
    // ========== SETUP REMOTE AUDIO ==========
    setupRemoteAudio(stream) {
        // Create or update remote audio element
        let audio = document.getElementById('remote-audio');
        
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'remote-audio';
            audio.autoplay = true;
            audio.controls = false;
            
            // Style it for call UI
            audio.style.cssText = `
                width: 100%;
                max-width: 300px;
                margin: 20px auto;
                display: block;
                background: #f0f0f0;
                border-radius: 10px;
                padding: 10px;
            `;
            
            // Add to call UI container
            const callContainer = document.getElementById('call-container') || document.body;
            callContainer.appendChild(audio);
        }
        
        audio.srcObject = stream;
        
        // Log audio levels
        this.setupAudioLevelMeter(stream, 'remote');
    }
    
    // ========== SEND ICE CANDIDATE ==========
    async sendIceCandidate(candidate) {
        if (!this.currentCall) return;
        
        try {
            // Save ICE candidate to database
            await supabase
                .from('call_logs')
                .insert({
                    call_id: this.currentCall.id,
                    user_id: await this.getCurrentUserId(),
                    event_type: 'ice_candidate',
                    event_data: { candidate: candidate.toJSON() }
                });
            
            // Also send via realtime for faster delivery
            await supabase
                .channel(`call-${this.currentCall.room_id}`)
                .send({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: {
                        callId: this.currentCall.id,
                        candidate: candidate.toJSON(),
                        senderId: await this.getCurrentUserId()
                    }
                });
            
        } catch (error) {
            console.error('❌ Failed to send ICE candidate:', error);
        }
    }
    
    // ========== SETUP CALL INVITATION LISTENER ==========
    setupCallInvitationListener() {
        supabase
            .channel('call-invitations')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'calls',
                    filter: 'status=eq.ringing'
                },
                async (payload) => {
                    const call = payload.new;
                    const currentUserId = await this.getCurrentUserId();
                    
                    // Check if this call is for current user
                    if (call.receiver_id === currentUserId) {
                        console.log('📲 Incoming call detected:', call);
                        this.showIncomingCallUI(call);
                    }
                }
            )
            .subscribe();
    }
    
    // ========== SETUP ICE CANDIDATE LISTENER ==========
    setupIceCandidateListener() {
        // Listen for ICE candidates via realtime
        supabase
            .channel('ice-candidates')
            .on(
                'broadcast',
                { event: 'ice-candidate' },
                async (payload) => {
                    const { callId, candidate, senderId } = payload.payload;
                    const currentUserId = await this.getCurrentUserId();
                    
                    // Only process if not our own candidate and for current call
                    if (senderId !== currentUserId && 
                        this.currentCall && 
                        this.currentCall.id === callId) {
                        
                        console.log('🧊 Received ICE candidate from remote');
                        
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (error) {
                            console.error('❌ Failed to add ICE candidate:', error);
                        }
                    }
                }
            )
            .subscribe();
    }
    
    // ========== SETUP CALL UPDATE LISTENER ==========
    setupCallUpdateListener() {
        supabase
            .channel('call-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'calls'
                },
                async (payload) => {
                    const call = payload.new;
                    
                    // If this is our current call
                    if (this.currentCall && this.currentCall.id === call.id) {
                        // Handle status changes
                        if (call.status === 'ended' || call.status === 'missed' || call.status === 'rejected') {
                            this.endCall();
                        }
                        
                        // Handle answer if we're the caller
                        if (call.status === 'active' && this.isCaller && call.sdp_answer) {
                            const answer = JSON.parse(call.sdp_answer);
                            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                        }
                    }
                }
            )
            .subscribe();
    }
    
    // ========== END CALL ==========
    async endCall() {
        console.log('📞 Ending call...');
        
        if (!this.currentCall) return;
        
        try {
            // Update call status
            await supabase
                .from('calls')
                .update({
                    status: 'ended',
                    ended_at: new Date().toISOString(),
                    duration: Math.floor((new Date() - new Date(this.currentCall.started_at || this.currentCall.initiated_at)) / 1000),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentCall.id);
            
            // Update participant status
            await this.updateCallParticipantStatus('left');
            
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
            
            // Clean up UI
            this.cleanupCallUI();
            
            // Reset call state
            this.currentCall = null;
            this.isCaller = false;
            
            console.log('✅ Call ended successfully');
            
        } catch (error) {
            console.error('❌ Error ending call:', error);
        }
    }
    
    // ========== UI FUNCTIONS ==========
    showCallUI(status) {
        showCallUI(status) {
        // Create call UI container
        let container = document.getElementById('call-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'call-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                font-family: Arial, sans-serif;
            `;
            document.body.appendChild(container);
        }
        
        let statusText = '';
        let buttons = '';
        
        if (status === 'ringing') {
            statusText = `<h2>📞 Calling...</h2>`;
            buttons = `
                <button onclick="voiceCall.endCall()" style="background: #ff3b30; color: white; padding: 15px 30px; border: none; border-radius: 50px; font-size: 16px; cursor: pointer; margin: 10px;">
                    ❌ End Call
                </button>
            `;
        } else if (status === 'active') {
            statusText = `<h2>📞 Call Connected</h2>
                         <p id="call-timer">00:00</p>`;
            buttons = `
                <button onclick="voiceCall.toggleMute()" id="mute-btn" style="background: #5856d6; color: white; padding: 15px 30px; border: none; border-radius: 50px; font-size: 16px; cursor: pointer; margin: 10px;">
                    🔇 Mute
                </button>
                <button onclick="voiceCall.toggleSpeaker()" id="speaker-btn" style="background: #5856d6; color: white; padding: 15px 30px; border: none; border-radius: 50px; font-size: 16px; cursor: pointer; margin: 10px;">
                    🔊 Speaker
                </button>
                <button onclick="voiceCall.endCall()" style="background: #ff3b30; color: white; padding: 15px 30px; border: none; border-radius: 50px; font-size: 16px; cursor: pointer; margin: 10px;">
                    ❌ End Call
                </button>
            `;
        }
        
        container.innerHTML = `
            <div style="text-align: center;">
                ${statusText}
                <div id="audio-visualizer" style="width: 200px; height: 100px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 20px auto;"></div>
                <div>
                    ${buttons}
                </div>
            </div>
        `;
        
        // Start timer if call is active
        if (status === 'active') {
            this.startCallTimer();
            this.setupAudioVisualizer();
        }
    }
    
    showIncomingCallUI(call) {
        // Create incoming call UI
        const container = document.createElement('div');
        container.id = 'incoming-call-container';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: Arial, sans-serif;
            animation: pulse 2s infinite;
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 0.9; }
                50% { opacity: 1; }
                100% { opacity: 0.9; }
            }
        `;
        document.head.appendChild(style);
        
        container.innerHTML = `
            <div style="text-align: center;">
                <h1 style="font-size: 48px;">📞</h1>
                <h2>Incoming Voice Call</h2>
                <p id="caller-name">Loading caller info...</p>
                
                <div style="margin-top: 40px;">
                    <button onclick="voiceCall.answerCall('${call.id}')" style="background: #4cd964; color: white; padding: 20px 40px; border: none; border-radius: 50px; font-size: 18px; cursor: pointer; margin: 10px;">
                        ✅ Answer
                    </button>
                    <button onclick="voiceCall.rejectCall('${call.id}')" style="background: #ff3b30; color: white; padding: 20px 40px; border: none; border-radius: 50px; font-size: 18px; cursor: pointer; margin: 10px;">
                        ❌ Reject
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Get caller info
        this.getCallerInfo(call.caller_id).then(callerName => {
            document.getElementById('caller-name').textContent = callerName;
        });
    }
    
    cleanupCallUI() {
        // Remove call UI containers
        const callContainer = document.getElementById('call-container');
        const incomingContainer = document.getElementById('incoming-call-container');
        
        if (callContainer) callContainer.remove();
        if (incomingContainer) incomingContainer.remove();
        
        // Remove audio elements
        const localAudio = document.getElementById('local-audio');
        const remoteAudio = document.getElementById('remote-audio');
        
        if (localAudio) localAudio.remove();
        if (remoteAudio) remoteAudio.remove();
    }
    
    // ========== UTILITY FUNCTIONS ==========
    async getCurrentUserId() {
        // Implement based on your auth system
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
    }
    
    async getCallerInfo(callerId) {
        try {
            const { data: caller } = await supabase
                .from('users')
                .select('username, full_name')
                .eq('id', callerId)
                .single();
            
            return caller?.full_name || caller?.username || 'Unknown';
        } catch (error) {
            return 'Unknown caller';
        }
    }
    
    async addCallParticipant(callId, status) {
        const userId = await this.getCurrentUserId();
        
        await supabase
            .from('call_participants')
            .insert({
                call_id: callId,
                user_id: userId,
                status: status,
                joined_at: status === 'joined' ? new Date().toISOString() : null
            });
    }
    
    async updateCallParticipantStatus(status) {
        if (!this.currentCall) return;
        
        const userId = await this.getCurrentUserId();
        
        await supabase
            .from('call_participants')
            .update({
                status: status,
                left_at: status === 'left' ? new Date().toISOString() : null
            })
            .eq('call_id', this.currentCall.id)
            .eq('user_id', userId);
    }
    
    async sendCallNotification(receiverId, callId) {
        // Send push notification for the call
        // This would use your notification system
        console.log('📱 Sending call notification to:', receiverId);
    }
    
    // ========== CALL CONTROLS ==========
    toggleMute() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            
            const button = document.getElementById('mute-btn');
            if (button) {
                button.innerHTML = audioTrack.enabled ? '🔇 Mute' : '🎤 Unmute';
                button.style.background = audioTrack.enabled ? '#5856d6' : '#ff9500';
            }
            
            console.log(audioTrack.enabled ? '✅ Unmuted' : '🔇 Muted');
        }
    }
    
    toggleSpeaker() {
        // Toggle speaker output
        const audio = document.getElementById('remote-audio');
        if (audio) {
            // This is a simple implementation
            // For proper speaker control, you'd need audio routing API
            console.log('🔊 Speaker toggled');
        }
    }
    
    rejectCall(callId) {
        // Update call status to rejected
        supabase
            .from('calls')
            .update({
                status: 'rejected',
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', callId);
        
        // Clean up UI
        this.cleanupCallUI();
    }
    
    // ========== CALL TIMER ==========
    startCallTimer() {
        const timerElement = document.getElementById('call-timer');
        if (!timerElement) return;
        
        let seconds = 0;
        
        this.timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    // ========== AUDIO VISUALIZER ==========
    setupAudioVisualizer() {
        // Simple audio level visualizer
        const canvas = document.getElementById('audio-visualizer');
        if (!canvas || !this.localStream) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(this.localStream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const ctx = canvas.getContext('2d');
        
        function draw() {
            requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                ctx.fillStyle = `rgb(${barHeight + 100}, 50, 150)`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        }
        
        draw();
    }
    
    // ========== ERROR HANDLING ==========
    handleCallError(error) {
        console.error('Call error:', error);
        
        let errorMessage = 'Call failed. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Microphone access was denied.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No microphone found.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Microphone is in use by another application.';
        } else if (error.name === 'SecurityError') {
            errorMessage += 'Microphone access is blocked by browser security.';
        } else {
            errorMessage += error.message || 'Unknown error occurred.';
        }
        
        alert(errorMessage);
        this.cleanupCallUI();
    }
    
    onCallConnected() {
        console.log('✅ Call connected successfully!');
        // You can add any post-connection logic here
    }
}

// Create and export the voice call manager
const voiceCall = new VoiceCallManager();
export default voiceCall;
