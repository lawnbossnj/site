/*
	DESCRIPTION: ui-bar-chart — vertical/horizontal categorical bar chart (SVG).
	Geometry via trusted ^html SVG (SVG namespace). Distinct from ui-bar-list.
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-bar-chart .state.items=${[
	    { label: 'Mon', value: 12 }, { label: 'Tue', value: 18 },
	  ]}></ui-bar-chart>
	─────────────────────────────────────────────────────────────────────
*/
import { html, WebComponent } from 'webcomponent';
import {
	extentOf,
	formatTick,
	niceTicks,
	normalizeCategoryItems,
	normalizeValueSeries,
	scaleLinear,
	seriesColor,
} from '../charts/chartMath.js';
import { escapeSvg } from '../charts/escapeSvg.js';

const VIEW_W = 400;
const VIEW_H = 220;
const PAD = {
	top: 16,
	right: 16,
	bottom: 40,
	left: 44,
};

export class UIBarChart extends WebComponent {
	static url = import.meta.url;
	static styles = {
		barChart: './bar-chart.css',
	};
	static state = {
		items: [],
		series: [],
		categories: [],
		orientation: 'vertical',
		stacked: false,
		showGrid: true,
		showLegend: true,
		tone: 'accent',
		label: '',
		emptyLabel: 'No data',
	};

