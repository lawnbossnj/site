/*
	DESCRIPTION: ui-line-chart — multi-series cartesian line/area chart (SVG,
	zero-dep). Geometry is emitted as ONE trusted SVG string (^html) so children
	land in the SVG namespace (each()/light-rows create HTML-namespace unknowns).
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-line-chart
	    .state.series=${[{ label: 'TPS', values: [3, 5, 4, 8, 7, 11] }]}
	    .state.categories=${['Mon','Tue','Wed','Thu','Fri','Sat']}
	    .state.variant=${'line'}></ui-line-chart>
	─────────────────────────────────────────────────────────────────────
*/
import { html, WebComponent } from 'webcomponent';
import {
	areaPath,
	extentOf,
	formatTick,
	niceTicks,
	normalizeValueSeries,
	polylinePoints,
	scaleLinear,
} from '../charts/chartMath.js';
import { escapeSvg } from '../charts/escapeSvg.js';

const VIEW_W = 400;
const VIEW_H = 220;
const PAD = {
	top: 16,
	right: 16,
	bottom: 36,
	left: 44,
};

export class UILineChart extends WebComponent {
	static url = import.meta.url;
	static styles = {
		lineChart: './line-chart.css',
	};
	static state = {
		series: [],
		categories: [],
		variant: 'line',
		showGrid: true,
		showLegend: true,
		yMin: null,
		yMax: null,
		tone: 'accent',
		label: '',
		emptyLabel: 'No data',
	};

	plotModel() {
		const series = normalizeValueSeries(this.state.series);
		const plotLeft = PAD.left;
		const plotRight = VIEW_W - PAD.right;
		const plotTop = PAD.top;
		const plotBottom = VIEW_H - PAD.bottom;
		const plotW = plotRight - plotLeft;
		let yMin = this.state.yMin;
		let yMax = this.state.yMax;
		if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
			const all = [];
			const seriesCount = series.length;
			for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
				const values = series[seriesIndex].values;
				const valueCount = values.length;
				for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
					all.push(values[valueIndex]);
				}
			}
			const extent = extentOf(all);
			yMin = Number.isFinite(this.state.yMin) ? this.state.yMin : extent.min;
			yMax = Number.isFinite(this.state.yMax) ? this.state.yMax : extent.max;
			if (this.state.variant === 'area' && yMin > 0) {
				yMin = 0;
			}
		}
		const yTicks = niceTicks(yMin, yMax, 5);
		const domainMin = yTicks[0];
		const domainMax = yTicks[yTicks.length - 1];
		const categories = Array.isArray(this.state.categories) ? this.state.categories : [];
		let maxLen = 0;
		const seriesCount = series.length;
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
			if (series[seriesIndex].values.length > maxLen) {
				maxLen = series[seriesIndex].values.length;
			}
		}
		const paths = [];
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
			const row = series[seriesIndex];
			const points = [];
			const valueCount = row.values.length;
			for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
				const x = valueCount > 1
					? scaleLinear(valueIndex, 0, valueCount - 1, plotLeft, plotRight)
					: plotLeft + (plotW / 2);
				const y = scaleLinear(row.values[valueIndex], domainMin, domainMax, plotBottom, plotTop);
				points.push({
					x,
					y,
				});
			}
			paths.push({
				id: row.id,
				label: row.label,
				color: row.color,
				pointsAttr: polylinePoints(points),
				areaD: areaPath(points, plotBottom),
			});
		}
		const grid = [];
		const tickCount = yTicks.length;
		for (let index = 0; index < tickCount; index += 1) {
			const value = yTicks[index];
			const y = scaleLinear(value, domainMin, domainMax, plotBottom, plotTop);
			grid.push({
				y,
				label: formatTick(value),
			});
		}
		const xLabels = [];
		const labelCount = Math.max(maxLen, categories.length);
		const step = labelCount > 8 ? Math.ceil(labelCount / 6) : 1;
		for (let index = 0; index < labelCount; index += step) {
			const x = labelCount > 1
				? scaleLinear(index, 0, labelCount - 1, plotLeft, plotRight)
				: plotLeft + (plotW / 2);
			xLabels.push({
				x,
				label: categories[index] != null ? String(categories[index]) : String(index + 1),
			});
		}
		return {
			series: paths,
			grid,
			xLabels,
			empty: maxLen === 0,
			isArea: this.state.variant === 'area',
		};
	}

	/** Full <svg>…</svg> string — must be a single root so children parse as SVG. */
	chartSvg() {
		const model = this.plotModel();
		if (model.empty) {
			return '';
		}
		const parts = [
			`<svg class="lc-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" role="presentation">`,
		];
		if (this.state.showGrid) {
			const gridCount = model.grid.length;
			for (let index = 0; index < gridCount; index += 1) {
				const row = model.grid[index];
				parts.push(`<line class="lc-grid" x1="${PAD.left}" x2="${VIEW_W - PAD.right}" y1="${row.y}" y2="${row.y}"></line>`);
			}
		}
		const seriesCount = model.series.length;
		for (let index = 0; index < seriesCount; index += 1) {
			const row = model.series[index];
			const color = escapeSvg(row.color);
			if (model.isArea) {
				parts.push(`<path class="lc-area" style="--lc-series:${color}" d="${escapeSvg(row.areaD)}"></path>`);
			}
			parts.push(`<polyline class="lc-line" style="--lc-series:${color}" fill="none" points="${escapeSvg(row.pointsAttr)}"></polyline>`);
		}
		const xCount = model.xLabels.length;
		for (let index = 0; index < xCount; index += 1) {
			const row = model.xLabels[index];
			parts.push(`<text class="lc-tick lc-tick-x" x="${row.x}" y="${VIEW_H - 10}" text-anchor="middle">${escapeSvg(row.label)}</text>`);
		}
		const yCount = model.grid.length;
		for (let index = 0; index < yCount; index += 1) {
			const row = model.grid[index];
			parts.push(`<text class="lc-tick lc-tick-y" x="${PAD.left - 8}" y="${row.y + 3}" text-anchor="end">${escapeSvg(row.label)}</text>`);
		}
		parts.push('</svg>');
		return parts.join('');
	}

	legendModel() {
		const model = this.plotModel();
		if (model.empty || !this.state.showLegend || model.series.length < 2) {
			return [];
		}
		return model.series;
	}

	isEmpty() {
		return this.plotModel().empty;
	}
	/** Final boolean for ?hidden — never `!this.method` in a template. */
	hideEmpty() {
		return !this.plotModel().empty;
	}

	render() {
		this.html`
			<div class="lc" data-tone=${this.state.tone} role="img" aria-label=${this.state.label || 'Line chart'}>
				<div class="lc-empty" ?hidden=${this.hideEmpty}>${this.state.emptyLabel}</div>
				^html${this.chartSvg}
				<div class="lc-legend" ?hidden=${() => {
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
		return html`<span class="lc-legend-item"><span class="lc-swatch" style=${`background:${row.color}`}></span>${row.label}</span>`;
	}
}

customElements.define('ui-line-chart', UILineChart);
