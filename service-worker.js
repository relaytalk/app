// RelayTalk Service Worker v3.6
// Fixed video caching and playback

const CACHE_NAME = 'relaytalk-cache-v3-6';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '3.6.0';

// Videos that MUST be cached
const OFFLINE_VIDEOS = [
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// Core app files + offline entertainment
const PRECACHE_FILES = [
  // ===== CORE APP FILES =====
  '/',
  '/index.html',
  '/style.css',
  '/opening.css',
  '/relay.png',
  '/manifest.json',

  // ===== OFFLINE ENTERTAINMENT (MUST BE CACHED) =====
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

  // ===== APP PAGES =====
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
  '/pages/chats/recieve.mp3'
];

// Track if we're online
let isOnline = true;
let videosCached = false;

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Installing Service Worker v' + APP_VERSION);
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Pre-caching ' + PRECACHE_FILES.length + ' files');
        
        // Cache OFFLINE PAGE FIRST - Most important!
        const offlineFirst = [
          OFFLINE_URL,
          '/',
          '/index.html',
          '/offline/section1/main.html',
          '/offline/section2/main.html'
        ];
        
        return cache.addAll(offlineFirst)
          .then(() => {
            console.log('✅ Offline pages cached');
            
            // Cache videos with special handling
            return cacheVideos(cache);
          })
          .then(() => {
            // Cache remaining files in background
            const remaining = PRECACHE_FILES.filter(f => 
              !offlineFirst.includes(f) && !OFFLINE_VIDEOS.includes(f)
            );
            
            const promises = remaining.map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) {
                    console.log('✅ Cached:', url);
                    return cache.put(url, response);
                  }
                  throw new Error('Bad response');
                })
                .catch(error => {
                  console.warn('⚠️ Failed to cache:', url, error);
                });
            });
            
            return Promise.all(promises);
          });
      })
      .then(() => {
        console.log('✅ All files cached successfully');
        videosCached = true;
        return self.skipWaiting();
      })
  );
});

// Special function to cache videos with progress
function cacheVideos(cache) {
  console.log('🎬 Caching ' + OFFLINE_VIDEOS.length + ' videos...');
  
  const videoPromises = OFFLINE_VIDEOS.map((videoUrl, index) => {
    return new Promise((resolve, reject) => {
      fetch(videoUrl, {
        // CRITICAL: Add these headers for video caching
        headers: new Headers({
          'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
        })
      })
        .then(response => {
          if (!response.ok) throw new Error('Video not found');
          
          // Clone response for caching
          const clone = response.clone();
          
          // Put in cache with video headers
          return cache.put(videoUrl, clone)
            .then(() => {
              console.log(`✅ Video ${index + 1}/${OFFLINE_VIDEOS.length} cached: ${videoUrl.split('/').pop()}`);
              resolve(true);
            });
        })
        .catch(error => {
          console.warn(`⚠️ Failed to cache video ${videoUrl}:`, error);
          resolve(false); // Don't reject, just skip
        });
    });
  });
  
  return Promise.all(videoPromises)
    .then(results => {
      const successCount = results.filter(r => r).length;
      console.log(`🎉 ${successCount}/${OFFLINE_VIDEOS.length} videos cached!`);
      videosCached = successCount > 0;
      return successCount;
    });
}

// ====== ACTIVATE EVENT ======
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      
      // Check video cache status
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const cachedVideos = keys.filter(k => k.url.endsWith('.mp4')).length;
          
          console.log(`📊 Video cache: ${cachedVideos}/${OFFLINE_VIDEOS.length} videos`);
          
          if (cachedVideos < OFFLINE_VIDEOS.length) {
            console.log('🔄 Re-caching missing videos...');
            return caches.open(CACHE_NAME)
              .then(cache => cacheVideos(cache));
          }
        }),
      
      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated');
      
      // Notify all pages about cache status
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
            videosCached: videosCached
          });
        });
      });
    })
  );
});

