/**
 * Demo Data
 * =========
 * Realistic conversation data for demo purposes.
 * Simulates a college friend group that's been chatting since 2019.
 */

// A realistic friend group - college friends who stayed in touch
const DEMO_USERS = [
    'Emma Johnson',
    'Paul Palmieri',
    'Sophie Martinez',
    'Noah Kim',
    'Olivia Patel'
];

const DEMO_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019];

// User personalities (affects activity patterns)
// Emma: The planner, most active, organizes events
// Paul: The meme guy, sends lots of media
// Sophie: Steady contributor, lots of reactions
// Noah: Occasional but meaningful contributions
// Olivia: Quiet but always there for big moments
const USER_ACTIVITY = {
    'Emma Johnson': 1.4,      // Most active - the group organizer
    'Paul Palmieri': 1.2,     // Second most - the meme sender
    'Sophie Martinez': 1.0,   // Average, consistent
    'Noah Kim': 0.75,         // Less active but engaged
    'Olivia Patel': 0.65,     // Least active but loyal
};

// Media tendencies (some people share more photos/videos)
const USER_MEDIA_TENDENCY = {
    'Emma Johnson': 1.3,      // Documents everything
    'Paul Palmieri': 1.8,     // Meme lord
    'Sophie Martinez': 1.0,   // Normal
    'Noah Kim': 0.6,          // Rarely shares media
    'Olivia Patel': 0.8,      // Occasional
};

// Reaction tendencies (some people react more)
const USER_REACTION_TENDENCY = {
    'Emma Johnson': 1.2,
    'Paul Palmieri': 0.9,
    'Sophie Martinez': 1.6,   // React queen
    'Noah Kim': 0.7,
    'Olivia Patel': 1.1,
};

// Seeded random for consistent demo data
let seed = 42;
function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
}

function randomBetween(min, max) {
    return min + seededRandom() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
}

// Generate monthly data with realistic patterns
function generateMonthlyData() {
    const monthly = {};
    
    // Base activity that grows over time as the group gets closer
    const yearActivity = {
        2019: 0.5,   // Just starting out
        2020: 1.4,   // COVID lockdown - lots of chatting
        2021: 1.2,   // Still high
        2022: 0.9,   // Normalizing
        2023: 0.85,  // Steady
        2024: 0.9,   // Building back up
        2025: 1.3,   // Group renaissance - everyone's back!
    };
    
    // Monthly seasonal patterns (summer vacations, holidays)
    const monthSeasonality = {
        1: 0.9,   // January - new year energy
        2: 0.75,  // February - quiet
        3: 0.8,   // March
        4: 0.85,  // April
        5: 0.9,   // May - end of semester
        6: 1.1,   // June - summer starts
        7: 1.3,   // July - peak summer, trips
        8: 1.2,   // August
        9: 0.95,  // September - back to routine
        10: 0.85, // October
        11: 1.0,  // November - thanksgiving plans
        12: 1.4,  // December - holidays, parties
    };
    
    for (const year of DEMO_YEARS) {
        const maxMonth = year === 2025 ? 12 : 12;

        for (let month = 1; month <= maxMonth; month++) {
            // Skip future months
            if (year === 2025 && month > 12) continue;
            
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const yearMult = yearActivity[year] || 1;
            const seasonMult = monthSeasonality[month] || 1;
            
            // Base messages per month (250-400 for a 5-person group)
            const baseMsgs = randomInt(250, 400);
            const msgCount = Math.round(baseMsgs * yearMult * seasonMult);
            
            monthly[monthKey] = {
                messages: msgCount,
                reactions: Math.round(msgCount * randomBetween(0.5, 0.8)),
                media: {
                    photos: Math.round(msgCount * randomBetween(0.08, 0.15)),
                    videos: Math.round(msgCount * randomBetween(0.02, 0.05)),
                    audio: Math.round(msgCount * randomBetween(0.005, 0.02)),
                    gifs: Math.round(msgCount * randomBetween(0.05, 0.12))
                },
                active_users: randomInt(3, 5),
                initiations: Math.round(msgCount * randomBetween(0.02, 0.04)),
                total_chars: msgCount * randomInt(35, 55),
                call_duration: randomInt(0, 7200),
                hourly: generateHourlyDistribution(msgCount),
                daily: generateDailyDistribution(msgCount)
            };
        }
    }
    return monthly;
}

