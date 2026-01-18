// RelayTalk Service Worker v3.2
// Caches all files but redirects to offline page when offline
const CACHE_NAME = 'relaytalk-v3-2';
const APP_VERSION = '3.2.0';
const OFFLINE_REDIRECT = '/offline/index.html';

// Files to cache - EVERYTHING
const PRECACHE_FILES = [
  // ===== MAIN APP FILES =====
  '/',
  '/index.html',
  '/style.css',
  '/opening.css',
  '/relay.png',
  '/manifest.json',
  
  // Auth pages
  '/pages/auth/index.html',
  '/pages/auth/style.css',
  '/pages/auth/script.js',
  
  // Login pages
  '/pages/login/index.html',
  '/pages/login/style.css',
  '/pages/login/script.js',
  
  // Home pages
  '/pages/home/index.html',
  '/pages/home/style.css',
  '/pages/home/script.js',
  
  // Friends pages
  '/pages/home/friends/index.html',
  '/pages/home/friends/style.css',
  '/pages/home/friends/script.js',
  
  // Chat pages
  '/pages/chats/index.html',
  '/pages/chats/style.css',
  '/pages/chats/script.js',
  '/pages/chats/chat-responsive.css',
  '/pages/chats/sent.mp3',
  '/pages/chats/recieve.mp3',
  
  // ===== OFFLINE ENTERTAINMENT FILES =====
  '/offline/index.html',
  
  // Shayari Section
  '/offline/section1/main.html',
  '/offline/section1/main.css',
  '/offline/section1/main.js',
  '/offline/section1/shayari-data.js',
  
  // TV Section
  '/offline/section2/main.html',
  '/offline/section2/main.css',
  '/offline/section2/main.js',
  
  // Videos
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// Track if we're online
let isOnline = true;

// ====== INSTALL ======
self.addEventListener('install', event => {
  console.log('📦 Installing Service Worker v' + APP_VERSION);
  
  // Cache all files
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching', PRECACHE_FILES.length, 'files...');
        
        // Cache critical files first
        const criticalFiles = [
          '/',
          '/index.html',
          OFFLINE_REDIRECT,
          '/offline/section1/main.html',
          '/offline/section2/main.html'
        ];
        
        return cache.addAll(criticalFiles)
          .then(() => {
            console.log('Critical files cached');
            
            // Cache other files in background
            const otherFiles = PRECACHE_FILES.filter(f => !criticalFiles.includes(f));
            const cachePromises = otherFiles.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response);
                  }
                  console.warn('Skipping (not ok):', url);
                })
                .catch(() => {
                  console.warn('Skipping (fetch failed):', url);
                });
            });
            
            return Promise.all(cachePromises);
          });
      })
      .then(() => {
        console.log('✅ All files cached');
        self.skipWaiting();
      })
  );
});

// ====== ACTIVATE ======
self.addEventListener('activate', event => {
  console.log('🔄 Activating Service Worker');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              return caches.delete(cache);
            }
          })
        );
      }),
      
      // Take control
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ready');
      
      // Notify all pages
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_READY',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// ====== FETCH ======
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;
  
  // Skip non-GET and external requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  
  // Check if it's an offline entertainment file
  if (path.startsWith('/offline/')) {
    // Always serve offline files from cache
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request);
        })
    );
    return;
  }
  
  // For ALL OTHER FILES (app files):
  event.respondWith(
    // First try network
    fetch(event.request)
      .then(response => {
        // Network successful - we're online
        isOnline = true;
        
        // Update cache with fresh version
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        
        return response;
      })
      .catch(() => {
        // Network failed - we're offline
        isOnline = false;
        
        // Check if it's a PAGE request (HTML)
        const accept = event.request.headers.get('Accept') || '';
        const isPageRequest = accept.includes('text/html') || 
                             path.endsWith('.html') ||
                             path === '/' ||
                             !path.includes('.');
        
        if (isPageRequest) {
          console.log('📴 Offline - Redirecting to entertainment page');
          
          // REDIRECT TO OFFLINE PAGE (not the cached app page)
          return caches.match(OFFLINE_REDIRECT)
            .then(offlinePage => {
              if (offlinePage) {
                return offlinePage;
              }
              
              // Fallback if offline page not cached
              return new Response(
                `<h1>You're Offline</h1>
                 <p>Enjoy offline entertainment:</p>
                 <a href="/offline/index.html">Open Entertainment</a>`,
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
        }
        
        // For non-page files (CSS, JS, images), serve from cache
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            
            // Not in cache either
            if (path.endsWith('.css')) {
              return new Response('/* Offline */', { 
                headers: { 'Content-Type': 'text/css' } 
              });
            }
            
            if (path.endsWith('.js')) {
              return new Response('// Offline', { 
                headers: { 'Content-Type': 'text/javascript' } 
              });
            }
            
            return new Response('', { status: 404 });
          });
      })
  );
});

// ====== MESSAGES ======
self.addEventListener('message', event => {
  switch (event.data.type) {
    case 'GET_STATUS':
      event.ports[0].postMessage({
        version: APP_VERSION,
        online: isOnline,
        cacheName: CACHE_NAME
      });
      break;
      
    case 'CHECK_CACHE':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const appFiles = keys.filter(k => !k.url.includes('/offline/')).length;
          const offlineFiles = keys.filter(k => k.url.includes('/offline/')).length;
          const videos = keys.filter(k => k.url.endsWith('.mp4')).length;
          
          event.ports[0].postMessage({
            total: keys.length,
            appFiles: appFiles,
            offlineFiles: offlineFiles,
            videos: videos,
            offlinePageCached: keys.some(k => k.url.includes(OFFLINE_REDIRECT))
          });
        });
      break;
  }
});

// Track online/offline status
self.addEventListener('message', event => {
  if (event.data === 'online') isOnline = true;
  if (event.data === 'offline') isOnline = false;
});

console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');