import React, { useMemo } from 'react';
import { formatName } from '../utils/formatters';
import { STYLES } from '../design';
import { SectionHeader, KeyStat, DataLabel, DataValue } from './ui';

// Mini bar chart for message length distribution
const LengthDistributionChart = ({ data, maxValue }) => {
    if (!data || data.length === 0) return null;
    
    return (
        <div className="flex items-end gap-px h-20 w-full">
            {data.map((item, i) => {
                const heightPct = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
                return (
                    <div 
                        key={i}
                        className="flex-1 bg-neutral-200 hover:bg-accent transition-colors relative group"
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                        title={`${item.range}: ${item.count} messages`}
                    />
                );
            })}
        </div>
    );
};

export default function ContentAnalysis({ creative, messages, users }) {
    if (!creative) return null;

    const { topWords } = creative;

    // Calculate message length statistics
    const messageLengthStats = useMemo(() => {
        if (!messages || messages.length === 0) return null;
        
        const lengths = messages
            .filter(m => m.content)
            .map(m => m.content.length);
        
        if (lengths.length === 0) return null;
        
        const total = lengths.reduce((a, b) => a + b, 0);
        const avg = Math.round(total / lengths.length);
        // Use reduce instead of spread to avoid stack overflow with large arrays
        const max = lengths.reduce((a, b) => Math.max(a, b), 0);
        // For median, we need sorted array but avoid creating huge copies
        // Sample if too large, otherwise sort
        let median;
        if (lengths.length > 10000) {
            // For very large datasets, sample for median approximation
            const sampleSize = 1000;
            const step = Math.floor(lengths.length / sampleSize);
            const sample = [];
            for (let i = 0; i < lengths.length; i += step) {
                sample.push(lengths[i]);
            }
            sample.sort((a, b) => a - b);
            median = sample[Math.floor(sample.length / 2)];
        } else {
            const sorted = [...lengths].sort((a, b) => a - b);
            median = sorted[Math.floor(sorted.length / 2)];
        }
        
        // Distribution buckets
        const buckets = [
            { range: '1-10', min: 1, max: 10, count: 0 },
            { range: '11-25', min: 11, max: 25, count: 0 },
            { range: '26-50', min: 26, max: 50, count: 0 },
            { range: '51-100', min: 51, max: 100, count: 0 },
            { range: '101-200', min: 101, max: 200, count: 0 },
            { range: '201-500', min: 201, max: 500, count: 0 },
            { range: '500+', min: 501, max: Infinity, count: 0 },
        ];
        
        lengths.forEach(len => {
            const bucket = buckets.find(b => len >= b.min && len <= b.max);
            if (bucket) bucket.count++;
        });
        
        const maxBucketCount = Math.max(...buckets.map(b => b.count));
        
        // Find the peak bucket (most common message length)
        const peakBucket = buckets.reduce((peak, b) => b.count > peak.count ? b : peak, buckets[0]);
        
        // Per-user average lengths
        const userLengths = {};
        messages.forEach(m => {
            if (m.content && m.sender_name) {
                if (!userLengths[m.sender_name]) {
                    userLengths[m.sender_name] = { total: 0, count: 0 };
                }
                userLengths[m.sender_name].total += m.content.length;
                userLengths[m.sender_name].count++;
            }
        });
        
        const userAvgs = Object.entries(userLengths)
            .map(([name, data]) => ({
                name,
                shortName: formatName(name),
                avg: Math.round(data.total / data.count),
                count: data.count
            }))
            .filter(u => u.count >= 10)
            .sort((a, b) => b.avg - a.avg);
        
        return {
            avg,
            max,
            median,
            total: lengths.length,
            buckets,
            maxBucketCount,
            peakBucket,
            userAvgs
        };
    }, [messages]);

    // Calculate word usage over time (by year)
    const wordTrends = useMemo(() => {
        if (!messages || !topWords || topWords.length === 0) return null;
        
        // Get top 5 words to track
        const trackedWords = topWords.slice(0, 5).map(w => w.word.toLowerCase());
        
        // Group messages by year and count word occurrences
        const yearlyWordCounts = {};
        
        messages.forEach(m => {
            if (!m.content || !m.timestamp_ms) return;
            const year = new Date(m.timestamp_ms).getFullYear();
            const content = m.content.toLowerCase();
            
            if (!yearlyWordCounts[year]) {
                yearlyWordCounts[year] = {};
                trackedWords.forEach(w => yearlyWordCounts[year][w] = 0);
            }
            
            trackedWords.forEach(word => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                const matches = content.match(regex);
                if (matches) {
                    yearlyWordCounts[year][word] += matches.length;
                }
            });
        });
        
        // Convert to array format
        const years = Object.keys(yearlyWordCounts).sort();
        if (years.length < 2) return null;
        
        return {
            words: trackedWords,
            years,
            data: yearlyWordCounts
        };
    }, [messages, topWords]);

    // Split top words into hero (top 5) and secondary
    const heroWords = topWords?.slice(0, 5) || [];
    const secondaryWords = topWords?.slice(5, 20) || [];

    // Font sizes for hero words (descending)
    const heroSizes = [
        'text-4xl sm:text-5xl lg:text-6xl',
        'text-3xl sm:text-4xl lg:text-5xl',
        'text-2xl sm:text-3xl lg:text-4xl',
        'text-xl sm:text-2xl lg:text-3xl',
        'text-lg sm:text-xl lg:text-2xl'
    ];

    return (
        <div className="space-y-20">
            
            {/* MESSAGE LENGTH ANALYSIS */}
            {messageLengthStats && (
                <div>
                    <SectionHeader
                        title="Message Length"
                        subtitle="Character count distribution across all messages"
                    />
                    <KeyStat
                        value={messageLengthStats.peakBucket.range}
                        context={`${messageLengthStats.peakBucket.count.toLocaleString()} msgs`}
                        className="-mt-5 mb-6"
                    />
                    
                    {/* Distribution Chart */}
                    <div className="mb-8">
                        <LengthDistributionChart 
                            data={messageLengthStats.buckets} 
                            maxValue={messageLengthStats.maxBucketCount}
                        />
                        <div className="flex justify-between mt-2 font-mono text-[8px] text-neutral-400">
                            {messageLengthStats.buckets.map((b, i) => (
                                <span key={i} className="flex-1 text-center">{b.range}</span>
                            ))}
                        </div>
                    </div>
                    
                    {/* Key Stats Row */}
                    <div className="flex flex-wrap gap-x-12 gap-y-4 mb-8">
                        <div>
                            <DataLabel className="mb-0.5">Average</DataLabel>
                            <DataValue unit="chars">{messageLengthStats.avg}</DataValue>
                        </div>
                        <div>
                            <DataLabel className="mb-0.5">Median</DataLabel>
                            <DataValue unit="chars">{messageLengthStats.median}</DataValue>
                        </div>
                        <div>
                            <DataLabel className="mb-0.5">Longest</DataLabel>
                            <DataValue unit="chars">{messageLengthStats.max.toLocaleString()}</DataValue>
                        </div>
                    </div>
                    
                    {/* Top Writers by Avg Length */}
                    {messageLengthStats.userAvgs.length > 0 && (
                        <div className="pt-6 border-t border-neutral-100">
                            <DataLabel className="mb-4">Longest Average Messages</DataLabel>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                {messageLengthStats.userAvgs.slice(0, 5).map((user, i) => (
                                    <div key={user.name} className="group">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-mono text-[12px] text-neutral-300">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span className="font-mono text-xs text-neutral-900 font-medium truncate" title={user.name}>
                                                {user.shortName}
                                            </span>
                                        </div>
                                        <div className="font-display text-lg font-semibold text-neutral-700 group-hover:text-accent transition-colors">
                                            {user.avg}<span className="text-neutral-400 text-[12px] ml-0.5">avg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* VOCABULARY - Typographic Size Hierarchy with Peak */}
            <div>
                <SectionHeader
                    title="Vocabulary"
                    subtitle="Most frequently used words (excluding stopwords)"
                    className="mb-8"
                />
                {heroWords[0] && (
                    <KeyStat
                        value={heroWords[0].count.toLocaleString()}
                        context={`"${heroWords[0].word}"`}
                        className="-mt-6 mb-8"
                    />
                )}
                
                {/* Hero Words - Stacked Typography */}
                <div className="space-y-4 mb-12">
                    {heroWords.map((word, index) => (
                        <div 
                            key={word.word}
                            className="flex items-baseline gap-4 group"
                        >
                            <span className={`font-display ${heroSizes[index]} font-semibold text-neutral-900 leading-none tracking-tight group-hover:text-accent transition-colors`}>
                                {word.word}
                            </span>
                            <span className="font-mono text-xs text-neutral-400 tabular-nums">
                                {word.count.toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
                
                {/* Secondary Words - Dense Grid */}
                {secondaryWords.length > 0 && (
                    <div className="pt-8 border-t border-neutral-100">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-4">
                            {secondaryWords.map((word) => (
                                <div 
                                    key={word.word}
                                    className="flex items-baseline justify-between gap-2 group"
                                >
                                    <span className="font-display text-sm font-medium text-neutral-700 truncate group-hover:text-accent transition-colors">
                                        {word.word}
                                    </span>
                                    <span className="font-mono text-[12px] text-neutral-400 tabular-nums flex-shrink-0">
                                        {word.count.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Word Trends Over Time */}
                {wordTrends && (
                    <div className="pt-8 mt-8 border-t border-neutral-100">
                        <DataLabel className="mb-6">Top Words Over Time</DataLabel>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[400px]">
                                <thead>
                                    <tr>
                                        <th className="text-left py-2 font-mono text-[12px] uppercase tracking-wider text-neutral-400">Word</th>
                                        {wordTrends.years.map(year => (
                                            <th key={year} className="text-right py-2 px-3 font-mono text-[12px] uppercase tracking-wider text-neutral-400">
                                                {year}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {wordTrends.words.map((word, idx) => {
                                        const values = wordTrends.years.map(y => wordTrends.data[y][word] || 0);
                                        const maxForWord = Math.max(...values);
                                        return (
                                            <tr key={word} className="border-t border-neutral-50 hover:bg-neutral-50 transition-colors">
                                                <td className="py-2 font-display text-sm font-medium text-neutral-900">
                                                    {word}
                                                </td>
                                                {wordTrends.years.map(year => {
                                                    const val = wordTrends.data[year][word] || 0;
                                                    const isPeak = val === maxForWord && val > 0;
                                                    return (
                                                        <td key={year} className={`py-2 px-3 text-right font-mono text-xs tabular-nums ${isPeak ? 'text-accent font-semibold' : 'text-neutral-600'}`}>
                                                            {val > 0 ? val.toLocaleString() : '—'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


