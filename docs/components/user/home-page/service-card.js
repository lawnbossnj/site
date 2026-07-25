import { WebComponent } from 'webcomponent';
import '../../global/card/card.js';
import '../../global/icon/icon.js';

/**
 * Service list row — `ui-card` with media + Lucide icon + copy.
 */
export class ServiceCard extends WebComponent {
	static url = import.meta.url;
	static styles = {
		serviceCard: './service-card.css',
	};
	static state = {
		id: '',
		label: '',
		description: '',
		icon: 'leaf',
		image: '',
		surfaceState: {
			tone: 'panel',
			padding: 'none',
			radius: 'lg',
			border: true,
			elevation: '1',
		},
	};

	render() {
		this.html`
			<ui-card
				class="service-ui-card"
				.state.heading=${this.state.label}
				.state.interactive=${true}
				.state.surfaceState=${this.state.surfaceState}
			>
				<img
					slot="media"
					src=${this.state.image}
					alt=${this.state.label}
					loading="lazy"
					decoding="async"
				/>
				<div class="service-body">
					<div class="service-icon" aria-hidden="true">
						<ui-icon .state.name=${this.state.icon} .state.size=${'md'}></ui-icon>
					</div>
					<p class="service-desc">${this.state.description}</p>
				</div>
			</ui-card>
		`;
	}
}
customElements.define('service-card', ServiceCard);
