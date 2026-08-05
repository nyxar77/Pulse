/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';
import { exerciseImageCacheName, loadExerciseImage } from '$lib/exercise-image-cache';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `pulse-${version}`;
const appFiles = [...build, ...files, ...prerendered];
const appFileSet = new Set(appFiles);

worker.addEventListener('install', (event) => {
	event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appFiles)));
	void worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches
				.keys()
				.then((keys) =>
					Promise.all(keys.filter((key) => key.startsWith('pulse-') && key !== cacheName && key !== exerciseImageCacheName).map((key) => caches.delete(key)))
				),
			worker.clients.claim()
		])
	);
});

worker.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) {
		if (request.destination === 'image' && (url.protocol === 'https:' || url.protocol === 'http:')) {
			event.respondWith(loadExerciseImage(request));
		}
		return;
	}

	if (appFileSet.has(url.pathname)) {
		event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => {
				const cached = (await caches.match(url.pathname)) ?? (await caches.match('/'));
				return cached ?? Response.error();
			})
		);
	}
});
