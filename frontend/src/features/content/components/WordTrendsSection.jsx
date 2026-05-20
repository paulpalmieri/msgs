import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, CHART } from '../../../design';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

/**
 * Word Trends Section
 * Shows how word usage changes over time
 * Design: Clean multi-line chart with word selection
 */
export default function WordTrendsSection({ wordTrends = {}, selectedYears = [], excludedWords = [] }) {
    const [selectedWords, setSelectedWords] = useState([]);
    const [viewMode, setViewMode] = useState('yearly');

    const words = useMemo(() => {
        const excludedSet = new Set(excludedWords.map(w => w.toLowerCase()));
        return Object.keys(wordTrends)
            .filter(word => !excludedSet.has(word.toLowerCase()))
            .slice(0, 30);
    }, [wordTrends, excludedWords]);

    // Build chart data
    const chartData = useMemo(() => {
        if (selectedWords.length === 0) return [];

        const timeKeys = viewMode === 'yearly'
            ? [...new Set(selectedWords.flatMap(word =>
                Object.keys(wordTrends[word]?.yearly || {})
            ))].sort()
            : [...new Set(selectedWords.flatMap(word =>
                Object.keys(wordTrends[word]?.monthly || {})
            ))].sort();

        const filteredKeys = selectedYears.length > 0
            ? timeKeys.filter(key => {
                const year = parseInt(key.split('-')[0]);
                return selectedYears.includes(year);
            })
            : timeKeys;

        return filteredKeys.map(timeKey => {
            const dataPoint = { time: viewMode === 'yearly' ? timeKey : timeKey.slice(2) };
            selectedWords.forEach(word => {
                const trends = wordTrends[word];
                dataPoint[word] = viewMode === 'yearly'
                    ? trends?.yearly?.[timeKey] || 0
                    : trends?.monthly?.[timeKey] || 0;
            });
            return dataPoint;
        });
    }, [wordTrends, selectedWords, viewMode, selectedYears]);

    const toggleWord = (word) => {
        setSelectedWords(prev =>
            prev.includes(word)
                ? prev.filter(w => w !== word)
                : prev.length < 6 ? [...prev, word] : prev
        );
    };

    // Color palette matching design system
    const wordColors = [
        COLORS.accent,
        COLORS.neutral[900],
        COLORS.neutral[600],
        '#0984e3',
        '#00b894',
        '#fdcb6e',
    ];

    if (Object.keys(wordTrends).length === 0) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="mb-8">
                    <h3 className={STYLES.sectionTitle}>Word Trends</h3>
                    <p className={STYLES.sectionSubtitle}>How word usage changes over time</p>
                </div>
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>No trend data available</p>
                </div>
            </section>
        );
    }

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Word Trends</h3>
                <p className={STYLES.sectionSubtitle}>How word usage changes over time</p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                {/* View Mode */}
                <div className="flex items-center gap-2">
                    <span className={STYLES.dataLabel}>View</span>
                    <div className="flex">
                        <button
                            onClick={() => setViewMode('yearly')}
                            className={`${STYLES.modeButton} ${
                                viewMode === 'yearly' ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                            }`}
                        >
                            Yearly
                        </button>
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`${STYLES.modeButton} ${
                                viewMode === 'monthly' ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                            }`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                {/* Selection Count */}
                <span className="font-mono text-[11px] text-neutral-400">
                    {selectedWords.length}/6 words selected
                </span>
            </div>

            {/* Word Selection */}
            <div className="mb-8">
                <p className={`${STYLES.dataLabel} mb-3`}>Select words to compare</p>
                <div className="flex flex-wrap gap-2">
                    {words.map((word) => {
                        const isSelected = selectedWords.includes(word);
                        const colorIndex = selectedWords.indexOf(word);
                        return (
                            <button
                                key={word}
                                onClick={() => toggleWord(word)}
                                className="px-3 py-1.5 font-mono text-[12px] uppercase tracking-wider transition-all"
                                style={isSelected ? {
                                    backgroundColor: wordColors[colorIndex],
                                    color: 'white',
                                } : {
                                    backgroundColor: COLORS.neutral[100],
                                    color: COLORS.neutral[600],
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) {
                                        e.target.style.backgroundColor = COLORS.neutral[200];
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) {
                                        e.target.style.backgroundColor = COLORS.neutral[100];
                                    }
                                }}
                            >
                                {word}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chart */}
            {selectedWords.length > 0 ? (
                <div className="h-80 bg-white p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <XAxis
                                dataKey="time"
                                {...CHART.axis}
                                tick={{ ...CHART.axis.tick, fontSize: 11 }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                {...CHART.axis}
                                tick={{ ...CHART.axis.tick, fontSize: 11 }}
                            />
                            <Tooltip
                                contentStyle={CHART.tooltip}
                            />
                            <Legend
                                wrapperStyle={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: '11px',
                                }}
                            />
                            {selectedWords.map((word, idx) => (
                                <Line
                                    key={word}
                                    type="monotone"
                                    dataKey={word}
                                    stroke={wordColors[idx]}
                                    strokeWidth={2}
                                    dot={viewMode === 'yearly'}
                                    activeDot={{ r: 4, strokeWidth: 0, fill: wordColors[idx] }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center bg-neutral-50">
                    <svg className="w-12 h-12 text-neutral-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <p className={STYLES.emptyState}>Select words above to see trends</p>
                </div>
            )}

            {/* Selected Words Legend */}
            {selectedWords.length > 0 && (
                <div className="mt-6 pt-4 border-t border-neutral-100">
                    <div className="flex flex-wrap gap-4">
                        {selectedWords.map((word, idx) => (
                            <button
                                key={word}
                                onClick={() => toggleWord(word)}
                                className="flex items-center gap-2 group"
                            >
                                <div
                                    className="w-3 h-3"
                                    style={{ backgroundColor: wordColors[idx] }}
                                />
                                <span className="font-mono text-[12px] text-neutral-600 group-hover:line-through">
                                    {word}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
