import React from 'react';
import StatTile from '../../../components/StatTile';

/**
 * Stat Tiles Section
 * ==================
 * Hero metrics display at the top of analytics page.
 * One big KPI (total messages) + 4 secondary KPIs in a row.
 * Responsive: 2x2 grid on mobile, single row on desktop.
 * 
 * @param {Object} props
 * @param {Object} props.stats - Stats object with total_messages, active_members, days_active, total_reactions, avg_per_month
 */
export default function StatTilesSection({ stats }) {
    const yearsActive = Math.round((stats.days_active / 365) * 10) / 10;
    
    return (
        <section className="mb-10 lg:mb-12">
            {/* Hero Metric - Full width row */}
            <div className="mb-10 lg:mb-12">
                <StatTile
                    label="Total Messages"
                    rawValue={stats.total_messages}
                    delay={0}
                    size="hero"
                />
            </div>
            
            {/* Secondary Metrics - 2x2 grid on mobile, spread evenly on desktop */}
            <div className="grid grid-cols-2 gap-y-6 gap-x-8 sm:flex sm:justify-between sm:gap-x-8 max-w-4xl">
                <StatTile
                    label="Members"
                    rawValue={stats.active_members}
                    delay={1}
                    size="secondary"
                />
                <StatTile
                    label="Years Active"
                    rawValue={yearsActive}
                    delay={2}
                    isDecimal={true}
                    size="secondary"
                />
                <StatTile
                    label="Avg/Month"
                    rawValue={stats.avg_per_month || 0}
                    delay={3}
                    size="secondary"
                />
                <StatTile
                    label="Reactions"
                    rawValue={stats.total_reactions || 0}
                    delay={4}
                    size="secondary"
                />
            </div>
        </section>
    );
}


