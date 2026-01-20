// RelayTalk Service Worker v3.8 - With Progress Tracking
const CACHE_NAME = 'relaytalk-cache-v3-8';
const OFFLINE_URL = '/offline/index.html';
const APP_VERSION = '3.8.0';

// Videos that MUST be cached
const OFFLINE_VIDEOS = [
  '/offline/videos/vid1.mp4',
  '/offline/videos/vid2.mp4',
  '/offline/videos/vid3.mp4',
  '/offline/videos/vid4.mp4',
  '/offline/videos/vid5.mp4'
];

// All files to cache
const ALL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/opening.css',
  '/relay.png',
  '/manifest.json',
  '/offline/index.html',
  '/offline/section1/main.html',
  '/offline/section1/main.css',
  '/offline/section1/main.js',
  '/offline/section1/shayari-data.js',
  '/offline/section2/main.html',
  '/offline/section2/main.css',
  '/offline/section2/main.js',
  '/pages/auth/index.html',
  '/pages/auth/style.css',
  '/pages/auth/script.js',
  '/pages/login/index.html',
  '/pages/login/style.css',
  '/pages/login/script.js',
  '/pages/home/index.html',
  '/pages/home/style.css',
  '/pages/home/script.js',
  '/pages/home/friends/index.html',
  '/pages/home/friends/style.css',
  '/pages/home/friends/script.js',
  '/pages/chats/index.html',
  '/pages/chats/style.css',
  '/pages/chats/script.js',
  '/pages/chats/chat-responsive.css',
  '/pages/chats/sent.mp3',
  '/pages/chats/recieve.mp3',
  ...OFFLINE_VIDEOS
];

// Track caching progress
let cacheProgress = {
  total: ALL_FILES.length,
  completed: 0,
  currentFile: '',
  isCaching: false,
  videosCached: 0,
  totalVideos: OFFLINE_VIDEOS.length
};

let isOnline = true;

// ====== INSTALL EVENT ======
self.addEventListener('install', event => {
  console.log('⚡ Installing Service Worker v' + APP_VERSION);
  self.skipWaiting();
  
  // Don't cache on install - let user trigger manually
  event.waitUntil(Promise.resolve());
});

