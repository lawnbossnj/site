/*
	DESCRIPTION: ui-gauge — semi-circular dial gauge (SVG). Distinct from
	ui-progress-ring (full-circle %). Optional thresholds recolor the arc.
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-gauge .state.value=${72} .state.max=${100} .state.label=${'CPU'}></ui-gauge>
	  <ui-gauge .state.value=${94} .state.thresholds=${[{ at: 80, tone: 'warning' }, { at: 90, tone: 'danger' }]}>
	─────────────────────────────────────────────────────────────────────
*/
import { WebComponent } from 'webcomponent';
import {
	CHART_TONES,
	clamp,
	donutArcPath,
	formatTick,
} from '../charts/chartMath.js';

const VIEW_W = 200;
const VIEW_H = 120;
const CX = 100;
const CY = 100;
const OUTER = 78;
const INNER = 58;
// polar: 0=12 o'clock, 90=3, 180=6, 270=9. Gauge arc left→top→right.
const START = 270;
const SWEEP = 180;

export class UIGauge extends WebComponent {
	static url = import.meta.url;
	static styles = {
		gauge: './gauge.css',
	};
	static state = {
		value: 0,
		min: 0,
		max: 100,
		label: '',
		unit: '',
		tone: 'accent',
		thresholds: [],
		showValue: true,
	};

	get ratio() {
		const min = Number(this.state.min) || 0;
		const max = Number(this.state.max) || 100;
		return clamp((Number(this.state.value) - min) / (max - min || 1), 0, 1);
	}

	effectiveTone() {
		const thresholds = this.state.thresholds;
		if (Array.isArray(thresholds) && thresholds.length > 0) {
			let chosen = '';
			let best = -Infinity;
			const value = Number(this.state.value);
			const count = thresholds.length;
			for (let index = 0; index < count; index += 1) {
				const rule = thresholds[index] || {};
				if (value >= rule.at && rule.at > best) {
					best = rule.at;
					chosen = rule.tone;
				}
			}
			if (chosen) {
				return chosen;
			}
		}
		return CHART_TONES.has(this.state.tone) ? this.state.tone : 'accent';
	}

	trackPath() {
		return donutArcPath(CX, CY, INNER, OUTER, START, START + SWEEP);
	}

	valuePath() {
		if (this.ratio <= 0) {
			return '';
		}
		const end = START + (SWEEP * this.ratio);
		return donutArcPath(CX, CY, INNER, OUTER, START, end);
	}

	displayValue() {
		const value = Number(this.state.value);
		const text = formatTick(value);
		const unit = String(this.state.unit || '');
		return unit ? `${text}${unit}` : text;
	}

	render() {
		this.html`
			<div class="gg" data-tone=${this.effectiveTone()} role="meter"
				aria-label=${this.state.label || 'Gauge'}
				aria-valuemin=${this.state.min}
				aria-valuemax=${this.state.max}
				aria-valuenow=${this.state.value}>
				<svg class="gg-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}">
					<path class="gg-track" d=${this.trackPath}></path>
					<path class="gg-value" d=${this.valuePath}></path>
				</svg>
				<div class="gg-readout">
					<span class="gg-value-text" ?hidden=${!this.state.showValue}>${this.displayValue}</span>
					<span class="gg-label" ?hidden=${!this.state.label}>${this.state.label}</span>
				</div>
			</div>
		`;
	}
}

customElements.define('ui-gauge', UIGauge);
