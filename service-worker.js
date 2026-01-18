// RelayTalk Service Worker v2.5
// Handles offline/404 errors with unified error page

const CACHE_NAME = 'relaytalk-cache-v2.6';
const OFFLINE_URL = '/offline/index.html'; // Changed to offline entertainment page
const APP_VERSION = '2.5.0';

// Files to cache immediately - ONLY OFFLINE ENTERTAINMENT PAGES
const PRECACHE_FILES = [
  // ===== OFFLINE ENTERTAINMENT PAGES ONLY =====
  // Main offline page
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
  
  // Video files for TV section (5 videos)
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Service Worker installing v' + APP_VERSION);

  // Skip waiting to activate immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Pre-caching offline entertainment files');
        return cache.addAll(PRECACHE_FILES);
      })
      .then(() => {
        console.log('✅ All offline files pre-cached');
      })
      .catch(error => {
        console.warn('⚠️ Some files failed to cache:', error);
      })
  );
});

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

      // Take control immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated and ready');
    })
  );
});

// ====== FETCH EVENT ======
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Supabase requests
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  // Skip Chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const path = requestUrl.pathname;

  // ====== CRITICAL CHANGE ======
  // 1. Check if it's an offline entertainment file
  // 2. For all other files (app files), don't cache them
  
  if (path.startsWith('/offline/')) {
    // This is an offline entertainment file - serve from cache
    handleOfflineFileRequest(event);
  } else {
    // This is an app file - network only, no caching
    handleAppFileRequest(event);
  }
});

// Handle offline entertainment file requests (CACHE FIRST)
function handleOfflineFileRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('📦 Serving offline file from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache, try network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed, return fallback
            if (event.request.destination === 'image') {
              return new Response('', {
                headers: { 'Content-Type': 'image/svg+xml' }
              });
            }
            return new Response('Offline resource unavailable', {
              status: 404,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
}

// Handle app file requests (NETWORK ONLY, NO CACHING)
function handleAppFileRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // DON'T CACHE app files - this is the key change!
        // When offline, these will fail and trigger the offline page
        return response;
      })
      .catch(async (error) => {
        console.log('🌐 Network failed for app file:', event.request.url);
        
        // Check if it's a page request (HTML)
        const request = event.request;
        const acceptHeader = request.headers.get('Accept') || '';
        const isHtmlRequest = acceptHeader.includes('text/html') || 
                             request.url.endsWith('.html') ||
                             !request.url.includes('.') ||
                             request.url.endsWith('/');
        
        if (isHtmlRequest) {
          // For HTML/page requests, redirect to offline entertainment
          console.log('📴 Offline detected, redirecting to entertainment page');
          
          // Try to get offline page from cache
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }
          
          // Fallback offline page
          return new Response(
            `
            <!DOCTYPE html>
            <html>
            <head>
              <title>You're Offline</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  text-align: center;
                  padding: 50px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  min-height: 100vh;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                }
                h1 {
                  font-size: 3rem;
                  margin-bottom: 20px;
                }
                p {
                  font-size: 1.2rem;
                  margin-bottom: 30px;
                  max-width: 500px;
                }
                a {
                  display: inline-block;
                  padding: 12px 30px;
                  background: white;
                  color: #667eea;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: bold;
                  margin: 10px;
                }
              </style>
            </head>
            <body>
              <h1>📴 You're Offline</h1>
              <p>RelayTalk requires an internet connection. But don't worry! You can still enjoy:</p>
              <a href="/offline/index.html">Entertainment Sections</a>
              <script>
                // Auto-redirect to offline page
                setTimeout(() => {
                  window.location.href = '/offline/index.html';
                }, 2000);
              </script>
            </body>
            </html>
            `,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }
        
        // For non-HTML app files (CSS, JS, images), just fail
        throw error;
      })
  );
}

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  console.log('📩 Message from client:', event.data);

  switch (event.data.type) {
    case 'GET_CACHED_PAGE':
      caches.match(event.data.url)
        .then(response => {
          event.ports[0].postMessage({
            success: !!response,
            url: event.data.url
          });
        });
      break;

    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(success => {
          event.ports[0].postMessage({
            success: success,
            message: 'Cache cleared'
          });
        });
      break;

    case 'GET_CACHE_INFO':
      caches.has(CACHE_NAME)
        .then(hasCache => {
          caches.open(CACHE_NAME)
            .then(cache => cache.keys())
            .then(keys => {
              event.ports[0].postMessage({
                version: APP_VERSION,
                hasCache: hasCache,
                cachedItems: keys.length,
                cacheName: CACHE_NAME,
                cachedFiles: keys.map(k => k.url)
              });
            });
        });
      break;

    case 'UPDATE_NOW':
      self.skipWaiting();
      self.registration.update();
      event.ports[0].postMessage({ updating: true });
      break;

    case 'PING':
      event.ports[0].postMessage({ pong: true, version: APP_VERSION });
      break;
  }
});

// ====== BACKGROUND SYNC ======
self.addEventListener('sync', event => {
  console.log('🔄 Background sync:', event.tag);

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineMessages());
  }
});

async function syncOfflineMessages() {
  try {
    const cache = await caches.open('offline-messages');
    const requests = await cache.keys();

    console.log(`📨 Syncing ${requests.length} offline messages`);

    for (const request of requests) {
      try {
        const response = await cache.match(request);
        const message = await response.json();

        // Try to send message
        const sendResponse = await fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });

        if (sendResponse.ok) {
          await cache.delete(request);
          console.log('✅ Message sent:', message);
        }
      } catch (error) {
        console.log('❌ Failed to send message:', error);
      }
    }
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

// ====== PUSH NOTIFICATIONS ======
self.addEventListener('push', event => {
  console.log('📱 Push received');

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'RelayTalk', body: 'New message' };
  }

  const options = {
    body: data.body || 'You have a new message',
    icon: '/relay.png',
    badge: '/relay.png',
    tag: 'relaytalk-message',
    data: { url: data.url || '/' },
    actions: [
      {
        action: 'open',
        title: 'Open Chat'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'RelayTalk', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window
        for (const client of clientList) {
          if (client.url.includes('relaytalk') && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});

// ====== PERIODIC SYNC ======
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    console.log('🔄 Periodic cache update');
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);

    // Update only offline entertainment files
    const offlineFiles = [
      '/offline/index.html',
      '/offline/section1/main.html',
      '/offline/section2/main.html'
    ];

    for (const url of offlineFiles) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          await cache.put(url, response);
          console.log('✅ Updated offline file:', url);
        }
      } catch (error) {
        console.log('⚠️ Failed to update offline file:', url);
      }
    }
  } catch (error) {
    console.error('❌ Cache update failed:', error);
  }
}

// ====== ERROR HANDLING ======
self.addEventListener('error', event => {
  console.error('💥 Service Worker error:', event.error);
  event.preventDefault();
});

// ====== SERVICE WORKER STARTUP ======
console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');