// Realistic hourly distribution (peak in evening, quiet at night)
function generateHourlyDistribution(total) {
    // Weight by hour (0-23): night quiet, morning buildup, evening peak
    const weights = [
        0.8,  // 0 - midnight
        0.4,  // 1
        0.2,  // 2
        0.1,  // 3
        0.1,  // 4
        0.15, // 5
        0.3,  // 6
        0.6,  // 7
        1.2,  // 8 - morning commute
        2.0,  // 9
        2.5,  // 10
        3.0,  // 11
        3.5,  // 12 - lunch
        3.0,  // 13
        2.5,  // 14
        2.8,  // 15
        3.2,  // 16
        4.0,  // 17 - after work
        5.0,  // 18
        6.0,  // 19
        7.0,  // 20 - peak evening
        6.5,  // 21
        4.5,  // 22
        2.5,  // 23
    ];
    const sum = weights.reduce((a, b) => a + b, 0);
    
    // Use largest remainder method to distribute total while preserving proportions
    // This prevents small values from rounding to 0
    const rawValues = weights.map(w => (w / sum) * total * randomBetween(0.9, 1.1));
    const floorValues = rawValues.map(v => Math.floor(v));
    const remainders = rawValues.map((v, i) => ({ i, r: v - floorValues[i] }));
    
    // Distribute remaining count to hours with largest remainders
    let distributed = floorValues.reduce((a, b) => a + b, 0);
    remainders.sort((a, b) => b.r - a.r);
    
    let idx = 0;
    while (distributed < total && idx < 24) {
        floorValues[remainders[idx].i]++;
        distributed++;
        idx++;
    }
    
    return floorValues;
}

// Weekly distribution (weekends more active)
function generateDailyDistribution(total) {
    const weights = [5, 6, 5.5, 6, 7.5, 9, 8]; // Mon-Sun
    const sum = weights.reduce((a, b) => a + b, 0);
    
    // Use largest remainder method to distribute total while preserving proportions
    const rawValues = weights.map(w => (w / sum) * total * randomBetween(0.9, 1.1));
    const floorValues = rawValues.map(v => Math.floor(v));
    const remainders = rawValues.map((v, i) => ({ i, r: v - floorValues[i] }));
    
    let distributed = floorValues.reduce((a, b) => a + b, 0);
    remainders.sort((a, b) => b.r - a.r);
    
    let idx = 0;
    while (distributed < total && idx < 7) {
        floorValues[remainders[idx].i]++;
        distributed++;
        idx++;
    }
    
    return floorValues;
}

// Generate user monthly data with personality-based patterns
function generateUserMonthlyData() {
    const userMonthly = {};
    const monthly = generateMonthlyData();
    
    for (const user of DEMO_USERS) {
        userMonthly[user] = {};
        const activity = USER_ACTIVITY[user] || 1;
        const mediaTendency = USER_MEDIA_TENDENCY[user] || 1;
        const reactionTendency = USER_REACTION_TENDENCY[user] || 1;
        
        for (const [monthKey, monthData] of Object.entries(monthly)) {
            // Calculate this user's share of messages
            const totalActivity = Object.values(USER_ACTIVITY).reduce((a, b) => a + b, 0);
            const userShare = activity / totalActivity;
            const userMsgCount = Math.round(monthData.messages * userShare * randomBetween(0.85, 1.15));
            
            // Reactions based on personality
            const reactionsReceived = Math.round(userMsgCount * randomBetween(0.35, 0.55) * reactionTendency);
            const reactionsGiven = Math.round(monthData.messages * 0.12 * reactionTendency * randomBetween(0.8, 1.2));
            
            userMonthly[user][monthKey] = {
                messages: userMsgCount,
                reactions_received: reactionsReceived,
                reactions_given: reactionsGiven,
                initiations: Math.round(userMsgCount * randomBetween(0.015, 0.04)),
                media: {
                    photos: Math.round(userMsgCount * 0.08 * mediaTendency * randomBetween(0.7, 1.3)),
                    videos: Math.round(userMsgCount * 0.025 * mediaTendency * randomBetween(0.5, 1.5)),
                    audio: Math.round(userMsgCount * 0.008 * mediaTendency * randomBetween(0.3, 1.7))
                },
                total_chars: userMsgCount * randomInt(30, 60),
                hourly: generateHourlyDistribution(userMsgCount),
                daily: generateDailyDistribution(userMsgCount)
            };
        }
    }
    return userMonthly;
}

// Generate yearly summary data
function generateYearlyData() {
    const yearly = {};
    const topEmojis = ['😂', '❤️', '💀', '😭', '🔥', '👍', '😍', '🙏', '✨', '🤣'];
    
    const yearActivity = {
        2019: 0.5,
        2020: 1.4,
        2021: 1.2,
        2022: 0.9,
        2023: 0.85,
        2024: 0.9,
        2025: 1.3,
    };

    for (const year of DEMO_YEARS) {
        const yearMult = yearActivity[year] || 1;
        const monthsInYear = year === 2025 ? 12 : 12;
        const baseMsgsPerMonth = 320;
        const totalMsgs = Math.round(baseMsgsPerMonth * monthsInYear * yearMult * randomBetween(0.9, 1.1));
        
        yearly[year] = {
            messages: totalMsgs,
            reactions: Math.round(totalMsgs * randomBetween(0.55, 0.75)),
            active_users: DEMO_USERS.length,
            top_messagers: DEMO_USERS.map(name => ({
                name,
                count: Math.round(totalMsgs * (USER_ACTIVITY[name] / Object.values(USER_ACTIVITY).reduce((a,b) => a+b, 0)) * randomBetween(0.9, 1.1))
            })).sort((a, b) => b.count - a.count),
            top_reactors: DEMO_USERS.map(name => ({
                name,
                count: Math.round(totalMsgs * 0.15 * USER_REACTION_TENDENCY[name] * randomBetween(0.8, 1.2))
            })).sort((a, b) => b.count - a.count),
            top_emojis: topEmojis.map((emoji, i) => ({
                emoji,
                count: Math.round(totalMsgs * 0.08 * (1 - i * 0.08) * randomBetween(0.85, 1.15))
            })),
            peak_hour: 20,
            peak_day: 6, // Saturday
            hourly: generateHourlyDistribution(totalMsgs),
            daily: generateDailyDistribution(totalMsgs)
        };
    }
    return yearly;
}

