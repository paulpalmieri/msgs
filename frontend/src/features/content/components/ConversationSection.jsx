import React, { useState, useMemo, useRef, useEffect } from 'react';
import { STYLES, COLORS, formatName } from '../../../design';
import { format } from 'date-fns';

/**
 * Conversation Section
 * ====================
 * Renders the full conversation history with filtering.
 * Features a "Jump to Start" button and pagination for performance.
 */
export default function ConversationSection({
    messageStore = [],
    selectedYears = [],
    selectedUsers = [],
    jumpToMessageId = null
}) {
    const [displayCount, setDisplayCount] = useState(100);
    const [highlightId, setHighlightId] = useState(null);
    const topRef = useRef(null);

    // Filter messages based on global filters
    const filteredMessages = useMemo(() => {
        return messageStore.filter(msg => {
            // Year filter
            if (selectedYears.length > 0) {
                const year = new Date(msg.timestamp_ms).getFullYear();
                if (!selectedYears.includes(year)) return false;
            }

            // User filter
            if (selectedUsers.length > 0) {
                if (!selectedUsers.includes(msg.sender)) return false;
            }

            return true;
        });
    }, [messageStore, selectedYears, selectedUsers]);

    const visibleMessages = useMemo(() => {
        return filteredMessages.slice(0, displayCount);
    }, [filteredMessages, displayCount]);

    // Handle jump to message request
    useEffect(() => {
        if (jumpToMessageId === null) return;

        // Find index in filtered messages
        const index = filteredMessages.findIndex(m => m.id === jumpToMessageId);
        if (index === -1) return;

        // Ensure message is visible
        if (index >= displayCount) {
            setDisplayCount(index + 50);
        }

        // Highlight and scroll after render
        setHighlightId(jumpToMessageId);

        // Use requestAnimationFrame or setTimeout to ensure DOM is updated
        const timer = setTimeout(() => {
            const element = document.getElementById(`msg-${jumpToMessageId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Clear highlight after 2 seconds
                setTimeout(() => setHighlightId(null), 2000);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [jumpToMessageId, filteredMessages, displayCount]);

    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 100);
    };

    const handleJumpToStart = () => {
        setDisplayCount(100);
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (messageStore.length === 0) return null;

    return (
        <section className="mb-14 lg:mb-18">
            <div ref={topRef} />

            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h3 className={STYLES.sectionTitle}>Conversation History</h3>
                    <p className={STYLES.sectionSubtitle}>
                        Browse the complete timeline of your messages
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleJumpToStart}
                        className="px-4 py-2 bg-neutral-900 text-white font-mono text-[11px] uppercase tracking-wider hover:bg-accent transition-colors flex items-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        Jump to Start
                    </button>

                    <div className="px-4 py-2 bg-neutral-100 border border-neutral-200 font-mono text-[11px] text-neutral-500 uppercase tracking-wider">
                        Showing {Math.min(displayCount, filteredMessages.length).toLocaleString()} of {filteredMessages.length.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Conversation Flow */}
            <div className="space-y-1 border-l-2 border-neutral-100 pl-4 lg:pl-8 ml-2 lg:ml-4">
                {visibleMessages.length > 0 ? (
                    visibleMessages.map((msg, idx) => {
                        const date = new Date(msg.timestamp_ms);
                        const isNewDay = idx === 0 ||
                            format(new Date(visibleMessages[idx - 1].timestamp_ms), 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd');

                        return (
                            <React.Fragment key={msg.id}>
                                {isNewDay && (
                                    <div className="pt-8 pb-4 -ml-6 lg:-ml-10 flex items-center gap-4">
                                        <div className="h-[1px] w-4 lg:w-6 bg-neutral-200" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 bg-white px-2">
                                            {format(date, 'MMMM d, yyyy')}
                                        </span>
                                        <div className="h-[1px] flex-1 bg-neutral-50" />
                                    </div>
                                )}

                                <div
                                    id={`msg-${msg.id}`}
                                    className={`group py-1.5 transition-all -ml-4 pl-4 rounded-r-lg ${highlightId === msg.id
                                        ? 'bg-accent/10 border-l-4 border-accent -ml-[18px]'
                                        : 'hover:bg-neutral-50'
                                        }`}
                                >
                                    <div className="flex items-baseline gap-3">
                                        <span className={`flex-shrink-0 w-24 lg:w-32 truncate ${STYLES.userNameSmall}`}>
                                            {formatName(msg.sender)}
                                        </span>

                                        <div className="flex-1 min-w-0">
                                            {msg.content ? (
                                                <p className="font-display text-[15px] leading-relaxed text-neutral-800 break-words">
                                                    {msg.content}
                                                </p>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-200" />
                                                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                                                        {msg.type || 'Media'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <span className="flex-shrink-0 font-mono text-[10px] text-neutral-300 group-hover:text-neutral-500 transition-colors tabular-nums">
                                            {format(date, 'HH:mm')}
                                        </span>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                ) : (
                    <div className="py-20 text-center">
                        <p className={STYLES.emptyState}>No messages match your current filters</p>
                    </div>
                )}
            </div>

            {/* Load More Button */}
            {displayCount < filteredMessages.length && (
                <div className="mt-12 flex justify-center">
                    <button
                        onClick={handleLoadMore}
                        className="group relative px-8 py-4 bg-transparent border-2 border-neutral-900 overflow-hidden transition-all hover:text-white"
                    >
                        <div className="absolute inset-0 w-0 bg-neutral-900 transition-all duration-300 group-hover:w-full" />
                        <span className="relative font-mono text-[12px] font-bold uppercase tracking-widest">
                            Load 100 More Messages
                        </span>
                    </button>
                </div>
            )}

            {displayCount >= filteredMessages.length && filteredMessages.length > 0 && (
                <div className="mt-12 text-center">
                    <p className={STYLES.sectionSubtitle}>
                        You've reached the end of the filtered conversation.
                    </p>
                </div>
            )}
        </section>
    );
}
