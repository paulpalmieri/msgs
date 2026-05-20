import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { COLORS, FONTS, formatName } from '../../design';

// ─── Data helpers ─────────────────────────────────────────────────────────────

function fmtNum(n) {
    return (n ?? 0).toLocaleString();
}

function fmtDate(ms) {
    if (!ms) return null;
    return new Date(ms).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtMonthTick(key) {
    const [year, month] = key.split('-');
    const abbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${abbr[parseInt(month, 10) - 1]} '${year.slice(2)}`;
}

function fmtHour(h) {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
}

function deriveStoryData(aggregates, processedData) {
    if (!aggregates || !processedData) return null;

    const global = aggregates.global || {};
    const temporal = processedData.temporal || {};
    const userTotalsRaw = aggregates.user_totals || {};

    // Monthly timeline
    const monthlyRaw = temporal.monthly || {};
    const timelineData = Object.entries(monthlyRaw)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, messages]) => ({ month, messages, label: fmtMonthTick(month) }));

    const peakMonth = timelineData.reduce(
        (max, d) => (d.messages > (max?.messages ?? 0) ? d : max), null
    );

    // Yearly totals for peak year
    const yearlyTotals = {};
    timelineData.forEach(({ month, messages }) => {
        const yr = month.split('-')[0];
        yearlyTotals[yr] = (yearlyTotals[yr] || 0) + messages;
    });
    const [peakYear, peakYearCount] = Object.entries(yearlyTotals)
        .sort(([, a], [, b]) => b - a)[0] ?? [null, 0];

    // Year-start ticks for X axis (only Jan of each year)
    const yearTicks = timelineData
        .filter(d => d.month.endsWith('-01'))
        .map(d => d.month);

    // Users sorted by message count
    const totalMsgs = global.total_messages || 0;
    const usersList = Object.entries(userTotalsRaw)
        .map(([name, data]) => ({
            name,
            messages: data.messages || 0,
            pct: totalMsgs > 0 ? Math.round((data.messages / totalMsgs) * 100) : 0,
        }))
        .sort((a, b) => b.messages - a.messages);

    // Hourly distribution (0–23 index keys)
    const hourlyRaw = temporal.hourly || {};
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        label: fmtHour(i),
        messages: hourlyRaw[i] || 0,
    }));
    const peakHour = hourlyData.reduce(
        (max, d) => (d.messages > (max?.messages ?? 0) ? d : max), null
    );

    // Daily distribution
    const dailyRaw = temporal.daily || {};
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyData = dayOrder.map(day => ({ day, messages: dailyRaw[day] || 0 }));
    const peakDay = dailyData.reduce(
        (max, d) => (d.messages > (max?.messages ?? 0) ? d : max), null
    );

    const topWords = (processedData.topWords || aggregates.top_words || []).slice(0, 10);

    return {
        totalMessages: totalMsgs,
        totalReactions: global.total_reactions || 0,
        allUsers: global.all_users || [],
        allYears: global.all_years || [],
        startDate: fmtDate(global.first_message_ms),
        endDate: fmtDate(global.last_message_ms),
        avgPerMonth: Math.round(processedData.stats?.avg_per_month || 0),
        timelineData,
        yearTicks,
        peakMonth,
        peakYear,
        peakYearCount,
        users: usersList,
        topUser: usersList[0] ?? null,
        hourlyData,
        dailyData,
        peakHour,
        peakDay,
        topWords,
    };
}

// ─── Scroll fade hook ─────────────────────────────────────────────────────────

function useInView(threshold = 0.1) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, inView];
}

