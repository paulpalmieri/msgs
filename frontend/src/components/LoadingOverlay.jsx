import React, { useState, useEffect, useCallback } from 'react';

// Fun loading messages that feel human
const LOADING_MESSAGES = [
    "Reading your memories...",
    "Counting all those late-night chats...",
    "Discovering inside jokes...",
    "Finding who sends the most messages...",
    "Analyzing your emoji habits...",
    "Uncovering conversation patterns...",
    "Building your story...",
    "Almost there...",
];

// Phase-specific messages
const PHASE_MESSAGES = {
    scanning: "Discovering your conversations",
    loading: "Loading messages",
    processing: "Analyzing patterns",
    complete: "Ready!",
};

/**
 * Animated dots component
 */
function AnimatedDots() {
    const [dots, setDots] = useState('');
    
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 400);
        return () => clearInterval(interval);
    }, []);
    
    return <span className="inline-block w-6 text-left">{dots}</span>;
}

/**
 * Pulse animation for numbers
 */
function PulseNumber({ value, label }) {
    const [isNew, setIsNew] = useState(false);
    const prevValue = React.useRef(value);
    
    useEffect(() => {
        if (value !== prevValue.current) {
            setIsNew(true);
            prevValue.current = value;
            const timer = setTimeout(() => setIsNew(false), 300);
            return () => clearTimeout(timer);
        }
    }, [value]);
    
    return (
        <div className="text-center">
            <div className={`font-display text-2xl font-semibold transition-all duration-300 ${isNew ? 'scale-110 text-accent' : 'text-neutral-900'}`}>
                {formatNumber(value)}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mt-1">
                {label}
            </div>
        </div>
    );
}

/**
 * Main Loading Overlay - Full screen with rich feedback
 */
