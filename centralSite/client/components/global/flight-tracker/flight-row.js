/*
	DESCRIPTION: ui-flight-row — selectable flight list row for ui-flight-tracker.
	Items land as state (callsign/label, altitude, speed, heading, active).
*/
import { WebComponent } from 'webcomponent';

function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

function formatAltitude(meters) {
	if (!isFiniteNumber(meters)) {
		return '—';
	}
	return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
}

function formatSpeed(mps) {
	if (!isFiniteNumber(mps)) {
		return '—';
	}
	return `${Math.round(mps * 1.94384)} kt`;
}

function formatHeading(degrees) {
	if (!isFiniteNumber(degrees)) {
		return '—';
	}
	return `${Math.round(degrees)}°`;
}

export class UIFlightRow extends WebComponent {
	static url = import.meta.url;
	static styles = {
		flightRow: './flight-row.css',
	};
	static state = {
		id: '',
		label: '',
		callsign: '',
		altitude: null,
		speed: null,
		heading: null,
		originCountry: '',
		active: false,
		lat: 0,
		lng: 0,
	};

	handleClick() {
		this.emit('flight-row:select', {
			id: String(this.state.id || ''),
			item: {
				id: this.state.id,
				label: this.state.label,
				callsign: this.state.callsign,
				altitude: this.state.altitude,
				speed: this.state.speed,
				heading: this.state.heading,
				originCountry: this.state.originCountry,
				lat: this.state.lat,
				lng: this.state.lng,
			},
		});
	}

	displayLabel() {
		return this.state.label || this.state.callsign || this.state.id || 'FLIGHT';
	}

	metaLine() {
		const parts = [
			formatSpeed(this.state.speed),
			formatHeading(this.state.heading),
		];
		if (this.state.originCountry) {
			parts.push(this.state.originCountry);
		}
		return parts.join(' · ');
	}

	render() {
		this.html`
			<button type="button" class="ft-row" ?data-active=${this.state.active} @click=${this.handleClick}>
				<span class="ft-row-callsign">${this.displayLabel}</span>
				<span class="ft-row-alt">${() => {
					return formatAltitude(this.state.altitude);
				}}</span>
				<span class="ft-row-meta">${this.metaLine}</span>
			</button>
		`;
	}
}

customElements.define('ui-flight-row', UIFlightRow);
