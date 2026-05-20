import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';
import DetailDrawer from './DetailDrawer';
import CollapsibleUserSection from './CollapsibleUserSection';

/**
 * Phrase Analysis Section
 * Shows common 2-word and 3-word phrases (n-grams)
 * Design: Clean typographic display with rankings
 * Note: phrases and user_bigrams are pre-filtered in filterAggregates
 */
export default function PhraseSection({ phrases = {}, selectedUsers = [], selectedYears = [], messageStore = [], onJumpToMessage = () => { } }) {
    const [activeTab, setActiveTab] = useState('bigrams');
    const [displayCount, setDisplayCount] = useState(20);
    const [selectedPhrase, setSelectedPhrase] = useState(null);

    const bigrams = phrases.bigrams || [];
    const trigrams = phrases.trigrams || [];
    const userBigrams = phrases.user_bigrams || {};

    const filteredUserBigrams = useMemo(() => {
        return Object.entries(userBigrams).filter(
            ([user]) => selectedUsers.length === 0 || selectedUsers.includes(user)
        );
    }, [userBigrams, selectedUsers]);

    const tabs = [
        { id: 'bigrams', label: '2-Word', count: bigrams.length },
        { id: 'trigrams', label: '3-Word', count: trigrams.length },
        { id: 'users', label: 'By Person', count: filteredUserBigrams.length },
    ];

    if (bigrams.length === 0 && trigrams.length === 0) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="mb-8">
                    <h3 className={STYLES.sectionTitle}>Common Phrases</h3>
                    <p className={STYLES.sectionSubtitle}>Most used word combinations</p>
                </div>
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>No phrase data available</p>
                </div>
            </section>
        );
    }

    const currentPhrases = activeTab === 'bigrams' ? bigrams : trigrams;
    const maxCount = currentPhrases[0]?.count || 1;

    // Find selected phrase data from bigrams or trigrams, with year-filtered samples
    const selectedPhraseData = useMemo(() => {
        if (!selectedPhrase) return null;
        const fromBigrams = bigrams.find(p => p.phrase === selectedPhrase);
        const phraseData = fromBigrams || trigrams.find(p => p.phrase === selectedPhrase);
        if (!phraseData) return null;

        // Filter samples by year if messageStore and samples are available
        if (phraseData.samples && phraseData.samples.length > 0 && selectedYears.length > 0) {
            const yearsSet = new Set(selectedYears);
            const filteredSamples = phraseData.samples.filter(sample => {
                if (!sample.timestamp_ms) return true;
                const msgYear = new Date(sample.timestamp_ms).getFullYear();
                return yearsSet.has(msgYear);
            });
            return { ...phraseData, samples: filteredSamples };
        }

        return phraseData;
    }, [selectedPhrase, bigrams, trigrams, selectedYears]);

    const handlePhraseClick = (phrase) => {
        setSelectedPhrase(phrase);
    };

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Common Phrases</h3>
                <p className={STYLES.sectionSubtitle}>
                    Most used word combinations
                    <span className="ml-2 text-neutral-400">• Click a phrase for details</span>
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                {/* Tabs */}
                <div className="flex">
                    {tabs.map(({ id, label, count }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`${STYLES.modeButton} ${activeTab === id ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                }`}
                        >
                            {label}
                            {count > 0 && (
                                <span className="ml-1.5 opacity-50">({count})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Display Count (for bigrams/trigrams) */}
                {activeTab !== 'users' && (
                    <div className="flex items-center gap-2">
                        <span className={STYLES.dataLabel}>Show</span>
                        <div className="flex">
                            {[10, 20, 50].map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setDisplayCount(count)}
                                    className={`${STYLES.modeButton} ${displayCount === count ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                        }`}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Bigrams & Trigrams Display */}
            {(activeTab === 'bigrams' || activeTab === 'trigrams') && (
                <div className="space-y-1">
                    {currentPhrases.slice(0, displayCount).map(({ phrase, count }, idx) => {
                        const percentage = (count / maxCount) * 100;
                        return (
                            <button
                                key={phrase}
                                onClick={() => handlePhraseClick(phrase)}
                                className="w-full group flex items-center gap-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                            >
                                {/* Rank */}
                                <span className={`w-8 text-center ${idx < 3 ? STYLES.rankAccent : STYLES.rank}`}>
                                    {idx + 1}
                                </span>

                                {/* Phrase */}
                                <span className="flex-1 font-display text-[15px] font-medium text-neutral-900 group-hover:text-accent transition-colors">
                                    "{phrase}"
                                </span>

                                {/* Bar */}
                                <div className="hidden md:block w-32 h-5 bg-neutral-100 relative">
                                    <div
                                        className="h-full transition-all duration-300"
                                        style={{
                                            width: `${percentage}%`,
                                            backgroundColor: idx < 3 ? COLORS.accent : COLORS.neutral[400],
                                        }}
                                    />
                                </div>

                                {/* Count */}
                                <span className="font-mono text-[13px] font-medium tabular-nums w-16 text-right">
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* By User Display */}
            {activeTab === 'users' && (
                <div className="grid md:grid-cols-2 gap-4">
                    {filteredUserBigrams.map(([user, userPhrases], userIdx) => (
                        <CollapsibleUserSection
                            key={user}
                            user={user}
                            subtitle={`${userPhrases.length} phrase${userPhrases.length !== 1 ? 's' : ''}`}
                            defaultOpen={userIdx === 0}
                            accentColor={COLORS.neutral[900]}
                        >
                            {/* User's Phrases */}
                            <div className="space-y-2">
                                {userPhrases.slice(0, 8).map(({ phrase, count }, idx) => (
                                    <button
                                        key={phrase}
                                        onClick={() => handlePhraseClick(phrase)}
                                        className="w-full flex items-center justify-between hover:bg-neutral-50 transition-colors py-1 -mx-1 px-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={idx < 3 ? STYLES.rankAccent : STYLES.rank}>
                                                {idx + 1}
                                            </span>
                                            <span className="font-display text-[14px] text-neutral-700 hover:text-accent transition-colors">
                                                "{phrase}"
                                            </span>
                                        </div>
                                        <span className="font-mono text-[12px] text-neutral-400 tabular-nums">
                                            {count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </CollapsibleUserSection>
                    ))}
                </div>
            )}

            {/* Stats Footer */}
            {activeTab !== 'users' && currentPhrases.length > 0 && (
                <div className="mt-8 pt-6 border-t border-neutral-100">
                    <div className="flex items-center gap-8">
                        <div>
                            <p className={STYLES.dataLabel}>Most Common</p>
                            <p className="font-display text-xl font-semibold text-accent">
                                "{currentPhrases[0]?.phrase}"
                            </p>
                        </div>
                        <div>
                            <p className={STYLES.dataLabel}>Used</p>
                            <p className={STYLES.dataValue}>
                                {currentPhrases[0]?.count?.toLocaleString()} times
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Phrase Detail Drawer */}
            <DetailDrawer
                isOpen={!!selectedPhrase}
                onClose={() => setSelectedPhrase(null)}
                title={selectedPhrase ? `"${selectedPhrase}"` : ''}
                subtitle="Phrase Analysis"
                stats={selectedPhraseData ? [
                    { label: 'Total Uses', value: selectedPhraseData.count?.toLocaleString() || 0 },
                ] : []}
                samples={selectedPhraseData?.samples || []}
                onJumpToMessage={onJumpToMessage}
            />
        </section>
    );
}