// Generate user totals across all time
function generateUserTotals() {
    const userTotals = {};
    const userMonthly = generateUserMonthlyData();
    
    for (const user of DEMO_USERS) {
        const monthlyData = userMonthly[user];
        let totalMsgs = 0;
        let totalReactionsReceived = 0;
        let totalReactionsGiven = 0;
        let totalInitiations = 0;
        let totalChars = 0;
        let totalPhotos = 0;
        let totalVideos = 0;
        let totalAudio = 0;
        
        for (const data of Object.values(monthlyData)) {
            totalMsgs += data.messages;
            totalReactionsReceived += data.reactions_received;
            totalReactionsGiven += data.reactions_given;
            totalInitiations += data.initiations;
            totalChars += data.total_chars;
            totalPhotos += data.media.photos;
            totalVideos += data.media.videos;
            totalAudio += data.media.audio;
        }
        
        // Generate streak and active days based on message count
        // More messages = more likely to have longer streaks
        const activeMonths = Object.keys(monthlyData).length;
        const activeDays = Math.min(Math.floor(totalMsgs / 8) + activeMonths * 15, activeMonths * 30);
        // Streak is typically less than active days - simulate realistic consecutive day patterns
        const maxStreakDays = Math.min(Math.floor(activeDays * (0.3 + seededRandom() * 0.4)), 180);
        
        userTotals[user] = {
            messages: totalMsgs,
            reactions_received: totalReactionsReceived,
            reactions_given: totalReactionsGiven,
            initiations: totalInitiations,
            media: {
                photos: totalPhotos,
                videos: totalVideos,
                audio: totalAudio
            },
            total_chars: totalChars,
            active_days: activeDays,
            max_streak_days: maxStreakDays
        };
    }
    return userTotals;
}

// Generate reaction network (who reacts to whom)
function generateReactionNetwork() {
    const network = {};
    
    // Define some friendship pairs that have stronger connections
    const closePairs = [
        ['Emma Johnson', 'Sophie Martinez'],  // Best friends
        ['Paul Palmieri', 'Noah Kim'],        // Gaming buddies
        ['Emma Johnson', 'Paul Palmieri'],    // Close friends
        ['Sophie Martinez', 'Olivia Patel'],  // Close friends
    ];
    
    for (const reactor of DEMO_USERS) {
        for (const receiver of DEMO_USERS) {
            if (reactor !== receiver) {
                const key = `${reactor}|${receiver}`;
                
                // Base reactions
                let baseReactions = randomInt(80, 180);
                
                // Boost for close pairs
                const isClosePair = closePairs.some(pair => 
                    (pair[0] === reactor && pair[1] === receiver) ||
                    (pair[1] === reactor && pair[0] === receiver)
                );
                if (isClosePair) {
                    baseReactions = Math.round(baseReactions * randomBetween(1.5, 2.2));
                }
                
                // Adjust by reactor's tendency
                baseReactions = Math.round(baseReactions * (USER_REACTION_TENDENCY[reactor] || 1));
                
                network[key] = baseReactions;
            }
        }
    }
    return network;
}

// Generate daily data for heatmap
function generateDailyData() {
    const daily = {};
    const startDate = new Date(2019, 0, 1);
    const endDate = new Date(2025, 11, 13);

    const yearActivity = {
        2019: 0.5,
        2020: 1.4,
        2021: 1.2,
        2022: 0.9,
        2023: 0.85,
        2024: 0.9,
        2025: 1.3,
    };
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split('T')[0];
        const year = d.getFullYear();
        const dayOfWeek = d.getDay();
        const month = d.getMonth() + 1;
        
        // Weekend boost
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const weekendMult = isWeekend ? 1.4 : 1;
        
        // Holiday boost (December)
        const holidayMult = month === 12 ? 1.3 : 1;
        
        // Year activity
        const yearMult = yearActivity[year] || 1;
        
        // Base messages per day
        const baseMsgs = randomInt(5, 20);
        const msgCount = Math.round(baseMsgs * weekendMult * holidayMult * yearMult * randomBetween(0.5, 1.8));
        
        // Only record days with activity
        if (msgCount >= 3) {
            // Pick a random top sender weighted by activity
            const weights = DEMO_USERS.map(u => USER_ACTIVITY[u]);
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let r = seededRandom() * totalWeight;
            let topSender = DEMO_USERS[0];
            for (let i = 0; i < DEMO_USERS.length; i++) {
                r -= weights[i];
                if (r <= 0) {
                    topSender = DEMO_USERS[i];
                    break;
                }
            }
            
            const parts = topSender.split(' ');
            daily[dateKey] = {
                messages: msgCount,
                media: Math.round(msgCount * randomBetween(0.1, 0.25)),
                top_sender: `${parts[0]} ${parts[1][0]}.`
            };
        }
    }
    return daily;
}

