/**
 * doctrine-browser.js — Doctrine detail view with mini-timeline
 */

const DoctrineBrowser = {
    renderMiniTimeline(doctrine, denominations) {
        const containerId = `mini-timeline-${doctrine.id}`;
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        const margin = { top: 20, right: 20, bottom: 30, left: 140 };
        const width = container.clientWidth || 800;
        const barHeight = 20;
        const height = margin.top + margin.bottom + doctrine.positions.length * (barHeight + 8);

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const innerWidth = width - margin.left - margin.right;

        const years = doctrine.positions.map(p => p.since).filter(y => y > 0);
        const formalYears = doctrine.positions.map(p => p.formallyDefined).filter(Boolean);
        const allYears = [...years, ...formalYears];
        const minYear = Math.min(...allYears, 33);
        const maxYear = Math.max(...allYears, 2026);

        const xScale = d3.scaleLinear()
            .domain([minYear, maxYear])
            .range([0, innerWidth]);

        g.append('g')
            .attr('transform', `translate(0, ${doctrine.positions.length * (barHeight + 8)})`)
            .call(d3.axisBottom(xScale).tickFormat(d => d + ' AD').ticks(8))
            .selectAll('text')
            .style('fill', '#aaa')
            .style('font-size', '10px');

        g.selectAll('.domain, line').style('stroke', 'rgba(255,255,255,0.15)');

        doctrine.positions.forEach((pos, i) => {
            const denom = denominations.find(d => d.id === pos.denominationId);
            if (!denom) return;

            const y = i * (barHeight + 8);
            const xStart = xScale(pos.since);
            const xEnd = xScale(maxYear);

            g.append('rect')
                .attr('x', xStart)
                .attr('y', y)
                .attr('width', Math.max(0, xEnd - xStart))
                .attr('height', barHeight)
                .attr('fill', denom.color)
                .attr('opacity', 0.5)
                .attr('rx', 3);

            if (pos.formallyDefined) {
                const xFormal = xScale(pos.formallyDefined);
                g.append('line')
                    .attr('x1', xFormal)
                    .attr('x2', xFormal)
                    .attr('y1', y)
                    .attr('y2', y + barHeight)
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 2);
            }

            const scoreColor = pos.continuityScore === 1.0 ? '#2e7d32'
                : pos.continuityScore === 0.5 ? '#f9a825'
                : '#c62828';

            g.append('circle')
                .attr('cx', xStart + 8)
                .attr('cy', y + barHeight / 2)
                .attr('r', 5)
                .attr('fill', scoreColor);

            g.append('text')
                .attr('x', -6)
                .attr('y', y + barHeight / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .attr('fill', denom.color)
                .attr('font-size', '11px')
                .text(denom.name);
        });
    }
};
