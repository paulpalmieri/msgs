/**
 * Aggregates to Processed Data Converter
 * ======================================
 * Converts pre-computed aggregates (from parseMessenger v2.0 or demo) to the 
 * processedData format expected by the analytics components.
 * 
 * Supports schema v1.0 (legacy) and v2.0 (current)
 */

import { format } from 'date-fns';

/**
 * Convert aggregates to processedData format
 * @param {Object} aggregates - Pre-computed aggregates
 * @returns {Object} ProcessedData format matching processData output
 */
export function aggregatesToProcessed(aggregates) {
    if (!aggregates || !aggregates.global) {
        return createEmptyProcessed();
    }

    const global = aggregates.global;
    const monthly = aggregates.monthly || {};
    const yearly = aggregates.yearly || {};
    const userMonthly = aggregates.user_monthly || {};
    const userTotals = aggregates.user_totals || {};
    const daily = aggregates.daily || {};
    const reactionNetwork = aggregates.reaction_network || {};
    
    // Detect schema version
    const schemaVersion = aggregates.schema_version || '1.0';
    
    // Calculate average messages per month
    const monthCount = Object.keys(monthly).length;
    const totalMessages = global.total_messages || 0;
    const avgPerMonth = monthCount > 0 ? Math.round(totalMessages / monthCount) : 0;
    
    // Basic stats
    const stats = {
        total_messages: totalMessages,
        total_words: global.total_words || 0,
        total_reactions: global.total_reactions || 0,
        active_members: global.all_users?.length || 0,
        days_active: aggregates.streaks?.total_active_days || Object.keys(daily).length,
        first_date: global.first_date_ms ? new Date(global.first_date_ms) : null,
        last_date: global.last_date_ms ? new Date(global.last_date_ms) : null,
        avg_per_month: avgPerMonth,
    };

    // Temporal data - build from monthly aggregates
    const temporal = buildTemporalData(monthly, aggregates.timezone);

    // User stats
    const users = buildUserStats(userTotals, userMonthly, reactionNetwork);

    // Emoji counts from yearly data
    const emojis = buildEmojiCounts(yearly, aggregates.top_content_emojis);

    // Network graph
    const network = buildNetwork(userTotals, reactionNetwork);

    // Pattern stats
    const patterns = buildPatternStats(userTotals, userMonthly, yearly, reactionNetwork, aggregates);

    // Creative stats
    const creative = buildCreativeStats(aggregates);

    // Build synthetic messages for components that need them
    const messages = buildSyntheticMessages(userMonthly, daily);

    return {
        stats,
        temporal,
        users,
        emojis,
        network,
        networkMatrix: reactionNetwork,
        messages,
        creative,
        patterns,
        // v2.0 additions
        timezone: aggregates.timezone || null,
        sessions: aggregates.sessions || null,
        streaks: aggregates.streaks || null,
        gaps: aggregates.gaps || null,
        contentTypes: aggregates.content_types || null,
        topDomains: aggregates.top_domains || [],
        topWords: aggregates.top_words || [],
        calls: aggregates.calls || null,
        // v2.1 additions - Content Analysis
        topReactedMessages: aggregates.top_reacted_messages || [],
        wordIndex: aggregates.word_index || {},
        userWords: aggregates.user_words || {},
        phrases: aggregates.phrases || { bigrams: [], trigrams: [], user_bigrams: {} },
        uniqueWords: aggregates.unique_words || {},
        wordTrends: aggregates.word_trends || {},
        sentiment: aggregates.sentiment || null,
        // v2.2 additions - Full Message Storage
        messageStore: aggregates.message_store || [],
        wordToMessages: aggregates.word_to_messages || {},
        userSentimentMessages: aggregates.user_sentiment_messages || {},
        schemaVersion,
    };
}

function buildTemporalData(monthly, timezone) {
    const monthlyData = {};
    const hourlyTotals = Array(24).fill(0);
    const dailyTotals = Array(7).fill(0);

    Object.entries(monthly).forEach(([monthKey, data]) => {
        monthlyData[monthKey] = data.messages || 0;
        
        // Accumulate hourly/daily
        if (data.hourly) {
            data.hourly.forEach((count, i) => hourlyTotals[i] += count);
        }
        if (data.daily) {
            data.daily.forEach((count, i) => dailyTotals[i] += count);
        }
    });

    // Apply timezone offset if available
    const tzOffset = timezone?.inferred_offset_hours || 0;
    const adjustedHourly = Array(24).fill(0);
    if (tzOffset !== 0) {
        hourlyTotals.forEach((count, utcHour) => {
            const localHour = (utcHour + tzOffset + 24) % 24;
            adjustedHourly[localHour] += count;
        });
    } else {
        hourlyTotals.forEach((count, i) => adjustedHourly[i] = count);
    }

    // Convert to labeled format
    const hourlyLabeled = {};
    adjustedHourly.forEach((count, hour) => {
        hourlyLabeled[hour] = count;
    });

    // Note: dailyTotals is already Mon=0, but JS getDay() uses Sun=0
    // Our aggregates use Mon=0, so we need to reorder for display
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyLabeled = {};
    dailyTotals.forEach((count, i) => {
        dailyLabeled[dayNames[i]] = count;
    });

    return {
        monthly: monthlyData,
        hourly: hourlyLabeled,
        daily: dailyLabeled,
        timezoneOffset: tzOffset,
    };
}

