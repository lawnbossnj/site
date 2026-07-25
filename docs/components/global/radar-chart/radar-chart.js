/*
	DESCRIPTION: ui-radar-chart — multi-axis spider / radar chart (SVG via ^html).
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-radar-chart
	    .state.categories=${['CPU','RAM','Disk','Net','GPU']}
	    .state.series=${[{ label: 'Node A', values: [80, 60, 40, 90, 70] }]}>
	  </ui-radar-chart>
	─────────────────────────────────────────────────────────────────────
*/
import { html, WebComponent } from 'webcomponent';
import {
	normalizeValueSeries,
	polarToCartesian,
	polylinePoints,
} from '../charts/chartMath.js';
import { escapeSvg } from '../charts/escapeSvg.js';

const VIEW = 240;
const CX = 120;
const CY = 120;
const RADIUS = 88;
const LEVELS = 4;

export class UIRadarChart extends WebComponent {
	static url = import.meta.url;
	static styles = {
		radarChart: './radar-chart.css',
	};
	static state = {
		categories: [],
		series: [],
		max: null,
		showLegend: true,
		showLabels: true,
		tone: 'accent',
		label: '',
		emptyLabel: 'No data',
	};

	plotModel() {
		const categories = Array.isArray(this.state.categories) ? this.state.categories : [];
		const series = normalizeValueSeries(this.state.series);
		const axisCount = categories.length || (series[0]?.values.length ?? 0);
		if (axisCount < 3 || series.length === 0) {
			return {
				empty: true,
				rings: [],
				axes: [],
				polys: [],
				legend: [],
			};
		}
		let max = Number(this.state.max);
		if (!Number.isFinite(max) || max <= 0) {
			max = 0;
			const seriesCount = series.length;
			for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
				const values = series[seriesIndex].values;
				const valueCount = values.length;
				for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
					if (values[valueIndex] > max) {
						max = values[valueIndex];
					}
				}
			}
			if (max <= 0) {
				max = 100;
			}
		}
		const rings = [];
		for (let level = 1; level <= LEVELS; level += 1) {
			const r = (RADIUS * level) / LEVELS;
			const points = [];
			for (let axis = 0; axis < axisCount; axis += 1) {
				const angle = (360 * axis) / axisCount;
				points.push(polarToCartesian(CX, CY, r, angle));
			}
			points.push(points[0]);
			rings.push({
				pointsAttr: polylinePoints(points),
			});
		}
		const axes = [];
		for (let axis = 0; axis < axisCount; axis += 1) {
			const angle = (360 * axis) / axisCount;
			const tip = polarToCartesian(CX, CY, RADIUS, angle);
			const labelPos = polarToCartesian(CX, CY, RADIUS + 16, angle);
			axes.push({
				x2: tip.x,
				y2: tip.y,
				labelX: labelPos.x,
				labelY: labelPos.y,
				label: categories[axis] != null ? String(categories[axis]) : String(axis + 1),
			});
		}
		const polys = [];
		const seriesCount = series.length;
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
			const row = series[seriesIndex];
			const points = [];
			for (let axis = 0; axis < axisCount; axis += 1) {
				const value = row.values[axis] ?? 0;
				const r = (Math.max(0, value) / max) * RADIUS;
				const angle = (360 * axis) / axisCount;
				points.push(polarToCartesian(CX, CY, r, angle));
			}
			points.push(points[0]);
			polys.push({
				id: row.id,
				label: row.label,
				color: row.color,
				pointsAttr: polylinePoints(points),
			});
		}
		return {
			empty: false,
			rings,
			axes,
			polys,
			legend: polys,
		};
	}

	chartSvg() {
		const model = this.plotModel();
		if (model.empty) {
			return '';
		}
		const parts = [
			`<svg class="rc-svg" viewBox="0 0 ${VIEW} ${VIEW}" role="presentation">`,
		];
		const ringCount = model.rings.length;
		for (let index = 0; index < ringCount; index += 1) {
			parts.push(`<polyline class="rc-ring" fill="none" points="${escapeSvg(model.rings[index].pointsAttr)}"></polyline>`);
		}
		const axisCount = model.axes.length;
		for (let index = 0; index < axisCount; index += 1) {
			const row = model.axes[index];
			parts.push(`<line class="rc-axis" x1="${CX}" y1="${CY}" x2="${row.x2}" y2="${row.y2}"></line>`);
		}
		const polyCount = model.polys.length;
		for (let index = 0; index < polyCount; index += 1) {
			const row = model.polys[index];
			parts.push(`<polyline class="rc-series" style="--rc-series:${escapeSvg(row.color)}" points="${escapeSvg(row.pointsAttr)}"></polyline>`);
		}
		if (this.state.showLabels) {
			for (let index = 0; index < axisCount; index += 1) {
				const row = model.axes[index];
				parts.push(`<text class="rc-label" x="${row.labelX}" y="${row.labelY}" text-anchor="middle" dominant-baseline="middle">${escapeSvg(row.label)}</text>`);
			}
		}
		parts.push('</svg>');
		return parts.join('');
	}

	isEmpty() {
		return this.plotModel().empty;
	}
	hideEmpty() {
		return !this.plotModel().empty;
	}

	legendModel() {
		const model = this.plotModel();
		if (!this.state.showLegend || model.legend.length < 2) {
			return [];
		}
		return model.legend;
	}

	render() {
		this.html`
			<div class="rc" data-tone=${this.state.tone} role="img" aria-label=${this.state.label || 'Radar chart'}>
				<div class="rc-empty" ?hidden=${this.hideEmpty}>${this.state.emptyLabel}</div>
				^html${this.chartSvg}
				<div class="rc-legend" ?hidden=${() => {
					return this.legendModel().length < 2;
				}}>
					${() => {
						return this.each(this.legendModel(), this.legendRow, this.legendKey);
					}}
				</div>
			</div>
		`;
	}

	legendKey(row) {
		return row.id;
	}
	legendRow(row) {
		return html`<span class="rc-legend-item"><span class="rc-swatch" style=${`background:${row.color}`}></span>${row.label}</span>`;
	}
}

customElements.define('ui-radar-chart', UIRadarChart);
