/**
 * CalendarHeatmap Component
 * =========================
 * NOTE: This component was removed from the main analytics page display in Dec 2024.
 * The component is kept here in case we want to re-enable it in the future.
 * To re-enable: import and use in ActivitySection.jsx
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { format, getDay, getDaysInYear, startOfYear, addDays } from 'date-fns';
import { formatName } from '../utils/formatters';
import { COLORS, STYLES } from '../design';
import { SectionHeader, ModeToggle, DataLabel } from './ui';

// Color function - Swiss Brutalist: high contrast, no soft transitions
// Uses shades derived from canonical accent color (COLORS.accent = #D95218)
// These are tints of the accent - lighter versions for lower values
const HEAT_COLORS = {
    empty: COLORS.neutral[100],    // #F5F5F5
    veryLight: '#F5DDD3',          // Tint of accent (10%)
    light: '#E8B49E',              // Tint of accent (30%)
    medium: '#D4836A',             // Tint of accent (60%)
    strong: COLORS.accent,         // Full accent
};

const getHeatColor = (value, maxValue) => {
    if (value === 0) return HEAT_COLORS.empty;
    if (maxValue === 0) return HEAT_COLORS.empty;
    
    // Use logarithmic ratio for better distribution
    const logValue = Math.log10(value + 1);
    const logMax = Math.log10(maxValue + 1);
    const ratio = logValue / logMax;
    
    if (ratio < 0.2) return HEAT_COLORS.veryLight;
    if (ratio < 0.4) return HEAT_COLORS.light;
    if (ratio < 0.6) return HEAT_COLORS.medium;
    return HEAT_COLORS.strong;
};


export default function CalendarHeatmap({ messages, aggregates, isFiltered = false }) {
    const [dataMode, setDataMode] = useState('messages'); // 'messages' or 'media'
    const [hoveredCell, setHoveredCell] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);

    // Process data into year-stacked format - use precomputed aggregates when available
    const { years, dailyData, maxValue, mediaData, maxMediaValue, yearStats, goldenYear, topSenders } = useMemo(() => {
        // Use precomputed daily aggregates (they are properly filtered by filterAggregates)
        if (aggregates?.daily && Object.keys(aggregates.daily).length > 0) {
            const daily = aggregates.daily;
            
            // Extract years from daily keys
            const yearSet = new Set();
            Object.keys(daily).forEach(dateKey => {
                yearSet.add(parseInt(dateKey.split('-')[0]));
            });
            const yearsArray = Array.from(yearSet).sort((a, b) => b - a);
            
            // Build dailyCounts, mediaCounts, topSendersMap from aggregates
            const dailyCounts = {};
            const mediaCounts = {};
            const topSendersMap = {};
            const yearStatsObj = {};
            
            // Initialize year stats
            yearsArray.forEach(y => {
                yearStatsObj[y] = { total: 0, days: 0, peak: 0, peakDate: null };
            });
            
            Object.entries(daily).forEach(([dateKey, d]) => {
                dailyCounts[dateKey] = d.messages;
                if (d.media > 0) {
                    mediaCounts[dateKey] = d.media;
                }
                topSendersMap[dateKey] = d.top_sender || '—';
                
                const year = parseInt(dateKey.split('-')[0]);
                if (yearStatsObj[year]) {
                    yearStatsObj[year].total += d.messages;
                    yearStatsObj[year].days++;
                    if (d.messages > yearStatsObj[year].peak) {
                        yearStatsObj[year].peak = d.messages;
                        yearStatsObj[year].peakDate = dateKey;
                    }
                }
            });
            
            // Calculate max values
            let maxVal = 1;
            Object.values(dailyCounts).forEach(v => { if (v > maxVal) maxVal = v; });
            let maxMediaVal = 1;
            Object.values(mediaCounts).forEach(v => { if (v > maxMediaVal) maxMediaVal = v; });
            
            // Find golden year
            const golden = yearsArray.reduce((best, year) => {
                if (!yearStatsObj[year]) return best;
                if (!best || yearStatsObj[year].total > yearStatsObj[best].total) return year;
                return best;
            }, null);
            
            return {
                years: yearsArray,
                dailyData: dailyCounts,
                maxValue: maxVal,
                mediaData: mediaCounts,
                maxMediaValue: maxMediaVal,
                yearStats: yearStatsObj,
                goldenYear: golden,
                topSenders: topSendersMap
            };
        }
        
        // Fallback: compute from messages if no aggregates
        if (!messages || messages.length === 0) {
            return { years: [], dailyData: {}, maxValue: 0, mediaData: {}, maxMediaValue: 0, yearStats: {}, goldenYear: null, topSenders: {} };
        }

        // Get date range from messages
        let minTimestamp = Infinity;
        let maxTimestamp = -Infinity;
        messages.forEach(m => {
            if (m.timestamp_ms < minTimestamp) minTimestamp = m.timestamp_ms;
            if (m.timestamp_ms > maxTimestamp) maxTimestamp = m.timestamp_ms;
        });
        const minDate = new Date(minTimestamp);
        const maxDate = new Date(maxTimestamp);
        
        const startYear = minDate.getFullYear();
        const endYear = maxDate.getFullYear();
        
        // Create array of years (newest first for display)
        const yearsArray = [];
        for (let y = endYear; y >= startYear; y--) {
            yearsArray.push(y);
        }

        // Count messages per day and track sender counts per day
        const dailyCounts = {};
        const mediaCounts = {};
        const yearStatsObj = {};
        const dailySenderCounts = {}; // { dateKey: { senderName: count } }
        
        // Initialize year stats
        yearsArray.forEach(y => {
            yearStatsObj[y] = { total: 0, days: 0, peak: 0, peakDate: null };
        });

        messages.forEach(msg => {
            const date = new Date(msg.timestamp_ms);
            const dateKey = format(date, 'yyyy-MM-dd');
            const year = date.getFullYear();
            
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
            
            // Track sender counts per day
            if (!dailySenderCounts[dateKey]) {
                dailySenderCounts[dateKey] = {};
            }
            dailySenderCounts[dateKey][msg.sender_name] = (dailySenderCounts[dateKey][msg.sender_name] || 0) + 1;
            
            const mediaCount = (msg.photos?.length || 0) + (msg.videos?.length || 0);
            if (mediaCount > 0) {
                mediaCounts[dateKey] = (mediaCounts[dateKey] || 0) + mediaCount;
            }
            
            if (yearStatsObj[year]) {
                yearStatsObj[year].total++;
            }
        });

        // Calculate year stats
        Object.entries(dailyCounts).forEach(([dateKey, count]) => {
            const year = parseInt(dateKey.split('-')[0]);
            if (yearStatsObj[year]) {
                yearStatsObj[year].days++;
                if (count > yearStatsObj[year].peak) {
                    yearStatsObj[year].peak = count;
                    yearStatsObj[year].peakDate = dateKey;
                }
            }
        });

        // Precompute top sender for each day
        const topSendersMap = {};
        Object.entries(dailySenderCounts).forEach(([dateKey, senders]) => {
            let topSender = null;
            let maxCount = 0;
            Object.entries(senders).forEach(([sender, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    topSender = sender;
                }
            });
            topSendersMap[dateKey] = topSender ? formatName(topSender) : '—';
        });

        // Calculate max values safely
        let maxVal = 1;
        Object.values(dailyCounts).forEach(v => { if (v > maxVal) maxVal = v; });
        let maxMediaVal = 1;
        Object.values(mediaCounts).forEach(v => { if (v > maxMediaVal) maxMediaVal = v; });

        // Find golden year
        const golden = yearsArray.reduce((best, year) => {
            if (!yearStatsObj[year]) return best;
            if (!best || yearStatsObj[year].total > yearStatsObj[best].total) return year;
            return best;
        }, null);

        return { 
            years: yearsArray, 
            dailyData: dailyCounts, 
            maxValue: maxVal,
            mediaData: mediaCounts,
            maxMediaValue: maxMediaVal,
            yearStats: yearStatsObj,
            goldenYear: golden,
            topSenders: topSendersMap
        };
    }, [aggregates, messages]);

    // Reset selected year if it's no longer in the available years (due to filtering)
    useEffect(() => {
        if (selectedYear && years.length > 0 && !years.includes(selectedYear)) {
            setSelectedYear(null);
        }
    }, [years, selectedYear]);

    // Set default selected year to most recent (or golden year)
    const activeYear = selectedYear || years[0];

    // Get data for display based on mode
    const displayData = dataMode === 'messages' ? dailyData : mediaData;
    const displayMax = dataMode === 'messages' ? maxValue : maxMediaValue;

    // SVG dimensions for single year view - FLUSH GRID (no gaps)
    const cellSize = 12;
    const cellGap = 0;  // Swiss Brutalist: flush grid creates solid texture
    const monthLabelHeight = 20;
    const dayLabelWidth = 16;
    const weekWidth = cellSize + cellGap;
    const totalWeeks = 53;
    const gridWidth = totalWeeks * weekWidth;
    const yearHeight = 7 * (cellSize + cellGap);
    const totalHeight = monthLabelHeight + yearHeight + 4;
    const totalWidth = dayLabelWidth + gridWidth;

    // Month label positions
    const monthPositions = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const positions = [];
        let weekOffset = 0;
        for (let m = 0; m < 12; m++) {
            positions.push({ month: months[m], x: dayLabelWidth + weekOffset * weekWidth });
            const weeksInMonth = m === 1 ? 4 : [3, 5, 7, 8, 10].includes(m) ? 4.5 : 4.3;
            weekOffset += weeksInMonth;
        }
        return positions;
    }, [dayLabelWidth, weekWidth]);

    // Generate grid cells for selected year with precomputed hover data
    const yearCells = useMemo(() => {
        if (!activeYear) return [];
        
        const cells = [];
        const yearStart = startOfYear(new Date(activeYear, 0, 1));
        const daysInYear = getDaysInYear(new Date(activeYear, 0, 1));
        const startDayOfWeek = getDay(yearStart);
        
        for (let dayOffset = 0; dayOffset < daysInYear; dayOffset++) {
            const currentDate = addDays(yearStart, dayOffset);
            const dateKey = format(currentDate, 'yyyy-MM-dd');
            const dayOfWeek = getDay(currentDate);
            const weekNumber = Math.floor((dayOffset + startDayOfWeek) / 7);
            
            const value = displayData[dateKey] || 0;
            
            cells.push({
                x: dayLabelWidth + weekNumber * weekWidth,
                y: monthLabelHeight + dayOfWeek * (cellSize + cellGap),
                dateKey,
                value,
                // Precompute hover data
                formattedDate: dateKey,
                dayName: format(currentDate, 'EEEE'),
                topSender: topSenders[dateKey] || '—',
            });
        }
        
        return cells;
    }, [activeYear, displayData, topSenders, dayLabelWidth, weekWidth, cellSize, cellGap, monthLabelHeight]);

    // Handle cell hover - now instant since data is precomputed
    const handleCellHover = useCallback((cell) => {
        setHoveredCell(cell);
    }, []);

    if (years.length === 0) {
        return null;
    }

    // Stats for selected year
    const currentYearStats = yearStats[activeYear] || { total: 0, days: 0, peak: 0 };

    // Legend colors - derived from HEAT_COLORS
    const legendColorsSwiss = [HEAT_COLORS.empty, HEAT_COLORS.veryLight, HEAT_COLORS.light, HEAT_COLORS.medium, HEAT_COLORS.strong];

    return (
        <div className="mt-8">
            {/* Header with title, subtitle, then insight */}
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
                        Activity Calendar
                    </h3>
                    <p className="font-mono text-[12px] text-neutral-500">
                        Daily activity heatmap · Select year to explore
                    </p>
                    <div className="mt-3 text-lg lg:text-xl font-semibold tracking-tight text-neutral-900">
                        {activeYear}: <span className="text-accent">{currentYearStats.total.toLocaleString()}</span>
                        <span className="text-neutral-400 text-sm ml-2 font-normal">msgs</span>
                    </div>
                </div>
                <div className="flex gap-0.5">
                    <button
                        onClick={() => setDataMode('messages')}
                        className={`px-2 py-1 font-mono text-[12px] uppercase tracking-widest ${
                            dataMode === 'messages'
                                ? 'bg-black text-white'
                                : 'text-neutral-400 hover:text-black'
                        }`}
                    >
                        Messages
                    </button>
                    <button
                        onClick={() => setDataMode('media')}
                        className={`px-2 py-1 font-mono text-[12px] uppercase tracking-widest ${
                            dataMode === 'media'
                                ? 'bg-black text-white'
                                : 'text-neutral-400 hover:text-black'
                        }`}
                    >
                        Media
                    </button>
                </div>
            </div>

            {/* Year Selector - Swiss minimal */}
            <div className="flex flex-wrap gap-0.5 mb-4">
                {years.map((year) => {
                    const isActive = year === activeYear;
                    const isGolden = year === goldenYear;
                    return (
                        <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-2 py-1 font-mono text-[12px] font-medium ${
                                isActive
                                    ? 'bg-black text-white'
                                    : isGolden
                                        ? 'text-accent hover:bg-black hover:text-white'
                                        : 'text-neutral-400 hover:text-black'
                            }`}
                        >
                            {year}
                        </button>
                    );
                })}
            </div>

            {/* Data HUD Status Bar - Spacing separation */}
            <div className="mb-6 py-2 font-mono text-[12px] tracking-wider min-h-[28px]">
                {hoveredCell ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-600">
                        <span className="text-neutral-900 font-medium">{hoveredCell.formattedDate}</span>
                        <span className="text-neutral-300">/</span>
                        <span className="text-accent font-medium">
                            {hoveredCell.value} {dataMode === 'messages' ? 'MSGS' : 'MEDIA'}
                        </span>
                        <span className="text-neutral-300 hidden sm:inline">/</span>
                        <span className="hidden md:inline text-neutral-500">{hoveredCell.topSender}</span>
                    </div>
                ) : (
                    <div className="text-neutral-400">
                        {activeYear} // {currentYearStats.days} ACTIVE DAYS // PEAK: {currentYearStats.peak}
                    </div>
                )}
            </div>

            {/* Legend - flush squares */}
            <div className="flex flex-wrap items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[8px] uppercase tracking-widest text-neutral-400">0</span>
                    <div className="flex gap-0">
                        {legendColorsSwiss.map((color, idx) => (
                            <div
                                key={idx}
                                className="w-[10px] h-[10px]"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <span className="font-mono text-[8px] uppercase tracking-widest text-neutral-400">MAX</span>
                </div>
            </div>

            {/* Single Year SVG Calendar Grid - FLUSH GRID */}
            <div className="w-full overflow-x-auto">
                <svg 
                    viewBox={`0 0 ${totalWidth} ${totalHeight}`}
                    className="w-full h-auto min-w-[600px]"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Month labels - minimal */}
                    {monthPositions.map((pos, idx) => (
                        <text
                            key={idx}
                            x={pos.x}
                            y={12}
                            className="font-mono"
                            fontSize="8"
                            fill={COLORS.text.muted}
                            textAnchor="start"
                        >
                            {pos.month.slice(0, 1)}
                        </text>
                    ))}

                    {/* Day of week labels - only Mon/Wed/Fri */}
                    {['', 'M', '', 'W', '', 'F', ''].map((day, idx) => (
                        day && (
                            <text
                                key={idx}
                                x={dayLabelWidth - 3}
                                y={monthLabelHeight + idx * (cellSize + cellGap) + cellSize / 2 + 3}
                                fontSize="7"
                                fill={COLORS.text.muted}
                                textAnchor="end"
                                className="font-mono"
                            >
                                {day}
                            </text>
                        )
                    ))}

                    {/* Day cells */}
                    {yearCells.map((cell, idx) => (
                        <rect
                            key={idx}
                            x={cell.x}
                            y={cell.y}
                            width={cellSize}
                            height={cellSize}
                            fill={getHeatColor(cell.value, displayMax)}
                            className="cursor-crosshair"
                            onMouseEnter={() => handleCellHover(cell)}
                            onMouseLeave={() => handleCellHover(null)}
                        />
                    ))}
                    
                    {/* Highlight hovered cell */}
                    {hoveredCell && (
                        <rect
                            x={hoveredCell.x}
                            y={hoveredCell.y}
                            width={cellSize}
                            height={cellSize}
                            fill="none"
                            stroke={COLORS.text.primary}
                            strokeWidth={1.5}
                            pointerEvents="none"
                        />
                    )}
                </svg>
            </div>
        </div>
    );
}