// Generate weekly data
function generateWeeklyData() {
    const weekly = {};
    const startDate = new Date(2019, 0, 7);
    const endDate = new Date(2025, 11, 8);

    const yearActivity = {
        2019: 0.5,
        2020: 1.4,
        2021: 1.2,
        2022: 0.9,
        2023: 0.85,
        2024: 0.9,
        2025: 1.3,
    };
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 7)) {
        const weekKey = d.toISOString().split('T')[0];
        const year = d.getFullYear();
        const yearMult = yearActivity[year] || 1;
        
        weekly[weekKey] = {
            messages: Math.round(randomInt(50, 120) * yearMult)
        };
    }
    return weekly;
}

// Generate yearly daily data (for heatmap organization)
function generateYearlyDaily() {
    const daily = generateDailyData();
    const yearlyDaily = {};
    
    for (const [dateKey, data] of Object.entries(daily)) {
        const year = dateKey.split('-')[0];
        if (!yearlyDaily[year]) yearlyDaily[year] = {};
        yearlyDaily[year][dateKey] = data;
    }
    return yearlyDaily;
}

/**
 * Derive monthly aggregates from user_monthly data
 * This ensures monthly and user_monthly are consistent (like real data)
 */
function deriveMonthlyFromUserMonthly(userMonthly) {
    const monthly = {};
    
    Object.values(userMonthly).forEach(userMonths => {
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
            m.reactions += (userData.reactions_received || 0);
            m.initiations += userData.initiations || 0;
            m.total_chars += userData.total_chars || 0;
            
            if (userData.media) {
                m.media.photos += userData.media.photos || 0;
                m.media.videos += userData.media.videos || 0;
                m.media.audio += userData.media.audio || 0;
            }
            
            // Sum hourly distributions from each user
            if (userData.hourly && Array.isArray(userData.hourly)) {
                userData.hourly.forEach((count, i) => {
                    m.hourly[i] += count || 0;
                });
            }
            
            // Sum daily distributions from each user
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
        Object.values(userMonthly).forEach(userMonths => {
            if (userMonths[monthKey] && userMonths[monthKey].messages > 0) {
                activeCount++;
            }
        });
        monthly[monthKey].active_users = activeCount;
    });
    
    return monthly;
}

// ========== Content Analysis Demo Data (v2.1) ==========

// Sample popular messages that got lots of reactions
const SAMPLE_MESSAGES = [
    "Guys I just got the job!!!! 🎉🎉🎉",
    "HAPPY BIRTHDAY!!! Love you so much ❤️",
    "Who's ready for the trip next weekend?",
    "Just landed in Tokyo! Here we go!",
    "Plot twist: I'm engaged 💍",
    "This might be the best photo I've ever taken",
    "Remember when we all lived together? Good times",
    "I can't believe it's been 5 years since graduation",
    "LOOK AT THIS SUNSET",
    "My cat just did the funniest thing",
    "Finally finished my thesis!!",
    "We should do a reunion trip this summer",
    "Just saw the weirdest thing on my commute",
    "Throwback to that time we stayed up all night",
    "You guys are the best friends anyone could ask for",
    "This restaurant is absolutely incredible",
    "Guess who just got promoted?!",
    "I miss you all so much 😭",
    "The concert was INSANE last night",
    "Just adopted a puppy!!!",
];

// Generate top reacted messages
function generateTopReactedMessages() {
    const messages = [];
    const reactionEmojis = ['😂', '❤️', '🔥', '😭', '👍', '💀', '✨', '🙏'];

    for (let i = 0; i < 100; i++) {
        const sender = DEMO_USERS[randomInt(0, DEMO_USERS.length - 1)];
        const year = DEMO_YEARS[randomInt(0, DEMO_YEARS.length - 1)];
        const month = randomInt(1, 12);
        const day = randomInt(1, 28);
        const reactionCount = Math.max(3, Math.floor(15 - i * 0.12 + randomBetween(-2, 2)));

        const reactions = {};
        for (let r = 0; r < reactionCount; r++) {
            const emoji = reactionEmojis[randomInt(0, reactionEmojis.length - 1)];
            reactions[emoji] = (reactions[emoji] || 0) + 1;
        }

        messages.push({
            content: SAMPLE_MESSAGES[i % SAMPLE_MESSAGES.length],
            sender,
            timestamp_ms: new Date(year, month - 1, day, randomInt(8, 22)).getTime(),
            reaction_count: reactionCount,
            reactions,
            year,
        });
    }

    return messages.sort((a, b) => b.reaction_count - a.reaction_count);
}

