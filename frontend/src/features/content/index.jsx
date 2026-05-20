import React, { useState } from 'react';
import { ActiveFilters } from '../../components/layout';
import {
    TopReactedSection,
    WordSearchSection,
    WordCloudSection,
    PhraseSection,
    UniqueVocabSection,
    WordTrendsSection,
    SentimentSection,
    PopularWordsSection,
    ExcludedWordsPanel,
    ConversationSection,
} from './components';

/**
 * Content Page
 * ============
 * Content analysis dashboard with word search, vocabulary insights,
 * top messages, phrases, and sentiment analysis.
 *
 * Design: Minimal, screenshot-worthy sections with consistent styling.
 */
export default function ContentPage({
    processedData,
    aggregates,
    isFiltered,
    selectedYears,
    selectedUsers,
    allYears,
    allUsers,
    onRemoveYear,
    onResetUsers,
    onClearAllFilters,
}) {
    const [excludedWords, setExcludedWords] = useState([]);
    const [scrollToMessageId, setScrollToMessageId] = useState(null);

    const handleJumpToMessage = (id) => {
        setScrollToMessageId(id);
        // Clear it after a short delay so the same message can be jumped to again if needed
        setTimeout(() => setScrollToMessageId(null), 1000);
    };

    if (!processedData) return null;

    const {
        topReactedMessages,
        wordIndex,
        userWords,
        phrases,
        uniqueWords,
        wordTrends,
        sentiment,
        messageStore,
        wordToMessages,
        userSentimentMessages,
    } = processedData;

    return (
        <div className="animate-fade-in">
            {/* Active Filters Display */}
            <ActiveFilters
                selectedYears={selectedYears}
                allYears={allYears}
                selectedUsers={selectedUsers}
                allUsers={allUsers}
                onRemoveYear={onRemoveYear}
                onResetUsers={onResetUsers}
                onClearAll={onClearAllFilters}
            />

            {/* Excluded Words Panel */}
            <ExcludedWordsPanel
                excludedWords={excludedWords}
                onChange={setExcludedWords}
            />

            {/* ========================================
                SECTION 01: WORD SEARCH
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider section-divider-first">
                    <div className="section-divider-label">01</div>
                    <h2 className="section-divider-title">SEARCH</h2>
                </div>
                <WordSearchSection
                    wordIndex={wordIndex}
                    wordTrends={wordTrends}
                    messageStore={messageStore}
                    selectedYears={selectedYears}
                    excludedWords={excludedWords}
                    onJumpToMessage={handleJumpToMessage}
                />
            </section>

            {/* ========================================
                SECTION 02: POPULAR WORDS
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider">
                    <div className="section-divider-label">02</div>
                    <h2 className="section-divider-title">POPULAR WORDS</h2>
                </div>
                <PopularWordsSection
                    wordIndex={wordIndex}
                    selectedYears={selectedYears}
                    wordToMessages={wordToMessages}
                    messageStore={messageStore}
                    excludedWords={excludedWords}
                />
            </section>

            {/* ========================================
                SECTION 03: TOP REACTIONS
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider">
                    <div className="section-divider-label">03</div>
                    <h2 className="section-divider-title">TOP REACTIONS</h2>
                </div>
                <TopReactedSection
                    messages={topReactedMessages}
                    selectedYears={selectedYears}
                    selectedUsers={selectedUsers}
                    onJumpToMessage={handleJumpToMessage}
                />
            </section>

            {/* ========================================
                SECTION 04: VOCABULARY
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider">
                    <div className="section-divider-label">04</div>
                    <h2 className="section-divider-title">VOCABULARY</h2>
                </div>
                <div className="space-y-14 lg:space-y-18">
                    <WordCloudSection
                        userWords={userWords}
                        selectedUsers={selectedUsers}
                        selectedYears={selectedYears}
                        wordIndex={wordIndex}
                        wordToMessages={wordToMessages}
                        messageStore={messageStore}
                        excludedWords={excludedWords}
                        onJumpToMessage={handleJumpToMessage}
                    />
                    <UniqueVocabSection
                        uniqueWords={uniqueWords}
                        selectedUsers={selectedUsers}
                        selectedYears={selectedYears}
                        wordToMessages={wordToMessages}
                        messageStore={messageStore}
                        excludedWords={excludedWords}
                    />
                </div>
            </section>

            {/* ========================================
                SECTION 05: PHRASES
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider">
                    <div className="section-divider-label">05</div>
                    <h2 className="section-divider-title">PHRASES</h2>
                </div>
                <PhraseSection
                    phrases={phrases}
                    selectedUsers={selectedUsers}
                    selectedYears={selectedYears}
                    messageStore={messageStore}
                    onJumpToMessage={handleJumpToMessage}
                />
            </section>

            {/* ========================================
                SECTION 06: TRENDS & SENTIMENT
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider">
                    <div className="section-divider-label">06</div>
                    <h2 className="section-divider-title">INSIGHTS</h2>
                </div>
                <div className="space-y-14 lg:space-y-18">
                    <WordTrendsSection
                        wordTrends={wordTrends}
                        selectedYears={selectedYears}
                        excludedWords={excludedWords}
                    />
                    <SentimentSection
                        sentiment={sentiment}
                        selectedUsers={selectedUsers}
                        selectedYears={selectedYears}
                        userSentimentMessages={userSentimentMessages}
                        messageStore={messageStore}
                        onJumpToMessage={handleJumpToMessage}
                    />
                </div>
            </section>

            {/* ========================================
                SECTION 07: CONVERSATION
            ======================================== */}
            <section className="mb-14 lg:mb-18">
                <div className="section-divider">
                    <div className="section-divider-label">07</div>
                    <h2 className="section-divider-title">CONVERSATION</h2>
                </div>
                <ConversationSection
                    messageStore={messageStore}
                    selectedYears={selectedYears}
                    selectedUsers={selectedUsers}
                    jumpToMessageId={scrollToMessageId}
                />
            </section>
        </div>
    );
}
