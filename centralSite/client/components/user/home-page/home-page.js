import { classList, html, WebComponent } from 'webcomponent';
import '../../global/icon/icon.js';
import '../../global/icon-button/icon-button.js';
import '../../global/button/button.js';
import '../../global/chip/chip.js';
import '../../global/card/card.js';
import '../../global/surface/surface.js';
import { ServiceCard } from './service-card.js';
import { ProjectCard } from './project-card.js';
import { ReviewCard } from './review-card.js';
import { AreaChipRow } from './area-chip-row.js';

const PHONE_DISPLAY = '(908) 415-1635';
const PHONE_HREF = 'tel:+19084151635';
const EMAIL = 'sales@lawnbossnj.com';
const HERO_VIDEO = '/lawn-boss-nj-hero-section-video.mp4';
const HERO_POSTER = '/images/hero-lawn.jpg';
const LOGO_SRC = '/images/logo.png';
const NJ_MAP_SRC = '/images/new-jersey-map.png';
const GOOGLE_BUSINESS_URL = 'https://maps.app.goo.gl/8Ydj85xHCQga5TR17';
/* Resolved from the short link — Lawn Boss LLC @ 40.073132, -74.724323 */
const FOOTER_YEAR = new Date().getFullYear();
const CALL_LABEL = `Call ${PHONE_DISPLAY}`;
const CALL_BUTTON_LABEL = 'GIVE US A CALL';

function townItem(label, county) {
	return {
		id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
		label,
		tone: 'success',
		county,
	};
}