// Common words for demo - words that friends might frequently use
const DEMO_WORDS = [
    'haha', 'yeah', 'okay', 'good', 'love', 'nice', 'cool', 'right', 'time', 'going',
    'tonight', 'tomorrow', 'weekend', 'dinner', 'party', 'work', 'home', 'call', 'text',
    'funny', 'amazing', 'awesome', 'great', 'sure', 'sounds', 'coming', 'want', 'need',
    'miss', 'back', 'here', 'there', 'think', 'know', 'wait', 'ready', 'later', 'soon',
    'guys', 'trip', 'photos', 'video', 'watch', 'food', 'place', 'coffee', 'lunch', 'meet'
];

// Generate word index with samples
function generateWordIndex() {
    const wordIndex = {};

    for (const word of DEMO_WORDS) {
        const totalCount = randomInt(50, 500);
        const byUser = {};
        const byYear = {};
        const byMonth = {};

        // Distribute among users
        let remaining = totalCount;
        for (let i = 0; i < DEMO_USERS.length; i++) {
            const user = DEMO_USERS[i];
            const share = i === DEMO_USERS.length - 1 ? remaining : randomInt(10, Math.floor(remaining / 2));
            byUser[user] = share;
            remaining -= share;
        }

        // Distribute among years
        remaining = totalCount;
        for (let i = 0; i < DEMO_YEARS.length; i++) {
            const year = DEMO_YEARS[i];
            const share = i === DEMO_YEARS.length - 1 ? remaining : randomInt(5, Math.floor(remaining / 2));
            byYear[year] = share;
            remaining -= share;
        }

        // Generate monthly distribution
        for (const year of DEMO_YEARS) {
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                byMonth[monthKey] = randomInt(1, 20);
            }
        }

        // Generate sample messages
        const samples = [];
        for (let s = 0; s < 5; s++) {
            samples.push({
                content: `Sample message containing ${word} in context...`,
                sender: DEMO_USERS[randomInt(0, DEMO_USERS.length - 1)],
                timestamp_ms: new Date(DEMO_YEARS[randomInt(0, 3)], randomInt(0, 11), randomInt(1, 28)).getTime(),
            });
        }

        wordIndex[word] = {
            total_count: totalCount,
            by_user: byUser,
            by_year: byYear,
            by_month: byMonth,
            samples,
        };
    }

    return wordIndex;
}

// Generate per-user word lists
function generateUserWords() {
    const userWords = {};

    // Give each user some signature words
    const userSignatureWords = {
        'Emma Johnson': ['planning', 'organized', 'schedule', 'excited'],
        'Paul Palmieri': ['literally', 'bruh', 'gaming', 'meme'],
        'Sophie Martinez': ['adorable', 'sweet', 'lovely', 'cutie'],
        'Noah Kim': ['actually', 'interesting', 'research', 'podcast'],
        'Olivia Patel': ['grateful', 'blessed', 'peaceful', 'yoga'],
    };

    for (const user of DEMO_USERS) {
        const words = [...DEMO_WORDS.slice(0, 30)];
        // Add signature words
        if (userSignatureWords[user]) {
            words.push(...userSignatureWords[user]);
        }

        userWords[user] = words.map(word => ({
            word,
            count: randomInt(20, 200),
        })).sort((a, b) => b.count - a.count).slice(0, 100);
    }

    return userWords;
}

// Generate phrases (bigrams and trigrams) with samples
function generatePhrases() {
    const generatePhraseSamples = (phrase) => {
        const templates = [
            `Yeah ${phrase} for sure!`,
            `I think ${phrase} would be great`,
            `Haha ${phrase}!`,
        ];
        return templates.map((content, i) => ({
            content,
            sender: DEMO_USERS[i % DEMO_USERS.length],
            timestamp_ms: Date.now() - randomInt(1000000, 100000000),
        }));
    };

    const bigrams = [
        'sounds good', 'see you', 'let me', 'right now', 'so funny',
        'love this', 'miss you', 'good morning', 'good night', 'thanks guys',
        'happy birthday', 'come over', 'next week', 'last night', 'no way',
        'oh wow', 'feel like', 'wait what', 'just got', 'going out',
    ].map(phrase => ({
        phrase,
        count: randomInt(30, 200),
        samples: generatePhraseSamples(phrase),
    })).sort((a, b) => b.count - a.count);

    const trigrams = [
        'see you soon', 'let me know', 'sounds like fun', 'can not wait',
        'have a good', 'what the heck', 'going to be', 'how are you',
        'miss you guys', 'happy for you', 'love you guys', 'see you there',
    ].map(phrase => ({
        phrase,
        count: randomInt(15, 100),
        samples: generatePhraseSamples(phrase),
    })).sort((a, b) => b.count - a.count);

    const userBigrams = {};
    for (const user of DEMO_USERS) {
        userBigrams[user] = bigrams.slice(0, 10).map(({ phrase }) => ({
            phrase,
            count: randomInt(5, 50),
        }));
    }

    return { bigrams, trigrams, user_bigrams: userBigrams };
}

