/**
 * Pattern Analytics Processing
 * ============================
 * Streaks, media patterns, and user engagement stats.
 */

import { format } from 'date-fns';

/**
 * Process pattern statistics from sorted messages
 * @param {Object[]} sortedMessages - Messages sorted by timestamp
 * @param {Object} users - Users object (will be mutated to add pattern data)
 * @returns {Object} Pattern stats
 */
export function processPatternStats(sortedMessages, users) {
    const streaks = {};
    const mediaSpam = {};
    let voiceNoteCount = 0;

    const getDayStr = (ts) => format(new Date(ts), 'yyyy-MM-dd');

    sortedMessages.forEach(msg => {
        const sender = msg.sender_name;
        const dayStr = getDayStr(msg.timestamp_ms);

        // Initialize tracking objects
        if (!streaks[sender]) streaks[sender] = { current: 0, max: 0, lastDate: null };
        if (!mediaSpam[sender]) mediaSpam[sender] = { photos: 0, videos: 0, gifs: 0, audio: 0 };

        // Track streaks (consecutive days of activity)
        if (streaks[sender].lastDate !== dayStr) {
            const prevDate = streaks[sender].lastDate ? new Date(streaks[sender].lastDate) : null;
            const currDate = new Date(dayStr);
            if (prevDate && (currDate - prevDate) === (1000 * 60 * 60 * 24)) {
                streaks[sender].current++;
            } else {
                streaks[sender].current = 1;
            }
            streaks[sender].max = Math.max(streaks[sender].max, streaks[sender].current);
            streaks[sender].lastDate = dayStr;
        }

        // Track media
        mediaSpam[sender].photos += (msg.photos ? msg.photos.length : 0);
        mediaSpam[sender].videos += (msg.videos ? msg.videos.length : 0);
        
        // Track GIFs (check for gifs array first, then fallback to Share type)
        if (msg.gifs && msg.gifs.length > 0) {
            mediaSpam[sender].gifs += msg.gifs.length;
        } else if (msg.type === 'Share' && msg.content?.includes('.gif')) {
            mediaSpam[sender].gifs++;
        }

        // Track audio/voice notes
        if (msg.audio_files && msg.audio_files.length > 0) {
            mediaSpam[sender].audio += msg.audio_files.length;
            voiceNoteCount += msg.audio_files.length;
        }
    });

    // Process derived stats
    const streakData = processStreakData(streaks);
    const mediaData = processMediaData(mediaSpam);

    // Add pattern data to users
    Object.keys(users).forEach(name => {
        users[name].initiator_count = users[name].initiator_count || 0;
        users[name].media = mediaSpam[name] || { photos: 0, videos: 0, gifs: 0, audio: 0 };
        // Calculate engagement efficiency (reactions received per message)
        users[name].efficiency = users[name].messages > 0 
            ? users[name].reactions_received / users[name].messages 
            : 0;
    });

    return {
        streaks: streakData,
        mediaSpam: mediaData,
        voiceNoteCount,
    };
}

/**
 * Process streak data into sorted array
 */
function processStreakData(streaks) {
    return Object.entries(streaks)
        .map(([user, data]) => ({ name: user, days: data.max }))
        .sort((a, b) => b.days - a.days);
}

/**
 * Process media data into sorted array
 */
function processMediaData(mediaSpam) {
    return Object.entries(mediaSpam)
        .map(([name, data]) => ({ 
            name, 
            ...data, 
            total: data.photos + data.videos + data.gifs + data.audio 
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Process additional derived stats (emoji leaderboard, reaction efficiency, initiators)
 */
export function processDerivedStats(sortedMessages, users, initiators, emojis) {
    // Emoji leaderboard (for reactions section)
    const emojiLeaderboard = Object.entries(emojis)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

    // Reaction efficiency - used for rankings in Wrapped feature
    const reactionEfficiencyData = Object.entries(users)
        .filter(([name, data]) => data.messages >= 10)
        .map(([name, data]) => ({
            name,
            efficiency: data.messages > 0 ? (data.reactions_received / data.messages) : 0,
            reactions: data.reactions_received,
            messages: data.messages
        }))
        .sort((a, b) => b.efficiency - a.efficiency);

    // Initiators data (who starts conversations)
    const initiatorsData = Object.entries(initiators)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    return {
        emojiLeaderboard,
        reactionEfficiency: reactionEfficiencyData,
        initiators: initiatorsData,
    };
}


