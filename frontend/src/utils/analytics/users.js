/**
 * User Analytics Processing
 * =========================
 * Per-user statistics and activity patterns.
 */

import { getHours, getDay, getISOWeek, format } from 'date-fns';

/**
 * Create empty user stats object
 * @returns {Object} Empty user stats structure
 */
export function createEmptyUserStats() {
    return {
        messages: 0,
        reactions_received: 0,
        reactions_given: 0,
        total_length: 0,
        words: new Set(),
        hourly: Array(24).fill(0),
        day_of_week: Array(7).fill(0),
        daily_activity: {},
        monthly_activity: {},
        weekly_activity: {},
        reactions_details: { received: {}, given: {} },
        reaction_counts: { received: {}, given: {} },
        message_emojis: {}
    };
}

/**
 * Process user statistics from messages
 * @param {Object[]} messages - Array of message objects
 * @returns {Object} Users object keyed by name, networkLinks object
 */
export function processUserData(messages) {
    const users = {};
    const emojis = {};
    const networkLinks = {};

    messages.forEach(msg => {
        const sender = msg.sender_name;
        if (!users[sender]) {
            users[sender] = createEmptyUserStats();
        }

        users[sender].messages++;

        // Process content
        if (msg.content) {
            users[sender].total_length += msg.content.length;
            msg.content.toLowerCase().split(/\s+/).forEach(w => users[sender].words.add(w));

            // Extract emojis from messages
            const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
            const msgEmojis = msg.content.match(emojiRegex);
            if (msgEmojis) {
                msgEmojis.forEach(e => {
                    users[sender].message_emojis[e] = (users[sender].message_emojis[e] || 0) + 1;
                });
            }
        }

        // Process reactions
        if (msg.reactions) {
            msg.reactions.forEach(rxn => {
                const reactor = rxn.actor;
                const emoji = rxn.reaction;

                if (!users[reactor]) {
                    users[reactor] = createEmptyUserStats();
                }

                users[reactor].reactions_given++;
                users[sender].reactions_received++;
                emojis[emoji] = (emojis[emoji] || 0) + 1;

                // Track who gave to whom
                if (!users[reactor].reactions_details.given[sender]) {
                    users[reactor].reactions_details.given[sender] = 0;
                }
                users[reactor].reactions_details.given[sender]++;
                users[reactor].reaction_counts.given[emoji] = (users[reactor].reaction_counts.given[emoji] || 0) + 1;

                if (!users[sender].reactions_details.received[reactor]) {
                    users[sender].reactions_details.received[reactor] = 0;
                }
                users[sender].reactions_details.received[reactor]++;
                users[sender].reaction_counts.received[emoji] = (users[sender].reaction_counts.received[emoji] || 0) + 1;

                // Build network links (for social graph)
                if (reactor !== sender) {
                    const linkKey = `${reactor}|${sender}`;
                    networkLinks[linkKey] = (networkLinks[linkKey] || 0) + 1;
                }
            });
        }
    });

    return { users, emojis, networkLinks };
}

/**
 * Finalize user stats (convert Sets, calculate efficiency)
 * @param {Object} users - Users object from processUserData
 * @returns {Object} Finalized user stats
 */
export function finalizeUserStats(users) {
    const userStats = {};
    Object.entries(users).forEach(([name, data]) => {
        userStats[name] = {
            messages: data.messages,
            reactions_received: data.reactions_received,
            reactions_given: data.reactions_given,
            avg_length: data.messages > 0 ? data.total_length / data.messages : 0,
            vocabulary: data.words.size,
            efficiency: data.messages > 0 ? data.reactions_received / data.messages : 0
        };
    });
    return userStats;
}

/**
 * Build network graph from users and links
 * @param {Object} users - Users object
 * @param {Object} networkLinks - Network links object
 * @returns {Object} Network with nodes and edges arrays
 */
export function buildNetwork(users, networkLinks) {
    const nodes = Object.keys(users).map(u => ({ 
        id: u, 
        label: u, 
        size: users[u].reactions_received 
    }));
    
    const edges = Object.entries(networkLinks)
        .map(([key, count]) => {
            const [source, target] = key.split('|');
            return { source, target, weight: count };
        })
        .filter(e => e.weight > 5);

    return { nodes, edges };
}

/**
 * Update user activity tracking (hourly, daily, monthly, weekly)
 * @param {Object} users - Users object to update
 * @param {Object[]} sortedMessages - Messages sorted by timestamp
 */
export function updateUserActivity(users, sortedMessages) {
    const getDayStr = (ts) => format(new Date(ts), 'yyyy-MM-dd');

    sortedMessages.forEach(msg => {
        const sender = msg.sender_name;
        const date = new Date(msg.timestamp_ms);
        const hour = getHours(date);
        const dayIndex = getDay(date);
        const dayStr = getDayStr(msg.timestamp_ms);

        if (!users[sender]) return;

        users[sender].hourly[hour]++;
        users[sender].day_of_week[dayIndex]++;
        users[sender].daily_activity[dayStr] = (users[sender].daily_activity[dayStr] || 0) + 1;
        
        const monthStr = format(date, 'MMMM');
        users[sender].monthly_activity[monthStr] = (users[sender].monthly_activity[monthStr] || 0) + 1;
        
        const weekNum = getISOWeek(date);
        const weekKey = `Week ${weekNum}`;
        users[sender].weekly_activity[weekKey] = (users[sender].weekly_activity[weekKey] || 0) + 1;
    });
}


