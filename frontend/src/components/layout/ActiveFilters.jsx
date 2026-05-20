import React from 'react';

/**
 * Active Filters Component
 * ========================
 * Displays currently active filter tags with remove buttons.
 * 
 * @param {Object} props
 * @param {number[]} props.selectedYears - Currently selected years
 * @param {number[]} props.allYears - All available years
 * @param {string[]} props.selectedUsers - Currently selected users
 * @param {string[]} props.allUsers - All available users
 * @param {function} props.onRemoveYear - Callback to remove a year
 * @param {function} props.onResetUsers - Callback to reset user filter
 * @param {function} props.onClearAll - Callback to clear all filters
 */
export default function ActiveFilters({
    selectedYears,
    allYears,
    selectedUsers,
    allUsers,
    onRemoveYear,
    onResetUsers,
    onClearAll,
}) {
    const isAllYearsSelected = selectedYears.length === allYears.length;
    const isAllUsersSelected = selectedUsers.length === allUsers.length;
    
    // Don't show if all filters are at default
    if (isAllYearsSelected && isAllUsersSelected) {
        return null;
    }

    return (
        <div className="mb-12 flex flex-wrap items-center gap-3">
            <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-neutral-300">
                Active:
            </span>
            
            {/* Year tags */}
            {!isAllYearsSelected && selectedYears.map(year => (
                <span 
                    key={year} 
                    className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-900 text-white font-mono text-[12px]"
                >
                    {year}
                    <button 
                        onClick={() => onRemoveYear(year)} 
                        className={`ml-0.5 opacity-60 hover:opacity-100 ${
                            selectedYears.length <= 1 ? 'opacity-20 cursor-not-allowed' : ''
                        }`}
                        disabled={selectedYears.length <= 1}
                    >
                        ×
                    </button>
                </span>
            ))}
            
            {/* User count tag */}
            {!isAllUsersSelected && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-900 text-white font-mono text-[12px]">
                    {selectedUsers.length} users
                    <button 
                        onClick={onResetUsers} 
                        className="ml-0.5 opacity-60 hover:opacity-100"
                    >
                        ×
                    </button>
                </span>
            )}
            
            {/* Clear all button */}
            <button 
                onClick={onClearAll}
                className="font-mono text-[12px] uppercase tracking-[0.15em] text-neutral-400 hover:text-neutral-900 ml-2"
            >
                Clear all
            </button>
        </div>
    );
}


