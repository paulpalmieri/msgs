import React, { useState, useCallback, useRef, useEffect } from 'react';
import { parseMessengerFolders, parseConversation } from '../utils/parseMessenger';
import { getSessionInfo, formatSessionTimestamp } from '../utils/storage';
import { ConversationCard } from './LoadingOverlay';

/**
 * Welcome Modal
 * =============
 * Shows on first load with options to view demo or upload data.
 * All states remain within a modal overlay for consistent UX.
 * 
 * States: choice → upload → scanned → parsing → celebration → selection
 */

// Privacy tooltip component - hover on desktop, click on mobile
const PrivacyTooltip = ({ isVisible, onClose, anchorRef }) => {
    const tooltipRef = useRef(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isTouchDevice = typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches;
    
    useEffect(() => {
        if (!isVisible || !anchorRef?.current || !tooltipRef.current) return;
        
        const anchor = anchorRef.current.getBoundingClientRect();
        const tooltip = tooltipRef.current.getBoundingClientRect();
        const padding = 16;
        
        // Position above the anchor, centered
        let x = anchor.left + anchor.width / 2 - tooltip.width / 2;
        x = Math.max(padding, Math.min(x, window.innerWidth - tooltip.width - padding));
        const y = anchor.top - tooltip.height - 8;
        
        setPosition({ x, y });
    }, [isVisible, anchorRef]);
    
    if (!isVisible) return null;
    
    return (
        <>
            {/* Backdrop only needed on mobile/touch devices to close on tap outside */}
            {isTouchDevice && (
                <div className="fixed inset-0 z-[99]" onClick={onClose} />
            )}
            <div
                ref={tooltipRef}
                className="fixed z-[100] bg-white shadow-[0_12px_48px_rgba(0,0,0,0.18)] p-4 w-72 animate-fade-in"
                style={{ left: position.x, top: position.y }}
            >
                <div className="flex items-start gap-3 mb-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div>
                        <h4 className="font-display text-sm font-semibold text-neutral-900 mb-1">Your privacy is protected</h4>
                        <p className="font-mono text-[11px] text-neutral-500 leading-relaxed">
                            Everything happens in your browser. Your messages are never uploaded to any server.
                        </p>
                    </div>
                </div>
                <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-mono text-[11px] text-neutral-600">Analyzed entirely in your browser</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-mono text-[11px] text-neutral-600">No data sent to any server</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-mono text-[11px] text-neutral-600">Delete anytime from your browser</span>
                    </div>
                </div>
            </div>
        </>
    );
};


// Detailed step-by-step guide for requesting an export (used in guide mode)
const GUIDE_STEPS = [
    {
        id: 'account-center',
        title: 'Go to Account Center',
        description: 'First, open your Meta Account Center. This works for both Facebook Messenger and Instagram DMs.',
        bullets: [
            'Sign in to your Facebook or Instagram account',
            'Open the Account Center from either platform',
        ],
        links: [
            { label: 'Open Facebook Account Center', url: 'https://accountscenter.facebook.com/info_and_permissions/dyi' },
            { label: 'Open Instagram Account Center', url: 'https://accountscenter.instagram.com/info_and_permissions/dyi' },
        ],
        image: null, // placeholder
        tip: 'Both links lead to the same Meta Account Center',
    },
    {
        id: 'create-export',
        title: 'Start Your Export',
        description: 'Navigate to the download section and create a new export request.',
        bullets: [
            'Click on "Your information and permissions"',
            'Select "Download your information"',
            'Click "Download or transfer information"',
            'Then click "Create new download request"',
        ],
        links: [],
        image: null, // placeholder
        tip: null,
    },
    {
        id: 'choose-profile',
        title: 'Choose Your Profile',
        description: 'Select which account\'s messages you want to export.',
        bullets: [
            'You\'ll see a list of your connected accounts',
            'Select your Facebook account for Messenger chats',
            'Or select your Instagram account for Instagram DMs',
            'Click "Next" to continue',
        ],
        links: [],
        image: null, // placeholder
        tip: 'You can only export one account at a time',
    },
    {
        id: 'export-destination',
        title: 'Export Destination',
        description: 'Choose where your data will be sent.',
        bullets: [
            'Select "Download to device"',
            'This will send a download link to your email',
            'Click "Next" to continue',
        ],
        links: [],
        image: null, // placeholder
        tip: null,
    },
    {
        id: 'configure-settings',
        title: 'Configure Your Export',
        description: 'This is the most important step. Configure these settings carefully:',
        bullets: [],
        subsections: [
            {
                label: '1. Select information',
                content: 'Click to customize. Uncheck everything EXCEPT "Messages" under "Your Facebook activity" (or Instagram equivalent). This keeps the download small and fast.',
            },
            {
                label: '2. Date range',
                content: 'Select "All time" to get your complete chat history, or choose a custom range.',
            },
            {
                label: '3. Format',
                content: 'IMPORTANT: Change from HTML to JSON. This is required for MSGS to work.',
            },
            {
                label: '4. Media quality',
                content: 'Optional: Set to "Low" to reduce download size. Photos/videos aren\'t needed for analytics.',
            },
        ],
        links: [],
        image: '/facebook_confirm_export.png', // actual screenshot
        tip: 'Make sure to select JSON format - HTML won\'t work!',
    },
    {
        id: 'start-export',
        title: 'Start Your Export',
        description: 'Finalize and submit your export request.',
        bullets: [
            'Review your settings one more time',
            'Click "Create files" or "Start export"',
            'You may need to re-enter your password',
            'Confirm the export request',
        ],
        links: [],
        image: null, // placeholder
        tip: 'This only requests the export - the files aren\'t ready yet',
    },
    {
        id: 'whats-next',
        title: 'What Happens Next',
        description: 'Your export is being prepared! Here\'s what to expect:',
        bullets: [
            'Meta will email you when your download is ready (usually 1-3 hours)',
            'Download the ZIP file(s) from the email link',
            'Unzip/extract ALL the downloaded files',
            'Come back here and drop the extracted folders',
        ],
        links: [],
        image: null, // placeholder
        tip: 'Bookmark this page so you can easily come back!',
        isFinal: true,
    },
];

export default function WelcomeModal({ onDemoSelect, onDataLoaded, onResumeSession, onClose, initialMode = 'choice' }) {
    // Mode: 'choice' | 'branch' | 'guide' | 'upload' | 'scanned' | 'parsing' | 'celebration' | 'selection'
    const [mode, setMode] = useState(initialMode);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [sessionChecked, setSessionChecked] = useState(false); // Track if session lookup is complete
    const [isDragging, setIsDragging] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ stage: '', percent: 0, filesFound: 0 });
    const [parseProgress, setParseProgress] = useState({ current: 0, total: 0, name: '' });
    const [runningStats, setRunningStats] = useState(null); // Stats discovered during parsing
    const [scannedConversations, setScannedConversations] = useState(null); // Pre-parsing list
    const [parsedConversations, setParsedConversations] = useState(null);
    const [conversationFiles, setConversationFiles] = useState(null);
    const [error, setError] = useState(null);
    const [showPrivacyTooltip, setShowPrivacyTooltip] = useState(false);
    const [guideStep, setGuideStep] = useState(0); // Current step in export guide (0-indexed)
    
    const fileInputRef = useRef(null);
    const privacyAnchorRef = useRef(null);

    // Check for saved session on mount
    useEffect(() => {
        getSessionInfo().then(info => {
            setSessionInfo(info);
            setSessionChecked(true);
        });
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    // Traverse directory recursively
    const traverseDirectory = async (entry, files, path = '') => {
        if (entry.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            Object.defineProperty(file, 'webkitRelativePath', {
                value: path + file.name,
                writable: false,
            });
            files.push(file);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const entries = await new Promise((resolve) => {
                const results = [];
                const readEntries = () => {
                    reader.readEntries((batch) => {
                        if (batch.length === 0) {
                            resolve(results);
                        } else {
                            results.push(...batch);
                            readEntries();
                        }
                    });
                };
                readEntries();
            });
            
            for (const childEntry of entries) {
                await traverseDirectory(childEntry, files, path + entry.name + '/');
            }
        }
    };

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setError(null);

        const items = e.dataTransfer.items;
        if (!items || items.length === 0) return;

        const allFiles = [];
        const promises = [];

        for (const item of items) {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry?.();
                if (entry) {
                    promises.push(traverseDirectory(entry, allFiles));
                }
            }
        }

        setIsScanning(true);
        setScanProgress({ stage: 'Reading folders', percent: 0, filesFound: 0 });

        try {
            await Promise.all(promises);
            
            if (allFiles.length === 0) {
                setError('No files found. Please drop unpacked Messenger export folders.');
                setIsScanning(false);
                return;
            }
            
            setScanProgress(prev => ({ ...prev, filesFound: allFiles.length }));

            const result = await parseMessengerFolders(allFiles, (stage, percent) => {
                setScanProgress({ stage, percent, filesFound: allFiles.length });
            });

            if (result.conversations.length === 0) {
                setError('No conversations found. Make sure you dropped the unpacked Messenger export folders.');
                setIsScanning(false);
                return;
            }

            setIsScanning(false);
            setConversationFiles(result.conversationFiles);
            setScannedConversations(result.conversations);
            
            // Move to scanned summary mode (user must click Continue)
            setMode('scanned');
        } catch (err) {
            console.error('Failed to scan folders:', err);
            setError(`Failed to scan folders: ${err.message}`);
            setIsScanning(false);
        }
    }, []);

    const handleFileInput = useCallback(async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsScanning(true);
        setError(null);
        setScanProgress({ stage: 'Reading folders', percent: 0, filesFound: files.length });

        try {
            const result = await parseMessengerFolders(files, (stage, percent) => {
                setScanProgress({ stage, percent, filesFound: files.length });
            });

            if (result.conversations.length === 0) {
                setError('No conversations found.');
                setIsScanning(false);
                return;
            }

            setIsScanning(false);
            setConversationFiles(result.conversationFiles);
            setScannedConversations(result.conversations);
            
            // Move to scanned summary mode (user must click Continue)
            setMode('scanned');
        } catch (err) {
            console.error('Failed to scan folders:', err);
            setError(`Failed to scan folders: ${err.message}`);
            setIsScanning(false);
        }
    }, []);

    // Start parsing (called when user clicks Continue)
    const handleStartParsing = useCallback(async () => {
        if (!scannedConversations || !conversationFiles) return;
        
        setMode('parsing');
        setParseProgress({ current: 0, total: scannedConversations.length, name: '' });
        setRunningStats({
            totalMessages: 0,
            oldestYear: null,
            topConversation: null,
            topMessages: 0,
        });
        
        // Sort by estimated size (smallest first) for better counter animation
        const sortedConversations = [...scannedConversations].sort(
            (a, b) => (a.estimatedMessages || 0) - (b.estimatedMessages || 0)
        );
        
        const parsed = [];
        let totalMessages = 0;
        let oldestYear = null;
        let topConversation = null;
        let topMessages = 0;
        
        for (let i = 0; i < sortedConversations.length; i++) {
            const conv = sortedConversations[i];
            setParseProgress({ current: i + 1, total: sortedConversations.length, name: conv.title });
            
            try {
                const result = await parseConversation(conv, conversationFiles, () => {});
                const msgCount = result.aggregates?.global?.total_messages || 0;
                const years = result.aggregates?.global?.all_years || [];
                
                parsed.push({
                    ...conv,
                    totalMessages: msgCount,
                    aggregates: result.aggregates,
                });
                
                // Update running stats
                totalMessages += msgCount;
                
                if (years.length > 0) {
                    const minYear = Math.min(...years);
                    if (!oldestYear || minYear < oldestYear) {
                        oldestYear = minYear;
                    }
                }
                
                if (msgCount > topMessages) {
                    topMessages = msgCount;
                    topConversation = conv.title;
                }
                
                // Update running stats for display
                setRunningStats({
                    totalMessages,
                    oldestYear,
                    topConversation: topMessages > 10000 ? topConversation : null,
                    topMessages,
                });
                
            } catch (err) {
                console.warn(`Failed to parse conversation ${conv.title}:`, err);
            }
        }
        
        if (parsed.length === 0) {
            setError('Failed to parse any conversations.');
            setMode('upload');
            return;
        }
        
        // Sort by message count (largest first)
        parsed.sort((a, b) => (b.totalMessages || 0) - (a.totalMessages || 0));
        setParsedConversations(parsed);
        
        // Show celebration briefly then move to selection
        setMode('celebration');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setMode('selection');
    }, [scannedConversations, conversationFiles]);

    const handleSelectConversation = useCallback((conv) => {
        onDataLoaded({
            conversations: parsedConversations,
            conversationFiles: null,
            activeConversation: conv,
            conversationData: {
                aggregates: conv.aggregates,
            },
            allAggregates: parsedConversations.reduce((acc, c) => {
                acc[c.id] = c.aggregates;
                return acc;
            }, {}),
        });
    }, [parsedConversations, onDataLoaded]);

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleBackToUpload = () => {
        setScannedConversations(null);
        setParsedConversations(null);
        setConversationFiles(null);
        setRunningStats(null);
        setError(null);
        setMode('upload');
    };

    // Privacy footer component - reused across modals
    const PrivacyFooter = () => (
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 mt-auto">
            <div 
                ref={privacyAnchorRef}
                className="flex items-center justify-center gap-2"
            >
                <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <p className="font-mono text-[11px] text-neutral-400">
                    100% private
                </p>
                <span 
                    className="font-mono text-[11px] text-accent cursor-pointer hover:underline"
                    onClick={() => setShowPrivacyTooltip(true)}
                    onMouseEnter={() => {
                        if (window.matchMedia('(hover: hover)').matches) {
                            setShowPrivacyTooltip(true);
                        }
                    }}
                    onMouseLeave={() => {
                        if (window.matchMedia('(hover: hover)').matches) {
                            setShowPrivacyTooltip(false);
                        }
                    }}
                >
                    Learn more
                </span>
            </div>
            <PrivacyTooltip 
                isVisible={showPrivacyTooltip} 
                onClose={() => setShowPrivacyTooltip(false)}
                anchorRef={privacyAnchorRef}
            />
        </div>
    );

    // Modal wrapper - all states render inside this
    const ModalWrapper = ({ children, maxWidth = 'max-w-lg', maxHeight = 'max-h-[85vh]', showPrivacy = false }) => (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
            <div className={`bg-white w-full ${maxWidth} ${maxHeight} flex flex-col shadow-2xl overflow-hidden`}>
                {children}
                {showPrivacy && <PrivacyFooter />}
            </div>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Celebration (brief moment after parsing completes)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'celebration') {
        return (
            <ModalWrapper maxWidth="max-w-md">
                <div className="flex-1 flex items-center justify-center py-16">
                    <div className="text-center animate-fade-in">
                        <div className="mb-4">
                            <svg className="w-12 h-12 mx-auto text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="font-display text-2xl font-semibold mb-2">Ready to explore!</h2>
                        <p className="font-mono text-[13px] text-neutral-500">
                            {formatNumber(runningStats?.totalMessages || 0)} messages across {parseProgress.total} conversations
                        </p>
                    </div>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Parsing (processing all conversations)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'parsing') {
        const percent = parseProgress.total > 0 ? Math.round((parseProgress.current / parseProgress.total) * 100) : 0;
        
        // Build revealed stats as we discover them (excluding message count which is now separate)
        const revealedStats = [];
        if (runningStats?.oldestYear) {
            revealedStats.push({ type: 'oldest', text: `History dating back to ${runningStats.oldestYear}` });
        }
        if (runningStats?.topConversation) {
            revealedStats.push({ type: 'top', text: `Biggest chat: ${runningStats.topConversation}` });
        }
        
        return (
            <ModalWrapper maxWidth="max-w-md">
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-8">
                    {/* Logo */}
                    <div 
                        className="select-none mb-8"
                        style={{
                            fontFamily: "'Bebas Neue', 'Space Grotesk', Impact, sans-serif",
                            fontSize: '3.5rem',
                            fontWeight: 400,
                            letterSpacing: '0.025em',
                            lineHeight: 1,
                            color: '#0A0A0A'
                        }}
                    >
                        MSGS
                    </div>
                    
                    {/* Live message counter - standalone KPI */}
                    <div className="mb-8 text-center">
                        <div className="font-display text-4xl font-semibold text-neutral-900 tabular-nums tracking-tight">
                            {runningStats?.totalMessages?.toLocaleString() || '0'}
                        </div>
                        <div className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 mt-1">
                            messages found
                        </div>
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
                                Reading conversation <span className="text-accent font-semibold">{parseProgress.current}</span> of <span className="font-semibold">{parseProgress.total}</span>
                            </p>
                            <p className="font-mono text-[12px] text-neutral-400 mt-1 truncate">
                                {parseProgress.name}
                            </p>
                        </div>
                    </div>
                    
                    {/* Revealed stats - appear as we discover them */}
                    {revealedStats.length > 0 && (
                        <div className="mt-8 space-y-2">
                            {revealedStats.map((stat) => (
                                <div 
                                    key={stat.type}
                                    className="font-mono text-[12px] text-neutral-400 text-center flex items-center justify-center gap-2"
                                >
                                    <span className="text-accent">—</span>
                                    <span>{stat.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Reassurance */}
                    <p className="mt-8 font-mono text-[11px] text-neutral-300 text-center">
                        Everything stays on your device
                    </p>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Scanned (showing summary with Continue button)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'scanned' && scannedConversations) {
        const totalEstimatedMessages = scannedConversations.reduce((sum, c) => sum + (c.estimatedMessages || 0), 0);
        
        return (
            <ModalWrapper>
                {/* Header */}
                <div className="px-6 py-5 border-b border-neutral-100">
                    <h2 className="font-display text-xl font-semibold mb-1">Found your chats!</h2>
                    <p className="font-mono text-[12px] text-neutral-400">
                        Here's what we found
                    </p>
                </div>
                
                {/* Summary Stats */}
                <div className="px-6 py-6 bg-neutral-50 border-b border-neutral-100">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                            <div className="font-display text-3xl font-semibold text-neutral-900">
                                {scannedConversations.length}
                            </div>
                            <div className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 mt-1">
                                Conversations
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="font-display text-3xl font-semibold text-neutral-900">
                                ~{formatNumber(totalEstimatedMessages)}
                            </div>
                            <div className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 mt-1">
                                Messages (est.)
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Preview list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <p className="font-mono text-[11px] text-neutral-400 mb-3 uppercase tracking-wide">
                        Your conversations:
                    </p>
                    <div className="space-y-2">
                        {scannedConversations.slice(0, 8).map((conv) => (
                            <div 
                                key={conv.id}
                                className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded"
                            >
                                <span className="font-display text-sm text-neutral-700 truncate flex-1 mr-3">
                                    {conv.title}
                                </span>
                                <span className="font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                                    ~{formatNumber(conv.estimatedMessages || 0)}
                                </span>
                            </div>
                        ))}
                        {scannedConversations.length > 8 && (
                            <p className="font-mono text-[11px] text-neutral-400 text-center py-2">
                                +{scannedConversations.length - 8} more conversations
                            </p>
                        )}
                    </div>
                </div>
                
                {/* Actions */}
                <div className="px-6 py-5 border-t border-neutral-100 bg-white">
                    <button
                        onClick={handleStartParsing}
                        className="w-full py-3.5 bg-accent hover:bg-accent/90 text-white font-mono text-[12px] uppercase tracking-widest transition-all duration-200 hover:shadow-lg"
                    >
                        Let's go
                    </button>
                    <button
                        onClick={handleBackToUpload}
                        className="w-full mt-3 font-mono text-[12px] uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors py-2"
                    >
                        ← Upload different data
                    </button>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Selection (after parsing, choose conversation to view)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'selection' && parsedConversations && parsedConversations.length > 0) {
        const totalMessages = parsedConversations.reduce((sum, c) => sum + (c.totalMessages || 0), 0);
        
        return (
            <ModalWrapper>
                {/* Header with summary */}
                <div className="px-6 py-5 border-b border-neutral-100">
                    <h2 className="font-display text-xl font-semibold mb-2">Your Conversations</h2>
                    <div className="flex items-center gap-4">
                        <span className="font-mono text-[12px] text-neutral-500">
                            {formatNumber(totalMessages)} total messages
                        </span>
                        <span className="text-neutral-300">·</span>
                        <span className="font-mono text-[12px] text-neutral-500">
                            {parsedConversations.length} conversations
                        </span>
                    </div>
                </div>
                
                {/* Suggestion */}
                <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100">
                    <p className="font-mono text-[11px] text-neutral-400">
                        Pick a conversation to dive into
                    </p>
                </div>
                
                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    <div className="divide-y divide-neutral-100">
                        {parsedConversations.map((conv, index) => (
                            <ConversationCard
                                key={conv.id}
                                conversation={conv}
                                onClick={() => handleSelectConversation(conv)}
                                isFirst={index === 0}
                            />
                        ))}
                    </div>
                </div>
                
                {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50">
                    <button
                        onClick={handleBackToUpload}
                        className="font-mono text-[12px] uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        ← Upload different data
                    </button>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Upload (drag and drop zone)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'upload') {
        return (
            <ModalWrapper showPrivacy>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4">
                    <h2 className="font-display text-lg font-semibold">Upload Your Data</h2>
                    <button
                        onClick={() => setMode('branch')}
                        className="font-mono text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1.5"
                    >
                        <span>←</span>
                        <span className="uppercase tracking-widest">Back</span>
                    </button>
                </div>
                
                {/* Drop zone */}
                <div className="p-6">
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleBrowseClick}
                        className={`
                            w-full py-16 border-2 border-dashed transition-all duration-200 rounded
                            flex flex-col items-center justify-center gap-4 cursor-pointer
                            ${isDragging 
                                ? 'border-accent bg-accent/5 scale-[1.02]' 
                                : 'border-neutral-200 hover:border-accent/50 hover:bg-neutral-50'
                            }
                            ${isScanning ? 'pointer-events-none' : ''}
                        `}
                    >
                        {isScanning ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-40 h-1.5 bg-neutral-100 overflow-hidden rounded-full">
                                    <div 
                                        className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${scanProgress.percent}%` }}
                                    />
                                </div>
                                <p className="font-mono text-[12px] text-neutral-500">
                                    {scanProgress.stage === 'scanning' 
                                        ? `Discovering conversations...` 
                                        : `Reading your export...`
                                    }
                                </p>
                            </div>
                        ) : (
                        <>
                            <div className={`transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`}>
                                <svg className="w-12 h-12 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="square" strokeLinejoin="miter" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <p className="font-display text-lg font-semibold text-neutral-700">
                                    Drop your Messenger or Instagram export
                                </p>
                                <p className="font-mono text-[12px] text-neutral-400 mt-1">
                                    or click to browse files
                                </p>
                            </div>
                        </>
                        )}
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        webkitdirectory=""
                        directory=""
                        multiple
                        onChange={handleFileInput}
                        className="hidden"
                    />

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded">
                            <p className="font-mono text-[12px] text-red-600">
                                {error}
                            </p>
                        </div>
                    )}
                </div>
                
                {/* Simple instructions */}
                <div className="px-6 pb-6">
                    <div className="bg-neutral-50 rounded p-4">
                        <h3 className="font-display text-sm font-semibold text-neutral-700 mb-3">
                            Quick steps:
                        </h3>
                        <ol className="space-y-2 font-mono text-[12px] text-neutral-500">
                            <li className="flex gap-3">
                                <span className="text-accent font-semibold">1.</span>
                                <span>Download the ZIP file from your email</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-accent font-semibold">2.</span>
                                <span>Extract/unzip all the files</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="text-accent font-semibold">3.</span>
                                <span>Drag and drop the extracted folders here</span>
                            </li>
                        </ol>
                    </div>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Branch (choice between having export ready or needing to request)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'branch') {
        return (
            <ModalWrapper maxWidth="max-w-md" showPrivacy>
                {/* Minimal header with back button */}
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-neutral-300">
                        Upload
                    </div>
                    <button
                        onClick={() => setMode('choice')}
                        className="font-mono text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors flex items-center gap-1.5"
                    >
                        <span>←</span>
                        <span className="uppercase tracking-widest">Back</span>
                    </button>
                </div>
                
                {/* Main question - now the visual focus */}
                <div className="px-6 pb-6">
                    <h2 className="font-display text-[22px] font-semibold text-neutral-900 leading-tight">
                        Do you have your Facebook or Instagram export ready?
                    </h2>
                </div>
                
                {/* Options - cleaner, card-like */}
                <div className="px-6 pb-6 space-y-3 flex-1">
                    {/* Option 1: Has export */}
                    <button
                        onClick={() => setMode('upload')}
                        className="w-full p-4 bg-accent hover:bg-accent/90 text-white transition-all duration-200 hover:shadow-lg group text-left rounded"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="font-display text-[15px] font-semibold">
                                    Yes, I have my export
                                </div>
                                <div className="font-mono text-[11px] text-white/60 mt-0.5">
                                    I've downloaded and unzipped my data
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors">
                                <span className="text-white/80 group-hover:translate-x-0.5 transition-transform">→</span>
                            </div>
                        </div>
                    </button>
                    
                    {/* Option 2: Needs to request */}
                    <button
                        onClick={() => {
                            setGuideStep(0);
                            setMode('guide');
                        }}
                        className="w-full p-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 transition-all duration-200 group text-left rounded"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="font-display text-[15px] font-semibold">
                                    No, I need to request it
                                </div>
                                <div className="font-mono text-[11px] text-neutral-500 mt-0.5">
                                    Guide me through the export process (~2 min)
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-300 transition-colors">
                                <span className="text-neutral-500 group-hover:translate-x-0.5 transition-transform">→</span>
                            </div>
                        </div>
                    </button>
                    
                    {/* Info note */}
                    <div className="flex items-start gap-2 pt-2">
                        <svg className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="font-mono text-[10px] text-neutral-400 leading-relaxed">
                            Requesting an export takes ~2 min. You'll get an email within a few hours.
                        </p>
                    </div>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Guide (step-by-step export tutorial)
    // ═══════════════════════════════════════════════════════════════════
    if (mode === 'guide') {
        const currentStep = GUIDE_STEPS[guideStep];
        const isFirstStep = guideStep === 0;
        const isLastStep = guideStep === GUIDE_STEPS.length - 1;
        const progress = ((guideStep + 1) / GUIDE_STEPS.length) * 100;
        
        return (
            <ModalWrapper maxWidth="max-w-4xl" maxHeight="max-h-[92vh]">
                {/* Header with progress */}
                <div className="px-6 py-4 border-b border-neutral-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-display text-lg font-semibold">Export Guide</h2>
                        <button
                            onClick={() => setMode('branch')}
                            className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                            ✕ Close
                        </button>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                            {guideStep + 1}/{GUIDE_STEPS.length}
                        </span>
                    </div>
                </div>
                
                {/* Content area - split layout */}
                <div className="flex-1 flex flex-col md:flex-row min-h-0">
                    {/* Left side - Image */}
                    <div className="md:w-1/2 bg-neutral-50 flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ minHeight: '300px' }}>
                        {currentStep.image ? (
                            <img 
                                src={currentStep.image} 
                                alt={`Step ${guideStep + 1}: ${currentStep.title}`}
                                className="max-w-[95%] max-h-[95%] object-contain rounded shadow-lg"
                                style={{ margin: 'auto' }}
                            />
                        ) : (
                            <div className="w-[90%] h-[90%] min-h-[250px] border-2 border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center gap-3 bg-white">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-neutral-100 flex items-center justify-center">
                                    <span className="font-display text-xl md:text-2xl font-semibold text-neutral-400">{guideStep + 1}</span>
                                </div>
                                <span className="font-mono text-[11px] md:text-[12px] text-neutral-300 uppercase tracking-wide">Screenshot</span>
                            </div>
                        )}
                    </div>
                        
                    {/* Right side - Content */}
                    <div className="md:w-1/2 p-6 flex flex-col overflow-y-auto">
                            {/* Step indicator */}
                            <div className="font-mono text-[11px] uppercase tracking-widest text-accent mb-2">
                                Step {guideStep + 1}
                            </div>
                            
                            {/* Title */}
                            <h3 className="font-display text-2xl font-semibold text-neutral-900 mb-3">
                                {currentStep.title}
                            </h3>
                            
                            {/* Description */}
                            <p className="font-mono text-[13px] text-neutral-600 leading-relaxed mb-4">
                                {currentStep.description}
                            </p>
                            
                            {/* Bullets */}
                            {currentStep.bullets && currentStep.bullets.length > 0 && (
                                <ul className="space-y-2.5 mb-4">
                                    {currentStep.bullets.map((bullet, i) => (
                                        <li key={i} className="flex gap-3">
                                            <span className="text-accent text-lg leading-none mt-0.5">•</span>
                                            <span className="font-mono text-[13px] text-neutral-600 leading-relaxed">{bullet}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            
                            {/* Subsections (for configure step) */}
                            {currentStep.subsections && (
                                <div className="space-y-3 mb-4">
                                    {currentStep.subsections.map((sub, i) => (
                                        <div key={i} className="bg-neutral-50 p-3 rounded">
                                            <div className="font-display text-sm font-semibold text-neutral-800 mb-1">
                                                {sub.label}
                                            </div>
                                            <p className="font-mono text-[11px] text-neutral-500 leading-relaxed">
                                                {sub.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Links */}
                            {currentStep.links && currentStep.links.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    {currentStep.links.map((link, i) => (
                                        <a
                                            key={i}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-accent hover:text-accent/80 font-mono text-[12px] transition-colors"
                                        >
                                            <span>→</span>
                                            <span>{link.label}</span>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    ))}
                                </div>
                            )}
                            
                            {/* Tip */}
                            {currentStep.tip && (
                                <div className="mt-auto pt-4 border-t border-neutral-100">
                                    <div className="flex items-start gap-2">
                                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="font-mono text-[11px] text-neutral-500">
                                            <span className="font-semibold text-amber-600">Tip:</span> {currentStep.tip}
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {/* Final step CTA */}
                            {currentStep.isFinal && (
                                <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded">
                                    <p className="font-mono text-[12px] text-accent font-medium mb-2">
                                        All done! Bookmark this page and come back when you receive the email.
                                    </p>
                                    <button
                                        onClick={() => {
                                            // Copy URL to clipboard
                                            navigator.clipboard?.writeText(window.location.href);
                                        }}
                                        className="font-mono text-[11px] text-accent/70 hover:text-accent underline"
                                    >
                                        Copy link to clipboard
                                    </button>
                                </div>
                            )}
                    </div>
                </div>
                
                {/* Navigation footer */}
                <div className="px-6 py-4 border-t border-neutral-100 bg-white">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setGuideStep(s => Math.max(0, s - 1))}
                            disabled={isFirstStep}
                            className={`font-mono text-[12px] uppercase tracking-widest transition-colors py-2 px-4 ${
                                isFirstStep 
                                    ? 'text-neutral-300 cursor-not-allowed' 
                                    : 'text-neutral-600 hover:text-neutral-900'
                            }`}
                        >
                            ← Previous
                        </button>
                        
                        {isLastStep ? (
                            <button
                                onClick={() => setMode('branch')}
                                className="py-3 px-6 bg-accent hover:bg-accent/90 text-white font-mono text-[12px] uppercase tracking-widest transition-all duration-200 hover:shadow-lg"
                            >
                                Done
                            </button>
                        ) : (
                            <button
                                onClick={() => setGuideStep(s => Math.min(GUIDE_STEPS.length - 1, s + 1))}
                                className="py-3 px-6 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-[12px] uppercase tracking-widest transition-all duration-200 hover:shadow-lg"
                            >
                                Next →
                            </button>
                        )}
                    </div>
                </div>
            </ModalWrapper>
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODE: Choice (initial landing - demo or upload)
    // ═══════════════════════════════════════════════════════════════════
    return (
        <ModalWrapper maxWidth="max-w-md" showPrivacy>
            {/* Hero section */}
            <div className="px-8 pt-10 pb-8 text-center bg-gradient-to-b from-neutral-50 to-white">
                {/* Logo */}
                <div 
                    className="select-none mb-3"
                    style={{
                        fontFamily: "'Bebas Neue', 'Space Grotesk', Impact, sans-serif",
                        fontSize: '4rem',
                        fontWeight: 400,
                        letterSpacing: '0.025em',
                        lineHeight: 1,
                        color: '#0A0A0A'
                    }}
                >
                    MSGS
                </div>
                
                {/* Tagline - clear platform names */}
                <p className="font-mono text-[13px] text-neutral-500">
                    Rediscover your{' '}
                    <span className="text-neutral-800 font-medium">Messenger</span>
                    {' & '}
                    <span className="text-neutral-800 font-medium">Instagram</span>
                    {' '}chats
                </p>
            </div>

            {/* Options - wait for session check to prevent layout shift */}
            <div className="px-6 pb-6 flex-1">
                {!sessionChecked ? (
                    // Loading placeholder while checking for saved session
                    <div className="flex flex-col gap-3">
                        <div className="w-full py-4 bg-neutral-100 animate-pulse rounded" />
                        <div className="w-full py-4 bg-neutral-100 animate-pulse rounded" />
                    </div>
                ) : (
                    <>
                        {/* Returning user: two buttons */}
                        {sessionInfo && onResumeSession ? (
                            <div className="space-y-3">
                                <button
                                    onClick={onResumeSession}
                                    className="w-full py-4 px-5 bg-accent hover:bg-accent/90 text-white transition-all duration-200 hover:shadow-lg group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="text-left">
                                            <div className="font-mono text-[12px] uppercase tracking-widest">
                                                Continue where you left off
                                            </div>
                                            <div className="text-[12px] text-white/70 mt-1 truncate max-w-[250px]">
                                                {sessionInfo.totalConversations > 1 
                                                    ? `${sessionInfo.totalConversations} conversations loaded`
                                                    : sessionInfo.conversation.title
                                                }
                                            </div>
                                            <div className="text-[10px] text-white/50 mt-0.5">
                                                {formatSessionTimestamp(sessionInfo.savedAt)}
                                            </div>
                                        </div>
                                        <span className="text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all text-xl">→</span>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => setMode('branch')}
                                    className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white font-mono text-[12px] uppercase tracking-widest transition-all duration-200 hover:shadow-lg"
                                >
                                    Upload new chats
                                </button>
                            </div>
                        ) : (
                            /* First-time user: one main button */
                            <button
                                onClick={() => setMode('branch')}
                                className="w-full py-4 bg-accent hover:bg-accent/90 text-white font-mono text-[12px] uppercase tracking-widest transition-all duration-200 hover:shadow-lg"
                            >
                                Upload your chats
                            </button>
                        )}
                        
                        {/* Demo link - always shown as secondary option */}
                        <div className="text-center mt-4">
                            <button
                                onClick={onDemoSelect}
                                className="font-mono text-[12px] text-neutral-400 hover:text-accent transition-colors"
                            >
                                Try the demo →
                            </button>
                        </div>
                    </>
                )}
            </div>
        </ModalWrapper>
    );
}

function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${Math.round(num / 1000)}K`;
    return num.toLocaleString();
}
