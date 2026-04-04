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

        const centuries = computed(() => ChurchUtils.getCenturies());

        const doctrineCategories = computed(() => ChurchUtils.getCategories(doctrines.value));

        const selectedDenomNames = computed(() =>
            selectedDenominations.value.map(id => {
                const d = denominations.value.find(den => den.id === id);
                return d ? d.name : id;
            })
        );

        function navigate(view) {
            currentView.value = view;
            window.location.hash = view;

            nextTick(() => {
                if (view === 'timeline') {
                    ChurchTimeline.render(
                        denominations.value,
                        ChurchUtils.buildTimelineItems(councils.value, events.value, figures.value),
                        filters.value,
                        doctrines.value,
                        openSourcePanel
                    );
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
            return doctrines.value.filter(d => {
                if (d.category !== category) return false;
                if (doctrineSearch.value) {
                    return d.name.toLowerCase().includes(doctrineSearch.value.toLowerCase());
                }
                return true;
            });
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

        function getContinuityPercent(denomId) {
            return ChurchUtils.calcContinuity(doctrines.value, denomId).percent;
        }

        function getContinuityDetail(denomId) {
            const c = ChurchUtils.calcContinuity(doctrines.value, denomId);
            return `${c.consistent} consistent, ${c.modified} modified, ${c.rejected} rejected of ${c.total} doctrines`;
        }

        function openSourcePanel(source) {
            sourcePanel.value = { open: true, source };
        }

        function closeSourcePanel() {
            sourcePanel.value.open = false;
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
            expandedSections.value = {};

            const results = TopicSearch.search(topic);
            if (results.length === 0) {
                searchError.value = `No results found for "${topic}". Try a different search term or browse the available topics above.`;
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
            }
        }

        function closeLineage() {
            lineageModal.value.open = false;
        }

        function formatSummary(text) {
            if (!text) return '';
            return text.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
        }

        watch(filters, () => {
            if (currentView.value === 'timeline') {
                nextTick(() => {
                    ChurchTimeline.render(
                        denominations.value,
                        ChurchUtils.buildTimelineItems(councils.value, events.value, figures.value),
                        filters.value,
                        doctrines.value,
                        openSourcePanel
                    );
                });
            }
        }, { deep: true });

        watch(selectedDenominations, () => {
            if (currentView.value === 'comparison') {
                nextTick(() => {
                    ChurchComparison.renderContinuityChart(denominations.value, doctrines.value);
                    ChurchComparison.renderHeatmap(denominations.value, doctrines.value);
                });
            }
        }, { deep: true });

        onMounted(async () => {
            try {
                const data = await ChurchUtils.loadAllData();
                denominations.value = data.denominations;
                doctrines.value = data.doctrines;
                councils.value = data.councils;
                events.value = data.events;
                figures.value = data.figures;
                bibleRefs.value = data.bibleRefs;
                loading.value = false;

                // Load search state
                await TopicSearch.loadTopics();
                availableTopics.value = TopicSearch.getAvailableTopics();
                searchHistory.value = TopicSearch.loadHistory();

                const hash = window.location.hash.replace('#', '') || 'timeline';
                navigate(hash);
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
            // Topic Search
            searchTopic, searchResults, searchError, searchHistory,
            searchDoctrineMatch, availableTopics, expandedSections, lineageModal,
            performSearch, loadFromHistory,
            clearSearchHistory, goToMatchedDoctrine, formatSummary,
            toggleExpand, isExpanded, visibleScripture, visibleFathers,
            hasLineage, showLineage, closeLineage
        };
    }
});

app.mount('#app');
