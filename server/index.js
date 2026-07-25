/*
 * Lawn Boss NJ — static site server.
 * Serves repo-root `docs/` (GitHub Pages layout) and falls back to index.html.
 * No API, auth, or database.
 */
import express from 'express';
import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';

const PORT = process.env.PORT || 5180;
const __filenameLocal = fileURLToPath(import.meta.url);
const baseDir = path.dirname(__filenameLocal);
// Site root lives at ../docs (alongside this server/ folder)
const siteDir = path.join(baseDir, '../docs');
const indexHtml = path.join(siteDir, 'index.html');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

function securityHeadersMiddleware(req, res, next) {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'SAMEORIGIN');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
	// CORP only — no COEP/COOP (those were for JSPerf memory isolation and
	// block common third-party embeds on a marketing site).
	res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
	const originalSetHeader = res.setHeader.bind(res);
	res.setHeader = function setHeader(headerName, value) {
		const blocked = new Set([
			'server',
			'x-powered-by',
			'x-express-version',
			'x-node-version',
		]);
		if (blocked.has(String(headerName).toLowerCase())) {
			return res;
		}
		return originalSetHeader(headerName, value);
	};
	next();
}

app.use(securityHeadersMiddleware);

// Static assets from docs/
app.use(express.static(siteDir, {
	fallthrough: true,
	index: false,
}));

// SPA fallback — extensionless GET paths serve index.html
app.use((req, res, next) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		return next();
	}
	if (req.path === '/api' || req.path.startsWith('/api/')) {
		return res.status(404).end();
	}
	if (path.extname(req.path)) {
		return next();
	}
	return res.sendFile(indexHtml);
});

// Missing files / unsupported methods
app.use((req, res) => {
	if (req.method === 'GET' || req.method === 'HEAD') {
		res.status(404).end();
		return;
	}
	res.status(404).json({
		error: 'Not found',
	});
});

function logLanAddresses() {
	const interfaces = os.networkInterfaces();
	const ifaceNames = Object.keys(interfaces);
	const lanAddresses = [];
	const nameCount = ifaceNames.length;
	for (let nameIndex = 0; nameIndex < nameCount; nameIndex += 1) {
		const list = interfaces[ifaceNames[nameIndex]] || [];
		const entryCount = list.length;
		for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
			const entry = list[entryIndex];
			if (entry.family === 'IPv4' && !entry.internal) {
				lanAddresses.push(entry.address);
			}
		}
	}
	const lanCount = lanAddresses.length;
	for (let index = 0; index < lanCount; index += 1) {
		console.log(`LAN access:  http://${lanAddresses[index]}:${PORT}/`);
	}
}

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Lawn Boss static server on port ${PORT}`);
	console.log(`Site root: ${siteDir}`);
	console.log(`Local:  http://localhost:${PORT}/`);
	logLanAddresses();
});

export default app;
