// RelayTalk Service Worker v4.1 - Fixed Game Caching
const CACHE_NAME = 'relaytalk-cache-v4-6';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '4.6.0';

// ====== ACTUAL GAME FILES (FROM YOUR FOLDER) ======
const CAR_GAME_FILES = [
  '/cargame/index.html',
  '/cargame/style.css',
  '/cargame/script.js',
  '/cargame/manifest.json',
  '/cargame/service-worker.js',
  '/cargame/cargame192.png',
  '/cargame/cargame512.png',
  '/cargame/cargamebg.mp3',
  '/cargame/shieldcargame.mp3'
];

// ====== ALL FILES TO CACHE ======
const FILES_TO_CACHE = [
  // Essential app files
  '/',
  '/index.html',
  '/offline/index.html',
  '/relay.png',
  
  // Car Game Files (Auto-cached)
  '/cargame',  // Root path
  ...CAR_GAME_FILES
];

// Track caching progress
let cacheProgress = {
  total: FILES_TO_CACHE.length,
  completed: 0,
  currentFile: '',
  isCaching: false
};

let isOnline = true;

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Installing Service Worker v' + APP_VERSION);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache essential files immediately
        const essentialFiles = [
          '/',
          '/index.html',
          '/offline/index.html',
          '/relay.png'
        ];

        return cache.addAll(essentialFiles)
          .then(() => {
            console.log('✅ Essential files cached');
            
            // Start auto-caching game in background
            setTimeout(() => {
              autoCacheGameFiles();
            }, 1000);
          });
      })
  );
});

// ====== ACTIVATE EVENT ======
self.addEventListener('activate', event => {
  console.log('🔄 Activating Service Worker v' + APP_VERSION);

  event.waitUntil(
    Promise.all([
      // Clean old caches
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
      
      self.clients.claim(),
      
      // Auto-cache game after activation
      new Promise(resolve => {
        setTimeout(() => {
          if (isOnline) {
            autoCacheGameFiles();
          }
          resolve();
        }, 3000);
      })
    ]).then(() => {
      console.log('✅ Service Worker ready');
      
      // Notify all clients
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

// ====== AUTO-CACHE GAME FUNCTION ======
async function autoCacheGameFiles() {
  if (!isOnline) {
    console.log('⚠️ Cannot cache - offline');
    return { success: false, message: 'Offline' };
  }

  if (cacheProgress.isCaching) {
    console.log('⚠️ Already caching');
    return { success: false, message: 'Already in progress' };
  }

  cacheProgress.isCaching = true;
  cacheProgress.currentFile = 'Starting...';
  cacheProgress.completed = 0;
  cacheProgress.total = CAR_GAME_FILES.length;

  console.log('🚗 Starting auto-cache of car game...');
  console.log('Game files to cache:', CAR_GAME_FILES);
  
  // Broadcast start
  broadcastProgress();

  try {
    const cache = await caches.open(CACHE_NAME);
    let cachedCount = 0;
    let failedCount = 0;

    // Cache each game file
    for (let i = 0; i < CAR_GAME_FILES.length; i++) {
      const fileUrl = CAR_GAME_FILES[i];
      cacheProgress.currentFile = fileUrl;
      cacheProgress.completed = i + 1;
      
      broadcastProgress();

      try {
        // Check if already cached
        const alreadyCached = await cache.match(fileUrl);
        if (alreadyCached) {
          console.log(`✅ Already cached: ${fileUrl}`);
          cachedCount++;
          continue;
        }

        // Fetch and cache
        const response = await fetch(fileUrl, {
          headers: {
            'Accept': '*/*'
          }
        });

        if (response.ok) {
          await cache.put(fileUrl, response);
          console.log(`✅ Cached: ${fileUrl}`);
          cachedCount++;
        } else {
          console.warn(`⚠️ Failed to fetch: ${fileUrl} (${response.status})`);
          failedCount++;
        }
      } catch (error) {
        console.warn(`⚠️ Error caching ${fileUrl}:`, error.message);
        failedCount++;
      }

      // Small delay between files
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Complete
    cacheProgress.isCaching = false;
    cacheProgress.currentFile = 'Complete!';
    cacheProgress.completed = CAR_GAME_FILES.length;
    
    console.log(`🎮 Game caching complete: ${cachedCount} files cached, ${failedCount} failed`);

    // Broadcast completion
    broadcastProgress();

    // Notify clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'GAME_CACHED',
          success: true,
          cachedCount: cachedCount,
          totalCount: CAR_GAME_FILES.length
        });
      });
    });

    return {
      success: true,
      message: `Cached ${cachedCount}/${CAR_GAME_FILES.length} game files`,
      cachedCount: cachedCount,
      failedCount: failedCount
    };

  } catch (error) {
    cacheProgress.isCaching = false;
    console.error('❌ Game caching failed:', error);
    
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'GAME_CACHE_ERROR',
          error: error.message
        });
      });
    });

    return { success: false, message: error.message };
  }
}