// Generate unique/signature words per user
function generateUniqueWords() {
    const uniqueWords = {};

    // Helper to generate samples for a signature word
    const generateSamples = (user, word) => {
        const templates = {
            'spreadsheet': [
                "I made a spreadsheet for the trip planning!",
                "Check the spreadsheet I shared, it has all the details",
                "Updated the spreadsheet with everyone's availability",
            ],
            'itinerary': [
                "Here's the itinerary for next weekend",
                "The itinerary looks perfect, can't wait!",
                "I'll send the full itinerary tomorrow",
            ],
            'checklist': [
                "Made a checklist so we don't forget anything",
                "Can everyone check off items on the checklist?",
                "The checklist is almost complete!",
            ],
            'nerfed': [
                "They totally nerfed my main character again",
                "That weapon got nerfed so hard it's useless now",
                "Everything fun gets nerfed eventually smh",
            ],
            'clutch': [
                "That was such a clutch play at the end!",
                "We need someone clutch for this mission",
                "Bro came in clutch with the revive",
            ],
            'respawn': [
                "Where do we respawn after this?",
                "I'll respawn and meet you there",
                "The respawn timer is so long in this game",
            ],
            'aesthetic': [
                "The aesthetic of this place is everything",
                "Going for that cozy fall aesthetic",
                "This fits the aesthetic perfectly",
            ],
            'vibe': [
                "The vibe here is immaculate",
                "I'm really feeling the vibe today",
                "This song has such a good vibe",
            ],
            'slay': [
                "You're going to slay at the interview!",
                "That outfit? Absolute slay!",
                "We came here to slay and that's what we did",
            ],
            'algorithm': [
                "The algorithm is definitely showing me weird stuff",
                "I think we need a better algorithm for this",
                "Once you understand the algorithm it makes sense",
            ],
            'hypothesis': [
                "My hypothesis is that it's a caching issue",
                "We should test the hypothesis first",
                "The data supports my original hypothesis",
            ],
            'correlation': [
                "There's definitely a correlation here",
                "Correlation doesn't mean causation though",
                "I found a strong correlation in the results",
            ],
            'meditation': [
                "Started my morning with meditation today",
                "Meditation has been helping so much",
                "You should try guided meditation!",
            ],
            'mindful': [
                "Trying to be more mindful about my choices",
                "It's important to stay mindful during stress",
                "Being mindful really changes perspective",
            ],
            'namaste': [
                "Namaste everyone, hope you're all well",
                "Ending today's session with namaste",
                "Namaste and positive vibes to you all",
            ],
        };

        const wordTemplates = templates[word] || [
            `Something about ${word}`,
            `I mentioned ${word} the other day`,
            `The ${word} thing is interesting`,
        ];

        return wordTemplates.map((content, i) => ({
            content,
            sender: user,
            timestamp_ms: Date.now() - randomInt(1000000, 100000000),
        }));
    };

    const userSignatures = {
        'Emma Johnson': [
            { word: 'spreadsheet', count: 45, uniqueness_score: 0.92 },
            { word: 'itinerary', count: 32, uniqueness_score: 0.88 },
            { word: 'checklist', count: 28, uniqueness_score: 0.85 },
        ],
        'Paul Palmieri': [
            { word: 'nerfed', count: 38, uniqueness_score: 0.95 },
            { word: 'clutch', count: 52, uniqueness_score: 0.78 },
            { word: 'respawn', count: 22, uniqueness_score: 0.91 },
        ],
        'Sophie Martinez': [
            { word: 'aesthetic', count: 41, uniqueness_score: 0.82 },
            { word: 'vibe', count: 67, uniqueness_score: 0.71 },
            { word: 'slay', count: 35, uniqueness_score: 0.88 },
        ],
        'Noah Kim': [
            { word: 'algorithm', count: 29, uniqueness_score: 0.93 },
            { word: 'hypothesis', count: 18, uniqueness_score: 0.95 },
            { word: 'correlation', count: 15, uniqueness_score: 0.94 },
        ],
        'Olivia Patel': [
            { word: 'meditation', count: 44, uniqueness_score: 0.89 },
            { word: 'mindful', count: 31, uniqueness_score: 0.92 },
            { word: 'namaste', count: 19, uniqueness_score: 0.97 },
        ],
    };

    for (const user of DEMO_USERS) {
        const words = userSignatures[user] || [];
        uniqueWords[user] = words.map(wordData => ({
            ...wordData,
            samples: generateSamples(user, wordData.word),
        }));
    }

    return uniqueWords;
}