function buildUserStats(userTotals, userMonthly, reactionNetwork) {
    const users = {};

    Object.entries(userTotals).forEach(([name, data]) => {
        users[name] = {
            messages: data.messages || 0,
            reactions_received: data.reactions_received || 0,
            reactions_given: data.reactions_given || 0,
            avg_length: data.avg_message_length || (data.total_chars && data.messages ? data.total_chars / data.messages : 0),
            avg_words: parseFloat(data.avg_words_per_message) || 0,
            vocabulary: 0, // Can't compute without content
            efficiency: data.messages > 0 ? (data.reactions_received / data.messages) : 0,
            active_days: data.active_days || 0,
            avg_response_time_ms: data.avg_response_time_ms || 0,
            first_message: data.first_message_ms ? new Date(data.first_message_ms) : null,
            last_message: data.last_message_ms ? new Date(data.last_message_ms) : null,
            links_shared: data.links_shared || 0,
            mentions_given: data.mentions_given || 0,
            mentions_received: data.mentions_received || 0,
            media: data.media || { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 },
        };
    });

    return users;
}

function buildEmojiCounts(yearly, topContentEmojis) {
    const emojis = {};
    
    // Reaction emojis from yearly data
    Object.values(yearly).forEach(yearData => {
        (yearData.top_emojis || []).forEach(({ emoji, count }) => {
            emojis[emoji] = (emojis[emoji] || 0) + count;
        });
    });

    // Also include content emojis if available
    if (topContentEmojis && Array.isArray(topContentEmojis)) {
        topContentEmojis.forEach(({ emoji, count }) => {
            // Mark these differently or merge
            if (!emojis[emoji]) {
                emojis[emoji] = count;
            }
        });
    }

    return emojis;
}

function buildNetwork(userTotals, reactionNetwork) {
    const nodes = Object.entries(userTotals).map(([name, data]) => ({
        id: name,
        label: name,
        size: data.reactions_received || 0,
    }));

    const edges = Object.entries(reactionNetwork)
        .map(([key, count]) => {
            const [source, target] = key.split('|');
            return { source, target, weight: count };
        })
        .filter(e => e.weight > 5);

    return { nodes, edges };
}

