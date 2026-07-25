/*
	DESCRIPTION: ui-pie-chart — pie / donut share chart (SVG, zero-dep).
	Geometry via trusted ^html SVG (SVG namespace).
	── STANDARD USAGE ───────────────────────────────────────────────────
	  <ui-pie-chart .state.items=${[
	    { label: 'A', value: 40 }, { label: 'B', value: 25 }, { label: 'C', value: 35 },
	  ]} .state.variant=${'donut'}></ui-pie-chart>
	─────────────────────────────────────────────────────────────────────
*/
import { html, WebComponent } from 'webcomponent';
import {
	donutArcPath,
	formatTick,
	normalizeCategoryItems,
} from '../charts/chartMath.js';
import { escapeSvg } from '../charts/escapeSvg.js';

const VIEW = 200;
const CX = 100;
const CY = 100;
const OUTER = 78;
const INNER_DONUT = 46;

export class UIPieChart extends WebComponent {
	static url = import.meta.url;
	static styles = {
		pieChart: './pie-chart.css',
	};
	static state = {
		items: [],
		variant: 'donut',
		showLegend: true,
		showTotal: true,
		tone: 'accent',
		label: '',
		emptyLabel: 'No data',
	};

	plotModel() {
		const items = normalizeCategoryItems(this.state.items);
		let total = 0;
		const itemCount = items.length;
		for (let index = 0; index < itemCount; index += 1) {
			total += Math.max(0, items[index].value);
		}
		if (total <= 0 || itemCount === 0) {
			return {
				empty: true,
				slices: [],
				total: 0,
				legend: [],
			};
		}
		const inner = this.state.variant === 'donut' ? INNER_DONUT : 0;
		const slices = [];
		let angle = 0;
		for (let index = 0; index < itemCount; index += 1) {
			const item = items[index];
			const value = Math.max(0, item.value);
			const sweep = (value / total) * 360;
			const start = angle;
			const end = angle + sweep;
			const path = itemCount === 1
				? donutArcPath(CX, CY, inner, OUTER, 0, 359.99)
				: donutArcPath(CX, CY, inner, OUTER, start, end);
			slices.push({
				id: item.id,
				label: item.label,
				value,
				pct: Math.round((value / total) * 1000) / 10,
				color: item.color,
				d: path,
			});
			angle = end;
		}
		return {
			empty: false,
			slices,
			total,
			legend: slices,
		};
	}

	chartSvg() {
		const model = this.plotModel();
		if (model.empty) {
			return '';
		}
		const parts = [
			`<svg class="pc-svg" viewBox="0 0 ${VIEW} ${VIEW}" role="presentation">`,
		];
		const sliceCount = model.slices.length;
		for (let index = 0; index < sliceCount; index += 1) {
			const row = model.slices[index];
			parts.push(
				`<path class="pc-slice" style="--pc-series:${escapeSvg(row.color)}" d="${escapeSvg(row.d)}" `
				+ `data-id="${escapeSvg(row.id)}" data-label="${escapeSvg(row.label)}" `
				+ `data-value="${row.value}" data-pct="${row.pct}"></path>`,
			);
		}
		if (this.state.showTotal && this.state.variant === 'donut') {
			parts.push(`<text class="pc-total" x="${CX}" y="${CY + 4}" text-anchor="middle">${escapeSvg(formatTick(model.total))}</text>`);
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
	hideBody() {
		return this.plotModel().empty;
	}

	legendModel() {
		const model = this.plotModel();
		if (model.empty || !this.state.showLegend) {
			return [];
		}
		return model.legend;
	}

	handleSliceClick(domEvent) {
		const path = domEvent?.target;
		if (!path || path.tagName !== 'path') {
			return;
		}
		this.emit('pie-chart:select', {
			id: path.getAttribute('data-id') || '',
			label: path.getAttribute('data-label') || '',
			value: Number(path.getAttribute('data-value')),
			pct: Number(path.getAttribute('data-pct')),
		});
	}

	render() {
		this.html`
			<div class="pc" data-tone=${this.state.tone} data-variant=${this.state.variant} role="img" aria-label=${this.state.label || 'Pie chart'}>
				<div class="pc-empty" ?hidden=${this.hideEmpty}>${this.state.emptyLabel}</div>
				<div class="pc-body" ?hidden=${this.hideBody} @click=${this.handleSliceClick}>
					^html${this.chartSvg}
					<div class="pc-legend" ?hidden=${() => {
						return this.legendModel().length === 0;
					}}>
						${() => {
							return this.each(this.legendModel(), this.legendRow, this.legendKey);
						}}
					</div>
				</div>
			</div>
		`;
	}

	legendKey(row) {
		return row.id;
	}
	legendRow(row) {
		return html`<span class="pc-legend-item">
			<span class="pc-swatch" style=${`background:${row.color}`}></span>
			<span class="pc-legend-label">${row.label}</span>
			<span class="pc-legend-value">${row.pct}%</span>
		</span>`;
	}
}

customElements.define('ui-pie-chart', UIPieChart);