// Generate word trends over time
function generateWordTrends() {
    const wordTrends = {};
    const trendingWords = DEMO_WORDS.slice(0, 20);

    for (const word of trendingWords) {
        const monthly = {};
        const yearly = {};

        for (const year of DEMO_YEARS) {
            yearly[year] = randomInt(30, 150);
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                monthly[monthKey] = randomInt(2, 20);
            }
        }

        wordTrends[word] = { monthly, yearly };
    }

    return wordTrends;
}

// Generate sentiment data
function generateSentiment() {
    const sentiment = {
        overall: {
            positive: randomInt(8000, 12000),
            negative: randomInt(1500, 3000),
            neutral: randomInt(50000, 80000),
            score: randomBetween(0.15, 0.35),
        },
        by_user: {},
        by_month: {},
        by_year: {},
    };

    // Sample positive messages
    const positiveMessages = [
        "That's amazing! I'm so happy for you!",
        "This is the best thing ever! Love it!",
        "You guys are awesome, thanks so much!",
        "Haha this is perfect! Made my day!",
        "Great news everyone! So excited!",
    ];

    // Sample negative messages
    const negativeMessages = [
        "Ugh this is so frustrating, I hate it",
        "Sorry but this is terrible news...",
        "I'm really disappointed about this",
        "This sucks, I'm so annoyed right now",
        "Bad day... feeling stressed and tired",
    ];

    // Per-user sentiment
    for (const user of DEMO_USERS) {
        sentiment.by_user[user] = {
            positive: randomInt(1500, 3000),
            negative: randomInt(200, 600),
            neutral: randomInt(8000, 15000),
            score: randomBetween(0.1, 0.4),
            samples: {
                positive: positiveMessages.map((content, i) => ({
                    content,
                    timestamp_ms: Date.now() - randomInt(1000000, 100000000),
                    score: randomInt(2, 5),
                    positiveCount: randomInt(2, 5),
                    negativeCount: 0,
                })),
                negative: negativeMessages.map((content, i) => ({
                    content,
                    timestamp_ms: Date.now() - randomInt(1000000, 100000000),
                    score: -randomInt(2, 4),
                    positiveCount: 0,
                    negativeCount: randomInt(2, 4),
                })),
            },
        };
    }

    // Per-month sentiment
    for (const year of DEMO_YEARS) {
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            sentiment.by_month[monthKey] = {
                positive: randomInt(80, 200),
                negative: randomInt(15, 50),
                neutral: randomInt(500, 1000),
                score: randomBetween(0.1, 0.45),
            };
        }
    }

    // Per-year sentiment
    for (const year of DEMO_YEARS) {
        sentiment.by_year[year] = {
            positive: randomInt(1000, 2000),
            negative: randomInt(200, 500),
            neutral: randomInt(6000, 12000),
            score: randomBetween(0.12, 0.38),
        };
    }

    return sentiment;
}

// Generate top words for compatibility
function generateTopWords() {
    return DEMO_WORDS.slice(0, 50).map(word => ({
        word,
        count: randomInt(100, 600),
    })).sort((a, b) => b.count - a.count);
}

// Additional messages for full exploration (with sentiment variety)
const EXPLORATION_MESSAGES = [
    { content: "Hey everyone! Just got back from an amazing trip, can't wait to share the photos", sentiment: 2 },
    { content: "Did you see that game last night? That was absolutely incredible", sentiment: 2 },
    { content: "I'm so happy right now, this is the best day ever!", sentiment: 3 },
    { content: "Ugh, traffic was terrible today. Took me 2 hours to get home", sentiment: -2 },
    { content: "Thanks for helping me out yesterday, really appreciate it!", sentiment: 2 },
    { content: "This is so frustrating, nothing is working properly", sentiment: -2 },
    { content: "LOL that meme is hilarious, I can't stop laughing", sentiment: 2 },
    { content: "Good morning everyone! Hope you all have a great day", sentiment: 1 },
    { content: "Miss you guys so much, we should plan something soon", sentiment: 1 },
    { content: "Just finished the project, feeling accomplished!", sentiment: 2 },
    { content: "That was so annoying, I wish people would be more considerate", sentiment: -2 },
    { content: "Love this song! It's been stuck in my head all day", sentiment: 2 },
    { content: "Can't believe how expensive everything is getting", sentiment: -1 },
    { content: "Had the best dinner tonight, you have to try this place", sentiment: 2 },
    { content: "Sorry I couldn't make it, was feeling under the weather", sentiment: -1 },
    { content: "This is exactly what I needed to hear today, thank you!", sentiment: 2 },
    { content: "Why does this always happen to me? So unlucky", sentiment: -2 },
    { content: "Planning the next trip already, any suggestions?", sentiment: 1 },
    { content: "That movie was terrible, don't waste your time", sentiment: -2 },
    { content: "Congratulations! So proud of you, you deserve this!", sentiment: 3 },
];