function buildPatternStats(userTotals, userMonthly, yearly, reactionNetwork, aggregates) {
    // Streaks - use max_streak_days if available, otherwise fall back to active_days
    const streaks = Object.entries(userTotals)
        .map(([name, data]) => ({
            name,
            days: data.max_streak_days || data.active_days || 0,
        }))
        .sort((a, b) => b.days - a.days);

    // Media spam
    const mediaSpam = Object.entries(userTotals)
        .map(([name, data]) => ({
            name,
            photos: data.media?.photos || 0,
            videos: data.media?.videos || 0,
            gifs: data.media?.gifs || 0,
            audio: data.media?.audio || 0,
            files: data.media?.files || 0,
            stickers: data.media?.stickers || 0,
            total: (data.media?.photos || 0) + (data.media?.videos || 0) + 
                   (data.media?.gifs || 0) + (data.media?.audio || 0) +
                   (data.media?.files || 0) + (data.media?.stickers || 0),
        }))
        .sort((a, b) => b.total - a.total);

    // Emoji leaderboard (reactions)
    const allEmojis = {};
    Object.values(yearly).forEach(yearData => {
        (yearData.top_emojis || []).forEach(({ emoji, count }) => {
            allEmojis[emoji] = (allEmojis[emoji] || 0) + count;
        });
    });
    const emojiLeaderboard = Object.entries(allEmojis)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

    // Reaction efficiency
    const reactionEfficiency = Object.entries(userTotals)
        .filter(([_, data]) => data.messages >= 10)
        .map(([name, data]) => ({
            name,
            efficiency: data.messages > 0 ? (data.reactions_received / data.messages) : 0,
            reactions: data.reactions_received || 0,
            messages: data.messages || 0,
        }))
        .sort((a, b) => b.efficiency - a.efficiency);

    // Initiators - use session data if available
    const initiators = aggregates.sessions?.initiator_counts
        ? Object.entries(aggregates.sessions.initiator_counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        : Object.entries(userTotals)
            .filter(([_, data]) => data.initiations > 0)
            .map(([name, data]) => ({ name, count: data.initiations }))
            .sort((a, b) => b.count - a.count);

    // User hourly activity
    const userHourlyActivity = Object.entries(userMonthly).map(([name, months]) => {
        const hourly = Array(24).fill(0);
        Object.values(months).forEach(monthData => {
            if (monthData.hourly) {
                monthData.hourly.forEach((count, i) => hourly[i] += count);
            }
        });
        return { name, data: hourly };
    });

    // Build user detailed stats (needed for Wrapped)
    const userDetailedStats = buildUserDetailedStats(userTotals, userMonthly, reactionNetwork, aggregates);

    // Response times
    const responseTimes = Object.entries(userTotals)
        .filter(([_, data]) => data.avg_response_time_ms > 0)
        .map(([name, data]) => ({
            name,
            avg_ms: data.avg_response_time_ms,
            avg_readable: formatResponseTime(data.avg_response_time_ms),
        }))
        .sort((a, b) => a.avg_ms - b.avg_ms);

    // Links shared leaderboard
    const linkLeaderboard = Object.entries(userTotals)
        .filter(([_, data]) => data.links_shared > 0)
        .map(([name, data]) => ({ name, count: data.links_shared }))
        .sort((a, b) => b.count - a.count);

    return {
        streaks,
        mediaSpam,
        emojiLeaderboard,
        voiceNoteCount: mediaSpam.reduce((sum, u) => sum + u.audio, 0),
        reactionEfficiency,
        initiators,
        userHourlyActivity,
        userEmojiCounts: {},
        userDetailedStats,
        responseTimes,
        linkLeaderboard,
        maxStreak: aggregates.streaks || null,
        maxGap: aggregates.gaps || null,
    };
}

function formatResponseTime(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
}

function buildCreativeStats(aggregates) {
    const creative = {
        initiators: {},
        topDomains: aggregates.top_domains || [],
        topWords: aggregates.top_words || [],
        contentEmojis: aggregates.top_content_emojis || [],
        contentTypes: aggregates.content_types || {},
        calls: aggregates.calls || { total_calls: 0, total_duration_sec: 0 },
        bumps: aggregates.bumps || { total: 0 },
        unsent: aggregates.unsent || { total: 0 },
        stickers: aggregates.stickers || { total: 0 },
    };

    // Build initiators from session data or user_totals
    if (aggregates.sessions?.initiator_counts) {
        creative.initiators = aggregates.sessions.initiator_counts;
    } else if (aggregates.user_totals) {
        Object.entries(aggregates.user_totals).forEach(([name, data]) => {
            if (data.initiations > 0) {
                creative.initiators[name] = data.initiations;
            }
        });
    }

    return creative;
}

function buildUserDetailedStats(userTotals, userMonthly, reactionNetwork, aggregates) {
    const userDetailedStats = {};
    const userContentTypes = aggregates.user_content_types || {};
    
    // Get global top emojis from yearly data (to use as fallback for reaction_counts)
    const globalTopEmojis = {};
    Object.values(aggregates.yearly || {}).forEach(yearData => {
        (yearData.top_emojis || []).forEach(({ emoji, count }) => {
            globalTopEmojis[emoji] = (globalTopEmojis[emoji] || 0) + count;
        });
    });

    Object.entries(userTotals).forEach(([name, data]) => {
        // Build hourly from monthly data
        const hourly = Array(24).fill(0);
        const day_of_week = Array(7).fill(0);
        const monthly_activity = {};
        const daily_activity = {};

        if (userMonthly[name]) {
            Object.entries(userMonthly[name]).forEach(([monthKey, monthData]) => {
                // Extract month name
                const [year, month] = monthKey.split('-');
                const monthName = format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM');
                monthly_activity[monthName] = (monthly_activity[monthName] || 0) + (monthData.messages || 0);

                if (monthData.hourly) {
                    monthData.hourly.forEach((count, i) => hourly[i] += count);
                }
                if (monthData.daily) {
                    monthData.daily.forEach((count, i) => day_of_week[i] += count);
                }
            });
        }

        // Build reactions_details from network
        const reactions_details = { received: {}, given: {} };
        const reaction_counts = { received: {}, given: {} };

        Object.entries(reactionNetwork).forEach(([key, count]) => {
            const [reactor, receiver] = key.split('|');
            if (receiver === name) {
                reactions_details.received[reactor] = count;
            }
            if (reactor === name) {
                reactions_details.given[receiver] = count;
            }
        });
        
        // Populate reaction_counts.given with global emojis proportional to user's reactions_given
        // Since we don't have per-user emoji breakdown in aggregates, use global data as approximation
        const userReactionsGiven = data.reactions_given || 0;
        const totalGlobalEmojis = Object.values(globalTopEmojis).reduce((a, b) => a + b, 0);
        if (userReactionsGiven > 0 && totalGlobalEmojis > 0) {
            Object.entries(globalTopEmojis).forEach(([emoji, count]) => {
                // Estimate user's share of each emoji proportionally
                const proportion = count / totalGlobalEmojis;
                const estimatedCount = Math.round(userReactionsGiven * proportion);
                if (estimatedCount > 0) {
                    reaction_counts.given[emoji] = estimatedCount;
                }
            });
        }

        // Content types for this user
        const contentTypes = userContentTypes[name] || {};

        userDetailedStats[name] = {
            messages: data.messages || 0,
            reactions_received: data.reactions_received || 0,
            reactions_given: data.reactions_given || 0,
            total_length: data.total_chars || 0,
            total_words: data.total_words || 0,
            words: new Set(),
            hourly,
            day_of_week,
            daily_activity,
            monthly_activity,
            weekly_activity: {},
            reactions_details,
            reaction_counts,
            message_emojis: {},
            initiator_count: data.initiations || 0,
            efficiency: data.messages > 0 ? (data.reactions_received / data.messages) : 0,
            media: data.media || { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 },
            active_days: data.active_days || 0,
            avg_response_time_ms: data.avg_response_time_ms || 0,
            first_message_ms: data.first_message_ms || null,
            last_message_ms: data.last_message_ms || null,
            links_shared: data.links_shared || 0,
            mentions_given: data.mentions_given || 0,
            content_types: contentTypes,
        };
    });

    return userDetailedStats;
}

function buildSyntheticMessages(userMonthly, daily) {
    const messages = [];
    
    // Build from daily data for better distribution
    Object.entries(daily).forEach(([dateStr, dayData]) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const msgCount = dayData.messages || 0;
        
        // Distribute messages among users (rough approximation)
        Object.keys(userMonthly).forEach(userName => {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const userMonth = userMonthly[userName]?.[monthKey];
            if (!userMonth) return;
            
            // Estimate daily messages for this user
            const userMonthMsgs = userMonth.messages || 0;
            const daysInMonth = new Date(year, month, 0).getDate();
            const estimatedUserDaily = Math.round(userMonthMsgs / daysInMonth);
            
            for (let i = 0; i < Math.min(estimatedUserDaily, 5); i++) {
                const hour = userMonth.hourly 
                    ? userMonth.hourly.indexOf(Math.max(...userMonth.hourly))
                    : 12;
                
                messages.push({
                    sender_name: userName,
                    timestamp_ms: new Date(year, month - 1, day, hour, i * 10).getTime(),
                    year,
                    content: '',
                    reactions: [],
                    type: 'Generic',
                });
            }
        });
    });

    messages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    return messages;
}

