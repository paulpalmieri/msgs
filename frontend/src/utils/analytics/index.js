/**
 * Analytics Processing
 * ====================
 * Main entry point for processing chat data.
 * 
 * Usage:
 * import { processData } from './utils/analytics';
 * const analytics = await processData(messages, onProgress);
 */

import { yieldToBrowser } from './helpers';
import { processBasicStats, processTemporalData } from './temporal';
import { processUserData, finalizeUserStats, buildNetwork, updateUserActivity, createEmptyUserStats } from './users';
import { processCreativeStats } from './creative';
import { processPatternStats, processDerivedStats } from './patterns';

/**
 * Process messages into analytics data
 * @param {Object[]} messages - Array of message objects
 * @param {function} onProgress - Progress callback (stage, percent)
 * @returns {Promise<Object>} Processed analytics data
 */
export async function processData(messages, onProgress = null) {
    // Helper to report progress and yield to browser
    const reportProgress = async (stage, percent) => {
        if (onProgress) {
            onProgress(stage, percent);
            await yieldToBrowser();
        }
    };

    // Empty state
    if (!messages || messages.length === 0) {
        return createEmptyResult();
    }

    await reportProgress('stats', 0);

    // 1. Basic Stats
    const stats = processBasicStats(messages);

    await reportProgress('temporal', 15);

    // 2. Temporal Data
    const temporal = processTemporalData(messages);

    await reportProgress('users', 30);

    // 3. User Stats & Reactions
    const { users, emojis, networkLinks } = processUserData(messages);

    await reportProgress('network', 45);

    // Finalize user stats and build network
    const userStats = finalizeUserStats(users);
    const network = buildNetwork(users, networkLinks);

    await reportProgress('creative', 55);

    // 4. Sort messages for sequential processing
    const sortedMessages = [...messages].sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    // 5. Creative Stats
    const creative = processCreativeStats(sortedMessages);
    
    // Add initiator counts to users
    Object.keys(creative.initiators).forEach(name => {
        if (users[name]) {
            users[name].initiator_count = creative.initiators[name];
        }
    });

    await reportProgress('patterns', 70);

    // 6. Update user activity (hourly, daily, etc.)
    updateUserActivity(users, sortedMessages);

    // 7. Pattern Stats
    const patternStats = processPatternStats(sortedMessages, users);

    await reportProgress('finalizing', 85);

    // 8. Derived Stats
    const derivedStats = processDerivedStats(sortedMessages, users, creative.initiators, emojis);

    // Build user hourly activity for patterns
    const userHourlyActivity = Object.entries(users).map(([name, data]) => ({
        name,
        data: data.hourly
    }));

    // Build user emoji counts
    const userEmojiCounts = {};
    Object.entries(users).forEach(([name, data]) => {
        userEmojiCounts[name] = data.message_emojis || {};
    });

    await reportProgress('complete', 100);

    return {
        stats,
        temporal,
        users: userStats,
        emojis,
        network,
        networkMatrix: networkLinks,
        messages,
        creative,
        patterns: {
            ...patternStats,
            ...derivedStats,
            userHourlyActivity,
            userEmojiCounts,
            userDetailedStats: users
        }
    };
}

/**
 * Create empty result object
 */
function createEmptyResult() {
    return {
        stats: { total_messages: 0, active_members: 0, days_active: 0, first_date: null, last_date: null, total_reactions: 0, avg_per_month: 0 },
        temporal: { monthly: {}, hourly: {}, daily: {} },
        users: {},
        emojis: {},
        network: { nodes: [], edges: [] },
        networkMatrix: {},
        messages: [],
        creative: { initiators: {}, sentiment: {}, topWords: [] },
        patterns: {
            emojiLeaderboard: [],
            streaks: [],
            mediaSpam: [],
            voiceNoteCount: 0,
            reactionEfficiency: [],
            initiators: [],
            userHourlyActivity: [],
            userEmojiCounts: {},
            userDetailedStats: {}
        }
    };
}

// Re-export helpers for use elsewhere
export { yieldToBrowser } from './helpers';
export { processBasicStats } from './temporal';

