/*
 * Entry — boot splash FIRST (logo + welcome), then load the app under it.
 */
import { BootScreen } from './components/global/boot-screen/boot-screen.js';
import { BootPipeline } from './modules/boot-pipeline.js';

console.log('Lawn Boss NJ — client booting');

const LOGO_MARKUP = `
<img
	class="bs-logo"
	src="/images/logo.png"
	alt=""
	width="280"
	height="280"
	decoding="async"
/>
`.trim();

async function mountBootScreen() {
	const bootScreen = new BootScreen({
		heading: 'WELCOME TO LAWN BOSS NJ',
		subheading: 'LANDSCAPE · HARDSCAPE · OUTDOOR LIVING',
		logo: LOGO_MARKUP,
		barState: {
			indeterminate: true,
			label: 'LOADING',
		},
	});
	document.body.appendChild(bootScreen);
	return bootScreen;
}

/**
 * Dynamic-import the app tree only after the splash is mounted.
 * @param {import('./modules/boot-pipeline.js').BootPipeline} pipeline
 */
async function loadApp(pipeline) {
	pipeline.bootScreen?.setStatus('LOADING ENVIRONMENT');
	const [
		_env,
		_pluginsBootstrap,
		_roots,
		pluginsRegistry,
		appModule,
	] = await Promise.all([
		import('./modules/environment.js'),
		import('./modules/plugins-bootstrap.js'),
		import('./modules/registerRoots.js'),
		import('./components/core/plugins/registry.js'),
		import('./modules/app.js'),
	]);
	pipeline.mark('modules-loaded');
	pipeline.bootScreen?.setStatus('STARTING');
	await pluginsRegistry.runPlugins();
	pipeline.mark('plugins-ran');
	pipeline.bootScreen?.setStatus('RENDERING');
	const AppView = appModule.default;
	const app = await AppView.create(undefined, undefined, {
		mount: document.body,
		fade: false,
	});
	pipeline.app = app;
	globalThis.app = app;
	pipeline.mark('app-ready');
	pipeline.mark('app-appended');
	return app;
}

async function initialize() {
	const pipeline = new BootPipeline({
		mountBoot: mountBootScreen,
		loadApp,
	});
	globalThis.boot = pipeline;
	return pipeline.run();
}

async function onReady() {
	if (document.readyState === 'loading') {
		await new Promise((accept) => {
			document.addEventListener('DOMContentLoaded', accept, {
				once: true,
			});
		});
	}
	await initialize();
}

await onReady();