// Generate full message store for exploration
function generateMessageStore() {
    const messageStore = [];
    const wordToMessages = {};
    const userSentimentMessages = {};

    // Initialize user sentiment
    for (const user of DEMO_USERS) {
        userSentimentMessages[user] = { positive: [], negative: [] };
    }

    // Generate ~500 sample messages using both message sets
    const allMessages = [...EXPLORATION_MESSAGES];
    // Add original SAMPLE_MESSAGES as neutral-ish
    for (const content of SAMPLE_MESSAGES) {
        allMessages.push({ content, sentiment: 1 });
    }

    for (let i = 0; i < 500; i++) {
        const user = DEMO_USERS[i % DEMO_USERS.length];
        const msgData = allMessages[i % allMessages.length];
        const content = msgData.content;
        const sentiment = msgData.sentiment;

        const words = content.toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 4);

        const msg = {
            id: i,
            content,
            sender: user,
            timestamp_ms: Date.now() - randomInt(1000000, 500000000),
            sentiment,
            words: words.slice(0, 15),
        };
        messageStore.push(msg);

        // Build word-to-message index
        for (const word of new Set(words)) {
            if (!wordToMessages[word]) wordToMessages[word] = [];
            wordToMessages[word].push(i);
        }

        // Track sentiment messages by user
        if (sentiment > 0) {
            userSentimentMessages[user].positive.push(i);
        } else if (sentiment < 0) {
            userSentimentMessages[user].negative.push(i);
        }
    }

    return { messageStore, wordToMessages, userSentimentMessages };
}

// Build full aggregates object
export function getDemoAggregates() {
    // Reset seed for consistent data
    seed = 42;
    
    // Generate user_monthly first, then derive monthly from it
    // This ensures they're consistent (like real data)
    const userMonthly = generateUserMonthlyData();
    const monthly = deriveMonthlyFromUserMonthly(userMonthly);
    
    const userDisplayNames = {};
    for (const fullName of DEMO_USERS) {
        const parts = fullName.split(' ');
        userDisplayNames[fullName] = `${parts[0]} ${parts[1][0]}.`;
    }
    
    seed = 42;
    const userTotals = generateUserTotals();
    let totalMessages = 0;
    let totalReactions = 0;
    Object.values(userTotals).forEach(data => {
        totalMessages += data.messages;
        totalReactions += data.reactions_received;
    });
    
    seed = 42;

    return {
        schema_version: '2.1',
        monthly,
        user_monthly: userMonthly,
        yearly: generateYearlyData(),
        user_totals: userTotals,
        reaction_network: generateReactionNetwork(),
        reaction_network_yearly: Object.fromEntries(
            DEMO_YEARS.map(year => {
                seed = 42 + year; // Different seed per year for variety
                return [String(year), generateReactionNetwork()];
            })
        ),
        daily: generateDailyData(),
        weekly: generateWeeklyData(),
        yearly_daily: generateYearlyDaily(),
        // Content analysis (v2.1)
        top_words: generateTopWords(),
        top_reacted_messages: generateTopReactedMessages(),
        word_index: generateWordIndex(),
        user_words: generateUserWords(),
        phrases: generatePhrases(),
        unique_words: generateUniqueWords(),
        word_trends: generateWordTrends(),
        sentiment: generateSentiment(),
        // Full message storage (v2.2)
        ...generateMessageStore(),
        global: {
            total_messages: totalMessages,
            total_reactions: totalReactions,
            first_date_ms: new Date(2019, 0, 1).getTime(),
            last_date_ms: new Date(2025, 11, 13).getTime(),
            all_users: DEMO_USERS,
            all_years: DEMO_YEARS,
            user_display_names: userDisplayNames
        }
    };
}

// Build synthetic messages for compatibility
export function getDemoMessages() {
    seed = 42;
    const messages = [];
    const aggregates = getDemoAggregates();
    const userMonthly = aggregates.user_monthly;
    
    for (const [userName, monthlyData] of Object.entries(userMonthly)) {
        for (const [monthKey, data] of Object.entries(monthlyData)) {
            const [year, month] = monthKey.split('-').map(Number);
            const messageCount = Math.min(data.messages || 0, 50);
            
            for (let i = 0; i < messageCount; i++) {
                const day = Math.floor((i / messageCount) * 28) + 1;
                const hour = 12 + Math.floor(seededRandom() * 10);
                const timestamp = new Date(year, month - 1, day, hour).getTime();
                
                messages.push({
                    sender_name: userName,
                    timestamp_ms: timestamp,
                    year: year,
                });
            }
        }
    }
    
    messages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    return messages;
}

// Demo conversation metadata
export const DEMO_CONVERSATION = {
    id: 'demo_los_pollos_hermanos',
    title: 'Los Pollos Hermanos',
    participants: DEMO_USERS,
    messageCount: 18500,
    estimatedMessages: 18500,
    isDemo: true
};

export default { getDemoAggregates, getDemoMessages, DEMO_CONVERSATION };
