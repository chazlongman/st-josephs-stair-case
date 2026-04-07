/**
 * app.js — Vue 3 application setup, routing, and global state
 */

const { createApp, ref, computed, watch, onMounted, nextTick } = Vue;

const app = createApp({
    setup() {
        const currentView = ref('timeline');
        const loading = ref(true);
        const error = ref(null);

        const denominations = ref([]);
        const doctrines = ref([]);
        const councils = ref([]);
        const events = ref([]);
        const figures = ref([]);
        const bibleRefs = ref({});

        const filters = ref({
            centuryStart: 0,
            centuryEnd: 2000,
            denomination: '',
            category: ''
        });

        const doctrineSearch = ref('');
        const selectedDoctrine = ref(null);

        const selectedDenominations = ref([]);

        const sourcePanel = ref({ open: false, source: { type: '', label: '', url: '' } });

        // Topic Search
        const searchTopic = ref('');
        const searchResults = ref(null);
        const searchError = ref('');
        const searchHistory = ref([]);
        const searchDoctrineMatch = ref(null);
        const availableTopics = ref([]);
        const expandedSections = ref({});
        const lineageModal = ref({ open: false, fatherName: '', chain: [] });
        const searchSuggestions = ref([]);

        // Traditions
        const traditions = ref([]);
        const traditionSearch = ref('');
        const selectedTradition = ref(null);

        // Miracles
        const miracles = ref([]);
        const miracleSearch = ref('');
        const selectedMiracle = ref(null);

        // Theme
        const isDarkTheme = ref(true);

        // Timeline hint
        const showTimelineHint = ref(true);

        const centuries = computed(() => ChurchUtils.getCenturies());

        const doctrineCategories = computed(() => ChurchUtils.getCategories(doctrines.value));

        const selectedDenomNames = computed(() =>
            selectedDenominations.value.map(id => {
                const d = denominations.value.find(den => den.id === id);
                return d ? d.name : id;
            })
        );

        // Breadcrumb label
        const breadcrumbLabel = computed(() => {
            const labels = {
                'timeline': 'Timeline',
                'doctrines': 'Doctrine Browser',
                'comparison': 'Comparison Dashboard',
                'search': 'Topic Search',
                'traditions': 'Traditions',
                'miracles': 'Miracles',
                'why-it-matters': 'Why It Matters'
            };
            return labels[currentView.value] || 'Timeline';
        });

        // Tradition categories
        const traditionCategories = computed(() => {
            const cats = new Set();
            for (const t of traditions.value) {
                if (t.category) cats.add(t.category);
            }
            return Array.from(cats).sort();
        });

        function filteredTraditionsByCategory(category) {
            return traditions.value.filter(t => {
                if (t.category !== category) return false;
                if (traditionSearch.value) {
                    return t.name.toLowerCase().includes(traditionSearch.value.toLowerCase());
                }
                return true;
            });
        }

        function selectTradition(t) {
            selectedTradition.value = t;
        }

        function formatTraditionText(text) {
            if (!text) return '';
            return text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
        }

        // Miracle categories
        const miracleCategories = computed(() => {
            const cats = new Set();
            for (const m of miracles.value) {
                if (m.category) cats.add(m.category);
            }
            return Array.from(cats).sort();
        });

        function filteredMiraclesByCategory(category) {
            return miracles.value.filter(m => {
                if (m.category !== category) return false;
                if (miracleSearch.value) {
                    return m.name.toLowerCase().includes(miracleSearch.value.toLowerCase());
                }
                return true;
            });
        }

        function selectMiracle(m) {
            selectedMiracle.value = m;
        }

        // Memoization cache for filteredDoctrinesByCategory
        const _doctrineCategoryCache = ref({});
        const _doctrineCacheKey = ref('');

        function navigate(view) {
            currentView.value = view;
            window.location.hash = view;
            // Clear memoization cache on nav
            _doctrineCategoryCache.value = {};

            nextTick(() => {
                if (view === 'timeline') {
                    ChurchTimeline.render(
                        denominations.value,
                        ChurchUtils.buildTimelineItems(councils.value, events.value, figures.value),
                        filters.value,
                        doctrines.value,
                        openSourcePanel
                    );
                    // Auto-hide timeline hint after 5 seconds
                    showTimelineHint.value = true;
                    setTimeout(() => { showTimelineHint.value = false; }, 5000);
                } else if (view === 'comparison') {
                    ChurchComparison.renderContinuityChart(denominations.value, doctrines.value);
                    ChurchComparison.renderHeatmap(denominations.value, doctrines.value);
                }
            });
        }

        function resetFilters() {
            filters.value = { centuryStart: 0, centuryEnd: 2000, denomination: '', category: '' };
        }

        function selectDoctrine(doc) {
            selectedDoctrine.value = doc;
            nextTick(() => {
                DoctrineBrowser.renderMiniTimeline(doc, denominations.value);
            });
        }

        function filteredDoctrinesByCategory(category) {
            const cacheKey = doctrineSearch.value.toLowerCase() + '||' + category;
            if (_doctrineCacheKey.value === doctrineSearch.value && _doctrineCategoryCache.value[cacheKey]) {
                return _doctrineCategoryCache.value[cacheKey];
            }
            if (_doctrineCacheKey.value !== doctrineSearch.value) {
                _doctrineCategoryCache.value = {};
                _doctrineCacheKey.value = doctrineSearch.value;
            }
            const result = doctrines.value.filter(d => {
                if (d.category !== category) return false;
                if (doctrineSearch.value) {
                    return d.name.toLowerCase().includes(doctrineSearch.value.toLowerCase());
                }
                return true;
            });
            _doctrineCategoryCache.value[cacheKey] = result;
            return result;
        }

        function getDenomColor(denomId) {
            const d = denominations.value.find(den => den.id === denomId);
            return d ? d.color : '#888';
        }

        function getDenomName(denomId) {
            const d = denominations.value.find(den => den.id === denomId);
            return d ? d.name : denomId;
        }

        function getPosition(doc, denomId) {
            const pos = doc.positions.find(p => p.denominationId === denomId);
            return pos ? pos.position : 'No data';
        }

        function getPositionSince(doc, denomId) {
            const pos = doc.positions.find(p => p.denominationId === denomId);
            return pos ? pos.since : '—';
        }

        function getScoreClass(doc, denomId) {
            const pos = doc.positions.find(p => p.denominationId === denomId);
            if (!pos) return '';
            if (pos.continuityScore === 1.0) return 'score-consistent';
            if (pos.continuityScore === 0.5) return 'score-modified';
            return 'score-rejected';
        }

        // Memoized continuity calculations
        const _continuityCache = ref({});
        function _getContinuity(denomId) {
            if (_continuityCache.value[denomId]) return _continuityCache.value[denomId];
            const result = ChurchUtils.calcContinuity(doctrines.value, denomId);
            _continuityCache.value[denomId] = result;
            return result;
        }

        function getContinuityPercent(denomId) {
            return _getContinuity(denomId).percent;
        }

        function getContinuityDetail(denomId) {
            const c = _getContinuity(denomId);
            return `${c.consistent} consistent, ${c.modified} modified, ${c.rejected} rejected of ${c.total} doctrines`;
        }

        function openSourcePanel(source) {
            sourcePanel.value = { open: true, source };
        }

        function closeSourcePanel() {
            sourcePanel.value.open = false;
        }

        // --- Theme ---
        function toggleTheme() {
            isDarkTheme.value = !isDarkTheme.value;
            document.body.classList.toggle('light-theme', !isDarkTheme.value);
            localStorage.setItem('churchHistoryTheme', isDarkTheme.value ? 'dark' : 'light');
        }

        // --- Export Comparison ---
        function exportComparison() {
            if (selectedDenominations.value.length < 2) return;
            const denomNames = selectedDenominations.value.map(id => getDenomName(id));
            const headers = ['Doctrine', ...denomNames];
            const rows = doctrines.value.map(doc => {
                const cols = selectedDenominations.value.map(denomId => {
                    const pos = doc.positions.find(p => p.denominationId === denomId);
                    return pos ? `"${pos.position.replace(/"/g, '""')}"` : 'No data';
                });
                return [doc.name, ...cols];
            });

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `doctrine-comparison-${denomNames.join('-vs-')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        }

        // --- Topic Search Methods ---
        function toggleExpand(topicId, section) {
            const key = `${topicId}-${section}`;
            expandedSections.value[key] = !expandedSections.value[key];
        }

        function isExpanded(topicId, section) {
            return !!expandedSections.value[`${topicId}-${section}`];
        }

        function visibleScripture(result) {
            if (isExpanded(result.id, 'scripture')) return result.scriptureRefs;
            return result.scriptureRefs.slice(0, 4);
        }

        function sortedFathers(fatherQuotes) {
            return [...fatherQuotes].sort((a, b) => {
                const yearA = parseInt(a.year.replace(/[^0-9]/g, '')) || 0;
                const yearB = parseInt(b.year.replace(/[^0-9]/g, '')) || 0;
                return yearA - yearB;
            });
        }

        function visibleFathers(result) {
            const sorted = sortedFathers(result.fatherQuotes);
            if (isExpanded(result.id, 'fathers')) return sorted;
            return sorted.slice(0, 4);
        }

        function performSearch() {
            const topic = searchTopic.value.trim();
            if (!topic) return;

            searchError.value = '';
            searchResults.value = null;
            searchDoctrineMatch.value = null;
            searchSuggestions.value = [];
            expandedSections.value = {};

            const results = TopicSearch.search(topic);
            if (results.length === 0) {
                searchError.value = `No results found for "${topic}". Try a different search term or browse the available topics.`;
                searchSuggestions.value = TopicSearch.getSuggestions(topic);
                return;
            }

            searchResults.value = results;
            searchDoctrineMatch.value = TopicSearch.findMatchingDoctrine(topic, doctrines.value);
            TopicSearch.saveToHistory(topic, results);
            searchHistory.value = TopicSearch.loadHistory();
        }

        function loadFromHistory(item) {
            searchTopic.value = item.query;
            performSearch();
        }

        function clearSearchHistory() {
            TopicSearch.clearHistory();
            searchHistory.value = [];
        }

        function goToMatchedDoctrine() {
            if (searchDoctrineMatch.value) {
                selectDoctrine(searchDoctrineMatch.value);
                navigate('doctrines');
            }
        }

        function hasLineage(fatherName) {
            return !!TopicSearch.getLineage(fatherName);
        }

        function showLineage(fatherName) {
            const chain = TopicSearch.getLineage(fatherName);
            if (chain) {
                lineageModal.value = { open: true, fatherName, chain };
                // Trap focus in modal
                nextTick(() => {
                    const modal = document.querySelector('.lineage-modal');
                    if (modal) {
                        const closeBtn = modal.querySelector('.close-btn');
                        if (closeBtn) closeBtn.focus();
                    }
                });
            }
        }

        function closeLineage() {
            lineageModal.value.open = false;
        }

        function formatSummary(text) {
            if (!text) return '';
            return text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
        }

        // Debounced timeline render
        let _timelineRenderTimeout = null;
        watch(filters, () => {
            if (currentView.value === 'timeline') {
                clearTimeout(_timelineRenderTimeout);
                _timelineRenderTimeout = setTimeout(() => {
                    nextTick(() => {
                        ChurchTimeline.render(
                            denominations.value,
                            ChurchUtils.buildTimelineItems(councils.value, events.value, figures.value),
                            filters.value,
                            doctrines.value,
                            openSourcePanel
                        );
                    });
                }, 150);
            }
        }, { deep: true });

        watch(selectedDenominations, () => {
            // Invalidate continuity cache
            _continuityCache.value = {};
            if (currentView.value === 'comparison') {
                nextTick(() => {
                    ChurchComparison.renderContinuityChart(denominations.value, doctrines.value);
                    ChurchComparison.renderHeatmap(denominations.value, doctrines.value);
                });
            }
        }, { deep: true });

        // Handle Escape key for modals
        function handleKeydown(e) {
            if (e.key === 'Escape') {
                if (lineageModal.value.open) closeLineage();
                if (sourcePanel.value.open) closeSourcePanel();
            }
        }

        onMounted(async () => {
            try {
                // Restore theme preference
                const savedTheme = localStorage.getItem('churchHistoryTheme');
                if (savedTheme === 'light') {
                    isDarkTheme.value = false;
                    document.body.classList.add('light-theme');
                }

                const data = await ChurchUtils.loadAllData();
                denominations.value = data.denominations;
                doctrines.value = data.doctrines;
                councils.value = data.councils;
                events.value = data.events;
                figures.value = data.figures;
                bibleRefs.value = data.bibleRefs;
                loading.value = false;

                // Load traditions and miracles
                try {
                    const [traditionsRes, miraclesRes] = await Promise.all([
                        fetch('data/traditions.json'),
                        fetch('data/miracles.json')
                    ]);
                    if (traditionsRes.ok) traditions.value = await traditionsRes.json();
                    if (miraclesRes.ok) miracles.value = await miraclesRes.json();
                } catch (err) {
                    console.warn('Could not load traditions/miracles:', err);
                }

                // Load search state
                await TopicSearch.loadTopics();
                availableTopics.value = TopicSearch.getAvailableTopics();
                searchHistory.value = TopicSearch.loadHistory();

                const hash = window.location.hash.replace('#', '') || 'timeline';
                navigate(hash);

                // Global keyboard handler
                document.addEventListener('keydown', handleKeydown);
            } catch (e) {
                error.value = e.message;
                loading.value = false;
                console.error('Failed to load data:', e);
            }
        });

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.replace('#', '') || 'timeline';
            if (currentView.value !== hash) {
                navigate(hash);
            }
        });

        return {
            currentView, loading, error,
            denominations, doctrines, councils, events, figures, bibleRefs,
            filters, centuries, doctrineCategories,
            doctrineSearch, selectedDoctrine,
            selectedDenominations, selectedDenomNames,
            sourcePanel,
            navigate, resetFilters, selectDoctrine, filteredDoctrinesByCategory,
            getDenomColor, getDenomName, getPosition, getPositionSince, getScoreClass,
            getContinuityPercent, getContinuityDetail,
            openSourcePanel, closeSourcePanel,
            // Traditions
            traditions, traditionSearch, selectedTradition,
            traditionCategories, filteredTraditionsByCategory,
            selectTradition, formatTraditionText,
            // Miracles
            miracles, miracleSearch, selectedMiracle,
            miracleCategories, filteredMiraclesByCategory,
            selectMiracle,
            // Theme
            isDarkTheme, toggleTheme,
            // Breadcrumb
            breadcrumbLabel,
            // Timeline hint
            showTimelineHint,
            // Export
            exportComparison,
            // Topic Search
            searchTopic, searchResults, searchError, searchHistory,
            searchDoctrineMatch, availableTopics, expandedSections, lineageModal,
            searchSuggestions,
            performSearch, loadFromHistory,
            clearSearchHistory, goToMatchedDoctrine, formatSummary,
            toggleExpand, isExpanded, visibleScripture, visibleFathers,
            hasLineage, showLineage, closeLineage
        };
    }
});

app.mount('#app');
