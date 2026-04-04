/**
 * timeline.js — D3-powered subway-map timeline with denomination lanes,
 * event markers, zoom/pan, touch support, and click-to-detail.
 */

const ChurchTimeline = {
    svg: null,
    tooltip: null,
    zoom: null,
    _lastRenderKey: null,

    render(denominations, allItems, filters, doctrines, onSourceClick) {
        const container = document.getElementById('timeline-svg-container');
        if (!container) return;

        // Skip re-render if inputs haven't changed AND svg is still in the DOM
        const renderKey = JSON.stringify({ f: filters, d: denominations.length, i: allItems.length });
        const svgStillMounted = this.svg && this.svg.node() && document.contains(this.svg.node());
        if (this._lastRenderKey === renderKey && svgStillMounted) return;
        this._lastRenderKey = renderKey;

        container.innerHTML = '';

        const items = ChurchUtils.filterTimelineItems(allItems, filters, doctrines);

        const margin = { top: 40, right: 40, bottom: 40, left: 180 };
        const width = container.clientWidth || 1200;
        // On small screens, reduce left margin
        if (width < 600) margin.left = 100;
        const laneHeight = 50;
        const height = margin.top + margin.bottom + denominations.length * laneHeight + 60;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('role', 'img')
            .attr('aria-label', 'Interactive timeline of church history showing councils, events, and figures across denominations');

        let tooltip = d3.select(container).select('.timeline-tooltip');
        if (tooltip.empty()) {
            tooltip = d3.select(container)
                .append('div')
                .attr('class', 'timeline-tooltip')
                .attr('role', 'tooltip')
                .style('display', 'none');
        }

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const yearMin = filters.centuryStart || 0;
        const yearMax = (filters.centuryEnd || 2000) + 99;
        const xScale = d3.scaleLinear()
            .domain([yearMin, yearMax])
            .range([0, innerWidth]);

        const yScale = d3.scaleBand()
            .domain(denominations.map(d => d.id))
            .range([0, denominations.length * laneHeight])
            .padding(0.2);

        const xAxis = d3.axisTop(xScale)
            .tickFormat(d => d + ' AD')
            .ticks(Math.min(width < 600 ? 6 : 20, (yearMax - yearMin) / 100));

        g.append('g')
            .attr('class', 'x-axis')
            .call(xAxis)
            .selectAll('text')
            .style('fill', '#aaa')
            .style('font-size', width < 600 ? '9px' : '11px');

        g.selectAll('.x-axis line, .x-axis path')
            .style('stroke', 'rgba(255,255,255,0.15)');

        denominations.forEach(denom => {
            const y = yScale(denom.id) + yScale.bandwidth() / 2;

            g.append('line')
                .attr('x1', xScale(Math.max(denom.founded, yearMin)))
                .attr('x2', xScale(yearMax))
                .attr('y1', y)
                .attr('y2', y)
                .attr('stroke', denom.color)
                .attr('stroke-width', 3)
                .attr('stroke-opacity', 0.7);

            if (denom.parent) {
                const parentDenom = denominations.find(d => d.id === denom.parent);
                if (parentDenom) {
                    const parentY = yScale(parentDenom.id) + yScale.bandwidth() / 2;
                    const branchX = xScale(denom.founded);

                    g.append('path')
                        .attr('d', `M${branchX},${parentY} C${branchX + 20},${parentY} ${branchX - 20},${y} ${branchX},${y}`)
                        .attr('fill', 'none')
                        .attr('stroke', denom.color)
                        .attr('stroke-width', 2)
                        .attr('stroke-opacity', 0.5)
                        .attr('stroke-dasharray', '4,3');
                }
            }

            g.append('text')
                .attr('x', -10)
                .attr('y', y)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'end')
                .attr('fill', denom.color)
                .attr('font-size', width < 600 ? '10px' : '12px')
                .attr('font-weight', '600')
                .text(width < 600 ? denom.name.split(' ')[0] : denom.name);
        });

        const markerColors = {
            council: '#ffb74d',
            event: '#8ab4f8',
            figure: '#81c784'
        };

        const markerShapes = {
            council: d3.symbolDiamond,
            event: d3.symbolCircle,
            figure: d3.symbolTriangle
        };

        items.forEach(item => {
            const x = xScale(item.year);
            if (x < 0 || x > innerWidth) return;

            let y;
            if (item.type === 'figure') {
                const denom = denominations.find(d => d.id === item.denominationId);
                y = denom ? yScale(denom.id) + yScale.bandwidth() / 2 : innerHeight - 20;
            } else if (item.denominationsInvolved && item.denominationsInvolved.length > 0) {
                const ys = item.denominationsInvolved
                    .map(id => denominations.find(d => d.id === id))
                    .filter(Boolean)
                    .map(d => yScale(d.id) + yScale.bandwidth() / 2);
                y = ys.length > 0 ? d3.mean(ys) : innerHeight - 20;
            } else {
                y = innerHeight - 20;
            }

            const marker = g.append('g')
                .attr('class', 'timeline-marker')
                .attr('transform', `translate(${x},${y})`)
                .attr('tabindex', '0')
                .attr('role', 'button')
                .attr('aria-label', `${item.name}, ${ChurchUtils.formatYear(item.year)}`);

            marker.append('path')
                .attr('d', d3.symbol().type(markerShapes[item.type] || d3.symbolCircle).size(120)())
                .attr('fill', markerColors[item.type] || '#fff');

            const showTooltip = (event) => {
                const rect = container.getBoundingClientRect();
                const clientX = event.touches ? event.touches[0].clientX : event.clientX;
                const clientY = event.touches ? event.touches[0].clientY : event.clientY;
                tooltip
                    .style('display', 'block')
                    .style('left', (clientX - rect.left + 10) + 'px')
                    .style('top', (clientY - rect.top - 10) + 'px')
                    .html(`
                        <h4>${item.name}</h4>
                        <div class="tooltip-year">${ChurchUtils.formatYear(item.year)}</div>
                        <p style="margin-top:6px;font-size:0.82rem;color:#bbb;">${item.description || ''}</p>
                    `);
            };

            const hideTooltip = () => {
                tooltip.style('display', 'none');
            };

            marker.on('mouseenter', showTooltip);
            marker.on('mouseleave', hideTooltip);
            // Touch support
            marker.on('touchstart', (event) => {
                event.preventDefault();
                showTooltip(event);
            });
            marker.on('touchend', hideTooltip);
            // Keyboard support
            marker.on('focus', showTooltip);
            marker.on('blur', hideTooltip);

            marker.on('click', () => {
                if (item.sources && item.sources.length > 0) {
                    onSourceClick(item.sources[0]);
                }
            });

            marker.on('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (item.sources && item.sources.length > 0) {
                        onSourceClick(item.sources[0]);
                    }
                }
            });
        });

        const legend = g.append('g')
            .attr('transform', `translate(0, ${innerHeight - 10})`);

        const legendItems = [
            { type: 'council', label: 'Council' },
            { type: 'event', label: 'Event' },
            { type: 'figure', label: 'Figure' }
        ];

        legendItems.forEach((li, i) => {
            const lx = i * 100;
            legend.append('path')
                .attr('transform', `translate(${lx}, 0)`)
                .attr('d', d3.symbol().type(markerShapes[li.type]).size(80)())
                .attr('fill', markerColors[li.type]);
            legend.append('text')
                .attr('x', lx + 12)
                .attr('y', 4)
                .attr('fill', '#aaa')
                .attr('font-size', '11px')
                .text(li.label);
        });

        const zoomBehavior = d3.zoom()
            .scaleExtent([0.5, 10])
            .translateExtent([[-margin.left, -margin.top], [width + 200, height + 200]])
            .on('zoom', (event) => {
                g.attr('transform', `translate(${event.transform.x + margin.left},${event.transform.y + margin.top}) scale(${event.transform.k})`);
            });

        svg.call(zoomBehavior);
        // Enable touch gestures for zoom
        svg.on('touchstart.zoom', null);
        svg.call(zoomBehavior.touchable(true));

        this.svg = svg;
        this.tooltip = tooltip;
    }
};
