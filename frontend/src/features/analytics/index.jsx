import React from 'react';
import { ActiveFilters } from '../../components/layout';
import {
    StatTilesSection,
    ActivitySection,
    UsersSection,
    ReactionsSection,
} from './components';

/**
 * Analytics Page
 * ==============
 * Main analytics dashboard with all chart sections.
 * Focuses on reactions, relationships, and activity patterns.
 * 
 * @param {Object} props
 * @param {Object} props.processedData - Processed analytics data
 * @param {Object[]} props.filteredMessages - Filtered messages array
 * @param {Object} props.aggregates - Precomputed aggregates
 * @param {boolean} props.isFiltered - Whether filters are active
 * @param {number[]} props.selectedYears - Currently selected years
 * @param {string[]} props.selectedUsers - Currently selected users
 * @param {number[]} props.allYears - All available years
 * @param {string[]} props.allUsers - All available users
 * @param {function} props.onRemoveYear - Callback to remove a year filter
 * @param {function} props.onResetUsers - Callback to reset user filter
 * @param {function} props.onClearAllFilters - Callback to clear all filters
 */
export default function AnalyticsPage({
    processedData,
    filteredMessages,
    aggregates,
    isFiltered,
    selectedYears,
    selectedUsers,
    allYears,
    allUsers,
    onRemoveYear,
    onResetUsers,
    onClearAllFilters,
}) {
    if (!processedData) return null;
    
    const { stats, patterns, users, emojis, networkMatrix } = processedData;

    return (
        <div className="animate-fade-in">
            {/* Active Filters Display */}
            <ActiveFilters
                selectedYears={selectedYears}
                allYears={allYears}
                selectedUsers={selectedUsers}
                allUsers={allUsers}
                onRemoveYear={onRemoveYear}
                onResetUsers={onResetUsers}
                onClearAll={onClearAllFilters}
            />
            
            {/* STAT TILES */}
            <StatTilesSection stats={stats} />

            {/* ACTIVITY SECTION */}
            <ActivitySection 
                messages={filteredMessages} 
                aggregates={aggregates} 
                isFiltered={isFiltered} 
            />

            {/* USERS SECTION */}
            <UsersSection 
                patterns={patterns} 
                messages={filteredMessages}
                reactionUsers={users}
                networkMatrix={networkMatrix}
                selectedUsers={selectedUsers}
                aggregates={aggregates}
            />

            {/* REACTIONS SECTION */}
            <ReactionsSection
                users={users}
                emojis={emojis}
                networkMatrix={networkMatrix}
                selectedUsers={selectedUsers}
                messages={filteredMessages}
                selectedYears={selectedYears}
                aggregates={aggregates}
            />
        </div>
    );
}