// ====== FETCH EVENT ======
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  // Skip Supabase requests
  if (event.request.url.includes('supabase.co')) return;
  
  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  const path = url.pathname;
  
  // === FIX: Handle broken section paths ===
  if ((path.includes('/section1/') || path.includes('/section2/')) && !path.startsWith('/offline/')) {
    console.log('🔄 Fixing broken section path:', path);
    
    const sectionMatch = path.match(/\/(section[12]\/[^\/]+)$/);
    if (sectionMatch) {
      const fixedPath = '/offline/' + sectionMatch[1];
      console.log('✅ Redirecting to:', fixedPath);
      
      event.respondWith(
        caches.match(fixedPath)
          .then(cached => {
            if (cached) return cached;
            return fetch(fixedPath);
          })
          .catch(() => {
            return caches.match(OFFLINE_URL)
              .then(offlinePage => {
                return new Response(offlinePage.body, {
                  status: 200,
                  headers: offlinePage.headers
                });
              });
          })
      );
      return;
    }
  }
  
  // === SPECIAL HANDLING FOR VIDEOS ===
  if (OFFLINE_VIDEOS.includes(path)) {
    console.log('🎬 Handling video request:', path);
    
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            console.log('✅ Serving video from cache');
            
            // Fix for video range requests (important for video playback)
            const range = event.request.headers.get('range');
            if (range) {
              return handleRangeRequest(cached, range);
            }
            
            return cached;
          }
          
          // If not in cache, fetch from network
          console.log('🌐 Fetching video from network');
          return fetch(event.request, {
            headers: new Headers({
              'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
            })
          })
            .then(response => {
              if (response.ok) {
                // Cache for next time
                const clone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, clone));
              }
              return response;
            })
            .catch(error => {
              console.error('❌ Video fetch failed:', error);
              return new Response('Video not available offline', {
                status: 404,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
    return;
  }
  
  // Check if it's an offline entertainment file
  if (path.startsWith('/offline/')) {
    // Always serve offline files from cache first
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) return cached;
          return fetch(event.request);
        })
    );
    return;
  }
  
  // === FOR ALL OTHER REQUESTS (App pages) ===
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Network successful - we're online
        isOnline = true;
        
        // Cache fresh response
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        
        return response;
      })
      .catch(async () => {
        // Network failed - we're offline
        isOnline = false;
        
        console.log('📴 Offline detected on:', path);
        
        // Check if it's a PAGE request
        const accept = event.request.headers.get('Accept') || '';
        const isPageRequest = accept.includes('text/html') || 
                             path.endsWith('.html') ||
                             path === '/' ||
                             !path.includes('.');
        
        if (isPageRequest) {
          // === CRITICAL: ALWAYS REDIRECT TO OFFLINE PAGE WHEN OFFLINE ===
          console.log('🔄 Redirecting to offline entertainment');
          return caches.match(OFFLINE_URL)
            .then(offlinePage => {
              if (offlinePage) {
                // Return the offline page with 200 status
                return new Response(offlinePage.body, {
                  status: 200,
                  statusText: 'OK',
                  headers: offlinePage.headers
                });
              }
              
              // Fallback if offline page not in cache
              return new Response(
                `<html>
                  <head><title>Offline Entertainment</title></head>
                  <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>🎬 RelayTalk Offline Mode</h1>
                    <p>Enjoy offline entertainment while you're disconnected!</p>
                    <div style="margin: 30px;">
                      <a href="/offline/index.html" 
                         style="background: #667eea; color: white; padding: 12px 24px; 
                                border-radius: 6px; text-decoration: none; display: inline-block;">
                        Open Entertainment Hub
                      </a>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      Videos cached: ${videosCached ? '✅' : '⏳'}
                    </p>
                  </body>
                </html>`,
                { 
                  headers: { 'Content-Type': 'text/html' },
                  status: 200
                }
              );
            });
        }
        
        // For assets (CSS, JS, images), try cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        
        // Fallback for assets
        if (path.endsWith('.css')) {
          return new Response('/* Offline fallback */', {
            headers: { 'Content-Type': 'text/css' }
          });
        }
        
        if (path.endsWith('.js')) {
          return new Response('// Offline fallback', {
            headers: { 'Content-Type': 'text/javascript' }
          });
        }
        
        if (event.request.destination === 'image') {
          return caches.match('/relay.png');
        }
        
        return new Response('', { status: 404 });
      })
  );
});

