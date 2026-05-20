import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import Drawer from './Drawer';
import { COLORS, CHART, getChartTooltipStyle } from '../design';
import { formatName } from '../utils/formatters';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SWISS_TOOLTIP = getChartTooltipStyle();

/**
 * Brutalist Barcode Activity Chart
 * Solid skyline-like shape with no gaps between bars
 */
export const BarcodeActivityChart = ({ data, color = COLORS.text.secondary, accentColor = COLORS.accent, height = 48 }) => {
    if (!data || data.length === 0) return null;
    
    const max = Math.max(...data) || 1;
    const peakIndex = data.indexOf(max);
    
    return (
        <div className="flex items-end w-full h-full" style={{ height, gap: 0 }}>
            {data.map((value, i) => {
                const barHeight = Math.max((value / max) * 100, value > 0 ? 2 : 0);
                const isPeak = i === peakIndex && value > 0;
                return (
                    <div
                        key={i}
                        className="flex-1"
                        style={{ 
                            height: `${barHeight}%`,
                            backgroundColor: isPeak ? accentColor : color,
                            minWidth: '1px'
                        }}
                    />
                );
            })}
        </div>
    );
};

/**
 * User Timeline Chart - Matches main page style
 * Automatically shows years or months based on data span
 * Accepts either:
 * - monthlyData: Object { "2024-01": 123, "2024-02": 456, ... }
 * - monthlyArray: Array [123, 456, ...] with monthKeys: ["2024-01", "2024-02", ...]
 */
