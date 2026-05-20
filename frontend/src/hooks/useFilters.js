import { useState, useMemo, useCallback } from 'react';

/**
 * Hook for managing filter state (users and years)
 * Provides memoized Sets for O(1) lookups and computed display states
 * 
 * @param {string[]} allUsers - All available user names
 * @param {number[]} allYears - All available years
 * @returns {Object} Filter state and methods
 */
export function useFilters(allUsers = [], allYears = []) {
    // Selected filters (initialized to all when available)
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    
    // Filter panel visibility
    const [showYearFilter, setShowYearFilter] = useState(false);
    const [showUserFilter, setShowUserFilter] = useState(false);

    // Memoized Sets for O(1) lookups
    const selectedUsersSet = useMemo(() => new Set(selectedUsers), [selectedUsers]);
    const selectedYearsSet = useMemo(() => new Set(selectedYears), [selectedYears]);

    // Computed display states
    const isAllYearsSelected = selectedYears.length === allYears.length;
    const isAllUsersSelected = selectedUsers.length === allUsers.length;
    const isFiltered = !isAllYearsSelected || !isAllUsersSelected;

    // Precomputed display names
    const userDisplayNames = useMemo(() => {
        const names = {};
        allUsers.forEach(user => {
            const parts = user.split(' ');
            names[user] = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
        });
        return names;
    }, [allUsers]);

    // Filter actions
    const handleRemoveYear = useCallback((year) => {
        if (selectedYears.length <= 1) return;
        setSelectedYears(prev => prev.filter(y => y !== year));
    }, [selectedYears.length]);

    const handleClearAllFilters = useCallback(() => {
        setSelectedYears(allYears);
        setSelectedUsers(allUsers);
    }, [allYears, allUsers]);

    const handleResetUsers = useCallback(() => {
        setSelectedUsers(allUsers);
    }, [allUsers]);

    // Panel toggle handlers
    const toggleYearFilter = useCallback(() => {
        setShowYearFilter(prev => !prev);
        setShowUserFilter(false);
    }, []);

    const toggleUserFilter = useCallback(() => {
        setShowUserFilter(prev => !prev);
        setShowYearFilter(false);
    }, []);

    const closeAllFilters = useCallback(() => {
        setShowYearFilter(false);
        setShowUserFilter(false);
    }, []);

    return {
        // Selection state
        selectedUsers,
        setSelectedUsers,
        selectedYears,
        setSelectedYears,
        
        // Memoized sets for filtering
        selectedUsersSet,
        selectedYearsSet,
        
        // Computed states
        isAllYearsSelected,
        isAllUsersSelected,
        isFiltered,
        userDisplayNames,
        
        // Panel visibility
        showYearFilter,
        showUserFilter,
        setShowYearFilter,
        setShowUserFilter,
        
        // Actions
        handleRemoveYear,
        handleClearAllFilters,
        handleResetUsers,
        toggleYearFilter,
        toggleUserFilter,
        closeAllFilters,
    };
}

export default useFilters;