// Helper function to handle video range requests
function handleRangeRequest(cachedResponse, range) {
  const contentRange = cachedResponse.headers.get('Content-Range');
  const contentLength = cachedResponse.headers.get('Content-Length');
  
  // If cached response already has range support, return it
  if (contentRange) {
    return cachedResponse;
  }
  
  // Otherwise, create a range response manually
  return cachedResponse.arrayBuffer()
    .then(buffer => {
      const bytes = /^bytes=(\d+)-(\d+)?$/g.exec(range);
      if (bytes) {
        const start = parseInt(bytes[1]);
        const end = bytes[2] ? parseInt(bytes[2]) : buffer.byteLength - 1;
        
        const slicedBuffer = buffer.slice(start, end + 1);
        const slicedResponse = new Response(slicedBuffer, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': slicedBuffer.byteLength,
            'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000'
          }
        });
        
        return slicedResponse;
      }
      
      // If range header is invalid, return full response
      return cachedResponse;
    });
}

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  console.log('📩 Message:', event.data);
  
  switch (event.data.type) {
    case 'GET_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const videoCount = keys.filter(k => k.url.endsWith('.mp4')).length;
          
          event.ports[0].postMessage({
            version: APP_VERSION,
            online: isOnline,
            cacheName: CACHE_NAME,
            totalCached: keys.length,
            videosCached: videoCount,
            totalVideos: OFFLINE_VIDEOS.length,
            offlineCached: keys.some(k => k.url.includes(OFFLINE_URL))
          });
        });
      break;
      
    case 'CHECK_CACHE':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const appFiles = keys.filter(k => !k.url.includes('/offline/')).length;
          const offlineFiles = keys.filter(k => k.url.includes('/offline/') && !k.url.endsWith('.mp4')).length;
          const videos = keys.filter(k => k.url.endsWith('.mp4')).length;
          
          event.ports[0].postMessage({
            total: keys.length,
            appFiles: appFiles,
            offlineFiles: offlineFiles,
            videos: videos,
            totalVideos: OFFLINE_VIDEOS.length,
            offlinePageCached: keys.some(k => k.url.includes(OFFLINE_URL)),
            videosCached: videos >= OFFLINE_VIDEOS.length
          });
        });
      break;
      
    case 'CACHE_VIDEOS':
      console.log('🔄 Manually caching videos...');
      caches.open(CACHE_NAME)
        .then(cache => cacheVideos(cache))
        .then(successCount => {
          event.ports[0].postMessage({
            success: true,
            message: `${successCount}/${OFFLINE_VIDEOS.length} videos cached successfully`
          });
        })
        .catch(error => {
          event.ports[0].postMessage({
            success: false,
            message: 'Video caching failed: ' + error.message
          });
        });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(success => {
          videosCached = false;
          event.ports[0].postMessage({
            success: success,
            message: 'Cache cleared'
          });
        });
      break;
      
    case 'UPDATE_NOW':
      self.skipWaiting();
      self.registration.update();
      event.ports[0].postMessage({ updating: true });
      break;
      
    case 'PING':
      event.ports[0].postMessage({ 
        pong: true, 
        version: APP_VERSION,
        online: isOnline,
        videosCached: videosCached
      });
      break;
      
    case 'STATUS':
      if (event.data.status === 'online') isOnline = true;
      if (event.data.status === 'offline') isOnline = false;
      break;
  }
});

console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');
console.log('🎬 Video caching enabled for ' + OFFLINE_VIDEOS.length + ' videos');