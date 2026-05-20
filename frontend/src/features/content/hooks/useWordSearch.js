import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Normalize text for searching - optionally remove accents and/or change case
 */
function normalizeText(text, ignoreCase = true, ignoreAccents = true) {
    if (!text) return '';
    let normalized = text;
    if (ignoreAccents) {
        // Remove accents/diacritics
        normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    if (ignoreCase) {
        normalized = normalized.toLowerCase();
    }
    return normalized;
}

/**
 * Hook for debounced text search with full sentence support
 * Searches through message store for any text/sentence
 * @param {Object} wordIndex - Word index from aggregates
 * @param {Array} messageStore - Full message store array
 * @param {number} debounceMs - Debounce delay in milliseconds
 * @param {Array} selectedYears - Selected years filter
 */
export function useWordSearch(wordIndex, messageStore = [], debounceMs = 300, selectedYears = []) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [options, setOptions] = useState({
        ignoreCase: true,
        ignoreAccents: true,
    });

    // Build a list of all words for suggestions
    const allWords = useMemo(() => {
        return Object.entries(wordIndex || {})
            .map(([word, data]) => ({ word, count: data.total_count }))
            .sort((a, b) => b.count - a.count);
    }, [wordIndex]);

    // Pre-normalize all messages for faster searching, filtered by year
    const normalizedMessages = useMemo(() => {
        const yearsSet = new Set(selectedYears);
        return messageStore
            .filter(msg => {
                if (selectedYears.length === 0) return true;
                if (!msg.timestamp_ms) return true;
                const msgYear = new Date(msg.timestamp_ms).getFullYear();
                return yearsSet.has(msgYear);
            })
            .map(msg => ({
                ...msg,
                normalizedContent: normalizeText(msg.content, true, true), // Pre-normalize fully
            }));
    }, [messageStore, selectedYears]);

    useEffect(() => {
        if (!query || query.length < 2) {
            setResults(null);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        const timer = setTimeout(() => {
            const { ignoreCase, ignoreAccents } = options;
            const normalizedQuery = normalizeText(query.trim(), ignoreCase, ignoreAccents);

            // Check if it's a single word that exists in wordIndex
            const singleWord = query.trim().toLowerCase();
            const exactWordMatch = wordIndex?.[singleWord];

            // Search through message store for the text
            const matchingMessages = [];
            const userCounts = {};
            const yearCounts = {};
            const monthCounts = {};

            for (const msg of normalizedMessages) {
                // Use full normalization for searching
                const searchContent = ignoreCase && ignoreAccents
                    ? msg.normalizedContent
                    : normalizeText(msg.content, ignoreCase, ignoreAccents);

                if (searchContent.includes(normalizedQuery)) {
                    matchingMessages.push(msg);

                    // Track by user
                    userCounts[msg.sender] = (userCounts[msg.sender] || 0) + 1;

                    // Track by year/month
                    if (msg.timestamp_ms) {
                        const date = new Date(msg.timestamp_ms);
                        const year = date.getFullYear();
                        const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        yearCounts[year] = (yearCounts[year] || 0) + 1;
                        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
                    }
                }
            }

            if (matchingMessages.length > 0 || exactWordMatch) {
                // Found matches - combine with word index data if available
                setResults({
                    query: query.trim(),
                    found: true,
                    total_count: matchingMessages.length || exactWordMatch?.total_count || 0,
                    by_user: Object.keys(userCounts).length > 0 ? userCounts : (exactWordMatch?.by_user || {}),
                    by_year: Object.keys(yearCounts).length > 0 ? yearCounts : (exactWordMatch?.by_year || {}),
                    by_month: Object.keys(monthCounts).length > 0 ? monthCounts : (exactWordMatch?.by_month || {}),
                    samples: matchingMessages.slice(0, 10),
                    allMatches: matchingMessages,
                    word: exactWordMatch ? singleWord : query.trim(),
                    isPhrase: query.trim().includes(' '),
                });
            } else {
                // No matches - show suggestions from word index
                const startsWith = allWords
                    .filter(({ word }) => normalizeText(word, ignoreCase, ignoreAccents).startsWith(normalizedQuery))
                    .slice(0, 5);

                const contains = allWords
                    .filter(({ word }) => {
                        const normalized = normalizeText(word, ignoreCase, ignoreAccents);
                        return !normalized.startsWith(normalizedQuery) && normalized.includes(normalizedQuery);
                    })
                    .slice(0, 5);

                const suggestions = [...startsWith, ...contains].slice(0, 10);

                setResults({
                    found: false,
                    suggestions,
                    query: query.trim(),
                });
            }

            setIsSearching(false);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [query, wordIndex, normalizedMessages, allWords, options, debounceMs]);

    const selectWord = useCallback((word) => {
        setQuery(word);
    }, []);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults(null);
    }, []);

    const toggleOption = useCallback((optionName) => {
        setOptions(prev => ({
            ...prev,
            [optionName]: !prev[optionName],
        }));
    }, []);

    return {
        query,
        setQuery,
        results,
        isSearching,
        selectWord,
        clearSearch,
        allWords,
        options,
        toggleOption,
    };
}

export default useWordSearch;
