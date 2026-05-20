/**
 * Shared formatting utilities
 */

/**
 * Format a full name as "FirstName L."
 * @param {string} fullName - Full name like "John Doe"
 * @returns {string} Formatted name like "John D."
 */
export const formatName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
};

