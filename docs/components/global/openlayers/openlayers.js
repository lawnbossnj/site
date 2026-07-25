/*
	DESCRIPTION: ui-openlayers — blank-slate OpenLayers map host (CDN, no API
	key for OSM tiles). Same app-facing surface as ui-leaflet / ui-google-map:
	markers as `items`, polylines/polygons/circles, two-way `activeIndex`,
	fit/pan/fly, escape hatch `getMap()` / `getOpenLayers()`.
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-openlayers
	    .state.center=${{ lat: 37.77, lng: -122.42 }}
	    .state.zoom=${12}
	    .state.items=${[{ id: 'a', lat: 37.78, lng: -122.41, label: 'HQ' }]}
	    @openlayers:select=${this.handlePick}></ui-openlayers>
	─────────────────────────────────────────────────────────────────────
*/
import { WebComponent } from 'webcomponent';
import { ensureOpenLayersStyles, loadOpenLayers } from './loader.js';

const DEFAULT_CENTER = {
	lat: 20,
	lng: 0,
};

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
			out.push(point);
		}
	}
	return out;
}

export class UIOpenLayers extends WebComponent {
	static url = import.meta.url;
	static styles = {
		openlayers: './openlayers.css',
	};
	static state = {
		center: {
			lat: DEFAULT_CENTER.lat,
			lng: DEFAULT_CENTER.lng,
		},
		zoom: 2,
		minZoom: 0,
		maxZoom: 22,
		// Optional XYZ tile URL template; empty → OSM
		tileUrl: '',
		tileAttribution: '',
		items: [],
		polylines: [],
		polygons: [],
		circles: [],
		fitItems: false,
		activeIndex: '',
		loading: false,
		errorMessage: '',
		ready: false,
		emptyLabel: 'Map',
	};

