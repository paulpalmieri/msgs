import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';
import DetailDrawer from './DetailDrawer';

/**
 * Word Cloud Section
 * Displays per-user word clouds showing vocabulary patterns
 * Click on a word to see sample messages containing it
 * Note: userWords is pre-filtered by user in filterAggregates
 */
export default function WordCloudSection({
    userWords = {},
    selectedUsers = [],
    selectedYears = [],
    wordIndex = {},
    wordToMessages = {},
    messageStore = [],
    excludedWords = [],
    onJumpToMessage = () => { },
}) {
    const [selectedUser, setSelectedUser] = useState(null);
    const [displayMode, setDisplayMode] = useState('cloud');
    const [wordCount, setWordCount] = useState(50);
    const [selectedWord, setSelectedWord] = useState(null);

    const users = useMemo(() => {
        return Object.keys(userWords).filter(
            user => selectedUsers.length === 0 || selectedUsers.includes(user)
        );
    }, [userWords, selectedUsers]);

    const activeUser = selectedUser || users[0];

    // Filter words by excluded words
    const words = useMemo(() => {
        const userWordsList = userWords[activeUser] || [];
        if (excludedWords.length === 0) return userWordsList;

        const excludedSet = new Set(excludedWords.map(w => w.toLowerCase()));
        return userWordsList.filter(({ word }) => !excludedSet.has(word.toLowerCase()));
    }, [userWords, activeUser, excludedWords]);

    // Get word data from wordIndex for selected word, with year-filtered samples from messageStore
    const selectedWordData = useMemo(() => {
        if (!selectedWord) return null;
        const wordData = wordIndex[selectedWord];
        if (!wordData) return null;

        // Get samples from messageStore filtered by year
        const yearsSet = new Set(selectedYears);
        const msgIds = wordToMessages[selectedWord] || [];
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
    }, [selectedWord, wordIndex, wordToMessages, messageStore, selectedYears]);

    // Calculate font sizes based on word frequency
    const maxCount = words.length > 0 ? words[0].count : 1;
    const minCount = words.length > 0 ? words[Math.min(wordCount - 1, words.length - 1)]?.count || 1 : 1;

    const getWordStyle = (count, idx) => {
        const range = maxCount - minCount || 1;
        const normalized = (count - minCount) / range;

        const fontSize = 14 + normalized * 34;
        const fontWeight = normalized > 0.7 ? 700 : normalized > 0.4 ? 600 : normalized > 0.2 ? 500 : 400;
        const color = idx < 3 ? COLORS.accent :
            idx < 10 ? COLORS.text.primary :
                COLORS.text.secondary;

        return { fontSize: `${fontSize}px`, fontWeight, color };
    };

    const handleWordClick = (word) => {
        setSelectedWord(word);
    };

    if (users.length === 0) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="mb-8">
                    <h3 className={STYLES.sectionTitle}>Word Clouds</h3>
                    <p className={STYLES.sectionSubtitle}>Most used words per person</p>
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
                <h3 className={STYLES.sectionTitle}>Word Clouds</h3>
                <p className={STYLES.sectionSubtitle}>
                    Most used words per person
                    <span className="ml-2 text-neutral-400">• Click a word for details</span>
                </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                {/* User Tabs */}
                <div className="flex flex-wrap gap-1">
                    {users.map((user) => (
                        <button
                            key={user}
                            onClick={() => setSelectedUser(user)}
                            className={`${STYLES.modeButton} ${user === activeUser ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                }`}
                        >
                            {formatName(user)}
                        </button>
                    ))}
                </div>

                {/* View Controls */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className={STYLES.dataLabel}>Words</span>
                        <div className="flex">
                            {[25, 50, 100].map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setWordCount(count)}
                                    className={`${STYLES.modeButton} ${wordCount === count ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                        }`}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex">
                        <button
                            onClick={() => setDisplayMode('cloud')}
                            className={`${STYLES.modeButton} ${displayMode === 'cloud' ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                }`}
                        >
                            Cloud
                        </button>
                        <button
                            onClick={() => setDisplayMode('list')}
                            className={`${STYLES.modeButton} ${displayMode === 'list' ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                }`}
                        >
                            List
                        </button>
                    </div>
                </div>
            </div>

            {/* Word Cloud Display */}
            {displayMode === 'cloud' && (
                <div className="min-h-[300px] p-8 bg-white flex flex-wrap gap-x-4 gap-y-2 items-baseline justify-center">
                    {words.slice(0, wordCount).map(({ word, count }, idx) => (
                        <button
                            key={word}
                            onClick={() => handleWordClick(word)}
                            className="font-display cursor-pointer hover:text-accent hover:underline transition-colors"
                            style={getWordStyle(count, idx)}
                            title={`${count} times - Click for details`}
                        >
                            {word}
                        </button>
                    ))}
                </div>
            )}

            {/* List Display */}
            {displayMode === 'list' && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1">
                    {words.slice(0, wordCount).map(({ word, count }, idx) => (
                        <button
                            key={word}
                            onClick={() => handleWordClick(word)}
                            className="flex items-center justify-between py-2 border-b border-neutral-100 hover:bg-neutral-50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <span className={idx < 3 ? STYLES.rankAccent : STYLES.rank}>
                                    {idx + 1}
                                </span>
                                <span className="font-mono text-[13px] text-neutral-900 hover:text-accent">
                                    {word}
                                </span>
                            </div>
                            <span className="font-mono text-[12px] text-neutral-400 tabular-nums">
                                {count}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* User Stats */}
            <div className="mt-8 pt-6 border-t border-neutral-100">
                <div className="flex items-center gap-8">
                    <div>
                        <p className={STYLES.dataLabel}>Total Unique Words</p>
                        <p className={STYLES.dataValue}>{words.length.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className={STYLES.dataLabel}>Top Word</p>
                        <p className="font-display text-2xl font-semibold text-accent">
                            {words[0]?.word || '—'}
                        </p>
                    </div>
                    <div>
                        <p className={STYLES.dataLabel}>Most Used</p>
                        <p className={STYLES.dataValue}>{words[0]?.count?.toLocaleString() || '—'} times</p>
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
                onJumpToMessage={onJumpToMessage}
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