export class HomePage extends WebComponent {
	static url = import.meta.url;
	static styles = {
		homePage: './home-page.css',
	};
	static state = {
		navOpen: false,
		navScrolled: false,
		menuIcon: 'menu',
		menuTooltip: 'Open menu',
		/* ui-button state bags (framework components) */
		heroCallBtn: {
			label: CALL_BUTTON_LABEL,
			leadicon: 'phone',
			tone: 'success',
			variant: 'solid',
			size: 'lg',
			tooltip: CALL_LABEL,
		},
		heroServicesBtn: {
			label: 'OUR SERVICES',
			tone: 'neutral',
			variant: 'outline',
			size: 'lg',
		},
		googleBtn: {
			label: 'OPEN GOOGLE BUSINESS',
			leadicon: 'map-pin',
			tone: 'success',
			variant: 'solid',
			size: 'md',
		},
		contactCallBtn: {
			label: CALL_BUTTON_LABEL,
			leadicon: 'phone',
			tone: 'success',
			variant: 'solid',
			size: 'lg',
			tooltip: CALL_LABEL,
		},
		navItems: [
			{ id: 'services', label: 'Services', href: '#services' },
			{ id: 'about', label: 'About', href: '#about' },
			{ id: 'projects', label: 'Projects', href: '#projects' },
			{ id: 'area', label: 'Service Area', href: '#area' },
			{ id: 'find_us', label: 'Find Us', href: '#find-us' },
			{ id: 'reviews', label: 'Reviews', href: '#reviews' },
			{ id: 'contact', label: 'Contact', href: '#contact' },
		],
		services: [
			{
				id: 'hardscape',
				label: 'Patios & Hardscape',
				icon: 'brick-wall',
				image: '/images/service-hardscape.jpg',
				description:
					'Custom paver patios, outdoor living spaces, and fire features built for New Jersey weather.',
			},
			{
				id: 'sod',
				label: 'Sod & Lawn Renovation',
				icon: 'sprout',
				image: '/images/service-sod.jpg',
				description:
					'Full lawn renovation with seed or sod matched to sun, soil, and how you use your yard.',
			},
			{
				id: 'walkways',
				label: 'Walkways & Curb Appeal',
				icon: 'footprints',
				image: '/images/service-walkway.jpg',
				description:
					'Interlocking walkways, plantings, and lighting that make every arrival feel premium.',
			},
			{
				id: 'retaining',
				label: 'Retaining Walls',
				icon: 'mountain',
				image: '/images/project-retaining.jpg',
				description:
					'Structural walls and rock gardens that stop erosion and create usable outdoor levels.',
			},
			{
				id: 'lighting',
				label: 'Landscape Lighting',
				icon: 'lamp',
				image: '/images/project-lighting.jpg',
				description:
					'Path, accent, and safety lighting that showcases plantings after dark.',
			},
		],
		projects: [
			{
				id: 'p1',
				label: 'Backyard Patio Living',
				description: 'Paver patio, fire feature, and seating walls for everyday entertaining.',
				image: '/images/service-hardscape.jpg',
			},
			{
				id: 'p2',
				label: 'Front Walk Refresh',
				description: 'New walkway, beds, and curb appeal lighting for a welcoming entry.',
				image: '/images/service-walkway.jpg',
			},
			{
				id: 'p3',
				label: 'Full Sod Install',
				description: 'Stripped tired turf and installed premium sod for an instant lawn.',
				image: '/images/service-sod.jpg',
			},
			{
				id: 'p4',
				label: 'Evening Landscape Light',
				description: 'Warm path lights and tree uplighting for night curb appeal.',
				image: '/images/project-lighting.jpg',
			},
			{
				id: 'p5',
				label: 'Slope & Retaining Wall',
				description: 'Stone wall and plantings that tamed a steep grade.',
				image: '/images/project-retaining.jpg',
			},
		],
		reviews: [
			{
				id: 'r1',
				author: 'Chris W.',
				rating: 5,
				quote:
					'Professional, knowledgeable, and on schedule. They listened to what we wanted and kept the job clean from start to finish.',
			},
			{
				id: 'r2',
				author: 'Monmouth County Homeowner',
				rating: 5,
				quote:
					'Our patio and walkway completely changed how we use the backyard. Craftsmanship you can see in every cut and joint.',
			},
			{
				id: 'r3',
				author: 'Ocean County Client',
				rating: 5,
				quote:
					'From consultation to final walkthrough, the crew was reliable and respectful. The lawn has never looked better.',
			},
		],
		counties: [
			{ id: 'middlesex', label: 'Middlesex County', tone: 'info' },
			{ id: 'monmouth', label: 'Monmouth County', tone: 'info' },
			{ id: 'ocean', label: 'Ocean County', tone: 'info' },
		],
		/* Towns across Middlesex · Monmouth · Ocean */
		towns: [
			townItem('East Brunswick', 'middlesex'),
			townItem('Edison', 'middlesex'),
			townItem('Old Bridge', 'middlesex'),
			townItem('Monroe Township', 'middlesex'),
			townItem('South Brunswick', 'middlesex'),
			townItem('Woodbridge', 'middlesex'),
			townItem('Sayreville', 'middlesex'),
			townItem('Metuchen', 'middlesex'),
			townItem('Freehold', 'monmouth'),
			townItem('Marlboro', 'monmouth'),
			townItem('Manalapan', 'monmouth'),
			townItem('Holmdel', 'monmouth'),
			townItem('Middletown', 'monmouth'),
			townItem('Red Bank', 'monmouth'),
			townItem('Colts Neck', 'monmouth'),
			townItem('Howell', 'monmouth'),
			townItem('Wall Township', 'monmouth'),
			townItem('Toms River', 'ocean'),
			townItem('Brick', 'ocean'),
			townItem('Jackson', 'ocean'),
			townItem('Lakewood', 'ocean'),
			townItem('Manchester', 'ocean'),
			townItem('Point Pleasant', 'ocean'),
			townItem('Berkeley Township', 'ocean'),
		],
		mapSurface: {
			tone: 'panel',
			padding: 'sm',
			radius: 'lg',
			elevation: '2',
			border: true,
		},
		googleCard: {
			heading: 'Lawn Boss on Google',
			subheading: 'Reviews, hours, and directions',
			surfaceState: {
				tone: 'panel',
				padding: 'none',
				radius: 'lg',
				border: true,
				elevation: '2',
			},
		},
	};

