import React from 'react';
import {
    HeroStat,
    StatGrid,
    MiniChart,
    EmojiRow,
    ConnectionList,
    ShareCard,
    StoryPanel,
} from '../components/ui';

/**
 * Build stories array for a user's wrapped experience
 * Focuses on reactions, relationships, and activity patterns.
 * 
 * @param {Object} params
 * @param {string} params.selectedUser - Selected user name
 * @param {number} params.selectedYear - Selected year
 * @param {Object} params.yearData - Processed year data
 * @param {string[]} params.users - All users for the year
 * @param {string} params.groupTitle - Title of the group/conversation
 * @param {function} params.onRestart - Callback to restart wrapped
 * @returns {Array} Array of story objects with id, type, and render function
 */
export function buildStories({ selectedUser, selectedYear, yearData, users, groupTitle, onRestart }) {
    if (!selectedUser || !yearData) return [];
    
    const userStats = yearData.patterns.userDetailedStats[selectedUser];
    if (!userStats) {
        console.warn('No user stats found for', selectedUser);
        return [];
    }
    
    const totalMessages = yearData.stats.total_messages;
    const rank = users.indexOf(selectedUser) + 1;
    const percentile = Math.round((1 - (rank - 1) / users.length) * 100);

    // Message stats
    const msgCount = userStats.messages;
    const msgPercentage = ((msgCount / totalMessages) * 100).toFixed(1);
    const avgMessages = Math.round(totalMessages / users.length);
    const compareToAvg = msgCount > avgMessages ? 'more' : 'fewer';
    const compareFactor = msgCount > avgMessages 
        ? (msgCount / avgMessages).toFixed(1) 
        : (avgMessages / msgCount).toFixed(1);

    // Monthly activity
    const monthlyActivity = userStats.monthly_activity || {};
    const busiestMonthEntry = Object.entries(monthlyActivity).sort((a, b) => b[1] - a[1])[0];
    const busiestMonth = busiestMonthEntry ? busiestMonthEntry[0] : 'N/A';
    const busiestMonthCount = busiestMonthEntry ? busiestMonthEntry[1] : 0;
    const monthlyChartData = Object.entries(monthlyActivity).map(([month, count]) => ({ 
        month: month.substring(0, 3), 
        count 
    }));

    // Day of week activity
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeekData = userStats.day_of_week || Array(7).fill(0);
    const busiestDayIndex = dayOfWeekData.indexOf(Math.max(...dayOfWeekData));
    const busiestDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][busiestDayIndex];
    const weeklyChartData = dayOfWeekData.map((count, index) => ({ 
        day: daysOfWeek[index], 
        count 
    }));

    // Hourly activity
    const hourly = userStats.hourly || Array(24).fill(0);
    const peakHourIndex = hourly.indexOf(Math.max(...hourly));
    const peakHourCount = hourly[peakHourIndex];
    const hourlyChartData = hourly.map((count, hour) => ({ 
        hour: `${hour}h`, 
        count 
    }));
    
    // Night owl / early bird classification
    const nightHours = hourly.slice(22, 24).reduce((a, b) => a + b, 0) + hourly.slice(0, 6).reduce((a, b) => a + b, 0);
    const dayHours = hourly.slice(6, 22).reduce((a, b) => a + b, 0);
    const isNightOwl = nightHours > dayHours * 0.3;
    const chronotype = isNightOwl ? 'Night Owl' : 'Early Bird';

    // Reactions
    const totalReactionsReceived = userStats.reactions_received || 0;
    const totalReactionsGiven = userStats.reactions_given || 0;
    const reactionEfficiency = userStats.efficiency || 0;
    
    const allEfficiency = yearData.patterns.reactionEfficiency || [];
    const efficiencyRank = allEfficiency.findIndex(e => e.name === selectedUser) + 1;
    const avgEfficiency = allEfficiency.length > 0 
        ? (allEfficiency.reduce((sum, e) => sum + e.efficiency, 0) / allEfficiency.length) 
        : 0;

    // Top fan (who reacted to you most)
    const reactionsReceived = userStats.reactions_details?.received || {};
    const topReactors = Object.entries(reactionsReceived)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    const topFan = topReactors[0]?.name || 'No one';
    const topFanCount = topReactors[0]?.count || 0;
    const topFanShare = totalReactionsReceived > 0 
        ? Math.round((topFanCount / totalReactionsReceived) * 100) 
        : 0;

    // Who you reacted to most
    const reactionsGiven = userStats.reactions_details?.given || {};
    const topReactedTo = Object.entries(reactionsGiven)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    const topLove = topReactedTo[0]?.name || 'No one';
    const topLoveCount = topReactedTo[0]?.count || 0;
    const topLoveShare = totalReactionsGiven > 0 
        ? Math.round((topLoveCount / totalReactionsGiven) * 100) 
        : 0;

    // Top emojis used as reactions
    const topGivenReactions = Object.entries(userStats.reaction_counts?.given || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emoji, count]) => ({ emoji, count }));

    // Initiator stats
    const initiatorCount = userStats.initiator_count || 0;
    const allInitiators = yearData.patterns.initiators || [];
    const initiatorRank = allInitiators.findIndex(i => i.name === selectedUser) + 1;

    // Streak stats
    const allStreaks = yearData.patterns.streaks || [];
    const userStreakData = allStreaks.find(s => s.name === selectedUser);
    const userStreak = userStreakData ? userStreakData.days : 0;
    const streakRank = allStreaks.findIndex(s => s.name === selectedUser) + 1;

    // Media stats
    const userMedia = userStats.media || { photos: 0, videos: 0, audio: 0 };
    const totalUserMedia = userMedia.photos + userMedia.videos + userMedia.audio;
    const allMediaData = yearData.patterns.mediaSpam || [];
    const mediaRank = allMediaData.findIndex(m => m.name === selectedUser) + 1;

    // Days active
    const daysActive = Object.keys(userStats.daily_activity || {}).length || 
        Math.round(Object.values(monthlyActivity).reduce((a, b) => a + b, 0) / 30);

    // Rank description based on position
    const getRankDescription = () => {
        if (rank === 1) return "You're the champion! 🏆";
        if (rank === 2) return "Almost at the top!";
        if (rank === 3) return "On the podium!";
        if (rank <= 5) return `Top ${rank} contributor`;
        if (percentile >= 90) return "In the top 10%";
        if (percentile >= 75) return "Above average";
        return `#${rank} out of ${users.length}`;
    };

    // Build story panels array
    return [
        // ACT 1: Opening
        {
            id: 'title',
            type: 'title',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-body wrapped-animate-fade wrapped-delay-1 mb-4" style={{ color: 'var(--wrapped-muted)' }}>
                        Your {selectedYear} in
                    </div>
                    <div className="wrapped-large-stat wrapped-animate-scale wrapped-delay-2 wrapped-accent-text">
                        {groupTitle || 'this chat'}
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-10 text-center">
                        Let's dive in{selectedUser.split(' ')[0] ? ` ${selectedUser.split(' ')[0]}` : ''}
                    </div>
                </StoryPanel>
            )
        },
        // First insight: Your messages
        {
            id: 'message-hero',
            type: 'hero',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-4">You Sent</div>
                    <HeroStat value={msgCount} />
                    <div className="wrapped-label wrapped-animate-up wrapped-delay-2 mt-4">Messages</div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-6 text-center max-w-sm">
                        That's <span className="wrapped-accent-text font-semibold">{msgPercentage}%</span> of all conversations
                    </div>
                </StoryPanel>
            )
        },
        // Then: Group context
        {
            id: 'group-context',
            type: 'context',
            render: () => (
                <StoryPanel layout="center">
                    <div className="text-center space-y-6">
                        <div className="wrapped-body wrapped-animate-fade text-xl">
                            Together, everyone shared
                        </div>
                        <HeroStat value={totalMessages} label="" delay={1} />
                        <div className="wrapped-label wrapped-animate-up wrapped-delay-2 mt-4">
                            messages
                        </div>
                        <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-4">
                            across <span className="wrapped-accent-text font-semibold">{users.length}</span> people
                        </div>
                    </div>
                </StoryPanel>
            )
        },
        {
            id: 'rank-reveal',
            type: 'rank',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Your Rank</div>
                    <div className="wrapped-hero-stat wrapped-animate-scale wrapped-delay-1 wrapped-accent-text">
                        #{rank}
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-2 mt-6 text-center">
                        out of {users.length} members
                    </div>
                    <div className="wrapped-animate-up wrapped-delay-3 mt-8">
                        <div className="wrapped-rank-badge">
                            {getRankDescription()}
                        </div>
                    </div>
                </StoryPanel>
            )
        },

        // ACT 3: Temporal Patterns
        {
            id: 'monthly-trend',
            type: 'chart',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-2">Monthly Activity</div>
                    <div className="wrapped-medium-stat wrapped-animate-up wrapped-delay-1 mb-6">
                        Peak: <span className="wrapped-accent-text">{busiestMonth}</span>
                    </div>
                    {monthlyChartData.length > 0 && (
                        <div className="w-full max-w-lg">
                            <MiniChart 
                                data={monthlyChartData} 
                                dataKey="count" 
                                xAxisKey="month" 
                                type="area"
                                delay={2}
                            />
                        </div>
                    )}
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-4">
                        You sent <span className="wrapped-accent-text font-semibold">{busiestMonthCount.toLocaleString()}</span> messages in {busiestMonth}
                    </div>
                </StoryPanel>
            )
        },
        {
            id: 'peak-day',
            type: 'stat',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Your Day</div>
                    <div className="wrapped-hero-stat wrapped-animate-scale wrapped-delay-1">
                        {busiestDay.slice(0, 3)}
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-2 mt-4">
                        Your most active day
                    </div>
                    <MiniChart 
                        data={weeklyChartData} 
                        dataKey="count" 
                        xAxisKey="day" 
                        type="bar"
                        delay={3}
                    />
                </StoryPanel>
            )
        },
        {
            id: 'peak-hour',
            type: 'stat',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Peak Hour</div>
                    <div className="wrapped-time-display wrapped-animate-scale wrapped-delay-1">
                        {peakHourIndex.toString().padStart(2, '0')}:00
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-2 mt-4 text-center">
                        <span className="wrapped-accent-text font-semibold">{peakHourCount}</span> messages at this hour
                    </div>
                </StoryPanel>
            )
        },
        {
            id: 'chronotype',
            type: 'classification',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">You're a</div>
                    <div className="wrapped-large-stat wrapped-animate-scale wrapped-delay-1">
                        {chronotype}
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-2 mt-6 mb-8" style={{ color: 'var(--wrapped-muted)' }}>
                        {isNightOwl ? 'Most active after dark' : 'Most active during the day'}
                    </div>
                    <MiniChart 
                        data={hourlyChartData.filter((_, i) => i % 2 === 0)} 
                        dataKey="count" 
                        xAxisKey="hour" 
                        type="area"
                        delay={3}
                    />
                </StoryPanel>
            )
        },

        // ACT 4: Reactions Economy
        {
            id: 'reactions-received',
            type: 'stat',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">People Loved Your Messages</div>
                    <HeroStat value={totalReactionsReceived} />
                    <div className="wrapped-label wrapped-animate-up wrapped-delay-2 mt-4">reactions received</div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-6 text-center max-w-sm">
                        That's about <span className="wrapped-accent-text font-semibold">{reactionEfficiency.toFixed(1)}</span> reactions for every message you sent
                    </div>
                </StoryPanel>
            )
        },
        {
            id: 'top-fan',
            type: 'person',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Your Biggest Fan</div>
                    <div className="wrapped-large-stat wrapped-animate-scale wrapped-delay-1">
                        {topFan.split(' ')[0]}
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-2 mt-6 text-center max-w-sm">
                        reacted to you <span className="wrapped-accent-text font-semibold">{topFanCount}</span> times
                    </div>
                    <div className="wrapped-percentage wrapped-animate-up wrapped-delay-3 mt-6">
                        <div className="wrapped-percentage-value">{topFanShare}%</div>
                        <div className="wrapped-label">of all your reactions</div>
                    </div>
                </StoryPanel>
            )
        },
        {
            id: 'you-loved',
            type: 'person',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Your Favorite Person</div>
                    <div className="wrapped-large-stat wrapped-animate-scale wrapped-delay-1">
                        {topLove.split(' ')[0]}
                    </div>
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-2 mt-6 text-center max-w-sm">
                        You reacted to them <span className="wrapped-accent-text font-semibold">{topLoveCount}</span> times
                    </div>
                    <div className="wrapped-percentage wrapped-animate-up wrapped-delay-3 mt-6">
                        <div className="wrapped-percentage-value">{topLoveShare}%</div>
                        <div className="wrapped-label">of reactions you gave</div>
                    </div>
                </StoryPanel>
            )
        },
        {
            id: 'emoji-palette',
            type: 'emojis',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Your Reaction Style</div>
                    <EmojiRow 
                        emojis={topGivenReactions.length > 0 ? topGivenReactions : [{ emoji: '❤️', count: 0 }]} 
                        delay={1} 
                    />
                    <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-6 text-center">
                        Your go-to reactions
                    </div>
                </StoryPanel>
            )
        },

        // ACT 5: Social Graph - Combined connections view
        {
            id: 'connections',
            type: 'list',
            render: () => {
                // Build combined connections data
                const connections = [];
                const seen = new Set();
                
                // Add people who reacted to you
                topReactors.slice(0, 3).forEach(r => {
                    const firstName = r.name.split(' ')[0];
                    if (!seen.has(firstName)) {
                        const youGave = reactionsGiven[r.name] || 0;
                        connections.push({
                            name: firstName,
                            theyGave: r.count,
                            youGave
                        });
                        seen.add(firstName);
                    }
                });
                
                // Add people you reacted to (if not already included)
                topReactedTo.slice(0, 3).forEach(r => {
                    const firstName = r.name.split(' ')[0];
                    if (!seen.has(firstName) && connections.length < 3) {
                        const theyGave = reactionsReceived[r.name] || 0;
                        connections.push({
                            name: firstName,
                            theyGave,
                            youGave: r.count
                        });
                        seen.add(firstName);
                    }
                });

                return (
                    <StoryPanel layout="center">
                        <div className="wrapped-label wrapped-animate-fade mb-6">Your Inner Circle</div>
                        <div className="wrapped-connections-table wrapped-animate-up wrapped-delay-1">
                            <div className="wrapped-connections-header">
                                <span></span>
                                <span className="wrapped-label">Gave You</span>
                                <span className="wrapped-label">You Gave</span>
                            </div>
                            {connections.map((conn, i) => (
                                <div key={i} className="wrapped-connections-row">
                                    <span className="wrapped-connection-name">{conn.name}</span>
                                    <span className="wrapped-connection-count">{conn.theyGave}</span>
                                    <span className="wrapped-connection-count wrapped-accent-text">{conn.youGave}</span>
                                </div>
                            ))}
                        </div>
                        <div className="wrapped-body wrapped-animate-up wrapped-delay-3 mt-6 text-center">
                            Reactions exchanged with your closest connections
                        </div>
                    </StoryPanel>
                );
            }
        },
        {
            id: 'initiator',
            type: 'stat',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Conversation Starter</div>
                    <HeroStat value={initiatorCount} label="times you broke the silence" />
                    {initiatorRank > 0 && initiatorRank <= 10 && (
                        <div className="wrapped-animate-up wrapped-delay-3 mt-6">
                            <div className="wrapped-rank-badge">#{initiatorRank} Initiator</div>
                        </div>
                    )}
                </StoryPanel>
            )
        },
        {
            id: 'streak',
            type: 'stat',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">Longest Streak</div>
                    <HeroStat value={userStreak} label="days in a row" />
                    {streakRank > 0 && streakRank <= 10 && (
                        <div className="wrapped-animate-up wrapped-delay-3 mt-6">
                            <div className="wrapped-rank-badge">#{streakRank} Streak</div>
                        </div>
                    )}
                </StoryPanel>
            )
        },

        // ACT 6: Media
        {
            id: 'media',
            type: 'stats',
            render: () => (
                <StoryPanel layout="center">
                    <div className="wrapped-label wrapped-animate-fade mb-6">You Shared</div>
                    <div className="wrapped-hero-stat wrapped-animate-scale wrapped-delay-1 wrapped-accent-text">
                        {totalUserMedia}
                    </div>
                    <div className="wrapped-label wrapped-animate-up wrapped-delay-2 mt-4 mb-8">
                        media files
                    </div>
                    <StatGrid 
                        stats={[
                            { value: userMedia.photos, label: 'Photos' },
                            { value: userMedia.videos, label: 'Videos' },
                            { value: userMedia.audio, label: 'Audio' },
                        ]}
                        columns={3}
                        variant="borderless"
                    />
                </StoryPanel>
            )
        },

        // ACT 7: Finale - Share Card with restart
        {
            id: 'share-card',
            type: 'card',
            render: () => (
                <StoryPanel layout="center">
                    <ShareCard 
                        userName={selectedUser}
                        year={selectedYear}
                        stats={[
                            { value: msgCount.toLocaleString(), label: 'Messages' },
                            { value: `#${rank}`, label: 'Rank' },
                            { value: totalReactionsReceived.toLocaleString(), label: 'Reactions' },
                            { value: userStreak, label: 'Streak' },
                            { value: topFan.split(' ')[0], label: '#1 Fan', isName: true },
                            { value: totalUserMedia, label: 'Media' },
                        ]}
                        onRestart={onRestart}
                    />
                </StoryPanel>
            ),
            isLast: true
        }
    ];
}

export default buildStories;
