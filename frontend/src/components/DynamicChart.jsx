import React, { useState, useMemo } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceDot } from 'recharts';
import { STYLES, CHART, COLORS, getChartTooltipStyle } from '../design';
import { SectionHeader, ModeToggle, KeyStat } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Use shared tooltip style from design system
const SWISS_TOOLTIP = getChartTooltipStyle();

// Use shared axis color from design system
const AXIS_COLOR = CHART.axis.stroke;

// Timeline modes (trend over time)
const TIMELINE_MODES = {
    year: { label: 'Year', title: 'Messages Per Year', subtitle: 'Yearly message volume over time' },
    month: { label: 'Month', title: 'Messages Per Month', subtitle: 'Monthly message volume over time' },
    week: { label: 'Week', title: 'Messages Per Week', subtitle: 'Weekly message volume over time' },
};

// Distribution modes (cyclical patterns)
const DISTRIBUTION_MODES = {
    hour: { label: 'Hour', title: 'Activity By Hour', subtitle: 'When does the group chat during the day?' },
    dayOfWeek: { label: 'Day', title: 'Activity By Day', subtitle: 'Which days are most active?' },
    monthOfYear: { label: 'Month', title: 'Activity By Season', subtitle: 'Seasonal chat patterns throughout the year' },
};

