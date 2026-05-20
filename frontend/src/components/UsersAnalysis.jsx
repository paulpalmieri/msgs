import React, { useMemo, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ChartCard from './ChartCard';
import { UserDossier } from './UserDossier';
import Sparkline from './ui/Sparkline';
import { useSortable, SortableHeader, TableHeader, TableCell, TableRow, TableFooter, TableFooterCell, formatValue } from './ui/DataTable';
import { formatName } from '../utils/formatters';
import { COLORS, STYLES, CHART } from '../design';
import { UserColorBar, RankBadge, SectionHeader } from './ui';

// User colors - use canonical palette from design tokens
const USER_COLORS = COLORS.userPalette;

export default function UsersAnalysis({ data, messages, reactionUsers, networkMatrix, selectedUsers, aggregates }) {
    const { sortColumn, sortDirection, handleSort } = useSortable('messageCount', 'desc');
    const [hoveredUser, setHoveredUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    
    if (!data) return null;

    const {
        streaks,
        mediaSpam,
        initiators,
        userHourlyActivity,
    } = data;

    // Count messages per user - prefer aggregates, fallback to messages
    const messageCounts = useMemo(() => {
        // Use aggregates user_totals if available
        if (aggregates?.user_totals) {
            const counts = {};
            Object.entries(aggregates.user_totals).forEach(([name, data]) => {
                counts[name] = data.messages || 0;
            });
            return counts;
        }
        
        // Fallback to counting from messages
        const counts = {};
        (messages || []).forEach(msg => {
            const sender = msg.sender_name;
            if (sender) {
                counts[sender] = (counts[sender] || 0) + 1;
            }
        });
        return counts;
    }, [aggregates, messages]);

    // Build monthly message counts per user for sparklines and detailed charts - prefer aggregates
    // Returns { arrays: { user: [counts] }, objects: { user: { "2024-01": count } } }
    const userMonthlyMessages = useMemo(() => {
        const arrays = {};
        const objects = {};
        
        // Use aggregates user_monthly if available
        if (aggregates?.user_monthly) {
            Object.entries(aggregates.user_monthly).forEach(([user, months]) => {
                const sortedMonths = Object.keys(months).sort();
                arrays[user] = sortedMonths.map(m => months[m]?.messages || 0);
                objects[user] = {};
                sortedMonths.forEach(m => {
                    objects[user][m] = months[m]?.messages || 0;
                });
            });
            return { arrays, objects };
        }
        
        // Fallback to computing from messages
        const monthly = {};
        (messages || []).forEach(msg => {
            const sender = msg.sender_name;
            if (!sender) return;
            const date = new Date(msg.timestamp_ms);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthly[sender]) monthly[sender] = {};
            monthly[sender][monthKey] = (monthly[sender][monthKey] || 0) + 1;
        });
        
        // Convert to sorted arrays and keep objects
        Object.entries(monthly).forEach(([user, months]) => {
            const sortedMonths = Object.keys(months).sort();
            arrays[user] = sortedMonths.map(m => months[m]);
            objects[user] = months;
        });
        return { arrays, objects };
    }, [aggregates, messages]);

    // Build yearly data per user for trend charts (messages, reactions, engagement) - prefer aggregates
    const userYearlyData = useMemo(() => {
        // Use aggregates user_monthly if available
        if (aggregates?.user_monthly) {
            const yearly = {};
            
            Object.entries(aggregates.user_monthly).forEach(([user, months]) => {
                if (!yearly[user]) yearly[user] = {};
                
                Object.entries(months).forEach(([monthKey, monthData]) => {
                    const year = parseInt(monthKey.split('-')[0]);
                    if (!yearly[user][year]) {
                        yearly[user][year] = { messages: 0, reactionsReceived: 0, reactionsGiven: 0 };
                    }
                    yearly[user][year].messages += monthData.messages || 0;
                    yearly[user][year].reactionsReceived += monthData.reactions_received || 0;
                    yearly[user][year].reactionsGiven += monthData.reactions_given || 0;
                });
            });
            
            // Convert to sorted array format with engagement calculation
            const result = {};
            Object.entries(yearly).forEach(([user, years]) => {
                const sortedYears = Object.keys(years).sort();
                result[user] = sortedYears.map(year => ({
                    year: parseInt(year),
                    messages: years[year].messages,
                    reactionsReceived: years[year].reactionsReceived,
                    reactionsGiven: years[year].reactionsGiven,
                    engagement: years[year].messages > 0 
                        ? parseFloat((years[year].reactionsReceived / years[year].messages).toFixed(3)) 
                        : 0
                }));
            });
            return result;
        }
        
        // Fallback to computing from messages
        const yearly = {};
        
        // Count messages per year per user
        (messages || []).forEach(msg => {
            const sender = msg.sender_name;
            if (!sender) return;
            const year = new Date(msg.timestamp_ms).getFullYear();
            if (!yearly[sender]) yearly[sender] = {};
            if (!yearly[sender][year]) yearly[sender][year] = { messages: 0, reactionsReceived: 0, reactionsGiven: 0 };
            yearly[sender][year].messages += 1;
            
            // Count reactions received on this message
            if (msg.reactions) {
                msg.reactions.forEach(reaction => {
                    const reactor = reaction.actor;
                    if (!yearly[reactor]) yearly[reactor] = {};
                    if (!yearly[reactor][year]) yearly[reactor][year] = { messages: 0, reactionsReceived: 0, reactionsGiven: 0 };
                    yearly[reactor][year].reactionsGiven += 1;
                });
                yearly[sender][year].reactionsReceived += msg.reactions.length;
            }
        });
        
        // Convert to sorted array format with engagement calculation
        const result = {};
        Object.entries(yearly).forEach(([user, years]) => {
            const sortedYears = Object.keys(years).sort();
            result[user] = sortedYears.map(year => ({
                year: parseInt(year),
                messages: years[year].messages,
                reactionsReceived: years[year].reactionsReceived,
                reactionsGiven: years[year].reactionsGiven,
                engagement: years[year].messages > 0 
                    ? parseFloat((years[year].reactionsReceived / years[year].messages).toFixed(3)) 
                    : 0
            }));
        });
        return result;
    }, [aggregates, messages]);

    // Compute top givers to and receivers from for each user
    const userTopInteractions = useMemo(() => {
        if (!networkMatrix) return {};
        
        const interactions = {};
        
        Object.entries(networkMatrix).forEach(([key, count]) => {
            const [reactor, receiver] = key.split('|');
            
            if (!interactions[reactor]) {
                interactions[reactor] = { givesTo: {}, receivesFrom: {}, totalGiven: 0, totalReceived: 0 };
            }
            interactions[reactor].givesTo[receiver] = (interactions[reactor].givesTo[receiver] || 0) + count;
            interactions[reactor].totalGiven += count;
            
            if (!interactions[receiver]) {
                interactions[receiver] = { givesTo: {}, receivesFrom: {}, totalGiven: 0, totalReceived: 0 };
            }
            interactions[receiver].receivesFrom[reactor] = (interactions[receiver].receivesFrom[reactor] || 0) + count;
            interactions[receiver].totalReceived += count;
        });
        
        const result = {};
        Object.entries(interactions).forEach(([user, data]) => {
            const sortedGivesTo = Object.entries(data.givesTo).sort((a, b) => b[1] - a[1]);
            const topGivesTo = sortedGivesTo.length > 0 ? {
                name: formatName(sortedGivesTo[0][0]),
                percent: data.totalGiven > 0 ? Math.round((sortedGivesTo[0][1] / data.totalGiven) * 100) : 0
            } : null;
            
            const sortedReceivesFrom = Object.entries(data.receivesFrom).sort((a, b) => b[1] - a[1]);
            const topReceivesFrom = sortedReceivesFrom.length > 0 ? {
                name: formatName(sortedReceivesFrom[0][0]),
                percent: data.totalReceived > 0 ? Math.round((sortedReceivesFrom[0][1] / data.totalReceived) * 100) : 0
            } : null;
            
            result[user] = { topGivesTo, topReceivesFrom };
        });
        
        return result;
    }, [networkMatrix]);

    // Combine all data into unified user patterns table
    const userPatternsData = useMemo(() => {
        const userMap = {};
        
        // Add message counts first
        Object.entries(messageCounts).forEach(([name, count]) => {
            if (!userMap[name]) userMap[name] = { name };
            userMap[name].messageCount = count;
        });
        
        // Add streak data
        (streaks || []).forEach(item => {
            if (!userMap[item.name]) userMap[item.name] = { name: item.name };
            userMap[item.name].streak = item.days || 0;
        });
        
        // Add initiator data
        (initiators || []).forEach(item => {
            if (!userMap[item.name]) userMap[item.name] = { name: item.name };
            userMap[item.name].initiations = item.count || 0;
        });
        
        // Add media data
        (mediaSpam || []).forEach(item => {
            if (!userMap[item.name]) userMap[item.name] = { name: item.name };
            userMap[item.name].photos = item.photos || 0;
            userMap[item.name].videos = item.videos || 0;
            userMap[item.name].gifs = item.gifs || 0;
            userMap[item.name].audio = item.audio || 0;
        });

        // Add reaction data from reactionUsers prop
        if (reactionUsers) {
            Object.entries(reactionUsers).forEach(([name, stats]) => {
                if (!userMap[name]) userMap[name] = { name };
                                userMap[name].reactionsGiven = stats.reactions_given || 0;
                                userMap[name].reactionsReceived = stats.reactions_received || 0;
                                userMap[name].engagement = stats.efficiency || 0;
            });
        }

        // Add hourly activity data
        (userHourlyActivity || []).forEach(item => {
            if (!userMap[item.name]) userMap[item.name] = { name: item.name };
            userMap[item.name].hourlyActivity = item.data || Array(24).fill(0);
        });

        // Add monthly trend data (array for sparklines, object for detailed charts)
        Object.entries(userMonthlyMessages.arrays).forEach(([name, trend]) => {
            if (!userMap[name]) userMap[name] = { name };
            userMap[name].monthlyTrend = trend; // Array for sparklines
            userMap[name].monthlyData = userMonthlyMessages.objects[name]; // Object with keys for charts
        });

        // Add yearly trend data
        Object.entries(userYearlyData).forEach(([name, yearlyTrend]) => {
            if (!userMap[name]) userMap[name] = { name };
            userMap[name].yearlyTrend = yearlyTrend;
        });

        // Add interaction data
        Object.entries(userTopInteractions).forEach(([name, interactions]) => {
            if (!userMap[name]) userMap[name] = { name };
            userMap[name].topGivesTo = interactions.topGivesTo;
            userMap[name].topReceivesFrom = interactions.topReceivesFrom;
        });

        // Add active days from aggregates if available
        if (aggregates?.user_totals) {
            Object.entries(aggregates.user_totals).forEach(([name, data]) => {
                if (!userMap[name]) userMap[name] = { name };
                userMap[name].activeDays = data.active_days || 0;
            });
        }

        // Convert to array, filter by selectedUsers, calculate totals, and sort
        const selectedUsersSet = selectedUsers ? new Set(selectedUsers) : null;
        const users = Object.values(userMap)
            .filter(user => !selectedUsersSet || selectedUsersSet.has(user.name))
            .map(user => {
                const given = user.reactionsGiven || 0;
                const received = user.reactionsReceived || 0;
                const total = given + received;
                const balance = total > 0 ? Math.round(((given - received) / total) * 100) : 0;
                
                return {
                    ...user,
                    shortName: formatName(user.name),
                    messageCount: user.messageCount || 0,
                    streak: user.streak || 0,
                    initiations: user.initiations || 0,
                    photos: user.photos || 0,
                    videos: user.videos || 0,
                    gifs: user.gifs || 0,
                    audio: user.audio || 0,
                    total: (user.photos || 0) + (user.videos || 0) + (user.gifs || 0) + (user.audio || 0),
                    reactionsGiven: given,
                    reactionsReceived: received,
                    engagement: user.engagement || 0,
                    balance,
                    isGiver: balance > 0,
                    hourlyActivity: user.hourlyActivity || Array(24).fill(0),
                    monthlyTrend: user.monthlyTrend || [],
                    yearlyTrend: user.yearlyTrend || [],
                    activeDays: user.activeDays || 0,
                };
            })
            .sort((a, b) => b.messageCount - a.messageCount);
        
        // Assign colors
        return users.map((user, index) => ({
            ...user,
            color: USER_COLORS[index % USER_COLORS.length]
        }));
    }, [streaks, initiators, mediaSpam, messageCounts, reactionUsers, userHourlyActivity, userMonthlyMessages, userYearlyData, userTopInteractions, selectedUsers]);

    // Calculate max values for highlighting
    const maxValues = useMemo(() => ({
        messageCount: Math.max(...userPatternsData.map(u => u.messageCount)),
        streak: Math.max(...userPatternsData.map(u => u.streak)),
        initiations: Math.max(...userPatternsData.map(u => u.initiations)),
        reactionsGiven: Math.max(...userPatternsData.map(u => u.reactionsGiven)),
        reactionsReceived: Math.max(...userPatternsData.map(u => u.reactionsReceived)),
        engagement: Math.max(...userPatternsData.map(u => u.engagement)),
        total: Math.max(...userPatternsData.map(u => u.total)),
    }), [userPatternsData]);

    // Sort data
    const sortedData = useMemo(() => {
        return [...userPatternsData]
            .sort((a, b) => {
                let aVal = a[sortColumn];
                let bVal = b[sortColumn];
                if (sortColumn === 'name' || sortColumn === 'shortName') {
                    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
    }, [userPatternsData, sortColumn, sortDirection]);

    // Handle user click
    const handleUserClick = useCallback((user) => {
        setSelectedUser(user);
        setIsPanelOpen(true);
    }, []);

    // Calculate totals for footer
    const totals = useMemo(() => ({
        messageCount: userPatternsData.reduce((sum, u) => sum + u.messageCount, 0),
        reactionsGiven: userPatternsData.reduce((sum, u) => sum + u.reactionsGiven, 0),
        reactionsReceived: userPatternsData.reduce((sum, u) => sum + u.reactionsReceived, 0),
        total: userPatternsData.reduce((sum, u) => sum + u.total, 0),
        initiations: userPatternsData.reduce((sum, u) => sum + u.initiations, 0),
    }), [userPatternsData]);

    // Helper to check if value is the leader
    const isLeader = (value, maxValue) => value === maxValue && value > 0;

    // Initiations pie chart data
    const initiationsPieData = useMemo(() => {
        const totalInitiations = userPatternsData.reduce((sum, u) => sum + (u.initiations || 0), 0);
        if (totalInitiations === 0) return [];
        
        return userPatternsData
            .filter(u => u.initiations > 0)
            .map(u => ({
                name: u.shortName,
                fullName: u.name,
                value: u.initiations,
                percentage: Math.round((u.initiations / totalInitiations) * 100),
                color: u.color
            }))
            .sort((a, b) => b.value - a.value);
    }, [userPatternsData]);

    // Custom tooltip for pie chart
    const PieTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                    <p className="font-mono text-[12px] uppercase tracking-wider font-semibold" style={{ color: data.color }}>
                        {data.fullName}
                    </p>
                    <p className="font-mono text-[14px] text-black mt-1">
                        <span className="font-bold">{data.value.toLocaleString()}</span>
                        <span className="text-neutral-500"> initiations</span>
                    </p>
                    <p className="font-mono text-[12px] text-neutral-500">
                        {data.percentage}% of total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-16">
            {/* Initiations Pie Chart */}
            {initiationsPieData.length > 0 && (
                <ChartCard
                    title="Who Starts Conversations"
                    subtitle="Distribution of conversation initiations"
                    className="h-auto max-w-xl"
                >
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={initiationsPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percentage }) => percentage >= 5 ? `${name} ${percentage}%` : ''}
                                    labelLine={false}
                                >
                                    {initiationsPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip content={<PieTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {initiationsPieData.slice(0, 6).map((entry) => (
                            <div key={entry.name} className="flex items-center gap-2">
                                <div className="w-2 h-2" style={{ backgroundColor: entry.color }} />
                                <span className="font-mono text-[11px] uppercase text-neutral-500">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            )}

            {/* THE INDEX - Master User Table */}
            <div>
                <ChartCard
                    title="User Index"
                    subtitle="Click a user to explore their stats"
                    className="h-auto"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px]">
                            <thead>
                                <tr>
                                    <TableHeader align="left" className="w-12">#</TableHeader>
                                    <SortableHeader column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} align="left">User</SortableHeader>
                                    <SortableHeader column="messageCount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Messages</SortableHeader>
                                    <TableHeader align="center" className="w-16">Trend</TableHeader>
                                    <SortableHeader column="reactionsReceived" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Recv</SortableHeader>
                                    <SortableHeader column="reactionsGiven" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Given</SortableHeader>
                                    <SortableHeader column="engagement" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Eng.</SortableHeader>
                                    <SortableHeader column="streak" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Streak</SortableHeader>
                                    <SortableHeader column="initiations" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Init</SortableHeader>
                                    <SortableHeader column="total" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Media</SortableHeader>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map((row, i) => {
                                    const isHovered = hoveredUser === row.name;
                                    return (
                                        <TableRow 
                                            key={row.name}
                                            isHovered={isHovered}
                                            onHover={(hovered) => setHoveredUser(hovered ? row.name : null)}
                                            onClick={() => handleUserClick(row)}
                                        >
                                            {/* RANK */}
                                            <TableCell variant="rank" align="left" isHovered={isHovered} className="px-4">
                                                {String(i + 1).padStart(2, '0')}
                                            </TableCell>
                                            
                                            {/* USER - Uppercase bold with color bar */}
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-0">
                                                    {/* Color bar - full height vertical stripe */}
                                                    <div 
                                                        className="w-1 self-stretch mr-3 flex-shrink-0" 
                                                        style={{ 
                                                            backgroundColor: isHovered ? 'var(--accent-primary)' : row.color,
                                                            minHeight: '20px'
                                                        }} 
                                                    />
                                                    <span 
                                                        className={`font-mono text-[13px] font-bold uppercase tracking-wide truncate ${isHovered ? 'text-accent' : 'text-black'}`}
                                                        title={row.name}
                                                    >
                                                        {row.shortName}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            {/* MESSAGES */}
                                            <TableCell isLeader={isLeader(row.messageCount, maxValues.messageCount)} isHovered={isHovered}>
                                                {formatValue(row.messageCount)}
                                            </TableCell>
                                            
                                            {/* TREND - Simple linear sparkline */}
                                            <td className="py-3 px-2">
                                                <div className="flex justify-center">
                                                    {row.monthlyTrend?.length > 1 && (
                                                        <Sparkline 
                                                            data={row.monthlyTrend} 
                                                            color="var(--accent-primary)"
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            
                                            {/* RECV */}
                                            <TableCell isLeader={isLeader(row.reactionsReceived, maxValues.reactionsReceived)} isHovered={isHovered}>
                                                {formatValue(row.reactionsReceived)}
                                            </TableCell>
                                            
                                            {/* GIVEN */}
                                            <TableCell isLeader={isLeader(row.reactionsGiven, maxValues.reactionsGiven)} isHovered={isHovered}>
                                                {formatValue(row.reactionsGiven)}
                                            </TableCell>
                                            
                                            {/* ENGAGEMENT */}
                                            <TableCell variant="muted" isLeader={isLeader(row.engagement, maxValues.engagement)} isHovered={isHovered}>
                                                {row.engagement > 0 ? row.engagement.toFixed(2) : '—'}
                                            </TableCell>
                                            
                                            {/* STREAK */}
                                            <TableCell isLeader={isLeader(row.streak, maxValues.streak)} isHovered={isHovered}>
                                                {row.streak > 0 ? `${row.streak}d` : '—'}
                                            </TableCell>
                                            
                                            {/* INITIATIONS */}
                                            <TableCell isLeader={isLeader(row.initiations, maxValues.initiations)} isHovered={isHovered}>
                                                {formatValue(row.initiations)}
                                            </TableCell>
                                            
                                            {/* MEDIA */}
                                            <TableCell isLeader={isLeader(row.total, maxValues.total)} isHovered={isHovered}>
                                                {formatValue(row.total)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </tbody>
                            {/* TOTALS */}
                            <tfoot>
                                <TableFooter>
                                    <td className="py-6 px-3 font-mono text-[12px] text-neutral-300">Σ</td>
                                    <TableFooterCell align="left" isLabel>Total</TableFooterCell>
                                    <TableFooterCell>{totals.messageCount.toLocaleString()}</TableFooterCell>
                                    <td className="py-4 px-2"></td>
                                    <TableFooterCell>{totals.reactionsReceived.toLocaleString()}</TableFooterCell>
                                    <TableFooterCell>{totals.reactionsGiven.toLocaleString()}</TableFooterCell>
                                    <TableFooterCell isEmpty />
                                    <TableFooterCell isEmpty />
                                    <TableFooterCell>{totals.initiations.toLocaleString()}</TableFooterCell>
                                    <TableFooterCell>{totals.total.toLocaleString()}</TableFooterCell>
                                </TableFooter>
                            </tfoot>
                        </table>
                    </div>
                </ChartCard>
            </div>

            {/* THE DOSSIER - User Detail Panel */}
            <UserDossier 
                user={selectedUser}
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                allUsers={userPatternsData}
                networkMatrix={networkMatrix}
            />
        </div>
    );
}