	plotModel() {
		const plotLeft = PAD.left;
		const plotRight = VIEW_W - PAD.right;
		const plotTop = PAD.top;
		const plotBottom = VIEW_H - PAD.bottom;
		const plotW = plotRight - plotLeft;
		const plotH = plotBottom - plotTop;
		const multi = normalizeValueSeries(this.state.series);
		const useMulti = multi.length > 0 && multi[0].values.length > 0;
		const categories = Array.isArray(this.state.categories) ? this.state.categories.slice() : [];
		const groups = [];
		let seriesMeta = [];
		if (useMulti) {
			seriesMeta = multi;
			let maxLen = 0;
			const seriesCount = multi.length;
			for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
				if (multi[seriesIndex].values.length > maxLen) {
					maxLen = multi[seriesIndex].values.length;
				}
			}
			for (let groupIndex = 0; groupIndex < maxLen; groupIndex += 1) {
				const values = [];
				for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
					values.push(multi[seriesIndex].values[groupIndex] ?? 0);
				}
				groups.push({
					id: `g-${groupIndex}`,
					label: categories[groupIndex] != null ? String(categories[groupIndex]) : String(groupIndex + 1),
					values,
				});
			}
		} else {
			const items = normalizeCategoryItems(this.state.items);
			seriesMeta = [
				{
					id: 's0',
					label: '',
					color: seriesColor(0),
				},
			];
			const itemCount = items.length;
			for (let index = 0; index < itemCount; index += 1) {
				groups.push({
					id: items[index].id,
					label: items[index].label,
					values: [
						items[index].value,
					],
					colors: [
						items[index].color,
					],
				});
			}
		}
		const groupCount = groups.length;
		if (groupCount === 0) {
			return {
				empty: true,
				bars: [],
				grid: [],
				labels: [],
				legend: [],
				horizontal: this.state.orientation === 'horizontal',
			};
		}
		const stacked = Boolean(this.state.stacked) && seriesMeta.length > 1;
		const allValues = [];
		for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
			const values = groups[groupIndex].values;
			let sum = 0;
			const valueCount = values.length;
			for (let valueIndex = 0; valueIndex < valueCount; valueIndex += 1) {
				sum += values[valueIndex];
				if (!stacked) {
					allValues.push(values[valueIndex]);
				}
			}
			if (stacked) {
				allValues.push(sum);
			}
		}
		const extent = extentOf(allValues.concat([
			0,
		]));
		const yTicks = niceTicks(Math.min(0, extent.min), extent.max, 5);
		const domainMin = yTicks[0];
		const domainMax = yTicks[yTicks.length - 1];
		const horizontal = this.state.orientation === 'horizontal';
		const seriesCount = seriesMeta.length;
		const groupGap = 0.2;
		const bars = [];
		for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
			const group = groups[groupIndex];
			if (stacked) {
				let stack = 0;
				for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
					const value = group.values[seriesIndex] ?? 0;
					const color = group.colors?.[seriesIndex] || seriesMeta[seriesIndex].color;
					if (horizontal) {
						const y = scaleLinear(groupIndex + groupGap / 2, 0, groupCount, plotTop, plotBottom);
						const h = (plotH / groupCount) * (1 - groupGap);
						const x0 = scaleLinear(stack, domainMin, domainMax, plotLeft, plotRight);
						const x1 = scaleLinear(stack + value, domainMin, domainMax, plotLeft, plotRight);
						bars.push({
							x: Math.min(x0, x1),
							y,
							width: Math.abs(x1 - x0),
							height: h,
							color,
						});
					} else {
						const x = scaleLinear(groupIndex + groupGap / 2, 0, groupCount, plotLeft, plotRight);
						const w = (plotW / groupCount) * (1 - groupGap);
						const y0 = scaleLinear(stack, domainMin, domainMax, plotBottom, plotTop);
						const y1 = scaleLinear(stack + value, domainMin, domainMax, plotBottom, plotTop);
						bars.push({
							x,
							y: Math.min(y0, y1),
							width: w,
							height: Math.abs(y1 - y0),
							color,
						});
					}
					stack += value;
				}
			} else {
				for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex += 1) {
					const value = group.values[seriesIndex] ?? 0;
					const color = group.colors?.[seriesIndex] || seriesMeta[seriesIndex].color;
					if (horizontal) {
						const slot = plotH / groupCount;
						const barH = (slot * (1 - groupGap)) / seriesCount;
						const y = plotTop + (groupIndex * slot) + (slot * groupGap / 2) + (seriesIndex * barH);
						const x0 = scaleLinear(0, domainMin, domainMax, plotLeft, plotRight);
						const x1 = scaleLinear(value, domainMin, domainMax, plotLeft, plotRight);
						bars.push({
							x: Math.min(x0, x1),
							y,
							width: Math.max(0, Math.abs(x1 - x0)),
							height: Math.max(1, barH * 0.9),
							color,
						});
					} else {
						const slot = plotW / groupCount;
						const barW = (slot * (1 - groupGap)) / seriesCount;
						const x = plotLeft + (groupIndex * slot) + (slot * groupGap / 2) + (seriesIndex * barW);
						const y0 = scaleLinear(0, domainMin, domainMax, plotBottom, plotTop);
						const y1 = scaleLinear(value, domainMin, domainMax, plotBottom, plotTop);
						bars.push({
							x,
							y: Math.min(y0, y1),
							width: Math.max(1, barW * 0.9),
							height: Math.max(0, Math.abs(y1 - y0)),
							color,
						});
					}
				}
			}
		}
		const grid = [];
		const tickCount = yTicks.length;
		for (let index = 0; index < tickCount; index += 1) {
			const value = yTicks[index];
			if (horizontal) {
				const x = scaleLinear(value, domainMin, domainMax, plotLeft, plotRight);
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
			} else {
				const y = scaleLinear(value, domainMin, domainMax, plotBottom, plotTop);
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
		}
		const labels = [];
		for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
			if (horizontal) {
				const y = scaleLinear(groupIndex + 0.5, 0, groupCount, plotTop, plotBottom);
				labels.push({
					x: plotLeft - 8,
					y: y + 3,
					label: groups[groupIndex].label,
					anchor: 'end',
				});
			} else {
				const x = scaleLinear(groupIndex + 0.5, 0, groupCount, plotLeft, plotRight);
				labels.push({
					x,
					y: plotBottom + 16,
					label: groups[groupIndex].label,
					anchor: 'middle',
				});
			}
		}
		const legend = [];
		if (seriesMeta.length > 1 || (seriesMeta[0] && seriesMeta[0].label)) {
			const legendCount = seriesMeta.length;
			for (let index = 0; index < legendCount; index += 1) {
				legend.push({
					id: seriesMeta[index].id,
					label: seriesMeta[index].label || seriesMeta[index].id,
					color: seriesMeta[index].color,
				});
			}
		}
		return {
			empty: false,
			bars,
			grid,
			labels,
			legend,
			horizontal,
		};
	}

	chartSvg() {
		const model = this.plotModel();
		if (model.empty) {
			return '';
		}
		const parts = [
			`<svg class="bc-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" role="presentation">`,
		];
		if (this.state.showGrid) {
			const gridCount = model.grid.length;
			for (let index = 0; index < gridCount; index += 1) {
				const row = model.grid[index];
				parts.push(`<line class="bc-grid" x1="${row.x1}" y1="${row.y1}" x2="${row.x2}" y2="${row.y2}"></line>`);
			}
		}
		const barCount = model.bars.length;
		for (let index = 0; index < barCount; index += 1) {
			const row = model.bars[index];
			parts.push(`<rect class="bc-bar" style="--bc-series:${escapeSvg(row.color)}" x="${row.x}" y="${row.y}" width="${row.width}" height="${row.height}" rx="2"></rect>`);
		}
		const labelCount = model.labels.length;
		for (let index = 0; index < labelCount; index += 1) {
			const row = model.labels[index];
			parts.push(`<text class="bc-tick" x="${row.x}" y="${row.y}" text-anchor="${row.anchor}">${escapeSvg(row.label)}</text>`);
		}
		if (this.state.showGrid) {
			const gridCount = model.grid.length;
			for (let index = 0; index < gridCount; index += 1) {
				const row = model.grid[index];
				parts.push(`<text class="bc-tick" x="${row.labelX}" y="${row.labelY}" text-anchor="${row.anchor}">${escapeSvg(row.label)}</text>`);
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
			<div class="bc" data-tone=${this.state.tone} data-orientation=${this.state.orientation} role="img" aria-label=${this.state.label || 'Bar chart'}>
				<div class="bc-empty" ?hidden=${this.hideEmpty}>${this.state.emptyLabel}</div>
				^html${this.chartSvg}
				<div class="bc-legend" ?hidden=${() => {
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
		return html`<span class="bc-legend-item"><span class="bc-swatch" style=${`background:${row.color}`}></span>${row.label}</span>`;
	}
}

customElements.define('ui-bar-chart', UIBarChart);