// ====== FETCH EVENT - UPDATED FOR DIRECT REDIRECT ======
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  
  console.log('🔄 Fetch:', path);

  // ====== REDIRECT TO CAR GAME OFFLINE ======
  // Agar user offline hai aur main site pe hai, directly game pe redirect karo
  if ((path === '/' || path === '/index.html') && !isOnline) {
    console.log('📴 Offline - redirecting to car game...');
    event.respondWith(
      caches.match('/cargame/index.html')
        .then(cachedGame => {
          if (cachedGame) {
            // Game cached hai, directly serve karo
            console.log('✅ Serving cached game');
            return cachedGame;
          } else {
            // Game nahi cached, offline page dikhao
            console.log('⚠️ Game not cached, showing offline page');
            return caches.match(OFFLINE_URL)
              .then(offlinePage => offlinePage || new Response('Offline - Game not available'));
          }
        })
    );
    return;
  }

  // ====== CAR GAME FILES - CACHE FIRST ======
  if (path.includes('/cargame')) {
    console.log('🎮 Game file requested:', path);
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          // If cached, return immediately (fastest)
          if (cached) {
            console.log('✅ Serving from cache:', path);
            return cached;
          }

          // Not cached, try network
          console.log('🌐 Fetching from network:', path);
          return fetch(event.request)
            .then(response => {
              // Cache for next time
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseClone);
                  console.log('✅ Cached for next time:', path);
                });
              return response;
            })
            .catch(error => {
              console.warn('Network failed for game:', path);
              
              // Special handling for /cargame root
              if (path === '/cargame' || path === '/cargame/') {
                return caches.match('/cargame/index.html')
                  .then(index => index || caches.match(OFFLINE_URL));
              }
              
              return caches.match(OFFLINE_URL)
                .then(offlinePage => offlinePage || new Response('Game not available offline'));
            });
        })
    );
    return;
  }

  // ====== OFFLINE PAGE ======
  if (path === '/offline/index.html' || path === '/offline/') {
    event.respondWith(
      caches.match(OFFLINE_URL)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }

  // ====== MAIN APP PAGES ======
  if (path === '/' || path === '/index.html' || FILES_TO_CACHE.includes(path)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          isOnline = true;
          // Cache for offline use
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          isOnline = false;
          console.log('📴 Offline detected for:', path);
          
          // Offline: serve from cache
          return caches.match(event.request)
            .then(cached => {
              if (cached) return cached;
              
              // If main page not cached, check if game is available
              if (path === '/' || path === '/index.html') {
                return caches.match('/cargame/index.html')
                  .then(gameIndex => {
                    if (gameIndex) {
                      console.log('🎮 Redirecting to cached game');
                      return gameIndex;
                    }
                    return caches.match(OFFLINE_URL)
                      .then(offlinePage => offlinePage || new Response('Offline'));
                  });
              }
              
              return new Response('Not available offline', { status: 404 });
            });
        })
    );
    return;
  }

  // ====== DEFAULT: NETWORK FIRST ======
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  const { type } = event.data;

  switch (type) {
    case 'AUTO_CACHE_GAME':
      autoCacheGameFiles()
        .then(result => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage(result);
          }
        });
      break;

    case 'GET_GAME_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const gameFiles = keys.filter(k => 
            k.url.includes('/cargame')
          ).length;
          
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              gameCached: gameFiles > 0,
              gameFilesCount: gameFiles,
              totalGameFiles: CAR_GAME_FILES.length,
              version: APP_VERSION
            });
          }
        });
      break;

    case 'GET_PROGRESS':
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          type: 'PROGRESS_UPDATE',
          progress: {
            total: cacheProgress.total,
            completed: cacheProgress.completed,
            percentage: Math.round((cacheProgress.completed / cacheProgress.total) * 100),
            currentFile: cacheProgress.currentFile,
            isCaching: cacheProgress.isCaching
          }
        });
      }
      break;

    case 'GET_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const gameFiles = keys.filter(k => k.url.includes('/cargame')).length;
          
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              version: APP_VERSION,
              online: isOnline,
              totalCached: keys.length,
              gameCached: gameFiles,
              totalGameFiles: CAR_GAME_FILES.length,
              isCaching: cacheProgress.isCaching
            });
          }
        });
      break;

    case 'PING':
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ 
          pong: true, 
          version: APP_VERSION 
        });
      }
      break;
  }
});

// ====== BROADCAST PROGRESS ======
function broadcastProgress() {
  const percentage = Math.round((cacheProgress.completed / cacheProgress.total) * 100);
  
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      try {
        client.postMessage({
          type: 'CACHE_PROGRESS',
          progress: {
            total: cacheProgress.total,
            completed: cacheProgress.completed,
            percentage: percentage,
            currentFile: cacheProgress.currentFile,
            isCaching: cacheProgress.isCaching
          }
        });
      } catch (error) {
        // Client might be closed
      }
    });
  });
}

// ====== ONLINE/OFFLINE EVENTS ======
self.addEventListener('online', () => {
  isOnline = true;
  console.log('🌐 Online - checking game cache...');
  
  // Check if game needs caching
  setTimeout(() => {
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        const gameFiles = keys.filter(k => k.url.includes('/cargame')).length;
        if (gameFiles < CAR_GAME_FILES.length) {
          console.log(`🔄 Game incomplete (${gameFiles}/${CAR_GAME_FILES.length}), auto-caching...`);
          autoCacheGameFiles();
        }
      });
  }, 2000);
});

self.addEventListener('offline', () => {
  isOnline = false;
  console.log('📴 Offline - game will be served if cached');
});

console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');
console.log(`🎮 Will auto-cache ${CAR_GAME_FILES.length} game files`);