// /app/utils/webrtc.js

class WebRTCManager {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.dataChannel = null;
        
        // STUN/TURN servers configuration
        this.iceServers = {
            iceServers: [
                // Public STUN servers
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                
                // Twilio's STUN (free)
                { urls: 'stun:global.stun.twilio.com:3478?transport=udp' },
                
                // For production, add TURN servers here:
                // {
                //   urls: 'turn:your-turn-server.com:3478',
                //   username: 'your-username',
                //   credential: 'your-password'
                // }
            ],
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
        
        // Callbacks
        this.onRemoteStream = null;
        this.onConnectionStateChange = null;
        this.onIceConnectionStateChange = null;
        this.onDataChannelMessage = null;
        this.onDataChannelOpen = null;
        
        console.log("✅ WebRTC Manager initialized");
    }
    
    // ==================== INITIALIZATION ====================
    
    async initialize(options = {}) {
        console.log("🔄 Initializing WebRTC...");
        
        // Set callbacks
        if (options.onRemoteStream) this.onRemoteStream = options.onRemoteStream;
        if (options.onConnectionStateChange) this.onConnectionStateChange = options.onConnectionStateChange;
        if (options.onIceConnectionStateChange) this.onIceConnectionStateChange = options.onIceConnectionStateChange;
        if (options.onDataChannelMessage) this.onDataChannelMessage = options.onDataChannelMessage;
        if (options.onDataChannelOpen) this.onDataChannelOpen = options.onDataChannelOpen;
        
        // Create peer connection
        this.createPeerConnection();
        
        return true;
    }
    
    // ==================== PEER CONNECTION ====================
    
    createPeerConnection() {
        console.log("🔗 Creating RTCPeerConnection...");
        
        try {
            this.peerConnection = new RTCPeerConnection(this.iceServers);
            
            // Setup event handlers
            this.setupPeerConnectionEvents();
            
            console.log("✅ Peer connection created");
            return this.peerConnection;
            
        } catch (error) {
            console.error("❌ Failed to create peer connection:", error);
            throw error;
        }
    }
    
