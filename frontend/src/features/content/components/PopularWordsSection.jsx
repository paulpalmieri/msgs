import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';
import DetailDrawer from './DetailDrawer';

/**
 * Popular Words Section
 * Shows the most used words across all messages
 * Design: Clean list view with counts and clickable detail drawer
 */
export default function PopularWordsSection({
    wordIndex = {},
    selectedYears = [],
    wordToMessages = {},
    messageStore = [],
    excludedWords = [],
}) {
    const [displayCount, setDisplayCount] = useState(50);
    const [selectedWord, setSelectedWord] = useState(null);

    // Get top words sorted by count, filtered by selected years and excluded words
    const topWords = useMemo(() => {
        const yearsSet = new Set(selectedYears);
        const excludedSet = new Set(excludedWords.map(w => w.toLowerCase()));

        return Object.entries(wordIndex)
            .filter(([word]) => !excludedSet.has(word.toLowerCase())) // Filter out excluded words
            .map(([word, data]) => {
                // If years are selected, sum counts only for those years
                let count;
                if (selectedYears.length > 0 && data.by_year) {
                    count = Object.entries(data.by_year)
                        .filter(([year]) => yearsSet.has(parseInt(year)))
                        .reduce((sum, [, cnt]) => sum + cnt, 0);
                } else {
                    count = data.total_count || 0;
                }

                return {
                    word,
                    count,
                    byUser: data.by_user || {},
                    byYear: data.by_year || {},
                };
            })
            .filter(item => item.count > 0) // Remove words with no matches in selected years
            .sort((a, b) => b.count - a.count)
            .slice(0, 100);
    }, [wordIndex, selectedYears, excludedWords]);

    // Get selected word data with year-filtered samples
    const selectedWordData = useMemo(() => {
        if (!selectedWord) return null;
        const wordData = wordIndex[selectedWord];
        if (!wordData) return null;

        // Get samples from messageStore filtered by year
        const yearsSet = new Set(selectedYears);
        const msgIds = wordToMessages[selectedWord] || [];
        const samples = msgIds
            .slice(0, 20)
            .map(id => messageStore[id])
            .filter(msg => {
                if (!msg) return false;
                if (selectedYears.length === 0) return true;
                if (!msg.timestamp_ms) return true;
                const msgYear = new Date(msg.timestamp_ms).getFullYear();
                return yearsSet.has(msgYear);
            })
            .slice(0, 10);

        return {
            ...wordData,
            samples: samples.length > 0 ? samples : (wordData.samples || []),
        };
    }, [selectedWord, wordIndex, wordToMessages, messageStore, selectedYears]);

    const maxCount = topWords[0]?.count || 1;

    if (topWords.length === 0) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="mb-8">
                    <h3 className={STYLES.sectionTitle}>Most Popular Words</h3>
                    <p className={STYLES.sectionSubtitle}>Top 50 most used words</p>
                </div>
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>No word data available</p>
                </div>
            </section>
        );
    }

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Most Popular Words</h3>
                <p className={STYLES.sectionSubtitle}>
                    Top words {selectedYears.length > 0 ? `in ${selectedYears.join(', ')}` : 'across all messages'}
                    <span className="ml-2 text-neutral-400">• Click a word for details</span>
                </p>
            </div>

            {/* Display Count Control */}
            <div className="flex items-center gap-2 mb-6">
                <span className={STYLES.dataLabel}>Show</span>
                <div className="flex">
                    {[25, 50, 100].map((count) => (
                        <button
                            key={count}
                            onClick={() => setDisplayCount(count)}
                            className={`${STYLES.modeButton} ${
                                displayCount === count ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                            }`}
                        >
                            {count}
                        </button>
                    ))}
                </div>
            </div>

            {/* Words List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {topWords.slice(0, displayCount).map(({ word, count, byUser }, idx) => {
                    const percentage = (count / maxCount) * 100;
                    const topUser = Object.entries(byUser).sort((a, b) => b[1] - a[1])[0];

                    return (
                        <button
                            key={word}
                            onClick={() => setSelectedWord(word)}
                            className="group flex items-center gap-3 py-2.5 border-b border-neutral-100 hover:bg-neutral-50 transition-colors text-left"
                        >
                            {/* Rank */}
                            <span className={`w-8 text-center flex-shrink-0 ${idx < 3 ? STYLES.rankAccent : STYLES.rank}`}>
                                {idx + 1}
                            </span>

                            {/* Word */}
                            <span className="flex-1 font-mono text-[14px] font-medium text-neutral-900 group-hover:text-accent transition-colors truncate">
                                {word}
                            </span>

                            {/* Bar */}
                            <div className="hidden lg:block w-24 h-4 bg-neutral-100 flex-shrink-0">
                                <div
                                    className="h-full transition-all duration-300"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: idx < 3 ? COLORS.accent : COLORS.neutral[400],
                                    }}
                                />
                            </div>

                            {/* Count */}
                            <span className="font-mono text-[12px] font-medium tabular-nums text-right w-16 flex-shrink-0">
                                {count.toLocaleString()}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Stats Footer */}
            <div className="mt-8 pt-6 border-t border-neutral-100">
                <div className="flex items-center gap-8">
                    <div>
                        <p className={STYLES.dataLabel}>Words Shown</p>
                        <p className={STYLES.dataValue}>{topWords.length.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className={STYLES.dataLabel}>#1 Word</p>
                        <p className="font-display text-2xl font-semibold text-accent">
                            {topWords[0]?.word || '—'}
                        </p>
                    </div>
                    <div>
                        <p className={STYLES.dataLabel}>Used</p>
                        <p className={STYLES.dataValue}>
                            {topWords[0]?.count?.toLocaleString() || '—'} times
                            {selectedYears.length > 0 && <span className="text-neutral-400 text-[10px] ml-1">(filtered)</span>}
                        </p>
                    </div>
                </div>
            </div>

            {/* Word Detail Drawer */}
            <DetailDrawer
                isOpen={!!selectedWord}
                onClose={() => setSelectedWord(null)}
                title={selectedWord ? `"${selectedWord}"` : ''}
                subtitle="Word Analysis"
                stats={selectedWordData ? [
                    { label: 'Total Uses', value: selectedWordData.total_count?.toLocaleString() || 0 },
                    { label: 'By People', value: Object.keys(selectedWordData.by_user || {}).length },
                ] : []}
                samples={selectedWordData?.samples || []}
            >
                {selectedWordData && Object.keys(selectedWordData.by_user || {}).length > 0 && (
                    <div>
                        <h4 className={`${STYLES.dataLabel} mb-3`}>Usage by Person</h4>
                        <div className="space-y-2">
                            {Object.entries(selectedWordData.by_user)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 6)
                                .map(([user, count]) => (
                                    <div key={user} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0">
                                        <span className="font-mono text-[13px] text-neutral-700">
                                            {formatName(user)}
                                        </span>
                                        <span className="font-mono text-[12px] font-medium text-accent tabular-nums">
                                            {count}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </DetailDrawer>
        </section>
    );
}
