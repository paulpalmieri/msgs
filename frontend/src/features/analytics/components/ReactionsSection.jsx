import React from 'react';
import ReactionsAnalysis from '../../../components/ReactionsAnalysis';

/**
 * Reactions Section
 * =================
 * Displays reaction analytics and emoji usage.
 * 
 * @param {Object} props
 * @param {Object} props.users - User stats object
 * @param {Object} props.emojis - Emoji usage counts
 * @param {Object} props.networkMatrix - User interaction matrix
 * @param {string[]} props.selectedUsers - Currently selected users
 * @param {Object[]} props.messages - Filtered messages array
 * @param {number[]} props.selectedYears - Currently selected years
 * @param {Object} props.aggregates - Pre-computed aggregates
 */
export default function ReactionsSection({ 
    users, 
    emojis, 
    networkMatrix, 
    selectedUsers, 
    messages, 
    selectedYears,
    aggregates 
}) {
    return (
        <section className="mb-14 lg:mb-18">
            <div className="section-divider">
                <div className="section-divider-label">03</div>
                <h2 className="section-divider-title">REACTIONS</h2>
            </div>
            
            <ReactionsAnalysis
                users={users}
                emojis={emojis}
                networkMatrix={networkMatrix}
                selectedUsers={selectedUsers}
                messages={messages}
                selectedYears={selectedYears}
                aggregates={aggregates}
            />
        </section>
    );
}


