/**
 * Session Storage Utility
 * =======================
 * Persists ALL conversation metadata and aggregates using IndexedDB for large data support.
 * Falls back gracefully and handles unlimited storage (within browser limits, typically GB).
 */

const DB_NAME = 'lore_db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const SESSION_KEY = 'main_session';

let dbPromise = null;

/**
 * Initialize and get the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function getDB() {
    if (dbPromise) return dbPromise;
    
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
    
    return dbPromise;
}

/**
 * Save data to IndexedDB
 * @param {string} key - Storage key
 * @param {Object} data - Data to store
 * @returns {Promise<boolean>}
 */
async function dbSet(key, data) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            const request = store.put({ id: key, data, savedAt: Date.now() });
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                console.error('IndexedDB put error:', request.error);
                reject(request.error);
            };
        });
    } catch (err) {
        console.error('Failed to save to IndexedDB:', err);
        return false;
    }
}

/**
 * Load data from IndexedDB
 * @param {string} key - Storage key
 * @returns {Promise<Object|null>}
 */
async function dbGet(key) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            
            const request = store.get(key);
            
            request.onsuccess = () => {
                resolve(request.result?.data || null);
            };
            request.onerror = () => {
                console.error('IndexedDB get error:', request.error);
                reject(request.error);
            };
        });
    } catch (err) {
        console.error('Failed to load from IndexedDB:', err);
        return null;
    }
}

/**
 * Delete data from IndexedDB
 * @param {string} key - Storage key
 * @returns {Promise<boolean>}
 */
async function dbDelete(key) {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.error('Failed to delete from IndexedDB:', err);
        return false;
    }
}

// ============================================================================
// Public API - All async functions
// ============================================================================

/**
 * Save ALL parsed conversations at once
 * @param {Object[]} conversations - Array of conversations with aggregates
 * @param {string} activeConversationId - ID of the conversation to set as active
 * @returns {Promise<boolean>} Success status
 */
export async function saveAllParsedConversations(conversations, activeConversationId) {
    const data = {
        version: 4, // IndexedDB version
        conversations: {},
        activeConversationId: activeConversationId || null,
        savedAt: Date.now(),
    };
    
    let savedCount = 0;
    for (const conv of conversations) {
        if (!conv.aggregates) continue;
        
        const totalMessages = conv.aggregates?.global?.total_messages || 0;
        
        data.conversations[conv.id] = {
            conversation: {
                id: conv.id,
                title: conv.title,
                participants: conv.participants || [],
                totalMessages,
                estimatedMessages: conv.estimatedMessages,
            },
            aggregates: conv.aggregates,
            savedAt: Date.now(),
        };
        savedCount++;
    }
    
    const success = await dbSet(SESSION_KEY, data);
    
    if (success) {
        // Estimate size for logging
        const sizeInMB = JSON.stringify(data).length / (1024 * 1024);
        console.log(`Saved ${savedCount} conversations to IndexedDB (${sizeInMB.toFixed(2)}MB)`);
    }
    
    return success;
}

/**
 * Save a single conversation with aggregates
 * @param {Object} aggregates - Computed aggregates
 * @param {Object} conversation - Conversation metadata
 * @param {boolean} setAsActive - Whether to set as active
 * @returns {Promise<boolean>}
 */
export async function saveConversation(aggregates, conversation, setAsActive = true) {
    const existing = await loadAllSessionData() || {
        version: 4,
        conversations: {},
        activeConversationId: null,
        savedAt: Date.now(),
    };
    
    const totalMessages = aggregates?.global?.total_messages || 0;
    const existingConv = existing.conversations[conversation.id];
    
    existing.conversations[conversation.id] = {
        conversation: {
            id: conversation.id,
            title: conversation.title,
            participants: conversation.participants || [],
            totalMessages,
            estimatedMessages: existingConv?.conversation?.estimatedMessages || conversation.estimatedMessages,
        },
        aggregates,
        savedAt: Date.now(),
    };
    
    if (setAsActive) {
        existing.activeConversationId = conversation.id;
    }
    
    existing.savedAt = Date.now();
    
    return dbSet(SESSION_KEY, existing);
}

/**
 * Load all session data
 * @returns {Promise<Object|null>}
 */
export async function loadAllSessionData() {
    return dbGet(SESSION_KEY);
}