	onConnect() {
		this.scrollFrameTick = () => {
			this.onScrollFrame();
		};
		this.scrollListener = () => {
			this.handleScrollerScroll();
		};
		this.scrollAbort = new AbortController();
		// Parent is app-view's .shell-scroll (body does not scroll).
		this.scroller = this.parentElement;
		this.scroller?.addEventListener('scroll', this.scrollListener, {
			passive: true,
			signal: this.scrollAbort.signal,
		});
		this.onScrollFrame();
	}

	onDisconnect() {
		this.scrollAbort?.abort();
		this.scrollAbort = null;
		this.scroller = null;
		if (this.scrollRaf) {
			globalThis.cancelAnimationFrame(this.scrollRaf);
			this.scrollRaf = 0;
		}
	}

	handleScrollerScroll() {
		if (this.scrollRaf) {
			return;
		}
		this.scrollRaf = globalThis.requestAnimationFrame(this.scrollFrameTick);
	}

	onScrollFrame() {
		this.scrollRaf = 0;
		const top = this.scroller?.scrollTop ?? 0;
		/* Expand floating glass pill into full bar after a short scroll */
		const scrolled = top > 40;
		if (this.state.navScrolled !== scrolled) {
			this.state.navScrolled = scrolled;
		}
	}

	handleNavToggle() {
		const nextOpen = !this.state.navOpen;
		this.assignState({
			navOpen: nextOpen,
			menuIcon: nextOpen ? 'x' : 'menu',
			menuTooltip: nextOpen ? 'Close menu' : 'Open menu',
		});
	}

	closeNavMenu() {
		if (!this.state.navOpen) {
			return;
		}
		this.assignState({
			navOpen: false,
			menuIcon: 'menu',
			menuTooltip: 'Open menu',
		});
	}

	/**
	 * Hash hrefs do not scroll shadow content inside `.shell-scroll`.
	 * Resolve `data-section` → #ref and scroll the shell scroller.
	 */
	handleNavAreaClick(domEvent) {
		const path = typeof domEvent.composedPath === 'function'
			? domEvent.composedPath()
			: [];
		let link = null;
		const pathCount = path.length;
		for (let index = 0; index < pathCount; index += 1) {
			const node = path[index];
			if (node?.classList?.contains?.('site-nav-link')
				|| node?.classList?.contains?.('site-brand')) {
				link = node;
				break;
			}
		}
		if (!link && domEvent.target?.closest) {
			link = domEvent.target.closest('a.site-nav-link, a.site-brand');
		}
		if (!link) {
			return;
		}
		const sectionKey = link.getAttribute('data-section');
		if (!sectionKey) {
			return;
		}
		domEvent.preventDefault();
		this.scrollToSection(sectionKey);
		this.closeNavMenu();
	}

	/**
	 * @param {string} sectionKey - ref name on the target section (`services`, `top`, …)
	 */
	scrollToSection(sectionKey) {
		const scroller = this.scroller;
		// Brand / home — jump to the true top of the shell scroller.
		if (sectionKey === 'top') {
			if (scroller) {
				scroller.scrollTo({
					top: 0,
					behavior: 'smooth',
				});
				return;
			}
			this.refs.top?.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
			return;
		}
		const target = this.refs[sectionKey];
		if (!target) {
			return;
		}
		if (!scroller) {
			target.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
			return;
		}
		const header = this.refs.siteheader;
		const headerHeight = header
			? header.getBoundingClientRect().height
			: 88;
		const clearance = headerHeight + 12;
		const scrollerBox = scroller.getBoundingClientRect();
		const targetBox = target.getBoundingClientRect();
		const nextTop = scroller.scrollTop
			+ (targetBox.top - scrollerBox.top)
			- clearance;
		scroller.scrollTo({
			top: Math.max(0, nextTop),
			behavior: 'smooth',
		});
	}

