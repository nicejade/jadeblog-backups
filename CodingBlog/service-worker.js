'use strict';

var version = 'v-2018-01-22 10:10';
var __DEVELOPMENT__ = false;
var __DEBUG__ = true;
var offlineResources = [
  '/',
  '/index.html'
];

var ignoreCache = [
  /https?:\/\/api.github.com\//,
  /https?:\/\/zz.bdstatic.com\//,
  /https?:\/\/hm.baidu.com\//,
  /https?:\/\/cdn.clustrmaps.com\//,
  /https?:\/\/www.google-analytics.com\//,
  /chrome-extension:\//
];
var port;

/**
* common function
*/

function developmentMode() {
  return location.hostname === '127.0.0.1' || location.hostname === 'localhost'
}

function cacheKey() {
  return [version, ...arguments].join(':');
}

function log() {
  if (developmentMode()) {
    console.log("SW:", ...arguments);
  }
}

function shouldAlwaysFetch(request) {
  return __DEVELOPMENT__ ||
    request.method !== 'GET' ||
    ignoreCache.some(regex => request.url.match(regex));
}

function shouldFetchAndCache(request) {
  return (/text\/html/i).test(request.headers.get('Accept'));
}

function sendNotify(title, options, event) {
  if (Notification.permission !== 'granted') {
    log('Not granted Notification permission.');

    if (port && port.postMessage) {
      port.postMessage({
        type: 'applyNotify',
        info: {title, options}
      });
    }

    return;
  }

  var notificationPromise = self.registration.showNotification(title || '晚晴幽草轩', Object.assign({
    body: '云在青天水在瓶',
    icon: 'https://jeffjade.com/favicons/mstile-150x150.png',
    tag: 'push'
  }, options));

  return event && event.waitUntil(notificationPromise);
}

/**
* onClickNotify
*/

function onClickNotify(event) {
  event.notification.close();
  var url = "https://blog.lovejade.cn/";

  event.waitUntil(
    self.clients.matchAll({
      type: "window"
    })
    .then(() => {
      if (self.clients.openWindow) {
          return self.clients.openWindow(url);
      }
    })
  );
}

/**
* Install
*/

function onInstall(event) {
  log('install event in progress.');

  event.waitUntil(
    caches.open(cacheKey('offline'))
        .then(cache => cache.addAll(offlineResources))
        .then(() => log('installation complete! version: ' + version))
        .then(() => self.skipWaiting())
  );
}

/**
* Fetch
*/

function offlineResponse(request) {
  log('(offline)', request.method, request.url);
  if (request.url.match(/\.(jpg|png|gif|svg|jpeg)(\?.*)?$/)) {
    return caches.match('/wp-content/themes/Kratos/images/default.jpg');
  } else {
    return caches.match('/offline.html');
  }
}

function cachedOrOffline(request) {
  return caches
    .match(request)
    .then((response) => response || offlineResponse(request));
}

function networkedAndCache(request) {
  return fetch(request)
    .then(response => {
      var copy = response.clone();

      caches.open(cacheKey('resources'))
          .then(cache => {
              cache.put(request, copy);
          });

      log("(network: cache write)", request.method, request.url);
      return response;
    });
}

function cachedOrNetworked(request) {
  return caches.match(request)
      .then((response) => {
          log(response ? '(cached)' : '(network: cache miss)', request.method, request.url);
          return response ||
              networkedAndCache(request)
              .catch(() => offlineResponse(request));
      });
}

function networkedOrOffline(request) {
  return fetch(request)
      .then(response => {
          log('(network)', request.method, request.url);
          return response;
      })
      .catch(() => offlineResponse(request));
}

function onFetch(event) {
  var request = event.request;

  if (shouldAlwaysFetch(request)) {
      log('AlwaysFetch request: ', event.request.url);
      event.respondWith(networkedOrOffline(request));
      return;
  }

  if (shouldFetchAndCache(request)) {
      event.respondWith(
          networkedAndCache(request).catch(() => cachedOrOffline(request))
      );
      return;
  }

  event.respondWith(cachedOrNetworked(request));
}

/**
* Activate
*/

function removeOldCache() {
  return caches
      .keys()
      .then(keys =>
          Promise.all(
              keys
              .filter(key => !key.startsWith(version))
              .map(key => caches.delete(key))
          )
      )
      .then(() => {
          log('removeOldCache completed.');
      });
}

function onActivate(event) {
  log('activate event in progress.');
  event.waitUntil(Promise.all([
      self.clients.claim(),
      removeOldCache()
  ]))
}

/**
* onPush
*/

function onPush(event) {
  log('onPush ', event);
  sendNotify('Hi:', {
      body: `onPush${new Date()}？_ ？~`
  }, event);
}

/**
* onSync
*/

function onSync(event) {
  log('onSync', event);
  sendNotify('Hi:', {
      body: `onSync${new Date()}？_ ？ ~`
  }, event);
}

/**
* onMessage
*/

function onMessage(event) {
  log('onMessage', event);

  if (event.ports) {
      port = event.ports[0];
  }

  if (!event.data) {
      return;
  }

  if (event.data.type === 'notify') {
      var {title, options} = event.data.info || {};
      sendNotify(title, options, event);
  }
}

log("Hello from ServiceWorker land!", version);

self.addEventListener('install', onInstall);
self.addEventListener('fetch', onFetch);
self.addEventListener("activate", onActivate);
self.addEventListener("push", onPush);
self.addEventListener("sync", onSync);
self.addEventListener('message', onMessage);
self.addEventListener("notificationclick", onClickNotify);

