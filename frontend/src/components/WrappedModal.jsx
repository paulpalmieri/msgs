import React, { useState, useMemo, useEffect } from 'react';
import { aggregatesToProcessed } from '../utils/aggregatesToProcessed';

/**
 * Wrapped Modal
 * =============
 * Modal for selecting year and user before starting the Wrapped experience.
 * Integrated look and feel with the main application.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {function} props.onClose - Callback when modal is closed
 * @param {function} props.onStart - Callback when starting wrapped (year, user, yearData, groupTitle)
 * @param {Object} props.aggregates - Full aggregates data
 * @param {string} props.groupTitle - Title of the conversation/group
 */
export default function WrappedModal({ isOpen, onClose, onStart, aggregates, groupTitle }) {
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [yearData, setYearData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Extract available years from aggregates
    const years = useMemo(() => {
        if (!aggregates?.global?.all_years) return [];
        return [...aggregates.global.all_years].sort((a, b) => b - a);
    }, [aggregates]);

    // Users for selected year (sorted by message count)
    const users = useMemo(() => {
        if (!yearData) return [];
        return Object.keys(yearData.users).sort((a, b) => 
            yearData.users[b].messages - yearData.users[a].messages
        );
    }, [yearData]);

    // Filter users by search
    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const searchLower = userSearch.toLowerCase();
        return users.filter(user => user.toLowerCase().includes(searchLower));
    }, [users, userSearch]);

    // Auto-select most recent year on mount
    useEffect(() => {
        if (isOpen && years.length > 0 && !selectedYear) {
            handleYearSelect(years[0]);
        }
    }, [isOpen, years]); // eslint-disable-line

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedYear(null);
            setSelectedUser(null);
            setYearData(null);
            setUserSearch('');
            setIsTransitioning(false);
        }
    }, [isOpen]);

    // Filter aggregates by year
    const filterAggregatesByYear = (agg, year) => {
        const yearStr = String(year);
        
        // Filter monthly data to only include months from this year
        const filteredMonthly = {};
        Object.entries(agg.monthly || {}).forEach(([monthKey, data]) => {
            if (monthKey.startsWith(yearStr)) {
                filteredMonthly[monthKey] = data;
            }
        });

        // Filter user_monthly to only include months from this year
        const filteredUserMonthly = {};
        Object.entries(agg.user_monthly || {}).forEach(([user, months]) => {
            const userMonths = {};
            Object.entries(months).forEach(([monthKey, data]) => {
                if (monthKey.startsWith(yearStr)) {
                    userMonths[monthKey] = data;
                }
            });
            if (Object.keys(userMonths).length > 0) {
                filteredUserMonthly[user] = userMonths;
            }
        });

        // Use year-specific reaction network if available
        const yearlyReactionNetwork = agg.reaction_network_yearly?.[yearStr] || agg.reaction_network || {};

        // Get yearly data
        const yearlyData = agg.yearly?.[yearStr] || {};

        // Filter daily data to only include days from this year
        const filteredDaily = {};
        Object.entries(agg.daily || {}).forEach(([dateKey, data]) => {
            if (dateKey.startsWith(yearStr)) {
                filteredDaily[dateKey] = data;
            }
        });

        // Calculate year-specific user totals from user_monthly
        const yearUserTotals = {};
        Object.entries(filteredUserMonthly).forEach(([user, months]) => {
            const totals = {
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
                active_days: 0,
            };
            Object.values(months).forEach(m => {
                totals.messages += m.messages || 0;
                totals.reactions_received += m.reactions_received || 0;
                totals.reactions_given += m.reactions_given || 0;
                totals.initiations += m.initiations || 0;
                totals.total_chars += m.total_chars || 0;
                totals.total_words += m.total_words || 0;
                totals.links_shared += m.links_shared || 0;
                if (m.media) {
                    totals.media.photos += m.media.photos || 0;
                    totals.media.videos += m.media.videos || 0;
                    totals.media.audio += m.media.audio || 0;
                    totals.media.gifs += m.media.gifs || 0;
                    totals.media.files += m.media.files || 0;
                }
            });
            // Get additional stats from full user_totals if available
            if (agg.user_totals?.[user]) {
                totals.active_days = agg.user_totals[user].active_days || 0;
                totals.max_streak_days = agg.user_totals[user].max_streak_days || 0;
                totals.avg_response_time_ms = agg.user_totals[user].avg_response_time_ms || 0;
                totals.avg_message_length = totals.messages > 0 ? Math.round(totals.total_chars / totals.messages) : 0;
            }
            yearUserTotals[user] = totals;
        });

        // Calculate total messages for the year
        const totalMessages = Object.values(filteredMonthly).reduce((sum, m) => sum + (m.messages || 0), 0);
        const totalReactions = Object.values(filteredMonthly).reduce((sum, m) => sum + (m.reactions || 0), 0);

        return {
            schema_version: agg.schema_version,
            monthly: filteredMonthly,
            user_monthly: filteredUserMonthly,
            yearly: { [yearStr]: yearlyData },
            daily: filteredDaily,
            weekly: agg.weekly || {},
            yearly_daily: { [yearStr]: filteredDaily },
            user_totals: yearUserTotals,
            user_content_types: agg.user_content_types || {},
            reaction_network: yearlyReactionNetwork,
            reaction_network_yearly: { [yearStr]: yearlyReactionNetwork },
            content_types: yearlyData.content_types || agg.content_types || {},
            top_domains: agg.top_domains || [],
            top_content_emojis: agg.top_content_emojis || [],
            top_words: agg.top_words || [],
            sessions: agg.sessions || {},
            streaks: agg.streaks || {},
            gaps: agg.gaps || {},
            calls: agg.calls || {},
            bumps: agg.bumps || {},
            unsent: agg.unsent || {},
            stickers: agg.stickers || {},
            timezone: agg.timezone || {},
            global: {
                total_messages: totalMessages,
                total_reactions: totalReactions,
                total_words: yearlyData.total_words || 0,
                first_date_ms: agg.global?.first_date_ms,
                last_date_ms: agg.global?.last_date_ms,
                all_users: Object.keys(yearUserTotals),
                all_years: [year],
                user_display_names: agg.global?.user_display_names || {},
            },
        };
    };

    // Handle year selection
    const handleYearSelect = async (year) => {
        setSelectedYear(year);
        setSelectedUser(null);
        setUserSearch('');
        setLoading(true);
        
        // Filter aggregates by year and convert to processed format
        setTimeout(() => {
            const filteredAggregates = filterAggregatesByYear(aggregates, year);
            const processed = aggregatesToProcessed(filteredAggregates);
            setYearData(processed);
            setLoading(false);
        }, 10);
    };

    // Handle start
    const handleStart = () => {
        if (!selectedYear || !selectedUser || !yearData) return;
        setIsTransitioning(true);
        
        // Delay to show transition animation
        setTimeout(() => {
            onStart(selectedYear, selectedUser, yearData, groupTitle);
        }, 400);
    };

    // Format display name
    const formatDisplayName = (name) => {
        const parts = name.split(' ');
        const firstName = parts[0];
        const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : '';
        return firstName + lastInitial;
    };

    if (!isOpen) return null;

    return (
        <div className={`wrapped-modal-wrapper fixed inset-0 z-50 flex items-center justify-center ${isTransitioning ? 'wrapped-modal-transitioning' : ''}`}>
            {/* Backdrop - hidden on mobile */}
            <div
                className={`wrapped-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isTransitioning ? 'opacity-100' : 'opacity-100'}`}
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`wrapped-modal-container relative z-10 w-full max-w-lg mx-4 ${isTransitioning ? 'wrapped-modal-expand' : 'wrapped-modal-enter'}`}>
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors z-20"
                    aria-label="Close"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="wrapped-modal-label mb-2">MSGS</div>
                    <h2 className="wrapped-modal-title">Wrapped</h2>
                    <p className="wrapped-modal-subtitle mt-3">Your year in conversation</p>
                </div>

                {/* Year Selection */}
                <div className="mb-8">
                    <div className="wrapped-modal-section-label mb-3">Select Year</div>
                    <div className="flex flex-wrap justify-start gap-2">
                        {years.map((year) => (
                            <button
                                key={year}
                                onClick={() => handleYearSelect(year)}
                                className={`wrapped-modal-year-btn ${selectedYear === year ? 'active' : ''}`}
                            >
                                {year}
                            </button>
                        ))}
                    </div>
                </div>

                {/* User Selection */}
                {selectedYear && (
                    <div className="wrapped-modal-users-section">
                        <div className="wrapped-modal-section-label mb-3">Who Are You?</div>
                        
                        {/* Search */}
                        <div className="relative mb-4">
                            <input
                                type="text"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="Search name..."
                                className="wrapped-modal-search"
                            />
                            {userSearch && (
                                <button
                                    onClick={() => setUserSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* User List */}
                        <div className="wrapped-modal-user-list">
                            {filteredUsers.length > 0 ? (
                                [...filteredUsers].sort((a, b) => a.localeCompare(b)).map((user) => (
                                    <button
                                        key={user}
                                        onClick={() => setSelectedUser(user)}
                                        className={`wrapped-modal-user-btn ${selectedUser === user ? 'active' : ''}`}
                                    >
                                        <span className="truncate">{formatDisplayName(user)}</span>
                                        {selectedUser === user && (
                                            <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-8 text-neutral-500 font-mono text-sm">
                                    No matches found
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Start Button */}
                <div className="mt-8 pt-6 border-t border-white/10">
                    <button
                        onClick={handleStart}
                        disabled={!selectedYear || !selectedUser || loading}
                        className={`wrapped-modal-start-btn ${(!selectedYear || !selectedUser || loading) ? 'disabled' : ''}`}
                    >
                        <span>Start Your Wrapped</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>
                    
                    {selectedUser && (
                        <p className="text-center mt-3 font-mono text-[11px] text-neutral-500 uppercase tracking-wider">
                            {selectedYear} • {formatDisplayName(selectedUser)}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