function createEmptyProcessed() {
    return {
        stats: { total_messages: 0, total_words: 0, total_reactions: 0, active_members: 0, days_active: 0, first_date: null, last_date: null, avg_per_month: 0 },
        temporal: { monthly: {}, hourly: {}, daily: {}, timezoneOffset: 0 },
        users: {},
        emojis: {},
        network: { nodes: [], edges: [] },
        networkMatrix: {},
        messages: [],
        creative: {
            initiators: {},
            topDomains: [],
            topWords: [],
            contentEmojis: [],
            contentTypes: {},
            calls: { total_calls: 0, total_duration_sec: 0 },
            bumps: { total: 0 },
            unsent: { total: 0 },
            stickers: { total: 0 },
        },
        patterns: {
            emojiLeaderboard: [],
            streaks: [],
            mediaSpam: [],
            voiceNoteCount: 0,
            reactionEfficiency: [],
            initiators: [],
            userHourlyActivity: [],
            userEmojiCounts: {},
            userDetailedStats: {},
            responseTimes: [],
            linkLeaderboard: [],
            maxStreak: null,
            maxGap: null,
        },
        timezone: null,
        sessions: null,
        streaks: null,
        gaps: null,
        contentTypes: null,
        topDomains: [],
        topWords: [],
        calls: null,
        // v2.1 additions - Content Analysis
        topReactedMessages: [],
        wordIndex: {},
        userWords: {},
        phrases: { bigrams: [], trigrams: [], user_bigrams: {} },
        uniqueWords: {},
        wordTrends: {},
        sentiment: null,
        // v2.2 additions - Full Message Storage
        messageStore: [],
        wordToMessages: {},
        userSentimentMessages: {},
        schemaVersion: '2.2',
    };
}

export default aggregatesToProcessed;
