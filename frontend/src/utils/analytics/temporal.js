/**
 * Temporal Analytics Processing
 * =============================
 * Monthly, hourly, and daily distribution statistics.
 */

import { format, getHours, getDay } from 'date-fns';
import { DAYS } from './helpers';

/**
 * Process temporal distribution data from messages
 * @param {Object[]} messages - Array of message objects
 * @returns {Object} Temporal stats: monthly, hourly, daily
 */
export function processTemporalData(messages) {
    const monthly = {};
    const hourly = {};
    const daily = {};

    messages.forEach(msg => {
        const date = new Date(msg.timestamp_ms);
        const monthKey = format(date, "MMM ''yy");
        const hourKey = getHours(date);
        const dayIndex = getDay(date);
        const dayKey = DAYS[dayIndex];

        monthly[monthKey] = (monthly[monthKey] || 0) + 1;
        hourly[hourKey] = (hourly[hourKey] || 0) + 1;
        daily[dayKey] = (daily[dayKey] || 0) + 1;
    });

    return { monthly, hourly, daily };
}

/**
 * Calculate basic stats from messages
 * @param {Object[]} messages - Array of message objects
 * @returns {Object} Basic stats: total_messages, active_members, days_active, dates, total_reactions, avg_per_month
 */
export function processBasicStats(messages) {
    if (!messages || messages.length === 0) {
        return {
            total_messages: 0,
            active_members: 0,
            days_active: 0,
            first_date: null,
            last_date: null,
            total_reactions: 0,
            avg_per_month: 0
        };
    }

    const total_messages = messages.length;
    const senders = new Set(messages.map(m => m.sender_name));
    const active_members = senders.size;
    
    // Count total reactions
    let total_reactions = 0;
    const months = new Set();

    let minTimestamp = Infinity;
    let maxTimestamp = -Infinity;
    messages.forEach(m => {
        if (m.timestamp_ms < minTimestamp) minTimestamp = m.timestamp_ms;
        if (m.timestamp_ms > maxTimestamp) maxTimestamp = m.timestamp_ms;
        
        // Count reactions
        if (m.reactions && Array.isArray(m.reactions)) {
            total_reactions += m.reactions.length;
        }
        
        // Track unique months for average calculation
        const date = new Date(m.timestamp_ms);
        months.add(`${date.getFullYear()}-${date.getMonth()}`);
    });

    const minDate = new Date(minTimestamp);
    const maxDate = new Date(maxTimestamp);
    const days_active = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) || 1;
    
    // Calculate average messages per month
    const monthCount = months.size || 1;
    const avg_per_month = Math.round(total_messages / monthCount);

    return {
        total_messages,
        active_members,
        days_active,
        first_date: minDate,
        last_date: maxDate,
        total_reactions,
        avg_per_month
    };
}


