import React, { useState } from 'react';
import { STYLES, COLORS } from '../../../design';

// Common French stop words
const FRENCH_STOP_WORDS = [
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
    'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
    'me', 'te', 'se', 'lui', 'leur', 'ce', 'ça', 'cela', 'ceci',
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
    'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
    'qui', 'que', 'quoi', 'dont', 'où', 'ou',
    'et', 'ou', 'mais', 'donc', 'car', 'ni', 'si', 'que',
    'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'chez', 'vers',
    'en', 'y', 'ne', 'pas', 'plus', 'moins', 'très', 'trop', 'bien',
    'être', 'avoir', 'faire', 'aller', 'voir', 'venir', 'dire', 'pouvoir', 'vouloir',
    'est', 'sont', 'suis', 'es', 'sommes', 'êtes', 'était', 'été',
    'ai', 'as', 'avons', 'avez', 'ont', 'eu',
    'fait', 'fais', 'font', 'va', 'vais', 'vont', 'allé',
    'tout', 'tous', 'toute', 'toutes', 'rien', 'quelque', 'chaque',
    'même', 'autre', 'autres', 'quel', 'quelle', 'quels', 'quelles',
    'cette', 'ces', 'celui', 'celle', 'ceux', 'celles',
    'quand', 'comme', 'comment', 'pourquoi', 'parce',
    'oui', 'non', 'peut', 'aussi', 'encore', 'déjà', 'toujours', 'jamais',
    'alors', 'donc', 'enfin', 'puis', 'après', 'avant', 'maintenant',
    'ici', 'voilà', 'là', 'bon', 'bonne', 'petit', 'petite', 'grand', 'grande',
    'juste', 'vrai', 'vraiment', 'soir', 'matin', 'jour', 'fois',
    'peu', 'beaucoup', 'assez', 'tellement', 'combien',
];

// Common English stop words
const ENGLISH_STOP_WORDS = [
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'ours', 'theirs',
    'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
    'and', 'or', 'but', 'if', 'because', 'as', 'while', 'of', 'at', 'by', 'for',
    'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'can', 'now',
    'get', 'got', 'go', 'going', 'gone', 'come', 'came', 'say', 'said', 'know', 'knew',
    'think', 'thought', 'see', 'saw', 'want', 'wanted', 'look', 'looked', 'use', 'used',
    'make', 'made', 'give', 'gave', 'take', 'took', 'tell', 'told', 'feel', 'felt',
    'yes', 'no', 'yeah', 'okay', 'ok', 'well', 'like', 'really', 'actually', 'basically',
    'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'maybe', 'probably',
    'thing', 'things', 'stuff', 'something', 'anything', 'nothing', 'everything',
    'time', 'times', 'day', 'days', 'way', 'ways', 'lot', 'lots',
];

/**
 * Excluded Words Panel
 * Allows users to exclude common/stop words from content analysis
 */
export default function ExcludedWordsPanel({ excludedWords = [], onChange }) {
    const [inputValue, setInputValue] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleAddWord = (word) => {
        const normalized = word.toLowerCase().trim();
        if (normalized && !excludedWords.includes(normalized)) {
            onChange([...excludedWords, normalized]);
        }
        setInputValue('');
    };

    const handleRemoveWord = (word) => {
        onChange(excludedWords.filter(w => w !== word));
    };

    const handleAddPreset = (preset) => {
        const newWords = preset.filter(w => !excludedWords.includes(w));
        if (newWords.length > 0) {
            onChange([...excludedWords, ...newWords]);
        }
    };

    const handleClearAll = () => {
        onChange([]);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddWord(inputValue);
        }
    };

    return (
        <div className="mb-8 p-4 bg-neutral-50 border border-neutral-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2"
                >
                    <svg
                        className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className={STYLES.dataLabel}>
                        Excluded Words
                        {excludedWords.length > 0 && (
                            <span className="ml-2 text-accent">({excludedWords.length})</span>
                        )}
                    </span>
                </button>

                {excludedWords.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        className="font-mono text-[11px] uppercase tracking-wider text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Collapsed View - Show word count or quick preview */}
            {!isExpanded && excludedWords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {excludedWords.slice(0, 15).map(word => (
                        <span
                            key={word}
                            className="px-2 py-0.5 bg-neutral-200 text-neutral-600 font-mono text-[11px]"
                        >
                            {word}
                        </span>
                    ))}
                    {excludedWords.length > 15 && (
                        <span className="px-2 py-0.5 text-neutral-400 font-mono text-[11px]">
                            +{excludedWords.length - 15} more
                        </span>
                    )}
                </div>
            )}

            {/* Expanded View */}
            {isExpanded && (
                <div className="space-y-4">
                    {/* Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type a word to exclude..."
                            className="flex-1 px-3 py-2 font-mono text-[13px] border border-neutral-300 bg-white focus:border-accent focus:outline-none"
                        />
                        <button
                            onClick={() => handleAddWord(inputValue)}
                            disabled={!inputValue.trim()}
                            className="px-4 py-2 font-mono text-[11px] uppercase tracking-wider bg-neutral-900 text-white hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add
                        </button>
                    </div>

                    {/* Preset Buttons */}
                    <div className="flex flex-wrap gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 self-center mr-2">
                            Presets:
                        </span>
                        <button
                            onClick={() => handleAddPreset(FRENCH_STOP_WORDS)}
                            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider bg-white border border-neutral-300 text-neutral-600 hover:border-accent hover:text-accent transition-colors"
                        >
                            + French Stop Words
                        </button>
                        <button
                            onClick={() => handleAddPreset(ENGLISH_STOP_WORDS)}
                            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider bg-white border border-neutral-300 text-neutral-600 hover:border-accent hover:text-accent transition-colors"
                        >
                            + English Stop Words
                        </button>
                        <button
                            onClick={() => handleAddPreset([...FRENCH_STOP_WORDS, ...ENGLISH_STOP_WORDS])}
                            className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider bg-white border border-neutral-300 text-neutral-600 hover:border-accent hover:text-accent transition-colors"
                        >
                            + Both
                        </button>
                    </div>

                    {/* Current Excluded Words */}
                    {excludedWords.length > 0 && (
                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 mb-2">
                                Click to remove:
                            </p>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {excludedWords.map(word => (
                                    <button
                                        key={word}
                                        onClick={() => handleRemoveWord(word)}
                                        className="group flex items-center gap-1 px-2 py-0.5 bg-neutral-200 hover:bg-red-100 text-neutral-600 hover:text-red-600 font-mono text-[11px] transition-colors"
                                    >
                                        {word}
                                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {excludedWords.length === 0 && (
                        <p className="font-mono text-[11px] text-neutral-400">
                            No words excluded. Add words manually or use a preset to filter common words from all sections.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
