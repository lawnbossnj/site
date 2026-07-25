/*
	DESCRIPTION: ui-leaflet — blank-slate Leaflet map host (CDN, no API key for
	OSM tiles). Mirrors the ui-google-map surface where practical: markers as
	`items`, polylines/polygons/circles, two-way `activeIndex`, fit/pan/fly,
	escape hatch `getMap()` / `getLeaflet()`.
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-leaflet
	    .state.center=${{ lat: 37.77, lng: -122.42 }}
	    .state.zoom=${12}
	    .state.items=${[{ id: 'a', lat: 37.78, lng: -122.41, label: 'HQ' }]}
	    @leaflet:select=${this.handlePick}></ui-leaflet>
	─────────────────────────────────────────────────────────────────────
*/
import { WebComponent } from 'webcomponent';
import { ensureLeafletStyles, loadLeaflet } from './loader.js';

const DEFAULT_CENTER = {
	lat: 20,
	lng: 0,
};
const DEFAULT_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

function toLatLngLiteral(input) {
	if (!input || typeof input !== 'object') {
		return null;
	}
	const lat = Number(input.lat ?? input.latitude);
	const lng = Number(input.lng ?? input.longitude ?? input.lon);
	if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
		return null;
	}
	return {
		lat,
		lng,
	};
}

function itemId(item, index) {
	if (item == null) {
		return String(index);
	}
	if (item.id != null && item.id !== '') {
		return String(item.id);
	}
	if (item.value != null && item.value !== '') {
		return String(item.value);
	}
	return String(index);
}

function itemPosition(item) {
	return toLatLngLiteral(item) || toLatLngLiteral(item?.position) || toLatLngLiteral(item?.coords);
}

function pathFromItem(path) {
	if (!Array.isArray(path)) {
		return [];
	}
	const out = [];
	const count = path.length;
	for (let index = 0; index < count; index += 1) {
		const point = toLatLngLiteral(path[index]);
		if (point) {
			out.push([
				point.lat,
				point.lng,
			]);
		}
	}
	return out;
}

export class UILeaflet extends WebComponent {
	static url = import.meta.url;
	static styles = {
		leaflet: './leaflet.css',
	};
	static state = {
		center: {
			lat: DEFAULT_CENTER.lat,
			lng: DEFAULT_CENTER.lng,
		},
		zoom: 2,
		minZoom: 0,
		maxZoom: 22,
		// Tile layer — blank-slate defaults to OSM (override for Mapbox etc.)
		tileUrl: DEFAULT_TILE_URL,
		tileAttribution: DEFAULT_ATTRIBUTION,
		tileOptions: null,
		scrollWheelZoom: true,
		dragging: true,
		zoomControl: true,
		attributionControl: true,
		items: [],
		polylines: [],
		polygons: [],
		circles: [],
		fitItems: false,
		activeIndex: '',
		showInfo: true,
		loading: false,
		errorMessage: '',
		ready: false,
		emptyLabel: 'Map',
	};

	mapInstance = null;
	leafletApi = null;
	tileLayer = null;
	markerById = new Map();
	polylineById = new Map();
	polygonById = new Map();
	circleById = new Map();
	resizeObserver = null;
	bootGeneration = 0;
	syncFrameTick = null;
	syncScheduled = false;
	resizeForwarder = null;
	mapClickForwarder = null;
	mapMoveForwarder = null;
	mapZoomForwarder = null;

	onConnect() {
		this.resizeForwarder = () => {
			this.onHostResize();
		};
		this.syncFrameTick = () => {
			this.flushOverlaySync();
		};
		this.mapClickForwarder = (domEvent) => {
			this.onMapClick(domEvent);
		};
		this.mapMoveForwarder = () => {
			this.onMapMove();
		};
		this.mapZoomForwarder = () => {
			this.onMapZoom();
		};
		this.observe([
			'center',
			'zoom',
			'minZoom',
			'maxZoom',
			'scrollWheelZoom',
			'dragging',
			'zoomControl',
		], this.applyMapOptions);
		this.observe([
			'tileUrl',
			'tileAttribution',
			'tileOptions',
		], this.syncTileLayer);
		this.observe([
			'items',
			'polylines',
			'polygons',
			'circles',
			'activeIndex',
			'fitItems',
		], this.scheduleOverlaySync);
	}

	onMount() {
		this.bootMap();
		this.attachResizeObserver();
	}

	onDisconnect() {
		this.teardownMap();
	}

	getMap() {
		return this.mapInstance;
	}

	getLeaflet() {
		return this.leafletApi || globalThis.L || null;
	}

