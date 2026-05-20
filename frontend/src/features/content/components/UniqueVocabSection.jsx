import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';
import DetailDrawer from './DetailDrawer';
import CollapsibleUserSection from './CollapsibleUserSection';

/**
 * Unique Vocabulary Section
 * Shows signature words that are unique to specific users
 * Design: Clean cards with uniqueness indicators
 * Note: uniqueWords is pre-filtered by user in filterAggregates
 */
export default function UniqueVocabSection({
    uniqueWords = {},
    selectedUsers = [],
    selectedYears = [],
    wordToMessages = {},
    messageStore = [],
    excludedWords = [],
}) {
    const [minUniqueness, setMinUniqueness] = useState(70);
    const [selectedWordInfo, setSelectedWordInfo] = useState(null); // { word, user, data }

    // Find word data from uniqueWords when a word is selected, with year-filtered samples
    const selectedWordData = useMemo(() => {
        if (!selectedWordInfo) return null;
        const { word, user } = selectedWordInfo;
        const userWordsList = uniqueWords[user] || [];
        const wordData = userWordsList.find(w => w.word === word);
        if (!wordData) return null;

        // Get samples from messageStore filtered by year
        const yearsSet = new Set(selectedYears);
        const msgIds = wordToMessages[word] || [];
        const samples = msgIds
            .slice(0, 20) // Limit to prevent performance issues
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
    }, [selectedWordInfo, uniqueWords, wordToMessages, messageStore, selectedYears]);

    const users = useMemo(() => {
        const excludedSet = new Set(excludedWords.map(w => w.toLowerCase()));

        return Object.entries(uniqueWords)
            .filter(([user, words]) =>
                words.length > 0 &&
                (selectedUsers.length === 0 || selectedUsers.includes(user))
            )
            .map(([user, words]) => [
                user,
                words.filter(w =>
                    w.uniqueness_score * 100 >= minUniqueness &&
                    !excludedSet.has(w.word.toLowerCase())
                )
            ])
            .filter(([_, words]) => words.length > 0);
    }, [uniqueWords, selectedUsers, minUniqueness, excludedWords]);

    if (Object.keys(uniqueWords).length === 0) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="mb-8">
                    <h3 className={STYLES.sectionTitle}>Signature Words</h3>
                    <p className={STYLES.sectionSubtitle}>Words unique to each person</p>
                </div>
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>No unique vocabulary patterns found</p>
                </div>
            </section>
        );
    }

    const formatPercent = (score) => Math.round(score * 100);

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Signature Words</h3>
                <p className={STYLES.sectionSubtitle}>
                    Words where {minUniqueness}%+ of uses come from one person
                    <span className="ml-2 text-neutral-400">• Click a word for details</span>
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mb-8">
                <span className={STYLES.dataLabel}>Min Uniqueness</span>
                <div className="flex">
                    {[70, 80, 90, 100].map((percent) => (
                        <button
                            key={percent}
                            onClick={() => setMinUniqueness(percent)}
                            className={`${STYLES.modeButton} ${
                                minUniqueness === percent ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                            }`}
                        >
                            {percent}%
                        </button>
                    ))}
                </div>
            </div>

            {/* Users Grid */}
            {users.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                    {users.map(([user, words], userIdx) => (
                        <CollapsibleUserSection
                            key={user}
                            user={user}
                            subtitle={`${words.length} signature word${words.length !== 1 ? 's' : ''}`}
                            defaultOpen={userIdx === 0}
                        >
                            {/* Words List */}
                            <div className="space-y-2">
                                {words.slice(0, 12).map(({ word, count, uniqueness_score }, idx) => (
                                    <button
                                        key={word}
                                        onClick={() => setSelectedWordInfo({ word, user })}
                                        className="w-full flex items-center gap-3 hover:bg-neutral-50 transition-colors py-1 -mx-1 px-1"
                                    >
                                        {/* Rank */}
                                        <span className={`w-6 ${idx < 3 ? STYLES.rankAccent : STYLES.rank}`}>
                                            {idx + 1}
                                        </span>

                                        {/* Word */}
                                        <span className="flex-1 font-display text-[14px] font-medium text-neutral-900 hover:text-accent transition-colors text-left">
                                            {word}
                                        </span>

                                        {/* Stats */}
                                        <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                                            {count}×
                                        </span>

                                        {/* Uniqueness Badge */}
                                        <div
                                            className="w-16 h-5 relative"
                                            style={{ backgroundColor: COLORS.neutral[100] }}
                                        >
                                            <div
                                                className="h-full absolute left-0 top-0"
                                                style={{
                                                    width: `${formatPercent(uniqueness_score)}%`,
                                                    backgroundColor: uniqueness_score >= 0.95 ? COLORS.accent :
                                                                    uniqueness_score >= 0.85 ? COLORS.neutral[700] :
                                                                    COLORS.neutral[400],
                                                }}
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-medium text-white mix-blend-difference">
                                                {formatPercent(uniqueness_score)}%
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CollapsibleUserSection>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>
                        No words found at {minUniqueness}% uniqueness threshold
                    </p>
                    <button
                        onClick={() => setMinUniqueness(70)}
                        className="mt-4 font-mono text-[12px] uppercase tracking-wider text-accent hover:underline"
                    >
                        Try lowering threshold
                    </button>
                </div>
            )}

            {/* Explanation */}
            <div className="mt-8 pt-6 border-t border-neutral-100">
                <p className="font-mono text-[11px] text-neutral-400 leading-relaxed">
                    Signature words reveal individual speaking patterns. A word with 90% uniqueness means
                    that person used it 9 out of every 10 times it appeared in the conversation.
                </p>
            </div>

            {/* Word Detail Drawer */}
            <DetailDrawer
                isOpen={!!selectedWordInfo}
                onClose={() => setSelectedWordInfo(null)}
                title={selectedWordInfo ? `"${selectedWordInfo.word}"` : ''}
                subtitle={selectedWordInfo ? `Signature Word • ${formatName(selectedWordInfo.user)}` : ''}
                stats={selectedWordData ? [
                    { label: 'Uses', value: selectedWordData.count?.toLocaleString() || 0 },
                    { label: 'Uniqueness', value: `${Math.round((selectedWordData.uniqueness_score || 0) * 100)}%`, color: COLORS.accent },
                ] : []}
                samples={selectedWordData?.samples || []}
            />
        </section>
    );
}
