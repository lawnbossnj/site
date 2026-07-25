import { WebComponent } from 'webcomponent';
import '../../global/chip/chip.js';

/**
 * List row that paints a single `<ui-chip>` from item state (label / tone).
 */
export class AreaChipRow extends WebComponent {
	static url = import.meta.url;
	static styles = {
		areaChipRow: './area-chip-row.css',
	};
	static state = {
		id: '',
		label: '',
		tone: 'success',
	};

	render() {
		this.html`
			<ui-chip
				.state.label=${this.state.label}
				.state.value=${this.state.id || this.state.label}
				.state.tone=${this.state.tone || 'success'}
				.state.size=${'md'}
			></ui-chip>
		`;
	}
}
customElements.define('area-chip-row', AreaChipRow);
