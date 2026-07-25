/*
	DESCRIPTION: ui-flight-tracker — global flight-radar surface. Composes a map
	host (open-source by default) with a polar radar (standalone pane and/or HUD
	overlay on the map), a flight list, and a detail panel. Modes:
	  radar    — standalone scope only
	  map      — map only (plane markers; optional radarOverlay HUD)
	  both     — map + standalone radar side-by-side
	  overlay  — map with radar HUD drawn on top (no separate radar column)
	Map providers: openstreetmap (default OSS), leaflet, openlayers, google.
	`mapProvider: 'auto'` → google when apiKey, leaflet when tileUrl, else OSM.
	Selection is two-way via `activeIndex`. Events: flight-tracker:select|change|error.
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-flight-tracker
	    .state.mode=${'overlay'}
	    .state.center=${{ lat: 51.47, lng: -0.46 }}
	    .state.items=${flights}
	    @flight-tracker:select=${this.handleFlight}></ui-flight-tracker>
	  // Standalone radar: .state.mode=${'radar'}
	  // Map + side radar:  .state.mode=${'both'}
	  // HUD off on map:    .state.radarOverlay=${false}
	  // Force provider: .state.mapProvider=${'openstreetmap'|'leaflet'|'openlayers'|'google'}
	  // Poll: .state.endpoint=${'/api/flights'} .state.pollMs=${10000}
	─────────────────────────────────────────────────────────────────────
*/
import '../google-map/google-map.js';
import '../leaflet/leaflet.js';
import '../openlayers/openlayers.js';
import '../openstreetmap/openstreetmap.js';
import { html, WebComponent } from 'webcomponent';
import { UIFlightRow } from './flight-row.js';
const EARTH_RADIUS_KM = 6371;
const RADAR_VIEW = 100;
const RADAR_CENTER = RADAR_VIEW / 2;
const RADAR_RADIUS = 46;
const RING_COUNT = 4;
const DEFAULT_CENTER = {
	lat: 51.47,
	lng: -0.46,
};
/** Canonical map hosts. Aliases collapse in resolveMapProvider(). */
const MAP_PROVIDER_ALIASES = {
	auto: 'auto',
	openstreetmap: 'openstreetmap',
	osm: 'openstreetmap',
	leaflet: 'leaflet',
	openlayers: 'openlayers',
	ol: 'openlayers',
	google: 'google',
	gmaps: 'google',
	'google-map': 'google',
	'google-maps': 'google',
};
const DEFAULT_MAP_PROVIDER = 'openstreetmap';
function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}
function toLatLng(input) {
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
function toRadians(degrees) {
	return (degrees * Math.PI) / 180;
}
function toDegrees(radians) {
	return (radians * 180) / Math.PI;
}
function haversineKm(from, to) {
	const dLat = toRadians(to.lat - from.lat);
	const dLng = toRadians(to.lng - from.lng);
	const a = (Math.sin(dLat / 2) ** 2) +
		(Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * (Math.sin(dLng / 2) ** 2));
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
function bearingDegrees(from, to) {
	const fromLat = toRadians(from.lat);
	const toLat = toRadians(to.lat);
	const dLng = toRadians(to.lng - from.lng);
	const y = Math.sin(dLng) * Math.cos(toLat);
	const x = (Math.cos(fromLat) * Math.sin(toLat)) -
		(Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng));
	return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}
function flightId(item, index) {
	if (item?.id != null && item.id !== '') {
		return String(item.id);
	}
	if (item?.icao24) {
		return String(item.icao24);
	}
	if (item?.callsign) {
		return String(item.callsign).trim();
	}
	return String(index);
}
function flightLabel(item) {
	const callsign = String(item?.callsign || item?.label || '').trim();
	if (callsign) {
		return callsign;
	}
	return String(item?.icao24 || item?.id || 'FLIGHT');
}
function formatAltitude(meters) {
	if (!isFiniteNumber(meters)) {
		return '—';
	}
	const feet = Math.round(meters * 3.28084);
	return `${feet.toLocaleString()} ft`;
}
function formatSpeed(mps) {
	if (!isFiniteNumber(mps)) {
		return '—';
	}
	const knots = Math.round(mps * 1.94384);
	return `${knots} kt`;
}
function formatHeading(degrees) {
	if (!isFiniteNumber(degrees)) {
		return '—';
	}
	return `${Math.round(degrees)}°`;
}
/** OpenSky `states` row → flight item. */
function fromOpenSkyState(row) {
	if (!Array.isArray(row) || row.length < 11) {
		return null;
	}
	const lat = row[6];
	const lng = row[5];
	if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
		return null;
	}
	const callsign = String(row[1] || '').trim();
	const icao24 = String(row[0] || '');
	return {
		id: icao24 || callsign,
		icao24,
		callsign,
		label: callsign || icao24,
		originCountry: row[2] || '',
		lat,
		lng,
		altitude: row[7] ?? row[13] ?? null,
		onGround: Boolean(row[8]),
		speed: row[9],
		heading: row[10],
		verticalRate: row[11],
		squawk: row[14] || '',
	};
}
function normalizeFlight(raw, index) {
	if (!raw || typeof raw !== 'object') {
		return null;
	}
	if (Array.isArray(raw)) {
		return fromOpenSkyState(raw);
	}
	const position = toLatLng(raw) || toLatLng(raw.position) || toLatLng(raw.coords);
	if (!position) {
		return null;
	}
	const id = flightId(raw, index);
	return {
		...raw,
		id,
		lat: position.lat,
		lng: position.lng,
		label: flightLabel(raw),
		callsign: String(raw.callsign || raw.label || '').trim(),
		heading: isFiniteNumber(raw.heading) ? raw.heading : (isFiniteNumber(raw.track) ? raw.track : (isFiniteNumber(raw.trueTrack) ? raw.trueTrack : null)),
		speed: isFiniteNumber(raw.speed) ? raw.speed : (isFiniteNumber(raw.velocity) ? raw.velocity : null),
		altitude: isFiniteNumber(raw.altitude) ? raw.altitude : (isFiniteNumber(raw.geoAltitude) ? raw.geoAltitude : (isFiniteNumber(raw.baroAltitude) ? raw.baroAltitude : null)),
	};
}
function ingestPayload(payload) {
	if (!payload) {
		return [];
	}
	if (Array.isArray(payload)) {
		return normalizeList(payload);
	}
	if (Array.isArray(payload.items)) {
		return normalizeList(payload.items);
	}
	if (Array.isArray(payload.states)) {
		return normalizeList(payload.states);
	}
	if (Array.isArray(payload.flights)) {
		return normalizeList(payload.flights);
	}
	return [];
}
function normalizeList(list) {
	const out = [];
	const count = list.length;
	for (let index = 0; index < count; index += 1) {
		const item = normalizeFlight(list[index], index);
		if (item) {
			out.push(item);
		}
	}
	return out;
}
function mapItemsFromFlights(flights, activeId) {
	const out = [];
	const count = flights.length;
	for (let index = 0; index < count; index += 1) {
		const flight = flights[index];
		const active = flight.id === activeId;
		out.push({
			id: flight.id,
			lat: flight.lat,
			lng: flight.lng,
			label: flight.label,
			description: [
				formatAltitude(flight.altitude),
				formatSpeed(flight.speed),
				formatHeading(flight.heading),
			].join(' · '),
			heading: flight.heading,
			// Leaflet/OSM: rotated plane DivIcon instead of default pin
			marker: 'plane',
			kind: 'aircraft',
			active,
			iconColor: active ? '#f59e0b' : '#22c55e',
			tone: active ? 'warning' : 'success',
		});
	}
	return out;
}
function normalizeMapProvider(value) {
	const key = String(value || 'auto').toLowerCase().trim();
	return MAP_PROVIDER_ALIASES[key] || 'auto';
}
/**
 * Pick the live map host from config.
 * Explicit mapProvider wins. auto: google when apiKey, leaflet when tileUrl,
 * otherwise openstreetmap (best OSS default for flight radar).
 */