function FadeIn({ children, delay = 0, className = '' }) {
    const [ref, inView] = useInView();
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : 'translateY(28px)',
                transition: `opacity 0.9s ease ${delay}s, transform 0.9s ease ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function StoryTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #E5E5E5',
            padding: '10px 14px',
            fontFamily: FONTS.mono,
            fontSize: '11px',
            lineHeight: 1.5,
        }}>
            <div style={{ color: '#A3A3A3', marginBottom: 2 }}>{label}</div>
            <div style={{ color: '#0A0A0A', fontWeight: 600 }}>{fmtNum(payload[0].value)}</div>
        </div>
    );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ n, title }) {
    return (
        <div className="flex items-baseline gap-5 mb-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 shrink-0">
                {String(n).padStart(2, '0')}
            </span>
            <span
                className="font-headline leading-none text-neutral-900"
                style={{ fontSize: 'clamp(36px, 5vw, 52px)' }}
            >
                {title}
            </span>
        </div>
    );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
    return <div className="h-px bg-neutral-200 mb-16" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryPage({ aggregates, processedData, conversationTitle, onBack }) {
    const data = useMemo(
        () => deriveStoryData(aggregates, processedData),
        [aggregates, processedData]
    );

    // Scroll to top on mount
    useEffect(() => { window.scrollTo(0, 0); }, []);

    // Transparent nav that gains background on scroll
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    if (!data) return null;

    const {
        totalMessages, totalReactions, allUsers, allYears,
        startDate, endDate, avgPerMonth,
        timelineData, yearTicks, peakMonth, peakYear, peakYearCount,
        users, topUser, hourlyData, dailyData, peakHour, peakDay, topWords,
    } = data;

    const yearsLabel = allYears.length > 1
        ? `${Math.min(...allYears)}–${Math.max(...allYears)}`
        : allYears[0] ?? '';

    const isGroup = allUsers.length > 2;

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 font-display">

            {/* ── Navigation bar ─────────────────────────────────────────── */}
            <nav
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-6 lg:px-12 transition-all duration-300"
                style={{
                    background: scrolled ? '#FAFAFA' : 'transparent',
                    borderBottom: scrolled ? '1px solid #E5E5E5' : '1px solid transparent',
                }}
            >
                <button
                    onClick={onBack}
                    className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-2"
                >
                    ← MSGS
                </button>
                <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-neutral-400 truncate max-w-[200px] lg:max-w-none">
                    {conversationTitle || 'Story'}
                </span>
            </nav>

            {/* ── Hero ────────────────────────────────────────────────────── */}
            <section className="relative min-h-screen flex flex-col justify-center pt-14 px-6 lg:px-12">
                <div className="max-w-[900px] mx-auto w-full">

                    {/* Date range */}
                    {(startDate || endDate) && (
                        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-400 mb-8">
                            {[startDate, endDate].filter(Boolean).join(' — ')}
                        </div>
                    )}

                    {/* Big number */}
                    <div
                        className="font-headline leading-none text-neutral-900"
                        style={{ fontSize: 'clamp(72px, 16vw, 180px)' }}
                    >
                        {fmtNum(totalMessages)}
                    </div>

                    {/* Label */}
                    <div className="font-display text-xl lg:text-2xl text-neutral-500 mt-4 mb-10 font-light tracking-tight">
                        messages exchanged
                    </div>

                    {/* Rule */}
                    <div className="h-px bg-neutral-200 mb-8 max-w-[480px]" />

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-400">
                        {allUsers.length > 0 && (
                            <span>{allUsers.length} {allUsers.length === 1 ? 'participant' : 'participants'}</span>
                        )}
                        {yearsLabel && <span>{yearsLabel}</span>}
                        {totalReactions > 0 && <span>{fmtNum(totalReactions)} reactions</span>}
                        {avgPerMonth > 0 && <span>{fmtNum(avgPerMonth)}/month avg</span>}
                    </div>
                </div>

                {/* Scroll hint */}
                <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                    <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-neutral-300">
                        scroll ↓
                    </span>
                </div>
            </section>

            {/* ── Sections ────────────────────────────────────────────────── */}
            <div className="max-w-[900px] mx-auto px-6 lg:px-12 pb-40">

                {/* ── 01 VOLUME ─────────────────────────────────────────── */}
                {timelineData.length > 0 && (
                    <FadeIn>
                        <Divider />
                        <section>
                            <SectionHeader n={1} title="Volume" />

                            <p className="font-display text-[17px] lg:text-lg text-neutral-500 max-w-[560px] mb-12 leading-relaxed">
                                {fmtNum(totalMessages)} messages
                                {startDate ? ` from ${startDate}` : ''}
                                {endDate ? ` to ${endDate}` : ''}.
                                {peakYear && ` ${peakYear} was the most active year — ${fmtNum(peakYearCount)} messages, averaging ${fmtNum(Math.round(peakYearCount / 12))} per month.`}
                            </p>

                            {/* Timeline chart */}
                            <div className="w-full h-[200px] lg:h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={timelineData}
                                        margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="storyFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.12} />
                                                <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="month"
                                            ticks={yearTicks}
                                            tickFormatter={v => v.split('-')[0]}
                                            tick={{ fontSize: 11, fill: '#A3A3A3', fontFamily: FONTS.mono }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis hide />
                                        <Tooltip content={<StoryTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="messages"
                                            stroke={COLORS.accent}
                                            strokeWidth={1.5}
                                            fill="url(#storyFill)"
                                            dot={false}
                                            activeDot={{ r: 3, fill: COLORS.accent, stroke: 'none' }}
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Peak callout */}
                            {peakMonth && (
                                <div className="mt-6 pt-5 border-t border-neutral-200 flex items-center gap-4">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400">Peak</span>
                                    <span className="font-mono text-[12px] text-neutral-900">
                                        {peakMonth.label} — {fmtNum(peakMonth.messages)} messages
                                    </span>
                                </div>
                            )}
                        </section>
                    </FadeIn>
                )}

                {/* ── 02 WHEN ───────────────────────────────────────────── */}
                <FadeIn>
                    <Divider />
                    <section>
                        <SectionHeader n={2} title="When" />

                        <p className="font-display text-[17px] lg:text-lg text-neutral-500 max-w-[560px] mb-12 leading-relaxed">
                            {peakDay && `Most active on ${peakDay.day}s.`}
                            {peakHour && ` The conversation peaked at ${peakHour.label}.`}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
                            {/* Day of week */}
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-5">
                                    Day of week
                                </div>
                                <div className="h-[140px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={dailyData}
                                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                            barCategoryGap="22%"
                                        >
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fontSize: 11, fill: '#A3A3A3', fontFamily: FONTS.mono }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis hide />
                                            <Tooltip content={<StoryTooltip />} />
                                            <Bar dataKey="messages" radius={0} isAnimationActive={false}>
                                                {dailyData.map((entry, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={entry.day === peakDay?.day ? COLORS.accent : '#E5E5E5'}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Hour of day */}
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 mb-5">
                                    Hour of day
                                </div>
                                <div className="h-[140px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={hourlyData}
                                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                            barCategoryGap="8%"
                                        >
                                            <XAxis
                                                dataKey="label"
                                                interval={5}
                                                tick={{ fontSize: 10, fill: '#A3A3A3', fontFamily: FONTS.mono }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis hide />
                                            <Tooltip content={<StoryTooltip />} />
                                            <Bar dataKey="messages" radius={0} isAnimationActive={false}>
                                                {hourlyData.map((entry, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={entry.label === peakHour?.label ? COLORS.accent : '#E5E5E5'}
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </section>
                </FadeIn>

                {/* ── 03 THE PEOPLE ─────────────────────────────────────── */}
                {users.length > 0 && (
                    <FadeIn>
                        <Divider />
                        <section>
                            <SectionHeader n={3} title={isGroup ? 'The Group' : 'The People'} />

                            <p className="font-display text-[17px] lg:text-lg text-neutral-500 max-w-[560px] mb-12 leading-relaxed">
                                {topUser && `${formatName(topUser.name)} sent the most — ${topUser.pct}% of all messages.`}
                                {users.length > 1 && users[users.length - 1].name !== topUser?.name && (
                                    ` ${formatName(users[users.length - 1].name)} the least, at ${users[users.length - 1].pct}%.`
                                )}
                            </p>

                            {/* User bar list */}
                            <div className="space-y-5">
                                {users.map((user, i) => (
                                    <div key={user.name} className="flex items-center gap-4 lg:gap-5">
                                        <span className="font-mono text-[10px] text-neutral-400 w-4 shrink-0 tabular-nums">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-neutral-800 w-24 lg:w-32 shrink-0 truncate">
                                            {formatName(user.name)}
                                        </span>
                                        <div className="flex-1 relative h-[4px] bg-neutral-100">
                                            <div
                                                style={{
                                                    width: `${user.pct}%`,
                                                    height: '100%',
                                                    background: i === 0 ? COLORS.accent : '#262626',
                                                }}
                                            />
                                        </div>
                                        <div className="shrink-0 text-right w-28 lg:w-36">
                                            <span className="font-mono text-[12px] text-neutral-900 tabular-nums">
                                                {fmtNum(user.messages)}
                                            </span>
                                            <span className="font-mono text-[11px] text-neutral-400 ml-2 tabular-nums">
                                                {user.pct}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </FadeIn>
                )}

                {/* ── 04 LANGUAGE ───────────────────────────────────────── */}
                {topWords.length > 0 && (
                    <FadeIn>
                        <Divider />
                        <section>
                            <SectionHeader n={4} title="Language" />

                            <p className="font-display text-[17px] lg:text-lg text-neutral-500 max-w-[560px] mb-12 leading-relaxed">
                                The most used words across all messages.
                            </p>

                            <div>
                                {topWords.map((w, i) => (
                                    <div
                                        key={w.word}
                                        className="flex items-center justify-between py-3.5 border-b border-neutral-100"
                                    >
                                        <div className="flex items-center gap-6">
                                            <span className="font-mono text-[10px] text-neutral-400 w-5 tabular-nums">
                                                {String(i + 1).padStart(2, '0')}
                                            </span>
                                            <span className="font-display text-[15px] text-neutral-900">
                                                {w.word}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[12px] text-neutral-400 tabular-nums">
                                            {fmtNum(w.count)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </FadeIn>
                )}

                {/* ── Footer ────────────────────────────────────────────── */}
                <FadeIn>
                    <div className="pt-20 border-t border-neutral-200 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-300">
                            MSGS
                        </span>
                        <button
                            onClick={onBack}
                            className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            ← Back
                        </button>
                    </div>
                </FadeIn>

            </div>
        </div>
    );
}
