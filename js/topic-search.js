/**
 * topic-search.js — Local keyword-based topic search
 * Searches pre-built topics.json data — no API key required.
 */

const TopicSearch = {
    topics: [],
    lineage: {},
    STORAGE_KEY_HISTORY: 'churchHistorySearches',
    MAX_HISTORY: 20,

    /**
     * Load topics and lineage data from JSON files.
     */
    async loadTopics() {
        const [topicsRes, lineageRes] = await Promise.all([
            fetch('data/topics.json'),
            fetch('data/apostolic-lineage.json')
        ]);
        if (!topicsRes.ok) throw new Error('Failed to load topics data');
        if (!lineageRes.ok) throw new Error('Failed to load lineage data');
        TopicSearch.topics = await topicsRes.json();
        TopicSearch.lineage = await lineageRes.json();
        return TopicSearch.topics;
    },

    /**
     * Get the apostolic lineage chain for a Church Father.
     * Tries exact name match first, then partial match.
     */
    getLineage(fatherName) {
        if (TopicSearch.lineage[fatherName]) {
            return TopicSearch.lineage[fatherName].chain;
        }
        // Try partial match
        for (const key of Object.keys(TopicSearch.lineage)) {
            if (key.toLowerCase().includes(fatherName.toLowerCase()) ||
                fatherName.toLowerCase().includes(key.toLowerCase())) {
                return TopicSearch.lineage[key].chain;
            }
        }
        return null;
    },

    /**
     * Search topics by keyword matching.
     * Returns an array of matching topic objects, ranked by relevance.
     */
    search(query) {
        const q = query.toLowerCase().trim();
        if (!q) return [];

        const results = [];

        for (const topic of TopicSearch.topics) {
            let score = 0;

            // Exact name match
            if (topic.name.toLowerCase().includes(q) || q.includes(topic.name.toLowerCase())) {
                score += 10;
            }

            // ID match
            if (topic.id.includes(q) || q.includes(topic.id)) {
                score += 8;
            }

            // Keyword match
            for (const kw of topic.keywords) {
                if (kw.includes(q) || q.includes(kw)) {
                    score += 5;
                }
            }

            // Partial keyword match (any word in query matches any keyword)
            const queryWords = q.split(/\s+/);
            for (const word of queryWords) {
                if (word.length < 3) continue;
                for (const kw of topic.keywords) {
                    if (kw.includes(word)) {
                        score += 2;
                    }
                }
                // Check in summary text
                if (topic.summary.toLowerCase().includes(word)) {
                    score += 1;
                }
            }

            if (score > 0) {
                results.push({ ...topic, _score: score });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b._score - a._score);
        return results;
    },

    /**
     * Save a search result to history in localStorage.
     */
    saveToHistory(query, results) {
        const history = TopicSearch.loadHistory();
        // Don't duplicate
        const existing = history.findIndex(h => h.query.toLowerCase() === query.toLowerCase());
        if (existing >= 0) history.splice(existing, 1);
        history.unshift({ query, resultCount: results.length, timestamp: Date.now() });
        if (history.length > TopicSearch.MAX_HISTORY) {
            history.length = TopicSearch.MAX_HISTORY;
        }
        localStorage.setItem(TopicSearch.STORAGE_KEY_HISTORY, JSON.stringify(history));
    },

    /**
     * Load search history from localStorage.
     */
    loadHistory() {
        try {
            return JSON.parse(localStorage.getItem(TopicSearch.STORAGE_KEY_HISTORY)) || [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Clear all search history.
     */
    clearHistory() {
        localStorage.removeItem(TopicSearch.STORAGE_KEY_HISTORY);
    },

    /**
     * Check if a search query matches an existing doctrine in the main data.
     */
    findMatchingDoctrine(query, doctrines) {
        const q = query.toLowerCase().trim();
        for (const doc of doctrines) {
            const name = doc.name.toLowerCase();
            const id = doc.id.toLowerCase();
            if (name.includes(q) || q.includes(name) || id.includes(q) || q.includes(id)) {
                return doc;
            }
        }
        return null;
    },

    /**
     * Get list of all available topic names for display.
     */
    getAvailableTopics() {
        return TopicSearch.topics.map(t => t.name);
    }
};
