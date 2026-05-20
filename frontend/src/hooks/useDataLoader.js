import { useState, useRef, useCallback } from 'react';
import { aggregatesToProcessed } from '../utils/aggregatesToProcessed';

/**
 * Hook for managing loaded conversation data
 * Handles:
 * - Storing conversation list and active conversation
 * - Converting aggregates to processed format
 * - Conversation switching
 * - Demo data initialization
 * 
 * @returns {Object} Data loading state and processed data
 */
export function useDataLoader() {
    // Conversation state
    const [conversations, setConversations] = useState([]);
    const [conversationFiles, setConversationFiles] = useState(null);
    const [activeConversation, setActiveConversation] = useState(null);
    const [conversationData, setConversationData] = useState(null);
    
    // Aggregates from parsing
    const [aggregates, setAggregates] = useState(null);
    
    // Filtered aggregates (after user/year filters applied)
    const [filteredAggregates, setFilteredAggregates] = useState(null);
    
    // Processed data (converted from aggregates)
    const [processedData, setProcessedData] = useState(null);
    
    // Synthetic messages for filter compatibility
    const [syntheticMessages, setSyntheticMessages] = useState([]);
    
    // All available users and years (from aggregates)
    const [allUsers, setAllUsers] = useState([]);
    const [allYears, setAllYears] = useState([]);
    
    // Loading state
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingPhase, setLoadingPhase] = useState('');
    
    // Updating state (filter changes)
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingProgress, setUpdatingProgress] = useState(0);
    const [updatingPhase, setUpdatingPhase] = useState('process');
    
    // Data loading status - use STATE instead of ref so React tracks changes
    const [dataLoadStatus, setDataLoadStatus] = useState('idle'); // 'idle' | 'loaded' | 'processed'
    
    // Track if initial processing is done (ref is fine here, we don't need to trigger re-renders)
    const initialLoadComplete = useRef(false);
    
    // Legacy ref for backwards compatibility
    const dataLoaded = useRef(false);
    
    // Map of conversation ID -> aggregates for instant switching (restored sessions)
    const aggregatesMapRef = useRef({});

    /**
     * Set demo data directly
     * @param {Object} data - Demo data object
     */
    const setDemoData = useCallback((data) => {
        const { aggregates: aggs, messages, conversation } = data;
        
        setAggregates(aggs);
        setSyntheticMessages(messages);
        setActiveConversation(conversation);
        setConversations([conversation]);
        
        // Extract users and years from aggregates
        const users = aggs?.global?.all_users || [];
        const years = aggs?.global?.all_years || [];
        
        setAllUsers(users);
        setAllYears(years);
        
        dataLoaded.current = true;
        setDataLoadStatus('loaded');
    }, []);

    /**
     * Set data from UploadPage / WelcomeModal
     * All conversations come pre-parsed with aggregates
     * @param {Object} data - Data from upload
     */
    const setUploadedData = useCallback((data) => {
        const aggs = data.conversationData.aggregates;
        const totalMessages = aggs?.global?.total_messages || 0;
        
        // Update active conversation with actual message count
        const activeConvWithCount = {
            ...data.activeConversation,
            totalMessages,
            hasAggregates: true,
        };
        
        // All conversations are pre-parsed, mark them all as having aggregates
        const updatedConversations = data.conversations.map(conv => ({
            ...conv,
            hasAggregates: true,
        }));
        
        setConversations(updatedConversations);
        setConversationFiles(data.conversationFiles);
        setActiveConversation(activeConvWithCount);
        setConversationData(data.conversationData);
        
        setAggregates(aggs);
        
        // Cache ALL aggregates for instant switching
        if (data.allAggregates) {
            aggregatesMapRef.current = { ...data.allAggregates };
        } else {
            aggregatesMapRef.current = {};
            for (const conv of data.conversations) {
                if (conv.aggregates) {
                    aggregatesMapRef.current[conv.id] = conv.aggregates;
                }
            }
        }
        
        // Extract users and years from aggregates
        const users = aggs?.global?.all_users || [];
        const years = aggs?.global?.all_years || [];
        
        setAllUsers(users);
        setAllYears(years);
        
        // Build synthetic messages for filter compatibility
        const synthetic = buildSyntheticMessages(aggs);
        setSyntheticMessages(synthetic);
        
        // Reset processing state for new data
        setProcessedData(null);
        initialLoadComplete.current = false;
        dataLoaded.current = true;
        setDataLoadStatus('loaded');
    }, []);

    /**
     * Set data restored from localStorage session
     * Supports multiple conversations with pre-computed aggregates
     * @param {Object} data - Restored data with conversations and aggregatesMap
     */
    const setRestoredData = useCallback((data) => {
        const { 
            conversations: restoredConversations, 
            aggregatesMap,
            activeConversation: activeConv,
            activeAggregates 
        } = data;
        
        // Set all conversations (for dropdown)
        setConversations(restoredConversations || []);
        
        // Set active conversation and its aggregates
        setActiveConversation(activeConv);
        setAggregates(activeAggregates);
        
        // Store aggregates map for instant switching
        aggregatesMapRef.current = aggregatesMap || {};
        
        setConversationFiles(null);
        setConversationData(null);
        
        // Extract users and years from active aggregates
        const users = activeAggregates?.global?.all_users || [];
        const years = activeAggregates?.global?.all_years || [];
        
        setAllUsers(users);
        setAllYears(years);
        
        // Build synthetic messages for filter compatibility
        const synthetic = buildSyntheticMessages(activeAggregates);
        setSyntheticMessages(synthetic);
        
        // Reset processing state for new data
        setProcessedData(null);
        initialLoadComplete.current = false;
        dataLoaded.current = true;
        setDataLoadStatus('loaded');
    }, []);

    /**
     * Switch to a different conversation
     * Checks aggregatesMap first for instant switching (restored sessions)
     * Falls back to parsing if raw files are available
     * @param {Object} conversation - Conversation to switch to
     * @param {function} parseConversation - Function to parse the conversation
     * @param {function} onProgress - Progress callback
     * @param {function} onSave - Callback to save newly parsed conversation
     */
    const switchConversation = useCallback(async (conversation, parseConversation, onProgress, onSave) => {
        initialLoadComplete.current = false;
        setDataLoadStatus('idle');
        
        // Check if we have pre-computed aggregates (restored session)
        const cachedAggregates = aggregatesMapRef.current[conversation.id];
        if (cachedAggregates) {
            // Instant switch - no loading needed
            setActiveConversation(conversation);
            
            const aggs = cachedAggregates;
            setAggregates(aggs);
            
            const users = aggs?.global?.all_users || [];
            const years = aggs?.global?.all_years || [];
            
            setAllUsers(users);
            setAllYears(years);
            
            const synthetic = buildSyntheticMessages(aggs);
            setSyntheticMessages(synthetic);
            
            // Reset processed data to trigger reprocessing
            setProcessedData(null);
            setDataLoadStatus('loaded');
            return;
        }
        
        // Need to parse - requires conversationFiles
        if (!conversationFiles) return;
        
        setIsLoading(true);
        setLoadingProgress(0);
        setLoadingPhase('loading');
        
        try {
            const result = await parseConversation(conversation, conversationFiles, (stage, percent) => {
                setLoadingPhase(stage);
                setLoadingProgress(percent);
                if (onProgress) onProgress(stage, percent);
            });
            
            const aggs = result.aggregates;
            const totalMessages = aggs?.global?.total_messages || 0;
            
            // Update conversation with actual message count
            const conversationWithCount = {
                ...conversation,
                totalMessages,
            };
            
            setActiveConversation(conversationWithCount);
            setConversationData(result);
            setAggregates(aggs);
            
            // Update conversations list with actual count
            setConversations(prev => prev.map(conv => 
                conv.id === conversation.id 
                    ? { ...conv, totalMessages }
                    : conv
            ));
            
            // Cache the aggregates for instant switching later
            aggregatesMapRef.current[conversation.id] = aggs;
            
            const users = aggs?.global?.all_users || [];
            const years = aggs?.global?.all_years || [];
            
            setAllUsers(users);
            setAllYears(years);
            
            const synthetic = buildSyntheticMessages(aggs);
            setSyntheticMessages(synthetic);
            
            // Reset processed data to trigger reprocessing
            setProcessedData(null);
            setDataLoadStatus('loaded');
            
            // Notify parent to save (for localStorage persistence)
            if (onSave) {
                onSave(aggs, conversationWithCount);
            }
            
        } catch (err) {
            console.error('Failed to switch conversation:', err);
        } finally {
            setIsLoading(false);
        }
    }, [conversationFiles]);

    /**
     * Process data with given filters
     * Uses aggregatesToProcessed for conversion instead of re-processing
     * @param {string[]} selectedUsers - Selected user names
     * @param {number[]} selectedYears - Selected years
     * @param {boolean} isInitial - Whether this is initial load
     */
    const processWithFilters = useCallback(async (selectedUsers, selectedYears, isInitial = false) => {
        if (!aggregates) return;
        
        if (isInitial) {
            setIsLoading(true);
            setLoadingProgress(50);
            setLoadingPhase('processing');
        } else {
            setIsUpdating(true);
            setUpdatingProgress(50);
            setUpdatingPhase('processing');
        }

        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 10));

        try {
            // Filter aggregates based on selected users and years
            const filtered = filterAggregates(aggregates, selectedUsers, selectedYears);
            
            // Store filtered aggregates for components that need them
            setFilteredAggregates(filtered);
            
            // Convert aggregates to processed format
            const processed = aggregatesToProcessed(filtered);
            
            setProcessedData(processed);
            
            if (isInitial) {
                setLoadingProgress(100);
                setIsLoading(false);
                initialLoadComplete.current = true;
                setDataLoadStatus('processed');
            } else {
                setUpdatingProgress(100);
                setIsUpdating(false);
            }
        } catch (err) {
            console.error('Failed to process data:', err);
            if (isInitial) {
                setIsLoading(false);
            } else {
                setIsUpdating(false);
            }
        }
    }, [aggregates]);

    return {
        // Conversation state
        conversations,
        conversationFiles,
        activeConversation,
        conversationData,
        
        // Aggregates
        aggregates,
        filteredAggregates,
        processedData,
        
        // For compatibility with existing filter logic
        rawData: syntheticMessages,
        
        // Available options
        allUsers,
        allYears,
        
        // Loading states
        isLoading,
        loadingProgress,
        loadingPhase,
        
        // Updating states
        isUpdating,
        updatingProgress,
        updatingPhase,
        
        // Data status (state-based for proper React tracking)
        dataLoadStatus,
        
        // Methods
        setDemoData,
        setUploadedData,
        setRestoredData,
        switchConversation,
        processWithFilters,
        initialLoadComplete,
        dataLoaded, // Legacy ref
    };
}

