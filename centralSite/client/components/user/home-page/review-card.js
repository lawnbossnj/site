import { WebComponent } from 'webcomponent';
import '../../global/card/card.js';

/**
 * Review list row — `ui-card` with author heading + quote body.
 */
export class ReviewCard extends WebComponent {
	static url = import.meta.url;
	static styles = {
		reviewCard: './review-card.css',
	};
	static state = {
		id: '',
		author: '',
		quote: '',
		rating: 5,
		surfaceState: {
			tone: 'panel',
			padding: 'none',
			radius: 'lg',
			border: true,
			elevation: '1',
		},
	};

	renderStars() {
		const starCount = Math.max(1, Math.min(5, Number(this.state.rating) || 5));
		let markup = '';
		for (let index = 0; index < starCount; index += 1) {
			markup += '★';
		}
		return markup;
	}

	render() {
		this.html`
			<ui-card
				class="review-ui-card"
				.state.heading=${this.state.author}
				.state.surfaceState=${this.state.surfaceState}
			>
				<div class="review-stars" aria-label=${`${this.state.rating} out of 5 stars`}>
					${this.renderStars}
				</div>
				<p class="review-quote">“${this.state.quote}”</p>
			</ui-card>
		`;
	}
}
customElements.define('review-card', ReviewCard);
