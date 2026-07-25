import { WebComponent } from 'webcomponent';
import '../../global/card/card.js';

/**
 * Project list row — `ui-card` media + heading/subheading.
 */
export class ProjectCard extends WebComponent {
	static url = import.meta.url;
	static styles = {
		projectCard: './project-card.css',
	};
	static state = {
		id: '',
		label: '',
		description: '',
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
				class="project-ui-card"
				.state.heading=${this.state.label}
				.state.subheading=${this.state.description}
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
			</ui-card>
		`;
	}
}
customElements.define('project-card', ProjectCard);
