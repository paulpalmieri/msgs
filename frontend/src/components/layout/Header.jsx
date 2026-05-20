import React, { useState, useRef, useEffect } from 'react';

/**
 * Format message count for display (e.g., "12.5K", "1.2M")
 */
function formatMessageCount(count) {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M msgs`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K msgs`;
    }
    return `${count} msgs`;
}

/**
 * Header Component
 * ================
 * Minimal navbar with logo, conversation selector, menu button, and wrapped button.
 * Filters have been moved to content area for cleaner UX.
 *
 * @param {Object} props
 * @param {Object} props.conversationProps - Props for conversation selector
 * @param {function} props.onMenuClick - Callback when menu button clicked
 * @param {function} props.onUploadClick - Callback when upload/demo badge clicked
 * @param {function} props.onWrappedClick - Callback when wrapped button clicked
 * @param {boolean} props.isDemo - Whether viewing demo data
 * @param {string} props.activeView - Current active view ('analytics' or 'content')
 * @param {function} props.onAnalyticsClick - Callback to switch to analytics view
 * @param {function} props.onContentClick - Callback to switch to content view
 */
export default function Header({
    conversationProps,
    onMenuClick,
    onUploadClick,
    onWrappedClick,
    isDemo,
    activeView = 'analytics',
    onAnalyticsClick,
    onContentClick,
}) {
    const [showConversationDropdown, setShowConversationDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const { conversations, activeConversation, onConversationChange } = conversationProps || {};

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowConversationDropdown(false);
            }
        };
        
        if (showConversationDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showConversationDropdown]);

    const handleConversationSelect = (conv) => {
        setShowConversationDropdown(false);
        if (onConversationChange && conv.id !== activeConversation?.id) {
            onConversationChange(conv);
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-[#FAFAFA]">
            <div className="max-w-[1400px] mx-auto h-16 flex items-center justify-between px-6 lg:px-8">
                {/* LEFT: Logo + Conversation Selector */}
                <div className="flex items-center gap-2 md:gap-3">
                    {/* Logo */}
                    <h1 
                        onClick={() => window.location.href = '/'}
                        className="font-headline text-2xl md:text-3xl font-normal tracking-wide uppercase cursor-pointer hover:text-accent transition-colors leading-none flex items-center"
                    >
                        MSGS
                    </h1>

                    {/* Conversation Selector (only if not in demo or has multiple conversations) */}
                    {conversations && conversations.length > 0 && !isDemo && (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setShowConversationDropdown(!showConversationDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 transition-colors"
                            >
                                <span className="font-mono text-[12px] uppercase tracking-wide text-neutral-600 max-w-[100px] md:max-w-[200px] truncate">
                                    {activeConversation?.title || 'Select conversation'}
                                </span>
                                <svg 
                                    className={`w-3 h-3 text-neutral-400 transition-transform ${showConversationDropdown ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown */}
                            {showConversationDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white shadow-lg border border-neutral-100 z-50">
                                    {conversations.map((conv) => {
                                        const messageCount = conv.totalMessages || 0;
                                        
                                        return (
                                            <button
                                                key={conv.id}
                                                onClick={() => handleConversationSelect(conv)}
                                                className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-b-0 ${
                                                    conv.id === activeConversation?.id ? 'bg-accent/5' : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="font-mono text-[12px] font-medium text-neutral-900 truncate flex-1">
                                                        {conv.title}
                                                    </div>
                                                    {messageCount > 0 && (
                                                        <div className="font-mono text-[12px] text-neutral-400 whitespace-nowrap">
                                                            {formatMessageCount(messageCount)}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-mono text-[12px] text-neutral-400 mt-0.5">
                                                    {conv.participants?.length || 0} participants
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Demo badge - clickable to upload */}
                    {isDemo && (
                        <button
                            onClick={onUploadClick}
                            className="px-2 py-1 bg-accent/10 text-accent font-mono text-[12px] uppercase tracking-widest hover:bg-accent/20 transition-colors cursor-pointer"
                        >
                            Demo
                        </button>
                    )}

                    {/* View Navigation Tabs */}
                    <div className="hidden md:flex items-center ml-4 border-l border-neutral-200 pl-4">
                        <button
                            onClick={onAnalyticsClick}
                            className={`px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide transition-colors ${
                                activeView === 'analytics'
                                    ? 'text-neutral-900 bg-neutral-100'
                                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                            }`}
                        >
                            Analytics
                        </button>
                        <button
                            onClick={onContentClick}
                            className={`px-3 py-1.5 font-mono text-[12px] uppercase tracking-wide transition-colors ${
                                activeView === 'content'
                                    ? 'text-neutral-900 bg-neutral-100'
                                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                            }`}
                        >
                            Content
                        </button>
                    </div>
                </div>

                {/* RIGHT: Wrapped + Menu buttons */}
                <div className="flex items-center gap-2">
                    {/* Wrapped button - Primary CTA */}
                    <button
                        onClick={onWrappedClick}
                        className="wrapped-nav-btn flex items-center justify-center h-8 font-mono text-[12px] md:text-[12px] uppercase tracking-widest px-3 md:px-4 bg-accent text-white font-semibold hover:bg-neutral-900 transition-colors leading-none"
                    >
                        Wrapped
                    </button>

                    {/* Menu button */}
                    <button
                        onClick={onMenuClick}
                        className="flex items-center justify-center h-8 w-8 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                        aria-label="Open menu"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    );
}