function resolveMapProvider(state) {
	const requested = normalizeMapProvider(state?.mapProvider);
	if (requested !== 'auto') {
		return requested;
	}
	if (String(state?.apiKey || '').trim()) {
		return 'google';
	}
	if (String(state?.tileUrl || '').trim()) {
		return 'leaflet';
	}
	return DEFAULT_MAP_PROVIDER;
}
export class UIFlightTracker extends WebComponent {
	static url = import.meta.url;
	static styles = {
		flightTracker: './flight-tracker.css',
	};
	static state = {
		// 'radar' | 'map' | 'both' | 'overlay'
		// overlay = map + polar HUD on the map (no standalone radar column)
		mode: 'overlay',
		// Draw polar radar HUD on the map pane (also implied by mode === 'overlay')
		radarOverlay: true,
		// 'auto' | 'openstreetmap' | 'leaflet' | 'openlayers' | 'google' (+ aliases)
		mapProvider: 'auto',
		// OSM preset when provider is openstreetmap: standard | humanitarian | cyclosm | topo
		mapLayer: 'standard',
		// Optional XYZ template for leaflet / openlayers (also tips auto → leaflet)
		tileUrl: '',
		tileAttribution: '',
		// Google Maps only (also tips auto → google when non-empty)
		apiKey: '',
		mapId: '',
		center: {
			lat: DEFAULT_CENTER.lat,
			lng: DEFAULT_CENTER.lng,
		},
		zoom: 8,
		radarRangeKm: 250,
		sweep: true,
		showList: true,
		showDetail: true,
		showLabels: true,
		heading: '',
		items: [],
		// Derived marker payload for the map child (kept in state so identity is stable).
		mapItems: [],
		activeIndex: '',
		loader: null,
		endpoint: '',
		pollMs: 0,
		loading: false,
		errorMessage: '',
		lastUpdated: 0,
		fitItems: true,
	};
	pollTimer = null;
	loadGeneration = 0;
	abortController = null;
	onConnect() {
		this.observe([
			'loader',
			'endpoint',
			'pollMs',
			'center',
			'radarRangeKm',
		], this.restartPolling);
		this.observe(['items', 'activeIndex'], this.syncDerivedViews);
	}
	onMount() {
		this.syncDerivedViews();
		this.restartPolling();
	}
	onDisconnect() {
		this.stopPolling();
		this.abortController?.abort();
		this.abortController = null;
	}
	restartPolling() {
		this.stopPolling();
		const hasSource = typeof this.state.loader === 'function' || String(this.state.endpoint || '').trim();
		if (!hasSource) {
			return;
		}
		this.refreshFlights();
		const pollMs = Number(this.state.pollMs) || 0;
		if (pollMs > 0) {
			this.pollTimer = this.addInterval(this.onPollTick, pollMs);
		}
	}
	stopPolling() {
		if (this.pollTimer != null) {
			this.stopInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}
	onPollTick(component) {
		component.refreshFlights();
	}
	async refreshFlights() {
		const generation = (this.loadGeneration += 1);
		this.abortController?.abort();
		const controller = new AbortController();
		this.abortController = controller;
		this.state.loading = true;
		const result = await this.loadFlightData(controller.signal);
		if (generation !== this.loadGeneration) {
			return;
		}
		if (!result.ok) {
			this.assignState({
				loading: false,
				errorMessage: result.message,
			});
			this.emit('flight-tracker:error', {
				message: result.message,
				errKind: result.errKind,
			});
			return;
		}
		this.assignState({
			items: result.items,
			loading: false,
			errorMessage: '',
			lastUpdated: Date.now(),
		});
		this.syncDerivedViews();
		this.emit('flight-tracker:change', {
			items: result.items,
			count: result.items.length,
		});
	}
	async loadFlightData(signal) {
		const loader = this.state.loader;
		if (typeof loader === 'function') {
			try {
				const payload = await loader({
					signal,
					center: toLatLng(this.state.center) || DEFAULT_CENTER,
					rangeKm: Number(this.state.radarRangeKm) || 250,
					bounds: this.boundsAroundCenter(),
				});
				return {
					ok: true,
					items: ingestPayload(payload),
				};
			} catch (cause) {
				if (cause?.name === 'AbortError') {
					return {
						ok: false,
						errKind: 'aborted',
						message: 'Flight load aborted',
					};
				}
				return {
					ok: false,
					errKind: 'loader-error',
					message: cause?.message || String(cause),
				};
			}
		}
		const endpoint = String(this.state.endpoint || '').trim();
		if (!endpoint) {
			return {
				ok: true,
				items: normalizeList(this.state.items),
			};
		}
		try {
			const url = this.buildEndpointUrl(endpoint);
			const response = await globalThis.fetch(url, {
				signal,
				headers: {
					Accept: 'application/json',
				},
			});
			if (!response.ok) {
				return {
					ok: false,
					errKind: 'http-error',
					message: `Flight endpoint HTTP ${response.status}`,
				};
			}
			const payload = await response.json();
			return {
				ok: true,
				items: ingestPayload(payload),
			};
		} catch (cause) {
			if (cause?.name === 'AbortError') {
				return {
					ok: false,
					errKind: 'aborted',
					message: 'Flight load aborted',
				};
			}
			return {
				ok: false,
				errKind: 'network-error',
				message: cause?.message || String(cause),
			};
		}
	}
	buildEndpointUrl(endpoint) {
		const center = toLatLng(this.state.center) || DEFAULT_CENTER;
		const rangeKm = Number(this.state.radarRangeKm) || 250;
		const bounds = this.boundsAroundCenter();
		try {
			const url = new URL(endpoint, globalThis.location?.origin || 'http://localhost');
			url.searchParams.set('lat', String(center.lat));
			url.searchParams.set('lng', String(center.lng));
			url.searchParams.set('rangeKm', String(rangeKm));
			if (bounds) {
				url.searchParams.set('lamin', String(bounds.south));
				url.searchParams.set('lamax', String(bounds.north));
				url.searchParams.set('lomin', String(bounds.west));
				url.searchParams.set('lomax', String(bounds.east));
			}
			return url.toString();
		} catch {
			return endpoint;
		}
	}
	boundsAroundCenter() {
		const center = toLatLng(this.state.center) || DEFAULT_CENTER;
		const rangeKm = Number(this.state.radarRangeKm) || 250;
		const latDelta = rangeKm / 110.574;
		const lngDelta = rangeKm / (111.32 * Math.cos(toRadians(center.lat)) || 1);
		return {
			north: center.lat + latDelta,
			south: center.lat - latDelta,
			east: center.lng + lngDelta,
			west: center.lng - lngDelta,
		};
	}
	syncDerivedViews() {
		const flights = this.normalizedItems();
		const activeId = String(this.state.activeIndex || '');
		const count = flights.length;
		for (let index = 0; index < count; index += 1) {
			flights[index].active = flights[index].id === activeId;
		}
		// If the caller handed us a plain array, write normalized+flagged copy once so
		// list rows receive stable item objects with `active` for the row component.
		if (this.state.items !== flights) {
			const source = this.state.items;
			if (Array.isArray(source) && source.length === flights.length) {
				for (let index = 0; index < count; index += 1) {
					if (source[index] && typeof source[index] === 'object' && !Array.isArray(source[index])) {
						source[index].active = flights[index].id === activeId;
						if (!source[index].id) {
							source[index].id = flights[index].id;
						}
						if (!source[index].label) {
							source[index].label = flights[index].label;
						}
					}
				}
			}
		}
		this.state.mapItems = mapItemsFromFlights(flights, activeId);
	}
	selectFlight(id, item, index) {
		this.state.activeIndex = id;
		this.syncDerivedViews();
		this.emit('flight-tracker:select', {
			id,
			item,
			index,
		});
	}
	handleListSelect(domEvent) {
		const data = domEvent?.detail?.data;
		const id = data?.id;
		if (id == null || id === '') {
			return;
		}
		const flights = this.normalizedItems();
		const count = flights.length;
		let item = data.item;
		let index = data.index;
		for (let flightIndex = 0; flightIndex < count; flightIndex += 1) {
			if (flights[flightIndex].id === String(id)) {
				item = flights[flightIndex];
				index = flightIndex;
				break;
			}
		}
		this.selectFlight(String(id), item, index);
	}
	handleMapSelect(domEvent) {
		const data = domEvent?.detail?.data;
		if (!data?.id) {
			return;
		}
		const flights = this.normalizedItems();
		const count = flights.length;
		let item = data.item;
		let index = data.index;
		for (let flightIndex = 0; flightIndex < count; flightIndex += 1) {
			if (flights[flightIndex].id === String(data.id)) {
				item = flights[flightIndex];
				index = flightIndex;
				break;
			}
		}
		this.selectFlight(String(data.id), item, index);
	}
	handleRadarClick(domEvent) {
		const path = typeof domEvent?.composedPath === 'function' ? domEvent.composedPath() : [];
		const pathCount = path.length;
		let id = '';
		for (let index = 0; index < pathCount; index += 1) {
			const node = path[index];
			const candidate = node?.dataset?.id || node?.getAttribute?.('data-id');
			if (candidate) {
				id = candidate;
				break;
			}
		}
		if (!id) {
			id = domEvent?.target?.dataset?.id || domEvent?.target?.getAttribute?.('data-id') || '';
		}
		if (!id) {
			return;
		}
		const flights = this.normalizedItems();
		const count = flights.length;
		for (let index = 0; index < count; index += 1) {
			if (flights[index].id === id) {
				this.selectFlight(id, flights[index], index);
				return;
			}
		}
	}
	normalizedItems() {
		return normalizeList(this.state.items);
	}
	selectedFlight() {
		const id = String(this.state.activeIndex || '');
		if (!id) {
			return null;
		}
		const flights = this.normalizedItems();
		const count = flights.length;
		for (let index = 0; index < count; index += 1) {
			if (flights[index].id === id) {
				return flights[index];
			}
		}
		return null;
	}
	layoutMode() {
		const showMap = this.showMapPane();
		const showRadar = this.showRadarPane();
		const showSide = Boolean(this.state.showList || this.state.showDetail);
		const panes = (showMap ? 1 : 0) + (showRadar ? 1 : 0) + (showSide ? 1 : 0);
		if (panes >= 3) {
			return 'triple';
		}
		if (panes === 2) {
			return 'split';
		}
		return 'single';
	}
	showMapPane() {
		const mode = this.state.mode || 'overlay';
		return mode === 'map' || mode === 'both' || mode === 'overlay';
	}
	/** Standalone radar column (not the map HUD). */
	showRadarPane() {
		const mode = this.state.mode || 'overlay';
		return mode === 'radar' || mode === 'both';
	}
	/** Polar HUD drawn on top of the map. */
	showMapRadarOverlay() {
		const mode = this.state.mode || 'overlay';
		if (mode === 'overlay') {
			return true;
		}
		return this.showMapPane() && Boolean(this.state.radarOverlay);
	}
	/** Resolved map host tag family (never 'auto'). */
	resolvedMapProvider() {
		return resolveMapProvider(this.state);
	}
	/** Escape hatch: nested map host instance for the active provider. */
	getMapHost() {
		const provider = this.resolvedMapProvider();
		if (provider === 'google') {
			return this.findComponent('ui-google-map');
		}
		if (provider === 'openlayers') {
			return this.findComponent('ui-openlayers');
		}
		if (provider === 'leaflet') {
			return this.findComponent('ui-leaflet');
		}
		return this.findComponent('ui-openstreetmap');
	}
	radarModel() {
		const center = toLatLng(this.state.center) || DEFAULT_CENTER;
		const rangeKm = Number(this.state.radarRangeKm) || 250;
		const activeId = String(this.state.activeIndex || '');
		const flights = this.normalizedItems();
		const blips = [];
		const count = flights.length;
		for (let index = 0; index < count; index += 1) {
			const flight = flights[index];
			const distance = haversineKm(center, flight);
			if (distance > rangeKm) {
				continue;
			}
			const bearing = bearingDegrees(center, flight);
			const radius = (distance / rangeKm) * RADAR_RADIUS;
			const angle = toRadians(bearing);
			const x = RADAR_CENTER + (radius * Math.sin(angle));
			const y = RADAR_CENTER - (radius * Math.cos(angle));
			blips.push({
				id: flight.id,
				item: flight,
				index,
				x,
				y,
				heading: isFiniteNumber(flight.heading) ? flight.heading : bearing,
				active: flight.id === activeId,
				label: flight.label,
				distanceKm: distance,
			});
		}
		return {
			blips,
			rings: this.radarRings(),
		};
	}
	radarRings() {
		const rings = [];
		for (let index = 1; index <= RING_COUNT; index += 1) {
			rings.push({
				id: `ring-${index}`,
				r: (RADAR_RADIUS / RING_COUNT) * index,
			});
		}
		return rings;
	}
	ringRow(ring) {
		return html`<circle class="ft-ring" cx=${RADAR_CENTER} cy=${RADAR_CENTER} r=${ring.r}></circle>`;
	}
	blipRow(blip) {
		const transform = `translate(${blip.x}, ${blip.y}) rotate(${blip.heading})`;
		const labelX = blip.x + 3;
		const labelY = blip.y - 3;
		return html`
			<g class="ft-blip-group" data-id=${blip.id}>
				<g class="ft-ac" transform=${transform}>
					<polygon
						class="ft-blip"
						data-id=${blip.id}
						?data-active=${blip.active}
						points="0,-3.2 2.2,3 0,1.6 -2.2,3"
						role="button"
						tabindex="0"
						aria-label=${blip.label}></polygon>
				</g>
				<text class="ft-blip-label" x=${labelX} y=${labelY} ?hidden=${!blip.label}>${blip.label}</text>
			</g>
		`;
	}
	metaLine() {
		const flights = this.normalizedItems();
		const parts = [`${flights.length} tracks`];
		if (this.showMapPane()) {
			parts.push(this.resolvedMapProvider());
		}
		if (this.state.loading) {
			parts.push('updating…');
		}
		if (this.state.lastUpdated) {
			parts.push(new Date(this.state.lastUpdated).toLocaleTimeString());
		}
		return parts.join(' · ');
	}
	detailFragment() {
		const flight = this.selectedFlight();
		if (!flight || !this.state.showDetail) {
			return '';
		}
		return this.htmlElement`
			<div class="ft-detail">
				<div class="ft-detail-title">${flight.label}</div>
				<dl class="ft-detail-grid">
					<dt>ICAO</dt><dd>${flight.icao24 || flight.id || '—'}</dd>
					<dt>Alt</dt><dd>${formatAltitude(flight.altitude)}</dd>
					<dt>Speed</dt><dd>${formatSpeed(flight.speed)}</dd>
					<dt>Track</dt><dd>${formatHeading(flight.heading)}</dd>
					<dt>Pos</dt><dd>${flight.lat.toFixed(3)}, ${flight.lng.toFixed(3)}</dd>
					<dt>Squawk</dt><dd>${flight.squawk || '—'}</dd>
					<dt>Country</dt><dd>${flight.originCountry || '—'}</dd>
				</dl>
			</div>
		`;
	}
	radarFragment() {
		if (!this.showRadarPane()) {
			return '';
		}
		const model = this.radarModel();
		const showSweep = Boolean(this.state.sweep);
		return this.htmlElement`
			<div class="ft-pane ft-pane-radar" aria-label="Flight radar">
				<div class="ft-radar" @click=${this.handleRadarClick}>
					<svg class="ft-radar-svg" viewBox="0 0 ${RADAR_VIEW} ${RADAR_VIEW}" role="img" aria-label="Radar scope">
						${this.each(model.rings, this.ringRow, this.ringKey)}
						<line class="ft-cross" x1=${RADAR_CENTER} y1="4" x2=${RADAR_CENTER} y2=${RADAR_VIEW - 4}></line>
						<line class="ft-cross" x1="4" y1=${RADAR_CENTER} x2=${RADAR_VIEW - 4} y2=${RADAR_CENTER}></line>
						<g class="ft-sweep" ?hidden=${!showSweep}>
							<path class="ft-sweep-fan" d=${this.sweepPath()}></path>
						</g>
						${this.each(model.blips, this.blipRow, this.blipKey)}
						<circle class="ft-radar-origin" cx=${RADAR_CENTER} cy=${RADAR_CENTER} r="1.2"></circle>
					</svg>
				</div>
			</div>
		`;
	}
	/** Polar HUD stacked on the map — same blip model as standalone radar. */
	mapRadarOverlayFragment() {
		if (!this.showMapRadarOverlay()) {
			return '';
		}
		const model = this.radarModel();
		const showSweep = Boolean(this.state.sweep);
		return this.htmlElement`
			<div class="ft-map-radar" aria-label="Map radar overlay" @click=${this.handleRadarClick}>
				<svg class="ft-radar-svg" viewBox="0 0 ${RADAR_VIEW} ${RADAR_VIEW}" role="img" aria-label="Map radar scope">
					${this.each(model.rings, this.ringRow, this.ringKey)}
					<line class="ft-cross" x1=${RADAR_CENTER} y1="4" x2=${RADAR_CENTER} y2=${RADAR_VIEW - 4}></line>
					<line class="ft-cross" x1="4" y1=${RADAR_CENTER} x2=${RADAR_VIEW - 4} y2=${RADAR_CENTER}></line>
					<g class="ft-sweep" ?hidden=${!showSweep}>
						<path class="ft-sweep-fan" d=${this.sweepPath()}></path>
					</g>
					${this.each(model.blips, this.blipRow, this.blipKey)}
					<circle class="ft-radar-origin" cx=${RADAR_CENTER} cy=${RADAR_CENTER} r="1.2"></circle>
				</svg>
			</div>
		`;
	}
	sweepPath() {
		const r = RADAR_RADIUS;
		const c = RADAR_CENTER;
		// Wedge from north toward east (~50° fan).
		return `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 0 1 ${c + (r * 0.76)} ${c - (r * 0.64)} Z`;
	}
	ringKey(ring) {
		return ring.id;
	}
	blipKey(blip) {
		return blip.id;
	}
	flightKey(item) {
		return item.id;
	}
	mapFragment() {
		if (!this.showMapPane()) {
			return '';
		}
		const provider = this.resolvedMapProvider();
		if (provider === 'google') {
			return this.googleMapFragment();
		}
		if (provider === 'openlayers') {
			return this.openlayersMapFragment();
		}
		if (provider === 'leaflet') {
			return this.leafletMapFragment();
		}
		return this.openstreetmapMapFragment();
	}
	sharedMapCenter() {
		return toLatLng(this.state.center) || DEFAULT_CENTER;
	}
	googleMapFragment() {
		const center = this.sharedMapCenter();
		return this.htmlElement`
			<div class="ft-pane ft-pane-map" data-map-provider="google" data-radar-overlay=${this.showMapRadarOverlay()}>
				<div class="ft-map-host">
					<ui-google-map
						.state.apiKey=${this.state.apiKey}
						.state.mapId=${this.state.mapId}
						.state.center=${center}
						.state.zoom=${this.state.zoom}
						.state.items=${this.state.mapItems}
						.state.activeIndex=${this.state.activeIndex}
						.state.fitItems=${this.state.fitItems}
						.state.emptyLabel=${'Flight map · Google'}
						@google-map:select=${this.handleMapSelect}></ui-google-map>
				</div>
				${this.mapRadarOverlayFragment}
			</div>
		`;
	}
	openstreetmapMapFragment() {
		const center = this.sharedMapCenter();
		return this.htmlElement`
			<div class="ft-pane ft-pane-map" data-map-provider="openstreetmap" data-radar-overlay=${this.showMapRadarOverlay()}>
				<div class="ft-map-host">
					<ui-openstreetmap
						.state.center=${center}
						.state.zoom=${this.state.zoom}
						.state.layer=${this.state.mapLayer || 'standard'}
						.state.items=${this.state.mapItems}
						.state.activeIndex=${this.state.activeIndex}
						.state.fitItems=${this.state.fitItems}
						.state.emptyLabel=${'Flight map · OpenStreetMap'}
						@openstreetmap:select=${this.handleMapSelect}></ui-openstreetmap>
				</div>
				${this.mapRadarOverlayFragment}
			</div>
		`;
	}
	leafletMapFragment() {
		const center = this.sharedMapCenter();
		const tileUrl = String(this.state.tileUrl || '').trim();
		return this.htmlElement`
			<div class="ft-pane ft-pane-map" data-map-provider="leaflet" data-radar-overlay=${this.showMapRadarOverlay()}>
				<div class="ft-map-host">
					<ui-leaflet
						.state.center=${center}
						.state.zoom=${this.state.zoom}
						.state.tileUrl=${tileUrl}
						.state.tileAttribution=${this.state.tileAttribution}
						.state.items=${this.state.mapItems}
						.state.activeIndex=${this.state.activeIndex}
						.state.fitItems=${this.state.fitItems}
						.state.emptyLabel=${'Flight map · Leaflet'}
						@leaflet:select=${this.handleMapSelect}></ui-leaflet>
				</div>
				${this.mapRadarOverlayFragment}
			</div>
		`;
	}
	openlayersMapFragment() {
		const center = this.sharedMapCenter();
		const tileUrl = String(this.state.tileUrl || '').trim();
		return this.htmlElement`
			<div class="ft-pane ft-pane-map" data-map-provider="openlayers" data-radar-overlay=${this.showMapRadarOverlay()}>
				<div class="ft-map-host">
					<ui-openlayers
						.state.center=${center}
						.state.zoom=${this.state.zoom}
						.state.tileUrl=${tileUrl}
						.state.tileAttribution=${this.state.tileAttribution}
						.state.items=${this.state.mapItems}
						.state.activeIndex=${this.state.activeIndex}
						.state.fitItems=${this.state.fitItems}
						.state.emptyLabel=${'Flight map · OpenLayers'}
						@openlayers:select=${this.handleMapSelect}></ui-openlayers>
				</div>
				${this.mapRadarOverlayFragment}
			</div>
		`;
	}
	hasFlightItems() {
		return Array.isArray(this.state.items) && this.state.items.length > 0;
	}
	sideFragment() {
		if (!this.state.showList && !this.state.showDetail) {
			return '';
		}
		// list() must be a bare template binding — returning it from a `() =>`
		// computed spot stringifies the ListHandle as JSON in the DOM.
		return this.htmlElement`
			<aside class="ft-pane ft-side">
				<h3 class="ft-side-heading">Flights</h3>
				<div class="ft-list" ?hidden=${!this.state.showList} @flight-row:select=${this.handleListSelect}>
					<div class="ft-empty" ?hidden=${this.hasFlightItems}>No tracks in range. Pass items, a loader, or an endpoint.</div>
					${this.list('items', UIFlightRow)}
				</div>
				${this.detailFragment}
			</aside>
		`;
	}
	render() {
		const layout = this.layoutMode();
		const mode = this.state.mode || 'overlay';
		const mapProvider = this.showMapPane() ? this.resolvedMapProvider() : '';
		this.html`
			<div class="ft" data-layout=${layout} data-mode=${mode} data-map-provider=${mapProvider} ?data-radar-overlay=${this.showMapRadarOverlay()}>
				<div class="ft-toolbar">
					<h2 class="ft-heading">${this.state.heading || 'Flight tracker'}</h2>
					<span class="ft-meta">${this.metaLine}</span>
					<span class="ft-meta" data-tone="danger" ?hidden=${!this.state.errorMessage}>${this.state.errorMessage}</span>
				</div>
				<div class="ft-body">
					${this.mapFragment}
					${this.radarFragment}
					${this.sideFragment}
				</div>
			</div>
		`;
	}
}
customElements.define('ui-flight-tracker', UIFlightTracker);
