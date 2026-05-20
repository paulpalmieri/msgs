import React, { useState, useMemo } from 'react';
import { 
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
    Tooltip, ResponsiveContainer, ReferenceDot, Cell
} from 'recharts';
import { formatName } from '../utils/formatters';
import { COLORS, CHART, STYLES, getChartTooltipStyle } from '../design';
import { SectionHeader, ModeToggle } from './ui';
import { useSortable, SortableHeader, TableHeader, TableCell, TableRow, TableFooter, TableFooterCell, formatValue } from './ui/DataTable';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Use shared axis color from design system
const AXIS_COLOR = CHART.axis.stroke;

// Use shared tooltip style from design system
const SWISS_TOOLTIP = getChartTooltipStyle();

// Metric configurations for the evolution chart (messages removed - shown in Activity section)
const METRIC_CONFIG = {
    engagement: { 
        label: 'Engagement', 
        color: COLORS.userPalette[7], // #6c5ce7 - purple from palette
        format: (v) => v.toFixed(2),
        formatFull: (v) => v.toFixed(2),
        description: 'Reactions received per message over time'
    },
    reactionsGiven: { 
        label: 'Reactions', 
        color: COLORS.userPalette[2], // #636E72 - gray from palette
        format: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toLocaleString(),
        formatFull: (v) => v.toLocaleString(),
        description: 'Total reactions given each year'
    },
    activeMembers: { 
        label: 'Members', 
        color: COLORS.userPalette[4], // #00b894 - green from palette
        format: (v) => v.toString(),
        formatFull: (v) => v.toString(),
        description: 'Number of active participants per year'
    },
    media: { 
        label: 'Media', 
        color: COLORS.userPalette[3], // #0984e3 - blue from palette
        format: (v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toLocaleString(),
        formatFull: (v) => v.toLocaleString(),
        description: 'Photos, videos, and audio shared each year'
    }
};

export default function EvolutionAnalysis({ aggregates, selectedYears, selectedUsers }) {
    // Sort state for Yearly Summary table using shared hook
    const { sortColumn: yearlySortColumn, sortDirection: yearlySortDirection, handleSort: handleYearlySort } = useSortable('year', 'desc');
    const [hoveredYear, setHoveredYear] = useState(null);
    
    // Selected metric for the MAIN evolution chart (unified)
    const [selectedMainMetric, setSelectedMainMetric] = useState('engagement');

    // Build yearly data from precomputed aggregates, filtered by selected years and users
    const yearlyData = useMemo(() => {
        if (!aggregates?.yearly) return [];
        
        const selectedYearSet = new Set(selectedYears.map(String));
        const selectedUserSet = new Set(selectedUsers);
        
        return Object.entries(aggregates.yearly)
            .filter(([year]) => selectedYearSet.has(year))
            .map(([year, data]) => {
                // Get user stats for this year from user_monthly, filtered by selected users
                const userStats = {};
                let filteredMessages = 0;
                let filteredReactions = 0;
                let filteredMedia = { photos: 0, videos: 0, audio: 0 };
                
                if (aggregates.user_monthly) {
                    Object.entries(aggregates.user_monthly).forEach(([user, months]) => {
                        if (!selectedUserSet.has(user)) return;
                        
                        // Aggregate all months in this year
                        Object.entries(months).forEach(([monthKey, monthData]) => {
                            if (!monthKey.startsWith(year)) return;
                            
                            if (!userStats[user]) {
                                userStats[user] = {
                                    messages: 0,
                                    reactionsReceived: 0,
                                    reactionsGiven: 0,
                                    initiations: 0,
                                    media: { photos: 0, videos: 0, audio: 0, total: 0 },
                                    totalChars: 0
                                };
                            }
                            
                            userStats[user].messages += monthData.messages || 0;
                            userStats[user].reactionsReceived += monthData.reactions_received || 0;
                            userStats[user].reactionsGiven += monthData.reactions_given || 0;
                            userStats[user].initiations += monthData.initiations || 0;
                            userStats[user].totalChars += monthData.total_chars || 0;
                            
                            if (monthData.media) {
                                userStats[user].media.photos += monthData.media.photos || 0;
                                userStats[user].media.videos += monthData.media.videos || 0;
                                userStats[user].media.audio += monthData.media.audio || 0;
                            }
                            
                            filteredMessages += monthData.messages || 0;
                            filteredReactions += monthData.reactions_received || 0;
                            if (monthData.media) {
                                filteredMedia.photos += monthData.media.photos || 0;
                                filteredMedia.videos += monthData.media.videos || 0;
                                filteredMedia.audio += monthData.media.audio || 0;
                            }
                        });
                        
                        if (userStats[user]) {
                            userStats[user].media.total = 
                                userStats[user].media.photos + 
                                userStats[user].media.videos + 
                                userStats[user].media.audio;
                            userStats[user].reactionRatio = userStats[user].messages > 0 
                                ? userStats[user].reactionsReceived / userStats[user].messages 
                                : 0;
                        }
                    });
                }
                
                // Use filtered totals from user_monthly data
                // Only fall back to yearly data if user_monthly was unavailable AND all users selected
                const hasUserMonthly = Object.keys(userStats).length > 0;
                const isAllUsersSelected = selectedUsers.length === Object.keys(aggregates.user_monthly || {}).length;
                const totalMessages = hasUserMonthly ? filteredMessages : (isAllUsersSelected ? data.messages : 0);
                const totalReactions = hasUserMonthly ? filteredReactions : (isAllUsersSelected ? data.reactions : 0);
                const totalMedia = filteredMedia.photos + filteredMedia.videos + filteredMedia.audio;
                
                // Filter top messagers/reactors by selected users
                const filteredTopMessagers = (data.top_messagers || [])
                    .filter(u => selectedUserSet.has(u.name));
                const filteredTopReactors = (data.top_reactors || [])
                    .filter(u => selectedUserSet.has(u.name));
                
                // Calculate total reactions given for this year
                const totalReactionsGiven = Object.values(userStats).reduce(
                    (sum, stats) => sum + (stats.reactionsGiven || 0), 0
                );
                
                return {
                    year: parseInt(year),
                    totalMessages,
                    totalReactions,
                    totalReactionsGiven,
                    activeMembers: Object.keys(userStats).length || data.active_users,
                    reactionsPerMessage: totalMessages > 0 ? (totalReactions / totalMessages).toFixed(2) : '0',
                    topMessagers: filteredTopMessagers.length > 0 ? filteredTopMessagers : data.top_messagers || [],
                    topReactors: filteredTopReactors.length > 0 ? filteredTopReactors : data.top_reactors || [],
                    topEmojis: data.top_emojis || [],
                    topWords: data.top_words || [],
                    peakHour: data.peak_hour || 0,
                    peakDay: DAYS[data.peak_day || 0],
                    media: filteredMedia.photos > 0 ? filteredMedia : { photos: 0, videos: 0, audio: 0 },
                    totalMedia,
                    userStats
                };
            })
            .sort((a, b) => a.year - b.year);
    }, [aggregates, selectedYears, selectedUsers]);


    // Unified chart data for the main evolution chart with peak/average calculations
    const { chartData, peakPoint, average } = useMemo(() => {
        const data = yearlyData.map(y => ({
            year: y.year.toString(),
            messages: y.totalMessages,
            engagement: parseFloat(y.reactionsPerMessage),
            reactionsGiven: y.totalReactionsGiven,
            activeMembers: y.activeMembers,
            media: y.totalMedia
        }));
        
        if (data.length === 0) return { chartData: [], peakPoint: null, average: 0 };
        
        // Calculate peak and average for selected metric
        const metricKey = selectedMainMetric;
        let maxValue = -Infinity;
        let peakData = null;
        let totalValue = 0;
        
        data.forEach(d => {
            const val = d[metricKey] || 0;
            totalValue += val;
            if (val > maxValue) {
                maxValue = val;
                peakData = { ...d, value: val };
            }
        });
        
        const avgValue = data.length > 0 ? totalValue / data.length : 0;
        
        return { 
            chartData: data, 
            peakPoint: peakData, 
            average: metricKey === 'engagement' ? avgValue.toFixed(2) : Math.round(avgValue)
        };
    }, [yearlyData, selectedMainMetric]);
    
    // Get current metric config
    const currentMetric = METRIC_CONFIG[selectedMainMetric] || METRIC_CONFIG.messages;

    // Get users for per-user charts (all selected users, sorted by total messages)
    const chartUsers = useMemo(() => {
        const totals = {};
        yearlyData.forEach(y => {
            Object.entries(y.userStats || {}).forEach(([user, stats]) => {
                totals[user] = (totals[user] || 0) + stats.messages;
            });
        });
        return Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);
    }, [yearlyData]);

    // Compute sorted yearly data with sparklines and YoY changes
    const sortedYearlyData = useMemo(() => {
        // Build sparkline arrays and YoY change data
        const messagesArray = yearlyData.map(y => y.totalMessages);
        const reactionsArray = yearlyData.map(y => y.totalReactions);
        const membersArray = yearlyData.map(y => y.activeMembers);
        const mediaArray = yearlyData.map(y => y.totalMedia);
        const engagementArray = yearlyData.map(y => parseFloat(y.reactionsPerMessage));

        const enrichedData = yearlyData.map((y, idx) => {
            // Calculate YoY changes
            const prevYear = idx > 0 ? yearlyData[idx - 1] : null;
            const yoyMessages = prevYear ? ((y.totalMessages - prevYear.totalMessages) / (prevYear.totalMessages || 1) * 100) : 0;
            const yoyReactions = prevYear ? ((y.totalReactions - prevYear.totalReactions) / (prevYear.totalReactions || 1) * 100) : 0;
            const yoyMedia = prevYear ? ((y.totalMedia - prevYear.totalMedia) / (prevYear.totalMedia || 1) * 100) : 0;
            
            // Sparkline data up to this year
            const sparkMessages = messagesArray.slice(0, idx + 1);
            const sparkReactions = reactionsArray.slice(0, idx + 1);
            const sparkMembers = membersArray.slice(0, idx + 1);
            const sparkMedia = mediaArray.slice(0, idx + 1);
            const sparkEngagement = engagementArray.slice(0, idx + 1);

            return {
                ...y,
                yoyMessages,
                yoyReactions,
                yoyMedia,
                sparkMessages,
                sparkReactions,
                sparkMembers,
                sparkMedia,
                sparkEngagement,
                engagement: parseFloat(y.reactionsPerMessage)
            };
        });

        // Sort based on yearlySortColumn
        return [...enrichedData].sort((a, b) => {
            let aVal, bVal;
            switch (yearlySortColumn) {
                case 'year': aVal = a.year; bVal = b.year; break;
                case 'messages': aVal = a.totalMessages; bVal = b.totalMessages; break;
                case 'members': aVal = a.activeMembers; bVal = b.activeMembers; break;
                case 'reactions': aVal = a.totalReactions; bVal = b.totalReactions; break;
                case 'engagement': aVal = a.engagement; bVal = b.engagement; break;
                case 'media': aVal = a.totalMedia; bVal = b.totalMedia; break;
                default: aVal = a.year; bVal = b.year;
            }
            return yearlySortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [yearlyData, yearlySortColumn, yearlySortDirection]);

    // YoY Change indicator component
    const YoYChange = ({ value }) => {
        if (value === 0 || isNaN(value)) return <span className="text-neutral-300 text-[12px]">—</span>;
        const isPositive = value > 0;
        return (
            <span className={`text-[12px] font-mono ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                {isPositive ? '↑' : '↓'}{Math.abs(value).toFixed(0)}%
            </span>
        );
    };

    if (!yearlyData.length) {
        return (
            <div className="flex items-center justify-center h-[40vh] text-neutral-400">
                <div className="text-center">
                    <span className="font-mono text-5xl mb-4 block">—</span>
                    <h2 className="font-display text-lg font-semibold text-neutral-700">No evolution data available</h2>
                    <p className="font-mono text-xs text-neutral-400 mt-2">Select users and years to see evolution</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {/* Evolution Chart - Swiss minimalist design */}
            <div className="h-full">
                {/* Header with title, subtitle, then insight */}
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
                            {currentMetric.label} Per Year
                        </h3>
                        <p className="font-mono text-[12px] text-neutral-500">
                            {currentMetric.description || `Track ${currentMetric.label.toLowerCase()} trends over time`}
                        </p>
                        {peakPoint && (
                            <div className="mt-3 text-lg lg:text-xl font-semibold tracking-tight text-neutral-900">
                                Peak: <span className="text-accent">{currentMetric.formatFull(peakPoint.value)}</span>
                                <span className="text-neutral-400 text-sm ml-2 font-normal">{peakPoint.year}</span>
                            </div>
                        )}
                        <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-neutral-400 mt-1">
                            Average: <span className="text-neutral-600 font-medium">
                                {selectedMainMetric === 'engagement' ? average : Number(average).toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                        {Object.entries(METRIC_CONFIG).map(([key, config]) => (
                            <button
                                key={key}
                                onClick={() => setSelectedMainMetric(key)}
                                className={`px-2.5 py-1.5 font-mono text-[12px] uppercase tracking-widest transition-colors ${
                                    selectedMainMetric === key
                                        ? 'bg-neutral-900 text-white'
                                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                                }`}
                            >
                                {config.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {selectedMainMetric === 'activeMembers' ? (
                            // Bar chart for discrete counts like active members
                            <BarChart data={chartData} margin={{ top: 20, right: 10, bottom: 0, left: 10 }}>
                                <XAxis 
                                    dataKey="year" 
                                    stroke={AXIS_COLOR}
                                    tick={CHART.axis.tick}
                                    axisLine={{ stroke: AXIS_COLOR }}
                                    tickLine={false}
                                />
                                <YAxis hide={true} />
                                <Tooltip 
                                    contentStyle={SWISS_TOOLTIP} 
                                    formatter={(v) => [`${currentMetric.formatFull(v)}`, currentMetric.label]}
                                    labelFormatter={(label) => `YEAR_${label}`}
                                />
                                <Bar 
                                    dataKey={selectedMainMetric} 
                                    name={currentMetric.label} 
                                    radius={0}
                                >
                                    {chartData.map((entry, index) => {
                                        const isPeak = peakPoint && entry.year === peakPoint.year;
                                        return (
                                            <Cell 
                                                key={`cell-${index}`}
                                                fill={isPeak ? currentMetric.color : COLORS.neutral[300]}
                                            />
                                        );
                                    })}
                                </Bar>
                            </BarChart>
                        ) : (
                            // Area chart for continuous metrics
                            <AreaChart data={chartData} margin={{ top: 20, right: 10, bottom: 0, left: 10 }}>
                                <XAxis 
                                    dataKey="year" 
                                    stroke={AXIS_COLOR}
                                    tick={CHART.axis.tick}
                                    axisLine={{ stroke: AXIS_COLOR }}
                                    tickLine={false}
                                />
                                <YAxis hide={true} />
                                <Tooltip 
                                    contentStyle={SWISS_TOOLTIP} 
                                    formatter={(v) => [`${currentMetric.formatFull(v)}`, currentMetric.label]}
                                    labelFormatter={(label) => `YEAR_${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={selectedMainMetric}
                                    stroke={currentMetric.color}
                                    strokeWidth={1.5}
                                    fillOpacity={0.1}
                                    fill={currentMetric.color}
                                    dot={false}
                                    activeDot={{ r: 4, fill: currentMetric.color, stroke: COLORS.bg.elevated, strokeWidth: 2 }}
                                />
                                {/* Peak annotation */}
                                {peakPoint && (
                                    <ReferenceDot
                                        x={peakPoint.year}
                                        y={peakPoint.value}
                                        r={5}
                                        fill={currentMetric.color}
                                        stroke={COLORS.bg.elevated}
                                        strokeWidth={2}
                                    />
                                )}
                            </AreaChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* YEARLY SUMMARY SECTION */}
            {chartUsers.length > 0 && (
                <div className="pt-16">
                    {/* Section Header */}
                    <div className="mb-10">
                        <h3 className="font-display text-xl lg:text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
                            Yearly Summary
                        </h3>
                        <p className="font-mono text-[12px] text-neutral-500">
                            Annual breakdown of all metrics · Click headers to sort
                        </p>
                    </div>
                    
                    <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr>
                                    <SortableHeader column="year" sortColumn={yearlySortColumn} sortDirection={yearlySortDirection} onSort={handleYearlySort} align="left">Year</SortableHeader>
                                    <SortableHeader column="messages" sortColumn={yearlySortColumn} sortDirection={yearlySortDirection} onSort={handleYearlySort}>Messages</SortableHeader>
                                    <SortableHeader column="reactions" sortColumn={yearlySortColumn} sortDirection={yearlySortDirection} onSort={handleYearlySort}>Reactions</SortableHeader>
                                    <SortableHeader column="engagement" sortColumn={yearlySortColumn} sortDirection={yearlySortDirection} onSort={handleYearlySort}>Eng.</SortableHeader>
                                    <SortableHeader column="members" sortColumn={yearlySortColumn} sortDirection={yearlySortDirection} onSort={handleYearlySort}>Members</SortableHeader>
                                    <SortableHeader column="media" sortColumn={yearlySortColumn} sortDirection={yearlySortDirection} onSort={handleYearlySort}>Media</SortableHeader>
                                    <TableHeader align="left">Champion</TableHeader>
                                    <TableHeader align="center">Peak</TableHeader>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedYearlyData.map((y) => {
                                    const isPeakYear = y.totalMessages === Math.max(...yearlyData.map(d => d.totalMessages));
                                    const isHovered = hoveredYear === y.year;
                                    return (
                                        <TableRow 
                                            key={y.year}
                                            isHovered={isHovered}
                                            onHover={(hovered) => setHoveredYear(hovered ? y.year : null)}
                                        >
                                            {/* YEAR */}
                                            <TableCell align="left" isLeader={isPeakYear} isHovered={isHovered}>
                                                {y.year}
                                            </TableCell>
                                            
                                            {/* MESSAGES */}
                                            <TableCell isLeader={isPeakYear} isHovered={isHovered}>
                                                {formatValue(y.totalMessages)}
                                            </TableCell>
                                            
                                            {/* REACTIONS */}
                                            <TableCell isHovered={isHovered}>
                                                {formatValue(y.totalReactions)}
                                            </TableCell>
                                            
                                            {/* ENGAGEMENT */}
                                            <TableCell variant="muted" isHovered={isHovered}>
                                                {y.reactionsPerMessage}
                                            </TableCell>
                                            
                                            {/* MEMBERS */}
                                            <TableCell variant="muted" isHovered={isHovered}>
                                                {y.activeMembers}
                                            </TableCell>
                                            
                                            {/* MEDIA */}
                                            <TableCell isHovered={isHovered}>
                                                {formatValue(y.totalMedia)}
                                            </TableCell>
                                            
                                            {/* CHAMPION */}
                                            <td className="py-3 px-3">
                                                <span className={`font-mono text-[13px] font-bold uppercase tracking-wide truncate block max-w-[100px] ${
                                                    isHovered ? 'text-accent' : 'text-black'
                                                }`} title={y.topMessagers[0]?.name}>
                                                    {formatName(y.topMessagers[0]?.name) || '—'}
                                                </span>
                                            </td>
                                            
                                            {/* PEAK HOUR */}
                                            <TableCell align="center" variant="muted" isHovered={isHovered}>
                                                {y.peakHour}:00
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </tbody>
                            
                            {/* TOTALS */}
                            <tfoot>
                                <TableFooter>
                                    <td className="py-6 px-3 font-mono text-[12px] text-neutral-300">Σ</td>
                                    <TableFooterCell>
                                        {yearlyData.reduce((sum, y) => sum + y.totalMessages, 0).toLocaleString()}
                                    </TableFooterCell>
                                    <TableFooterCell>
                                        {yearlyData.reduce((sum, y) => sum + y.totalReactions, 0).toLocaleString()}
                                    </TableFooterCell>
                                    <TableFooterCell isEmpty />
                                    <TableFooterCell isEmpty />
                                    <TableFooterCell>
                                        {yearlyData.reduce((sum, y) => sum + y.totalMedia, 0).toLocaleString()}
                                    </TableFooterCell>
                                    <td className="py-4 px-3" colSpan={2}></td>
                                </TableFooter>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