	handleMenuButtonClick(domEvent) {
		domEvent.stopPropagation();
		this.handleNavToggle();
	}

	handleCallClick() {
		globalThis.location.href = PHONE_HREF;
	}

	handlePhoneIconClick(domEvent) {
		domEvent.stopPropagation();
		this.handleCallClick();
	}

	handleServicesClick() {
		this.scrollToSection('services');
	}

	handleGoogleClick() {
		globalThis.open(GOOGLE_BUSINESS_URL, '_blank', 'noopener,noreferrer');
	}

	/* Light list rows — plain values only; click handled on parent nav. */
	navLinkRow(item) {
		return html`<a
			class="site-nav-link"
			href=${item.href}
			data-section=${item.id}
		>${item.label}</a>`;
	}

	render() {
		this.html`
			<div class="site">
				<header
					class=${classList('site-header', () => {
						return this.state.navScrolled && 'is-scrolled';
					})}
					#siteheader
				>
					<div class="site-header-inner">
						<a
							class="site-brand"
							href="#top"
							data-section="top"
							@click=${this.handleNavAreaClick}
						>
							<img
								class="site-brand-logo"
								src=${LOGO_SRC}
								alt="Lawn Boss NJ"
								width="52"
								height="52"
								decoding="async"
							/>
							<span class="site-brand-text">
								<strong>Lawn Boss NJ</strong>
								<small>Landscape · Hardscape · Outdoor Living</small>
							</span>
						</a>
						<nav
							class=${classList('site-nav', () => {
								return this.state.navOpen && 'is-open';
							})}
							aria-label="Primary"
							@click=${this.handleNavAreaClick}
						>
							${this.list('navItems', this.navLinkRow)}
							<ui-icon-button
								class="site-nav-phone"
								.state.icon=${'phone'}
								.state.tooltip=${CALL_LABEL}
								.state.size=${'md'}
								@icon-button:click=${this.handlePhoneIconClick}
							></ui-icon-button>
						</nav>
						<ui-icon-button
							class="site-nav-toggle"
							.state.icon=${this.state.menuIcon}
							.state.tooltip=${this.state.menuTooltip}
							.state.size=${'md'}
							@icon-button:click=${this.handleMenuButtonClick}
						></ui-icon-button>
					</div>
				</header>

				<main id="top" #top>
					<section class="hero" aria-label="Welcome" #hero>
						<div class="hero-media" aria-hidden="true">
							<video
								class="hero-video"
								autoplay
								muted
								loop
								playsinline
								poster=${HERO_POSTER}
								src=${HERO_VIDEO}
							></video>
							<div class="hero-scrim"></div>
						</div>
						<div class="hero-shell">
							<div class="hero-content">
								<p class="eyebrow">Serving Middlesex · Monmouth · Ocean</p>
								<div class="hero-title-row">
									<img
										class="hero-logo"
										src=${LOGO_SRC}
										alt="Lawn Boss NJ logo"
										width="160"
										height="160"
										decoding="async"
									/>
									<h1>Your yard, handled like a boss.</h1>
								</div>
								<p class="hero-lead">
									Residential & commercial hardscaping, landscaping, and outdoor living —
									built clean, on schedule, and made for New Jersey seasons.
								</p>
								<div class="hero-actions">
									<ui-button
										.state=${this.state.heroCallBtn}
										@button:click=${this.handleCallClick}
									></ui-button>
									<ui-button
										.state=${this.state.heroServicesBtn}
										@button:click=${this.handleServicesClick}
									></ui-button>
								</div>
							</div>
						</div>
					</section>

					<section class="section trust" aria-label="Highlights">
						<div class="trust-band">
							<div class="section-inner">
								<div class="trust-shell">
									<div class="trust-item">
										<div class="trust-icon" aria-hidden="true">
											<ui-icon .state.name=${'users'} .state.size=${'md'}></ui-icon>
										</div>
										<div class="trust-copy">
											<strong>Local crews</strong>
											<span>Uniformed teams, marked trucks, accountable work.</span>
										</div>
									</div>
									<div class="trust-split" aria-hidden="true"></div>
									<div class="trust-item">
										<div class="trust-icon" aria-hidden="true">
											<ui-icon .state.name=${'shovel'} .state.size=${'md'}></ui-icon>
										</div>
										<div class="trust-copy">
											<strong>Design → build</strong>
											<span>From walkways and sod to full outdoor transformations.</span>
										</div>
									</div>
									<div class="trust-split" aria-hidden="true"></div>
									<div class="trust-item">
										<div class="trust-icon" aria-hidden="true">
											<ui-icon .state.name=${'badge-check'} .state.size=${'md'}></ui-icon>
										</div>
										<div class="trust-copy">
											<strong>Free consults</strong>
											<span>Clear scopes, honest pricing, no oversell.</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>

					<section class="section section-target" id="services" #services>
						<div class="section-inner">
							<header class="section-head">
								<p class="eyebrow">Services</p>
								<h2>Specialized outdoor care</h2>
								<p class="section-lead">
									Hardscape, sod renovation, drainage-ready walls, and lighting —
									one contractor for curb appeal and outdoor living.
								</p>
							</header>
							<div class="card-grid services-grid">
								${this.list('services', ServiceCard)}
							</div>
						</div>
					</section>

					<section class="section section-alt section-target" id="about" #about>
						<div class="section-inner about-grid">
							<div class="about-copy">
								<p class="eyebrow">Who we are</p>
								<h2>Honest work. Clean jobs. Lasting yards.</h2>
								<p>
									Lawn Boss NJ is your partner for outdoor landscaping and construction
									across Central Jersey. We treat every property with care — clear
									communication, quality materials, and crews that leave the site
									as neat as the finished work.
								</p>
								<p>
									Whether you need a sod refresh or a full patio renovation,
									we design and build outdoor spaces you’ll use for years.
								</p>
								<ul class="about-list">
									<li>Licensed & insured service</li>
									<li>Residential and commercial properties</li>
									<li>Custom builds + outdoor renovations</li>
								</ul>
							</div>
							<figure class="about-media">
								<img
									src="/images/hero-lawn.jpg"
									alt="Freshly striped green lawn at a New Jersey home"
									loading="lazy"
									decoding="async"
								/>
							</figure>
						</div>
					</section>

					<section class="section section-target" id="projects" #projects>
						<div class="section-inner">
							<header class="section-head">
								<p class="eyebrow">Projects</p>
								<h2>Featured outdoor work</h2>
								<p class="section-lead">
									Patios, walkways, sod, lighting, and walls — craftsmanship you can walk on.
								</p>
							</header>
							<div class="card-grid projects-grid">
								${this.list('projects', ProjectCard)}
							</div>
						</div>
					</section>

					<section class="section section-alt section-target" id="area" #area>
						<div class="section-inner">
							<header class="section-head">
								<p class="eyebrow">Service area</p>
								<h2>Central New Jersey coverage</h2>
								<p class="section-lead">
									Proudly serving homeowners and businesses across Middlesex, Monmouth,
									and Ocean counties — including these towns and surrounding communities.
								</p>
							</header>
							<div class="area-layout">
								<div class="area-copy">
									<div class="area-group">
										<h3 class="area-group-title">Counties</h3>
										<div class="area-chips">
											${this.list('counties', AreaChipRow)}
										</div>
									</div>
									<div class="area-group">
										<h3 class="area-group-title">Towns we serve</h3>
										<div class="area-chips">
											${this.list('towns', AreaChipRow)}
										</div>
									</div>
									<p class="area-note">
										Don’t see your town? Call us — we often cover neighboring communities.
									</p>
								</div>
								<figure class="area-map">
									<ui-surface .state=${this.state.mapSurface}>
										<img
											src=${NJ_MAP_SRC}
											alt="Map of New Jersey highlighting the Garden State"
											loading="lazy"
											decoding="async"
											width="800"
											height="618"
										/>
									</ui-surface>
								</figure>
							</div>
						</div>
					</section>

					<section class="section section-target" id="find-us" #find_us>
						<div class="section-inner find-us-layout">
							<header class="section-head">
								<p class="eyebrow">Find us</p>
								<h2>Google Business</h2>
								<p class="section-lead">
									See reviews, get directions, and save Lawn Boss LLC on Google Maps.
								</p>
							</header>
							<div class="find-us-grid">
								<ui-card .state=${this.state.googleCard} class="find-us-card">
									<div class="find-us-body">
										<p>
											Visit our Google Business profile for photos, customer reviews,
											and turn-by-turn directions across Central New Jersey.
										</p>
										<ul class="find-us-points">
											<li>Lawn Boss LLC</li>
											<li>Central NJ service area</li>
											<li>Directions & reviews on Google</li>
										</ul>
									</div>
									<div slot="actions">
										<ui-button
											.state=${this.state.googleBtn}
											@button:click=${this.handleGoogleClick}
										></ui-button>
									</div>
								</ui-card>
								<a
									class="find-us-map"
									href=${GOOGLE_BUSINESS_URL}
									target="_blank"
									rel="noopener noreferrer"
									aria-label="Open Lawn Boss LLC on Google Maps"
								>
									<img
										class="find-us-map-bg"
										src=${NJ_MAP_SRC}
										alt=""
										loading="lazy"
										decoding="async"
									/>
									<span class="find-us-map-overlay">
										<ui-icon .state.name=${'map-pin'} .state.size=${'lg'}></ui-icon>
										<strong>Lawn Boss LLC</strong>
										<span>View on Google Maps →</span>
									</span>
								</a>
							</div>
						</div>
					</section>

					<section class="section section-alt section-target" id="reviews" #reviews>
						<div class="section-inner">
							<header class="section-head">
								<p class="eyebrow">Reviews</p>
								<h2>What clients say</h2>
							</header>
							<div class="card-grid reviews-grid">
								${this.list('reviews', ReviewCard)}
							</div>
						</div>
					</section>

					<section class="section cta-band section-target" id="contact" #contact>
						<div class="section-inner contact-call">
							<img
								class="contact-call-logo"
								src=${LOGO_SRC}
								alt="Lawn Boss NJ logo"
								width="160"
								height="160"
								decoding="async"
							/>
							<div class="contact-call-copy">
								<p class="eyebrow">Get started</p>
								<h2>Ready for a free estimate?</h2>
								<p class="section-lead">
									Skip the form — call us directly and we’ll schedule a visit for hardscape,
									sod, landscaping, or a full outdoor redesign.
								</p>
								<ui-button
									class="contact-call-btn"
									.state=${this.state.contactCallBtn}
									@button:click=${this.handleCallClick}
								></ui-button>
								<p class="contact-hours">Serving Middlesex · Monmouth · Ocean counties</p>
								<p class="contact-alt">
									Or email
									<a href=${`mailto:${EMAIL}`}>${EMAIL}</a>
								</p>
							</div>
						</div>
					</section>
				</main>

				<footer class="site-footer">
					<div class="section-inner footer-grid">
						<div>
							<strong>Lawn Boss NJ</strong>
							<p>Landscaping & hardscaping for Central New Jersey.</p>
						</div>
						<div>
							<p><a href=${PHONE_HREF}>${PHONE_DISPLAY}</a></p>
							<p><a href=${`mailto:${EMAIL}`}>${EMAIL}</a></p>
							<p>Middlesex · Monmouth · Ocean</p>
						</div>
						<p class="footer-copy">© ${FOOTER_YEAR} Lawn Boss NJ. All rights reserved.</p>
					</div>
				</footer>
			</div>
		`;
	}
}
customElements.define('home-page', HomePage);
