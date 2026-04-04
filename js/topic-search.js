/**
 * topic-search.js — Local keyword-based topic search with fuzzy matching
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
     * Simple Levenshtein distance for fuzzy matching
     */
    _levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    },

    /**
     * Search topics by keyword matching with fuzzy support.
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

            // Fuzzy matching on topic name and keywords (for typos)
            if (score === 0) {
                const nameDist = TopicSearch._levenshtein(q, topic.name.toLowerCase());
                if (nameDist <= 2 && q.length >= 3) {
                    score += Math.max(1, 6 - nameDist * 2);
                }
                for (const kw of topic.keywords) {
                    const kwDist = TopicSearch._levenshtein(q, kw);
                    if (kwDist <= 2 && q.length >= 3) {
                        score += Math.max(1, 4 - kwDist * 2);
                    }
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
     * Get topic suggestions when search returns no results.
     * Returns up to 5 closest matching topic names.
     */
    getSuggestions(query) {
        const q = query.toLowerCase().trim();
        if (!q || q.length < 2) return [];

        const scored = TopicSearch.topics.map(topic => {
            let minDist = TopicSearch._levenshtein(q, topic.name.toLowerCase());
            // Also check against keywords
            for (const kw of topic.keywords) {
                const d = TopicSearch._levenshtein(q, kw);
                if (d < minDist) minDist = d;
            }
            // Bonus for substring containment
            if (topic.name.toLowerCase().includes(q) || q.includes(topic.name.toLowerCase())) {
                minDist = 0;
            }
            return { name: topic.name, dist: minDist };
        });

        scored.sort((a, b) => a.dist - b.dist);
        return scored.slice(0, 5).filter(s => s.dist <= 5).map(s => s.name);
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
