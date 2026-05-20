/**
 * Messenger Data Parser v2.0
 * ==========================
 * Parses Facebook Messenger export folders and computes comprehensive aggregates.
 * Handles multiple folders (your_facebook_activity-N) and merges conversations.
 * 
 * Features:
 * - Timezone inference from activity patterns
 * - Mention tracking (@user)
 * - URL/Link analysis
 * - Response time tracking
 * - Conversation sessions (gaps > 2h)
 * - Streak and gap analysis
 * - Content categorization
 * - Emoji extraction from messages
 * - Comprehensive user analytics
 * 
 * Schema Version: 2.0
 * 
 * Usage:
 * const { conversations, parseConversation } = await parseMessengerFolders(fileList);
 */

// Regex patterns for content analysis
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const MENTION_REGEX = /@([^\s]+)/g;

// Sentiment word lists for basic sentiment analysis
const POSITIVE_WORDS = new Set([
    'love', 'great', 'amazing', 'awesome', 'happy', 'good', 'best', 'thanks', 'thank',
    'nice', 'wonderful', 'fantastic', 'excellent', 'perfect', 'beautiful', 'fun',
    'excited', 'glad', 'yay', 'haha', 'lol', 'lmao', 'yes', 'cool', 'sweet', 'brilliant',
    'incredible', 'lovely', 'gorgeous', 'favorite', 'favourite', 'hilarious', 'congrats',
    'congratulations', 'blessed', 'grateful', 'proud', 'impressive', 'delicious'
]);
const NEGATIVE_WORDS = new Set([
    'hate', 'bad', 'terrible', 'awful', 'sad', 'angry', 'worst', 'horrible', 'sucks',
    'ugh', 'annoying', 'sorry', 'wrong', 'unfortunately', 'disappointed', 'boring',
    'tired', 'stressed', 'upset', 'worried', 'scared', 'frustrated', 'miss', 'lost',
    'broken', 'failed', 'fail', 'stupid', 'damn', 'crap', 'cried', 'crying', 'hurts'
]);

/**
 * Extract n-grams (word sequences) from text
 * @param {string} text - Text to analyze
 * @param {number} n - Number of words in each n-gram
 * @returns {string[]} Array of n-grams
 */
function extractNgrams(text, n) {
    if (!text || text.length < 3) return [];
    const words = text.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2);

    if (words.length < n) return [];

    const ngrams = [];
    for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
}

/**
 * Analyze sentiment of text using keyword matching
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment scores { positive, negative, neutral, score }
 */
function analyzeSentiment(text) {
    if (!text) return { positive: 0, negative: 0, neutral: 0, score: 0 };

    const words = text.toLowerCase().split(/\s+/);
    let positive = 0, negative = 0;

    for (const w of words) {
        if (POSITIVE_WORDS.has(w)) positive++;
        if (NEGATIVE_WORDS.has(w)) negative++;
    }

    const neutral = words.length - positive - negative;
    const total = positive + negative || 1;

    return {
        positive,
        negative,
        neutral,
        score: (positive - negative) / total, // Range: -1 to 1
    };
}

/**
 * Fix Facebook's broken encoding (Latin-1 interpreted as UTF-8)
 * @param {any} obj - Object to fix
 * @returns {any} Fixed object
 */
