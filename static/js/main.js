/* ==========================================================================
   BigQuery Release Notes Explorer JS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let state = {
        releases: [],      // Raw data from API
        activeFilter: 'all',
        searchQuery: '',
        theme: 'dark'
    };

    // DOM Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const refreshFeedBtn = document.getElementById('refreshFeedBtn');
    const refreshIcon = refreshFeedBtn.querySelector('.refresh-icon');
    const notesTimeline = document.getElementById('notesTimeline');
    const entriesContainer = document.getElementById('entriesContainer');
    const feedLoading = document.getElementById('feedLoading');
    const feedEmpty = document.getElementById('feedEmpty');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const backToTopBtn = document.getElementById('backToTopBtn');
    const toast = document.getElementById('toast');
    
    // Overview Stats DOM
    const totalUpdatesEl = document.getElementById('totalUpdates');
    const totalEntriesEl = document.getElementById('totalEntries');
    const categoryBreakdownList = document.getElementById('categoryBreakdownList');
    const filterChips = document.querySelectorAll('.filter-chip');
    const feedHeading = document.getElementById('feedHeading');
    const feedSubtitle = document.getElementById('feedSubtitle');

    // SVG Icons Map for badges
    const icons = {
        feature: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
        change: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
        breaking: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        issue: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M12 2v9"></path><path d="M8 5h8"></path></svg>`,
        deprecation: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
        announcement: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
    };

    // ==========================================================================
    // Core Functions
    // ==========================================================================

    /**
     * Initializes the theme based on local storage or user media preference
     */
    function initTheme() {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            state.theme = storedTheme;
        } else {
            state.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        
        if (state.theme === 'light') {
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        }
    }

    /**
     * Fetches the release notes from the Flask backend API
     */
    async function loadData(forceRefresh = false) {
        showLoading();
        refreshIcon.classList.add('spinning');
        
        try {
            const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.status === 'success' || data.status === 'stale') {
                state.releases = data.releases;
                processAndRender();
                showConnected(data.status === 'stale');
            } else {
                showError(data.error || 'Failed to fetch release notes.');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showError('Network error or server unavailable. Make sure Flask is running.');
        } finally {
            refreshIcon.classList.remove('spinning');
        }
    }

    /**
     * Processes state filters and renders updates & analytics
     */
    function processAndRender() {
        updateStatistics();
        renderFeed();
    }

    /**
     * Updates stats counter and breakdown bars in left panel
     */
    function updateStatistics() {
        // Calculate counts
        let totalItems = 0;
        let totalDays = state.releases.length;
        
        const counts = {
            feature: 0,
            change: 0,
            breaking: 0,
            issue: 0,
            deprecation: 0,
            announcement: 0
        };

        state.releases.forEach(day => {
            day.notes.forEach(note => {
                totalItems++;
                if (counts[note.type] !== undefined) {
                    counts[note.type]++;
                } else {
                    counts.announcement++;
                }
            });
        });

        // Set top numbers
        totalUpdatesEl.textContent = totalItems;
        totalEntriesEl.textContent = totalDays;

        // Set counts inside filter chips
        document.getElementById('count-all').textContent = totalItems;
        for (const [type, count] of Object.entries(counts)) {
            const countEl = document.getElementById(`count-${type}`);
            if (countEl) countEl.textContent = count;
        }

        // Draw progress breakdown list
        categoryBreakdownList.innerHTML = '';
        const sortedCategories = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        
        sortedCategories.forEach(([type, count]) => {
            const percentage = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
            const displayName = type.charAt(0).toUpperCase() + type.slice(1) + 's';
            
            const itemHTML = `
                <div class="breakdown-item">
                    <div class="breakdown-label-wrapper">
                        <span class="breakdown-color-dot" style="background-color: var(--color-${type})"></span>
                        <span class="breakdown-label">${displayName}</span>
                    </div>
                    <div class="breakdown-val-wrapper">
                        <div class="breakdown-bar-bg">
                            <div class="breakdown-bar-fill" style="width: ${percentage}%; background-color: var(--color-${type})"></div>
                        </div>
                        <span class="breakdown-count">${count}</span>
                    </div>
                </div>
            `;
            categoryBreakdownList.insertAdjacentHTML('beforeend', itemHTML);
        });
    }

    /**
     * Recursive text node highlighting function
     */
    function highlightSearchTerm(element, searchTerm) {
        if (!searchTerm) return;
        const regex = new RegExp(`(${searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
        
        function walk(node) {
            if (node.nodeType === 3) { // Text node
                const text = node.nodeValue;
                if (regex.test(text)) {
                    const span = document.createElement('span');
                    span.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                    node.parentNode.replaceChild(span, node);
                }
            } else if (node.nodeType === 1 && node.childNodes && !['SCRIPT', 'STYLE', 'MARK', 'CODE', 'A'].includes(node.tagName)) {
                // Walk children, skip tags where nested markers would break link formatting or render badly
                for (let i = node.childNodes.length - 1; i >= 0; i--) {
                    walk(node.childNodes[i]);
                }
            }
        }
        walk(element);
    }

    /**
     * Renders release note cards to the timeline
     */
    function renderFeed() {
        entriesContainer.innerHTML = '';
        let totalMatchingItems = 0;
        let totalMatchingDays = 0;
        
        const filter = state.activeFilter;
        const query = state.searchQuery.toLowerCase().trim();

        state.releases.forEach(day => {
            // Filter notes inside the day
            const matchingNotes = day.notes.filter(note => {
                // Category Filter Check
                if (filter !== 'all' && note.type !== filter) {
                    return false;
                }
                // Search Query Check
                if (query) {
                    const inTitle = day.title.toLowerCase().includes(query);
                    const inCategory = note.category.toLowerCase().includes(query);
                    const inHtml = note.html.toLowerCase().includes(query);
                    return inTitle || inCategory || inHtml;
                }
                return true;
            });

            if (matchingNotes.length > 0) {
                totalMatchingDays++;
                totalMatchingItems += matchingNotes.length;

                // Create Timeline Day element
                const entryDiv = document.createElement('div');
                entryDiv.className = 'timeline-entry';
                
                // Add day title header
                let entryHTML = `
                    <div class="timeline-date-header">${day.title}</div>
                    <div class="timeline-notes">
                `;

                // Add note cards
                matchingNotes.forEach((note, index) => {
                    const badgeIcon = icons[note.type] || icons.announcement;
                    
                    entryHTML += `
                        <div class="note-card" data-id="${day.title}-${index}">
                            <div class="note-header">
                                <span class="badge badge-${note.type}">
                                    ${badgeIcon}
                                    ${note.category}
                                </span>
                                <div class="note-actions">
                                    <button class="note-action-btn copy-btn" title="Copy text to clipboard">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                    <button class="note-action-btn twitter-btn" title="Share on Twitter / X">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                                        </svg>
                                    </button>
                                    <a class="note-action-btn anchor-link" href="${day.link}" target="_blank" rel="noopener noreferrer" title="View official release notes">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                            <polyline points="15 3 21 3 21 9"></polyline>
                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                        </svg>
                                    </a>
                                </div>
                            </div>
                            <div class="note-body">${note.html}</div>
                        </div>
                    `;
                });

                entryHTML += `</div>`;
                entryDiv.innerHTML = entryHTML;
                entriesContainer.appendChild(entryDiv);

                // Add Clipboard copy events to the cards in this day
                entryDiv.querySelectorAll('.copy-btn').forEach((btn, index) => {
                    btn.addEventListener('click', () => {
                        const note = matchingNotes[index];
                        // Convert HTML to simple formatted text for clipboard
                        let text = `[BigQuery Release - ${day.title}] (${note.category})\n\n`;
                        // Remove HTML tags, resolve hyperlinks
                        let textBody = note.html
                            .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '$2 ($1)')
                            .replace(/<li>/g, '* ')
                            .replace(/<\/li>/g, '\n')
                            .replace(/<[^>]*>/g, '')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&amp;/g, '&');
                        
                        navigator.clipboard.writeText(text + textBody.trim()).then(() => {
                            showToast();
                        });
                    });
                });

                // Add Twitter Composer trigger events
                entryDiv.querySelectorAll('.twitter-btn').forEach((btn, index) => {
                    btn.addEventListener('click', () => {
                        const note = matchingNotes[index];
                        openTwitterComposer(day, note);
                    });
                });

                // Highlight matches in the card bodies
                if (query) {
                    entryDiv.querySelectorAll('.note-body').forEach(body => {
                        highlightSearchTerm(body, query);
                    });
                }
            }
        });

        // Toggle visibility based on result count
        if (totalMatchingItems === 0) {
            feedEmpty.classList.remove('hidden');
            entriesContainer.classList.add('hidden');
        } else {
            feedEmpty.classList.add('hidden');
            entriesContainer.classList.remove('hidden');
        }

        // Hide loading indicator
        feedLoading.classList.add('hidden');

        // Update Feed Heading/Subtitle
        let filterTitle = state.activeFilter.charAt(0).toUpperCase() + state.activeFilter.slice(1) + 's';
        if (state.activeFilter === 'all') filterTitle = 'All Release Notes';
        if (state.activeFilter === 'deprecation') filterTitle = 'Deprecations';

        feedHeading.textContent = filterTitle;
        
        if (query) {
            feedSubtitle.textContent = `Found ${totalMatchingItems} matching items for "${state.searchQuery}"`;
        } else {
            feedSubtitle.textContent = `Showing ${totalMatchingItems} updates across ${totalMatchingDays} release days`;
        }
    }

    // ==========================================================================
    // UI Feedback Helpers
    // ==========================================================================

    function showLoading() {
        feedLoading.classList.remove('hidden');
        feedEmpty.classList.add('hidden');
        entriesContainer.classList.add('hidden');
    }

    function showError(message) {
        feedLoading.classList.add('hidden');
        feedEmpty.classList.remove('hidden');
        entriesContainer.classList.add('hidden');
        
        const emptyHeader = feedEmpty.querySelector('h3');
        const emptyDesc = feedEmpty.querySelector('p');
        
        emptyHeader.textContent = "Feed Unavailable";
        emptyDesc.textContent = message;
    }

    function showConnected(isStale) {
        const dot = document.getElementById('syncStatus').querySelector('.status-dot');
        const text = document.getElementById('syncStatus').querySelector('.status-text');
        
        if (isStale) {
            dot.className = 'status-dot orange';
            text.textContent = 'Disconnected (Using Cached Data)';
        } else {
            dot.className = 'status-dot green';
            text.textContent = 'Connected (Live)';
        }
    }

    function showToast() {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    // ==========================================================================
    // Event Listeners Setup
    // ==========================================================================

    // Theme toggle click
    themeToggleBtn.addEventListener('click', () => {
        if (state.theme === 'dark') {
            state.theme = 'light';
            document.body.classList.remove('dark-theme');
            document.body.classList.add('light-theme');
        } else {
            state.theme = 'dark';
            document.body.classList.remove('light-theme');
            document.body.classList.add('dark-theme');
        }
        localStorage.setItem('theme', state.theme);
    });

    // Search Input
    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery) {
            clearSearchBtn.classList.add('show');
        } else {
            clearSearchBtn.classList.remove('show');
        }
        renderFeed();
    });

    // Clear Search click
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.classList.remove('show');
        renderFeed();
        searchInput.focus();
    });

    // Filter Chips click
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            state.activeFilter = chip.getAttribute('data-filter');
            renderFeed();
        });
    });

    // Refresh Button click
    refreshFeedBtn.addEventListener('click', () => {
        loadData(true);
    });

    // Reset Filters & Search click
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.classList.remove('show');
        
        filterChips.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-filter="all"]').classList.add('active');
        state.activeFilter = 'all';
        
        processAndRender();
    });

    // Scroll back to top visibility
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });

    // Scroll back to top click
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // ==========================================================================
    // Twitter Composer & Live Preview Card Logic
    // ==========================================================================
    const twitterModal = document.getElementById('twitterModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const tweetTextarea = document.getElementById('tweetTextarea');
    const charCounter = document.getElementById('charCounter');
    const tweetLiveText = document.getElementById('tweetLiveText');
    
    const linkCardImage = document.getElementById('linkCardImage');
    const linkCardBadge = document.getElementById('linkCardBadge');
    const linkCardDate = document.getElementById('linkCardDate');
    const linkCardTitle = document.getElementById('linkCardTitle');
    
    const copyTweetBtn = document.getElementById('copyTweetBtn');
    const publishTweetBtn = document.getElementById('publishTweetBtn');
    const modalHashtagPills = twitterModal.querySelectorAll('.hashtag-pill');

    let currentModalData = null; // Track current open release note details

    function openTwitterComposer(day, note) {
        currentModalData = { day, note };
        
        // Reset active hashtag pills
        modalHashtagPills.forEach(pill => pill.classList.remove('active'));
        
        // Formulate a clean textual snippet of the release note
        let rawContent = note.html
            .replace(/<[^>]*>/g, '') // strip HTML tags
            .replace(/\s+/g, ' ')    // collapse whitespace
            .trim();
        
        // Truncate content if necessary to fit in tweet preview (limit snippet to 140 chars)
        let snippet = rawContent;
        if (snippet.length > 130) {
            snippet = snippet.substring(0, 127) + '...';
        }
        
        // Default tweet content
        const defaultTweet = `New BigQuery ${note.category} (${day.title}): "${snippet}"\n\nCheck it out here: ${day.link}`;
        tweetTextarea.value = defaultTweet;
        
        // Update Twitter Link Preview Card attributes
        linkCardBadge.textContent = note.category;
        // Reset and set badge class for banner color
        linkCardBadge.className = `link-card-badge`;
        linkCardImage.className = `link-card-image ${note.type}`;
        
        linkCardDate.textContent = day.title;
        linkCardTitle.textContent = `BigQuery - Release notes | ${day.title}`;
        
        // Sync preview text & counter
        syncTweetPreview(defaultTweet);
        
        // Show Modal
        twitterModal.classList.remove('hidden');
        tweetTextarea.focus();
    }

    function syncTweetPreview(text) {
        const remaining = 280 - text.length;
        charCounter.textContent = remaining;
        
        // Character count warning states
        charCounter.className = 'char-counter';
        if (remaining < 0) {
            charCounter.classList.add('danger');
            publishTweetBtn.disabled = true;
            publishTweetBtn.style.opacity = '0.5';
            publishTweetBtn.style.cursor = 'not-allowed';
        } else {
            publishTweetBtn.disabled = false;
            publishTweetBtn.style.opacity = '1';
            publishTweetBtn.style.cursor = 'pointer';
            if (remaining <= 20) {
                charCounter.classList.add('warning');
            }
        }
        
        // Render preview text with blue links for hashtags and URLs
        let escaped = escapeHtml(text);
        
        // Colorize hashtags
        escaped = escaped.replace(/(#[a-zA-Z0-9_]+)/g, '<a href="#" onclick="event.preventDefault()">$1</a>');
        
        // Colorize URLs
        escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        tweetLiveText.innerHTML = escaped;
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Live textarea typing sync
    tweetTextarea.addEventListener('input', (e) => {
        syncTweetPreview(e.target.value);
        
        // Synchronize active states of hashtag pills based on text contents
        modalHashtagPills.forEach(pill => {
            const tag = pill.getAttribute('data-tag');
            if (e.target.value.includes(tag)) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    });

    // Hashtag pill toggles
    modalHashtagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const tag = pill.getAttribute('data-tag');
            let currentText = tweetTextarea.value;
            
            if (pill.classList.contains('active')) {
                // Remove hashtag
                pill.classList.remove('active');
                // Remove hashtag with surrounding whitespace
                const regex = new RegExp(`\\s*${tag}\\b`, 'g');
                currentText = currentText.replace(regex, '').trim();
            } else {
                // Add hashtag
                pill.classList.add('active');
                if (!currentText.includes(tag)) {
                    currentText = `${currentText} ${tag}`.trim();
                }
            }
            
            tweetTextarea.value = currentText;
            syncTweetPreview(currentText);
            tweetTextarea.focus();
        });
    });

    // Close Modal actions
    function closeTwitterModal() {
        twitterModal.classList.add('hidden');
        currentModalData = null;
    }

    closeModalBtn.addEventListener('click', closeTwitterModal);
    
    // Close on clicking backdrop overlay
    twitterModal.addEventListener('click', (e) => {
        if (e.target === twitterModal) {
            closeTwitterModal();
        }
    });

    // Copy Tweet button
    copyTweetBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(tweetTextarea.value).then(() => {
            // Re-use copy toast notification but update its text briefly
            const origText = toast.textContent;
            toast.textContent = "Tweet copied to clipboard!";
            showToast();
            setTimeout(() => {
                toast.textContent = origText;
            }, 2500);
        });
    });

    // Publish/Post Tweet button
    publishTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    });

    // Initialize application
    initTheme();
    loadData();
});
