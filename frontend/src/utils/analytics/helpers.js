/**
 * Analytics Helper Functions
 * ==========================
 * Shared utilities for analytics processing.
 */

/**
 * Yield to browser for UI updates during heavy processing
 * @returns {Promise} Resolves after timeout
 */
export const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 5));

// =============================================================================
// STOPWORDS BY LANGUAGE
// =============================================================================

/**
 * French stopwords - articles, pronouns, verbs, prepositions
 */
const FRENCH_STOPWORDS = [
    // Contractions
    "c'est", "j'ai", "y'a", "t'es", "t'as", "qu'il", "c'etait", "c'était", "j'en", "j'y",
    "l'a", "l'ai", "l'on", "l'un", "l'une", "d'un", "d'une", "d'accord", "d'abord",
    "n'a", "n'ai", "n'est", "n'y", "n'en", "s'il", "s'est", "s'en",
    "qu'elle", "qu'on", "qu'est", "qu'un", "qu'une", "t'en", "m'a", "m'en",
    
    // Articles & pronouns
    "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux",
    "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
    "me", "te", "se", "moi", "toi", "lui", "soi", "eux",
    "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses",
    "notre", "votre", "leur", "nos", "vos", "leurs",
    "ce", "cet", "cette", "ces", "ceci", "cela", "ca", "ça",
    "qui", "que", "quoi", "dont", "ou", "où",
    
    // Common verbs
    "etre", "être", "est", "es", "suis", "sommes", "etes", "êtes", "sont", "etait", "était",
    "avoir", "ai", "as", "avons", "avez", "ont", "avais", "avait",
    "fais", "fait", "font", "faire", "faites", "faut",
    "vais", "vas", "va", "vont", "aller",
    "dis", "dit", "dire", "disent",
    "peux", "peut", "peuvent", "pouvoir",
    "vois", "voit", "voir",
    "sais", "sait", "savent", "savoir",
    "veux", "veut", "veulent", "vouloir",
    
    // Conjunctions & prepositions
    "et", "ou", "mais", "donc", "or", "ni", "car",
    "par", "pour", "sans", "avec", "dans", "sur", "sous", "entre", "vers", "chez",
    "comme", "si", "quand", "lorsque",
    
    // Adverbs & common words
    "oui", "non", "nan", "ouais",
    "bien", "tres", "très", "trop", "peu", "beaucoup",
    "plus", "moins", "aussi", "encore", "juste", "tout", "tous", "toute", "toutes",
    "meme", "même", "deja", "déjà", "maintenant", "jamais", "toujours",
    "bon", "bah", "ben", "euh", "hein", "genre", "alors", "puis",
    "ne", "pas", "rien", "personne", "autre", "autres",
    "truc", "trucs", "chose", "choses", "fois", "jour", "jours", "temps", "moment",
    "coup", "coups", "gens", "gars", "mec", "mecs", "meuf", "meufs",
];

/**
 * English stopwords - common function words
 */
const ENGLISH_STOPWORDS = [
    "the", "and", "you", "for", "are", "was", "have", "this", "that", "with",
    "call", "video", "like", "just", "know", "want", "think", "come", "take", "see",
    "it", "is", "in", "to", "of", "a", "be", "not", "but", "he", "she", "they", "we",
    "my", "your", "his", "her", "their", "our", "i", "me", "so", "if", "or", "as",
    "what", "do", "no", "yes", "ok", "got", "get", "can", "will", "would", "could",
    "been", "being", "had", "has", "did", "does", "an", "at", "by", "from", "up",
    "out", "on", "off", "over", "under", "again", "then", "once", "here", "there",
    "when", "where", "why", "how", "all", "each", "few", "more", "most", "other",
    "some", "such", "only", "own", "same", "than", "too", "very", "now",
];

/**
 * Chat slang & internet speak (language-agnostic)
 */
const CHAT_SLANG = [
    // Laughter
    "lol", "lool", "loool", "mdr", "ptdr", "xptdr", "haha", "hahaha", "hihi", "xd",
    
    // Abbreviations
    "ok", "omg", "wtf", "btw", "tbh", "idk", "nvm", "brb", "afk",
    "jsp", "jpp", "tkt", "stp", "svp", "rdv", "ptn",
    
    // Slang terms
    "frere", "frère", "frero", "bro", "sis",
    "gros", "wesh", "wallah", "askip", "cheh", "sah", "aled", "osef", "bg",
];

/**
 * Combined stopwords set for word frequency analysis
 */
export const STOP_WORDS = new Set([
    ...FRENCH_STOPWORDS,
    ...ENGLISH_STOPWORDS,
    ...CHAT_SLANG,
]);

// =============================================================================
// SENTIMENT ANALYSIS (Basic lexicon-based)
// =============================================================================

/**
 * Positive sentiment words (French-focused)
 * Note: This is a basic lexicon for demo purposes.
 * For production, consider using a proper NLP library.
 */
export const POSITIVE_WORDS = new Set([
    // French
    'bien', 'bon', 'bonne', 'super', 'cool', 'génial', 'top', 'excellent', 'parfait',
    'merci', 'adore', 'aime', 'heureux', 'joie', 'bravo', 'félicitations',
    'magnifique', 'beau', 'belle', 'joli', 'jolie', 'meilleur', 'mieux',
    'succès', 'victoire', 'gagner', 'fort', 'intelligent', 'sympa', 'gentil',
    'drôle', 'amusant', 'plaisir', 'bisous', 'bises', 'cœur',
    // English
    'love', 'great', 'good', 'nice', 'awesome', 'amazing', 'wonderful',
    'happy', 'thanks', 'beautiful', 'perfect', 'best', 'fun', 'funny',
]);

/**
 * Negative sentiment words (French-focused)
 */
export const NEGATIVE_WORDS = new Set([
    // French
    'nul', 'mauvais', 'terrible', 'horrible', 'triste', 'mal', 'pire',
    'déteste', 'haine', 'colère', 'fâché', 'énervé', 'chiant', 'relou',
    'stupide', 'bête', 'idiot', 'mort', 'tuer', 'blessé', 'douleur',
    'souffrir', 'peur', 'craindre', 'danger', 'problème', 'erreur',
    'faute', 'mensonge', 'faux', 'déçu', 'regret',
    // English
    'bad', 'hate', 'terrible', 'horrible', 'sad', 'angry', 'annoying',
    'stupid', 'dumb', 'awful', 'worst', 'boring', 'ugly', 'wrong',
]);

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Days of week names (English)
 */
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


