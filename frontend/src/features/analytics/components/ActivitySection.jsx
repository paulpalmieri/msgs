import React from 'react';
import { TimelineChart, DistributionChart } from '../../../components/DynamicChart';
// NOTE: CalendarHeatmap removed from display (Dec 2024) - component still exists if needed
// import CalendarHeatmap from '../../../components/CalendarHeatmap';

/**
 * Activity Section
 * ================
 * Displays temporal activity patterns:
 * - Timeline chart (messages over time)
 * - Distribution chart (by hour/day)
 * 
 * @param {Object} props
 * @param {Object[]} props.messages - Filtered messages array
 * @param {Object} props.aggregates - Precomputed aggregates
 * @param {boolean} props.isFiltered - Whether filters are active
 */
export default function ActivitySection({ messages, aggregates, isFiltered }) {
    return (
        <section className="mb-14 lg:mb-18">
            <div className="section-divider section-divider-first">
                <div className="section-divider-label">01</div>
                <h2 className="section-divider-title">ACTIVITY</h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div>
                    <TimelineChart 
                        messages={messages} 
                        defaultMode="month" 
                        aggregates={aggregates} 
                        isFiltered={isFiltered} 
                    />
                </div>
                <div>
                    <DistributionChart 
                        messages={messages} 
                        defaultMode="hour" 
                        aggregates={aggregates} 
                        isFiltered={isFiltered} 
                    />
                </div>
            </div>
        </section>
    );
}