// ====== ACTIVATE EVENT ======
self.addEventListener('activate', event => {
  console.log('🔄 Activating Service Worker v' + APP_VERSION);
  
  event.waitUntil(
    Promise.all([
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
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker ready');
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

// ====== CACHE ALL FILES FUNCTION ======
async function cacheAllFilesWithProgress() {
  if (cacheProgress.isCaching) {
    console.log('⚠️ Cache already in progress');
    return { success: false, message: 'Cache already in progress' };
  }
  
  cacheProgress.isCaching = true;
  cacheProgress.completed = 0;
  cacheProgress.videosCached = 0;
  
  console.log('🚀 Starting to cache all files...');
  
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Cache in batches for better performance
    const batchSize = 5;
    const batches = [];
    
    for (let i = 0; i < ALL_FILES.length; i += batchSize) {
      batches.push(ALL_FILES.slice(i, i + batchSize));
    }
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            cacheProgress.currentFile = url;
            
            const response = await fetch(url, {
              headers: url.endsWith('.mp4') ? {
                'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
              } : {}
            });
            
            if (response.ok) {
              await cache.put(url, response);
              cacheProgress.completed++;
              
              if (url.endsWith('.mp4')) {
                cacheProgress.videosCached++;
              }
              
              // Broadcast progress
              broadcastProgress();
              
              console.log(`✅ Cached: ${url} (${cacheProgress.completed}/${cacheProgress.total})`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to cache ${url}:`, error);
            cacheProgress.completed++;
            broadcastProgress();
          }
        })
      );
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    cacheProgress.isCaching = false;
    console.log(`🎉 Caching complete! ${cacheProgress.completed}/${cacheProgress.total} files cached`);
    
    return {
      success: true,
      message: `Cached ${cacheProgress.completed}/${cacheProgress.total} files`,
      videosCached: cacheProgress.videosCached,
      totalVideos: cacheProgress.totalVideos
    };
    
  } catch (error) {
    cacheProgress.isCaching = false;
    console.error('❌ Cache failed:', error);
    return { success: false, message: error.message };
  }
}

// Broadcast progress to all clients
function broadcastProgress() {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_PROGRESS',
        progress: {
          total: cacheProgress.total,
          completed: cacheProgress.completed,
          percentage: Math.round((cacheProgress.completed / cacheProgress.total) * 100),
          currentFile: cacheProgress.currentFile,
          isCaching: cacheProgress.isCaching,
          videosCached: cacheProgress.videosCached,
          totalVideos: cacheProgress.totalVideos
        }
      });
    });
  });
}

// ====== FETCH EVENT ======
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  const path = url.pathname;
  
  // Handle broken section paths
  if ((path.includes('/section1/') || path.includes('/section2/')) && !path.startsWith('/offline/')) {
    const sectionMatch = path.match(/\/(section[12]\/[^\/]+)$/);
    if (sectionMatch) {
      const fixedPath = '/offline/' + sectionMatch[1];
      event.respondWith(
        caches.match(fixedPath)
          .then(cached => cached || fetch(fixedPath))
          .catch(() => caches.match(OFFLINE_URL))
      );
      return;
    }
  }
  
  // Handle video range requests
  if (OFFLINE_VIDEOS.includes(path)) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => {
          if (cached) {
            const range = event.request.headers.get('range');
            if (range) {
              return handleRangeRequest(cached, range);
            }
            return cached;
          }
          return fetch(event.request);
        })
    );
    return;
  }
  
  // Serve from cache first for offline files
  if (path.startsWith('/offline/')) {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
    return;
  }
  
  // Network first for app pages
  event.respondWith(
    fetch(event.request)
      .then(response => {
        isOnline = true;
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        return response;
      })
      .catch(async () => {
        isOnline = false;
        const accept = event.request.headers.get('Accept') || '';
        const isPageRequest = accept.includes('text/html') || 
                             path.endsWith('.html') ||
                             path === '/' ||
                             !path.includes('.');
        
        if (isPageRequest) {
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return new Response(offlinePage.body, {
              status: 200,
              headers: offlinePage.headers
            });
          }
        }
        
        const cached = await caches.match(event.request);
        if (cached) return cached;
        
        return new Response('', { status: 404 });
      })
  );
});

// ====== MESSAGE HANDLING ======
self.addEventListener('message', event => {
  const { type } = event.data;
  
  switch (type) {
    case 'CACHE_ALL':
      console.log('🔄 Received cache all command');
      cacheAllFilesWithProgress()
        .then(result => {
          event.ports[0].postMessage(result);
        });
      break;
      
    case 'GET_PROGRESS':
      event.ports[0].postMessage({
        type: 'PROGRESS_UPDATE',
        progress: {
          total: cacheProgress.total,
          completed: cacheProgress.completed,
          percentage: Math.round((cacheProgress.completed / cacheProgress.total) * 100),
          currentFile: cacheProgress.currentFile,
          isCaching: cacheProgress.isCaching,
          videosCached: cacheProgress.videosCached,
          totalVideos: cacheProgress.totalVideos
        }
      });
      break;
      
    case 'GET_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          const videos = keys.filter(k => k.url.endsWith('.mp4')).length;
          event.ports[0].postMessage({
            version: APP_VERSION,
            online: isOnline,
            totalCached: keys.length,
            videosCached: videos,
            totalVideos: OFFLINE_VIDEOS.length,
            totalFiles: ALL_FILES.length,
            isCaching: cacheProgress.isCaching
          });
        });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(success => {
          cacheProgress.completed = 0;
          cacheProgress.videosCached = 0;
          cacheProgress.isCaching = false;
          event.ports[0].postMessage({ success });
        });
      break;
      
    case 'PING':
      event.ports[0].postMessage({ pong: true, version: APP_VERSION });
      break;
  }
});

// Helper function for video range requests
async function handleRangeRequest(cachedResponse, range) {
  const buffer = await cachedResponse.arrayBuffer();
  const bytes = /^bytes=(\d+)-(\d+)?$/g.exec(range);
  
  if (bytes) {
    const start = parseInt(bytes[1]);
    const end = bytes[2] ? parseInt(bytes[2]) : buffer.byteLength - 1;
    const sliced = buffer.slice(start, end + 1);
    
    return new Response(sliced, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': (end - start + 1).toString(),
        'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
        'Accept-Ranges': 'bytes'
      }
    });
  }
  
  return cachedResponse;
}

console.log('🚀 RelayTalk Service Worker v' + APP_VERSION + ' loaded');