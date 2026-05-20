import React, { useState, useMemo } from 'react';
import { STYLES, COLORS, CHART, formatName } from '../../../design';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';

/**
 * Sentiment Analysis Section
 * Shows positive/negative sentiment patterns with clickable user details
 * Design: Clean visual sentiment indicators with sample messages
 */
export default function SentimentSection({
    sentiment,
    selectedUsers = [],
    selectedYears = [],
    userSentimentMessages = {},
    messageStore = [],
    onJumpToMessage = () => { }
}) {
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showAllPositive, setShowAllPositive] = useState(false);
    const [showAllNegative, setShowAllNegative] = useState(false);

    if (!sentiment) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="mb-8">
                    <h3 className={STYLES.sectionTitle}>Sentiment</h3>
                    <p className={STYLES.sectionSubtitle}>Positive and negative message patterns</p>
                </div>
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>No sentiment data available</p>
                </div>
            </section>
        );
    }

    const { overall, by_user = {}, by_month = {}, by_year = {} } = sentiment;

    const filteredUsers = Object.entries(by_user).filter(
        ([user]) => selectedUsers.length === 0 || selectedUsers.includes(user)
    );

    const userChartData = filteredUsers
        .map(([user, data]) => ({
            name: formatName(user),
            fullName: user,
            positive: data.positive,
            negative: data.negative,
            score: data.score,
        }))
        .sort((a, b) => b.score - a.score);

    const monthlyChartData = useMemo(() => {
        return Object.entries(by_month)
            .filter(([monthKey]) => {
                const year = parseInt(monthKey.split('-')[0]);
                return selectedYears.length === 0 || selectedYears.includes(year);
            })
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
                month: month.slice(2),
                score: Math.round(data.score * 100),
                positive: data.positive,
                negative: data.negative,
            }));
    }, [by_month, selectedYears]);

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'users', label: 'By Person' },
        { id: 'trends', label: 'Over Time' },
    ];

    const positiveRatio = overall?.positive / (overall?.positive + overall?.negative + 1) * 100;
    const negativeRatio = overall?.negative / (overall?.positive + overall?.negative + 1) * 100;

    // User detail view
    const selectedUserData = selectedUser ? by_user[selectedUser] : null;

    // Get ALL positive/negative messages for selected user from message store, filtered by year
    const userMessages = useMemo(() => {
        if (!selectedUser || !userSentimentMessages[selectedUser]) {
            return { positive: [], negative: [] };
        }
        const userData = userSentimentMessages[selectedUser];
        const yearsSet = new Set(selectedYears);

        // Filter by year helper
        const filterByYear = (msg) => {
            if (!msg) return false;
            if (selectedYears.length === 0) return true;
            if (!msg.timestamp_ms) return true;
            const msgYear = new Date(msg.timestamp_ms).getFullYear();
            return yearsSet.has(msgYear);
        };

        // Get messages from store, filter by year, sort by sentiment score
        const positiveMessages = (userData.positive || [])
            .map(msgId => messageStore[msgId])
            .filter(filterByYear)
            .sort((a, b) => (b?.sentiment || 0) - (a?.sentiment || 0));

        const negativeMessages = (userData.negative || [])
            .map(msgId => messageStore[msgId])
            .filter(filterByYear)
            .sort((a, b) => (a?.sentiment || 0) - (b?.sentiment || 0));

        return { positive: positiveMessages, negative: negativeMessages };
    }, [selectedUser, userSentimentMessages, messageStore, selectedYears]);

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Reset show all when user changes
    React.useEffect(() => {
        setShowAllPositive(false);
        setShowAllNegative(false);
    }, [selectedUser]);

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Sentiment</h3>
                <p className={STYLES.sectionSubtitle}>Positive and negative message patterns</p>
            </div>

            {/* How It Works */}
            <div className="mb-8 p-4 bg-neutral-50 border-l-2 border-accent">
                <p className={`${STYLES.dataLabel} mb-2`}>How Sentiment Analysis Works</p>
                <p className="font-display text-[14px] text-neutral-600 leading-relaxed">
                    We scan each message for positive words (love, great, amazing, happy, thanks, haha, lol...)
                    and negative words (hate, bad, sad, angry, sorry, frustrated...). The positivity score
                    is calculated as (positive - negative) / total messages. Higher scores indicate more
                    positive language patterns.
                </p>
            </div>

            {/* User Detail Modal */}
            {selectedUser && selectedUserData && (
                <div className="mb-12 bg-white border border-neutral-200 p-6 lg:p-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-neutral-100">
                        <div className="flex items-center gap-6">
                            <div
                                className="w-14 h-14 flex items-center justify-center text-white font-mono font-bold text-xl"
                                style={{ backgroundColor: COLORS.accent }}
                            >
                                {formatName(selectedUser, true)}
                            </div>
                            <div>
                                <h4 className={STYLES.userName}>{formatName(selectedUser)}</h4>
                                <p className="font-mono text-[11px] text-neutral-400 uppercase tracking-widest mt-1">
                                    {((selectedUserData.score || 0) * 100).toFixed(0)}% positivity score
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="p-3 text-neutral-400 hover:text-neutral-900 transition-colors bg-neutral-50 rounded-full"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-6 mb-10">
                        <div className="p-4 bg-emerald-50 border border-emerald-100">
                            <p className={STYLES.dataLabel}>Positive</p>
                            <p className="font-display text-3xl font-semibold mt-1" style={{ color: COLORS.positive }}>
                                {selectedUserData.positive?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="p-4 bg-red-50 border border-red-100">
                            <p className={STYLES.dataLabel}>Negative</p>
                            <p className="font-display text-3xl font-semibold mt-1" style={{ color: COLORS.negative }}>
                                {selectedUserData.negative?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="p-4 bg-neutral-50 border border-neutral-100">
                            <p className={STYLES.dataLabel}>Neutral</p>
                            <p className="font-display text-3xl font-semibold mt-1 text-neutral-500">
                                {selectedUserData.neutral?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>

                    {/* All Messages - from full message store */}
                    <div className="grid lg:grid-cols-2 gap-10">
                        {/* Positive Messages */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h5 className={`${STYLES.dataLabel}`} style={{ color: COLORS.positive }}>
                                    Positive Messages ({userMessages.positive.length})
                                </h5>
                            </div>
                            {userMessages.positive.length > 0 ? (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {userMessages.positive
                                        .slice(0, showAllPositive ? undefined : 10)
                                        .map((msg, idx) => (
                                            <button
                                                key={msg.id || idx}
                                                onClick={() => onJumpToMessage(msg.id)}
                                                className="w-full text-left p-4 bg-emerald-50/50 border-l-2 border-emerald-400 hover:bg-emerald-50 transition-all group relative"
                                            >
                                                <p className="font-display text-[14px] text-neutral-800 leading-relaxed mb-2">
                                                    "{msg.content}"
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    {msg.timestamp_ms && (
                                                        <p className="font-mono text-[10px] text-neutral-400">
                                                            {formatDate(msg.timestamp_ms)}
                                                        </p>
                                                    )}
                                                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-600 opacity-0 group-hover:opacity-100 transition-all">
                                                        View in Chat →
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    {userMessages.positive.length > 10 && !showAllPositive && (
                                        <button
                                            onClick={() => setShowAllPositive(true)}
                                            className="w-full py-4 bg-neutral-50 border border-dashed border-neutral-200 font-mono text-[11px] text-accent hover:bg-neutral-100 transition-colors uppercase tracking-widest mt-2"
                                        >
                                            Show all {userMessages.positive.length} messages
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="font-mono text-[11px] text-neutral-400 italic">No positive messages found</p>
                            )}
                        </div>

                        {/* Negative Messages */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h5 className={`${STYLES.dataLabel}`} style={{ color: COLORS.negative }}>
                                    Negative Messages ({userMessages.negative.length})
                                </h5>
                            </div>
                            {userMessages.negative.length > 0 ? (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {userMessages.negative
                                        .slice(0, showAllNegative ? undefined : 10)
                                        .map((msg, idx) => (
                                            <button
                                                key={msg.id || idx}
                                                onClick={() => onJumpToMessage(msg.id)}
                                                className="w-full text-left p-4 bg-red-50/50 border-l-2 border-red-400 hover:bg-red-50 transition-all group relative"
                                            >
                                                <p className="font-display text-[14px] text-neutral-800 leading-relaxed mb-2">
                                                    "{msg.content}"
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    {msg.timestamp_ms && (
                                                        <p className="font-mono text-[10px] text-neutral-400">
                                                            {formatDate(msg.timestamp_ms)}
                                                        </p>
                                                    )}
                                                    <span className="font-mono text-[9px] uppercase tracking-wider text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                                                        View in Chat →
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    {userMessages.negative.length > 10 && !showAllNegative && (
                                        <button
                                            onClick={() => setShowAllNegative(true)}
                                            className="w-full py-4 bg-neutral-50 border border-dashed border-neutral-200 font-mono text-[11px] text-accent hover:bg-neutral-100 transition-colors uppercase tracking-widest mt-2"
                                        >
                                            Show all {userMessages.negative.length} messages
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="font-mono text-[11px] text-neutral-400 italic">No negative messages found</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex mb-8">
                {tabs.map(({ id, label }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`${STYLES.modeButton} ${activeTab === id ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Main Stats */}
                    <div className="grid grid-cols-3 gap-6 lg:gap-8 text-center pt-4">
                        <div className="bg-neutral-50 p-6">
                            <p className={STYLES.dataLabel}>Positive Words</p>
                            <p className="font-display text-3xl lg:text-5xl font-semibold tabular-nums mt-2" style={{ color: COLORS.positive }}>
                                {overall?.positive?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="bg-neutral-50 p-6">
                            <p className={STYLES.dataLabel}>Negative Words</p>
                            <p className="font-display text-3xl lg:text-5xl font-semibold tabular-nums mt-2" style={{ color: COLORS.negative }}>
                                {overall?.negative?.toLocaleString() || 0}
                            </p>
                        </div>
                        <div className="bg-neutral-900 text-white p-6">
                            <p className={`${STYLES.dataLabel} text-neutral-400`}>Positivity Score</p>
                            <p className={`font-display text-3xl lg:text-5xl font-semibold tabular-nums mt-2 ${(overall?.score || 0) >= 0 ? 'text-accent' : 'text-red-400'
                                }`}>
                                {((overall?.score || 0) * 100).toFixed(0)}%
                            </p>
                        </div>
                    </div>

                    {/* Ratio Bar */}
                    <div className="pt-4">
                        <p className={`${STYLES.dataLabel} mb-4 uppercase tracking-[0.2em]`}>Sentiment ratio</p>
                        <div className="h-12 flex overflow-hidden">
                            <div
                                className="h-full transition-all duration-700 flex items-center justify-center relative group"
                                style={{ width: `${positiveRatio}%`, backgroundColor: COLORS.positive }}
                            >
                                {positiveRatio > 10 && (
                                    <span className="font-mono text-[12px] font-bold text-white">
                                        {positiveRatio.toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <div
                                className="h-full transition-all duration-700 flex items-center justify-center relative"
                                style={{ width: `${negativeRatio}%`, backgroundColor: COLORS.negative }}
                            >
                                {negativeRatio > 10 && (
                                    <span className="font-mono text-[12px] font-bold text-white">
                                        {negativeRatio.toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <div className="h-full flex-1 bg-neutral-100 flex items-center justify-center">
                                <span className="font-mono text-[12px] text-neutral-400 uppercase tracking-widest">Neutral</span>
                            </div>
                        </div>
                        <div className="flex justify-between mt-3 px-1">
                            <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.positive }}>POSITIVE LANGUAGE</span>
                            <span className="font-mono text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.negative }}>NEGATIVE LANGUAGE</span>
                        </div>
                    </div>

                    {/* Insight */}
                    <div className="p-8 bg-neutral-50 border-2 border-neutral-100">
                        <p className="font-display text-xl text-neutral-900 leading-relaxed italic">
                            "{(overall?.score || 0) > 0.2
                                ? 'Your conversation is predominantly positive! The language patterns reflect a supportive and energetic tone.'
                                : (overall?.score || 0) > 0
                                    ? 'Your conversation has a constructive and generally positive tone.'
                                    : (overall?.score || 0) > -0.2
                                        ? 'Your conversation maintains a balanced, neutral tone between participants.'
                                        : 'Your conversation tends to feature more negative or critical language patterns.'}"
                        </p>
                    </div>
                </div>
            )}

            {/* By User Tab */}
            {activeTab === 'users' && (
                <div className="space-y-8">
                    {/* Instructions */}
                    <p className="font-mono text-[11px] text-neutral-400 uppercase tracking-widest text-center">
                        Click on a person to explore their specific language patterns
                    </p>

                    {/* User Chart */}
                    <div className="h-80 bg-neutral-50/50 p-6 border border-neutral-100">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={userChartData} layout="vertical" barCategoryGap={10}>
                                <XAxis type="number" {...CHART.axis} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={120}
                                    tick={{ ...CHART.axis.tick, fontSize: 12, fontWeight: 500 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={CHART.tooltip} />
                                <Bar dataKey="positive" stackId="a" fill={COLORS.positive} name="Positive" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="negative" stackId="a" fill={COLORS.negative} name="Negative" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* User Cards - Clickable */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredUsers
                            .sort((a, b) => b[1].score - a[1].score)
                            .map(([user, data], idx) => {
                                const score = (data.score * 100).toFixed(0);
                                const isSelected = selectedUser === user;
                                return (
                                    <button
                                        key={user}
                                        onClick={() => setSelectedUser(isSelected ? null : user)}
                                        className={`group relative text-left p-5 transition-all duration-300 ${isSelected
                                                ? 'bg-neutral-900 border-neutral-900 shadow-xl scale-[1.02] z-10'
                                                : 'bg-white border-2 border-neutral-100 hover:border-accent hover:shadow-lg'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 flex items-center justify-center transition-colors ${isSelected ? 'bg-accent' : 'bg-neutral-900 group-hover:bg-accent'
                                                }`}>
                                                <span className="font-mono text-[14px] font-bold text-white">
                                                    {formatName(user, true)}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`${STYLES.userNameSmall} ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                                                    {formatName(user)}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <div className={`w-20 h-1.5 rounded-full relative ${isSelected ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
                                                        <div
                                                            className="h-full absolute left-1/2 rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${Math.abs(data.score) * 50}%`,
                                                                transform: data.score >= 0 ? 'none' : 'translateX(-100%)',
                                                                backgroundColor: data.score >= 0 ? COLORS.positive : COLORS.negative,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={`font-mono text-[12px] font-bold ${data.score >= 0 ? (isSelected ? 'text-emerald-400' : 'text-emerald-600') : (isSelected ? 'text-red-400' : 'text-red-600')
                                                        }`}>
                                                        {score}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Interaction Indicator */}
                                        <div className={`absolute top-2 right-2 transition-all ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Over Time Tab */}
            {activeTab === 'trends' && monthlyChartData.length > 0 && (
                <div className="space-y-8">
                    {/* Trend Chart */}
                    <div className="h-80 bg-white p-6 border-b-2 border-neutral-100">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="sentimentGradient3" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="month"
                                    {...CHART.axis}
                                    tick={{ ...CHART.axis.tick, fontSize: 11 }}
                                    interval="preserveStartEnd"
                                    axisLine={false}
                                />
                                <YAxis
                                    {...CHART.axis}
                                    tick={{ ...CHART.axis.tick, fontSize: 11 }}
                                    domain={[-100, 100]}
                                    tickFormatter={(v) => `${v}%`}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ stroke: COLORS.accent, strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{ ...CHART.tooltip, borderRadius: 0, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    formatter={(value) => [`${value}%`, 'Score']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="score"
                                    stroke={COLORS.accent}
                                    strokeWidth={3}
                                    fill="url(#sentimentGradient3)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-6 pt-4">
                        <div className="text-center">
                            <p className={`${STYLES.dataLabel} mb-2`}>Highest Month</p>
                            {monthlyChartData.length > 0 && (
                                <p className="font-display text-2xl font-bold text-emerald-600">
                                    {monthlyChartData.reduce((max, d) => d.score > max.score ? d : max, monthlyChartData[0]).month}
                                </p>
                            )}
                        </div>
                        <div className="text-center">
                            <p className={`${STYLES.dataLabel} mb-2`}>Lowest Month</p>
                            {monthlyChartData.length > 0 && (
                                <p className="font-display text-2xl font-bold text-red-600">
                                    {monthlyChartData.reduce((min, d) => d.score < min.score ? d : min, monthlyChartData[0]).month}
                                </p>
                            )}
                        </div>
                        <div className="text-center">
                            <p className={`${STYLES.dataLabel} mb-2`}>Average</p>
                            <p className="font-display text-2xl font-bold text-neutral-900">
                                {(monthlyChartData.reduce((sum, d) => sum + d.score, 0) / monthlyChartData.length).toFixed(0)}%
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
