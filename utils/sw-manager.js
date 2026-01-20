// Service Worker Manager v3.1 - Fixed Progress Overlay
class ServiceWorkerManager {
    constructor() {
        this.sw = null;
        this.isOnline = navigator.onLine;
        this.registration = null;
        this.cacheInfo = null;
        this.cacheProgress = {
            percentage: 0,
            isCaching: false,
            currentFile: ''
        };
        
        this.init();
    }
    
    async init() {
        console.log('⚡ SW Manager v3.1 initializing...');
        
        // Listen for online/offline changes
        window.addEventListener('online', () => this.updateStatus('online'));
        window.addEventListener('offline', () => this.updateStatus('offline'));
        
        // Auto-cache videos when online
        if (this.isOnline) {
            setTimeout(() => this.autoCacheVideos(), 3000);
        }
        
        // Register service worker
        await this.registerSW();
        
        // Add cache button to TV section
        this.addCacheButton();
    }
    
    async registerSW() {
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ Service Workers not supported');
            return;
        }
        
        try {
            this.registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });
            
            console.log('✅ Service Worker registered');
            
            // Setup service worker
            this.setupSW();
            
        } catch (error) {
            console.error('❌ SW registration failed:', error);
        }
    }
    
    setupSW() {
        if (this.registration.active) {
            this.sw = this.registration.active;
            this.setupMessageHandler();
            this.checkCacheStatus();
        }
    }
    
    setupMessageHandler() {
        navigator.serviceWorker.addEventListener('message', event => {
            const { type, progress } = event.data;
            
            switch (type) {
                case 'CACHE_PROGRESS':
                    this.handleProgressUpdate(progress);
                    break;
                    
                case 'SW_READY':
                    console.log('🚀 SW ready:', event.data.version);
                    break;
                    
                case 'CHECK_VIDEOS':
                    this.checkAndAutoCache();
                    break;
            }
        });
    }
    
    handleProgressUpdate(progress) {
        this.cacheProgress = progress;
        this.updateProgressUI();
        
        // Auto-close overlay when complete
        if (progress.percentage === 100 && !progress.isCaching) {
            setTimeout(() => {
                this.hideProgressOverlay();
            }, 2000); // Show completion message for 2 seconds
        }
    }
    
    // Auto-cache videos when online
    async autoCacheVideos() {
        if (!this.isOnline) return;
        
        try {
            const status = await this.getStatus();
            if (status && status.videosCached < 5) {
                console.log(`🔄 Auto-caching videos (${status.videosCached}/5 cached)`);
                await this.sendMessage({ type: 'AUTO_CACHE_VIDEOS' });
            }
        } catch (error) {
            console.warn('Auto-cache check failed:', error);
        }
    }
    
    checkAndAutoCache() {
        if (this.isOnline && this.cacheInfo && this.cacheInfo.videosCached < 5) {
            this.autoCacheVideos();
        }
    }
    
    // Add cache button to TV section
    addCacheButton() {
        // Check if we're in the TV section
        if (!window.location.pathname.includes('/offline/section2/')) {
            return;
        }
        
        // Add button after a short delay to ensure DOM is ready
        setTimeout(() => {
            const cacheButton = this.createCacheButton();
            const remote = document.querySelector('.tv-remote');
            
            if (remote) {
                remote.appendChild(cacheButton);
                this.createProgressOverlay();
            }
        }, 1000);
    }
    
    createCacheButton() {
        const button = document.createElement('button');
        button.className = 'cache-now-btn';
        button.innerHTML = `
            <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Cache Videos</span>
        `;
        
        button.onclick = () => this.startCaching();
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .cache-now-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 20px;
                width: 100%;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            
            .cache-now-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            }
            
            .cache-now-btn.caching {
                background: linear-gradient(135deg, #4caf50, #2e7d32);
                animation: pulse 1.5s infinite;
            }
            
            .cache-icon {
                transition: transform 0.3s ease;
            }
            
            .cache-now-btn.caching .cache-icon {
                animation: spin 2s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            .cache-progress-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(10px);
                z-index: 9999;
                display: none;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                color: white;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .cache-progress-overlay.active {
                display: flex;
                opacity: 1;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            .progress-container {
                background: rgba(30, 41, 59, 0.95);
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 500px;
                width: 90%;
                border: 2px solid rgba(102, 126, 234, 0.5);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .progress-title {
                font-size: 24px;
                margin-bottom: 20px;
                color: #667eea;
            }
            
            .progress-bar {
                width: 100%;
                height: 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                overflow: hidden;
                margin: 20px 0;
                position: relative;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 10px;
                transition: width 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .progress-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, 
                    transparent 0%, 
                    rgba(255, 255, 255, 0.2) 50%, 
                    transparent 100%);
                animation: shimmer 2s infinite;
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            .progress-text {
                font-size: 24px;
                font-weight: bold;
                margin: 10px 0;
                color: #f8fafc;
            }
            
            .progress-file {
                font-size: 14px;
                color: #94a3b8;
                margin-top: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
            }
            
            .progress-stats {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
                font-size: 14px;
                color: #cbd5e1;
            }
            
            .cache-complete {
                text-align: center;
                animation: celebrate 0.5s ease;
            }
            
            @keyframes celebrate {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
            }
            
            .complete-icon {
                font-size: 60px;
                color: #4caf50;
                margin-bottom: 20px;
                animation: bounce 1s ease infinite;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            .close-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 20px;
                transition: all 0.3s ease;
            }
            
            .close-btn:hover {
                background: #764ba2;
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
        
        return button;
    }
    
    createProgressOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'cache-progress-overlay';
        overlay.innerHTML = `
            <div class="progress-container">
                <div class="progress-title">📦 Caching Videos & Files</div>
                <div class="progress-text" id="progress-percent">0%</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-file" id="progress-file">Getting ready...</div>
                <div class="progress-stats">
                    <div id="progress-stats">0 files • 0/5 videos</div>
                    <div id="cache-speed">Ready</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.progressOverlay = overlay;
    }
    
    updateProgressUI() {
        const { percentage, currentFile, isCaching, completed, total } = this.cacheProgress;
        
        // Update button
        const button = document.querySelector('.cache-now-btn');
        if (button) {
            if (isCaching) {
                button.classList.add('caching');
                button.innerHTML = `
                    <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    <span>Caching... ${percentage}%</span>
                `;
            } else {
                button.classList.remove('caching');
                button.innerHTML = `
                    <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    <span>Cache Videos</span>
                `;
            }
        }
        
        // Update overlay
        if (this.progressOverlay) {
            const percentEl = this.progressOverlay.querySelector('#progress-percent');
            const fillEl = this.progressOverlay.querySelector('#progress-fill');
            const fileEl = this.progressOverlay.querySelector('#progress-file');
            const statsEl = this.progressOverlay.querySelector('#progress-stats');
            
            if (percentEl) percentEl.textContent = `${percentage}%`;
            if (fillEl) fillEl.style.width = `${percentage}%`;
            
            if (fileEl) {
                const fileName = currentFile.split('/').pop();
                fileEl.textContent = fileName ? `Caching: ${fileName}` : 'Getting ready...';
            }
            
            if (statsEl) {
                statsEl.textContent = `${completed}/${total} files`;
            }
            
            // Show/hide overlay
            if (isCaching && percentage < 100) {
                this.progressOverlay.classList.add('active');
            }
        }
    }
    
    showCompletionMessage() {
        if (!this.progressOverlay) return;
        
        const container = this.progressOverlay.querySelector('.progress-container');
        container.innerHTML = `
            <div class="cache-complete">
                <div class="complete-icon">🎉</div>
                <h2 style="margin: 10px 0; color: #4caf50;">Caching Complete!</h2>
                <p style="color: #cbd5e1; margin: 10px 0;">All videos and files are now cached.</p>
                <p style="color: #94a3b8; font-size: 14px;">You can now enjoy all content offline.</p>
                <button class="close-btn" onclick="window.SWManager?.hideProgressOverlay()">Close</button>
            </div>
        `;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideProgressOverlay();
        }, 5000);
    }
    
    hideProgressOverlay() {
        if (this.progressOverlay) {
            this.progressOverlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                this.progressOverlay.classList.remove('active');
                this.progressOverlay.style.animation = '';
                
                // Reset button
                const button = document.querySelector('.cache-now-btn');
                if (button) {
                    button.classList.remove('caching');
                    button.innerHTML = `
                        <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"/>
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        </svg>
                        <span>Cached ✓</span>
                    `;
                    
                    // Revert after 5 seconds
                    setTimeout(() => {
                        button.innerHTML = `
                            <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            <span>Cache Videos</span>
                        `;
                    }, 5000);
                }
            }, 300);
        }
    }
    
    async startCaching() {
        if (!this.isOnline) {
            this.showNotification('Cannot cache while offline', 'error');
            return;
        }
        
        if (this.cacheProgress.isCaching) {
            this.showNotification('Cache already in progress', 'info');
            return;
        }
        
        console.log('🚀 Starting cache process...');
        
        try {
            const result = await this.sendMessage({ type: 'CACHE_ALL' });
            
            if (result.success) {
                console.log('✅ Cache completed:', result.message);
                // Progress updates come via messages
            } else {
                this.showNotification('Cache failed: ' + result.message, 'error');
                this.hideProgressOverlay();
            }
        } catch (error) {
            console.error('❌ Cache error:', error);
            this.showNotification('Cache failed', 'error');
            this.hideProgressOverlay();
        }
    }
    
    updateStatus(status) {
        this.isOnline = status === 'online';
        this.sendMessage({ type: 'STATUS', status: status });
        
        if (status === 'online') {
            this.showNotification('✅ Back online', 'success', 2000);
            this.autoCacheVideos();
        } else {
            this.showNotification('📡 You are offline', 'warning', 3000);
        }
    }
    
    async checkCacheStatus() {
        try {
            const status = await this.sendMessage({ type: 'GET_STATUS' });
            this.cacheInfo = status;
            
            console.log('📊 Cache status:', status);
            
            // Update cache button if exists
            const button = document.querySelector('.cache-now-btn');
            if (button && status.totalCached > 0) {
                const isComplete = status.videosCached === 5;
                
                if (isComplete) {
                    button.innerHTML = `
                        <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"/>
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        </svg>
                        <span>${status.videosCached}/5 videos cached</span>
                    `;
                    button.style.background = 'linear-gradient(135deg, #4caf50, #2e7d32)';
                } else {
                    button.innerHTML = `
                        <svg class="cache-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/>
                            <polyline points="7 3 7 8 15 8"/>
                        </svg>
                        <span>Cache Videos (${status.videosCached}/5)</span>
                    `;
                }
            }
        } catch (error) {
            console.warn('Cache check failed:', error);
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${this.getColor(type)};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9998;
                animation: slideIn 0.3s ease;
                font-family: 'Segoe UI', sans-serif;
            ">
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    getColor(type) {
        const colors = {
            success: '#4caf50',
            error: '#f44336',
            info: '#2196f3',
            warning: '#ff9800'
        };
        return colors[type] || colors.info;
    }
    
    sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.sw) {
                reject(new Error('No service worker'));
                return;
            }
            
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
                resolve(event.data);
                channel.port1.close();
            };
            
            this.sw.postMessage(message, [channel.port2]);
        });
    }
    
    // Public methods
    async getStatus() {
        return this.sendMessage({ type: 'GET_STATUS' });
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!window.SWManager) {
        window.SWManager = new ServiceWorkerManager();
    }
});

// Global helper
window.RelaySW = {
    cacheAll: () => window.SWManager?.startCaching(),
    getStatus: () => window.SWManager?.getStatus(),
    hideProgress: () => window.SWManager?.hideProgressOverlay()
};

console.log('⚡ Service Worker Manager v3.1 loaded');