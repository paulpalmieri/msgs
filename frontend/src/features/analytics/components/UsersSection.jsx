import React from 'react';
import UsersAnalysis from '../../../components/UsersAnalysis';

/**
 * Users Section
 * =============
 * Displays user-level analytics and patterns.
 * 
 * @param {Object} props
 * @param {Object} props.patterns - User patterns data
 * @param {Object[]} props.messages - Filtered messages array
 * @param {Object} props.reactionUsers - User reaction stats
 * @param {Object} props.networkMatrix - User interaction matrix
 * @param {string[]} props.selectedUsers - Currently selected users
 * @param {Object} props.aggregates - Pre-computed aggregates
 */
export default function UsersSection({ 
    patterns, 
    messages, 
    reactionUsers, 
    networkMatrix, 
    selectedUsers,
    aggregates 
}) {
    return (
        <section className="mb-14 lg:mb-18">
            <div className="section-divider">
                <div className="section-divider-label">02</div>
                <h2 className="section-divider-title">USERS</h2>
            </div>
            
            <UsersAnalysis 
                data={patterns} 
                messages={messages}
                reactionUsers={reactionUsers}
                networkMatrix={networkMatrix}
                selectedUsers={selectedUsers}
                aggregates={aggregates}
            />
        </section>
    );
}