export function LoadingOverlay({ 
    show, 
    progress = 0, 
    phase = 'loading',
    stats = null, // { messages, participants, conversations }
    currentItem = null // Current conversation/file being processed
}) {
    const [messageIndex, setMessageIndex] = useState(0);
    
    // Cycle through fun messages
    useEffect(() => {
        if (!show) return;
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [show]);
    
    if (!show) return null;
    
    const phaseMessage = PHASE_MESSAGES[phase] || PHASE_MESSAGES.loading;
    
    return (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
            <div className="flex flex-col items-center max-w-md w-full px-8">
                {/* MSGS branding with progress fill */}
                <div className="lore-progress-text mb-8" style={{ '--progress': `${progress}%` }}>
                    MSGS
                </div>
                
                {/* Progress bar */}
                <div className="w-full max-w-xs mb-6">
                    <div className="h-1 bg-neutral-100 overflow-hidden rounded-full">
                        <div 
                            className="h-full bg-gradient-to-r from-accent to-accent/70 transition-all duration-500 ease-out rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2">
                        <span className="font-mono text-[11px] text-neutral-400">
                            {phaseMessage}<AnimatedDots />
                        </span>
                        <span className="font-mono text-[11px] text-neutral-300">
                            {progress}%
                        </span>
                    </div>
                </div>
                
                {/* Live stats - show what we're discovering */}
                {stats && (stats.messages > 0 || stats.participants > 0) && (
                    <div className="flex gap-8 mb-6 py-4 px-6 bg-neutral-50 rounded">
                        {stats.messages > 0 && (
                            <PulseNumber value={stats.messages} label="Messages" />
                        )}
                        {stats.participants > 0 && (
                            <PulseNumber value={stats.participants} label="Participants" />
                        )}
                        {stats.conversations > 0 && (
                            <PulseNumber value={stats.conversations} label="Conversations" />
                        )}
                    </div>
                )}
                
                {/* Current item being processed */}
                {currentItem && (
                    <div className="mb-4 text-center">
                        <p className="font-mono text-[12px] text-neutral-400 truncate max-w-xs">
                            {currentItem}
                        </p>
                    </div>
                )}
                
                {/* Rotating fun messages */}
                <div className="h-8 flex items-center justify-center overflow-hidden">
                    <p 
                        key={messageIndex}
                        className="font-mono text-[12px] text-neutral-300 text-center animate-fade-in"
                    >
                        {LOADING_MESSAGES[messageIndex]}
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Parsing Progress Overlay - Shows when parsing multiple conversations
 */
export function ParsingOverlay({
    show,
    current,
    total,
    currentName,
    stats = null, // Running stats as we discover them
}) {
    const [revealedStats, setRevealedStats] = useState([]);
    
    // Add fun stat reveals as parsing progresses
    useEffect(() => {
        if (!stats) return;
        
        const newStats = [];
        if (stats.totalMessages > 10000 && !revealedStats.find(s => s.type === 'messages')) {
            newStats.push({ type: 'messages', text: `${formatNumber(stats.totalMessages)}+ messages discovered!` });
        }
        if (stats.oldestYear && !revealedStats.find(s => s.type === 'oldest')) {
            newStats.push({ type: 'oldest', text: `History dating back to ${stats.oldestYear}` });
        }
        if (stats.topConversation && !revealedStats.find(s => s.type === 'top')) {
            newStats.push({ type: 'top', text: `Biggest chat: ${stats.topConversation}` });
        }
        
        if (newStats.length > 0) {
            setRevealedStats(prev => [...prev, ...newStats].slice(-3));
        }
    }, [stats]);
    
    if (!show) return null;
    
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    
    return (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
            <div className="flex flex-col items-center max-w-md w-full px-8">
                {/* MSGS branding */}
                <div 
                    className="select-none mb-8"
                    style={{
                        fontFamily: "'Bebas Neue', 'Space Grotesk', Impact, sans-serif",
                        fontSize: '3.5rem',
                        fontWeight: 400,
                        letterSpacing: '0.08em',
                        lineHeight: 1,
                        color: '#0A0A0A'
                    }}
                >
                    MSGS
                </div>
                
                {/* Progress section */}
                <div className="w-full max-w-xs space-y-4">
                    {/* Progress bar */}
                    <div className="relative">
                        <div className="h-2 bg-neutral-100 overflow-hidden rounded-full">
                            <div 
                                className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                    </div>
                    
                    {/* Progress text */}
                    <div className="text-center">
                        <p className="font-mono text-[13px] text-neutral-600">
                            Parsing conversation <span className="text-accent font-semibold">{current}</span> of <span className="font-semibold">{total}</span>
                        </p>
                        <p className="font-mono text-[12px] text-neutral-400 mt-1 truncate">
                            {currentName}
                        </p>
                    </div>
                </div>
                
                {/* Revealed stats - appear as we discover them */}
                {revealedStats.length > 0 && (
                    <div className="mt-8 space-y-2">
                        {revealedStats.map((stat, i) => (
                            <div 
                                key={stat.type}
                                className="font-mono text-[12px] text-neutral-400 text-center animate-slide-up flex items-center justify-center gap-2"
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <span className="text-accent">—</span>
                                <span>{stat.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                
                {/* Reassurance message */}
                <p className="mt-8 font-mono text-[11px] text-neutral-300 text-center">
                    All processing happens in your browser
                </p>
            </div>
        </div>
    );
}

/**
 * Updating Overlay - Subtle overlay for filter changes
 */
export function UpdatingOverlay({ show, progress = 0, phase = 'processing' }) {
    if (!show) return null;
    
    return (
        <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                {/* Minimal spinner */}
                <div className="relative w-12 h-12">
                    <div className="absolute inset-0 border-2 border-neutral-100 rounded-full" />
                    <div 
                        className="absolute inset-0 border-2 border-transparent border-t-accent rounded-full animate-spin"
                        style={{ animationDuration: '0.8s' }}
                    />
                </div>
                <div className="font-mono text-[12px] uppercase tracking-widest text-neutral-500">
                    Updating<AnimatedDots />
                </div>
            </div>
        </div>
    );
}

/**
 * Conversation Selection Card - Shows preview of what was found
 */
export function ConversationCard({ conversation, onClick, isFirst }) {
    const years = conversation.aggregates?.global?.all_years || [];
    const participants = conversation.aggregates?.global?.all_users?.length || conversation.participants?.length || 0;
    const messages = conversation.totalMessages || 0;
    const yearRange = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : null;
    
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-5 transition-all duration-200 group relative ${
                isFirst 
                    ? 'bg-accent/5 hover:bg-accent/10 border-l-2 border-accent' 
                    : 'bg-neutral-50 hover:bg-neutral-100'
            }`}
        >
            {isFirst && (
                <span className="absolute top-2 right-3 font-mono text-[9px] uppercase tracking-widest text-accent">
                    Largest
                </span>
            )}
            
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className={`font-display text-sm font-semibold truncate transition-colors ${
                        isFirst ? 'text-accent' : 'text-neutral-900 group-hover:text-accent'
                    }`}>
                        {conversation.title}
                    </h3>
                    
                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-2">
                        <span className="font-mono text-[11px] text-neutral-500">
                            {formatNumber(messages)} messages
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span className="font-mono text-[11px] text-neutral-500">
                            {participants} people
                        </span>
                        {yearRange && (
                            <>
                                <span className="text-neutral-300">·</span>
                                <span className="font-mono text-[11px] text-neutral-400">
                                    {yearRange}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                
                <div className={`font-mono text-lg transition-all duration-200 ${
                    isFirst 
                        ? 'text-accent translate-x-0' 
                        : 'text-neutral-300 group-hover:text-accent group-hover:translate-x-1'
                }`}>
                    →
                </div>
            </div>
        </button>
    );
}

/**
 * Completion celebration - Brief moment of delight
 */
export function CompletionCelebration({ show, conversationCount, totalMessages }) {
    if (!show) return null;
    
    return (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center animate-fade-in">
            <div className="text-center">
                <div className="mb-4">
                    <svg className="w-12 h-12 mx-auto text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="font-display text-2xl font-semibold mb-2">All Done</h2>
                <p className="font-mono text-[13px] text-neutral-500">
                    Found {formatNumber(totalMessages)} messages across {conversationCount} conversations
                </p>
            </div>
        </div>
    );
}

// Utility function
function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}K`;
    return num.toLocaleString();
}

// Add CSS animations to your stylesheet
export const loadingStyles = `
@keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
}

.animate-slide-up {
    animation: slide-up 0.4s ease-out forwards;
}
`;
