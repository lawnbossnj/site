/*
 * Lawn Boss NJ — marketing SPA shell.
 * Single home route; no dock / auth / API chrome.
 */
import '../components/user/home-page/home-page.js';
import '../components/global/icon/icon.js';
import '../components/core/tooltips/tooltip.js';
import { AppShell } from '../components/global/app-shell/app-shell.js';
import { WebComponent } from 'webcomponent';

const APP_ROUTES = [
	{
		id: 'home',
		path: '/',
		section: 'home',
		view: 'home',
	},
];

class AppView extends AppShell {
	static url = import.meta.url;
	static styles = {
		app: './app.css',
	};
	static routes = APP_ROUTES;
	static routerConfig = {
		fallback: 'home',
	};
	id = 'app';

	/**
	 * Construct + pre-render under `mount` (default document.body).
	 * Under the boot splash pass `{ fade: false }` so the splash owns reveal.
	 * @param {object} [state]
	 * @param {object} [config]
	 * @param {{ mount?: HTMLElement|Function, fade?: boolean, duration?: number }} [options]
	 */
	static async create(state, config, options = {}) {
		const app = new this(await state, config);
		const mount = options.mount ?? document.body;
		await WebComponent.preRender(app, mount, {
			fade: options.fade ?? false,
			duration: options.duration,
		});
		return app;
	}

	render() {
		this.html`
			<div class="shell-scroll" #shellscroll>
				<home-page></home-page>
			</div>
		`;
	}
}
customElements.define('app-view', AppView);
export default AppView;
