// Service Worker Manager - Automatically checks cache and handles updates
// Add this ONE file to your main HTML pages

class ServiceWorkerManager {
    constructor() {
        this.sw = null;
        this.isOnline = navigator.onLine;
        this.registration = null;
        
        this.init();
    }
    
    async init() {
        console.log('🔄 Service Worker Manager initializing...');
        
        // Listen for online/offline changes
        window.addEventListener('online', () => this.updateStatus('online'));
        window.addEventListener('offline', () => this.updateStatus('offline'));
        
        // Register service worker if supported
        if ('serviceWorker' in navigator) {
            try {
                this.registration = await navigator.serviceWorker.register('/service-worker.js', {
                    scope: '/'
                });
                
                console.log('✅ Service Worker registered:', this.registration);
                
                // Wait for service worker to be ready
                if (this.registration.installing) {
                    this.registration.installing.addEventListener('statechange', () => {
                        if (this.registration.active) {
                            this.sw = this.registration.active;
                            this.setupSW();
                        }
                    });
                } else if (this.registration.active) {
                    this.sw = this.registration.active;
                    this.setupSW();
                }
                
                // Listen for service worker updates
                this.registration.addEventListener('updatefound', () => {
                    console.log('🔄 New service worker found!');
                    const newWorker = this.registration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // New update available
                                this.showUpdateNotification();
                            } else {
                                console.log('✅ Service Worker installed for first time');
                            }
                        }
                    });
                });
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
        
        // Initial cache check
        setTimeout(() => this.checkCache(), 2000);
    }
    
    setupSW() {
        console.log('🔗 Service Worker connected');
        
        // Send initial status
        this.sendMessage({ type: 'STATUS', status: this.isOnline ? 'online' : 'offline' });
        
        // Check cache status
        this.sendMessage({ type: 'CHECK_CACHE' }, (response) => {
            console.log('📦 Cache status:', response);
            
            if (!response.offlinePageCached) {
                console.warn('⚠️ Offline page not cached!');
                this.precacheOfflineContent();
            }
        });
        
        // Listen for messages FROM service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📩 Message from SW:', event.data);
            
            switch (event.data.type) {
                case 'SW_ACTIVATED':
                    console.log('✅ SW ready v' + event.data.version);
                    this.sendMessage({ type: 'GET_STATUS' });
                    break;
                    
                case 'SW_READY':
                    console.log('🚀 SW loaded v' + event.data.version);
                    break;
            }
        });
    }
    
    // Send message to service worker
    sendMessage(message, callback) {
        if (!this.sw) {
            console.warn('No service worker connected');
            return;
        }
        
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            
            channel.port1.onmessage = (event) => {
                if (callback) callback(event.data);
                resolve(event.data);
                channel.port1.close();
            };
            
            this.sw.postMessage(message, [channel.port2]);
        });
    }
    
    // Update online/offline status
    updateStatus(status) {
        this.isOnline = status === 'online';
        console.log('📡 Network status:', status);
        
        // Notify service worker
        if (this.sw) {
            this.sendMessage({ type: 'STATUS', status: status });
        }
        
        // Show notification if went offline
        if (status === 'offline') {
            this.showOfflineNotification();
        } else {
            this.hideOfflineNotification();
        }
    }
    
    // Check cache status periodically
    checkCache() {
        if (!this.sw) return;
        
        this.sendMessage({ type: 'GET_STATUS' }, (response) => {
            console.log('🔄 Cache check:', response);
            
            // Check every 30 seconds
            setTimeout(() => this.checkCache(), 30000);
        });
    }
    
    // Force cache offline content
    precacheOfflineContent() {
        console.log('📦 Precaching offline content...');
        
        // List of offline files that MUST be cached
        const offlineFiles = [
            '/offline/index.html',
            '/offline/section1/main.html',
            '/offline/section1/main.css',
            '/offline/section1/main.js',
            '/offline/section1/shayari-data.js',
            '/offline/section2/main.html',
            '/offline/section2/main.css',
            '/offline/section2/main.js',
            '/relay.png'
        ];
        
        // Cache each file
        offlineFiles.forEach(url => {
            fetch(url)
                .then(response => {
                    if (response.ok) {
                        return caches.open('relaytalk-cache-v3-3')
                            .then(cache => cache.put(url, response));
                    }
                })
                .catch(() => {
                    console.warn('Failed to cache:', url);
                });
        });
    }
    
    // Show update notification
    showUpdateNotification() {
        // Create a subtle notification
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #667eea;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                cursor: pointer;
                font-family: Arial, sans-serif;
                font-size: 14px;
            ">
                🔄 New version available! Click to update.
            </div>
        `;
        
        notification.onclick = () => {
            this.sendMessage({ type: 'UPDATE_NOW' });
            window.location.reload();
            notification.remove();
        };
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => notification.remove(), 10000);
    }
    
    // Show offline notification
    showOfflineNotification() {
        if (document.querySelector('.offline-notification')) return;
        
        const notification = document.createElement('div');
        notification.className = 'offline-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #f56565;
                color: white;
                padding: 10px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                font-family: Arial, sans-serif;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                📡 You are offline. Using cached content.
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => notification.remove(), 5000);
    }
    
    hideOfflineNotification() {
        const notification = document.querySelector('.offline-notification');
        if (notification) notification.remove();
    }
    
    // Public methods
    getStatus() {
        return this.sendMessage({ type: 'GET_STATUS' });
    }
    
    getCacheInfo() {
        return this.sendMessage({ type: 'CHECK_CACHE' });
    }
    
    clearCache() {
        return this.sendMessage({ type: 'CLEAR_CACHE' });
    }
    
    updateNow() {
        return this.sendMessage({ type: 'UPDATE_NOW' });
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.SWManager = new ServiceWorkerManager();
});

// Make available globally
window.ServiceWorkerManager = ServiceWorkerManager;

console.log('⚡ Service Worker Manager loaded');