	/** Event feature prefix — subclasses (e.g. ui-openstreetmap) override. */
	mapEvent(action) {
		return `leaflet:${action}`;
	}

	loadingLabel() {
		return 'Loading Leaflet…';
	}

	panTo(target) {
		const map = this.mapInstance;
		const point = toLatLngLiteral(target);
		if (!map || !point) {
			return false;
		}
		map.panTo([
			point.lat,
			point.lng,
		]);
		return true;
	}

	flyTo(target, zoom) {
		const map = this.mapInstance;
		const point = toLatLngLiteral(target);
		if (!map || !point) {
			return false;
		}
		const nextZoom = isFiniteNumber(zoom) ? zoom : map.getZoom();
		map.flyTo([
			point.lat,
			point.lng,
		], nextZoom);
		return true;
	}

	setCenter(target) {
		const point = toLatLngLiteral(target);
		if (!point) {
			return false;
		}
		this.state.center = point;
		if (this.mapInstance) {
			this.mapInstance.setView([
				point.lat,
				point.lng,
			], this.mapInstance.getZoom());
		}
		return true;
	}

	setZoom(zoom) {
		if (!isFiniteNumber(zoom)) {
			return false;
		}
		this.state.zoom = zoom;
		this.mapInstance?.setZoom(zoom);
		return true;
	}

	fitToItems(padding) {
		return this.fitItemBounds(padding);
	}

	async bootMap() {
		const generation = (this.bootGeneration += 1);
		this.assignState({
			loading: true,
			errorMessage: '',
		});
		const result = await loadLeaflet();
		if (generation !== this.bootGeneration) {
			return;
		}
		if (!result.ok) {
			this.assignState({
				loading: false,
				ready: false,
				errorMessage: result.message,
			});
			this.emit(this.mapEvent('error'), {
				message: result.message,
				errKind: result.errKind,
			});
			return;
		}
		this.leafletApi = result.L;
		this.mountMapInstance(result.L, generation);
	}

	mountMapInstance(leaflet, generation) {
		const canvas = this.refs.map;
		if (!canvas) {
			this.assignState({
				loading: false,
				errorMessage: 'Map canvas ref is missing.',
			});
			return;
		}
		// Engine CSS in document.head never pierces shadow; attach into this host.
		// Re-invalidate once the sheet loads so tiles lay out with real sizes.
		ensureLeafletStyles(this.shadowRoot, this.resizeForwarder);
		try {
			this.teardownMapLayersOnly();
			if (this.mapInstance) {
				this.mapInstance.remove();
				this.mapInstance = null;
			}
			const center = toLatLngLiteral(this.state.center) || DEFAULT_CENTER;
			const map = leaflet.map(canvas, {
				center: [
					center.lat,
					center.lng,
				],
				zoom: Number(this.state.zoom) || 2,
				minZoom: this.state.minZoom,
				maxZoom: this.state.maxZoom,
				scrollWheelZoom: Boolean(this.state.scrollWheelZoom),
				dragging: Boolean(this.state.dragging),
				zoomControl: Boolean(this.state.zoomControl),
				attributionControl: Boolean(this.state.attributionControl),
			});
			if (generation !== this.bootGeneration) {
				map.remove();
				return;
			}
			this.mapInstance = map;
			this.bindMapEvents(map);
			this.syncTileLayer();
			this.assignState({
				loading: false,
				ready: true,
				errorMessage: '',
			});
			// Leaflet needs invalidateSize after shadow-DOM layout settles.
			requestAnimationFrame(this.resizeForwarder);
			this.syncAllOverlays();
			this.emit(this.mapEvent('ready'), {
				center,
				zoom: map.getZoom(),
			});
		} catch (cause) {
			const message = cause?.message || String(cause);
			this.assignState({
				loading: false,
				ready: false,
				errorMessage: message,
			});
			this.emit(this.mapEvent('error'), {
				message,
				errKind: 'mount-error',
			});
		}
	}

	bindMapEvents(map) {
		map.on('click', this.mapClickForwarder);
		map.on('moveend', this.mapMoveForwarder);
		map.on('zoomend', this.mapZoomForwarder);
	}

	onMapClick(domEvent) {
		const latLng = domEvent?.latlng;
		if (!latLng) {
			return;
		}
		this.emit(this.mapEvent('click'), {
			lat: latLng.lat,
			lng: latLng.lng,
		});
	}

