import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine, AreaChart, Area, BarChart, Bar } from 'recharts';
import InteractionHeatmap from './InteractionHeatmap';
import { EmojiTooltip } from './EmojiTooltip';
import { formatName } from '../utils/formatters';
import { COLORS, STYLES, CHART, getChartTooltipStyle } from '../design';
import { SectionHeader, ModeToggle } from './ui';

// Scatter plot mode options
const SCATTER_MODES = {
    QUALITY: { key: 'quality', label: 'Quality/Quantity' },
    ACTIVITY: { key: 'activity', label: 'Givers/Receivers' }
};

export default function ReactionsAnalysis({ users, emojis, networkMatrix, selectedUsers, messages, selectedYears, aggregates }) {
    const [scatterMode, setScatterMode] = useState(SCATTER_MODES.QUALITY.key);
    const [hoveredEmoji, setHoveredEmoji] = useState(null);
    const containerRef = useRef(null);

    // Top Emojis with percentage calculation
    const topEmojis = useMemo(() => {
        const total = Object.values(emojis).reduce((sum, count) => sum + count, 0);
        return Object.entries(emojis)
            .map(([emoji, count]) => ({ 
                emoji, 
                count,
                percentage: (count / total) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }, [emojis]);

    // Compute emoji evolution by year - prefer messages if they have reactions, else use aggregates
    const emojiEvolution = useMemo(() => {
        const evolution = {};
        const selectedYearSet = selectedYears ? new Set(selectedYears) : null;
        
        // Check if messages have reaction data
        const hasMessageReactions = messages?.some(msg => msg.reactions && msg.reactions.length > 0);
        
        if (hasMessageReactions && messages) {
            // Use message-level data
            messages.forEach(msg => {
                if (!msg.reactions) return;
                const year = new Date(msg.timestamp_ms).getFullYear();
                
                // Skip if year not selected
                if (selectedYearSet && !selectedYearSet.has(year)) return;
                
                msg.reactions.forEach(rxn => {
                    const emoji = rxn.reaction;
                    if (!evolution[emoji]) evolution[emoji] = {};
                    if (!evolution[emoji][year]) evolution[emoji][year] = 0;
                    evolution[emoji][year]++;
                });
            });
        } else if (aggregates?.yearly) {
            // Fall back to aggregates yearly data
            Object.entries(aggregates.yearly).forEach(([yearStr, yearData]) => {
                const year = parseInt(yearStr);
                
                // Skip if year not selected
                if (selectedYearSet && !selectedYearSet.has(year)) return;
                
                (yearData.top_emojis || []).forEach(({ emoji, count }) => {
                    if (!evolution[emoji]) evolution[emoji] = {};
                    if (!evolution[emoji][year]) evolution[emoji][year] = 0;
                    evolution[emoji][year] += count;
                });
            });
        }
        
        // Convert to sorted arrays by year
        const result = {};
        Object.entries(evolution).forEach(([emoji, years]) => {
            const sortedYears = Object.keys(years).sort();
            result[emoji] = sortedYears.map(year => ({
                year: parseInt(year),
                count: years[year]
            }));
        });
        
        return result;
    }, [messages, selectedYears, aggregates]);

    // Compute per-user emoji usage leaderboard (who reacts with each emoji the most)
    const emojiLeaderboards = useMemo(() => {
        const leaderboards = {};
        const selectedUserSet = selectedUsers ? new Set(selectedUsers) : null;
        const selectedYearSet = selectedYears ? new Set(selectedYears) : null;
        
        // Check if messages have reaction data
        const hasMessageReactions = messages?.some(msg => msg.reactions && msg.reactions.length > 0);
        
        if (hasMessageReactions && messages) {
            // Use message-level data
            messages.forEach(msg => {
                if (!msg.reactions) return;
                const year = new Date(msg.timestamp_ms).getFullYear();
                
                // Skip if year not selected
                if (selectedYearSet && !selectedYearSet.has(year)) return;
                
                msg.reactions.forEach(rxn => {
                    const emoji = rxn.reaction;
                    const actor = rxn.actor;
                    
                    // Skip if user not selected
                    if (selectedUserSet && !selectedUserSet.has(actor)) return;
                    
                    if (!leaderboards[emoji]) leaderboards[emoji] = {};
                    if (!leaderboards[emoji][actor]) leaderboards[emoji][actor] = 0;
                    leaderboards[emoji][actor]++;
                });
            });
        } else if (aggregates?.yearly) {
            // Fall back to aggregates - use top_messagers as proxy for emoji usage
            // Since we don't have per-user per-emoji data in aggregates, 
            // we distribute emoji usage proportionally by user's reaction activity
            const userTotals = aggregates.user_totals || {};
            const totalReactionsGiven = Object.values(userTotals).reduce((sum, u) => sum + (u.reactions_given || 0), 0);
            
            if (totalReactionsGiven > 0) {
                // For each emoji, distribute among users proportionally to their reactions_given
                Object.entries(emojis).forEach(([emoji, totalCount]) => {
                    if (!leaderboards[emoji]) leaderboards[emoji] = {};
                    
                    Object.entries(userTotals).forEach(([name, data]) => {
                        // Skip if user not selected
                        if (selectedUserSet && !selectedUserSet.has(name)) return;
                        
                        const userShare = (data.reactions_given || 0) / totalReactionsGiven;
                        const estimatedCount = Math.round(totalCount * userShare);
                        
                        if (estimatedCount > 0) {
                            leaderboards[emoji][name] = estimatedCount;
                        }
                    });
                });
            }
        }
        
        // Convert to sorted arrays
        const result = {};
        Object.entries(leaderboards).forEach(([emoji, usersData]) => {
            result[emoji] = Object.entries(usersData)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);
        });
        
        return result;
    }, [messages, selectedUsers, selectedYears, aggregates, emojis]);

    // Track anchor rect for dynamic positioning
    const [anchorRect, setAnchorRect] = useState(null);
    
    // Track if we're using touch interaction (persists until mouse is used)
    const isTouchDevice = useRef(false);
    const hideTimeoutRef = useRef(null);
    
    // Handle emoji interaction (hover on desktop, click on touch)
    const handleEmojiEnter = useCallback((emoji, count, event) => {
        // If touch was used, ignore mouse events (prevents ghost hover after tap)
        if (isTouchDevice.current) return;
        
        // Only trigger on mouse hover (not touch)
        if (event.pointerType === 'touch') {
            isTouchDevice.current = true;
            return;
        }
        
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        
        const rect = event.currentTarget.getBoundingClientRect();
        setAnchorRect(rect);
        setHoveredEmoji({ emoji, count });
    }, []);

    const handleEmojiLeave = useCallback((event) => {
        // If touch device, ignore mouse leave events
        if (isTouchDevice.current) return;
        
        // Only trigger on mouse leave (not touch)
        if (event.pointerType === 'touch') return;
        
        // Add a small delay to prevent flicker when moving between emojis
        // or when tooltip positioning causes layout shift
        hideTimeoutRef.current = setTimeout(() => {
            setHoveredEmoji(null);
            setAnchorRect(null);
        }, 100);
    }, []);
    
    // Handle click for touch devices
    const handleEmojiClick = useCallback((emoji, count, event) => {
        // Mark as touch device if this is a touch event
        if (event.pointerType === 'touch' || 'ontouchstart' in window) {
            isTouchDevice.current = true;
        }
        
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        
        const rect = event.currentTarget.getBoundingClientRect();
        setAnchorRect(rect);
        
        // Toggle on click - if same emoji, close; otherwise open new
        if (hoveredEmoji?.emoji === emoji) {
            setHoveredEmoji(null);
            setAnchorRect(null);
        } else {
            setHoveredEmoji({ emoji, count });
        }
    }, [hoveredEmoji]);
    
    const handleCloseTooltip = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
        setHoveredEmoji(null);
        setAnchorRect(null);
    }, []);
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);

    // Scatter Plot Data - Multiple modes
    const scatterDataByMode = useMemo(() => {
        const baseData = Object.entries(users)
            .filter(([_, stats]) => stats.messages > 10)
            .map(([name, stats]) => {
                const parts = name.split(' ');
                const shortName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
                const given = stats.reactions_given || 0;
                const received = stats.reactions_received || 0;
                const total = given + received;
                const balance = total > 0 ? ((given - received) / total) * 100 : 0;
                
                return {
                    name,
                    shortName,
                    messages: stats.messages,
                    engagement: stats.efficiency, // renamed from efficiency
                    reactions_received: stats.reactions_received,
                    reactions_given: stats.reactions_given || 0,
                    balance,
                    isGiver: balance > 0
                };
            });
        
        return {
            // Quality: X=Messages, Y=Engagement, Size=Reactions Received
            [SCATTER_MODES.QUALITY.key]: baseData.map(d => ({
                ...d,
                x: d.messages,
                y: d.engagement,
                z: d.reactions_received,
                highlight: d.engagement > 0.5
            })),
            // Activity: X=Given, Y=Received, Size=Messages (givers highlighted)
            [SCATTER_MODES.ACTIVITY.key]: baseData
                .filter(d => d.reactions_given > 5 || d.reactions_received > 5)
                .map(d => ({
                    ...d,
                    x: d.reactions_given,
                    y: d.reactions_received,
                    z: d.messages,
                    highlight: d.isGiver
                }))
        };
    }, [users]);

    // Get current scatter data based on mode
    const scatterData = scatterDataByMode[scatterMode] || scatterDataByMode[SCATTER_MODES.QUALITY.key];
    
    // Scatter mode configurations with explanatory subtitles
    const scatterConfigs = {
        [SCATTER_MODES.QUALITY.key]: {
            title: 'Quality vs Quantity',
            subtitle: 'Messages sent vs reactions per message. Who gets the most engagement relative to output?',
            xLabel: 'Messages',
            yLabel: 'Engagement'
        },
        [SCATTER_MODES.ACTIVITY.key]: {
            title: 'Givers vs Receivers',
            subtitle: 'Reactions given vs received. Are you more generous or more popular?',
            xLabel: 'Given',
            yLabel: 'Received'
        }
    };
    
    
    const currentConfig = scatterConfigs[scatterMode];

    // Custom label renderer with leader lines for clustered dots
    const renderCustomizedLabel = (props) => {
        const { x, y, value, index } = props;
        const entry = scatterData[index];
        if (!entry) return null;
        
        // Calculate offset based on position to avoid overlap
        const offsetX = x > 400 ? -8 : 8;
        const offsetY = -12;
        
        return (
            <text
                x={x + offsetX}
                y={y + offsetY}
                fill={COLORS.text.secondary}
                fontSize={9}
                fontFamily={CHART.axis.tick.fontFamily}
                textAnchor={x > 400 ? 'end' : 'start'}
            >
                {value}
            </text>
        );
    };

    return (
        <div className="space-y-24">

            {/* ==========================================
                SECTION 2: TOP EMOJI
                Minimalist grid with interactive tooltips
               ========================================== */}
            <div ref={containerRef}>
                <SectionHeader
                    title="Top Emoji"
                    subtitle="Most used reaction emojis · Hover to see evolution over time and top users"
                    className="mb-8"
                />
                
                {/* All emojis in uniform grid */}
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-x-4 gap-y-6">
                    {topEmojis.slice(0, 20).map((item, index) => {
                        const isActive = hoveredEmoji?.emoji === item.emoji;
                        return (
                            <div 
                                key={index} 
                                className={`flex flex-col items-center relative cursor-pointer transition-transform select-none ${isActive ? 'scale-110' : 'hover:scale-110'}`}
                                onPointerEnter={(e) => handleEmojiEnter(item.emoji, item.count, e)}
                                onPointerLeave={handleEmojiLeave}
                                onClick={(e) => handleEmojiClick(item.emoji, item.count, e)}
                            >
                                {/* #1 badge only for the winner */}
                                {index === 0 && (
                                    <span 
                                        className="font-mono text-[8px] font-bold absolute -top-3 left-1/2 -translate-x-1/2"
                                        style={{ color: COLORS.accent }}
                                    >
                                        #1
                                    </span>
                                )}
                                
                                {/* Emoji */}
                                <span 
                                    className={index === 0 ? "text-4xl mb-1" : "text-2xl mb-1"}
                                    style={{ fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', sans-serif" }}
                                >
                                    {item.emoji}
                                </span>
                                
                                {/* Count */}
                                <span className={`font-mono text-[12px] ${index === 0 ? 'font-medium' : ''}`} style={{ color: index === 0 ? COLORS.accent : COLORS.neutral[500] }}>
                                    {item.count.toLocaleString()}
                                </span>
                            </div>
                        );
                    })}
                </div>
                
                {/* Emoji Tooltip */}
                <EmojiTooltip
                    emoji={hoveredEmoji?.emoji}
                    count={hoveredEmoji?.count || 0}
                    isVisible={!!hoveredEmoji}
                    anchorRect={anchorRect}
                    evolution={hoveredEmoji ? emojiEvolution[hoveredEmoji.emoji] : null}
                    leaderboard={hoveredEmoji ? emojiLeaderboards[hoveredEmoji.emoji] : null}
                    onClose={handleCloseTooltip}
                />
            </div>

            {/* ==========================================
                SECTION 3: USER BEHAVIOR MATRIX
                Quadrant scatter plot with responsive design
               ========================================== */}
            <div>
                {/* Dynamic title, subtitle, and mode selector */}
                <SectionHeader
                    title={currentConfig.title}
                    subtitle={currentConfig.subtitle}
                    right={
                        <ModeToggle
                            options={Object.values(SCATTER_MODES).map(({ key, label }) => ({ key, label }))}
                            value={scatterMode}
                            onChange={setScatterMode}
                        />
                    }
                />
                
                {/* Chart container */}
                <div className="relative">
                    {/* Scatter Chart - responsive with aspect ratio */}
                    <div className="w-full" style={{ aspectRatio: '4 / 3', minHeight: 300, maxHeight: 500 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 24, right: 24, bottom: 48, left: 48 }}>
                                <XAxis 
                                    type="number" 
                                    dataKey="x" 
                                    name={currentConfig.xLabel} 
                                    stroke={COLORS.chart.axis}
                                    tick={CHART.axis.tick}
                                    axisLine={{ stroke: COLORS.border.whisper, strokeWidth: 1 }}
                                    tickLine={false}
                                    label={{ 
                                        value: currentConfig.xLabel, 
                                        position: 'bottom', 
                                        offset: 28, 
                                        fill: COLORS.neutral[500], 
                                        fontSize: 12, 
                                        fontFamily: CHART.axis.tick.fontFamily,
                                    }}
                                />
                                <YAxis 
                                    type="number" 
                                    dataKey="y" 
                                    name={currentConfig.yLabel} 
                                    stroke={COLORS.chart.axis}
                                    tick={CHART.axis.tick}
                                    axisLine={{ stroke: COLORS.border.whisper, strokeWidth: 1 }}
                                    tickLine={false}
                                    width={36}
                                    label={{ 
                                        value: currentConfig.yLabel, 
                                        angle: -90, 
                                        position: 'left', 
                                        offset: 32, 
                                        fill: COLORS.neutral[500], 
                                        fontSize: 12, 
                                        fontFamily: CHART.axis.tick.fontFamily,
                                    }}
                                />
                                <ZAxis type="number" dataKey="z" range={[40, 400]} name="Size" />
                                
                                <Tooltip
                                    cursor={{ strokeDasharray: '0', stroke: COLORS.accent }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="p-3 text-sm font-mono bg-white shadow-[0_8px_32px_rgba(0,0,0,0.15)]" style={{ maxWidth: 240 }}>
                                                    <p className="font-semibold mb-2 text-[12px] uppercase tracking-wider" style={{ color: COLORS.accent }}>
                                                        {formatName(data.name)}
                                                    </p>
                                                    <div className="space-y-1 text-[12px]">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-neutral-400">Messages</span>
                                                            <span className="text-black font-medium tabular-nums">{data.messages.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-neutral-400">Given</span>
                                                            <span className="text-black font-medium tabular-nums">{data.reactions_given.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-neutral-400">Received</span>
                                                            <span className="text-black font-medium tabular-nums">{data.reactions_received.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-neutral-400">Engagement</span>
                                                            <span className="text-black font-medium tabular-nums">{data.engagement?.toFixed(2)}</span>
                                                        </div>
                                                        {scatterMode === SCATTER_MODES.ACTIVITY.key && (
                                                            <div className="pt-2 mt-2 border-t border-neutral-100">
                                                                <span className="font-medium" style={{ color: data.isGiver ? COLORS.accent : COLORS.text.secondary }}>
                                                                    {data.isGiver ? '↑ Net Giver' : '↓ Net Receiver'} ({data.balance > 0 ? '+' : ''}{data.balance.toFixed(0)}%)
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Scatter name="Users" data={scatterData}>
                                    {scatterData.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.highlight ? COLORS.accent : COLORS.text.primary}
                                            fillOpacity={entry.highlight ? 1 : 0.85}
                                            stroke="none"
                                        />
                                    ))}
                                    <LabelList 
                                        dataKey="shortName" 
                                        content={renderCustomizedLabel}
                                    />
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                {/* Legend */}
                <div className="mt-6 pt-4">
                    <div className="flex flex-wrap justify-center gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-black" />
                            <span className="font-mono text-[12px] uppercase tracking-widest text-neutral-400">
                                Standard
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3" style={{ backgroundColor: COLORS.accent }} />
                            <span className="font-mono text-[12px] uppercase tracking-widest text-neutral-400">
                                {scatterMode === SCATTER_MODES.ACTIVITY.key ? 'Net Giver' : 'High Engagement'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Heatmap */}
            <div>
                <InteractionHeatmap networkMatrix={networkMatrix} selectedUsers={selectedUsers} />
            </div>
        </div>
    );
}
