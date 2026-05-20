import React, { useState } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';

/**
 * Top Reacted Messages Section
 * Shows the most popular messages ranked by reaction count
 * Design: Minimal, screenshot-worthy cards with accent highlights
 * Note: messages are pre-filtered by user/year in filterAggregates
 */
export default function TopReactedSection({
    messages = [],
    selectedYears = [],
    selectedUsers = [],
    onJumpToMessage = () => { }
}) {
    const [displayCount, setDisplayCount] = useState(10);

    if (!messages || messages.length === 0) {
        return (
            <section className="mb-14 lg:mb-18">
                <div className="text-center py-12">
                    <p className={STYLES.emptyState}>No messages with reactions found</p>
                </div>
            </section>
        );
    }

    const displayMessages = messages.slice(0, displayCount);
    const hasMore = messages.length > displayCount;

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <section className="mb-14 lg:mb-18">
            {/* Section Header */}
            <div className="mb-8">
                <h3 className={STYLES.sectionTitle}>Top Reacted Messages</h3>
                <p className={STYLES.sectionSubtitle}>{messages.length} messages with 3+ reactions</p>
            </div>

            {/* Display Count Control */}
            <div className="flex items-center gap-2 mb-6">
                <span className={STYLES.dataLabel}>Show</span>
                <div className="flex">
                    {[10, 25, 50].map((count) => (
                        <button
                            key={count}
                            onClick={() => setDisplayCount(count)}
                            className={`${STYLES.modeButton} ${displayCount === count ? STYLES.modeButtonActive : STYLES.modeButtonInactive
                                }`}
                        >
                            {count}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages Grid */}
            <div className="space-y-1">
                {displayMessages.map((msg, idx) => (
                    <div
                        key={`${msg.timestamp_ms}-${idx}`}
                        className="group relative bg-white hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0"
                    >
                        <div className="py-5 px-4">
                            {/* Rank & Reaction Count */}
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-8 text-center">
                                    <span className={idx < 3 ? STYLES.rankAccent : STYLES.rank}>
                                        {idx + 1}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {/* Sender & Date */}
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className={STYLES.userNameSmall}>
                                            {formatName(msg.sender)}
                                        </span>
                                        <span className="font-mono text-[11px] text-neutral-400">
                                            {formatDate(msg.timestamp_ms)}
                                        </span>
                                    </div>

                                    {/* Message Content */}
                                    <p className="font-display text-[15px] text-neutral-900 leading-relaxed mb-3 break-words">
                                        {msg.content || (
                                            <span className="text-neutral-400 italic">[Media/Attachment]</span>
                                        )}
                                    </p>

                                    {/* Reactions */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                            {Object.entries(msg.reactions || {})
                                                .sort((a, b) => b[1] - a[1])
                                                .slice(0, 6)
                                                .map(([emoji, count]) => (
                                                    <span
                                                        key={emoji}
                                                        className="inline-flex items-center px-1.5 py-0.5 bg-neutral-100"
                                                    >
                                                        <span className="text-base">{emoji}</span>
                                                        {count > 1 && (
                                                            <span className="font-mono text-[11px] text-neutral-500 ml-0.5">
                                                                {count}
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Total Reactions */}
                                <div className="flex-shrink-0 text-right">
                                    <span className="font-mono text-xl font-semibold text-accent tabular-nums">
                                        {msg.reaction_count}
                                    </span>
                                    <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                                        reactions
                                    </div>
                                    <button
                                        onClick={() => onJumpToMessage(msg.id)}
                                        className="mt-4 px-3 py-1 bg-neutral-900 text-white font-mono text-[10px] uppercase tracking-wider hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        Jump
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Load More */}
            {hasMore && (
                <button
                    onClick={() => setDisplayCount(prev => Math.min(prev + 25, messages.length))}
                    className="w-full mt-6 py-3 font-mono text-[12px] uppercase tracking-widest text-neutral-500 hover:text-accent hover:bg-neutral-50 transition-colors"
                >
                    Show more ({messages.length - displayCount} remaining)
                </button>
            )}
        </section>
    );
}