	onMapMove() {
		const map = this.mapInstance;
		if (!map) {
			return;
		}
		const center = map.getCenter();
		const next = {
			lat: center.lat,
			lng: center.lng,
		};
		const prev = toLatLngLiteral(this.state.center);
		if (!prev || prev.lat !== next.lat || prev.lng !== next.lng) {
			this.state.center = next;
		}
		this.emit(this.mapEvent('idle'), {
			center: next,
			zoom: map.getZoom(),
			bounds: this.boundsLiteral(map.getBounds()),
		});
	}

	onMapZoom() {
		const map = this.mapInstance;
		if (!map) {
			return;
		}
		const zoom = map.getZoom();
		if (isFiniteNumber(zoom) && zoom !== this.state.zoom) {
			this.state.zoom = zoom;
		}
	}

	boundsLiteral(bounds) {
		if (!bounds?.getNorth) {
			return null;
		}
		return {
			north: bounds.getNorth(),
			south: bounds.getSouth(),
			east: bounds.getEast(),
			west: bounds.getWest(),
		};
	}

	applyMapOptions() {
		const map = this.mapInstance;
		if (!map) {
			return;
		}
		const center = toLatLngLiteral(this.state.center) || DEFAULT_CENTER;
		map.setMinZoom(this.state.minZoom);
		map.setMaxZoom(this.state.maxZoom);
		if (this.state.scrollWheelZoom) {
			map.scrollWheelZoom.enable();
		} else {
			map.scrollWheelZoom.disable();
		}
		if (this.state.dragging) {
			map.dragging.enable();
		} else {
			map.dragging.disable();
		}
		map.setView([
			center.lat,
			center.lng,
		], Number(this.state.zoom) || map.getZoom(), {
			animate: false,
		});
	}

	syncTileLayer() {
		const map = this.mapInstance;
		const leaflet = this.getLeaflet();
		if (!map || !leaflet) {
			return;
		}
		if (this.tileLayer) {
			map.removeLayer(this.tileLayer);
			this.tileLayer = null;
		}
		const url = this.state.tileUrl || DEFAULT_TILE_URL;
		const options = {
			attribution: this.state.tileAttribution || DEFAULT_ATTRIBUTION,
			...(this.state.tileOptions && typeof this.state.tileOptions === 'object' ? this.state.tileOptions : {}),
		};
		this.tileLayer = leaflet.tileLayer(url, options).addTo(map);
	}

	scheduleOverlaySync() {
		if (this.syncScheduled || !this.mapInstance) {
			return;
		}
		this.syncScheduled = true;
		requestAnimationFrame(this.syncFrameTick);
	}

	flushOverlaySync() {
		this.syncScheduled = false;
		this.syncAllOverlays();
	}

	syncAllOverlays() {
		if (!this.mapInstance || !this.getLeaflet()) {
			return;
		}
		this.syncMarkers();
		this.syncPolylines();
		this.syncPolygons();
		this.syncCircles();
		if (this.state.fitItems) {
			this.fitItemBounds();
		}
		this.syncActiveSelection();
	}

