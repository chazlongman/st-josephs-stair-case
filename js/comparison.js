/**
 * comparison.js — Continuity bar chart and doctrine-denomination heatmap
 */

const ChurchComparison = {
    renderContinuityChart(denominations, doctrines) {
        const container = document.getElementById('continuity-chart');
        if (!container) return;

        container.innerHTML = '';

        const margin = { top: 10, right: 60, bottom: 20, left: 180 };
        const barHeight = 32;
        const height = margin.top + margin.bottom + denominations.length * (barHeight + 6);
        const width = container.clientWidth || 800;
        const innerWidth = width - margin.left - margin.right;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const data = denominations.map(d => ({
            ...d,
            ...ChurchUtils.calcContinuity(doctrines, d.id)
        }));

        data.sort((a, b) => b.percent - a.percent);

        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, innerWidth]);

        data.forEach((d, i) => {
            const y = i * (barHeight + 6);

            g.append('rect')
                .attr('x', 0)
                .attr('y', y)
                .attr('width', innerWidth)
                .attr('height', barHeight)
                .attr('fill', 'rgba(255,255,255,0.04)')
                .attr('rx', 4);

            g.append('rect')
                .attr('x', 0)
                .attr('y', y)
                .attr('width', xScale(d.percent))
                .attr('height', barHeight)
                .attr('fill', d.color)
                .attr('opacity', 0.7)
                .attr('rx', 4);

            g.append('text')
                .attr('x', -8)
                .attr('y', y + barHeight / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .attr('fill', d.color)
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .text(d.name);

            g.append('text')
                .attr('x', xScale(d.percent) + 8)
                .attr('y', y + barHeight / 2)
                .attr('dy', '0.35em')
                .attr('fill', '#e0e0e0')
                .attr('font-size', '13px')
                .attr('font-weight', '700')
                .text(`${d.percent}%`);
        });
    },

    renderHeatmap(denominations, doctrines) {
        const container = document.getElementById('heatmap-chart');
        if (!container) return;

        container.innerHTML = '';

        const margin = { top: 120, right: 20, bottom: 20, left: 220 };
        const cellSize = 36;
        const width = margin.left + margin.right + denominations.length * cellSize;
        const height = margin.top + margin.bottom + doctrines.length * cellSize;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const scoreColor = (score) => {
            if (score === 1.0) return '#2e7d32';
            if (score === 0.5) return '#f9a825';
            if (score === 0.0) return '#c62828';
            return '#333';
        };

        denominations.forEach((denom, j) => {
            g.append('text')
                .attr('x', j * cellSize + cellSize / 2)
                .attr('y', -8)
                .attr('text-anchor', 'start')
                .attr('transform', `rotate(-55, ${j * cellSize + cellSize / 2}, -8)`)
                .attr('fill', denom.color)
                .attr('font-size', '10px')
                .attr('font-weight', '600')
                .text(denom.name);
        });

        doctrines.forEach((doc, i) => {
            const y = i * cellSize;

            g.append('text')
                .attr('x', -8)
                .attr('y', y + cellSize / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .attr('fill', '#ccc')
                .attr('font-size', '11px')
                .text(doc.name);

            denominations.forEach((denom, j) => {
                const pos = doc.positions.find(p => p.denominationId === denom.id);
                const score = pos ? pos.continuityScore : null;

                g.append('rect')
                    .attr('x', j * cellSize + 1)
                    .attr('y', y + 1)
                    .attr('width', cellSize - 2)
                    .attr('height', cellSize - 2)
                    .attr('rx', 4)
                    .attr('fill', score !== null ? scoreColor(score) : '#222')
                    .attr('opacity', score !== null ? 0.8 : 0.3);

                if (score !== null) {
                    g.append('text')
                        .attr('x', j * cellSize + cellSize / 2)
                        .attr('y', y + cellSize / 2)
                        .attr('dy', '0.35em')
                        .attr('text-anchor', 'middle')
                        .attr('fill', '#fff')
                        .attr('font-size', '10px')
                        .attr('font-weight', '700')
                        .text(score.toFixed(1));
                }
            });
        });
    }
};