function fixEncoding(obj) {
    if (typeof obj === 'string') {
        try {
            const bytes = new Uint8Array(obj.length);
            for (let i = 0; i < obj.length; i++) {
                bytes[i] = obj.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch {
            return obj;
        }
    } else if (Array.isArray(obj)) {
        return obj.map(fixEncoding);
    } else if (obj && typeof obj === 'object') {
        const fixed = {};
        for (const [key, value] of Object.entries(obj)) {
            fixed[fixEncoding(key)] = fixEncoding(value);
        }
        return fixed;
    }
    return obj;
}

/**
 * Format name as "FirstName L." for display
 * @param {string} fullName - Full name
 * @returns {string} Formatted name
 */
function formatSenderName(fullName) {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    if (parts.length > 1) {
        return `${parts[0]} ${parts[1][0]}.`;
    }
    return parts[0];
}

/**
 * Get the Monday of the week for a given date
 * @param {Date} dt - Date object
 * @returns {string} YYYY-MM-DD format
 */
function getWeekMonday(dt) {
    const daysSinceMonday = dt.getDay() === 0 ? 6 : dt.getDay() - 1;
    const monday = new Date(dt);
    monday.setDate(monday.getDate() - daysSinceMonday);
    return monday.toISOString().split('T')[0];
}

/**
 * Extract emojis from text content
 * @param {string} text - Text to analyze
 * @returns {string[]} Array of emojis found
 */
function extractEmojis(text) {
    if (!text) return [];
    const matches = text.match(EMOJI_REGEX);
    return matches || [];
}

/**
 * Extract URLs from text content
 * @param {string} text - Text to analyze
 * @returns {string[]} Array of URLs found
 */
function extractUrls(text) {
    if (!text) return [];
    const matches = text.match(URL_REGEX);
    return matches || [];
}

/**
 * Extract mentions from text content (@username)
 * @param {string} text - Text to analyze
 * @returns {string[]} Array of mentioned names
 */
function extractMentions(text) {
    if (!text) return [];
    const matches = text.match(MENTION_REGEX);
    return matches ? matches.map(m => m.slice(1)) : [];
}

/**
 * Categorize message content type
 * @param {Object} msg - Message object
 * @returns {string} Content type category
 */
function categorizeMessage(msg) {
    if (msg.is_unsent) return 'unsent';
    if (msg.sticker) return 'sticker';
    if (msg.photos?.length) return 'photo';
    if (msg.videos?.length) return 'video';
    if (msg.audio_files?.length) return 'audio';
    if (msg.gifs?.length) return 'gif';
    if (msg.files?.length) return 'file';
    if (msg.share?.link) return 'link';
    if (msg.call_duration !== undefined) return 'call';
    if (msg.content && extractUrls(msg.content).length > 0) return 'link';
    if (msg.content) return 'text';
    return 'other';
}

/**
 * Count words in text
 * @param {string} text - Text to analyze
 * @returns {number} Word count
 */
function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Infer timezone offset from hourly activity distribution
 * Assumes peak activity should be between 18:00-22:00 local time
 * @param {number[]} hourlyActivity - Array of 24 hourly counts (UTC)
 * @returns {number} Estimated timezone offset in hours from UTC
 */
function inferTimezoneOffset(hourlyActivity) {
    if (!hourlyActivity || hourlyActivity.length !== 24) return 0;

    // Find the peak hour (highest activity)
    let peakHour = 0;
    let maxActivity = 0;

    // Weight by nearby hours to smooth the distribution
    for (let h = 0; h < 24; h++) {
        const weighted =
            hourlyActivity[h] * 1.0 +
            hourlyActivity[(h + 23) % 24] * 0.5 +
            hourlyActivity[(h + 1) % 24] * 0.5;
        if (weighted > maxActivity) {
            maxActivity = weighted;
            peakHour = h;
        }
    }

    // Assume ideal peak is around 20:00 (8 PM) local time
    // So offset = peakHour - 20
    // If peakHour is 18 UTC and we want it to be 20 local, offset = +2 (UTC+2)
    const idealPeak = 20;
    let offset = idealPeak - peakHour;

    // Normalize to reasonable range (-12 to +14)
    if (offset > 14) offset -= 24;
    if (offset < -12) offset += 24;

    return offset;
}

/**
 * Parse uploaded folders and discover all conversations
 * @param {FileList} fileList - Files from folder upload
 * @param {function} onProgress - Progress callback (stage, percent)
 * @returns {Promise<Object>} Conversations map and metadata
 */
export async function parseMessengerFolders(fileList, onProgress = null) {
    const reportProgress = (stage, percent) => {
        if (onProgress) onProgress(stage, percent);
    };

    reportProgress('scanning', 0);

    // Group files by conversation
    const conversationFiles = new Map(); // conversationId -> { title, files: File[] }

    const files = Array.from(fileList);
    const messageFiles = files.filter(f =>
        f.name.match(/^message_\d+\.json$/) &&
        f.webkitRelativePath.includes('/messages/')
    );

    reportProgress('scanning', 20);

    // Group by conversation folder
    for (const file of messageFiles) {
        const pathParts = file.webkitRelativePath.split('/');
        const messagesIdx = pathParts.findIndex(p => p === 'messages');
        if (messagesIdx === -1 || messagesIdx + 2 >= pathParts.length) continue;

        const category = pathParts[messagesIdx + 1];
        const conversationFolder = pathParts[messagesIdx + 2];
        const conversationId = conversationFolder;

        if (!conversationFiles.has(conversationId)) {
            conversationFiles.set(conversationId, {
                id: conversationId,
                category,
                title: null,
                files: [],
                messageCount: 0,
            });
        }
        conversationFiles.get(conversationId).files.push(file);
    }

    reportProgress('scanning', 50);

    // Read first file of each conversation to get title and participant count
    const conversations = [];
    const totalConvs = conversationFiles.size;
    let processed = 0;

    for (const [id, conv] of conversationFiles) {
        try {
            const firstFile = conv.files.find(f => f.name === 'message_1.json') || conv.files[0];
            const text = await firstFile.text();
            const data = fixEncoding(JSON.parse(text));

            conv.title = data.title || id;
            conv.participants = data.participants?.map(p => p.name) || [];
            conv.messageCount = data.messages?.length || 0;
            conv.estimatedMessages = conv.files.length * (data.messages?.length || 10000);
            conv.threadPath = data.thread_path || '';
            conv.isStillParticipant = data.is_still_participant ?? true;

            conversations.push(conv);
        } catch (err) {
            console.warn(`Failed to read conversation ${id}:`, err);
        }

        processed++;
        reportProgress('scanning', 50 + Math.round((processed / totalConvs) * 50));
    }

    conversations.sort((a, b) => b.estimatedMessages - a.estimatedMessages);
    reportProgress('complete', 100);

    return { conversations, conversationFiles };
}

/**
 * Parse a single conversation and compute comprehensive aggregates
 * @param {Object} conversation - Conversation metadata from parseMessengerFolders
 * @param {Map} conversationFiles - Map of conversation files
 * @param {function} onProgress - Progress callback (stage, percent)
 * @returns {Promise<Object>} Comprehensive aggregates for the conversation
 */
export async function parseConversation(conversation, conversationFiles, onProgress = null) {
    const reportProgress = (stage, percent) => {
        if (onProgress) onProgress(stage, percent);
    };

    reportProgress('loading', 0);

    const conv = conversationFiles.get(conversation.id);
    if (!conv) throw new Error(`Conversation ${conversation.id} not found`);

    // Load all message files
    const allMessages = [];
    const totalFiles = conv.files.length;

    for (let i = 0; i < conv.files.length; i++) {
        const file = conv.files[i];
        try {
            const text = await file.text();
            const data = fixEncoding(JSON.parse(text));
            if (data.messages) {
                allMessages.push(...data.messages);
            }
        } catch (err) {
            console.warn(`Failed to read ${file.name}:`, err);
        }
        reportProgress('loading', Math.round(((i + 1) / totalFiles) * 40));
    }

    reportProgress('processing', 40);

    // Sort messages by timestamp ascending
    allMessages.sort((a, b) => (a.timestamp_ms || 0) - (b.timestamp_ms || 0));

    // Compute comprehensive aggregates
    const aggregates = computeAggregates(allMessages, (percent) => {
        reportProgress('processing', 40 + Math.round(percent * 0.6));
    });

    reportProgress('complete', 100);

    return {
        title: conversation.title,
        participants: conversation.participants,
        aggregates,
        messageCount: allMessages.length,
        schemaVersion: '2.0',
    };
}

/**
 * Compute comprehensive aggregates from messages
 * @param {Object[]} messages - Array of message objects
 * @param {function} onProgress - Progress callback (percent 0-100)
 * @returns {Object} Comprehensive aggregates object
 */
function computeAggregates(messages, onProgress = null) {
    if (!messages || messages.length === 0) {
        return createEmptyAggregates();
    }

    // ========== Initialize containers ==========
    const monthly = new Map();
    const userMonthly = new Map();
    const yearlyData = new Map();
    const userTotals = new Map();
    const reactionNetwork = new Map();
    const reactionNetworkYearly = new Map();
    const dailyData = new Map();
    const weeklyData = new Map();

    // New comprehensive containers
    const userFirstMessage = new Map();      // First message timestamp per user
    const userLastMessage = new Map();       // Last message timestamp per user
    const mentionsGiven = new Map();         // User -> Map(mentionedUser -> count)
    const mentionsReceived = new Map();      // User -> Map(mentioner -> count)
    const responseTimesData = new Map();     // User -> array of response times in ms
    const conversationSessions = [];         // Array of session objects
    const contentTypeStats = new Map();      // ContentType -> count
    const userContentTypes = new Map();      // User -> Map(ContentType -> count)
    const linkDomains = new Map();           // Domain -> count
    const userLinkDomains = new Map();       // User -> Map(Domain -> count)
    const emojiInContent = new Map();        // Emoji -> count (from message content)
    const userEmojiInContent = new Map();    // User -> Map(Emoji -> count)
    const wordFrequency = new Map();         // Word -> count (top words)
    const userWordFrequency = new Map();     // User -> Map(Word -> count)
    const activeDaysSet = new Set();         // All days with activity
    const userActiveDays = new Map();        // User -> Set of active days
    const hourlyActivityUTC = new Array(24).fill(0); // Global hourly (UTC)
    const bumpsCount = { total: 0, users: new Map() }; // Bumped messages
    const unsentCount = { total: 0, users: new Map() }; // Unsent/deleted messages
    const stickerCount = { total: 0, users: new Map() }; // Stickers sent
    const callStats = { totalCalls: 0, totalDuration: 0, users: new Map() }; // Call statistics

    // ========== Content Analysis containers (v2.1) ==========
    const topReactedMessages = [];          // Messages with 3+ reactions
    const wordIndexMap = new Map();         // word -> { total, byUser, byYear, byMonth, samples, messageIds }
    const bigramCounts = new Map();         // bigram -> { count, samples, messageIds }
    const trigramCounts = new Map();        // trigram -> { count, samples, messageIds }
    const userBigrams = new Map();          // user -> Map(bigram -> count)
    const sentimentByUser = new Map();      // user -> { positive, negative, neutral, count }
    const sentimentByMonth = new Map();     // monthKey -> { positive, negative, neutral, count }
    const sentimentByYear = new Map();      // year -> { positive, negative, neutral, count }
    let sentimentOverall = { positive: 0, negative: 0, neutral: 0, count: 0 };
    const sentimentSamplesByUser = new Map();  // user -> { positive: [], negative: [] }

    // ========== Full Message Storage (v2.2) ==========
    // Store all text messages for full exploration
    const messageStore = [];                // All messages with content: { id, content, sender, timestamp_ms, sentiment, words }
    const wordToMessageIds = new Map();     // word -> Set of message IDs
    const userSentimentMessages = new Map(); // user -> { positive: [msgIds], negative: [msgIds] }

    const allUsers = new Set();
    let totalReactions = 0;
    let lastMsgTime = 0;
    let lastMsgSender = null;
    let currentSession = null;
    const SESSION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

    const totalMsgs = messages.length;
    let processedCount = 0;

    // ========== Process each message ==========
    for (const msg of messages) {
        const ts = msg.timestamp_ms || 0;
        const sender = msg.sender_name || 'Unknown';
        const content = msg.content || '';
        const reactions = msg.reactions || [];

        const dt = new Date(ts);
        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const yearKey = String(dt.getFullYear());
        const hourUTC = dt.getUTCHours();
        const hour = dt.getHours();
        const dayOfWeek = dt.getDay() === 0 ? 6 : dt.getDay() - 1; // Mon=0, Sun=6
        const dailyKey = dt.toISOString().split('T')[0];

        allUsers.add(sender);
        activeDaysSet.add(dailyKey);

        // Track user active days
        if (!userActiveDays.has(sender)) userActiveDays.set(sender, new Set());
        userActiveDays.get(sender).add(dailyKey);

        // Track first/last message per user
        if (!userFirstMessage.has(sender)) userFirstMessage.set(sender, ts);
        userLastMessage.set(sender, ts);

        // Global hourly UTC
        hourlyActivityUTC[hourUTC] += 1;

        // Session tracking
        const isNewSession = lastMsgTime === 0 || (ts - lastMsgTime) > SESSION_GAP_MS;
        if (isNewSession) {
            if (currentSession) {
                currentSession.endTime = lastMsgTime;
                conversationSessions.push(currentSession);
            }
            currentSession = {
                startTime: ts,
                endTime: ts,
                initiator: sender,
                participants: new Set([sender]),
                messageCount: 0,
            };
        }
        currentSession.endTime = ts;
        currentSession.participants.add(sender);
        currentSession.messageCount += 1;

        // Response time tracking (only if different sender)
        if (lastMsgSender && lastMsgSender !== sender && (ts - lastMsgTime) < SESSION_GAP_MS) {
            const responseTime = ts - lastMsgTime;
            if (!responseTimesData.has(sender)) responseTimesData.set(sender, []);
            responseTimesData.get(sender).push(responseTime);
        }

        lastMsgTime = ts;
        lastMsgSender = sender;

        // Content type categorization
        const contentType = categorizeMessage(msg);
        contentTypeStats.set(contentType, (contentTypeStats.get(contentType) || 0) + 1);
        if (!userContentTypes.has(sender)) userContentTypes.set(sender, new Map());
        const uct = userContentTypes.get(sender);
        uct.set(contentType, (uct.get(contentType) || 0) + 1);

        // Special content tracking
        if (msg.is_unsent) {
            unsentCount.total += 1;
            unsentCount.users.set(sender, (unsentCount.users.get(sender) || 0) + 1);
        }
        if (msg.bumped_message_metadata?.is_bumped) {
            bumpsCount.total += 1;
            bumpsCount.users.set(sender, (bumpsCount.users.get(sender) || 0) + 1);
        }
        if (msg.sticker) {
            stickerCount.total += 1;
            stickerCount.users.set(sender, (stickerCount.users.get(sender) || 0) + 1);
        }
        if (msg.call_duration !== undefined) {
            callStats.totalCalls += 1;
            callStats.totalDuration += msg.call_duration || 0;
            if (!callStats.users.has(sender)) callStats.users.set(sender, { calls: 0, duration: 0 });
            const uc = callStats.users.get(sender);
            uc.calls += 1;
            uc.duration += msg.call_duration || 0;
        }

        // Mention tracking
        const mentions = extractMentions(content);
        for (const mentioned of mentions) {
            if (!mentionsGiven.has(sender)) mentionsGiven.set(sender, new Map());
            const mg = mentionsGiven.get(sender);
            mg.set(mentioned, (mg.get(mentioned) || 0) + 1);

            if (!mentionsReceived.has(mentioned)) mentionsReceived.set(mentioned, new Map());
            const mr = mentionsReceived.get(mentioned);
            mr.set(sender, (mr.get(sender) || 0) + 1);
        }

        // URL/Link domain tracking
        const urls = extractUrls(content);
        for (const url of urls) {
            try {
                const domain = new URL(url).hostname.replace('www.', '');
                linkDomains.set(domain, (linkDomains.get(domain) || 0) + 1);
                if (!userLinkDomains.has(sender)) userLinkDomains.set(sender, new Map());
                userLinkDomains.get(sender).set(domain, (userLinkDomains.get(sender).get(domain) || 0) + 1);
            } catch { }
        }
        // Also track from share objects
        if (msg.share?.link) {
            try {
                const domain = new URL(msg.share.link).hostname.replace('www.', '');
                linkDomains.set(domain, (linkDomains.get(domain) || 0) + 1);
                if (!userLinkDomains.has(sender)) userLinkDomains.set(sender, new Map());
                userLinkDomains.get(sender).set(domain, (userLinkDomains.get(sender).get(domain) || 0) + 1);
            } catch { }
        }

        // Emoji in content tracking
        const contentEmojis = extractEmojis(content);
        for (const emoji of contentEmojis) {
            emojiInContent.set(emoji, (emojiInContent.get(emoji) || 0) + 1);
            if (!userEmojiInContent.has(sender)) userEmojiInContent.set(sender, new Map());
            userEmojiInContent.get(sender).set(emoji, (userEmojiInContent.get(sender).get(emoji) || 0) + 1);
        }

        // ========== Store Message in Global Store ==========
        const msgId = messageStore.length;
        const sentiment = content ? analyzeSentiment(content) : { positive: 0, negative: 0, neutral: 0, score: 0 };
        const msgScore = (sentiment.positive || 0) - (sentiment.negative || 0);

        messageStore.push({
            id: msgId,
            content: content || '',
            sender,
            timestamp_ms: ts,
            type: contentType,
            sentiment: msgScore,
        });

        // Word frequency and deep analysis (only for text content)
        if (content && content.length > 0) {
            const words = content.toLowerCase()
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 4);

            // Add words to the message in store for filtering/search
            messageStore[msgId].words = words.slice(0, 20);

            // Build word-to-message index for unique words
            const msgUniqueWords = new Set(words);
            for (const word of msgUniqueWords) {
                if (!wordToMessageIds.has(word)) {
                    wordToMessageIds.set(word, []);
                }
                wordToMessageIds.get(word).push(msgId);
            }

            // Track sentiment messages by user
            if (!userSentimentMessages.has(sender)) {
                userSentimentMessages.set(sender, { positive: [], negative: [] });
            }
            if (msgScore > 0) {
                userSentimentMessages.get(sender).positive.push(msgId);
            } else if (msgScore < 0) {
                userSentimentMessages.get(sender).negative.push(msgId);
            }

            for (const word of words) {
                wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
                if (!userWordFrequency.has(sender)) userWordFrequency.set(sender, new Map());
                userWordFrequency.get(sender).set(word, (userWordFrequency.get(sender).get(word) || 0) + 1);

                // Enhanced word index with samples and breakdown
                if (!wordIndexMap.has(word)) {
                    wordIndexMap.set(word, {
                        total: 0,
                        byUser: new Map(),
                        byYear: new Map(),
                        byMonth: new Map(),
                        samples: [],
                    });
                }
                const wi = wordIndexMap.get(word);
                wi.total++;
                wi.byUser.set(sender, (wi.byUser.get(sender) || 0) + 1);
                wi.byYear.set(yearKey, (wi.byYear.get(yearKey) || 0) + 1);
                wi.byMonth.set(monthKey, (wi.byMonth.get(monthKey) || 0) + 1);
                // Store up to 5 samples per word (for quick preview)
                if (wi.samples.length < 5) {
                    wi.samples.push({
                        id: msgId,
                        content: content.slice(0, 500),
                        sender,
                        timestamp_ms: ts,
                    });
                }
            }

            // N-gram tracking (bigrams and trigrams) with samples and message IDs
            const bigrams = extractNgrams(content, 2);
            for (const bg of bigrams) {
                if (!bigramCounts.has(bg)) {
                    bigramCounts.set(bg, { count: 0, samples: [], messageIds: [] });
                }
                const bgData = bigramCounts.get(bg);
                bgData.count++;
                bgData.messageIds.push(msgId);
                if (bgData.samples.length < 5) {
                    bgData.samples.push({
                        id: msgId,
                        content: content.slice(0, 500),
                        sender,
                        timestamp_ms: ts
                    });
                }
                if (!userBigrams.has(sender)) userBigrams.set(sender, new Map());
                userBigrams.get(sender).set(bg, (userBigrams.get(sender).get(bg) || 0) + 1);
            }
            const trigrams = extractNgrams(content, 3);
            for (const tg of trigrams) {
                if (!trigramCounts.has(tg)) {
                    trigramCounts.set(tg, { count: 0, samples: [], messageIds: [] });
                }
                const tgData = trigramCounts.get(tg);
                tgData.count++;
                tgData.messageIds.push(msgId);
                if (tgData.samples.length < 5) {
                    tgData.samples.push({
                        id: msgId,
                        content: content.slice(0, 500),
                        sender,
                        timestamp_ms: ts
                    });
                }
            }

            // Sentiment tracking (reuse sentiment calculated above)
            sentimentOverall.positive += sentiment.positive;
            sentimentOverall.negative += sentiment.negative;
            sentimentOverall.neutral += sentiment.neutral;
            sentimentOverall.count++;

            // Per-user sentiment
            if (!sentimentByUser.has(sender)) {
                sentimentByUser.set(sender, { positive: 0, negative: 0, neutral: 0, count: 0 });
            }
            const su = sentimentByUser.get(sender);
            su.positive += sentiment.positive;
            su.negative += sentiment.negative;
            su.neutral += sentiment.neutral;
            su.count++;

            // Track sample positive/negative messages per user (max 5 each for quick preview)
            if (!sentimentSamplesByUser.has(sender)) {
                sentimentSamplesByUser.set(sender, { positive: [], negative: [] });
            }
            const samples = sentimentSamplesByUser.get(sender);
            const sampleMsg = {
                content: content.slice(0, 200),
                timestamp_ms: ts,
                score: msgScore,
                positiveCount: sentiment.positive,
                negativeCount: sentiment.negative,
            };
            // Track most positive messages (score > 0)
            if (msgScore > 0 && content.length > 10) {
                samples.positive.push(sampleMsg);
                if (samples.positive.length > 10) {
                    samples.positive.sort((a, b) => b.score - a.score);
                    samples.positive = samples.positive.slice(0, 5);
                }
            }
            // Track most negative messages (score < 0)
            if (msgScore < 0 && content.length > 10) {
                samples.negative.push(sampleMsg);
                if (samples.negative.length > 10) {
                    samples.negative.sort((a, b) => a.score - b.score);
                    samples.negative = samples.negative.slice(0, 5);
                }
            }

            // Per-month sentiment
            if (!sentimentByMonth.has(monthKey)) {
                sentimentByMonth.set(monthKey, { positive: 0, negative: 0, neutral: 0, count: 0 });
            }
            const sm = sentimentByMonth.get(monthKey);
            sm.positive += sentiment.positive;
            sm.negative += sentiment.negative;
            sm.neutral += sentiment.neutral;
            sm.count++;

            // Per-year sentiment
            if (!sentimentByYear.has(yearKey)) {
                sentimentByYear.set(yearKey, { positive: 0, negative: 0, neutral: 0, count: 0 });
            }
            const sy = sentimentByYear.get(yearKey);
            sy.positive += sentiment.positive;
            sy.negative += sentiment.negative;
            sy.neutral += sentiment.neutral;
            sy.count++;
        }

        // Track messages with 3+ reactions for top reacted list
        if (reactions.length >= 3) {
            topReactedMessages.push({
                id: msgId,
                content: content.slice(0, 500),
                sender,
                timestamp_ms: ts,
                reaction_count: reactions.length,
                reactions: reactions.reduce((acc, r) => {
                    acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                    return acc;
                }, {}),
                year: parseInt(yearKey),
            });
        }

        // Media counts
        const photosCount = msg.photos?.length || 0;
        const videosCount = msg.videos?.length || 0;
        const audioCount = msg.audio_files?.length || 0;
        const gifsCount = msg.gifs?.length || 0;
        const filesCount = msg.files?.length || 0;
        const callDuration = msg.call_duration || 0;
        const charCount = content.length;
        const wordCount = countWords(content);

        // --- Monthly aggregates ---
        if (!monthly.has(monthKey)) {
            monthly.set(monthKey, {
                messages: 0,
                reactions: 0,
                media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 },
                active_users: new Set(),
                initiations: 0,
                total_chars: 0,
                total_words: 0,
                call_duration: 0,
                hourly: new Array(24).fill(0),
                daily: new Array(7).fill(0),
                links_shared: 0,
                unsent_messages: 0,
            });
        }
        const m = monthly.get(monthKey);
        m.messages += 1;
        m.reactions += reactions.length;
        m.media.photos += photosCount;
        m.media.videos += videosCount;
        m.media.audio += audioCount;
        m.media.gifs += gifsCount;
        m.media.files += filesCount;
        if (msg.sticker) m.media.stickers += 1;
        m.active_users.add(sender);
        m.total_chars += charCount;
        m.total_words += wordCount;
        m.call_duration += callDuration;
        m.hourly[hour] += 1;
        m.daily[dayOfWeek] += 1;
        m.links_shared += urls.length + (msg.share?.link ? 1 : 0);
        if (msg.is_unsent) m.unsent_messages += 1;
        if (isNewSession) m.initiations += 1;

        // --- Daily aggregates ---
        if (!dailyData.has(dailyKey)) {
            dailyData.set(dailyKey, {
                messages: 0,
                media: 0,
                sender_counts: new Map(),
                reactions: 0,
                words: 0,
            });
        }
        const d = dailyData.get(dailyKey);
        d.messages += 1;
        d.media += photosCount + videosCount + gifsCount;
        d.sender_counts.set(sender, (d.sender_counts.get(sender) || 0) + 1);
        d.reactions += reactions.length;
        d.words += wordCount;

        // --- Weekly aggregates ---
        const weekKey = getWeekMonday(dt);
        if (!weeklyData.has(weekKey)) {
            weeklyData.set(weekKey, { messages: 0, reactions: 0 });
        }
        weeklyData.get(weekKey).messages += 1;
        weeklyData.get(weekKey).reactions += reactions.length;

        // --- User monthly aggregates ---
        if (!userMonthly.has(sender)) {
            userMonthly.set(sender, new Map());
        }
        if (!userMonthly.get(sender).has(monthKey)) {
            userMonthly.get(sender).set(monthKey, {
                messages: 0,
                reactions_received: 0,
                reactions_given: 0,
                initiations: 0,
                media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0 },
                total_chars: 0,
                total_words: 0,
                hourly: new Array(24).fill(0),
                daily: new Array(7).fill(0),
                links_shared: 0,
            });
        }
        const um = userMonthly.get(sender).get(monthKey);
        um.messages += 1;
        um.total_chars += charCount;
        um.total_words += wordCount;
        um.media.photos += photosCount;
        um.media.videos += videosCount;
        um.media.audio += audioCount;
        um.media.gifs += gifsCount;
        um.media.files += filesCount;
        um.hourly[hour] += 1;
        um.daily[dayOfWeek] += 1;
        um.links_shared += urls.length + (msg.share?.link ? 1 : 0);
        if (isNewSession) um.initiations += 1;

        // --- Yearly aggregates ---
        if (!yearlyData.has(yearKey)) {
            yearlyData.set(yearKey, {
                messages: 0,
                reactions: 0,
                active_users: new Set(),
                user_messages: new Map(),
                user_reactions_given: new Map(),
                emoji_counts: new Map(),
                hourly: new Array(24).fill(0),
                daily: new Array(7).fill(0),
                content_types: new Map(),
                total_words: 0,
                total_chars: 0,
            });
        }
        const y = yearlyData.get(yearKey);
        y.messages += 1;
        y.reactions += reactions.length;
        y.active_users.add(sender);
        y.user_messages.set(sender, (y.user_messages.get(sender) || 0) + 1);
        y.hourly[hour] += 1;
        y.daily[dayOfWeek] += 1;
        y.total_words += wordCount;
        y.total_chars += charCount;
        y.content_types.set(contentType, (y.content_types.get(contentType) || 0) + 1);

        // --- User totals ---
        if (!userTotals.has(sender)) {
            userTotals.set(sender, {
                messages: 0,
                reactions_received: 0,
                reactions_given: 0,
                initiations: 0,
                media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 },
                total_chars: 0,
                total_words: 0,
                links_shared: 0,
                mentions_given: 0,
                mentions_received: 0,
            });
        }
        const ut = userTotals.get(sender);
        ut.messages += 1;
        ut.total_chars += charCount;
        ut.total_words += wordCount;
        ut.media.photos += photosCount;
        ut.media.videos += videosCount;
        ut.media.audio += audioCount;
        ut.media.gifs += gifsCount;
        ut.media.files += filesCount;
        if (msg.sticker) ut.media.stickers += 1;
        ut.links_shared += urls.length + (msg.share?.link ? 1 : 0);
        ut.mentions_given += mentions.length;
        if (isNewSession) ut.initiations += 1;

        // --- Process reactions ---
        for (const rxn of reactions) {
            const reactor = rxn.actor || 'Unknown';
            const emoji = rxn.reaction || '';
            totalReactions += 1;

            allUsers.add(reactor);

            // User monthly reactions
            if (!userMonthly.has(sender)) userMonthly.set(sender, new Map());
            if (!userMonthly.get(sender).has(monthKey)) {
                userMonthly.get(sender).set(monthKey, {
                    messages: 0, reactions_received: 0, reactions_given: 0, initiations: 0,
                    media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0 }, total_chars: 0,
                    total_words: 0, hourly: new Array(24).fill(0), daily: new Array(7).fill(0),
                    links_shared: 0,
                });
            }
            userMonthly.get(sender).get(monthKey).reactions_received += 1;

            if (!userMonthly.has(reactor)) userMonthly.set(reactor, new Map());
            if (!userMonthly.get(reactor).has(monthKey)) {
                userMonthly.get(reactor).set(monthKey, {
                    messages: 0, reactions_received: 0, reactions_given: 0, initiations: 0,
                    media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0 }, total_chars: 0,
                    total_words: 0, hourly: new Array(24).fill(0), daily: new Array(7).fill(0),
                    links_shared: 0,
                });
            }
            userMonthly.get(reactor).get(monthKey).reactions_given += 1;

            // User totals reactions
            if (!userTotals.has(sender)) {
                userTotals.set(sender, {
                    messages: 0, reactions_received: 0, reactions_given: 0, initiations: 0,
                    media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 }, total_chars: 0,
                    total_words: 0, links_shared: 0, mentions_given: 0, mentions_received: 0,
                });
            }
            userTotals.get(sender).reactions_received += 1;

            if (!userTotals.has(reactor)) {
                userTotals.set(reactor, {
                    messages: 0, reactions_received: 0, reactions_given: 0, initiations: 0,
                    media: { photos: 0, videos: 0, audio: 0, gifs: 0, files: 0, stickers: 0 }, total_chars: 0,
                    total_words: 0, links_shared: 0, mentions_given: 0, mentions_received: 0,
                });
            }
            userTotals.get(reactor).reactions_given += 1;

            // Yearly reactions
            y.user_reactions_given.set(reactor, (y.user_reactions_given.get(reactor) || 0) + 1);
            y.emoji_counts.set(emoji, (y.emoji_counts.get(emoji) || 0) + 1);

            // Reaction network
            if (reactor !== sender) {
                const linkKey = `${reactor}|${sender}`;
                reactionNetwork.set(linkKey, (reactionNetwork.get(linkKey) || 0) + 1);

                if (!reactionNetworkYearly.has(yearKey)) {
                    reactionNetworkYearly.set(yearKey, new Map());
                }
                reactionNetworkYearly.get(yearKey).set(linkKey, (reactionNetworkYearly.get(yearKey).get(linkKey) || 0) + 1);
            }
        }

        processedCount++;
        if (onProgress && processedCount % 5000 === 0) {
            onProgress(Math.round((processedCount / totalMsgs) * 100));
        }
    }

    // Close final session
    if (currentSession) {
        conversationSessions.push(currentSession);
    }

    // ========== Post-process ==========

    // Infer timezone from UTC hourly activity
    const inferredTimezoneOffset = inferTimezoneOffset(hourlyActivityUTC);

    // Monthly: convert sets to counts
    const monthlyFinal = {};
    for (const [key, m] of monthly) {
        monthlyFinal[key] = {
            messages: m.messages,
            reactions: m.reactions,
            media: m.media,
            active_users: m.active_users.size,
            initiations: m.initiations,
            total_chars: m.total_chars,
            total_words: m.total_words,
            call_duration: m.call_duration,
            hourly: m.hourly,
            daily: m.daily,
            links_shared: m.links_shared,
            unsent_messages: m.unsent_messages,
        };
    }

    // User monthly: convert to plain object
    const userMonthlyFinal = {};
    for (const [user, months] of userMonthly) {
        userMonthlyFinal[user] = {};
        for (const [month, data] of months) {
            userMonthlyFinal[user][month] = data;
        }
    }

    // Yearly: compute top lists
    const yearlyFinal = {};
    for (const [key, y] of yearlyData) {
        const topMessagers = Array.from(y.user_messages.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([name, count]) => ({ name, count }));

        const topReactors = Array.from(y.user_reactions_given.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([name, count]) => ({ name, count }));

        const topEmojis = Array.from(y.emoji_counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([emoji, count]) => ({ emoji, count }));

        const peakHour = y.hourly.indexOf(Math.max(...y.hourly));
        const peakDay = y.daily.indexOf(Math.max(...y.daily));

        const contentTypeBreakdown = {};
        for (const [type, count] of y.content_types) {
            contentTypeBreakdown[type] = count;
        }

        yearlyFinal[key] = {
            messages: y.messages,
            reactions: y.reactions,
            active_users: y.active_users.size,
            top_messagers: topMessagers,
            top_reactors: topReactors,
            top_emojis: topEmojis,
            peak_hour: peakHour,
            peak_day: peakDay,
            hourly: y.hourly,
            daily: y.daily,
            total_words: y.total_words,
            total_chars: y.total_chars,
            avg_message_length: y.messages > 0 ? Math.round(y.total_chars / y.messages) : 0,
            content_types: contentTypeBreakdown,
        };
    }

    // Helper function to calculate longest streak from a set of date strings
    function calculateUserStreak(daysSet) {
        if (!daysSet || daysSet.size === 0) return 0;
        const sortedDays = Array.from(daysSet).sort();
        if (sortedDays.length === 1) return 1;

        let maxStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < sortedDays.length; i++) {
            const prevDate = new Date(sortedDays[i - 1]);
            const currDate = new Date(sortedDays[i]);
            const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
        return maxStreak;
    }

    // User totals with additional stats
    const userTotalsFinal = {};
    for (const [user, data] of userTotals) {
        const userDaysSet = userActiveDays.get(user);
        const activeDays = userDaysSet?.size || 0;
        const maxStreak = calculateUserStreak(userDaysSet);
        const responseTimes = responseTimesData.get(user) || [];
        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
            : 0;

        userTotalsFinal[user] = {
            ...data,
            active_days: activeDays,
            max_streak_days: maxStreak,
            avg_response_time_ms: avgResponseTime,
            first_message_ms: userFirstMessage.get(user) || null,
            last_message_ms: userLastMessage.get(user) || null,
            avg_message_length: data.messages > 0 ? Math.round(data.total_chars / data.messages) : 0,
            avg_words_per_message: data.messages > 0 ? (data.total_words / data.messages).toFixed(1) : 0,
        };
    }

    // Reaction network
    const reactionNetworkFinal = {};
    for (const [key, count] of reactionNetwork) {
        reactionNetworkFinal[key] = count;
    }

    const reactionNetworkYearlyFinal = {};
    for (const [year, links] of reactionNetworkYearly) {
        reactionNetworkYearlyFinal[year] = {};
        for (const [key, count] of links) {
            reactionNetworkYearlyFinal[year][key] = count;
        }
    }

    // Daily: find top sender
    const dailyFinal = {};
    for (const [key, d] of dailyData) {
        let topSender = null;
        let maxCount = 0;
        for (const [sender, count] of d.sender_counts) {
            if (count > maxCount) {
                maxCount = count;
                topSender = sender;
            }
        }
        dailyFinal[key] = {
            messages: d.messages,
            media: d.media,
            reactions: d.reactions,
            words: d.words,
            top_sender: topSender ? formatSenderName(topSender) : '—',
        };
    }

    // Weekly
    const weeklyFinal = {};
    for (const [key, w] of weeklyData) {
        weeklyFinal[key] = { messages: w.messages, reactions: w.reactions };
    }

    // Yearly daily
    const yearlyDailyFinal = {};
    for (const [dateKey, d] of Object.entries(dailyFinal)) {
        const year = dateKey.split('-')[0];
        if (!yearlyDailyFinal[year]) yearlyDailyFinal[year] = {};
        yearlyDailyFinal[year][dateKey] = d;
    }

    // Content type stats
    const contentTypeFinal = {};
    for (const [type, count] of contentTypeStats) {
        contentTypeFinal[type] = count;
    }

    // User content types
    const userContentTypesFinal = {};
    for (const [user, types] of userContentTypes) {
        userContentTypesFinal[user] = {};
        for (const [type, count] of types) {
            userContentTypesFinal[user][type] = count;
        }
    }

    // Top domains
    const topDomains = Array.from(linkDomains.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([domain, count]) => ({ domain, count }));

    // Top emojis in content
    const topContentEmojis = Array.from(emojiInContent.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([emoji, count]) => ({ emoji, count }));

    // Top words (filter common words - English and French)
    // NOTE: Only filter truly structural/generic words. Keep expressive words, slang,
    // and filler words that reveal personality and speaking habits.
    const stopWords = new Set([
        // English structural words
        'that', 'this', 'with', 'have', 'from', 'they', 'been', 'what', 'when', 'will',
        'more', 'your', 'about', 'there', 'some', 'would', 'make', 'than', 'them',
        'after', 'also', 'most', 'only', 'come', 'over', 'such', 'take', 'into',
        'could', 'being', 'because', 'though',
        // French articles & determiners (purely structural)
        'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'ce', 'cette', 'ces', 'mon',
        'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre',
        'vos', 'leur', 'leurs', 'au', 'aux',
        // French pronouns (purely structural)
        'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'moi', 'toi',
        'lui', 'eux', 'qui', 'que', 'dont', 'où', 'y', 'en', 'se', 'me', 'te',
        'celui', 'celle', 'ceux', 'celles', 'ça', 'cela', 'ceci',
        // French prepositions & conjunctions (purely structural)
        'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'vers', 'chez', 'entre',
        'après', 'avant', 'depuis', 'pendant', 'contre', 'et', 'ou', 'mais', 'donc',
        'car', 'ni', 'si', 'comme', 'quand', 'parce', 'puisque', 'alors', 'puis',
        // French basic verb forms (être, avoir - structural)
        'est', 'suis', 'es', 'sont', 'sommes', 'êtes', 'était', 'étais', 'étaient',
        'être', 'été', 'ai', 'as', 'avons', 'avez', 'ont', 'avoir', 'avait', 'avais',
        'fait', 'fais', 'font', 'faites', 'faisons', 'faire', 'faisait',
        'vais', 'vas', 'va', 'allons', 'allez', 'vont', 'aller', 'allait',
        'dit', 'dis', 'dire', 'disait',
        'peut', 'peux', 'peuvent', 'pouvoir', 'pouvait',
        'veux', 'veut', 'vouloir', 'voulait',
        'faut', 'fallait', 'doit', 'dois', 'doivent', 'devoir',
        'sais', 'sait', 'savoir', 'savait',
        // French basic adverbs & function words
        'pas', 'ne', 'plus', 'moins', 'aussi', 'encore', 'toujours', 'jamais', 'déjà',
        'tout', 'tous', 'toute', 'toutes', 'même', 'autre', 'autres', 'rien',
        'oui', 'non', 'ou',
        // Time words (generic)
        'fois', 'moment', 'temps', 'jour', 'jours', 'heure', 'heures'
    ]);
    const topWords = Array.from(wordFrequency.entries())
        .filter(([word]) => !stopWords.has(word))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([word, count]) => ({ word, count }));

    // Session stats
    const sessionStats = {
        total_sessions: conversationSessions.length,
        avg_session_messages: conversationSessions.length > 0
            ? Math.round(messages.length / conversationSessions.length)
            : 0,
        avg_session_duration_min: conversationSessions.length > 0
            ? Math.round(conversationSessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / conversationSessions.length / 60000)
            : 0,
        initiator_counts: {},
    };
    for (const session of conversationSessions) {
        sessionStats.initiator_counts[session.initiator] =
            (sessionStats.initiator_counts[session.initiator] || 0) + 1;
    }

    // Streak analysis (consecutive days)
    const sortedDays = Array.from(activeDaysSet).sort();
    let currentStreak = 1;
    let maxStreak = 1;
    let maxStreakStart = sortedDays[0];
    let maxStreakEnd = sortedDays[0];
    let streakStart = sortedDays[0];

    for (let i = 1; i < sortedDays.length; i++) {
        const prevDate = new Date(sortedDays[i - 1]);
        const currDate = new Date(sortedDays[i]);
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                maxStreakStart = streakStart;
                maxStreakEnd = sortedDays[i];
            }
        } else {
            currentStreak = 1;
            streakStart = sortedDays[i];
        }
    }

    // Gap analysis (longest silence)
    let maxGap = 0;
    let maxGapStart = null;
    let maxGapEnd = null;
    for (let i = 1; i < sortedDays.length; i++) {
        const prevDate = new Date(sortedDays[i - 1]);
        const currDate = new Date(sortedDays[i]);
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays > maxGap) {
            maxGap = diffDays;
            maxGapStart = sortedDays[i - 1];
            maxGapEnd = sortedDays[i];
        }
    }

    // ========== Content Analysis Post-processing (v2.1) ==========

    // Top reacted messages - sort and take top 100
    const topReactedFinal = topReactedMessages
        .sort((a, b) => b.reaction_count - a.reaction_count)
        .slice(0, 100);

    // Word index - convert maps to objects, keep top 1000 words
    const wordIndexFinal = {};
    const sortedWords = Array.from(wordIndexMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 1000);

    for (const [word, data] of sortedWords) {
        if (stopWords.has(word)) continue;
        wordIndexFinal[word] = {
            total_count: data.total,
            by_user: Object.fromEntries(data.byUser),
            by_year: Object.fromEntries(data.byYear),
            by_month: Object.fromEntries(data.byMonth),
            samples: data.samples,
        };
    }

    // Per-user words (top 100 words each)
    const userWordsFinal = {};
    for (const [user, wordMap] of userWordFrequency) {
        userWordsFinal[user] = Array.from(wordMap.entries())
            .filter(([w]) => !stopWords.has(w))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100)
            .map(([word, count]) => ({ word, count }));
    }

    // Phrases - bigrams and trigrams (now with samples)
    const phraseStopWords = new Set(['the', 'and', 'that', 'this', 'with', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out']);
    const topBigrams = Array.from(bigramCounts.entries())
        .filter(([phrase]) => {
            const words = phrase.split(' ');
            return !words.some(w => phraseStopWords.has(w) || w.length < 3);
        })
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 50)
        .map(([phrase, data]) => ({ phrase, count: data.count, samples: data.samples }));

    const topTrigrams = Array.from(trigramCounts.entries())
        .filter(([phrase]) => {
            const words = phrase.split(' ');
            return !words.some(w => phraseStopWords.has(w) || w.length < 2);
        })
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 30)
        .map(([phrase, data]) => ({ phrase, count: data.count, samples: data.samples }));

    const userBigramsFinal = {};
    for (const [user, bgMap] of userBigrams) {
        userBigramsFinal[user] = Array.from(bgMap.entries())
            .filter(([phrase]) => {
                const words = phrase.split(' ');
                return !words.some(w => phraseStopWords.has(w) || w.length < 3);
            })
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([phrase, count]) => ({ phrase, count }));
    }

    const phrasesFinal = {
        bigrams: topBigrams,
        trigrams: topTrigrams,
        user_bigrams: userBigramsFinal,
    };

    // Unique vocabulary - words where 70%+ usage is by one person
    const uniqueWordsFinal = {};
    for (const [user, wordMap] of userWordFrequency) {
        const userUnique = [];
        for (const [word, count] of wordMap) {
            if (count < 3 || stopWords.has(word)) continue;
            const totalCount = wordFrequency.get(word) || count;
            const uniquenessScore = count / totalCount;
            if (uniquenessScore >= 0.7) {
                // Get samples from wordIndexMap if available
                const wordData = wordIndexMap.get(word);
                const samples = wordData?.samples || [];
                userUnique.push({
                    word,
                    count,
                    uniqueness_score: uniquenessScore,
                    samples: samples.slice(0, 5),
                });
            }
        }
        uniqueWordsFinal[user] = userUnique
            .sort((a, b) => b.count - a.count)
            .slice(0, 30);
    }

    // Word trends - monthly/yearly for top 50 words
    const wordTrendsFinal = {};
    const top50Words = topWords.slice(0, 50);
    for (const { word } of top50Words) {
        const wi = wordIndexMap.get(word);
        if (wi) {
            wordTrendsFinal[word] = {
                monthly: Object.fromEntries(wi.byMonth),
                yearly: Object.fromEntries(wi.byYear),
            };
        }
    }

    // Sentiment - convert to final format
    const sentimentFinal = {
        overall: {
            positive: sentimentOverall.positive,
            negative: sentimentOverall.negative,
            neutral: sentimentOverall.neutral,
            score: sentimentOverall.count > 0
                ? (sentimentOverall.positive - sentimentOverall.negative) / sentimentOverall.count
                : 0,
        },
        by_user: {},
        by_month: {},
        by_year: {},
    };

    for (const [user, data] of sentimentByUser) {
        const samples = sentimentSamplesByUser.get(user) || { positive: [], negative: [] };
        // Final sort and slice for samples
        samples.positive.sort((a, b) => b.score - a.score);
        samples.negative.sort((a, b) => a.score - b.score);

        sentimentFinal.by_user[user] = {
            positive: data.positive,
            negative: data.negative,
            neutral: data.neutral,
            score: data.count > 0 ? (data.positive - data.negative) / data.count : 0,
            samples: {
                positive: samples.positive.slice(0, 5),
                negative: samples.negative.slice(0, 5),
            },
        };
    }

    for (const [month, data] of sentimentByMonth) {
        sentimentFinal.by_month[month] = {
            positive: data.positive,
            negative: data.negative,
            neutral: data.neutral,
            score: data.count > 0 ? (data.positive - data.negative) / data.count : 0,
        };
    }

    for (const [year, data] of sentimentByYear) {
        sentimentFinal.by_year[year] = {
            positive: data.positive,
            negative: data.negative,
            neutral: data.neutral,
            score: data.count > 0 ? (data.positive - data.negative) / data.count : 0,
        };
    }

    // Global stats
    const firstTs = messages[0]?.timestamp_ms || null;
    const lastTs = messages[messages.length - 1]?.timestamp_ms || null;
    const allYearsList = Array.from(yearlyData.keys()).map(Number).sort((a, b) => b - a);
    const allUsersSorted = Array.from(allUsers).sort();

    const userDisplayNames = {};
    for (const fullName of allUsersSorted) {
        userDisplayNames[fullName] = formatSenderName(fullName);
    }

    return {
        // Schema version
        schema_version: '2.1',

        // Time-series data
        monthly: monthlyFinal,
        user_monthly: userMonthlyFinal,
        yearly: yearlyFinal,
        daily: dailyFinal,
        weekly: weeklyFinal,
        yearly_daily: yearlyDailyFinal,

        // User data
        user_totals: userTotalsFinal,
        user_content_types: userContentTypesFinal,

        // Network data
        reaction_network: reactionNetworkFinal,
        reaction_network_yearly: reactionNetworkYearlyFinal,

        // Content analysis (basic)
        content_types: contentTypeFinal,
        top_domains: topDomains,
        top_content_emojis: topContentEmojis,
        top_words: topWords,

        // Content analysis (v2.1 - enhanced)
        top_reacted_messages: topReactedFinal,
        word_index: wordIndexFinal,
        user_words: userWordsFinal,
        phrases: phrasesFinal,
        unique_words: uniqueWordsFinal,
        word_trends: wordTrendsFinal,
        sentiment: sentimentFinal,

        // Full message storage (v2.2 - for exploration)
        message_store: messageStore,
        word_to_messages: Object.fromEntries(wordToMessageIds),
        user_sentiment_messages: Object.fromEntries(
            [...userSentimentMessages.entries()].map(([user, data]) => [user, data])
        ),

        // Session analysis
        sessions: sessionStats,

        // Streak and gap analysis
        streaks: {
            max_streak_days: maxStreak,
            max_streak_start: maxStreakStart,
            max_streak_end: maxStreakEnd,
            total_active_days: activeDaysSet.size,
        },
        gaps: {
            max_gap_days: maxGap,
            max_gap_start: maxGapStart,
            max_gap_end: maxGapEnd,
        },

        // Special content stats
        calls: {
            total_calls: callStats.totalCalls,
            total_duration_sec: callStats.totalDuration,
            by_user: Object.fromEntries(callStats.users),
        },
        bumps: {
            total: bumpsCount.total,
            by_user: Object.fromEntries(bumpsCount.users),
        },
        unsent: {
            total: unsentCount.total,
            by_user: Object.fromEntries(unsentCount.users),
        },
        stickers: {
            total: stickerCount.total,
            by_user: Object.fromEntries(stickerCount.users),
        },

        // Timezone inference
        timezone: {
            inferred_offset_hours: inferredTimezoneOffset,
            hourly_activity_utc: hourlyActivityUTC,
            confidence: Math.max(...hourlyActivityUTC) > messages.length * 0.1 ? 'high' : 'low',
        },

        // Global stats
        global: {
            total_messages: messages.length,
            total_reactions: totalReactions,
            total_words: Array.from(wordFrequency.values()).reduce((a, b) => a + b, 0),
            first_date_ms: firstTs,
            last_date_ms: lastTs,
            all_users: allUsersSorted,
            all_years: allYearsList,
            user_display_names: userDisplayNames,
        },
    };
}

