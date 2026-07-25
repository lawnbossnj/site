# Global Components Manifest — as-built inventory

**115 registered custom elements** in `components/global/` (across 104 subdirs — ~11 dirs register 2 tags each: `tabs`, `vote-tally`, `detail-list`, `legend`, `notification`, `speed-dial`, `json-inspector`, `carousel`, `toggle-group`, `status-bar`, `timeline`, `poll`, `dock`).

This is the **as-built truth** (every live `customElements.define(...)` in `global/`). Roadmap, priorities, and the full build queue live in [`componentCatalog.private.md`](../../../../../componentCatalog.private.md) — keep that for *what to build next*; this file is *what exists now*. State-key/event/payload naming rules + the 2026-07-04 rename ledger live in [`componentStandard.private.md`](./componentStandard.private.md).

- Base class: `WebComponent` → [`core/base.js:109`](../core/base.js#L109) (extends `HTMLElement`).
- Construction is always `Klass.create(state?, config?)` — **no raw `new WebComponent(...)`** anywhere.
- Intermediate bases subclassed within `global/`: `UIPanel`, `UIMenu`, `UICalendar`, `UIPoll`, `UICarousel`, `UIVoteTally`, `MorphSurface`, `IconButtonBase`.
- Client-wide total (all areas): **168** registered tags — global 113 · user 36 · core/tooltip 1 · module shells 2 · perf 4 · shootout 8 · preview demos 3 · + ~18 test probes. This manifest covers `global/` only.
- Provenance: `grep -rEn "customElements\.define\(" --include="*.js" viat/centralSite/client/components/global`, 2026-06-30.

| tag | class | file:line |
|---|---|---|
| **Primitives & foundational** | | |
| `ui-text` | UIText | text/text.js:47 |
| `ui-icon` | UIIcon | icon/icon.js:39 |
| `ui-button` | UIButton | button/button.js:102 |
| `ui-button-group` | UIButtonGroup | button-group/button-group.js:33 |
| `ui-badge` | UIBadge | badge/badge.js:65 |
| `ui-divider` | UIDivider | divider/divider.js:47 |
| `ui-surface` | UISurface | surface/surface.js:35 |
| `ui-stack` | UIStack | stack/stack.js:33 |
| `ui-field` | UIField | field/field.js:34 |
| `ui-kbd` | UIKbd | kbd/kbd.js:84 |
| `ui-close-button` | UICloseButton | close-button/close-button.js:29 |
| `ui-card` | UICard | card/card.js:93 |
| `ui-avatar` | UIAvatar | avatar/avatar.js:81 |
| `ui-chip` | UIChip | chip/chip.js:91 |
| **Forms & input** | | |
| `ui-input` | UIInput | input/input.js:94 |
| `ui-select` | UISelect | select/select.js:72 |
| `ui-switch` | UISwitch | switch/switch.js:55 |
| `ui-radio-group` | UIRadioGroup | radio-group/radio-group.js:102 |
| `ui-toggle-group` | UIToggleGroup | toggle-group/toggle-group.js:105 |
| `ui-toggle-option` | UIToggleOption | toggle-group/toggle-option.js:48 |
| `ui-slider` | UISlider | slider/slider.js:467 |
| `ui-number-stepper` | UINumberStepper | number-stepper/number-stepper.js:95 |
| `ui-pin-input` | UIPinInput | pin-input/pin-input.js:225 |
| `ui-tag-input` | UITagInput | tag-input/tag-input.js:206 |
| `ui-color-picker` | UIColorPicker | color-picker/color-picker.js:490 |
| `ui-stepper` | UIStepper | stepper/stepper.js:105 |
| **Layout & chrome** | | |
| `ui-panel` | UIPanel | panel/panel.js:60 |
| `ui-panel-header` | UIPanelHeader | panel-header/panel-header.js |
| `ui-slideout` | UISlideout | slideout/slideout.js |
| `ui-toolbar` | UIToolbar | toolbar/toolbar.js:27 |
| `ui-app-bar` | UIAppBar | app-bar/app-bar.js:38 |
| `ui-sidebar` | UISidebar | sidebar/sidebar.js:241 |
| `ui-tabs` | UITabs | tabs/tabs.js:363 |
| `ui-tab-button` | UITabButton | tabs/tab-button.js:49 |
| `ui-masonry` | UIMasonry | masonry/masonry.js:39 |
| `ui-breadcrumbs` | UIBreadcrumbs | breadcrumbs/breadcrumbs.js:50 |
| `ui-pagination` | UIPagination | pagination/pagination.js:114 |
| `ui-dock` | UIDock | dock/dock.js:123 |
| `dock-icon-button` | DockIconButton | dock/dockIconButton.js:8 |
| `ui-icon-button` | IconButtonBase | icon-button/icon-button.js:65 |
| `ui-fab` | UIFab | fab/fab.js:61 |
| `ui-menu` | UIMenu | menu/menu.js:276 |
| `ui-menubar` | UIMenubar | menubar/menubar.js:274 |
| `ui-context-menu` | UIContextMenu | context-menu/context-menu.js:222 |
| `ui-pulldown` | UIPullDown | pulldown/pulldown.js:173 |
| **Overlays** | | |
| `ui-modal` | UIModal | modal/modal.js:263 |
| `ui-whitebox-modal` | UIWhiteboxModal | whitebox-modal/whitebox-modal.js:58 |
| `ui-popover` | UIPopover | popover/popover.js:54 |
| `ui-floating-panel` | UIFloatingPanel | floating-panel/floating-panel.js:60 |
| `ui-morph-drawer` | UIMorphDrawer | morph-drawer/morph-drawer.js:60 |
| `ui-expandable-card` | UIExpandableCard | expandable-card/expandable-card.js:69 |
| `ui-accordion` | UIAccordion | accordion/accordion.js:82 |
| `ui-speed-dial` | UISpeedDial | speed-dial/speed-dial.js:143 |
| `ui-speed-dial-action` | UISpeedDialAction | speed-dial/speed-dial.js:51 |
| **Feedback & status** | | |
| `ui-alert` | UIAlert | alert/alert.js:63 |
| `ui-notification` | UINotification | notification/notification.js:145 |
| `ui-notification-item` | NotificationItem | notification/notification.js:64 |
| `ui-spinner` | UISpinner | spinner/spinner.js:28 |
| `ui-skeleton` | UISkeleton | skeleton/skeleton.js:40 |
| `ui-loading-bar` | UILoadingBar | loading-bar/loading-bar.js:47 |
| `ui-loading-screen` | UILoadingScreen | loading-screen/loading-screen.js:49 |
| `boot-screen` | BootScreen | boot-screen/boot-screen.js:78 |
| `ui-progress-ring` | UIProgressRing | progress-ring/progress-ring.js:94 |
| `ui-status-indicator` | UIStatusIndicator | status-indicator/status-indicator.js:75 |
| `ui-status-bar` | UIStatusBar | status-bar/status-bar.js:34 |
| `ui-status-cell` | UIStatusCell | status-bar/status-cell.js:26 |
| `ui-empty-state` | UIEmptyState | empty-state/empty-state.js:29 |
| `ui-tracker` | UITracker | tracker/tracker.js:54 |
| **Data & viz** | | |
| `ui-metric` | UIMetric | metric/metric.js:64 |
| `ui-stat-table` | UiStatTable | ui-stat-table/ui-stat-table.js:102 |
| `ui-sparkline` | UISparkline | sparkline/sparkline.js |
| `ui-line-chart` | UILineChart | line-chart/line-chart.js |
| `ui-bar-chart` | UIBarChart | bar-chart/bar-chart.js |
| `ui-pie-chart` | UIPieChart | pie-chart/pie-chart.js |
| `ui-scatter-chart` | UIScatterChart | scatter-chart/scatter-chart.js |
| `ui-radar-chart` | UIRadarChart | radar-chart/radar-chart.js |
| `ui-gauge` | UIGauge | gauge/gauge.js |
| `ui-bar` | UIBar | bar/bar.js:29 |
| `ui-bar-list` | UIBarList | bar-list/bar-list.js:71 |
| `ui-heatmap` | UIHeatmap | heatmap/heatmap.js:517 |
| `ui-animated-number` | UIAnimatedNumber | animated-number/animated-number.js:90 |
| `ui-timeline` | UITimeline | timeline/timeline.js:53 |
| `ui-timeline-item` | UITimelineItem | timeline/timeline-item.js:48 |
| `ui-detail-list` | UIDetailList | detail-list/detail-list.js:39 |
| `ui-detail-pair` | UIDetailPair | detail-list/detail-pair.js:52 |
| `ui-json-inspector` | UIJsonInspector | json-inspector/json-inspector.js:311 |
| `ui-json-row` | UIJsonRow | json-inspector/json-row.js:89 |
| `ui-code-block` | UICodeBlock | code-block/code-block.js:82 |
| `ui-legend` | UILegend | legend/legend.js:82 |
| `ui-legend-item` | UILegendItem | legend/legend-item.js:50 |
| `ui-svg-bands` | UISvgBands | svg-bands/svg-bands.js:84 |
| `paged-list` | PagedList | paged-list/paged-list.js:247 |
| `ui-image-list` | UIImageList | image-list/image-list.js:72 |
| **Media & motion** | | |
| `ui-carousel` | UICarousel | carousel/carousel.js:394 |
| `ui-carousel-slide` | UICarouselSlide | carousel/carousel.js:71 |
| `ui-feature-carousel` | UIFeatureCarousel | feature-carousel/feature-carousel.js:16 |
| `ui-loading-carousel` | UILoadingCarousel | loading-carousel/loading-carousel.js:17 |
| `ui-hover-video-player` | UIHoverVideoPlayer | hover-video-player/hover-video-player.js:94 |
| `ui-youtube-video-player` | UIYoutubeVideoPlayer | youtube-video-player/youtube-video-player.js:93 |
| `ui-typewriter` | UITypewriter | typewriter/typewriter.js:115 |
| **Calendars** | | |
| `ui-calendar` | UICalendar | calendar/calendar.js:283 |
| `ui-mini-calendar` | UIMiniCalendar | mini-calendar/mini-calendar.js:12 |
| `ui-range-calendar` | UIRangeCalendar | range-calendar/range-calendar.js:12 |
| `ui-event-calendar` | UIEventCalendar | event-calendar/event-calendar.js:13 |
| **Polls & voting** | | |
| `ui-poll` | UIPoll | poll/poll.js:186 |
| `ui-poll-option` | UIPollOption | poll/poll.js:65 |
| `ui-poll-widget` | UIPollWidget | poll-widget/poll-widget.js:13 |
| `ui-choice-poll` | UIChoicePoll | choice-poll/choice-poll.js:12 |
| `ui-feature-poll` | UIFeaturePoll | feature-poll/feature-poll.js:13 |
| `ui-feature-voting` | UIFeatureVoting | feature-voting/feature-voting.js:12 |
| `ui-vote-tally` | UIVoteTally | vote-tally/vote-tally.js:240 |
| `ui-vote-item` | UIVoteItem | vote-tally/vote-tally.js:97 |
| **AI / Agent** | | |
| `ui-ai-chat` | UIAiChat | ai-chat/ai-chat.js:360 |
| `ui-ai-message` | UIAiMessage | ai-message/ai-message.js:144 |
| `ui-ai-reasoning` | UIAiReasoning | ai-reasoning/ai-reasoning.js:56 |
| `ui-ai-plan` | UIAiPlan | ai-plan/ai-plan.js:61 |
| `ui-ai-tool-call` | UIAiToolCall | ai-tool-call/ai-tool-call.js:99 |
| `ui-ai-sources` | UIAiSources | ai-sources/ai-sources.js:63 |
| `ui-ai-approval` | UIAiApproval | ai-approval/ai-approval.js:91 |
| `ui-ai-inquire` | UIAiInquire | ai-inquire/ai-inquire.js:98 |
| **Theming** | | |
| `ui-theme-select` | UIThemeSelect | theme-select/theme-select.js:41 |

**Total: 113 global registered components.**

> Regenerate: `grep -rEn "customElements\.define\(" --include="*.js" viat/centralSite/client/components/global | wc -l`