	mapInstance = null;
	olApi = null;
	view = null;
	vectorSource = null;
	vectorLayer = null;
	tileLayer = null;
	featureById = new Map();
	resizeObserver = null;
	bootGeneration = 0;
	syncFrameTick = null;
	syncScheduled = false;
	resizeForwarder = null;
	mapClickForwarder = null;
	mapMoveForwarder = null;

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
		this.observe([
			'center',
			'zoom',
			'minZoom',
			'maxZoom',
		], this.applyMapOptions);
		this.observe([
			'tileUrl',
			'tileAttribution',
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

	getOpenLayers() {
		return this.olApi || globalThis.ol || null;
	}

	toMapCoord(point) {
		const olNs = this.getOpenLayers();
		if (!olNs || !point) {
			return null;
		}
		return olNs.proj.fromLonLat([
			point.lng,
			point.lat,
		]);
	}

	fromMapCoord(coord) {
		const olNs = this.getOpenLayers();
		if (!olNs || !coord) {
			return null;
		}
		const lonLat = olNs.proj.toLonLat(coord);
		return {
			lat: lonLat[1],
			lng: lonLat[0],
		};
	}

	panTo(target) {
		const map = this.mapInstance;
		const point = toLatLngLiteral(target);
		const coord = this.toMapCoord(point);
		if (!map || !coord) {
			return false;
		}
		map.getView().animate({
			center: coord,
			duration: 250,
		});
		return true;
	}

	flyTo(target, zoom) {
		const map = this.mapInstance;
		const point = toLatLngLiteral(target);
		const coord = this.toMapCoord(point);
		if (!map || !coord) {
			return false;
		}
		const view = map.getView();
		view.animate({
			center: coord,
			zoom: isFiniteNumber(zoom) ? zoom : view.getZoom(),
			duration: 450,
		});
		return true;
	}

	setCenter(target) {
		const point = toLatLngLiteral(target);
		if (!point) {
			return false;
		}
		this.state.center = point;
		const coord = this.toMapCoord(point);
		if (coord && this.mapInstance) {
			this.mapInstance.getView().setCenter(coord);
		}
		return true;
	}

	setZoom(zoom) {
		if (!isFiniteNumber(zoom)) {
			return false;
		}
		this.state.zoom = zoom;
		this.mapInstance?.getView()?.setZoom(zoom);
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
		const result = await loadOpenLayers();
		if (generation !== this.bootGeneration) {
			return;
		}
		if (!result.ok) {
			this.assignState({
				loading: false,
				ready: false,
				errorMessage: result.message,
			});
			this.emit('openlayers:error', {
				message: result.message,
				errKind: result.errKind,
			});
			return;
		}
		this.olApi = result.ol;
		this.mountMapInstance(result.ol, generation);
	}

	mountMapInstance(olNs, generation) {
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
		ensureOpenLayersStyles(this.shadowRoot, this.resizeForwarder);
		try {
			this.destroyMapInstance();
			const center = toLatLngLiteral(this.state.center) || DEFAULT_CENTER;
			const view = new olNs.View({
				center: olNs.proj.fromLonLat([
					center.lng,
					center.lat,
				]),
				zoom: Number(this.state.zoom) || 2,
				minZoom: this.state.minZoom,
				maxZoom: this.state.maxZoom,
			});
			this.view = view;
			this.vectorSource = new olNs.source.Vector();
			this.vectorLayer = new olNs.layer.Vector({
				source: this.vectorSource,
				style: this.makeDefaultStyle(olNs),
			});
			this.tileLayer = this.createTileLayer(olNs);
			const map = new olNs.Map({
				target: canvas,
				layers: [
					this.tileLayer,
					this.vectorLayer,
				],
				view,
			});
			if (generation !== this.bootGeneration) {
				map.setTarget(null);
				return;
			}
			this.mapInstance = map;
			map.on('singleclick', this.mapClickForwarder);
			map.on('moveend', this.mapMoveForwarder);
			this.assignState({
				loading: false,
				ready: true,
				errorMessage: '',
			});
			requestAnimationFrame(this.resizeForwarder);
			this.syncAllOverlays();
			this.emit('openlayers:ready', {
				center,
				zoom: view.getZoom(),
			});
		} catch (cause) {
			const message = cause?.message || String(cause);
			this.assignState({
				loading: false,
				ready: false,
				errorMessage: message,
			});
			this.emit('openlayers:error', {
				message,
				errKind: 'mount-error',
			});
		}
	}

	createTileLayer(olNs) {
		const url = String(this.state.tileUrl || '').trim();
		if (url) {
			return new olNs.layer.Tile({
				source: new olNs.source.XYZ({
					url,
					attributions: this.state.tileAttribution || undefined,
				}),
			});
		}
		return new olNs.layer.Tile({
			source: new olNs.source.OSM({
				attributions: this.state.tileAttribution || undefined,
			}),
		});
	}

	makeDefaultStyle(olNs) {
		return new olNs.style.Style({
			image: new olNs.style.Circle({
				radius: 7,
				fill: new olNs.style.Fill({
					color: '#3b82f6',
				}),
				stroke: new olNs.style.Stroke({
					color: '#ffffff',
					width: 2,
				}),
			}),
			stroke: new olNs.style.Stroke({
				color: '#3b82f6',
				width: 3,
			}),
			fill: new olNs.style.Fill({
				color: 'rgba(99, 102, 241, 0.25)',
			}),
		});
	}

	makeActiveStyle(olNs) {
		return new olNs.style.Style({
			image: new olNs.style.Circle({
				radius: 9,
				fill: new olNs.style.Fill({
					color: '#f59e0b',
				}),
				stroke: new olNs.style.Stroke({
					color: '#ffffff',
					width: 2,
				}),
			}),
			stroke: new olNs.style.Stroke({
				color: '#f59e0b',
				width: 3,
			}),
			fill: new olNs.style.Fill({
				color: 'rgba(245, 158, 11, 0.28)',
			}),
		});
	}

	onMapClick(domEvent) {
		const olNs = this.getOpenLayers();
		const map = this.mapInstance;
		if (!olNs || !map) {
			return;
		}
		const pixel = domEvent.pixel;
		let picked = null;
		map.forEachFeatureAtPixel(pixel, (feature) => {
			picked = feature;
			return true;
		});
		if (picked) {
			const id = String(picked.get('uwcId') || '');
			const item = picked.get('uwcItem');
			const index = picked.get('uwcIndex');
			if (id) {
				this.handleFeatureSelect(id, item, index);
			}
			return;
		}
		const coord = domEvent.coordinate;
		const point = this.fromMapCoord(coord);
		if (point) {
			this.emit('openlayers:click', point);
		}
	}

	onMapMove() {
		const map = this.mapInstance;
		const view = map?.getView();
		if (!view) {
			return;
		}
		const center = this.fromMapCoord(view.getCenter());
		if (center) {
			const prev = toLatLngLiteral(this.state.center);
			if (!prev || prev.lat !== center.lat || prev.lng !== center.lng) {
				this.state.center = center;
			}
		}
		const zoom = view.getZoom();
		if (isFiniteNumber(zoom) && zoom !== this.state.zoom) {
			this.state.zoom = zoom;
		}
		this.emit('openlayers:idle', {
			center,
			zoom,
		});
	}

	handleFeatureSelect(id, item, index) {
		this.state.activeIndex = id;
		this.emit('openlayers:select', {
			id,
			item,
			index,
		});
		this.syncFeatureStyles();
	}

	applyMapOptions() {
		const view = this.mapInstance?.getView();
		if (!view) {
			return;
		}
		const center = toLatLngLiteral(this.state.center) || DEFAULT_CENTER;
		const coord = this.toMapCoord(center);
		if (coord) {
			view.setCenter(coord);
		}
		view.setZoom(Number(this.state.zoom) || 2);
		view.setMinZoom(this.state.minZoom);
		view.setMaxZoom(this.state.maxZoom);
	}

	syncTileLayer() {
		const map = this.mapInstance;
		const olNs = this.getOpenLayers();
		if (!map || !olNs) {
			return;
		}
		const layers = map.getLayers();
		if (this.tileLayer) {
			layers.remove(this.tileLayer);
		}
		this.tileLayer = this.createTileLayer(olNs);
		layers.insertAt(0, this.tileLayer);
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
		if (!this.vectorSource || !this.getOpenLayers()) {
			return;
		}
		this.vectorSource.clear(true);
		this.featureById.clear();
		this.syncMarkers();
		this.syncPolylines();
		this.syncPolygons();
		this.syncCircles();
		this.syncFeatureStyles();
		if (this.state.fitItems) {
			this.fitItemBounds();
		}
		this.syncActiveSelection();
	}

	syncMarkers() {
		const olNs = this.getOpenLayers();
		const items = Array.isArray(this.state.items) ? this.state.items : [];
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const position = itemPosition(item);
			if (!position) {
				continue;
			}
			const id = itemId(item, index);
			const feature = new olNs.Feature({
				geometry: new olNs.geom.Point(this.toMapCoord(position)),
			});
			feature.set('uwcId', id);
			feature.set('uwcItem', item);
			feature.set('uwcIndex', index);
			feature.set('uwcKind', 'marker');
			this.vectorSource.addFeature(feature);
			this.featureById.set(id, feature);
		}
	}

	syncPolylines() {
		const olNs = this.getOpenLayers();
		const items = Array.isArray(this.state.polylines) ? this.state.polylines : [];
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const id = itemId(item, index);
			const path = pathFromItem(item.path || item.points);
			if (path.length < 2) {
				continue;
			}
			const coords = [];
			const pathCount = path.length;
			for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
				coords.push(this.toMapCoord(path[pathIndex]));
			}
			const feature = new olNs.Feature({
				geometry: new olNs.geom.LineString(coords),
			});
			feature.set('uwcId', id);
			feature.set('uwcItem', item);
			feature.set('uwcIndex', index);
			feature.set('uwcKind', 'polyline');
			feature.setStyle(new olNs.style.Style({
				stroke: new olNs.style.Stroke({
					color: item.strokeColor || '#3b82f6',
					width: item.strokeWeight ?? 3,
				}),
			}));
			this.vectorSource.addFeature(feature);
			this.featureById.set(`line:${id}`, feature);
		}
	}

	syncPolygons() {
		const olNs = this.getOpenLayers();
		const items = Array.isArray(this.state.polygons) ? this.state.polygons : [];
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const id = itemId(item, index);
			const path = pathFromItem(item.path || item.points || (Array.isArray(item.paths) ? item.paths[0] : null));
			if (path.length < 3) {
				continue;
			}
			const coords = [];
			const pathCount = path.length;
			for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
				coords.push(this.toMapCoord(path[pathIndex]));
			}
			coords.push(coords[0]);
			const feature = new olNs.Feature({
				geometry: new olNs.geom.Polygon([
					coords,
				]),
			});
			feature.set('uwcId', id);
			feature.set('uwcItem', item);
			feature.set('uwcIndex', index);
			feature.set('uwcKind', 'polygon');
			feature.setStyle(new olNs.style.Style({
				stroke: new olNs.style.Stroke({
					color: item.strokeColor || '#6366f1',
					width: item.strokeWeight ?? 2,
				}),
				fill: new olNs.style.Fill({
					color: item.fillColor
						? item.fillColor
						: 'rgba(99, 102, 241, 0.25)',
				}),
			}));
			this.vectorSource.addFeature(feature);
			this.featureById.set(`poly:${id}`, feature);
		}
	}

	syncCircles() {
		const olNs = this.getOpenLayers();
		const items = Array.isArray(this.state.circles) ? this.state.circles : [];
		const count = items.length;
		for (let index = 0; index < count; index += 1) {
			const item = items[index];
			const id = itemId(item, index);
			const center = toLatLngLiteral(item) || toLatLngLiteral(item.center);
			if (!center) {
				continue;
			}
			const radius = Number(item.radius) || 1000;
			// Prefer geodesic circular polygon (meters); fall back to projection circle.
			let geometry = null;
			if (typeof olNs.geom.Polygon.circular === 'function') {
				geometry = olNs.geom.Polygon.circular(
					olNs.proj.fromLonLat([
						center.lng,
						center.lat,
					]),
					radius,
					64,
				);
			} else {
				const circle = new olNs.geom.Circle(this.toMapCoord(center), radius);
				geometry = typeof olNs.geom.Polygon.fromCircle === 'function'
					? olNs.geom.Polygon.fromCircle(circle, 64)
					: circle;
			}
			const feature = new olNs.Feature({
				geometry,
			});
			feature.set('uwcId', id);
			feature.set('uwcItem', item);
			feature.set('uwcIndex', index);
			feature.set('uwcKind', 'circle');
			feature.setStyle(new olNs.style.Style({
				stroke: new olNs.style.Stroke({
					color: item.strokeColor || '#0ea5e9',
					width: item.strokeWeight ?? 2,
				}),
				fill: new olNs.style.Fill({
					color: 'rgba(14, 165, 233, 0.18)',
				}),
			}));
			this.vectorSource.addFeature(feature);
			this.featureById.set(`circle:${id}`, feature);
		}
	}

	syncFeatureStyles() {
		const olNs = this.getOpenLayers();
		if (!olNs) {
			return;
		}
		const activeId = String(this.state.activeIndex || '');
		const defaultStyle = this.makeDefaultStyle(olNs);
		const activeStyle = this.makeActiveStyle(olNs);
		for (const [id, feature] of this.featureById) {
			if (feature.get('uwcKind') !== 'marker') {
				continue;
			}
			feature.setStyle(id === activeId ? activeStyle : defaultStyle);
		}
	}

	syncActiveSelection() {
		const id = String(this.state.activeIndex || '');
		if (!id) {
			return;
		}
		const feature = this.featureById.get(id);
		if (feature) {
			const geometry = feature.getGeometry();
			const coord = geometry?.getCoordinates?.();
			const point = this.fromMapCoord(coord);
			if (point) {
				this.panTo(point);
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

	fitItemBounds(padding) {
		const map = this.mapInstance;
		const source = this.vectorSource;
		if (!map || !source) {
			return false;
		}
		const extent = source.getExtent();
		if (!extent || !isFiniteNumber(extent[0])) {
			return false;
		}
		const pad = isFiniteNumber(padding) ? padding : 48;
		map.getView().fit(extent, {
			padding: [
				pad,
				pad,
				pad,
				pad,
			],
			maxZoom: 16,
			duration: 300,
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
		this.mapInstance?.updateSize?.();
	}

	destroyMapInstance() {
		if (this.mapInstance) {
			this.mapInstance.un('singleclick', this.mapClickForwarder);
			this.mapInstance.un('moveend', this.mapMoveForwarder);
			this.mapInstance.setTarget(null);
			this.mapInstance = null;
		}
		this.view = null;
		this.vectorSource = null;
		this.vectorLayer = null;
		this.tileLayer = null;
		this.featureById.clear();
		this.syncScheduled = false;
	}

	teardownMap() {
		this.bootGeneration += 1;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.destroyMapInstance();
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
			<div class="ol-root" data-phase=${phase}>
				<div #map class="ol-canvas" role="application" aria-label=${this.state.emptyLabel || 'Map'}></div>
				<div class="ol-overlay" ?hidden=${phase === 'ready'} ?data-interactive=${phase === 'error'}>
					<div class="ol-status" data-tone=${phase === 'error' ? 'danger' : 'neutral'}>
						<span class="ol-status-label">${() => {
							if (phase === 'loading') {
								return 'Loading OpenLayers…';
							}
							if (phase === 'error') {
								return 'Map unavailable';
							}
							return this.state.emptyLabel || 'Map';
						}}</span>
						<span class="ol-status-msg" ?hidden=${!this.state.errorMessage}>${this.state.errorMessage}</span>
					</div>
				</div>
			</div>
		`;
	}
}

customElements.define('ui-openlayers', UIOpenLayers);