export const UserTimelineChart = ({ monthlyData, monthlyArray, monthKeys, height = 180 }) => {
    const { data, peakPoint, mode } = useMemo(() => {
        // Convert array format to object format if needed
        let normalizedData = monthlyData;
        
        if (monthlyArray && monthKeys && monthKeys.length === monthlyArray.length) {
            normalizedData = {};
            monthKeys.forEach((key, i) => {
                normalizedData[key] = monthlyArray[i];
            });
        } else if (monthlyArray && !monthlyData) {
            // Array without keys - can't create meaningful labels
            return { data: [], peakPoint: null, mode: 'month' };
        }
        
        if (!normalizedData || Object.keys(normalizedData).length === 0) {
            return { data: [], peakPoint: null, mode: 'month' };
        }
        
        const keys = Object.keys(normalizedData).sort();
        const firstYear = parseInt(keys[0].split('-')[0]);
        const lastYear = parseInt(keys[keys.length - 1].split('-')[0]);
        const yearSpan = lastYear - firstYear + 1;
        
        // Use yearly aggregation if span > 3 years, otherwise monthly
        const useYearly = yearSpan > 3;
        
        let chartData = [];
        let peak = null;
        let maxCount = 0;
        
        if (useYearly) {
            // Aggregate by year
            const yearlyTotals = {};
            Object.entries(normalizedData).forEach(([key, count]) => {
                const year = key.split('-')[0];
                yearlyTotals[year] = (yearlyTotals[year] || 0) + count;
            });
            
            chartData = Object.entries(yearlyTotals)
                .map(([year, count]) => ({ key: year, count, label: `'${year.slice(-2)}` }))
                .sort((a, b) => a.key.localeCompare(b.key));
            
            chartData.forEach((d, idx) => {
                if (d.count > maxCount) {
                    maxCount = d.count;
                    peak = { ...d, idx };
                }
            });
            
            return { data: chartData, peakPoint: peak, mode: 'year' };
        } else {
            // Use monthly data
            chartData = Object.entries(normalizedData)
                .map(([key, count]) => {
                    const [year, month] = key.split('-');
                    return { 
                        key, 
                        count, 
                        label: `${MONTHS[parseInt(month) - 1]} '${year.slice(-2)}` 
                    };
                })
                .sort((a, b) => a.key.localeCompare(b.key));
            
            chartData.forEach((d, idx) => {
                if (d.count > maxCount) {
                    maxCount = d.count;
                    peak = { ...d, idx };
                }
            });
            
            return { data: chartData, peakPoint: peak, mode: 'month' };
        }
    }, [monthlyData, monthlyArray, monthKeys]);
    
    if (!data || data.length < 2) return null;
    
    // Calculate appropriate tick interval based on data length
    const tickInterval = mode === 'year' 
        ? Math.max(0, Math.floor(data.length / 10))
        : Math.max(0, Math.floor(data.length / 6));
    
    return (
        <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 5, left: 5, bottom: 0 }}>
                    <XAxis
                        dataKey="label"
                        stroke={CHART.axis.stroke}
                        tick={{ fontSize: 10, fill: COLORS.text.muted, fontFamily: 'JetBrains Mono, monospace' }}
                        tickLine={false}
                        axisLine={{ stroke: CHART.axis.stroke }}
                        interval={tickInterval}
                        minTickGap={mode === 'year' ? 25 : 45}
                    />
                    <YAxis hide={true} />
                    <Tooltip
                        contentStyle={SWISS_TOOLTIP}
                        labelFormatter={(label) => label}
                        formatter={(value) => [`${value.toLocaleString()} msgs`, '']}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke={COLORS.accent}
                        strokeWidth={2}
                        fillOpacity={0.1}
                        fill={COLORS.accent}
                        dot={false}
                        activeDot={{ r: 4, fill: COLORS.accent, stroke: '#fff', strokeWidth: 2 }}
                    />
                    {peakPoint && (
                        <ReferenceDot
                            x={peakPoint.label}
                            y={peakPoint.count}
                            r={5}
                            fill={COLORS.accent}
                            stroke="#fff"
                            strokeWidth={2}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

/**
 * User Detail Panel (Dossier)
 * Swiss Brutalist design - whitespace and typography only, no borders
 */
export const UserDossier = ({ user, isOpen, onClose, allUsers, networkMatrix }) => {
    if (!user) return null;

    // Calculate percentile rankings
    const getPercentile = (value, key) => {
        const values = allUsers.map(u => u[key] || 0).sort((a, b) => a - b);
        const rank = values.findIndex(v => v >= value);
        return Math.round(((rank + 1) / values.length) * 100);
    };

    // Format compact number
    const formatCompact = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num?.toLocaleString() || '0';
    };

    // Compute top 3 givers and receivers from network matrix
    const getTopInteractions = () => {
        if (!networkMatrix) return { topGivers: [], topReceivers: [], topConnection: null };
        
        const givesTo = {};
        const receivesFrom = {};
        const totalInteractions = {}; // Combined for top connection
        let totalGiven = 0;
        let totalReceived = 0;
        
        Object.entries(networkMatrix).forEach(([key, count]) => {
            const [reactor, receiver] = key.split('|');
            
            // Who this user gives to
            if (reactor === user.name && receiver !== user.name) {
                givesTo[receiver] = (givesTo[receiver] || 0) + count;
                totalGiven += count;
                totalInteractions[receiver] = (totalInteractions[receiver] || 0) + count;
            }
            
            // Who gives to this user
            if (receiver === user.name && reactor !== user.name) {
                receivesFrom[reactor] = (receivesFrom[reactor] || 0) + count;
                totalReceived += count;
                totalInteractions[reactor] = (totalInteractions[reactor] || 0) + count;
            }
        });
        
        const topGivers = Object.entries(receivesFrom)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({
                name: formatName(name),
                fullName: name,
                count,
                percent: totalReceived > 0 ? Math.round((count / totalReceived) * 100) : 0
            }));
        
        const topReceivers = Object.entries(givesTo)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({
                name: formatName(name),
                fullName: name,
                count,
                percent: totalGiven > 0 ? Math.round((count / totalGiven) * 100) : 0
            }));
        
        // Find top connection overall
        const topConnectionEntry = Object.entries(totalInteractions).sort((a, b) => b[1] - a[1])[0];
        const topConnection = topConnectionEntry ? {
            name: formatName(topConnectionEntry[0]),
            fullName: topConnectionEntry[0],
            count: topConnectionEntry[1]
        } : null;
        
        return { topGivers, topReceivers, totalGiven, totalReceived, topConnection };
    };

    const { topGivers, topReceivers, totalGiven, totalReceived, topConnection } = getTopInteractions();

    // Find peak hour
    const peakHour = user.hourlyActivity 
        ? user.hourlyActivity.indexOf(Math.max(...user.hourlyActivity))
        : 12;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            position="right"
            zIndex={60}
            className="bg-white w-full md:w-[min(580px,max(450px,48vw))]"
            showOverlay={true}
        >
            {/* Main content area */}
            <div className="h-full flex flex-col overflow-hidden relative">
                {/* Close button - minimal */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center font-mono text-2xl text-neutral-300 hover:text-black transition-colors z-10"
                >
                    ×
                </button>
                
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 pt-8 pb-12 md:px-8">

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* HEADER - Identity + Top Connection Badge */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="pr-12 mb-4">
                        {/* Top Connection Badge */}
                        {topConnection && (
                            <div className="mb-6 inline-flex items-center gap-3 bg-black text-white px-4 py-2">
                                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">Top Connection</span>
                                <span className="font-mono text-sm font-black uppercase tracking-wide">{topConnection.name}</span>
                                <span className="font-mono text-[10px] text-accent">{topConnection.count}</span>
                            </div>
                        )}
                        
                        {/* Massive Name */}
                        <h2 className="font-mono text-[clamp(2.5rem,8vw,4rem)] font-black uppercase tracking-[-0.03em] text-black leading-[0.85]">
                            {user.name}
                        </h2>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECTION: OVERVIEW - 2x2 Grid */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <section className="py-12">
                        <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-8">Overview</h3>
                        
                        {/* 2x2 Grid for primary metrics */}
                        <div className="grid grid-cols-2 gap-x-8 gap-y-10">
                            {/* Messages */}
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Messages</div>
                                <div className="font-mono text-5xl font-black text-black tabular-nums leading-none">
                                    {formatCompact(user.messageCount || 0)}
                                </div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-2">
                                    Top {100 - getPercentile(user.messageCount || 0, 'messageCount')}%
                                </div>
                            </div>
                            
                            {/* Engagement */}
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Engagement</div>
                                <div className="font-mono text-5xl font-black text-black tabular-nums leading-none">
                                    {user.engagement?.toFixed(2) || '0.00'}
                                </div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-2">
                                    Reactions ÷ Messages
                                </div>
                            </div>
                            
                            {/* Reactions Received */}
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Received</div>
                                <div className="font-mono text-5xl font-black text-accent tabular-nums leading-none">
                                    {formatCompact(user.reactionsReceived || 0)}
                                </div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-2">
                                    Top {100 - getPercentile(user.reactionsReceived || 0, 'reactionsReceived')}%
                                </div>
                            </div>
                            
                            {/* Reactions Given */}
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Given</div>
                                <div className="font-mono text-5xl font-black text-black tabular-nums leading-none">
                                    {formatCompact(user.reactionsGiven || 0)}
                                </div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-2">
                                    {user.balance > 0 ? '+' : ''}{user.balance || 0}% Balance
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECTION: ACTIVITY */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <section className="py-12">
                        <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-8">Activity</h3>
                        
                        {/* 24h Histogram - Brutalist Skyline */}
                        <div className="mb-10">
                            <div className="flex justify-between items-baseline mb-4">
                                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">24H Pattern</span>
                                <span className="font-mono text-xs">
                                    Peak <span className="font-black text-accent">{peakHour}:00</span>
                                </span>
                            </div>
                            <div className="h-32 bg-neutral-50">
                                <BarcodeActivityChart 
                                    data={user.hourlyActivity} 
                                    color="#E5E5E5"
                                    accentColor={COLORS.accent}
                                    height={128} 
                                />
                            </div>
                            <div className="flex justify-between mt-2 font-mono text-[9px] tracking-wider text-gray-400">
                                <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                            </div>
                        </div>

                        {/* Activity Stats - Horizontal */}
                        <div className="grid grid-cols-3 gap-6">
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Streak</div>
                                <div className="font-mono text-3xl font-black text-black tabular-nums">
                                    {user.streak || 0}<span className="text-lg text-gray-400 ml-1">d</span>
                                </div>
                            </div>
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Initiations</div>
                                <div className="font-mono text-3xl font-black text-black tabular-nums">
                                    {user.initiations || 0}
                                </div>
                            </div>
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">Active Days</div>
                                <div className="font-mono text-3xl font-black text-black tabular-nums">
                                    {user.activeDays || '—'}
                                </div>
                            </div>
                        </div>

                        {/* Monthly Trend - Recharts style matching main page */}
                        {user.monthlyData && Object.keys(user.monthlyData).length > 1 && (
                            <div className="mt-12">
                                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">Activity Over Time</div>
                                <UserTimelineChart 
                                    monthlyData={user.monthlyData}
                                    height={180}
                                />
                            </div>
                        )}
                    </section>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECTION: RELATIONSHIPS - Side by Side */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {(topGivers.length > 0 || topReceivers.length > 0) && (
                        <section className="py-12">
                            <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-8">Relationships</h3>
                            
                            {/* Side-by-side Inbound/Outbound */}
                            <div className="grid grid-cols-2 gap-8">
                                {/* INBOUND - Who reacts to this user */}
                                <div>
                                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">
                                        Inbound
                                    </div>
                                    <div className="space-y-4">
                                        {topGivers.slice(0, 3).map((person, i) => (
                                            <div key={person.fullName}>
                                                <div className="font-mono text-sm font-black uppercase tracking-wide text-black truncate">
                                                    {person.name}
                                                </div>
                                                <div className="font-mono text-[11px] text-gray-500">
                                                    <span className="text-accent font-bold">{person.count}</span> reactions
                                                </div>
                                            </div>
                                        ))}
                                        {topGivers.length === 0 && (
                                            <div className="font-mono text-[11px] text-gray-400">—</div>
                                        )}
                                    </div>
                                    {totalReceived > 0 && (
                                        <div className="mt-6 pt-4">
                                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">Total </span>
                                            <span className="font-mono text-lg font-black text-black">{totalReceived}</span>
                                        </div>
                                    )}
                                </div>

                                {/* OUTBOUND - Who this user reacts to */}
                                <div>
                                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-4">
                                        Outbound
                                    </div>
                                    <div className="space-y-4">
                                        {topReceivers.slice(0, 3).map((person, i) => (
                                            <div key={person.fullName}>
                                                <div className="font-mono text-sm font-black uppercase tracking-wide text-black truncate">
                                                    {person.name}
                                                </div>
                                                <div className="font-mono text-[11px] text-gray-500">
                                                    <span className="text-accent font-bold">{person.count}</span> given
                                                </div>
                                            </div>
                                        ))}
                                        {topReceivers.length === 0 && (
                                            <div className="font-mono text-[11px] text-gray-400">—</div>
                                        )}
                                    </div>
                                    {totalGiven > 0 && (
                                        <div className="mt-6 pt-4">
                                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400">Total </span>
                                            <span className="font-mono text-lg font-black text-black">{totalGiven}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SECTION: CONTENT */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <section className="py-12">
                        <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-8">Content</h3>
                        
                        {/* Media Grid */}
                        <div className="grid grid-cols-5 gap-4">
                            {[
                                { label: 'Photo', value: user.photos || 0 },
                                { label: 'Video', value: user.videos || 0 },
                                { label: 'GIF', value: user.gifs || 0 },
                                { label: 'Audio', value: user.audio || 0 },
                                { label: 'Total', value: user.total || 0, accent: true },
                            ].map(({ label, value, accent }) => (
                                <div key={label} className="text-center">
                                    <div className={`font-mono text-2xl font-black tabular-nums ${accent ? 'text-accent' : 'text-black'}`}>
                                        {value}
                                    </div>
                                    <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-gray-500 mt-1">{label}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            </div>
        </Drawer>
    );
};

export default UserDossier;