	isPlaneMarker(item) {
		return item?.marker === 'plane' || item?.kind === 'aircraft' || item?.icon === 'plane';
	}
	planeIcon(leaflet, item, active) {
		const color = escapeHtml(item.iconColor || (active ? '#f59e0b' : '#22c55e'));
		const heading = isFiniteNumber(item.heading) ? item.heading : 0;
		const label = escapeHtml(item.label || item.description || '');
		// Inline fill/stroke — DivIcon HTML is not always styled by host CSS reliably.
		const html = `<div class="lf-plane${active ? ' is-active' : ''}" style="transform:rotate(${heading}deg)" title="${label}">`
			+ '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'
			+ `<path fill="${color}" stroke="#f8fafc" stroke-width="1.2" paint-order="stroke fill" d="M12 2.5 L15.2 10.5 L21 12 L15.2 13.5 L12 21.5 L8.8 13.5 L3 12 L8.8 10.5 Z"></path>`
			+ '</svg></div>';
		return leaflet.divIcon({
			className: 'lf-plane-marker',
			html,
			iconSize: [
				28,
				28,
			],
			iconAnchor: [
				14,
				14,
			],
		});
	}
	syncMarkers() {
		const leaflet = this.getLeaflet();
		const map = this.mapInstance;
		const items = Array.isArray(this.state.items) ? this.state.items : [];
		const seen = new Set();
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const position = itemPosition(item);
			if (!position) {
				continue;
			}
			const id = itemId(item, index);
			seen.add(id);
			let marker = this.markerById.get(id);
			const active = String(this.state.activeIndex) === id || Boolean(item.active);
			const plane = this.isPlaneMarker(item);
			if (!marker) {
				const options = {
					title: item.label || item.description || id,
					opacity: isFiniteNumber(item.opacity) ? item.opacity : 1,
					draggable: Boolean(item.draggable),
				};
				if (plane) {
					options.icon = this.planeIcon(leaflet, item, active);
				}
				marker = leaflet.marker([
					position.lat,
					position.lng,
				], options);
				const clickForwarder = () => {
					this.handleMarkerSelect(id, item, index);
				};
				marker.on('click', clickForwarder);
				marker.__uwcClick = clickForwarder;
				marker.__uwcPlane = plane;
				marker.addTo(map);
				this.markerById.set(id, marker);
			} else {
				marker.setLatLng([
					position.lat,
					position.lng,
				]);
				marker.setOpacity(isFiniteNumber(item.opacity) ? item.opacity : 1);
				if (plane) {
					marker.setIcon(this.planeIcon(leaflet, item, active));
					marker.__uwcPlane = true;
				}
			}
			if (active && this.state.showInfo && (item.info || item.description || item.label)) {
				marker.bindPopup(item.info || `<strong>${escapeHtml(item.label || id)}</strong>${item.description ? `<div>${escapeHtml(item.description)}</div>` : ''}`);
			}
		}
		for (const [id, marker] of this.markerById) {
			if (!seen.has(id)) {
				map.removeLayer(marker);
				this.markerById.delete(id);
			}
		}
	}

	handleMarkerSelect(id, item, index) {
		this.state.activeIndex = id;
		this.emit(this.mapEvent('select'), {
			id,
			item,
			index,
		});
		if (this.state.showInfo && (item.info || item.description || item.label)) {
			const marker = this.markerById.get(String(id));
			marker?.openPopup?.();
		}
	}

	syncActiveSelection() {
		const id = String(this.state.activeIndex || '');
		if (!id) {
			return;
		}
		const marker = this.markerById.get(id);
		if (marker) {
			const latLng = marker.getLatLng();
			this.panTo({
				lat: latLng.lat,
				lng: latLng.lng,
			});
			if (this.state.showInfo) {
				marker.openPopup?.();
			}
			return;
		}
		const items = Array.isArray(this.state.items) ? this.state.items : [];
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			if (itemId(items[index], index) === id) {
				const position = itemPosition(items[index]);
				if (position) {
					this.panTo(position);
				}
				return;
			}
		}
	}

	syncPolylines() {
		const leaflet = this.getLeaflet();
		const map = this.mapInstance;
		const items = Array.isArray(this.state.polylines) ? this.state.polylines : [];
		const seen = new Set();
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const id = itemId(item, index);
			const latLngs = pathFromItem(item.path || item.points);
			if (latLngs.length < 2) {
				continue;
			}
			seen.add(id);
			let shape = this.polylineById.get(id);
			const options = {
				color: item.strokeColor || '#3b82f6',
				weight: item.strokeWeight ?? 3,
				opacity: item.strokeOpacity ?? 0.9,
			};
			if (!shape) {
				shape = leaflet.polyline(latLngs, options).addTo(map);
				this.polylineById.set(id, shape);
			} else {
				shape.setLatLngs(latLngs);
				shape.setStyle(options);
			}
		}
		this.pruneLayerBucket(this.polylineById, seen);
	}

	syncPolygons() {
		const leaflet = this.getLeaflet();
		const map = this.mapInstance;
		const items = Array.isArray(this.state.polygons) ? this.state.polygons : [];
		const seen = new Set();
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const id = itemId(item, index);
			const latLngs = pathFromItem(item.path || item.points || (Array.isArray(item.paths) ? item.paths[0] : null));
			if (latLngs.length < 3) {
				continue;
			}
			seen.add(id);
			let shape = this.polygonById.get(id);
			const options = {
				color: item.strokeColor || '#6366f1',
				weight: item.strokeWeight ?? 2,
				opacity: item.strokeOpacity ?? 0.85,
				fillColor: item.fillColor || '#6366f1',
				fillOpacity: item.fillOpacity ?? 0.25,
			};
			if (!shape) {
				shape = leaflet.polygon(latLngs, options).addTo(map);
				this.polygonById.set(id, shape);
			} else {
				shape.setLatLngs(latLngs);
				shape.setStyle(options);
			}
		}
		this.pruneLayerBucket(this.polygonById, seen);
	}

	syncCircles() {
		const leaflet = this.getLeaflet();
		const map = this.mapInstance;
		const items = Array.isArray(this.state.circles) ? this.state.circles : [];
		const seen = new Set();
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const id = itemId(item, index);
			const center = toLatLngLiteral(item) || toLatLngLiteral(item.center);
			if (!center) {
				continue;
			}
			seen.add(id);
			let shape = this.circleById.get(id);
			const options = {
				radius: Number(item.radius) || 1000,
				color: item.strokeColor || '#0ea5e9',
				weight: item.strokeWeight ?? 2,
				opacity: item.strokeOpacity ?? 0.85,
				fillColor: item.fillColor || '#0ea5e9',
				fillOpacity: item.fillOpacity ?? 0.18,
			};
			if (!shape) {
				shape = leaflet.circle([
					center.lat,
					center.lng,
				], options).addTo(map);
				this.circleById.set(id, shape);
			} else {
				shape.setLatLng([
					center.lat,
					center.lng,
				]);
				shape.setRadius(options.radius);
				shape.setStyle(options);
			}
		}
		this.pruneLayerBucket(this.circleById, seen);
	}

	pruneLayerBucket(bucket, seen) {
		const map = this.mapInstance;
		for (const [id, shape] of bucket) {
			if (!seen.has(id)) {
				map?.removeLayer(shape);
				bucket.delete(id);
			}
		}
	}

	fitItemBounds(padding) {
		const map = this.mapInstance;
		const leaflet = this.getLeaflet();
		if (!map || !leaflet) {
			return false;
		}
		const items = Array.isArray(this.state.items) ? this.state.items : [];
		const latLngs = [];
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const position = itemPosition(items[index]);
			if (position) {
				latLngs.push([
					position.lat,
					position.lng,
				]);
			}
		}
		if (latLngs.length === 0) {
			return false;
		}
		if (latLngs.length === 1) {
			map.setView(latLngs[0], Math.max(map.getZoom(), 12));
			return true;
		}
		const pad = isFiniteNumber(padding) ? padding : 48;
		map.fitBounds(leaflet.latLngBounds(latLngs), {
			padding: [
				pad,
				pad,
			],
		});
		return true;
	}

	attachResizeObserver() {
		if (typeof ResizeObserver === 'undefined') {
			return;
		}
		this.resizeObserver?.disconnect();
		this.resizeObserver = new ResizeObserver(this.resizeForwarder);
		this.resizeObserver.observe(this);
	}

	onHostResize() {
		this.mapInstance?.invalidateSize?.();
	}

	teardownMapLayersOnly() {
		const map = this.mapInstance;
		for (const marker of this.markerById.values()) {
			map?.removeLayer(marker);
		}
		this.markerById.clear();
		for (const shape of this.polylineById.values()) {
			map?.removeLayer(shape);
		}
		this.polylineById.clear();
		for (const shape of this.polygonById.values()) {
			map?.removeLayer(shape);
		}
		this.polygonById.clear();
		for (const shape of this.circleById.values()) {
			map?.removeLayer(shape);
		}
		this.circleById.clear();
		if (this.tileLayer && map) {
			map.removeLayer(this.tileLayer);
			this.tileLayer = null;
		}
	}

	teardownMap() {
		this.bootGeneration += 1;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.teardownMapLayersOnly();
		if (this.mapInstance) {
			this.mapInstance.off('click', this.mapClickForwarder);
			this.mapInstance.off('moveend', this.mapMoveForwarder);
			this.mapInstance.off('zoomend', this.mapZoomForwarder);
			this.mapInstance.remove();
			this.mapInstance = null;
		}
		this.syncScheduled = false;
	}

	hostPhase() {
		if (this.state.loading) {
			return 'loading';
		}
		if (this.state.errorMessage) {
			return 'error';
		}
		if (this.state.ready) {
			return 'ready';
		}
		return 'idle';
	}

	render() {
		const phase = this.hostPhase();
		this.html`
			<div class="lf-root" data-phase=${phase}>
				<div #map class="lf-canvas" role="application" aria-label=${this.state.emptyLabel || 'Map'}></div>
				<div class="lf-overlay" ?hidden=${phase === 'ready'} ?data-interactive=${phase === 'error'}>
					<div class="lf-status" data-tone=${phase === 'error' ? 'danger' : 'neutral'}>
						<span class="lf-status-label">${() => {
							if (phase === 'loading') {
								return this.loadingLabel();
							}
							if (phase === 'error') {
								return 'Map unavailable';
							}
							return this.state.emptyLabel || 'Map';
						}}</span>
						<span class="lf-status-msg" ?hidden=${!this.state.errorMessage}>${this.state.errorMessage}</span>
					</div>
				</div>
			</div>
		`;
	}
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

customElements.define('ui-leaflet', UILeaflet);
