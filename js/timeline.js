/**
 * timeline.js — D3-powered subway-map timeline with denomination lanes,
 * event markers, zoom/pan, touch support, and click-to-detail.
 */

const ChurchTimeline = {
    svg: null,
    tooltip: null,
    zoom: null,
    _lastRenderKey: null,
    _activeMarker: null,

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

        // Detect mobile (use viewport width, not container, since container may be constrained)
        const isMobile = window.innerWidth < 700;

        const margin = { top: 70, right: 40, bottom: 20, left: 180 };
        // On mobile, force a wider canvas so the timeline is actually scrollable horizontally
        // and shows meaningful detail. Native scroll on the container handles panning.
        let width;
        if (isMobile) {
            margin.left = 110;
            margin.right = 30;
            width = 1100; // fixed wider canvas for mobile horizontal scroll
        } else {
            width = container.clientWidth || 1200;
        }
        const laneHeight = 50;
        const councilLaneHeight = 56;
        const height = margin.top + margin.bottom + councilLaneHeight + denominations.length * laneHeight + 20;

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

        // Council lane sits at the top, denomination lanes start below it
        const councilLaneY = 0;
        const councilLaneCenter = councilLaneY + councilLaneHeight / 2;
        const denomLanesStart = councilLaneHeight + 8;

        const yScale = d3.scaleBand()
            .domain(denominations.map(d => d.id))
            .range([denomLanesStart, denomLanesStart + denominations.length * laneHeight])
            .padding(0.2);

        const xAxis = d3.axisTop(xScale)
            .tickFormat(d => d + ' AD')
            .ticks(Math.min(isMobile ? 10 : 20, (yearMax - yearMin) / 100));

        g.append('g')
            .attr('class', 'x-axis')
            .call(xAxis)
            .selectAll('text')
            .style('fill', '#c9a961')
            .style('font-size', isMobile ? '10px' : '11px');

        g.selectAll('.x-axis line, .x-axis path')
            .style('stroke', 'rgba(255,255,255,0.15)');

        // --- Council Lane (dedicated row at top) ---
        g.append('rect')
            .attr('x', 0)
            .attr('y', councilLaneY)
            .attr('width', innerWidth)
            .attr('height', councilLaneHeight)
            .attr('fill', 'rgba(201, 169, 97, 0.06)')
            .attr('stroke', 'rgba(201, 169, 97, 0.25)')
            .attr('stroke-width', 1)
            .attr('rx', 2);

        // Council lane label
        g.append('text')
            .attr('x', -10)
            .attr('y', councilLaneCenter)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .attr('fill', '#c9a961')
            .attr('font-size', isMobile ? '11px' : '12px')
            .attr('font-weight', '700')
            .attr('letter-spacing', '0.05em')
            .text(isMobile ? 'COUNCILS' : 'ECUMENICAL COUNCILS');

        // Subtle horizontal guide line through council lane center
        g.append('line')
            .attr('x1', 0)
            .attr('x2', innerWidth)
            .attr('y1', councilLaneCenter)
            .attr('y2', councilLaneCenter)
            .attr('stroke', 'rgba(201, 169, 97, 0.2)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,4');

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
                .attr('font-size', isMobile ? '11px' : '12px')
                .attr('font-weight', '600')
                .text(isMobile ? denom.name.split(' ')[0] : denom.name);
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
            if (item.type === 'council') {
                // All councils sit on the dedicated council lane at the top
                y = councilLaneCenter;
            } else if (item.type === 'figure') {
                const denom = denominations.find(d => d.id === item.denominationId);
                y = denom ? yScale(denom.id) + yScale.bandwidth() / 2 : denomLanesStart + 20;
            } else if (item.denominationsInvolved && item.denominationsInvolved.length > 0) {
                const ys = item.denominationsInvolved
                    .map(id => denominations.find(d => d.id === id))
                    .filter(Boolean)
                    .map(d => yScale(d.id) + yScale.bandwidth() / 2);
                y = ys.length > 0 ? d3.mean(ys) : denomLanesStart + 20;
            } else {
                y = denomLanesStart + 20;
            }

            const marker = g.append('g')
                .attr('class', 'timeline-marker timeline-marker-' + item.type)
                .attr('transform', `translate(${x},${y})`)
                .attr('tabindex', '0')
                .attr('role', 'button')
                .attr('aria-label', `${item.name}, ${ChurchUtils.formatYear(item.year)}`);

            // Councils get larger markers + a glow ring + a year label
            if (item.type === 'council') {
                // Glow ring
                marker.append('circle')
                    .attr('r', 14)
                    .attr('fill', 'none')
                    .attr('stroke', markerColors.council)
                    .attr('stroke-width', 1)
                    .attr('opacity', 0.3);
                marker.append('path')
                    .attr('d', d3.symbol().type(d3.symbolDiamond).size(220)())
                    .attr('fill', markerColors.council)
                    .attr('stroke', '#1a1207')
                    .attr('stroke-width', 1.5);
                // Year label below council marker
                marker.append('text')
                    .attr('y', 22)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#c9a961')
                    .attr('font-size', isMobile ? '9px' : '10px')
                    .attr('font-weight', '600')
                    .text(item.year);
            } else {
                marker.append('path')
                    .attr('d', d3.symbol().type(markerShapes[item.type] || d3.symbolCircle).size(120)())
                    .attr('fill', markerColors[item.type] || '#fff')
                    .attr('stroke', '#1a1207')
                    .attr('stroke-width', 1);
            }

            const showTooltip = (event) => {
                const rect = container.getBoundingClientRect();
                const markerRect = marker.node().getBoundingClientRect();
                // Position relative to marker so it's stable on tap
                const x = markerRect.left - rect.left + markerRect.width / 2;
                const y = markerRect.top - rect.top;
                const sourceLink = (item.sources && item.sources.length > 0)
                    ? `<div class="tooltip-action">Tap again for source</div>`
                    : '';
                tooltip
                    .style('display', 'block')
                    .style('left', Math.max(8, Math.min(x + 12, rect.width - 340)) + 'px')
                    .style('top', Math.max(8, y - 10) + 'px')
                    .html(`
                        <h4>${item.name}</h4>
                        <div class="tooltip-year">${ChurchUtils.formatYear(item.year)}</div>
                        <p style="margin-top:6px;font-size:0.82rem;color:#bbb;">${item.description || ''}</p>
                        ${sourceLink}
                    `);
            };

            const hideTooltip = () => {
                tooltip.style('display', 'none');
            };

            // Desktop hover
            marker.on('mouseenter', showTooltip);
            marker.on('mouseleave', () => {
                if (!isMobile) hideTooltip();
            });

            // Keyboard support
            marker.on('focus', showTooltip);
            marker.on('blur', hideTooltip);

            // Tap / click — show tooltip on first tap, open source on second tap
            // (only the same marker — tapping a different marker resets)
            marker.on('click', (event) => {
                event.stopPropagation();
                const isCurrentlyShown = ChurchTimeline._activeMarker === item.id;
                if (isMobile) {
                    if (isCurrentlyShown) {
                        // Second tap: open source if available
                        if (item.sources && item.sources.length > 0) {
                            onSourceClick(item.sources[0]);
                            hideTooltip();
                            ChurchTimeline._activeMarker = null;
                        }
                    } else {
                        // First tap: show tooltip
                        showTooltip(event);
                        ChurchTimeline._activeMarker = item.id;
                    }
                } else {
                    // Desktop: click goes straight to source
                    if (item.sources && item.sources.length > 0) {
                        onSourceClick(item.sources[0]);
                    }
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

        // Tap outside any marker (on the SVG background) dismisses the tooltip on mobile
        if (isMobile) {
            svg.on('click', () => {
                ChurchTimeline._activeMarker = null;
                tooltip.style('display', 'none');
            });
        }

        // Render legend as HTML OUTSIDE the scrolling container so it stays
        // visible at full width on mobile and can never be obscured by markers
        const timelineContainer = container.parentElement;
        const viewContainer = timelineContainer.parentElement;
        const existingLegend = viewContainer.querySelector('.timeline-legend-bar');
        if (existingLegend) existingLegend.remove();
        const legendBar = document.createElement('div');
        legendBar.className = 'timeline-legend-bar';
        legendBar.innerHTML = `
            <div class="legend-bar-title">Legend</div>
            <div class="legend-bar-items">
                <div class="legend-bar-item">
                    <svg width="16" height="16" viewBox="-8 -8 16 16"><path d="${d3.symbol().type(d3.symbolDiamond).size(120)()}" fill="#ffb74d" stroke="#1a1207" stroke-width="1"/></svg>
                    <span>Ecumenical Council</span>
                </div>
                <div class="legend-bar-item">
                    <svg width="16" height="16" viewBox="-8 -8 16 16"><path d="${d3.symbol().type(d3.symbolCircle).size(120)()}" fill="#8ab4f8" stroke="#1a1207" stroke-width="1"/></svg>
                    <span>Historical Event</span>
                </div>
                <div class="legend-bar-item">
                    <svg width="16" height="16" viewBox="-8 -8 16 16"><path d="${d3.symbol().type(d3.symbolTriangle).size(120)()}" fill="#81c784" stroke="#1a1207" stroke-width="1"/></svg>
                    <span>Church Figure</span>
                </div>
            </div>
        `;
        // Insert after timeline-container so it sits below the chart
        timelineContainer.insertAdjacentElement('afterend', legendBar);

        // On mobile, skip D3 zoom entirely so native horizontal scroll works.
        // Native scroll is more intuitive than D3's pan/zoom on touch devices.
        if (!isMobile) {
            const zoomBehavior = d3.zoom()
                .scaleExtent([0.5, 10])
                .translateExtent([[-margin.left, -margin.top], [width + 200, height + 200]])
                .on('zoom', (event) => {
                    g.attr('transform', `translate(${event.transform.x + margin.left},${event.transform.y + margin.top}) scale(${event.transform.k})`);
                });
            svg.call(zoomBehavior);
        }

        this.svg = svg;
        this.tooltip = tooltip;
    }
};
