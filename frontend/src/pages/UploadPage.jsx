import React, { useState, useCallback, useRef } from 'react';
import { parseMessengerFolders, parseConversation } from '../utils/parseMessenger';

/**
 * Upload Page
 * ===========
 * Landing page with drag-and-drop zone for Messenger export folders.
 * Scans folders, discovers conversations, lets user select one to analyze.
 */
export default function UploadPage({ onDataLoaded }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState({ stage: '', percent: 0 });
    const [conversations, setConversations] = useState(null);
    const [conversationFiles, setConversationFiles] = useState(null);
    const [selectedConv, setSelectedConv] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadProgress, setLoadProgress] = useState({ stage: '', percent: 0 });
    const [error, setError] = useState(null);
    
    const fileInputRef = useRef(null);

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

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setError(null);

        // Get files from dataTransfer
        const items = e.dataTransfer.items;
        if (!items || items.length === 0) return;

        // Collect all files from dropped folders
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
        setScanProgress({ stage: 'Reading folders...', percent: 0 });

        try {
            await Promise.all(promises);
            
            if (allFiles.length === 0) {
                setError('No files found. Please drop unpacked Messenger export folders.');
                setIsScanning(false);
                return;
            }

            // Create a fake FileList-like array with webkitRelativePath
            const result = await parseMessengerFolders(allFiles, (stage, percent) => {
                setScanProgress({ stage, percent });
            });

            if (result.conversations.length === 0) {
                setError('No conversations found. Make sure you dropped the unpacked Messenger export folders containing message_*.json files.');
                setIsScanning(false);
                return;
            }

            setConversations(result.conversations);
            setConversationFiles(result.conversationFiles);
            setIsScanning(false);
        } catch (err) {
            console.error('Failed to scan folders:', err);
            setError(`Failed to scan folders: ${err.message}`);
            setIsScanning(false);
        }
    }, []);

    // Traverse directory recursively
    const traverseDirectory = async (entry, files, path = '') => {
        if (entry.isFile) {
            const file = await new Promise((resolve) => entry.file(resolve));
            // Attach relative path
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

    const handleFileInput = useCallback(async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsScanning(true);
        setError(null);
        setScanProgress({ stage: 'Reading folders...', percent: 0 });

        try {
            const result = await parseMessengerFolders(files, (stage, percent) => {
                setScanProgress({ stage, percent });
            });

            if (result.conversations.length === 0) {
                setError('No conversations found. Make sure you selected the unpacked Messenger export folders.');
                setIsScanning(false);
                return;
            }

            setConversations(result.conversations);
            setConversationFiles(result.conversationFiles);
            setIsScanning(false);
        } catch (err) {
            console.error('Failed to scan folders:', err);
            setError(`Failed to scan folders: ${err.message}`);
            setIsScanning(false);
        }
    }, []);

    const handleSelectConversation = useCallback(async (conv) => {
        setSelectedConv(conv);
        setIsLoading(true);
        setLoadProgress({ stage: 'Loading messages...', percent: 0 });

        try {
            const result = await parseConversation(conv, conversationFiles, (stage, percent) => {
                setLoadProgress({ stage, percent });
            });

            // Pass data up to App
            onDataLoaded({
                conversations,
                conversationFiles,
                activeConversation: conv,
                conversationData: result,
            });
        } catch (err) {
            console.error('Failed to load conversation:', err);
            setError(`Failed to load conversation: ${err.message}`);
            setIsLoading(false);
            setSelectedConv(null);
        }
    }, [conversations, conversationFiles, onDataLoaded]);

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    // Loading conversation
    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div 
                        className="select-none"
                        style={{
                            fontFamily: "'Bebas Neue', 'Space Grotesk', Impact, sans-serif",
                            fontSize: 'clamp(4rem, 15vw, 8rem)',
                            fontWeight: 400,
                            letterSpacing: '0.08em',
                            lineHeight: 1,
                            color: '#0A0A0A'
                        }}
                    >
                        MSGS
                    </div>
                    <div className="w-[280px]">
                        <div className="h-1 bg-neutral-100 overflow-hidden">
                            <div 
                                className="h-full bg-accent transition-all duration-300 ease-out"
                                style={{ width: `${loadProgress.percent}%` }}
                            />
                        </div>
                        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400 text-center">
                            {loadProgress.stage}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Conversation selection
    if (conversations && !selectedConv) {
        return (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 lg:px-8 h-16 border-b border-neutral-100">
                    <h1 
                        className="select-none cursor-pointer"
                        onClick={() => {
                            setConversations(null);
                            setConversationFiles(null);
                        }}
                        style={{
                            fontFamily: "'Bebas Neue', 'Space Grotesk', Impact, sans-serif",
                            fontSize: '1.75rem',
                            fontWeight: 400,
                            letterSpacing: '0.08em',
                            lineHeight: 1,
                            color: '#0A0A0A'
                        }}
                    >
                        MSGS
                    </h1>
                    <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400">
                        {conversations.length} conversations found
                    </span>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8">
                    <div className="max-w-2xl mx-auto">
                        <h2 className="font-display text-xl font-semibold tracking-tight text-neutral-900 mb-2">
                            Select a Conversation
                        </h2>
                        <p className="font-mono text-[12px] text-neutral-500 mb-8">
                            Choose which conversation to analyze. Larger conversations may take longer to process.
                        </p>

                        <div className="space-y-2">
                            {conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv)}
                                    className="w-full text-left p-4 bg-neutral-50 hover:bg-neutral-100 transition-colors group"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-display text-sm font-semibold text-neutral-900 truncate group-hover:text-accent transition-colors">
                                                {conv.title}
                                            </h3>
                                            <p className="font-mono text-[12px] text-neutral-400 mt-1">
                                                {conv.participants?.length || 0} participants · ~{formatNumber(conv.estimatedMessages)} messages
                                            </p>
                                        </div>
                                        <div className="font-mono text-[12px] uppercase tracking-widest text-neutral-300 group-hover:text-accent transition-colors">
                                            →
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Upload screen
    return (
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-8 max-w-lg w-full">
                {/* Logo */}
                <div 
                    className="select-none"
                    style={{
                        fontFamily: "'Bebas Neue', 'Space Grotesk', Impact, sans-serif",
                        fontSize: 'clamp(4rem, 15vw, 8rem)',
                        fontWeight: 400,
                        letterSpacing: '0.08em',
                        lineHeight: 1,
                        color: '#0A0A0A'
                    }}
                >
                    MSGS
                </div>

                {/* Subtitle */}
                <p className="font-mono text-[12px] text-neutral-500 text-center max-w-sm">
                    Messenger analytics for your group chats. 
                    Drop your unpacked Facebook export folders below.
                </p>

                {/* Drop zone */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                        w-full aspect-[2/1] border-2 border-dashed transition-all duration-200
                        flex flex-col items-center justify-center gap-4 cursor-pointer
                        ${isDragging 
                            ? 'border-accent bg-accent/5' 
                            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                        }
                        ${isScanning ? 'pointer-events-none opacity-60' : ''}
                    `}
                    onClick={handleBrowseClick}
                >
                    {isScanning ? (
                        <>
                            <div className="w-32 h-1 bg-neutral-100 overflow-hidden">
                                <div 
                                    className="h-full bg-accent transition-all duration-300 ease-out"
                                    style={{ width: `${scanProgress.percent}%` }}
                                />
                            </div>
                            <p className="font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400">
                                {scanProgress.stage}
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="text-4xl text-neutral-300">
                                ↓
                            </div>
                            <div className="text-center">
                                <p className="font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400">
                                    Drop folders here
                                </p>
                                <p className="font-mono text-[12px] text-neutral-300 mt-1">
                                    or click to browse
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

                {/* Error message */}
                {error && (
                    <p className="font-mono text-[12px] text-red-500 text-center">
                        {error}
                    </p>
                )}

                {/* Help text */}
                <div className="text-center">
                    <p className="font-mono text-[12px] text-neutral-300">
                        Download your data from Facebook → Settings → Download Your Information
                    </p>
                    <p className="font-mono text-[12px] text-neutral-300 mt-1">
                        Select JSON format, then unpack and drop the folders here
                    </p>
                </div>
            </div>
        </div>
    );
}

function formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
}

