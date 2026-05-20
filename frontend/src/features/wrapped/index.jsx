import React, { useMemo } from 'react';
import { useStoryNavigation } from './hooks';
import { StoryViewer } from './components';
import { buildStories } from './stories/buildStories.jsx';

/**
 * Wrapped Feature
 * ===============
 * Spotify Wrapped-style year in review experience.
 * Now expects year, user, and yearData to be pre-selected via the WrappedModal.
 * 
 * @param {Object} props
 * @param {function} props.onClose - Callback when closing wrapped (returns to modal)
 * @param {number} props.initialYear - Selected year (from modal)
 * @param {string} props.initialUser - Selected user (from modal)
 * @param {Object} props.initialYearData - Pre-processed year data (from modal)
 * @param {string} props.groupTitle - Title of the group/conversation
 */
export default function WrappedFeature({ onClose, initialYear, initialUser, initialYearData, groupTitle }) {
    // Extract users sorted by message count
    const users = useMemo(() => {
        if (!initialYearData) return [];
        return Object.keys(initialYearData.users).sort((a, b) => 
            initialYearData.users[b].messages - initialYearData.users[a].messages
        );
    }, [initialYearData]);

    // Build stories
    const stories = useMemo(() => {
        if (!initialUser || !initialYearData) return [];
        return buildStories({
            selectedUser: initialUser,
            selectedYear: initialYear,
            yearData: initialYearData,
            users,
            groupTitle,
            onRestart: onClose
        });
    }, [initialUser, initialYear, initialYearData, users, groupTitle, onClose]);

    // Story navigation
    const {
        storyIndex,
        progress,
        next,
        prev,
        pause,
        resume,
    } = useStoryNavigation(stories.length, stories.length > 0);

    // Need valid data to render
    if (!initialYear || !initialUser || !initialYearData || stories.length === 0) {
        return null;
    }

    return (
        <StoryViewer
            stories={stories}
            storyIndex={storyIndex}
            progress={progress}
            onNext={next}
            onPrev={prev}
            onPause={pause}
            onResume={resume}
            onClose={onClose}
        />
    );
}
