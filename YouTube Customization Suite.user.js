// ==UserScript==
// @name         YouTube Customization Suite
// @namespace    https://github.com/user/yt-enhancement-suite
// @version      3.3
// @description  Ultimate YouTube customization. Hide elements, control layout, and enhance your viewing experience.
// @author       Matthew Parker
// @match        https://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?domain=youtube.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @grant        GM_notification
// @grant        GM_download
// @updateURL    https://github.com/SysAdminDoc/Youtube_Customization_Suite/raw/refs/heads/main/YouTube%20Customization%20Suite.user.js
// @downloadURL  https://github.com/SysAdminDoc/Youtube_Customization_Suite/raw/refs/heads/main/YouTube%20Customization%20Suite.user.js
// @resource     betterDarkMode https://github.com/SysAdminDoc/Youtube_Customization_Suite/raw/refs/heads/main/Themes/youtube-dark-theme.css
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ——————————————————————————————————————————————————————————————————————————
    //  ~ YouTube Customization Suite v3.3 ~
    //
    //  - Integrated Cobalt Tools Download Button script as a new feature.
    //  - Replaced "Hide Download Button" with "Replace with Cobalt Downloader".
    //  - Fixed selectors for hiding Share, Clip, Thanks, and Save buttons.
    //
    // ——————————————————————————————————————————————————————————————————————————


    // —————————————————————
    // 0. DYNAMIC CONTENT/STYLE ENGINE
    // —————————————————————
    let dynamicObserver = null;
    const activeRules = new Map();

    const runAllRules = (targetNode) => {
        for (const rule of activeRules.values()) {
            try {
                rule(targetNode);
            } catch (e) {
                console.error('[YT Suite] Error applying rule:', e);
            }
        }
    };

    const observerCallback = (mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                 runAllRules(document.body);
            }
            if (mutation.type === 'attributes') {
                runAllRules(mutation.target);
            }
        }
    };

    function startObserver() {
        if (dynamicObserver) return;
        dynamicObserver = new MutationObserver(observerCallback);
        dynamicObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['theater', 'fullscreen', 'hidden', 'video-id']
        });
        // Also listen for YouTube's own navigation event for SPA
        window.addEventListener('yt-navigate-finish', () => runAllRules(document.body));
    }

    function stopObserver() {
        if (dynamicObserver) {
            dynamicObserver.disconnect();
            dynamicObserver = null;
        }
        window.removeEventListener('yt-navigate-finish', () => runAllRules(document.body));
    }

    function addRule(id, ruleFn) {
        if (activeRules.size === 0) {
            startObserver();
        }
        activeRules.set(id, ruleFn);
        ruleFn(document.body); // Run rule immediately on addition
    }

    function removeRule(id) {
        activeRules.delete(id);
        if (activeRules.size === 0) {
            stopObserver();
        }
    }


    // —————————————————————
    // 1. SETTINGS MANAGER
    // —————————————————————
    const settingsManager = {
        defaults: {
            // Core UI
            settingsButton: true,

            // Header
            hideCreateButton: false,
            hideVoiceSearch: false,
            logoToSubscriptions: false,

            // Sidebar
            hideSidebar: false,

            // Themes
            nativeDarkMode: false,
            betterDarkMode: false,

            // General Content
            removeAllShorts: true,
            fullWidthSubscriptions: false,
            fiveVideosPerRow: false,

            // Watch Page - Layout
            fitPlayerToWindow: false,
            hideRelatedVideos: false,
            expandVideoWidth: true,
            floatingLogoOnWatch: false,

            // Watch Page - Other Elements
            hideMerchShelf: false,
            hideDescriptionExtras: false,
            hidePinnedComments: false,
            hideLiveChatEngagement: false,

            // Watch Page - Action Buttons
            autolikeVideos: false,
            hideLikeButton: false,
            hideDislikeButton: false,
            hideShareButton: false,
            hideClipButton: false,
            hideThanksButton: false,
            hideSaveButton: false,
            replaceWithCobaltDownloader: false,
            hideSponsorButton: false,
            hideMoreActionsButton: false,

            // Watch Page - Player Controls
            autoMaxResolution: false,
            hideNextButton: false,
            hideAutoplayToggle: false,
            hideSubtitlesToggle: false,
            hideMiniplayerButton: false,
            hidePipButton: false,
            hideTheaterButton: false,
            hideFullscreenButton: false,

        },
        async load() {
            let savedSettings = await GM_getValue('ytSuiteSettings', {});
            // Migration for older setting name
            if (savedSettings.hasOwnProperty('collapsibleGuide')) {
                delete savedSettings.collapsibleGuide;
            }
            if (savedSettings.hasOwnProperty('hideShortsFeed')) {
                savedSettings.removeAllShorts = savedSettings.hideShortsFeed;
                delete savedSettings.hideShortsFeed;
            }
            if (savedSettings.hasOwnProperty('hideDownloadButton')) {
                delete savedSettings.hideDownloadButton;
            }
            return { ...this.defaults, ...savedSettings };
        },
        async save(settings) {
            await GM_setValue('ytSuiteSettings', settings);
        },
        async getFirstRunStatus() {
            return await GM_getValue('ytSuiteHasRun', false);
        },
        async setFirstRunStatus(hasRun) {
            await GM_setValue('ytSuiteHasRun', hasRun);
        }
    };


    // —————————————————————
    // 2. FEATURE DEFINITIONS
    // —————————————————————
    const features = [
        // Group: Core UI
        {
            id: 'settingsButton',
            name: 'Settings Button',
            description: 'Shows a settings cog. On watch pages, it appears next to the channel info. On other pages, it appears in the main header.',
            group: 'Core UI',
            _elements: { watch: null, masthead: null },
            _ruleId: 'settingsButtonRule',
            _handleDisplay() {
                const isWatch = window.location.pathname.startsWith('/watch');

                // --- Handle Watch Page ---
                if (isWatch) {
                    this._elements.masthead?.remove();
                    this._elements.masthead = null;
                    document.getElementById('yt-floating-cog')?.remove();

                    const ownerDiv = document.querySelector('#top-row #owner');
                    if (ownerDiv && !document.getElementById('yt-suite-watch-cog')) {
                        const cog = document.createElement('div');
                        cog.id = 'yt-suite-watch-cog';
                        const btn = document.createElement('button');
                        btn.title = 'Open YouTube Suite Settings';
                        btn.appendChild(createCogSvg());
                        btn.onclick = () => document.body.classList.toggle('yt-suite-panel-open');
                        cog.appendChild(btn);
                        this._elements.watch = cog;

                        const logo = document.getElementById('yt-suite-watch-logo');
                        if (logo && logo.parentElement === ownerDiv) {
                            ownerDiv.insertBefore(cog, logo.nextSibling);
                        } else {
                            ownerDiv.prepend(cog);
                        }
                    }
                }
                // --- Handle Non-Watch Page ---
                else {
                    this._elements.watch?.remove();
                    this._elements.watch = null;

                    const masthead = document.querySelector('ytd-topbar-logo-renderer');
                    if (masthead && !document.getElementById('yt-masthead-cog')) {
                        const cog = document.createElement('div');
                        cog.id = 'yt-masthead-cog';
                        const btn = document.createElement('button');
                        btn.title = 'Open YouTube Suite Settings';
                        btn.appendChild(createCogSvg());
                        btn.onclick = () => document.body.classList.toggle('yt-suite-panel-open');
                        cog.appendChild(btn);
                        masthead.appendChild(cog);
                        this._elements.masthead = cog;
                    }
                }
            },
            init() {
                addRule(this._ruleId, this._handleDisplay.bind(this));
            },
            destroy() {
                removeRule(this._ruleId);
                this._elements.watch?.remove();
                this._elements.masthead?.remove();
                document.getElementById('yt-suite-watch-cog')?.remove();
                this._elements = { watch: null, masthead: null };
            }
        },

        // Group: Header
        {
            id: 'hideCreateButton',
            name: 'Hide "Create" Button',
            description: 'Hides the "Create" button in the main YouTube header.',
            group: 'Header',
            _styleElement: null,
            init() { this._styleElement = injectStyle('ytd-masthead ytd-button-renderer:has(button[aria-label="Create"])', this.id); },
            destroy() { this._styleElement?.remove(); }
        },
        {
            id: 'hideVoiceSearch',
            name: 'Hide Voice Search Button',
            description: 'Hides the microphone icon for voice search in the header.',
            group: 'Header',
            _styleElement: null,
            init() { this._styleElement = injectStyle('#voice-search-button', this.id); },
            destroy() { this._styleElement?.remove(); }
        },
        {
            id: 'logoToSubscriptions',
            name: 'Logo Links to Subscriptions',
            description: 'Changes the YouTube logo link to go to your Subscriptions feed.',
            group: 'Header',
            _observer: null,
            _relinkLogo() {
                const logoRenderer = document.querySelector('ytd-topbar-logo-renderer');
                if (!logoRenderer) return;
                const link = logoRenderer.querySelector('a#logo');
                if (link) {
                    link.href = '/feed/subscriptions';
                }
            },
            init() {
                addRule('relinkLogoRule', () => this._relinkLogo());
            },
            destroy() {
                removeRule('relinkLogoRule');
                const logoLink = document.querySelector('ytd-topbar-logo-renderer a#logo');
                if (logoLink) logoLink.href = '/';
            }
        },

        // Group: Sidebar
        {
            id: 'hideSidebar',
            name: 'Hide Sidebar',
            description: 'Completely removes the left sidebar and its toggle button.',
            group: 'Sidebar',
            _styleElement: null,
            init() {
                const appElement = document.querySelector('ytd-app');
                if (appElement) {
                    appElement.removeAttribute('guide-persistent-and-visible');
                    const guideDrawer = appElement.querySelector('tp-yt-app-drawer#guide');
                    if (guideDrawer && guideDrawer.hasAttribute('opened')) {
                        guideDrawer.removeAttribute('opened');
                    }
                }
                const css = `
                    #guide, #guide-button, ytd-mini-guide-renderer, tp-yt-app-drawer:not([persistent]) { display: none !important; }
                    ytd-page-manager { margin-left: 0 !important; }
                `;
                this._styleElement = injectStyle(css, this.id, true);
            },
            destroy() {
                this._styleElement?.remove();
            }
        },

        // Group: Themes
        {
            id: 'nativeDarkMode',
            name: 'YouTube Native Dark Theme',
            description: 'Forces YouTube\'s built-in dark theme to be active.',
            group: 'Themes',
            _ruleId: 'nativeDarkModeRule',
            _applyTheme() {
                document.documentElement.setAttribute('dark', '');
            },
            init() {
                this._applyTheme();
                addRule(this._ruleId, this._applyTheme.bind(this));
            },
            destroy() {
                document.documentElement.removeAttribute('dark');
                removeRule(this._ruleId);
            }
        },
        {
            id: 'betterDarkMode',
            name: 'Better Full Dark Theme',
            description: 'Enhances the native dark theme. Requires "YouTube Native Dark Theme" to be enabled.',
            group: 'Themes',
            _styleElement: null,
            init() {
                const customCss = GM_getResourceText('betterDarkMode');
                if (customCss) {
                    this._styleElement = document.createElement('style');
                    this._styleElement.id = `yt-suite-style-${this.id}`;
                    this._styleElement.textContent = customCss;
                    document.head.appendChild(this._styleElement);
                } else {
                    console.error('[YT Suite] Could not load betterDarkMode resource.');
                }
            },
            destroy() {
                this._styleElement?.remove();
            }
        },

        // Group: General Content
        {
            id: 'removeAllShorts',
            name: 'Remove All Shorts Videos',
            description: 'Removes all Shorts videos from any page (Home, Subscriptions, Search, etc.).',
            group: 'General Content',
            _styleElement: null,
            init() {
                const removeShortsRule = () => {
                    document.querySelectorAll('a[href^="/shorts"]').forEach(a => {
                        let parent = a.parentElement;
                        while (parent && (!parent.tagName.startsWith('YTD-') || parent.tagName === 'YTD-THUMBNAIL')) {
                            parent = parent.parentElement;
                        }
                        if (parent) parent.style.display = 'none';
                    });
                };
                addRule(this.id, removeShortsRule);
                const css = `
                    ytd-reel-shelf-renderer,
                    ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]) {
                        display: none !important;
                    }
                `;
                this._styleElement = injectStyle(css, this.id + '-style', true);
            },
            destroy() {
                removeRule(this.id);
                this._styleElement?.remove();
            }
        },
        {
            id: 'fullWidthSubscriptions',
            name: 'Make Subscriptions Full-Width',
            description: 'Expands the subscription grid to use the full page width.',
            group: 'General Content',
            _styleElement: null,
            init() {
                const css = `
                    ytd-browse[page-subtype="subscriptions"] #grid-container.ytd-two-column-browse-results-renderer {
                        max-width: 100% !important;
                    }
                `;
                this._styleElement = injectStyle(css, this.id, true);
            },
            destroy() { this._styleElement?.remove(); }
        },
        {
            id: 'fiveVideosPerRow',
            name: '5 Videos Per Row',
            description: 'Changes the video grid layout to show 5 videos per row.',
            group: 'General Content',
            _styleElement: null,
            init() {
                const videosPerRow = 5;
                const css = `
                    #contents.ytd-rich-grid-renderer {
                        --ytd-rich-grid-items-per-row: ${videosPerRow} !important;
                    }
                `;
                this._styleElement = injectStyle(css, this.id, true);
            },
            destroy() { this._styleElement?.remove(); }
        },


        // Group: Watch Page - Layout
        {
            id: 'fitPlayerToWindow',
            name: 'Fit Player to Window',
            description: 'Makes the player fill the window, with page content scrolling underneath.',
            group: 'Watch Page - Layout',
            _styleElement: null,
            _ruleId: 'fitPlayerToWindowRule',
            applyStyles() {
                const isWatchPage = window.location.pathname.startsWith('/watch');
                document.documentElement.classList.toggle('yt-suite-fit-to-window', isWatchPage);
                document.body.classList.toggle('yt-suite-fit-to-window', isWatchPage);

                if (isWatchPage) {
                    const watchFlexy = document.querySelector('ytd-watch-flexy:not([theater])');
                    if (watchFlexy) {
                         document.querySelector('button.ytp-size-button')?.click();
                    }
                }
            },
            init() {
                this._styleElement = document.createElement('style');
                this._styleElement.id = `yt-suite-style-${this.id}`;
                this._styleElement.textContent = `
                    html.yt-suite-fit-to-window, body.yt-suite-fit-to-window { overflow-y: auto !important; height: auto !important; }
                    body.yt-suite-fit-to-window #movie_player { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100vh !important; z-index: 9999 !important; background-color: #000 !important; }
                    html.yt-suite-fit-to-window { padding-top: calc(100vh) !important; }
                    html.yt-suite-fit-to-window ytd-masthead { display: none !important; }
                    body.yt-suite-fit-to-window #page-manager { margin-top: 0 !important; }
                `;
                document.head.appendChild(this._styleElement);
                addRule(this._ruleId, () => this.applyStyles());
            },
            destroy() {
                document.documentElement.classList.remove('yt-suite-fit-to-window');
                document.body.classList.remove('yt-suite-fit-to-window');
                this._styleElement?.remove();
                removeRule(this._ruleId);
                if (document.querySelector('ytd-watch-flexy[theater]')) {
                    document.querySelector('button.ytp-size-button')?.click();
                }
            }
        },
        {
            id: 'hideRelatedVideos',
            name: 'Hide Related Videos Sidebar',
            description: 'Hides the entire right-hand sidebar containing related videos, chat, etc.',
            group: 'Watch Page - Layout',
            _styleElement: null,
            _subFeatureStyle: null,
            init() {
                this._styleElement = injectStyle('#secondary', this.id);
                if (appState.settings.expandVideoWidth) {
                    this._subFeatureStyle = document.createElement('style');
                    this._subFeatureStyle.id = 'yt-suite-expand-width';
                    this._subFeatureStyle.textContent = `ytd-watch-flexy:not(.yt-suite-fit-to-window) #primary { max-width: none !important; }`;
                    document.head.appendChild(this._subFeatureStyle);
                }
            },
            destroy() {
                this._styleElement?.remove();
                this._subFeatureStyle?.remove();
            }
        },
        {
            id: 'floatingLogoOnWatch',
            name: 'Logo in Video Header',
            description: 'On watch pages, adds a YouTube logo (linking to Subscriptions) next to the channel avatar.',
            group: 'Watch Page - Layout',
            _element: null,
            _ruleId: 'floatingLogoRule',
            handleLogoDisplay() {
                const isWatchPage = window.location.pathname.startsWith('/watch');
                const ownerDiv = document.querySelector('#top-row #owner');

                document.getElementById('yt-floating-logo')?.remove();

                if (isWatchPage && ownerDiv) {
                    let logoEl = document.getElementById('yt-suite-watch-logo');
                    if (!logoEl) {
                        logoEl = document.createElement('div');
                        logoEl.id = 'yt-suite-watch-logo';
                        const link = document.createElement('a');
                        link.href = '/feed/subscriptions';
                        link.title = 'YouTube Subscriptions';

                        const originalLogo = document.querySelector('ytd-topbar-logo-renderer ytd-logo');
                        if (originalLogo) {
                            link.appendChild(originalLogo.cloneNode(true));
                        } else {
                            const fallbackLogo = document.createElement('ytd-logo');
                            fallbackLogo.className = 'style-scope ytd-topbar-logo-renderer';
                            fallbackLogo.setAttribute('is-red-logo', '');
                            link.appendChild(fallbackLogo);
                        }
                        logoEl.appendChild(link);
                        ownerDiv.prepend(logoEl);
                    }
                    this._element = logoEl;
                } else if (this._element) {
                    this._element.remove();
                    this._element = null;
                }
            },
            init() {
                addRule(this._ruleId, this.handleLogoDisplay.bind(this));
            },
            destroy() {
                removeRule(this._ruleId);
                this._element?.remove();
                document.getElementById('yt-suite-watch-logo')?.remove();
                this._element = null;
            }
        },

        // Group: Watch Page - Other Elements
        { id: 'hideMerchShelf', name: 'Hide Merch Shelf', description: 'Hides the merchandise shelf that appears below the video.', group: 'Watch Page - Other Elements', _styleElement: null, init() { this._styleElement = injectStyle('ytd-merch-shelf-renderer', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideDescriptionExtras', name: 'Hide Description Extras', description: 'Hides extra content below the description like transcripts, podcasts, etc.', group: 'Watch Page - Other Elements', _styleElement: null, init() { this._styleElement = injectStyle('ytd-watch-metadata [slot="extra-content"]', this.id); }, destroy() { this._styleElement?.remove(); }},
        {
            id: 'hidePinnedComments',
            name: 'Hide Pinned Comments',
            description: 'Hides the pinned comment thread on video watch pages.',
            group: 'Watch Page - Other Elements',
            _styleElement: null,
            init() {
                const css = `ytd-comment-view-model[pinned], ytd-comment-thread-renderer:has(ytd-comment-view-model[pinned]) { display: none !important; }`;
                this._styleElement = injectStyle(css, this.id, true);
            },
            destroy() { this._styleElement?.remove(); }
        },
        {
            id: 'hideLiveChatEngagement',
            name: 'Hide Live Chat Engagement',
            description: 'Removes "Welcome to live chat!" and other engagement messages.',
            group: 'Watch Page - Other Elements',
            _styleElement: null,
            _ruleId: 'hideLiveChatEngagementRule',
            _runRemoval() {
                document.querySelectorAll('yt-live-chat-viewer-engagement-message-renderer').forEach(el => el.remove());
            },
            init() {
                const css = `yt-live-chat-viewer-engagement-message-renderer { display: none !important; }`;
                this._styleElement = injectStyle(css, this.id, true);
                addRule(this._ruleId, this._runRemoval);
            },
            destroy() {
                this._styleElement?.remove();
                removeRule(this._ruleId);
            }
        },

        // Group: Watch Page - Action Buttons
        {
            id: 'autolikeVideos',
            name: 'Autolike Videos',
            description: 'Automatically likes videos from channels you are subscribed to.',
            group: 'Watch Page - Action Buttons',
            _observer: null,
            init() {
                const ytLiker = () => {
                    const subscribeButton = document.querySelector('#subscribe-button-shape .yt-core-attributed-string--white-space-no-wrap');
                    const likeButton = document.querySelector('button.yt-spec-button-shape-next--segmented-start');
                    if (!subscribeButton || subscribeButton.innerHTML !== 'Subscribed') return;
                    if (likeButton && likeButton.ariaPressed === 'false') likeButton.click();
                };
                const setupObserver = () => {
                    this._observer = new MutationObserver((mutations) => {
                        for (const mutation of mutations) {
                            if (mutation.type === "attributes" && mutation.attributeName === 'video-id') {
                                setTimeout(ytLiker, 2000);
                            }
                        }
                    });
                    const targetNode = document.querySelector('ytd-watch-flexy');
                    if (targetNode) this._observer.observe(targetNode, { attributes: true, attributeFilter: ['video-id'] });
                };
                setTimeout(() => { ytLiker(); setupObserver(); }, 3000);
            },
            destroy() { if (this._observer) this._observer.disconnect(); }
        },
        { id: 'hideLikeButton', name: 'Hide Like Button', description: 'Hides the Like button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('#actions-inner .yt-like-button-view-model, ytd-watch-metadata like-button-view-model', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideDislikeButton', name: 'Hide Dislike Button', description: 'Hides the Dislike button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('#actions-inner .yt-dislike-button-view-model, ytd-watch-metadata dislike-button-view-model', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideShareButton', name: 'Hide Share Button', description: 'Hides the Share button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('yt-button-view-model:has(button[aria-label="Share"])', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideClipButton', name: 'Hide Clip Button', description: 'Hides the Clip button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('yt-button-view-model:has(button[aria-label="Clip"])', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideThanksButton', name: 'Hide Thanks Button', description: 'Hides the Thanks button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('yt-button-view-model:has(button[aria-label="Thanks"])', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideSaveButton', name: 'Hide Save Button', description: 'Hides the "Save to playlist" button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('yt-button-view-model:has(button[aria-label="Save to playlist"])', this.id); }, destroy() { this._styleElement?.remove(); }},
        {
            id: 'replaceWithCobaltDownloader',
            name: 'Replace with Cobalt Downloader',
            description: 'Replaces the native YouTube download button with a custom downloader using Cobalt.',
            group: 'Watch Page - Action Buttons',
            _lastUrl: '',
            _navigateListener: null,
            _styleElement: null,

            _INSTANCE: { protocol: 'https', apiHost : 'cobalt-api.meowing.de', frontend: 'cobalt.meowing.de' },
            _API_KEY: 'e4d331cc8267e6d04ecad6a5e22da9c7b31e97df',
            _getApiUrl() { return `${this._INSTANCE.protocol}://${this._INSTANCE.apiHost}/`; },
            _getFrontendUrl() { return `${this._INSTANCE.protocol}://${this._INSTANCE.frontend}/#`; },

            _isWatchPage() { return window.location.href.includes('youtube.com/watch?'); },
            _removeElement(sel) { const e = document.querySelector(sel); if (e) e.remove(); },

            async _cobaltApiCall(videoUrl, audio = false, quality = '1080', format = 'webm') {
                const codec = format === 'webm' ? 'vp9' : 'h264';
                const body = { url: videoUrl, videoQuality: quality.replace('p',''), youtubeVideoCodec: codec, filenameStyle: 'pretty', downloadMode: audio ? 'audio' : 'auto' };
                try {
                    const resp = await window.fetch(this._getApiUrl(), {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json', 'X-API-Key': this._API_KEY },
                        body: JSON.stringify(body)
                    });
                    const data = await resp.json();
                    if (data.status === 'error') {
                        const c = data.error?.code || '';
                        GM_notification(c.includes('no_matching_format') ? 'Format unavailable – try a lower quality' : 'Cobalt error: ' + (data.error.message || data.error));
                        return null;
                    }
                    return data.url || data.downloadUrl || null;
                } catch(err) {
                    console.error('Cobalt request failed', err);
                    return null;
                }
            },

            async _listQualities() {
                const set = new Set();
                const fmts = window.ytInitialPlayerResponse?.streamingData?.adaptiveFormats;
                if (fmts) {
                    fmts.forEach(f => { if (f.qualityLabel) { const m = f.qualityLabel.match(/^(\d+)/); if (m) set.add(m[1]); } });
                } else {
                    let html = ''; try { html = await (await fetch(location.href)).text() } catch {}
                    let m; const re = /"qualityLabel":"(\d+)p\d*"/g;
                    while ((m = re.exec(html)) !== null) set.add(m[1]);
                }
                return [...set].map(Number).sort((a, b) => b - a);
            },

            async _listFormats() {
                const set = new Set();
                const fmts = window.ytInitialPlayerResponse?.streamingData?.adaptiveFormats;
                if (fmts) {
                    fmts.forEach(f => { const m = f.mimeType.match(/\/([^;]+)/); if (m) set.add(m[1]); });
                } else {
                    let html = ''; try { html = await (await fetch(location.href)).text() } catch {}
                    let m; const re = /"mimeType":"video\/([^;]+);/g;
                    while ((m = re.exec(html)) !== null) set.add(m[1]);
                }
                set.add('mp3');
                const arr = [...set];
                const idx = arr.indexOf('webm');
                if (idx > -1) { arr.splice(idx, 1); arr.unshift('webm'); }
                return arr;
            },

            _showPopup(videoUrl) {
                this._removeElement('#cobalt-popup');
                const dark = window.matchMedia('(prefers-color-scheme:dark)').matches;
                const c = document.createElement('div');
                c.id = 'cobalt-popup';
                c.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:16px;border-radius:8px;background:${dark?'#1e1e1e':'#fff'};color:${dark?'#ddd':'#000'};border:2px solid ${dark?'#444':'#888'};box-shadow:0 4px 12px rgba(0,0,0,0.5);width:300px;max-height:80vh;overflow:auto;font-family:sans-serif;font-size:14px;`;
                const lblFmt = document.createElement('label'); lblFmt.textContent = 'format';
                const selFmt = document.createElement('select'); selFmt.id = 'cobalt-format'; selFmt.style.cssText = 'width:100%;margin:8px 0;padding:4px';
                const lblQ = document.createElement('label'); lblQ.id = 'label-quality'; lblQ.textContent = 'quality';
                const selQ = document.createElement('select'); selQ.id = 'cobalt-quality'; selQ.style.cssText = 'width:100%;margin:8px 0;padding:4px';
                const loading = document.createElement('div'); loading.id = 'cobalt-loading'; loading.textContent = 'loading…'; loading.style.cssText = 'display:none;text-align:center;margin:8px 0';
                const btn = document.createElement('button'); btn.id = 'cobalt-start'; btn.textContent = 'loading…'; btn.disabled = true;
                btn.style.cssText = `width:100%;padding:8px;background:#ff5722;color:#fff;border:none;border-radius:4px;font-size:15px;cursor:pointer;transition:background .2s;`;
                btn.onmouseenter = () => btn.style.background = '#e64a19';
                btn.onmouseleave = () => btn.style.background = '#ff5722';
                c.append(lblFmt, selFmt, lblQ, selQ, loading, btn);
                document.body.appendChild(c);

                setTimeout(() => { document.addEventListener('click', e => { if (!c.contains(e.target)) this._removeElement('#cobalt-popup'); }, { once: true }); }, 200);

                this._listFormats().then(arr => {
                    arr.forEach(fmt => { const o = document.createElement('option'); o.value = fmt; o.textContent = fmt; selFmt.append(o); });
                    btn.disabled = false; btn.textContent = 'Download';
                });
                this._listQualities().then(arr => { arr.forEach(q => { const o = document.createElement('option'); o.value = q; o.textContent = `${q}p`; selQ.append(o); }); });

                selFmt.addEventListener('change', () => {
                    const audio = ['mp3', 'opus', 'wav'].includes(selFmt.value);
                    lblQ.style.display = audio ? 'none' : 'block';
                    selQ.style.display = audio ? 'none' : 'block';
                });

                btn.addEventListener('click', async () => {
                    btn.disabled = true; loading.style.display = 'block';
                    const fmt = selFmt.value, qu = selQ.value;
                    const audio = ['mp3', 'opus', 'wav'].includes(fmt);
                    const link = await this._cobaltApiCall(videoUrl, audio, qu, fmt);
                    loading.style.display = 'none'; btn.disabled = false; this._removeElement('#cobalt-popup');
                    if (!link) { window.open(this._getFrontendUrl() + encodeURIComponent(videoUrl), '_blank'); return; }
                    const raw = document.title.replace(/\s*-\s*YouTube.*$/, '').trim();
                    const safe = raw.replace(/[\/\\?%*:|"<>]/g, '_');
                    const ext = audio ? 'mp3' : fmt;
                    const name = `${safe}_${qu}.${ext}`;
                    GM_download({ url: link, name, saveAs: true });
                });
            },

            _injectButton() {
                if (!this._isWatchPage() || document.querySelector('button[id^="cobaltBtn"]')) return;
                const id = 'cobaltBtn' + Math.random().toString(36).substr(2, 5);
                const btn = document.createElement('button');
                btn.id = id; btn.textContent = 'Download';
                btn.setAttribute('aria-label', 'Download video');
                btn.style.cssText = `font-size:14px;padding:6px 12px;margin-left:8px;border-radius:20px;border:2px solid #ff5722;background:transparent;color:#ff5722;cursor:pointer;transition:background .2s,color .2s;`;
                btn.onmouseenter = () => { btn.style.background = '#ff5722'; btn.style.color = '#fff'; };
                btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#ff5722'; };
                btn.addEventListener('click', () => this._showPopup(window.location.href));
                const parent = document.querySelector('#actions-inner #end-buttons, #top-level-buttons-computed');
                if (parent) parent.appendChild(btn);
            },

            _runInitLogic() {
                if (window.location.href === this._lastUrl) return;
                this._lastUrl = window.location.href;
                this._injectButton();
                this._removeElement('#cobalt-popup');
            },

            init() {
                this._styleElement = injectStyle('ytd-download-button-renderer', 'hideNativeDownload');
                this._navigateListener = () => setTimeout(() => this._runInitLogic(), 1000);
                window.addEventListener('yt-navigate-finish', this._navigateListener);
                setTimeout(() => this._runInitLogic(), 2000);
            },

            destroy() {
                if (this._navigateListener) window.removeEventListener('yt-navigate-finish', this._navigateListener);
                this._removeElement('button[id^="cobaltBtn"]');
                this._removeElement('#cobalt-popup');
                this._styleElement?.remove();
                this._lastUrl = '';
            }
        },
        { id: 'hideSponsorButton', name: 'Hide Join/Sponsor Button', description: 'Hides the channel membership "Join" button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('#sponsor-button', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideMoreActionsButton', name: 'Hide "More actions" (3-dot) Button', description: 'Hides the three-dots "More actions" menu button.', group: 'Watch Page - Action Buttons', _styleElement: null, init() { this._styleElement = injectStyle('#actions-inner #button-shape > button[aria-label="More actions"]', this.id); }, destroy() { this._styleElement?.remove(); }},

        // Group: Watch Page - Player Controls
        {
            id: 'autoMaxResolution',
            name: 'Auto Max Resolution',
            description: 'Automatically sets the video quality to the highest available resolution.',
            group: 'Watch Page - Player Controls',
            _onPlayerUpdated: null,
            _onNavigateFinish: null,
            init() {
                const setMaxQuality = (player) => {
                    if (!player || typeof player.getAvailableQualityLevels !== 'function') return;
                    const levels = player.getAvailableQualityLevels();
                    if (!levels || !levels.length) return;
                    const best = levels.map(l => ({ l, n: parseInt((l.match(/\d+/) || [])[0], 10) || 0 })).sort((a, b) => b.n - a.n)[0].l;
                    try { player.setPlaybackQualityRange(best); } catch (e) { console.warn('[YT Suite AutoMaxRes] Could not set quality', e); }
                };
                this._onPlayerUpdated = (evt) => setMaxQuality(evt?.target?.player_ || document.getElementById('movie_player'));
                this._onNavigateFinish = () => setTimeout(() => setMaxQuality(document.getElementById('movie_player')), 500);
                window.addEventListener('yt-player-updated', this._onPlayerUpdated, true);
                window.addEventListener('yt-navigate-finish', this._onNavigateFinish, true);
                this._onNavigateFinish();
            },
            destroy() {
                if (this._onPlayerUpdated) window.removeEventListener('yt-player-updated', this._onPlayerUpdated, true);
                if (this._onNavigateFinish) window.removeEventListener('yt-navigate-finish', this._onNavigateFinish, true);
            }
        },
        { id: 'hideNextButton', name: 'Hide "Next video" Button', description: 'Hides the next video button in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-next-button', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideAutoplayToggle', name: 'Hide Autoplay Toggle', description: 'Hides the autoplay toggle in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-autonav-toggle-button-container', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideSubtitlesToggle', name: 'Hide Subtitles Toggle', description: 'Hides the subtitles/CC button in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-subtitles-button', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideMiniplayerButton', name: 'Hide Miniplayer Button', description: 'Hides the miniplayer button in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-miniplayer-button', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hidePipButton', name: 'Hide Picture-in-Picture Button', description: 'Hides the Picture-in-Picture button in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-pip-button', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideTheaterButton', name: 'Hide Theater Mode Button', description: 'Hides the theater mode button in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-size-button', this.id); }, destroy() { this._styleElement?.remove(); }},
        { id: 'hideFullscreenButton', name: 'Hide Fullscreen Button', description: 'Hides the fullscreen button in the player controls.', group: 'Watch Page - Player Controls', _styleElement: null, init() { this._styleElement = injectStyle('.ytp-fullscreen-button', this.id); }, destroy() { this._styleElement?.remove(); }},
    ];

    function injectStyle(selector, featureId, isRawCss = false) {
        const style = document.createElement('style');
        style.id = `yt-suite-style-${featureId}`;
        style.textContent = isRawCss ? selector : `${selector} { display: none !important; }`;
        document.head.appendChild(style);
        return style;
    }

    // —————————————————————
    // 3. DOM HELPERS & TOAST NOTIFICATIONS
    // —————————————————————
    let appState = {};

    function createCogSvg() {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        const path1 = document.createElementNS(svgNS, "path");
        path1.setAttribute("d", "M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z");
        svg.appendChild(path1);
        return svg;
    }

    function showToast(message, isError = false) {
        let toast = document.getElementById('yt-suite-toast-notification');
        if (toast) toast.remove();
        toast = document.createElement('div');
        toast.id = 'yt-suite-toast-notification';
        toast.textContent = message;
        toast.style.cssText = `position: fixed; bottom: 20px; right: 20px; background-color: ${isError ? '#d9534f' : '#0f9d58'}; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10002; opacity: 0; transition: opacity 0.3s, bottom 0.3s;`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; toast.style.bottom = '30px'; }, 10);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '20px'; toast.addEventListener('transitionend', () => toast.remove()); }, 3000);
    }


    // —————————————————————
    // 4. UI & SETTINGS PANEL
    // —————————————————————
    function buildPanel(appState) {
        const groups = features.reduce((acc, f) => {
            acc[f.group] = acc[f.group] || [];
            if (f.id !== 'betterDarkMode' && f.id !== 'expandVideoWidth') {
                 acc[f.group].push(f);
            }
            return acc;
        }, {});


        const panelContainer = document.createElement('div');
        panelContainer.id = 'yt-suite-panel-container';
        const overlay = document.createElement('div');
        overlay.className = 'yt-suite-panel-overlay';
        overlay.onclick = () => document.body.classList.remove('yt-suite-panel-open');
        const panel = document.createElement('div');
        panel.className = 'yt-suite-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', 'yt-suite-panel-title');
        const header = document.createElement('header');
        const title = document.createElement('h2');
        title.id = 'yt-suite-panel-title';
        title.textContent = 'YouTube Customization Suite';
        const version = document.createElement('span');
        version.className = 'version';
        version.textContent = 'v3.3';
        header.append(title, version);

        const main = document.createElement('main');
        const groupOrder = [ 'Core UI', 'Header', 'Sidebar', 'Themes', 'General Content', 'Watch Page - Layout', 'Watch Page - Other Elements', 'Watch Page - Action Buttons', 'Watch Page - Player Controls' ];

        const createSubSetting = (subFeatureId, parentInput) => {
            const subFeat = features.find(x => x.id === subFeatureId);
            if (!subFeat) return null;
            const wrapper = document.createElement('div');
            wrapper.className = 'yt-suite-switch-wrapper yt-suite-sub-setting-wrapper';
            wrapper.dataset.tooltip = subFeat.description;
            const label = document.createElement('label');
            label.className = 'yt-suite-switch';
            label.htmlFor = `switch-${subFeat.id}`;
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `switch-${subFeat.id}`;
            input.checked = appState.settings[subFeat.id];
            input.onchange = async (e) => {
                const isChecked = e.target.checked;
                appState.settings[subFeat.id] = isChecked;
                if (subFeat.destroy) subFeat.destroy();
                if (isChecked && subFeat.init) subFeat.init();
                await settingsManager.save(appState.settings);
            };
            const slider = document.createElement('span');
            slider.className = 'slider';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'label';
            nameSpan.textContent = subFeat.name;
            label.append(input, slider);
            wrapper.append(label, nameSpan);
            wrapper.style.display = parentInput.checked ? 'flex' : 'none';
            parentInput.addEventListener('change', (e) => {
                wrapper.style.display = e.target.checked ? 'flex' : 'none';
                if (!e.target.checked && input.checked) {
                    input.checked = false;
                    input.dispatchEvent(new Event('change'));
                }
            });
            return wrapper;
        };


        groupOrder.forEach(groupName => {
            if (!groups[groupName] || groups[groupName].length === 0) return;
            const fieldset = document.createElement('fieldset');
            fieldset.className = 'yt-suite-feature-group';
            const legend = document.createElement('legend');
            legend.textContent = groupName;
            fieldset.appendChild(legend);
            groups[groupName].forEach(f => {
                const wrapper = document.createElement('div');
                wrapper.className = 'yt-suite-switch-wrapper';
                wrapper.dataset.tooltip = f.description;
                const label = document.createElement('label');
                label.className = 'yt-suite-switch';
                label.htmlFor = `switch-${f.id}`;
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `switch-${f.id}`;
                input.dataset.featureId = f.id;
                input.checked = appState.settings[f.id];
                input.onchange = async (e) => {
                    const id = e.target.dataset.featureId;
                    appState.settings[id] = e.target.checked;
                    const feat = features.find(x => x.id === id);
                    if (feat.destroy) feat.destroy();
                    if (appState.settings[id] && feat.init) feat.init();
                    await settingsManager.save(appState.settings);
                };
                const slider = document.createElement('span');
                slider.className = 'slider';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'label';
                nameSpan.textContent = f.name;
                label.append(input, slider);
                wrapper.append(label, nameSpan);
                fieldset.appendChild(wrapper);
                if (f.id === 'hideRelatedVideos') fieldset.append(createSubSetting('expandVideoWidth', input));
                if (f.id === 'nativeDarkMode') fieldset.append(createSubSetting('betterDarkMode', input));
            });
            main.appendChild(fieldset);
        });

        const footer = document.createElement('footer');
        const closeBtn = document.createElement('button');
        closeBtn.id = 'yt-suite-close-btn';
        closeBtn.className = 'yt-suite-btn-primary';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => document.body.classList.remove('yt-suite-panel-open');
        footer.append(closeBtn);

        panel.append(header, main, footer);
        panelContainer.append(overlay, panel);
        document.body.appendChild(panelContainer);
    }


    // —————————————————————
    // 5. STYLES
    // —————————————————————
    function injectPanelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            :root { --panel-font: 'Roboto', sans-serif; --panel-radius: 12px; --panel-shadow: 0 10px 30px -5px rgba(0,0,0,0.3); --yt-suite-panel-bg: #282828; --yt-suite-panel-fg: #f1f1f1; --yt-suite-border-color: #4d4d4d; --yt-suite-accent-color: #ff0000; }
            body.yt-suite-panel-open #yt-suite-panel-container .yt-suite-panel-overlay { opacity: 1; pointer-events: auto; }
            .yt-suite-panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 10000; opacity: 0; pointer-events: none; transition: opacity .3s ease; }
            .yt-suite-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95); width: 90%; max-width: 520px; background: var(--yt-suite-panel-bg); color: var(--yt-suite-panel-fg); border-radius: var(--panel-radius); box-shadow: var(--panel-shadow); font-family: var(--panel-font); opacity: 0; pointer-events: none; transition: opacity .3s ease, transform .3s ease; z-index: 10001; display: flex; flex-direction: column; }
            body.yt-suite-panel-open .yt-suite-panel { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
            .yt-suite-panel header { padding: 20px 24px; border-bottom: 1px solid var(--yt-suite-border-color); display: flex; justify-content: space-between; align-items: center; }
            .yt-suite-panel h2 { margin: 0; font-size: 18px; font-weight: 700; }
            .yt-suite-panel .version { font-size: 12px; opacity: 0.6; }
            .yt-suite-panel main { padding: 16px 24px; flex-grow: 1; max-height: 70vh; overflow-y: auto; }
            .yt-suite-panel footer { padding: 16px 24px; border-top: 1px solid var(--yt-suite-border-color); display: flex; justify-content: flex-end; align-items: center; }
            .yt-suite-feature-group { border: 1px solid var(--yt-suite-border-color); border-radius: 8px; padding: 16px; margin: 0 0 16px; }
            .yt-suite-feature-group legend { padding: 0 8px; font-size: 14px; font-weight: 500; color: var(--yt-suite-accent-color); }
            .yt-suite-switch-wrapper { display: flex; align-items: center; margin-bottom: 12px; position: relative; }
            .yt-suite-switch-wrapper:last-child { margin-bottom: 0; }
            .yt-suite-switch { display: flex; align-items: center; cursor: pointer; }
            .yt-suite-switch-wrapper .label { margin-left: 12px; flex: 1; font-size: 15px; }
            .yt-suite-switch input { display: none; }
            .yt-suite-switch .slider { width: 40px; height: 22px; background: #555; border-radius: 11px; position: relative; transition: background .2s ease; }
            .yt-suite-switch .slider:before { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; background: #fff; border-radius: 50%; transition: transform .2s ease; }
            .yt-suite-switch input:checked + .slider { background: var(--yt-suite-accent-color); }
            .yt-suite-switch input:checked + .slider:before { transform: translateX(18px); }
            .yt-suite-switch-wrapper::after { content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; background: #111; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 10003; }
            .yt-suite-switch-wrapper:hover::after { opacity: 1; }
            .yt-suite-sub-setting-wrapper { margin-left: 20px; padding-left: 10px; border-left: 2px solid var(--yt-suite-border-color); }
            .yt-suite-btn-primary { background-color: var(--yt-suite-accent-color); color: white; border: none; padding: 10px 20px; border-radius: 6px; font-family: var(--panel-font); font-weight: 500; cursor: pointer; transition: background-color .2s; }
            .yt-suite-btn-primary:hover { background-color: #cc0000; }
            #yt-suite-watch-logo, #yt-suite-watch-cog { display: flex; align-items: center; margin-right: 12px; }
            #yt-suite-watch-logo a { display: flex; align-items: center; }
            #yt-suite-watch-logo ytd-logo { width: 90px; height: auto; }
            #yt-suite-watch-cog button { background: transparent; border: none; width: 40px; height: 40px; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            #yt-suite-watch-cog svg { width: 24px; height: 24px; fill: var(--yt-spec-icon-inactive); }
            #yt-suite-watch-cog button:hover { background-color: var(--yt-spec-badge-chip-background); }
            ytd-topbar-logo-renderer { position: relative; }
            #yt-masthead-cog { position: absolute; top: 50%; transform: translateY(-50%); left: 135px; }
            #yt-masthead-cog button { background: transparent; border: none; width: 40px; height: 40px; cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            #yt-masthead-cog svg { fill: var(--yt-spec-icon-inactive); }
            #yt-masthead-cog button:hover { background-color: var(--yt-spec-badge-chip-background); }
            ytd-watch-metadata { margin-top: 180px !important; }
            ytd-live-chat-frame#chat { width: 402px !important; margin-top: -58px !important; }
        `;
        document.head.appendChild(style);
    }


    // —————————————————————
    // 6. MAIN BOOTSTRAP
    // —————————————————————
    async function main() {
        appState.settings = await settingsManager.load();
        injectPanelStyles();
        buildPanel(appState);
        features.forEach(f => {
            if (appState.settings[f.id]) {
                try {
                    if (f.init) f.init();
                } catch (error) {
                    console.error(`[YT Suite] Error initializing feature "${f.id}":`, error);
                }
            }
        });
        const hasRun = await settingsManager.getFirstRunStatus();
        if (!hasRun) {
            document.body.classList.add('yt-suite-panel-open');
            await settingsManager.setFirstRunStatus(true);
        }
    }

    if (document.readyState === 'complete') {
        main();
    } else {
        window.addEventListener('load', main);
    }

})();
