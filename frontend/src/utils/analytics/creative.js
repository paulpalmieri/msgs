/**
 * Creative Analytics Processing
 * =============================
 * Sentiment analysis, word frequency, and conversation initiators.
 */

import { STOP_WORDS, POSITIVE_WORDS, NEGATIVE_WORDS } from './helpers';

/**
 * Process creative stats: initiators, sentiment, word frequency
 * @param {Object[]} sortedMessages - Messages sorted by timestamp
 * @returns {Object} Creative stats: initiators, sentiment, topWords
 */
export function processCreativeStats(sortedMessages) {
    const initiators = {};
    const sentimentScores = {};
    const wordCounts = {};
    
    let lastMessageTime = 0;

    sortedMessages.forEach(msg => {
        const sender = msg.sender_name;

        // Track conversation initiators (2+ hour gap)
        if (lastMessageTime === 0 || (msg.timestamp_ms - lastMessageTime) > (2 * 60 * 60 * 1000)) {
            initiators[sender] = (initiators[sender] || 0) + 1;
        }
        lastMessageTime = msg.timestamp_ms;

        // Process message content
        if (msg.content) {
            // Tokenize: split on whitespace and punctuation
            const tokens = msg.content.toLowerCase().split(/[\s,.!?;:"()\[\]{}]+/);
            let msgScore = 0;
            let wordCount = 0;

            tokens.forEach(rawToken => {
                if (!rawToken) return;
                
                // Normalize apostrophes for stopword check
                const token = rawToken.replace(/[\u0027\u2019\u2018\u02BC`]/g, "'");
                
                // Count non-stopwords for word frequency
                if (!STOP_WORDS.has(token) && token.length > 2) {
                    wordCounts[token] = (wordCounts[token] || 0) + 1;
                }
                
                // Sentiment scoring
                if (POSITIVE_WORDS.has(token)) msgScore += 1;
                if (NEGATIVE_WORDS.has(token)) msgScore -= 1;
                wordCount++;
            });

            // Track sentiment per user
            if (!sentimentScores[sender]) {
                sentimentScores[sender] = { total: 0, count: 0 };
            }
            if (wordCount > 0) {
                sentimentScores[sender].total += msgScore;
                sentimentScores[sender].count++;
            }
        }
    });

    // Calculate average sentiment per user
    const avgSentiment = {};
    Object.keys(sentimentScores).forEach(user => {
        const data = sentimentScores[user];
        avgSentiment[user] = data.count > 0 ? (data.total / data.count) : 0;
    });

    // Get top words
    const topWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count }));

    return {
        initiators,
        sentiment: avgSentiment,
        topWords
    };
}


