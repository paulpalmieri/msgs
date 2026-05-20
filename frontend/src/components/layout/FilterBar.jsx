import React from 'react';
import { YearDropdownPanel, UserDropdownPanel } from '../FilterDropdowns';

/**
 * Filter Bar Component
 * ====================
 * Year and User filter buttons with dropdown panels.
 * Used in the header for filtering analytics data.
 * 
 * @param {Object} props
 * @param {number[]} props.allYears - All available years
 * @param {string[]} props.allUsers - All available user names
 * @param {number[]} props.selectedYears - Currently selected years
 * @param {string[]} props.selectedUsers - Currently selected users
 * @param {Object} props.userDisplayNames - Map of full name to display name
 * @param {boolean} props.showYearFilter - Whether year dropdown is open
 * @param {boolean} props.showUserFilter - Whether user dropdown is open
 * @param {function} props.onToggleYearFilter - Toggle year dropdown
 * @param {function} props.onToggleUserFilter - Toggle user dropdown
 * @param {function} props.onYearsApply - Callback when years are applied
 * @param {function} props.onUsersApply - Callback when users are applied
 * @param {function} props.onClose - Close all dropdowns
 */
export default function FilterBar({
    allYears,
    allUsers,
    selectedYears,
    selectedUsers,
    userDisplayNames,
    showYearFilter,
    showUserFilter,
    onToggleYearFilter,
    onToggleUserFilter,
    onYearsApply,
    onUsersApply,
    onClose,
}) {
    const isAllYearsSelected = selectedYears.length === allYears.length;
    const isAllUsersSelected = selectedUsers.length === allUsers.length;

    return (
        <div className="flex items-center gap-0.5 md:gap-1">
            {/* YEAR FILTER */}
            <div className="relative flex items-center">
                <button
                    onClick={onToggleYearFilter}
                    className={`flex items-center justify-center gap-1 h-8 px-2 md:px-3 font-mono text-[12px] md:text-[12px] uppercase tracking-widest transition-colors leading-none ${
                        showYearFilter 
                            ? 'bg-neutral-900 text-white' 
                            : isAllYearsSelected 
                                ? 'text-neutral-400 hover:bg-neutral-900 hover:text-white' 
                                : 'bg-neutral-900 text-white font-medium'
                    }`}
                >
                    <span className="hidden sm:inline">
                        {isAllYearsSelected ? 'Years' : `${selectedYears.length} Year${selectedYears.length !== 1 ? 's' : ''}`}
                    </span>
                    <span className="sm:hidden">
                        {isAllYearsSelected ? 'Years' : selectedYears.length}
                    </span>
                    <span className={`transition-transform ${showYearFilter ? 'rotate-180' : ''}`}>↓</span>
                </button>
                
                {showYearFilter && (
                    <YearDropdownPanel
                        allYears={allYears}
                        initialSelection={selectedYears}
                        onApply={(years) => { onYearsApply(years); onClose(); }}
                        onCancel={onClose}
                    />
                )}
            </div>
            
            {/* USER FILTER */}
            <div className="relative flex items-center">
                <button
                    onClick={onToggleUserFilter}
                    className={`flex items-center justify-center gap-1 h-8 px-2 md:px-3 font-mono text-[12px] md:text-[12px] uppercase tracking-widest transition-colors leading-none ${
                        showUserFilter 
                            ? 'bg-neutral-900 text-white' 
                            : isAllUsersSelected 
                                ? 'text-neutral-400 hover:bg-neutral-900 hover:text-white' 
                                : 'bg-neutral-900 text-white font-medium'
                    }`}
                >
                    <span className="hidden sm:inline">
                        {isAllUsersSelected ? 'Users' : `${selectedUsers.length} User${selectedUsers.length !== 1 ? 's' : ''}`}
                    </span>
                    <span className="sm:hidden">
                        {isAllUsersSelected ? 'Users' : selectedUsers.length}
                    </span>
                    <span className={`transition-transform ${showUserFilter ? 'rotate-180' : ''}`}>↓</span>
                </button>
                
                {showUserFilter && (
                    <UserDropdownPanel
                        allUsers={allUsers}
                        initialSelection={selectedUsers}
                        userDisplayNames={userDisplayNames}
                        onApply={(users) => { onUsersApply(users); onClose(); }}
                        onCancel={onClose}
                    />
                )}
            </div>
        </div>
    );
}


