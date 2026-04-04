/**
 * utils.js — Shared helpers for data loading, scoring, and formatting
 */

const ChurchUtils = {
    async loadAllData() {
        const files = [
            'data/denominations.json',
            'data/doctrines.json',
            'data/councils.json',
            'data/events.json',
            'data/figures.json',
            'data/bible-refs.json'
        ];

        const [denominations, doctrines, councils, events, figures, bibleRefs] = await Promise.all(
            files.map(f => fetch(f).then(r => {
                if (!r.ok) throw new Error(`Failed to load ${f}: ${r.status}`);
                return r.json();
            }))
        );

        return { denominations, doctrines, councils, events, figures, bibleRefs };
    },

    calcContinuity(doctrines, denomId) {
        let total = 0;
        let scoreSum = 0;
        let consistent = 0;
        let modified = 0;
        let rejected = 0;

        for (const doc of doctrines) {
            const pos = doc.positions.find(p => p.denominationId === denomId);
            if (!pos || pos.continuityScore === undefined) continue;
            total++;
            scoreSum += pos.continuityScore;
            if (pos.continuityScore === 1.0) consistent++;
            else if (pos.continuityScore === 0.5) modified++;
            else rejected++;
        }

        return {
            percent: total > 0 ? Math.round((scoreSum / total) * 100) : 0,
            consistent,
            modified,
            rejected,
            total
        };
    },

    formatYear(year) {
        if (year < 0) return `${Math.abs(year)} BC`;
        if (year === 0) return '1 AD';
        return `${year} AD`;
    },

    getCategories(doctrines) {
        const cats = new Set();
        for (const doc of doctrines) {
            if (doc.category) cats.add(doc.category);
        }
        return Array.from(cats).sort();
    },

    getCenturies() {
        const centuries = [];
        for (let c = 0; c <= 2000; c += 100) {
            centuries.push(c);
        }
        return centuries;
    },

    buildDenomTree(denominations) {
        const map = {};
        const roots = [];

        for (const d of denominations) {
            map[d.id] = { ...d, children: [] };
        }

        for (const d of denominations) {
            if (d.parent && map[d.parent]) {
                map[d.parent].children.push(map[d.id]);
            } else {
                roots.push(map[d.id]);
            }
        }

        return roots;
    },

    buildTimelineItems(councils, events, figures) {
        const items = [];

        for (const c of councils) {
            items.push({ ...c, type: 'council' });
        }
        for (const e of events) {
            items.push({ ...e, type: 'event' });
        }
        for (const f of figures) {
            items.push({
                ...f,
                type: 'figure',
                year: f.born > 0 ? f.born : f.died,
                description: `${f.role} (${ChurchUtils.formatYear(f.born)} – ${ChurchUtils.formatYear(f.died)})`
            });
        }

        items.sort((a, b) => a.year - b.year);
        return items;
    },

    filterTimelineItems(items, filters, doctrines) {
        return items.filter(item => {
            if (filters.centuryStart !== undefined && item.year < filters.centuryStart) return false;
            if (filters.centuryEnd !== undefined && item.year > filters.centuryEnd + 99) return false;

            if (filters.denomination) {
                const denomMatch =
                    (item.denominationId === filters.denomination) ||
                    (item.denominationsInvolved && item.denominationsInvolved.includes(filters.denomination));
                if (!denomMatch) return false;
            }

            if (filters.category) {
                const affectedIds = item.doctrinesAffected || item.doctrinesInfluenced || [];
                const matchesCategory = affectedIds.some(docId => {
                    const doc = doctrines.find(d => d.id === docId);
                    return doc && doc.category === filters.category;
                });
                if (!matchesCategory && affectedIds.length > 0) return false;
            }

            return true;
        });
    }
};
