/**
 * Evolution Section
 * =================
 * NOTE: This section was removed from the main analytics page display in Dec 2024.
 * The component is kept here in case we want to re-enable it in the future.
 * To re-enable: export from ./index.js and add to analytics/index.jsx
 */

import React from 'react';
import EvolutionAnalysis from '../../../components/EvolutionAnalysis';

/**
 * Displays year-over-year evolution and trends.
 * 
 * @param {Object} props
 * @param {Object} props.aggregates - Precomputed aggregates with yearly data
 * @param {number[]} props.selectedYears - Currently selected years
 * @param {string[]} props.selectedUsers - Currently selected users
 */
export default function EvolutionSection({ aggregates, selectedYears, selectedUsers }) {
    if (!aggregates) return null;
    
    return (
        <section>
            <div className="section-divider">
                <div className="section-divider-label">05</div>
                <h2 className="section-divider-title">EVOLUTION</h2>
            </div>
            
            <EvolutionAnalysis 
                aggregates={aggregates} 
                selectedYears={selectedYears}
                selectedUsers={selectedUsers}
            />
        </section>
    );
}


