import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, CHART, formatName } from '../../../design';
import { useWordSearch } from '../hooks/useWordSearch';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

// Colors for compared words
const COMPARE_COLORS = [
    COLORS.accent,
    '#10B981', // green
    '#8B5CF6', // purple
    '#F59E0B', // amber
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#EF4444', // red
    '#84CC16', // lime
];

/**
 * Word Search Section
 * Search for any word and see who said it, when, and sample messages
 * Design: Clean search with visual results
 */
export default function WordSearchSection({ wordIndex = {}, wordTrends = {}, messageStore = [], selectedYears = [], excludedWords = [], onJumpToMessage = () => { } }) {
    const {
        query,
        setQuery,
        results,
        isSearching,
        selectWord,
        clearSearch,
        options,
        toggleOption,
    } = useWordSearch(wordIndex, messageStore, 300, selectedYears);
    const [comparedWords, setComparedWords] = useState([]);

    const getTrendData = (word) => {
        const trends = wordTrends[word] || wordIndex[word]?.by_month;
        if (!trends) return [];

        const monthlyData = trends.monthly || trends;
        return Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, count]) => ({
                month: month.slice(2),
                count,
            }));
    };

    // Build comparison chart data - merge all words into unified timeline
    const comparisonData = useMemo(() => {
        if (comparedWords.length === 0) return [];

        // Collect all months across all words
        const allMonths = new Set();
        const wordData = {};

        comparedWords.forEach(word => {
            const trends = wordTrends[word] || wordIndex[word]?.by_month;
            if (trends) {
                const monthlyData = trends.monthly || trends;
                wordData[word] = monthlyData;
                Object.keys(monthlyData).forEach(month => allMonths.add(month));
            }
        });

        // Sort months and build unified data
        const sortedMonths = Array.from(allMonths).sort();
        return sortedMonths.map(month => {
            const dataPoint = { month: month.slice(2) };
            comparedWords.forEach(word => {
                dataPoint[word] = wordData[word]?.[month] || 0;
            });
            return dataPoint;
        });
    }, [comparedWords, wordTrends, wordIndex]);

    const addToCompare = (word) => {
        if (!comparedWords.includes(word) && comparedWords.length < 8) {
            setComparedWords([...comparedWords, word]);
        }
    };

    const removeFromCompare = (word) => {
        setComparedWords(comparedWords.filter(w => w !== word));
    };

    const clearComparison = () => {
        setComparedWords([]);
    };

    const isWordInComparison = (word) => comparedWords.includes(word);

    // Get top words for initial display, filtered by excluded words
    const topWords = useMemo(() => {
        const excludedSet = new Set(excludedWords.map(w => w.toLowerCase()));
        return Object.entries(wordIndex)
            .filter(([word]) => !excludedSet.has(word.toLowerCase()))
            .sort((a, b) => b[1].total_count - a[1].total_count)
            .slice(0, 30);
    }, [wordIndex, excludedWords]);

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Text Explorer</h3>
                <p className={STYLES.sectionSubtitle}>
                    Search for any word or phrase to find messages and compare usage over time
                </p>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for any word or phrase..."
                    className="w-full px-0 py-4 text-2xl font-display font-medium border-0 border-b-2 border-neutral-200 bg-transparent text-neutral-900 placeholder-neutral-300 focus:border-accent focus:outline-none transition-colors"
                />
                {query && (
                    <button
                        onClick={clearSearch}
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Search Options */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => toggleOption('ignoreCase')}
                    className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all ${options.ignoreCase
                        ? 'bg-accent text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}
                >
                    <span className={`w-3 h-3 border-2 flex items-center justify-center ${options.ignoreCase ? 'border-white' : 'border-neutral-400'
                        }`}>
                        {options.ignoreCase && <span className="w-1.5 h-1.5 bg-white" />}
                    </span>
                    Ignore Case
                </button>
                <button
                    onClick={() => toggleOption('ignoreAccents')}
                    className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all ${options.ignoreAccents
                        ? 'bg-accent text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}
                >
                    <span className={`w-3 h-3 border-2 flex items-center justify-center ${options.ignoreAccents ? 'border-white' : 'border-neutral-400'
                        }`}>
                        {options.ignoreAccents && <span className="w-1.5 h-1.5 bg-white" />}
                    </span>
                    Ignore Accents
                </button>
                <span className="font-mono text-[10px] text-neutral-400">
                    (e.g., "café" matches "cafe")
                </span>
            </div>

            {/* Comparison Panel */}
            {comparedWords.length > 0 && (
                <div className="mb-8 p-6 bg-neutral-50 border border-neutral-200">
                    {/* Comparison Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <h4 className={STYLES.dataLabel}>Comparing {comparedWords.length} word{comparedWords.length !== 1 ? 's' : ''}</h4>
                            <button
                                onClick={clearComparison}
                                className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 hover:text-neutral-900 transition-colors"
                            >
                                Clear all
                            </button>
                        </div>
                    </div>

                    {/* Compared Words Tags */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {comparedWords.map((word, idx) => (
                            <div
                                key={word}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200"
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                                />
                                <span className="font-mono text-[12px] font-medium">{word}</span>
                                <span className="font-mono text-[11px] text-neutral-400">
                                    ({wordIndex[word]?.total_count?.toLocaleString() || 0})
                                </span>
                                <button
                                    onClick={() => removeFromCompare(word)}
                                    className="ml-1 text-neutral-400 hover:text-neutral-900 transition-colors"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Comparison Chart */}
                    {comparisonData.length > 0 && (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={comparisonData}>
                                    <XAxis
                                        dataKey="month"
                                        {...CHART.axis}
                                        tick={{ ...CHART.axis.tick, fontSize: 10 }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        {...CHART.axis}
                                        tick={{ ...CHART.axis.tick, fontSize: 10 }}
                                    />
                                    <Tooltip
                                        contentStyle={CHART.tooltip}
                                        formatter={(value, name) => [value, name]}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: 12, fontFamily: 'monospace' }}
                                    />
                                    {comparedWords.map((word, idx) => (
                                        <Line
                                            key={word}
                                            type="monotone"
                                            dataKey={word}
                                            stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Loading State */}
            {isSearching && (
                <p className={`${STYLES.emptyState} text-center py-8`}>Searching...</p>
            )}

            {/* Results */}
            {results && !isSearching && (
                <div className="space-y-8">
                    {results.found ? (
                        <>
                            {/* Word Stats - Hero Display */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                                <div>
                                    <p className={STYLES.dataLabel}>Total Uses</p>
                                    <p className={STYLES.dataValueLarge}>
                                        {results.total_count?.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className={STYLES.dataLabel}>People</p>
                                    <p className={STYLES.dataValueLarge}>
                                        {Object.keys(results.by_user || {}).length}
                                    </p>
                                </div>
                                <div>
                                    <p className={STYLES.dataLabel}>Years Active</p>
                                    <p className={STYLES.dataValueLarge}>
                                        {Object.keys(results.by_year || {}).length}
                                    </p>
                                </div>
                                <div>
                                    <p className={STYLES.dataLabel}>Search Term</p>
                                    <div className="flex items-center gap-3">
                                        <p className="font-display text-3xl lg:text-4xl font-semibold text-accent">
                                            "{results.word}"
                                        </p>
                                        <button
                                            onClick={() => isWordInComparison(results.word)
                                                ? removeFromCompare(results.word)
                                                : addToCompare(results.word)}
                                            className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all ${isWordInComparison(results.word)
                                                ? 'bg-accent text-white'
                                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-900 hover:text-white'
                                                }`}
                                            title={isWordInComparison(results.word) ? 'Remove from comparison' : 'Add to comparison'}
                                        >
                                            {isWordInComparison(results.word) ? '− Remove' : '+ Compare'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Who Said It Most - Bar Chart Style */}
                            <div className="overflow-hidden">
                                <h4 className={`${STYLES.dataLabel} mb-4`}>Who said it most</h4>
                                <div className="space-y-2">
                                    {Object.entries(results.by_user || {})
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 5)
                                        .map(([user, count], idx) => {
                                            const sortedUsers = Object.entries(results.by_user || {}).sort((a, b) => b[1] - a[1]);
                                            const maxCount = sortedUsers[0]?.[1] || 1;
                                            const percentage = Math.min((count / maxCount) * 100, 100);
                                            const showLabelInside = percentage > 25;
                                            return (
                                                <div key={user} className="flex items-center gap-3">
                                                    <span className={`w-28 flex-shrink-0 truncate ${STYLES.userNameSmall}`}>
                                                        {formatName(user)}
                                                    </span>
                                                    <div className="flex-1 min-w-0 h-7 bg-neutral-100 relative overflow-hidden">
                                                        <div
                                                            className="h-full transition-all duration-500 flex items-center"
                                                            style={{
                                                                width: `${percentage}%`,
                                                                backgroundColor: idx === 0 ? COLORS.accent : COLORS.neutral[400],
                                                            }}
                                                        >
                                                            {showLabelInside && (
                                                                <span className="absolute right-2 font-mono text-[12px] font-medium text-white tabular-nums">
                                                                    {count.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!showLabelInside && (
                                                            <span
                                                                className="absolute top-1/2 -translate-y-1/2 font-mono text-[12px] font-medium text-neutral-600 tabular-nums"
                                                                style={{ left: `calc(${percentage}% + 8px)` }}
                                                            >
                                                                {count.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Trend Chart */}
                            {getTrendData(results.word).length > 0 && (
                                <div>
                                    <h4 className={`${STYLES.dataLabel} mb-4`}>Usage over time</h4>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={getTrendData(results.word)}>
                                                <defs>
                                                    <linearGradient id="wordTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.3} />
                                                        <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis
                                                    dataKey="month"
                                                    {...CHART.axis}
                                                    tick={{ ...CHART.axis.tick, fontSize: 10 }}
                                                    interval="preserveStartEnd"
                                                />
                                                <YAxis
                                                    {...CHART.axis}
                                                    tick={{ ...CHART.axis.tick, fontSize: 10 }}
                                                />
                                                <Tooltip
                                                    contentStyle={CHART.tooltip}
                                                    formatter={(value) => [value, 'Uses']}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="count"
                                                    stroke={COLORS.accent}
                                                    strokeWidth={2}
                                                    fill="url(#wordTrendGradient)"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Sample Messages */}
                            {results.samples && results.samples.length > 0 && (
                                <div>
                                    <h4 className={`${STYLES.dataLabel} mb-4`}>Sample messages</h4>
                                    <div className="space-y-3">
                                        {results.samples.map((sample, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => onJumpToMessage(sample.id)}
                                                className="w-full text-left py-3 border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 transition-colors group px-2 -mx-2"
                                            >
                                                <span className={`${STYLES.userNameSmall} group-hover:text-accent transition-colors`}>
                                                    {formatName(sample.sender)}:
                                                </span>{' '}
                                                <span className="font-display text-[14px] text-neutral-600">
                                                    {sample.content}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Suggestions */
                        <div>
                            <p className="text-neutral-500 mb-4">
                                No exact match for "<span className="font-medium">{results.query}</span>". Try:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {results.suggestions?.map(({ word, count }) => (
                                    <button
                                        key={word}
                                        onClick={() => selectWord(word)}
                                        className="px-4 py-2 bg-neutral-100 hover:bg-neutral-900 hover:text-white font-mono text-[12px] uppercase tracking-wider transition-colors"
                                    >
                                        {word}
                                        <span className="ml-2 opacity-50">({count})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Default State - Popular Words */}
            {!query && topWords.length > 0 && (
                <div>
                    <h4 className={`${STYLES.dataLabel} mb-4`}>Popular words</h4>
                    <div className="flex flex-wrap gap-2">
                        {topWords.map(([word, data], idx) => (
                            <button
                                key={word}
                                onClick={() => selectWord(word)}
                                className={`px-4 py-2 font-mono text-[12px] uppercase tracking-wider transition-all ${idx < 5
                                    ? 'bg-neutral-900 text-white hover:bg-accent'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-900 hover:text-white'
                                    }`}
                            >
                                {word}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