export function TimelineChart({ messages, defaultMode = 'month', aggregates, isFiltered = false }) {
    const [mode, setMode] = useState(defaultMode);

    const { data, peakPoint, troughPoint, average } = useMemo(() => {
        // Use precomputed aggregates (they are properly filtered by filterAggregates)
        if (aggregates) {
            let counts = {};
            
            if (mode === 'year' && aggregates.yearly) {
                // Use yearly aggregates
                Object.entries(aggregates.yearly).forEach(([year, y]) => {
                    counts[year] = y.messages;
                });
            } else if (mode === 'month' && aggregates.monthly) {
                // Use monthly aggregates
                Object.entries(aggregates.monthly).forEach(([monthKey, m]) => {
                    counts[monthKey] = m.messages;
                });
            } else if (mode === 'week' && aggregates.weekly) {
                // Use weekly aggregates
                Object.entries(aggregates.weekly).forEach(([weekKey, w]) => {
                    counts[weekKey] = w.messages;
                });
            }
            
            if (Object.keys(counts).length > 0) {
                const sorted = Object.entries(counts)
                    .map(([key, count]) => ({ key, count }))
                    .sort((a, b) => a.key.localeCompare(b.key));
                
                let maxCount = 0, minCount = Infinity;
                let peak = null, trough = null;
                let totalCount = 0;
                sorted.forEach((d, idx) => {
                    totalCount += d.count;
                    if (d.count > maxCount) { maxCount = d.count; peak = { ...d, idx }; }
                    if (d.count < minCount && d.count > 0) { minCount = d.count; trough = { ...d, idx }; }
                });
                
                const avg = sorted.length > 0 ? Math.round(totalCount / sorted.length) : 0;
                return { data: sorted, peakPoint: peak, troughPoint: trough, average: avg };
            }
        }
        
        // Fallback: compute from messages
        if (!messages || messages.length === 0) return { data: [], peakPoint: null, troughPoint: null, average: 0 };

        const counts = {};

        messages.forEach(msg => {
            const date = new Date(msg.timestamp_ms);
            let key;

            switch (mode) {
                case 'year':
                    key = String(date.getFullYear());
                    break;
                case 'month':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'week':
                default:
                    const day = date.getDay();
                    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(date.getFullYear(), date.getMonth(), diff);
                    key = monday.toISOString().split('T')[0];
                    break;
            }

            counts[key] = (counts[key] || 0) + 1;
        });

        const sorted = Object.entries(counts)
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => a.key.localeCompare(b.key));
        
        // Find peak and trough for annotations
        let maxCount = 0, minCount = Infinity;
        let peak = null, trough = null;
        let totalCount = 0;
        sorted.forEach((d, idx) => {
            totalCount += d.count;
            if (d.count > maxCount) { maxCount = d.count; peak = { ...d, idx }; }
            if (d.count < minCount && d.count > 0) { minCount = d.count; trough = { ...d, idx }; }
        });
        
        const avg = sorted.length > 0 ? Math.round(totalCount / sorted.length) : 0;

        return { data: sorted, peakPoint: peak, troughPoint: trough, average: avg };
    }, [aggregates, messages, mode]);

    const formatTick = (key) => {
        switch (mode) {
            case 'year':
                return `'${key.slice(-2)}`;
            case 'month':
                const [year, month] = key.split('-');
                return `${MONTHS[parseInt(month) - 1]} '${year.slice(-2)}`;
            case 'week':
                const d = new Date(key);
                return `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
            default:
                return key;
        }
    };

    // Format for Peak context - shows full year
    const formatPeakContext = (key) => {
        switch (mode) {
            case 'year':
                return key; // Full year like "2020"
            case 'month':
                const [year, month] = key.split('-');
                return `${MONTHS[parseInt(month) - 1]} ${year}`; // "Mar 2020"
            case 'week':
                const d = new Date(key);
                return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; // "Mar 2020"
            default:
                return key;
        }
    };

    const formatTooltip = (key) => {
        if (!key) return '';
        switch (mode) {
            case 'year':
                return `YEAR_${key}`;
            case 'month':
                const parts = key.split('-');
                if (parts.length < 2) return key;
                const [year, month] = parts;
                const monthName = MONTHS[parseInt(month) - 1];
                return monthName ? `${monthName.toUpperCase()}_${year}` : key;
            case 'week':
                const d = new Date(key);
                if (isNaN(d.getTime())) return key;
                return `WEEK_${MONTHS[d.getMonth()].toUpperCase()}_${d.getDate()}_${d.getFullYear()}`;
            default:
                return key;
        }
    };

    // Convert TIMELINE_MODES to options array for ModeToggle
    const timelineModeOptions = Object.entries(TIMELINE_MODES).map(([key, { label }]) => ({ key, label }));

    return (
        <div className="h-full">
            {/* Header with title, subtitle, then insight */}
            <SectionHeader
                title={TIMELINE_MODES[mode].title}
                subtitle={TIMELINE_MODES[mode].subtitle}
                right={
                    <ModeToggle
                        options={timelineModeOptions}
                        value={mode}
                        onChange={setMode}
                    />
                }
            />
            <div className="flex flex-wrap gap-x-8 gap-y-1 -mt-5 mb-4">
                {peakPoint && (
                    <KeyStat
                        value={peakPoint.count.toLocaleString()}
                        context={formatPeakContext(peakPoint.key)}
                        className="mt-0"
                    />
                )}
            </div>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                        <XAxis
                            dataKey="key"
                            stroke={AXIS_COLOR}
                            tick={CHART.axis.tick}
                            tickFormatter={formatTick}
                            minTickGap={mode === 'week' ? 80 : mode === 'month' ? 60 : 30}
                            axisLine={{ stroke: AXIS_COLOR }}
                            tickLine={false}
                        />
                        <YAxis hide={true} />
                        <Tooltip
                            contentStyle={SWISS_TOOLTIP}
                            labelFormatter={formatTooltip}
                            formatter={(value) => [`${value.toLocaleString()} msgs`, '']}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke={COLORS.accent}
                            strokeWidth={1.5}
                            fillOpacity={0.1}
                            fill={COLORS.accent}
                            dot={false}
                            activeDot={{ r: 4, fill: COLORS.accent, stroke: COLORS.bg.elevated, strokeWidth: 2 }}
                        />
                        {/* Peak annotation */}
                        {peakPoint && (
                            <ReferenceDot
                                x={peakPoint.key}
                                y={peakPoint.count}
                                r={5}
                                fill={COLORS.accent}
                                stroke={COLORS.bg.elevated}
                                strokeWidth={2}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export function DistributionChart({ messages, defaultMode = 'hour', aggregates, isFiltered = false }) {
    const [mode, setMode] = useState(defaultMode);

    const { data, peakIdx, peakValue, average } = useMemo(() => {
        // Use precomputed aggregates (they are properly filtered by filterAggregates)
        if (aggregates?.monthly && Object.keys(aggregates.monthly).length > 0) {
            const counts = {};
            
            if (mode === 'hour') {
                // Aggregate hourly from all months
                const hourly = new Array(24).fill(0);
                Object.values(aggregates.monthly).forEach(m => {
                    if (m.hourly) {
                        m.hourly.forEach((v, i) => hourly[i] += v);
                    }
                });
                for (let i = 0; i < 24; i++) {
                    counts[i] = hourly[i];
                }
            } else if (mode === 'dayOfWeek') {
                // Aggregate daily from all months
                const daily = new Array(7).fill(0);
                Object.values(aggregates.monthly).forEach(m => {
                    if (m.daily) {
                        m.daily.forEach((v, i) => daily[i] += v);
                    }
                });
                for (let i = 0; i < 7; i++) {
                    counts[i] = daily[i];
                }
            } else if (mode === 'monthOfYear') {
                // Aggregate by month-of-year
                Object.entries(aggregates.monthly).forEach(([monthKey, m]) => {
                    const monthIdx = parseInt(monthKey.split('-')[1]) - 1;
                    counts[monthIdx] = (counts[monthIdx] || 0) + m.messages;
                });
            }
            
            if (Object.keys(counts).length > 0) {
                let result = [];
                let maxIdx = -1, maxVal = 0;
                let totalCount = 0;
                
                switch (mode) {
                    case 'hour':
                        for (let i = 0; i < 24; i++) {
                            const count = counts[i] || 0;
                            totalCount += count;
                            result.push({ 
                                key: i, 
                                label: i === 0 ? '00:00' : i === 12 ? '12:00' : i === 23 ? '23:00' : '',
                                fullLabel: `${String(i).padStart(2, '0')}:00`,
                                count 
                            });
                            if (count > maxVal) { maxVal = count; maxIdx = i; }
                        }
                        break;
                    case 'dayOfWeek':
                        for (let i = 0; i < 7; i++) {
                            const count = counts[i] || 0;
                            totalCount += count;
                            result.push({ key: i, label: DAYS[i].slice(0, 2).toUpperCase(), fullLabel: DAYS[i], count });
                            if (count > maxVal) { maxVal = count; maxIdx = i; }
                        }
                        break;
                    case 'monthOfYear':
                        for (let i = 0; i < 12; i++) {
                            const count = counts[i] || 0;
                            totalCount += count;
                            result.push({ key: i, label: MONTHS[i].slice(0, 1), fullLabel: MONTHS[i], count });
                            if (count > maxVal) { maxVal = count; maxIdx = i; }
                        }
                        break;
                }
                
                const avg = result.length > 0 ? Math.round(totalCount / result.length) : 0;
                return { data: result, peakIdx: maxIdx, peakValue: maxVal, average: avg };
            }
        }
        
        // Fallback: compute from messages
        if (!messages || messages.length === 0) return { data: [], peakIdx: -1, peakValue: 0, average: 0 };

        const counts = {};

        messages.forEach(msg => {
            const date = new Date(msg.timestamp_ms);
            let key;

            switch (mode) {
                case 'hour':
                    key = date.getHours();
                    break;
                case 'dayOfWeek':
                    key = date.getDay();
                    break;
                case 'monthOfYear':
                    key = date.getMonth();
                    break;
                default:
                    key = date.getHours();
            }

            counts[key] = (counts[key] || 0) + 1;
        });

        // Create full range with zeros for missing values
        let result = [];
        let maxIdx = -1, maxVal = 0;
        let totalCount = 0;
        
        switch (mode) {
            case 'hour':
                // Swiss style: only label critical points (00:00, 12:00, 23:59, peak)
                for (let i = 0; i < 24; i++) {
                    const count = counts[i] || 0;
                    totalCount += count;
                    result.push({ 
                        key: i, 
                        label: i === 0 ? '00:00' : i === 12 ? '12:00' : i === 23 ? '23:00' : '',
                        fullLabel: `${String(i).padStart(2, '0')}:00`,
                        count 
                    });
                    if (count > maxVal) { maxVal = count; maxIdx = i; }
                }
                break;
            case 'dayOfWeek':
                for (let i = 0; i < 7; i++) {
                    const count = counts[i] || 0;
                    totalCount += count;
                    result.push({ key: i, label: DAYS[i].slice(0, 2).toUpperCase(), fullLabel: DAYS[i], count });
                    if (count > maxVal) { maxVal = count; maxIdx = i; }
                }
                break;
            case 'monthOfYear':
                for (let i = 0; i < 12; i++) {
                    const count = counts[i] || 0;
                    totalCount += count;
                    result.push({ key: i, label: MONTHS[i].slice(0, 1), fullLabel: MONTHS[i], count });
                    if (count > maxVal) { maxVal = count; maxIdx = i; }
                }
                break;
        }
        
        const avg = result.length > 0 ? Math.round(totalCount / result.length) : 0;

        return { data: result, peakIdx: maxIdx, peakValue: maxVal, average: avg };
    }, [aggregates, messages, mode]);

    // Get peak label for header
    const peakLabel = useMemo(() => {
        if (peakIdx < 0 || !data[peakIdx]) return '—';
        return data[peakIdx].fullLabel || data[peakIdx].label;
    }, [data, peakIdx]);

    // Convert DISTRIBUTION_MODES to options array for ModeToggle
    const distributionModeOptions = Object.entries(DISTRIBUTION_MODES).map(([key, { label }]) => ({ key, label }));

    return (
        <div className="h-full">
            {/* Header with title, subtitle, then insight */}
            <SectionHeader
                title={DISTRIBUTION_MODES[mode].title}
                subtitle={DISTRIBUTION_MODES[mode].subtitle}
                right={
                    <ModeToggle
                        options={distributionModeOptions}
                        value={mode}
                        onChange={setMode}
                    />
                }
            />
            <div className="flex flex-wrap gap-x-8 gap-y-1 -mt-5 mb-4">
                <KeyStat value={peakLabel} className="mt-0" />
            </div>
            <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={data} 
                        margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                        barGap={0}
                        barCategoryGap={mode === 'hour' ? '8%' : '15%'}
                    >
                        {/* Whisper-subtle axis */}
                        <XAxis
                            dataKey={mode === 'hour' ? 'fullLabel' : 'label'}
                            stroke={AXIS_COLOR}
                            tick={CHART.axis.tick}
                            axisLine={{ stroke: AXIS_COLOR }}
                            tickLine={false}
                            interval={mode === 'hour' ? 3 : 0}
                        />
                        <YAxis hide={true} />
                        <Tooltip
                            contentStyle={SWISS_TOOLTIP}
                            cursor={false}
                            formatter={(value, name, props) => [
                                `${value.toLocaleString()} msgs`,
                                props.payload.fullLabel
                            ]}
                            labelFormatter={() => ''}
                        />
                        <Bar 
                            dataKey="count" 
                            radius={0}
                        >
                            {data.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={index === peakIdx ? COLORS.accent : COLORS.neutral[300]}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
