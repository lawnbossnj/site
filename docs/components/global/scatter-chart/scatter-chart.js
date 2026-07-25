/*
	DESCRIPTION: ui-scatter-chart — X/Y scatter plot (SVG). Geometry via ^html.
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-scatter-chart .state.points=${[
	    { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 4 },
	  ]}></ui-scatter-chart>
	─────────────────────────────────────────────────────────────────────
*/
import { html, WebComponent } from 'webcomponent';
import {
	extentOf,
	formatTick,
	niceTicks,
	scaleLinear,
	seriesColor,
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

export class UIScatterChart extends WebComponent {
	static url = import.meta.url;
	static styles = {
		scatterChart: './scatter-chart.css',
	};
	static state = {
		points: [],
		series: [],
		showGrid: true,
		showLegend: true,
		pointRadius: 4,
		tone: 'accent',
		label: '',
		emptyLabel: 'No data',
	};

	plotModel() {
		const plotLeft = PAD.left;
		const plotRight = VIEW_W - PAD.right;
		const plotTop = PAD.top;
		const plotBottom = VIEW_H - PAD.bottom;
		const seriesIn = Array.isArray(this.state.series) ? this.state.series : [];
		const flat = Array.isArray(this.state.points) ? this.state.points : [];
		const series = [];
		if (seriesIn.length > 0) {
			const seriesCount = seriesIn.length;
			for (let index = 0; index < seriesCount; index += 1) {
				const row = seriesIn[index];
				if (!row || typeof row !== 'object') {
					continue;
				}
				const pts = Array.isArray(row.points) ? row.points : [];
				series.push({
					id: String(row.id ?? row.label ?? index),
					label: String(row.label || row.id || `Series ${index + 1}`),
					color: row.color || seriesColor(index),
					points: pts,
				});
			}
		} else if (flat.length > 0) {
			series.push({
				id: 's0',
				label: '',
				color: seriesColor(0),
				points: flat,
			});
		}
		const xs = [];
		const ys = [];
		const seriesCount = series.length;
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
			const pts = series[seriesIndex].points;
			const pointCount = pts.length;
			for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
				const point = pts[pointIndex];
				const x = Number(point?.x);
				const y = Number(point?.y);
				if (Number.isFinite(x)) {
					xs.push(x);
				}
				if (Number.isFinite(y)) {
					ys.push(y);
				}
			}
		}
		if (xs.length === 0) {
			return {
				empty: true,
				dots: [],
				grid: [],
				legend: [],
			};
		}
		const xExtent = extentOf(xs);
		const yExtent = extentOf(ys);
		const xTicks = niceTicks(xExtent.min, xExtent.max, 5);
		const yTicks = niceTicks(yExtent.min, yExtent.max, 5);
		const xMin = xTicks[0];
		const xMax = xTicks[xTicks.length - 1];
		const yMin = yTicks[0];
		const yMax = yTicks[yTicks.length - 1];
		const dots = [];
		const r = Number(this.state.pointRadius) || 4;
		for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
			const row = series[seriesIndex];
			const pts = row.points;
			const pointCount = pts.length;
			for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
				const point = pts[pointIndex];
				const rawX = Number(point?.x);
				const rawY = Number(point?.y);
				if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
					continue;
				}
				dots.push({
					cx: scaleLinear(rawX, xMin, xMax, plotLeft, plotRight),
					cy: scaleLinear(rawY, yMin, yMax, plotBottom, plotTop),
					r: Number(point?.r) || r,
					color: point?.color || row.color,
					label: String(point?.label || row.label || ''),
					x: rawX,
					y: rawY,
					seriesId: row.id,
				});
			}
		}
		const grid = [];
		const yCount = yTicks.length;
		for (let index = 0; index < yCount; index += 1) {
			const value = yTicks[index];
			const y = scaleLinear(value, yMin, yMax, plotBottom, plotTop);
			grid.push({
				x1: plotLeft,
				y1: y,
				x2: plotRight,
				y2: y,
				labelX: plotLeft - 8,
				labelY: y + 3,
				label: formatTick(value),
				anchor: 'end',
			});
		}
		const xCount = xTicks.length;
		for (let index = 0; index < xCount; index += 1) {
			const value = xTicks[index];
			const x = scaleLinear(value, xMin, xMax, plotLeft, plotRight);
			grid.push({
				x1: x,
				y1: plotTop,
				x2: x,
				y2: plotBottom,
				labelX: x,
				labelY: plotBottom + 14,
				label: formatTick(value),
				anchor: 'middle',
			});
		}
		const legend = [];
		if (series.length > 1) {
			for (let index = 0; index < seriesCount; index += 1) {
				legend.push({
					id: series[index].id,
					label: series[index].label,
					color: series[index].color,
				});
			}
		}
		return {
			empty: dots.length === 0,
			dots,
			grid,
			legend,
		};
	}

	chartSvg() {
		const model = this.plotModel();
		if (model.empty) {
			return '';
		}
		const parts = [
			`<svg class="sc-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" role="presentation">`,
		];
		if (this.state.showGrid) {
			const gridCount = model.grid.length;
			for (let index = 0; index < gridCount; index += 1) {
				const row = model.grid[index];
				parts.push(`<line class="sc-grid" x1="${row.x1}" y1="${row.y1}" x2="${row.x2}" y2="${row.y2}"></line>`);
			}
		}
		const dotCount = model.dots.length;
		for (let index = 0; index < dotCount; index += 1) {
			const row = model.dots[index];
			parts.push(
				`<circle class="sc-dot" style="--sc-series:${escapeSvg(row.color)}" `
				+ `cx="${row.cx}" cy="${row.cy}" r="${row.r}" `
				+ `data-series="${escapeSvg(row.seriesId)}" data-x="${row.x}" data-y="${row.y}" `
				+ `data-label="${escapeSvg(row.label)}"></circle>`,
			);
		}
		const gridCount = model.grid.length;
		for (let index = 0; index < gridCount; index += 1) {
			const row = model.grid[index];
			parts.push(`<text class="sc-tick" x="${row.labelX}" y="${row.labelY}" text-anchor="${row.anchor}">${escapeSvg(row.label)}</text>`);
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

	handleDotClick(domEvent) {
		const node = domEvent?.target;
		if (!node || node.tagName !== 'circle') {
			return;
		}
		this.emit('scatter-chart:select', {
			seriesId: node.getAttribute('data-series') || '',
			x: Number(node.getAttribute('data-x')),
			y: Number(node.getAttribute('data-y')),
			label: node.getAttribute('data-label') || '',
		});
	}

	render() {
		this.html`
			<div class="sc" data-tone=${this.state.tone} role="img" aria-label=${this.state.label || 'Scatter chart'} @click=${this.handleDotClick}>
				<div class="sc-empty" ?hidden=${this.hideEmpty}>${this.state.emptyLabel}</div>
				^html${this.chartSvg}
				<div class="sc-legend" ?hidden=${() => {
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
		return html`<span class="sc-legend-item"><span class="sc-swatch" style=${`background:${row.color}`}></span>${row.label}</span>`;
	}
}

customElements.define('ui-scatter-chart', UIScatterChart);