/**
 * Create empty aggregates structure (v2.1 schema)
 */
function createEmptyAggregates() {
    return {
        schema_version: '2.1',
        monthly: {},
        user_monthly: {},
        yearly: {},
        user_totals: {},
        user_content_types: {},
        reaction_network: {},
        reaction_network_yearly: {},
        daily: {},
        weekly: {},
        yearly_daily: {},
        content_types: {},
        top_domains: [],
        top_content_emojis: [],
        top_words: [],
        // Content analysis (v2.1)
        top_reacted_messages: [],
        word_index: {},
        user_words: {},
        phrases: { bigrams: [], trigrams: [], user_bigrams: {} },
        unique_words: {},
        word_trends: {},
        sentiment: {
            overall: { positive: 0, negative: 0, neutral: 0, score: 0 },
            by_user: {},
            by_month: {},
            by_year: {},
        },
        // Full message storage (v2.2)
        message_store: [],
        word_to_messages: {},
        user_sentiment_messages: {},
        sessions: {
            total_sessions: 0,
            avg_session_messages: 0,
            avg_session_duration_min: 0,
            initiator_counts: {},
        },
        streaks: {
            max_streak_days: 0,
            max_streak_start: null,
            max_streak_end: null,
            total_active_days: 0,
        },
        gaps: {
            max_gap_days: 0,
            max_gap_start: null,
            max_gap_end: null,
        },
        calls: {
            total_calls: 0,
            total_duration_sec: 0,
            by_user: {},
        },
        bumps: { total: 0, by_user: {} },
        unsent: { total: 0, by_user: {} },
        stickers: { total: 0, by_user: {} },
        timezone: {
            inferred_offset_hours: 0,
            hourly_activity_utc: new Array(24).fill(0),
            confidence: 'low',
        },
        global: {
            total_messages: 0,
            total_reactions: 0,
            total_words: 0,
            first_date_ms: null,
            last_date_ms: null,
            all_users: [],
            all_years: [],
            user_display_names: {},
        },
    };
}

export default { parseMessengerFolders, parseConversation };