/**
 * Filter aggregates based on selected users and years
 * @param {Object} aggregates - Full aggregates
 * @param {string[]} selectedUsers - Selected user names
 * @param {number[]} selectedYears - Selected years
 * @returns {Object} Filtered aggregates
 */
function filterAggregates(aggregates, selectedUsers, selectedYears) {
    if (!aggregates) return aggregates;
    
    const usersSet = new Set(selectedUsers);
    const yearsSet = new Set(selectedYears);
    
    // Filter user_monthly - keep only selected users and years
    const user_monthly = {};
    Object.entries(aggregates.user_monthly || {}).forEach(([userName, months]) => {
        if (usersSet.has(userName)) {
            user_monthly[userName] = {};
            Object.entries(months).forEach(([monthKey, data]) => {
                const year = parseInt(monthKey.split('-')[0]);
                if (yearsSet.has(year)) {
                    user_monthly[userName][monthKey] = data;
                }
            });
        }
    });
    
    // RECALCULATE monthly from filtered user_monthly (not just filter by year)
    const monthly = {};
    Object.values(user_monthly).forEach(userMonths => {
        Object.entries(userMonths).forEach(([monthKey, userData]) => {
            if (!monthly[monthKey]) {
                monthly[monthKey] = {
                    messages: 0,
                    reactions: 0,
                    media: { photos: 0, videos: 0, audio: 0, gifs: 0 },
                    active_users: 0,
                    initiations: 0,
                    total_chars: 0,
                    call_duration: 0,
                    hourly: Array(24).fill(0),
                    daily: Array(7).fill(0),
                };
            }
            
            const m = monthly[monthKey];
            m.messages += userData.messages || 0;
            m.reactions += (userData.reactions_received || 0) + (userData.reactions_given || 0);
            m.initiations += userData.initiations || 0;
            m.total_chars += userData.total_chars || 0;
            
            if (userData.media) {
                m.media.photos += userData.media.photos || 0;
                m.media.videos += userData.media.videos || 0;
                m.media.audio += userData.media.audio || 0;
                m.media.gifs += userData.media.gifs || 0;
            }
            
            if (userData.hourly && Array.isArray(userData.hourly)) {
                userData.hourly.forEach((count, i) => {
                    m.hourly[i] += count || 0;
                });
            }
            
            if (userData.daily && Array.isArray(userData.daily)) {
                userData.daily.forEach((count, i) => {
                    m.daily[i] += count || 0;
                });
            }
        });
    });
    
    // Count active users per month
    Object.keys(monthly).forEach(monthKey => {
        let activeCount = 0;
        Object.entries(user_monthly).forEach(([_, userMonths]) => {
            if (userMonths[monthKey] && userMonths[monthKey].messages > 0) {
                activeCount++;
            }
        });
        monthly[monthKey].active_users = activeCount;
    });
    
    // Filter yearly - but also recalculate key stats
    const yearly = {};
    Object.entries(aggregates.yearly || {}).forEach(([year, data]) => {
        if (yearsSet.has(parseInt(year))) {
            const yearlyHourly = Array(24).fill(0);
            const yearlyDaily = Array(7).fill(0);
            let yearlyMessages = 0;
            
            Object.entries(monthly).forEach(([monthKey, monthData]) => {
                if (monthKey.startsWith(year)) {
                    yearlyMessages += monthData.messages || 0;
                    monthData.hourly.forEach((count, i) => yearlyHourly[i] += count);
                    monthData.daily.forEach((count, i) => yearlyDaily[i] += count);
                }
            });
            
            yearly[year] = {
                ...data,
                messages: yearlyMessages,
                hourly: yearlyHourly,
                daily: yearlyDaily,
                active_users: selectedUsers.length,
            };
        }
    });
    
    // Filter user_totals - recalculate from filtered user_monthly but preserve streak/activity data
    const user_totals = {};
    Object.entries(user_monthly).forEach(([userName, months]) => {
        if (!usersSet.has(userName)) return;
        
        // Get original user totals to preserve streak and activity data
        const originalUserTotals = aggregates.user_totals?.[userName] || {};
        
        const totals = {
            messages: 0,
            reactions_received: 0,
            reactions_given: 0,
            initiations: 0,
            media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 },
            total_chars: 0,
            total_words: 0,
            // Preserve streak and activity data from original
            max_streak_days: originalUserTotals.max_streak_days || 0,
            active_days: originalUserTotals.active_days || 0,
            avg_response_time_ms: originalUserTotals.avg_response_time_ms || 0,
            first_message_ms: originalUserTotals.first_message_ms || null,
            last_message_ms: originalUserTotals.last_message_ms || null,
            links_shared: 0,
        };
        
        Object.values(months).forEach(data => {
            totals.messages += data.messages || 0;
            totals.reactions_received += data.reactions_received || 0;
            totals.reactions_given += data.reactions_given || 0;
            totals.initiations += data.initiations || 0;
            totals.total_chars += data.total_chars || 0;
            totals.total_words += data.total_words || 0;
            totals.links_shared += data.links_shared || 0;
            if (data.media) {
                totals.media.photos += data.media.photos || 0;
                totals.media.videos += data.media.videos || 0;
                totals.media.audio += data.media.audio || 0;
                totals.media.gifs += data.media.gifs || 0;
                totals.media.files += data.media.files || 0;
                totals.media.stickers += data.media.stickers || 0;
            }
        });
        
        user_totals[userName] = totals;
    });
    
    // Filter daily - keep only days in selected years
    const daily = {};
    Object.entries(aggregates.daily || {}).forEach(([dateKey, data]) => {
        const year = parseInt(dateKey.split('-')[0]);
        if (yearsSet.has(year)) {
            daily[dateKey] = data;
        }
    });
    
    // Filter reaction_network - keep only links between selected users
    const reaction_network = {};
    Object.entries(aggregates.reaction_network || {}).forEach(([key, count]) => {
        const [reactor, receiver] = key.split('|');
        if (usersSet.has(reactor) && usersSet.has(receiver)) {
            reaction_network[key] = count;
        }
    });
    
    // Filter reaction_network_yearly if present
    const reaction_network_yearly = {};
    if (aggregates.reaction_network_yearly) {
        Object.entries(aggregates.reaction_network_yearly).forEach(([year, network]) => {
            if (yearsSet.has(parseInt(year))) {
                reaction_network_yearly[year] = {};
                Object.entries(network).forEach(([key, count]) => {
                    const [reactor, receiver] = key.split('|');
                    if (usersSet.has(reactor) && usersSet.has(receiver)) {
                        reaction_network_yearly[year][key] = count;
                    }
                });
            }
        });
    }
    
    // ========== Content Analysis Filtering (v2.1) ==========

    // Filter top_reacted_messages by sender and year
    const top_reacted_messages = (aggregates.top_reacted_messages || [])
        .filter(msg => usersSet.has(msg.sender) && yearsSet.has(msg.year));

    // Filter word_index - recalculate totals for selected users/years
    const word_index = {};
    Object.entries(aggregates.word_index || {}).forEach(([word, data]) => {
        const filteredByUser = {};
        let filteredTotal = 0;

        Object.entries(data.by_user || {}).forEach(([user, count]) => {
            if (usersSet.has(user)) {
                filteredByUser[user] = count;
                filteredTotal += count;
            }
        });

        const filteredByYear = {};
        Object.entries(data.by_year || {}).forEach(([year, count]) => {
            if (yearsSet.has(parseInt(year))) {
                filteredByYear[year] = count;
            }
        });

        const filteredByMonth = {};
        Object.entries(data.by_month || {}).forEach(([monthKey, count]) => {
            const year = parseInt(monthKey.split('-')[0]);
            if (yearsSet.has(year)) {
                filteredByMonth[monthKey] = count;
            }
        });

        if (filteredTotal > 0) {
            word_index[word] = {
                total_count: filteredTotal,
                by_user: filteredByUser,
                by_year: filteredByYear,
                by_month: filteredByMonth,
                samples: (data.samples || []).filter(s => usersSet.has(s.sender)),
            };
        }
    });

    // Filter user_words - keep only selected users
    const user_words = {};
    Object.entries(aggregates.user_words || {}).forEach(([user, words]) => {
        if (usersSet.has(user)) {
            user_words[user] = words;
        }
    });

    // Filter unique_words - keep only selected users
    const unique_words = {};
    Object.entries(aggregates.unique_words || {}).forEach(([user, words]) => {
        if (usersSet.has(user)) {
            unique_words[user] = words;
        }
    });

    // Filter phrases - keep user_bigrams for selected users only
    const phrases = aggregates.phrases ? {
        bigrams: aggregates.phrases.bigrams || [],
        trigrams: aggregates.phrases.trigrams || [],
        user_bigrams: Object.fromEntries(
            Object.entries(aggregates.phrases.user_bigrams || {})
                .filter(([user]) => usersSet.has(user))
        ),
    } : { bigrams: [], trigrams: [], user_bigrams: {} };

    // Filter word_trends - filter by years in monthly/yearly breakdowns
    const word_trends = {};
    Object.entries(aggregates.word_trends || {}).forEach(([word, data]) => {
        const filteredMonthly = {};
        Object.entries(data.monthly || {}).forEach(([monthKey, count]) => {
            const year = parseInt(monthKey.split('-')[0]);
            if (yearsSet.has(year)) {
                filteredMonthly[monthKey] = count;
            }
        });

        const filteredYearly = {};
        Object.entries(data.yearly || {}).forEach(([year, count]) => {
            if (yearsSet.has(parseInt(year))) {
                filteredYearly[year] = count;
            }
        });

        word_trends[word] = {
            monthly: filteredMonthly,
            yearly: filteredYearly,
        };
    });

    // Filter sentiment - by user and by time
    const sentiment = aggregates.sentiment ? {
        overall: aggregates.sentiment.overall,
        by_user: Object.fromEntries(
            Object.entries(aggregates.sentiment.by_user || {})
                .filter(([user]) => usersSet.has(user))
        ),
        by_month: Object.fromEntries(
            Object.entries(aggregates.sentiment.by_month || {})
                .filter(([monthKey]) => yearsSet.has(parseInt(monthKey.split('-')[0])))
        ),
        by_year: Object.fromEntries(
            Object.entries(aggregates.sentiment.by_year || {})
                .filter(([year]) => yearsSet.has(parseInt(year)))
        ),
    } : null;

    // Recalculate global stats
    let totalMessages = 0;
    let totalReactions = 0;
    Object.values(user_totals).forEach(data => {
        totalMessages += data.messages;
        totalReactions += data.reactions_received;
    });

    return {
        ...aggregates,
        monthly,
        user_monthly,
        yearly,
        user_totals,
        daily,
        reaction_network,
        reaction_network_yearly,
        // Content analysis (v2.1)
        top_reacted_messages,
        word_index,
        user_words,
        unique_words,
        phrases,
        word_trends,
        sentiment,
        global: {
            ...aggregates.global,
            total_messages: totalMessages,
            total_reactions: totalReactions,
            all_users: selectedUsers,
            all_years: selectedYears,
        },
    };
}

/**
 * Build synthetic messages from aggregates for filter compatibility
 * @param {Object} aggregates - Aggregates object
 * @returns {Object[]} Synthetic messages
 */
function buildSyntheticMessages(aggregates) {
    if (!aggregates?.user_monthly) return [];
    
    const messages = [];
    const userMonthly = aggregates.user_monthly;
    
    Object.entries(userMonthly).forEach(([userName, months]) => {
        Object.entries(months).forEach(([monthKey, data]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const messageCount = data.messages || 0;
            
            // Create a few synthetic messages per user-month for filtering
            for (let i = 0; i < Math.min(messageCount, 100); i++) {
                const day = Math.floor((i / Math.min(messageCount, 100)) * 28) + 1;
                const hour = 12;
                const timestamp = new Date(year, month - 1, day, hour).getTime();
                
                messages.push({
                    sender_name: userName,
                    timestamp_ms: timestamp,
                    year,
                });
            }
        });
    });
    
    messages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    return messages;
}

export default useDataLoader;
