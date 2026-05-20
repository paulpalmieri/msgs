import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';

// Layout components
import { Header, FilterBar, MenuDrawer } from './components/layout';

// Feature pages
import { AnalyticsPage, WrappedFeature, ContentPage } from './features';
import StoryPage from './features/story/StoryPage';

// Common components
import { LoadingOverlay, UpdatingOverlay } from './components/LoadingOverlay';
import WelcomeModal from './components/WelcomeModal';
import WrappedModal from './components/WrappedModal';

// Hooks
import { useDataLoader } from './hooks/useDataLoader';
import { useFilters } from './hooks/useFilters';

// Utils & Data
import { parseConversation } from './utils/parseMessenger';
import { getDemoAggregates, getDemoMessages, DEMO_CONVERSATION } from './data/demoData';
import { saveConversation, saveAllParsedConversations, loadSessionData, setActiveConversation, clearSessionData, loadAllSessionData } from './utils/storage';

/**
 * Main Application
 * ================
 * Orchestrates data upload, conversation selection, and feature rendering.
 * Shows demo data by default with a modal to choose demo or upload.
 */
function App() {
    // Modal state
    const [showWelcomeModal, setShowWelcomeModal] = useState(true);
    const [welcomeModalMode, setWelcomeModalMode] = useState('choice'); // 'choice' or 'upload'
    const [isDemo, setIsDemo] = useState(true);
    
    // Wrapped modal state
    const [showWrappedModal, setShowWrappedModal] = useState(false);
    const [wrappedConfig, setWrappedConfig] = useState(null); // { year, user, yearData }
    const [showWrappedView, setShowWrappedView] = useState(false);
    
    // Menu drawer state
    const [showMenuDrawer, setShowMenuDrawer] = useState(false);
    const [sessionSavedAt, setSessionSavedAt] = useState(null);

    // View state: 'analytics' or 'content'
    const [activeView, setActiveView] = useState('analytics');
    
    // Data loading
    const {
        conversations,
        conversationFiles,
        activeConversation,
        rawData,
        aggregates,
        filteredAggregates,
        processedData,
        allUsers,
        allYears,
        isLoading,
        loadingProgress,
        loadingPhase,
        isUpdating,
        updatingProgress,
        updatingPhase,
        processWithFilters,
        initialLoadComplete,
        dataLoadStatus,
        setUploadedData,
        setRestoredData,
        switchConversation,
        setDemoData,
    } = useDataLoader();
    
    // Filters
    const {
        selectedUsers,
        setSelectedUsers,
        selectedYears,
        setSelectedYears,
        selectedUsersSet,
        selectedYearsSet,
        isFiltered,
        userDisplayNames,
        showYearFilter,
        showUserFilter,
        handleRemoveYear,
        handleClearAllFilters,
        handleResetUsers,
        toggleYearFilter,
        toggleUserFilter,
        closeAllFilters,
    } = useFilters(allUsers, allYears);

    // Initialize with demo data on mount
    useEffect(() => {
        const demoAggregates = getDemoAggregates();
        const demoMessages = getDemoMessages();
        
        setDemoData({
            aggregates: demoAggregates,
            messages: demoMessages,
            conversation: DEMO_CONVERSATION,
        });
    }, [setDemoData]);

    // Track previous data source to detect changes
    const prevDataSourceRef = useRef({ users: null, years: null });
    
    // Track if filters are synced with current data source
    const [filtersSynced, setFiltersSynced] = useState(false);

    // Reset filters when data source changes (new conversation, upload, etc.)
    useEffect(() => {
        if (allUsers.length === 0) {
            setFiltersSynced(false);
            return;
        }
        
        const prevUsers = prevDataSourceRef.current.users;
        
        // Check if this is a NEW data source (not just a re-render)
        const usersChanged = prevUsers === null || 
            prevUsers.length !== allUsers.length ||
            !prevUsers.every(u => allUsers.includes(u)) ||
            !allUsers.every(u => prevUsers.includes(u));
        
        if (usersChanged) {
            // New data source - select all users
            setSelectedUsers(allUsers);
            prevDataSourceRef.current.users = [...allUsers];
        }
    }, [allUsers, setSelectedUsers]);

    useEffect(() => {
        if (allYears.length === 0) {
            setFiltersSynced(false);
            return;
        }
        
        const prevYears = prevDataSourceRef.current.years;
        
        // Check if this is a NEW data source
        const yearsChanged = prevYears === null ||
            prevYears.length !== allYears.length ||
            !prevYears.every(y => allYears.includes(y)) ||
            !allYears.every(y => prevYears.includes(y));
        
        if (yearsChanged) {
            // New data source - select all years
            setSelectedYears(allYears);
            prevDataSourceRef.current.years = [...allYears];
        }
    }, [allYears, setSelectedYears]);

    // Track when filters are synced with data
    useEffect(() => {
        if (allUsers.length > 0 && allYears.length > 0 && 
            selectedUsers.length > 0 && selectedYears.length > 0) {
            // Check if selectedUsers match allUsers (all selected for new data)
            const usersMatch = selectedUsers.length === allUsers.length && 
                selectedUsers.every(u => allUsers.includes(u));
            const yearsMatch = selectedYears.length === allYears.length &&
                selectedYears.every(y => allYears.includes(y));
            
            if (usersMatch && yearsMatch) {
                setFiltersSynced(true);
            }
        }
    }, [allUsers, allYears, selectedUsers, selectedYears]);

    // Initial data processing - wait for both data and filters to be ready
    useEffect(() => {
        if (dataLoadStatus === 'loaded' && 
            filtersSynced && 
            !initialLoadComplete.current && 
            selectedUsers.length > 0 && 
            selectedYears.length > 0) {
            processWithFilters(selectedUsers, selectedYears, true);
        }
    }, [dataLoadStatus, filtersSynced, selectedUsers, selectedYears, processWithFilters]);

    // Reprocess on filter changes (after initial load)
    useEffect(() => {
        if (dataLoadStatus !== 'processed' || isLoading) return;
        if (!initialLoadComplete.current) return;
        if (selectedUsers.length === 0 || selectedYears.length === 0) return;
        processWithFilters(selectedUsers, selectedYears, false);
    }, [selectedUsers, selectedYears]); // eslint-disable-line react-hooks/exhaustive-deps

    // Memoized filtered messages
    const filteredMessages = useMemo(() => {
        if (!rawData) return [];
        return rawData.filter(msg => 
            selectedUsersSet.has(msg.sender_name) && selectedYearsSet.has(msg.year)
        );
    }, [rawData, selectedUsersSet, selectedYearsSet]);

    // Handle demo selection
    const handleDemoSelect = useCallback(() => {
        setShowWelcomeModal(false);
        setWelcomeModalMode('choice'); // Reset for next time
        setIsDemo(true);
    }, []);

    // Handle data upload from modal
    const handleDataLoaded = useCallback(async (data) => {
        // Reset filters sync tracking for new data
        setFiltersSynced(false);
        prevDataSourceRef.current = { users: null, years: null };
        
        setUploadedData(data);
        setShowWelcomeModal(false);
        setWelcomeModalMode('choice'); // Reset for next time
        setIsDemo(false);
        
        // Save ALL conversations to IndexedDB (supports large data)
        await saveAllParsedConversations(data.conversations, data.activeConversation.id);
        setSessionSavedAt(Date.now());
        
        // Filters will auto-sync via the effect when allUsers/allYears change
    }, [setUploadedData]);

    // Handle session resume from IndexedDB
    const handleResumeSession = useCallback(async () => {
        const savedData = await loadSessionData();
        if (!savedData) return;
        
        // Reset filters sync tracking for restored data
        setFiltersSynced(false);
        prevDataSourceRef.current = { users: null, years: null };
        
        // New format: multiple conversations with aggregates map
        setRestoredData({
            conversations: savedData.conversations,
            aggregatesMap: savedData.aggregatesMap,
            activeConversation: savedData.activeConversation,
            activeAggregates: savedData.activeAggregates,
        });
        setShowWelcomeModal(false);
        setWelcomeModalMode('choice'); // Reset for next time
        setIsDemo(false);
        setSessionSavedAt(savedData.savedAt);
    }, [setRestoredData]);

    // Handle conversation switch
    const handleConversationSwitch = useCallback(async (conversation) => {
        // Reset filters sync tracking for new conversation
        setFiltersSynced(false);
        prevDataSourceRef.current = { users: null, years: null };
        
        // Update active conversation in storage
        await setActiveConversation(conversation.id);
        
        // Filters will auto-sync via the effect when allUsers/allYears change
        await switchConversation(
            conversation, 
            parseConversation,
            null, // onProgress
            async (aggs, conv) => {
                // Save newly parsed conversation to IndexedDB
                await saveConversation(aggs, conv, true);
                setSessionSavedAt(Date.now());
            }
        );
    }, [switchConversation]);

    // Handle upload button click (from navbar demo badge or menu drawer)
    // Skip to branch mode (Yes I have export / No I need to request)
    const handleUploadClick = useCallback(() => {
        setWelcomeModalMode('branch');
        setShowWelcomeModal(true);
    }, []);
    
    // Handle menu open/close
    const handleMenuClick = useCallback(() => {
        setShowMenuDrawer(true);
    }, []);
    
    const handleMenuClose = useCallback(() => {
        setShowMenuDrawer(false);
    }, []);
    
    // Handle delete data
    const handleDeleteData = useCallback(async () => {
        await clearSessionData();
        // Reload the app to fresh state
        window.location.reload();
    }, []);

    // Handle wrapped modal
    const handleWrappedClick = useCallback(() => {
        setShowWrappedModal(true);
    }, []);
    
    const handleWrappedClose = useCallback(() => {
        setShowWrappedModal(false);
    }, []);
    
    const handleWrappedStart = useCallback((year, user, yearData, groupTitle) => {
        setWrappedConfig({ year, user, yearData, groupTitle });
        setShowWrappedModal(false);
        // Small delay to ensure modal closes before showing wrapped
        setTimeout(() => {
            setShowWrappedView(true);
        }, 100);
    }, []);
    
    const handleWrappedViewClose = useCallback(() => {
        setShowWrappedView(false);
        setWrappedConfig(null);
    }, []);

    // View switching handlers
    const handleAnalyticsClick = useCallback(() => {
        setActiveView('analytics');
        setShowMenuDrawer(false);
        window.history.pushState({}, '', '/');
    }, []);

    const handleContentClick = useCallback(() => {
        setActiveView('content');
        setShowMenuDrawer(false);
        window.history.pushState({}, '', '/');
    }, []);

    const handleStoryClick = useCallback(() => {
        setActiveView('story');
        setShowMenuDrawer(false);
        window.history.pushState({}, '', '/story');
    }, []);

    const handleStoryBack = useCallback(() => {
        setActiveView('analytics');
        window.history.pushState({}, '', '/');
    }, []);

    // Data info for menu drawer
    const dataInfo = useMemo(() => ({
        title: activeConversation?.title,
        messageCount: aggregates?.global?.total_messages,
        savedAt: sessionSavedAt,
        isDemo,
    }), [activeConversation?.title, aggregates?.global?.total_messages, sessionSavedAt, isDemo]);

    // Loading state
    if (isLoading) {
        return (
            <>
                <LoadingOverlay show={true} progress={loadingProgress} phase={loadingPhase} />
                {showWelcomeModal && (
                    <WelcomeModal
                        onDemoSelect={handleDemoSelect}
                        onDataLoaded={handleDataLoaded}
                        onResumeSession={handleResumeSession}
                        initialMode={welcomeModalMode}
                    />
                )}
            </>
        );
    }

    // Wrapped View (modal-based) - full screen wrapped experience
    if (showWrappedView && wrappedConfig) {
        return (
            <div className="wrapped-transition-enter">
                <WrappedFeature 
                    onClose={handleWrappedViewClose}
                    initialYear={wrappedConfig.year}
                    initialUser={wrappedConfig.user}
                    initialYearData={wrappedConfig.yearData}
                    groupTitle={wrappedConfig.groupTitle}
                />
            </div>
        );
    }

    // Story View — full screen narrative experience
    if (activeView === 'story' && processedData) {
        return (
            <StoryPage
                aggregates={filteredAggregates || aggregates}
                processedData={processedData}
                conversationTitle={isDemo ? DEMO_CONVERSATION.title : activeConversation?.title}
                onBack={handleStoryBack}
            />
        );
    }

    // Processing state - show loading while data is being prepared
    if (!processedData || (dataLoadStatus === 'loaded' && !initialLoadComplete.current)) {
        return (
            <>
                <div className="fixed inset-0 z-40 bg-white flex items-center justify-center">
                    <div className="text-center">
                        <div className="font-mono text-sm uppercase tracking-widest text-neutral-900 font-medium">
                            Processing data...
                        </div>
                    </div>
                </div>
                {showWelcomeModal && (
                    <WelcomeModal
                        onDemoSelect={handleDemoSelect}
                        onDataLoaded={handleDataLoaded}
                        onResumeSession={handleResumeSession}
                        initialMode={welcomeModalMode}
                    />
                )}
            </>
        );
    }

    // Empty state - only show if processing is complete but no messages
    if (processedData.stats.total_messages === 0 && initialLoadComplete.current) {
        return (
            <>
                <div className="min-h-screen bg-brutal-primary text-brutal-primary p-8 font-display">
                    <header className="mb-16">
                        <div className="font-mono text-[12px] uppercase tracking-widest text-neutral-400 mb-2">Messenger Analytics</div>
                        <h1 className="font-display text-3xl font-semibold tracking-tight">
                            No Data Selected
                        </h1>
                    </header>
                    <div className="flex flex-col items-center justify-center h-[60vh]">
                        <span className="font-mono text-5xl mb-6 text-neutral-300">—</span>
                        <h2 className="font-display text-xl font-semibold mb-2">No messages found</h2>
                        <p className="font-mono text-[12px] text-neutral-500 mb-8">Select at least one user and year to view analytics.</p>
                        <button
                            onClick={handleClearAllFilters}
                            className="btn-brutal-filled"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>
                {showWelcomeModal && (
                    <WelcomeModal
                        onDemoSelect={handleDemoSelect}
                        onDataLoaded={handleDataLoaded}
                        onResumeSession={handleResumeSession}
                        initialMode={welcomeModalMode}
                    />
                )}
            </>
        );
    }

    // Filter bar props
    const filterProps = {
        allYears,
        allUsers,
        selectedYears,
        selectedUsers,
        userDisplayNames,
        showYearFilter,
        showUserFilter,
        onToggleYearFilter: toggleYearFilter,
        onToggleUserFilter: toggleUserFilter,
        onYearsApply: setSelectedYears,
        onUsersApply: setSelectedUsers,
        onClose: closeAllFilters,
    };

    // Conversation selector props
    const conversationProps = {
        conversations: isDemo ? [DEMO_CONVERSATION] : conversations,
        activeConversation: isDemo ? DEMO_CONVERSATION : activeConversation,
        onConversationChange: handleConversationSwitch,
        isDemo,
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 font-display selection:bg-accent/10 selection:text-accent">
            <UpdatingOverlay show={isUpdating} progress={updatingProgress} phase={updatingPhase} />
            
            {/* Welcome Modal */}
            {showWelcomeModal && (
                <WelcomeModal
                    onDemoSelect={handleDemoSelect}
                    onDataLoaded={handleDataLoaded}
                    onResumeSession={handleResumeSession}
                    initialMode={welcomeModalMode}
                />
            )}
            
            {/* Menu Drawer */}
            <MenuDrawer
                isOpen={showMenuDrawer}
                onClose={handleMenuClose}
                onUploadClick={handleUploadClick}
                onWrappedClick={handleWrappedClick}
                onDeleteData={handleDeleteData}
                dataInfo={dataInfo}
                activeView={activeView}
                onAnalyticsClick={handleAnalyticsClick}
                onContentClick={handleContentClick}
                onStoryClick={handleStoryClick}
            />

            {/* Header */}
            <Header
                conversationProps={conversationProps}
                onMenuClick={handleMenuClick}
                onUploadClick={handleUploadClick}
                onWrappedClick={handleWrappedClick}
                isDemo={isDemo}
                activeView={activeView}
                onAnalyticsClick={handleAnalyticsClick}
                onContentClick={handleContentClick}
            />
            
            {/* Wrapped Modal */}
            <WrappedModal
                isOpen={showWrappedModal}
                onClose={handleWrappedClose}
                onStart={handleWrappedStart}
                aggregates={aggregates}
                groupTitle={activeConversation?.title || 'Group Chat'}
            />

            {/* Click outside handler for filter dropdowns */}
            {(showYearFilter || showUserFilter) && (
                <div 
                    className="fixed inset-0 z-30" 
                    onClick={closeAllFilters}
                />
            )}

            {/* Main Content */}
            <main className="pt-20 pb-32 max-w-[1400px] mx-auto px-6 lg:px-8">
                {/* Filter Bar - Now in content area */}
                <div className="content-filter-bar mb-8 flex items-center gap-3">
                    <FilterBar {...filterProps} />
                </div>

                {/* Analytics View */}
                {activeView === 'analytics' && (
                    <AnalyticsPage
                        processedData={processedData}
                        filteredMessages={filteredMessages}
                        aggregates={filteredAggregates || aggregates}
                        isFiltered={isFiltered}
                        selectedYears={selectedYears}
                        selectedUsers={selectedUsers}
                        allYears={allYears}
                        allUsers={allUsers}
                        onRemoveYear={handleRemoveYear}
                        onResetUsers={handleResetUsers}
                        onClearAllFilters={handleClearAllFilters}
                    />
                )}

                {/* Content Analysis View */}
                {activeView === 'content' && (
                    <ContentPage
                        processedData={processedData}
                        aggregates={filteredAggregates || aggregates}
                        isFiltered={isFiltered}
                        selectedYears={selectedYears}
                        selectedUsers={selectedUsers}
                        allYears={allYears}
                        allUsers={allUsers}
                        onRemoveYear={handleRemoveYear}
                        onResetUsers={handleResetUsers}
                        onClearAllFilters={handleClearAllFilters}
                    />
                )}
            </main>
            <Analytics />
        </div>
    );
}

export default App;