/**
 * Load session data with the active conversation pre-selected
 * @returns {Promise<Object|null>}
 */
export async function loadSessionData() {
    const allData = await loadAllSessionData();
    if (!allData || !allData.conversations) return null;
    
    const conversationIds = Object.keys(allData.conversations);
    if (conversationIds.length === 0) return null;
    
    // Find conversations that have aggregates
    const parsedIds = conversationIds.filter(id => allData.conversations[id].aggregates != null);
    if (parsedIds.length === 0) return null;
    
    // Get active conversation (or first one if active is invalid)
    let activeId = allData.activeConversationId;
    if (!activeId || !allData.conversations[activeId]?.aggregates) {
        activeId = parsedIds[0];
    }
    
    const activeData = allData.conversations[activeId];
    
    // Build conversations array for dropdown
    const conversations = parsedIds.map(id => ({
        ...allData.conversations[id].conversation,
        hasAggregates: true,
    }));
    
    // Sort by message count (largest first)
    conversations.sort((a, b) => (b.totalMessages || 0) - (a.totalMessages || 0));
    
    // Build aggregates map
    const aggregatesMap = {};
    parsedIds.forEach(id => {
        aggregatesMap[id] = allData.conversations[id].aggregates;
    });
    
    return {
        conversations,
        aggregatesMap,
        activeConversation: activeData.conversation,
        activeAggregates: activeData.aggregates,
        savedAt: allData.savedAt,
    };
}

/**
 * Clear all saved session data
 * @returns {Promise<boolean>}
 */
export async function clearSessionData() {
    return dbDelete(SESSION_KEY);
}

/**
 * Update the active conversation ID
 * @param {string} conversationId - ID of conversation to set as active
 * @returns {Promise<boolean>}
 */
export async function setActiveConversation(conversationId) {
    const existing = await loadAllSessionData();
    if (!existing) return false;
    
    existing.activeConversationId = conversationId;
    existing.savedAt = Date.now();
    
    return dbSet(SESSION_KEY, existing);
}

/**
 * Check if valid session data exists (sync check using cached promise)
 * @returns {Promise<Object|null>} Session metadata or null
 */
export async function getSessionInfo() {
    try {
        const allData = await loadAllSessionData();
        if (!allData || !allData.conversations) return null;
        
        const conversationIds = Object.keys(allData.conversations);
        if (conversationIds.length === 0) return null;
        
        // Find conversations with aggregates
        const parsedIds = conversationIds.filter(id => allData.conversations[id].aggregates != null);
        if (parsedIds.length === 0) return null;
        
        // Get active conversation info
        let activeId = allData.activeConversationId;
        if (!activeId || !allData.conversations[activeId]?.aggregates) {
            activeId = parsedIds[0];
        }
        
        const activeConv = allData.conversations[activeId].conversation;
        
        return {
            conversation: activeConv,
            savedAt: allData.savedAt,
            totalConversations: parsedIds.length,
            conversations: parsedIds.map(id => allData.conversations[id].conversation),
        };
    } catch (err) {
        return null;
    }
}

/**
 * Remove a specific conversation from storage
 * @param {string} conversationId - ID of conversation to remove
 * @returns {Promise<boolean>}
 */
export async function removeConversation(conversationId) {
    const existing = await loadAllSessionData();
    if (!existing || !existing.conversations) return false;
    
    delete existing.conversations[conversationId];
    
    // Update active if it was the removed one
    if (existing.activeConversationId === conversationId) {
        const remaining = Object.keys(existing.conversations);
        existing.activeConversationId = remaining.length > 0 ? remaining[0] : null;
    }
    
    if (Object.keys(existing.conversations).length === 0) {
        return clearSessionData();
    }
    
    return dbSet(SESSION_KEY, existing);
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string} Formatted date string
 */
export function formatSessionTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
    }
}

// Legacy exports for backwards compatibility
export async function saveSessionData(aggregates, conversation) {
    return saveConversation(aggregates, conversation, true);
}

export async function saveAllConversations(conversations) {
    // This is a no-op now since we save everything with aggregates
    return true;
}

export default {
    saveAllConversations,
    saveConversation,
    saveAllParsedConversations,
    saveSessionData,
    loadSessionData,
    loadAllSessionData,
    clearSessionData,
    removeConversation,
    setActiveConversation,
    getSessionInfo,
    formatSessionTimestamp,
};