    setupPeerConnectionEvents() {
        if (!this.peerConnection) return;
        
        // ICE candidate event
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("🧊 ICE candidate generated:", event.candidate);
                // This will be sent via signaling
                if (this.onIceCandidate) {
                    this.onIceCandidate(event.candidate);
                }
            } else {
                console.log("✅ ICE gathering complete");
            }
        };
        
        // ICE connection state change
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log("❄️ ICE connection state:", state);
            
            if (this.onIceConnectionStateChange) {
                this.onIceConnectionStateChange(state);
            }
            
            switch(state) {
                case 'connected':
                    console.log("✅ ICE connected!");
                    break;
                case 'disconnected':
                    console.log("⚠️ ICE disconnected");
                    break;
                case 'failed':
                    console.error("❌ ICE failed");
                    this.cleanup();
                    break;
                case 'closed':
                    console.log("🔒 ICE connection closed");
                    break;
            }
        };
        
        // Connection state change
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log("📡 Connection state:", state);
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }
            
            switch(state) {
                case 'connected':
                    console.log("🎉 Peer connection established!");
                    this.onConnectionEstablished();
                    break;
                case 'disconnected':
                    console.log("⚠️ Peer disconnected");
                    break;
                case 'failed':
                    console.error("❌ Peer connection failed");
                    this.cleanup();
                    break;
                case 'closed':
                    console.log("🔒 Peer connection closed");
                    this.cleanup();
                    break;
            }
        };
        
        // Track event (remote stream)
        this.peerConnection.ontrack = (event) => {
            console.log("🎵 Remote track received:", event.track.kind);
            
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                console.log("✅ Remote stream received:", this.remoteStream);
                
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }
            }
        };
        
        // Signaling state change
        this.peerConnection.onsignalingstatechange = () => {
            console.log("📶 Signaling state:", this.peerConnection.signalingState);
        };
        
        // Data channel
        this.peerConnection.ondatachannel = (event) => {
            console.log("📨 Data channel received:", event.channel.label);
            this.setupDataChannel(event.channel);
        };
    }
    
    // ==================== MEDIA HANDLING ====================
    
    async getLocalStream(constraints = { audio: true, video: false }) {
        console.log("🎤 Requesting local media stream...");
        
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: 48000,
                    sampleSize: 16,
                    latency: 0.01
                },
                video: constraints.video ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                } : false
            });
            
            console.log("✅ Local stream obtained:", this.localStream);
            return this.localStream;
            
        } catch (error) {
            console.error("❌ Failed to get local stream:", error);
            throw error;
        }
    }
    
    async addLocalStreamToConnection() {
        if (!this.localStream || !this.peerConnection) {
            console.error("❌ No local stream or peer connection");
            return;
        }
        
        // Add all tracks to connection
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        console.log("✅ Local stream added to peer connection");
    }
    
    async createDataChannel(label = 'chat') {
        if (!this.peerConnection) {
            console.error("❌ No peer connection");
            return;
        }
        
        try {
            this.dataChannel = this.peerConnection.createDataChannel(label, {
                ordered: true,
                maxPacketLifeTime: 3000
            });
            
            this.setupDataChannel(this.dataChannel);
            console.log("✅ Data channel created:", label);
            
        } catch (error) {
            console.error("❌ Failed to create data channel:", error);
        }
    }
    
    setupDataChannel(channel) {
        this.dataChannel = channel;
        
        channel.onopen = () => {
            console.log("📨 Data channel opened");
            if (this.onDataChannelOpen) {
                this.onDataChannelOpen(channel);
            }
        };
        
        channel.onclose = () => {
            console.log("📨 Data channel closed");
        };
        
        channel.onerror = (error) => {
            console.error("❌ Data channel error:", error);
        };
        
        channel.onmessage = (event) => {
            console.log("📨 Data channel message:", event.data);
            if (this.onDataChannelMessage) {
                this.onDataChannelMessage(event.data);
            }
        };
    }
    
    sendDataChannelMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
            return true;
        }
        return false;
    }
    
    // ==================== CALL SETUP ====================
    
    async createOffer(options = {}) {
        if (!this.peerConnection) {
            await this.createPeerConnection();
        }
        
        console.log("📝 Creating offer...");
        
        try {
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: options.video || false,
                voiceActivityDetection: true
            };
            
            const offer = await this.peerConnection.createOffer(offerOptions);
            
            // Set local description
            await this.peerConnection.setLocalDescription(offer);
            
            console.log("✅ Offer created:", offer.type);
            return offer;
            
        } catch (error) {
            console.error("❌ Failed to create offer:", error);
            throw error;
        }
    }
    
    async setRemoteDescription(description) {
        if (!this.peerConnection) {
            console.error("❌ No peer connection");
            return;
        }
        
        console.log("📝 Setting remote description...");
        
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(description)
            );
            
            console.log("✅ Remote description set:", description.type);
            
        } catch (error) {
            console.error("❌ Failed to set remote description:", error);
            throw error;
        }
    }
    
    async createAnswer() {
        if (!this.peerConnection) {
            console.error("❌ No peer connection");
            return;
        }
        
        console.log("📝 Creating answer...");
        
        try {
            const answer = await this.peerConnection.createAnswer();
            
            // Set local description
            await this.peerConnection.setLocalDescription(answer);
            
            console.log("✅ Answer created:", answer.type);
            return answer;
            
        } catch (error) {
            console.error("❌ Failed to create answer:", error);
            throw error;
        }
    }
    
    async addIceCandidate(candidate) {
        if (!this.peerConnection) {
            console.error("❌ No peer connection");
            return;
        }
        
        try {
            await this.peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
            
            console.log("✅ ICE candidate added");
            
        } catch (error) {
            console.error("❌ Failed to add ICE candidate:", error);
        }
    }
    
    // ==================== CALL CONTROLS ====================
    
    async toggleAudio(enabled) {
        if (!this.localStream) return;
        
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = enabled;
        });
        
        console.log(enabled ? "🎤 Audio enabled" : "🔇 Audio disabled");
        return enabled;
    }
    
    async toggleVideo(enabled) {
        if (!this.localStream) return;
        
        const videoTracks = this.localStream.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = enabled;
        });
        
        console.log(enabled ? "📹 Video enabled" : "📹 Video disabled");
        return enabled;
    }
    
    async switchCamera() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length < 2) {
            console.log("Only one camera available");
            return;
        }
        
        // Get current facing mode
        const constraints = videoTrack.getConstraints();
        const currentFacingMode = constraints.facingMode || 'user';
        
        // Switch camera
        const newConstraints = {
            video: {
                facingMode: currentFacingMode === 'user' ? 'environment' : 'user'
            }
        };
        
        // Stop old track
        videoTrack.stop();
        
        // Get new track
        const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        // Replace track in peer connection
        const sender = this.peerConnection.getSenders().find(
            s => s.track && s.track.kind === 'video'
        );
        
        if (sender) {
            await sender.replaceTrack(newVideoTrack);
        }
        
        // Replace in local stream
        this.localStream.removeTrack(videoTrack);
        this.localStream.addTrack(newVideoTrack);
        
        console.log("🔄 Camera switched");
        return newVideoTrack;
    }
    
    // ==================== STATS & MONITORING ====================
    
    async getConnectionStats() {
        if (!this.peerConnection) return null;
        
        try {
            const stats = await this.peerConnection.getStats();
            const statsReport = {};
            
            stats.forEach(report => {
                statsReport[report.type] = report;
            });
            
            return this.analyzeStats(statsReport);
            
        } catch (error) {
            console.error("❌ Failed to get stats:", error);
            return null;
        }
    }
    
    analyzeStats(statsReport) {
        const result = {
            audio: {},
            video: {},
            connection: {},
            overallQuality: 'good'
        };
        
        // Extract audio stats
        if (statsReport.inbound-rtp) {
            const audio = statsReport['inbound-rtp'];
            result.audio = {
                packetsReceived: audio.packetsReceived,
                packetsLost: audio.packetsLost,
                jitter: audio.jitter,
                latency: audio.roundTripTime
            };
        }
        
        // Extract video stats
        if (statsReport.inbound-rtp && statsReport.inbound-rtp.kind === 'video') {
            const video = statsReport['inbound-rtp'];
            result.video = {
                framesReceived: video.framesReceived,
                framesDecoded: video.framesDecoded,
                frameRate: video.framesPerSecond,
                resolution: `${video.frameWidth}x${video.frameHeight}`
            };
        }
        
        // Calculate overall quality
        const packetLoss = result.audio.packetsLost / (result.audio.packetsReceived || 1);
        if (packetLoss > 0.1) {
            result.overallQuality = 'poor';
        } else if (packetLoss > 0.05) {
            result.overallQuality = 'average';
        }
        
        return result;
    }
    
    // ==================== UTILITIES ====================
    
    onConnectionEstablished() {
        console.log("🎉 Connection established!");
        
        // Send initial data channel message
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.sendDataChannelMessage({
                type: 'connection_established',
                timestamp: Date.now()
            });
        }
    }
    
    async cleanup() {
        console.log("🧹 Cleaning up WebRTC...");
        
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
        
        // Clear remote stream
        this.remoteStream = null;
        
        // Close data channel
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        console.log("✅ WebRTC cleanup complete");
    }
    
    // ==================== GETTERS ====================
    
    getLocalStream() {
        return this.localStream;
    }
    
    getRemoteStream() {
        return this.remoteStream;
    }
    
    getPeerConnection() {
        return this.peerConnection;
    }
    
    getConnectionState() {
        return this.peerConnection ? this.peerConnection.connectionState : null;
    }
    
    getIceConnectionState() {
        return this.peerConnection ? this.peerConnection.iceConnectionState : null;
    }
    
    isConnected() {
        return this.peerConnection && 
               this.peerConnection.connectionState === 'connected';
    }
    
    // ==================== EVENT HANDLERS ====================
    
    setOnIceCandidate(callback) {
        this.onIceCandidate = callback;
    }
    
    setOnRemoteStream(callback) {
        this.onRemoteStream = callback;
    }
    
    setOnConnectionStateChange(callback) {
        this.onConnectionStateChange = callback;
    }
    
    setOnIceConnectionStateChange(callback) {
        this.onIceConnectionStateChange = callback;
    }
    
    setOnDataChannelMessage(callback) {
        this.onDataChannelMessage = callback;
    }
    
    setOnDataChannelOpen(callback) {
        this.onDataChannelOpen = callback;
    }
}

// Export singleton instance
const webRTCManager = new WebRTCManager();
export default webRTCManager;