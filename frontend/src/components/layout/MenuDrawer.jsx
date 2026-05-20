import React, { useState, useEffect, useCallback } from 'react';
import Drawer from '../Drawer';
import { formatSessionTimestamp } from '../../utils/storage';

/**
 * Menu Drawer Component
 * =====================
 * Side drawer with navigation and settings.
 * Contains: Wrapped link, Settings section with data info and delete option, Upload button.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether drawer is open
 * @param {function} props.onClose - Callback to close drawer
 * @param {function} props.onUploadClick - Callback when upload clicked
 * @param {function} props.onWrappedClick - Callback when wrapped clicked
 * @param {function} props.onDeleteData - Callback when delete data confirmed
 * @param {Object} props.dataInfo - Current data info { title, messageCount, savedAt, isDemo }
 * @param {string} props.activeView - Current active view ('analytics' or 'content')
 * @param {function} props.onAnalyticsClick - Callback to switch to analytics view
 * @param {function} props.onContentClick - Callback to switch to content view
 */
export default function MenuDrawer({
    isOpen,
    onClose,
    onUploadClick,
    onWrappedClick,
    onDeleteData,
    dataInfo,
    activeView = 'analytics',
    onAnalyticsClick,
    onContentClick,
}) {
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    
    // Reset delete confirmation when drawer closes
    useEffect(() => {
        if (!isOpen) {
            setDeleteConfirm(false);
        }
    }, [isOpen]);
    
    // Auto-reset delete confirmation after 3 seconds
    useEffect(() => {
        if (deleteConfirm) {
            const timer = setTimeout(() => setDeleteConfirm(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [deleteConfirm]);

    const handleDeleteClick = useCallback(() => {
        if (deleteConfirm) {
            // Second click - actually delete
            onDeleteData?.();
        } else {
            // First click - show confirmation
            setDeleteConfirm(true);
        }
    }, [deleteConfirm, onDeleteData]);

    const handleUploadClick = useCallback(() => {
        onClose?.();
        onUploadClick?.();
    }, [onClose, onUploadClick]);

    const handleWrappedClick = useCallback(() => {
        onClose?.();
        onWrappedClick?.();
    }, [onClose, onWrappedClick]);

    const { title, messageCount, savedAt, isDemo } = dataInfo || {};
    const hasUserData = !isDemo && title;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            position="right"
            width="320px"
            className="w-full max-w-[320px] md:w-[320px]"
        >
            <div className="h-full bg-[#FAFAFA] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-100">
                    <span className="font-mono text-[12px] uppercase tracking-widest text-neutral-400">
                        Menu
                    </span>
                    <button
                        onClick={onClose}
                        className="p-2 -m-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                        aria-label="Close menu"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* View Navigation - Mobile only (hidden on desktop) */}
                    <div className="md:hidden space-y-2">
                        <h3 className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 mb-3">
                            Navigate
                        </h3>
                        <button
                            onClick={onAnalyticsClick}
                            className={`w-full flex items-center gap-3 h-12 px-4 font-mono text-[12px] uppercase tracking-widest transition-colors ${
                                activeView === 'analytics'
                                    ? 'bg-neutral-900 text-white'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Analytics
                        </button>
                        <button
                            onClick={onContentClick}
                            className={`w-full flex items-center gap-3 h-12 px-4 font-mono text-[12px] uppercase tracking-widest transition-colors ${
                                activeView === 'content'
                                    ? 'bg-neutral-900 text-white'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            Content
                        </button>
                    </div>

                    {/* Divider - Mobile only */}
                    <div className="md:hidden border-t border-neutral-200" />

                    {/* Wrapped Button - Matches navbar style */}
                    <button
                        onClick={handleWrappedClick}
                        className="w-full flex items-center justify-center h-12 bg-accent text-white font-mono text-[12px] uppercase tracking-widest font-semibold hover:bg-neutral-900 transition-colors"
                    >
                        Wrapped
                    </button>

                    {/* Divider */}
                    <div className="border-t border-neutral-200" />

                    {/* Settings Section */}
                    <div className="space-y-4">
                        <h3 className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
                            Settings
                        </h3>

                        {/* Data Info */}
                        {hasUserData ? (
                            <div className="bg-white p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
                                            Loaded Chat
                                        </div>
                                        <div className="font-display text-sm font-medium text-neutral-900 truncate">
                                            {title}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <div className="font-mono text-[11px] uppercase tracking-wide text-neutral-400 mb-1">
                                            Messages
                                        </div>
                                        <div className="font-mono text-sm font-medium text-neutral-900 tabular-nums">
                                            {messageCount?.toLocaleString() || '—'}
                                        </div>
                                    </div>
                                </div>
                                {savedAt && (
                                    <div className="font-mono text-[11px] text-neutral-400">
                                        Saved {formatSessionTimestamp(savedAt)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white p-4">
                                <div className="font-mono text-[12px] text-neutral-500">
                                    {isDemo ? 'Viewing demo data' : 'No data loaded'}
                                </div>
                            </div>
                        )}

                        {/* Delete Data Button */}
                        {hasUserData && (
                            <button
                                onClick={handleDeleteClick}
                                className={`w-full flex items-center justify-center gap-2 h-10 font-mono text-[12px] uppercase tracking-widest transition-all ${
                                    deleteConfirm
                                        ? 'bg-red-600 text-white font-semibold'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                }`}
                            >
                                {deleteConfirm ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Confirm Delete?
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete My Data
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-neutral-200" />

                    {/* Upload Button */}
                    <button
                        onClick={handleUploadClick}
                        className="w-full flex items-center justify-center gap-2 h-10 bg-neutral-100 text-neutral-600 font-mono text-[12px] uppercase tracking-widest hover:bg-neutral-200 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload New Data
                    </button>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-neutral-100">
                    <div className="font-mono text-[10px] text-neutral-400 text-center uppercase tracking-widest">
                        Your data never leaves your device
                    </div>
                </div>
            </div>
        </Drawer>
    );
}

