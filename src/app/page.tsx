'use client';

import { useState, useTransition } from 'react';
import { Search, BookOpen, Clock, Globe, Mic, Info, Sparkles, Volume2, AlertCircle } from 'lucide-react';
import { searchDictionary, type DictionaryResult } from './actions';
import styles from './page.module.css';

export default function Home() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const executeSearch = (term: string) => {
    // Basic cleanup
    const cleanTerm = term.trim();
    if (!cleanTerm) return;

    // Check for non-English input (simple check for non-ASCII)
    // Allows standard punctuation and spaces.
    // If Japanese/Other detected, stop.
    // Regex matches any character NOT in standard ASCII range.
    if (/[^\x20-\x7E]/.test(cleanTerm)) {
      setError('Please enter English text only.');
      setResult(null);
      return;
    }

    // Update input to reflect what's being searched (if user clicked a root word)
    setQuery(cleanTerm);
    setError('');
    setResult(null);

    startTransition(async () => {
      try {
        const data = await searchDictionary(cleanTerm);
        setResult(data);
      } catch (err) {
        console.error(err);
        setError('Failed to retrieve information. Please check your API key or try again.');
      }
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const playAudio = (text: string) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className={styles.container}>
      {/* Header / Branding */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          Actionaly
        </h1>
        <p className={styles.subtitle}>Premium Etymology Dictionary</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <div className={styles.searchGroup}>
          <div className={styles.glowEffect}></div>
          <div className={styles.inputWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search for a word or idiom..."
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={isPending}
              className={styles.searchButton}
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Error Message */}
      {error && !isPending && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {isPending && (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Analyzing Etymology & Meaning...</p>
        </div>
      )}

      {/* Results Display */}
      {result && !isPending && (
        <div className={styles.resultsWrapper}>

          {/* Correction Notice */}
          {result.correctedFrom && (
            <div className={styles.suggestion}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>
                  Showing results for <strong>{result.term}</strong>.
                  <span className="opacity-75 text-sm ml-2">(Original search: {result.correctedFrom})</span>
                </span>
              </div>
            </div>
          )}

          {/* Main Card */}
          <div className={styles.card}>
            <div className={styles.bgDecoration}>
              <Sparkles className="w-24 h-24 text-white" />
            </div>

            <div className={styles.cardHeader}>
              <h2 className={styles.term}>{result.term}</h2>

              {/* Audio Button */}
              <button
                onClick={() => playAudio(result.term)}
                className={styles.audioButton}
                title="Play Pronunciation"
              >
                <Volume2 className="w-5 h-5" />
              </button>

              {result.type === 'word' && result.pronunciation && (
                <span className={styles.pronunciation}>
                  /{result.pronunciation}/
                </span>
              )}
              <span className={styles.typeBadge}>
                {result.type}
              </span>
            </div>

            {/* Meanings */}
            <div className={styles.meanings}>
              {result.meaning.map((m, i) => (
                <div key={i} className={styles.meaningItem}>
                  <div className={styles.bullet} />
                  <p className={styles.meaningText}>{m}</p>
                </div>
              ))}
            </div>

            {/* Etymology / Origin */}
            {(result.etymology || result.origin || (result.morphemes && result.morphemes.length > 0)) && (
              <div className={styles.sectionSeparator}>
                <div className={styles.sectionHeader}>
                  <HistoryIcon type={result.type} />
                  <h3 className={styles.sectionTitle}>
                    {result.type === 'word' ? 'Etymology' : 'Origin'}
                  </h3>
                </div>

                {/* Morpheme Breakdown (Vertical List Style) */}
                {result.morphemes && result.morphemes.length > 0 && (
                  <div className={styles.morphemeList}>
                    {result.morphemes.map((m, i) => (
                      <div key={i} className={styles.morphemeRow}>
                        <span className={styles.morphemePart}>{m.part}</span>
                        <span className={styles.morphemeMeaning}>{m.meaning}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Text Explanation */}
                <p className={styles.infoText}>
                  {result.type === 'word' ? result.etymology : result.origin}
                </p>
              </div>
            )}

            {/* Examples */}
            {result.examples && result.examples.length > 0 && (
              <div className={styles.sectionSeparator}>
                <div className={styles.sectionHeader}>
                  <BookOpen className="w-4 h-4" />
                  <h3 className={styles.sectionTitle}>Examples</h3>
                </div>
                <div className={styles.exampleGrid}>
                  {result.examples.map((ex, i) => (
                    <div key={i} className={styles.exampleItem}>
                      <p className={styles.exampleText}>{ex}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Root Words / Cognates (Clickable Vertical List Buttons) */}
            {result.type === 'word' && result.rootWords && result.rootWords.length > 0 && (
              <div className={styles.relatedSection}>
                <div className={styles.sectionHeader}>
                  <Globe className="w-4 h-4" />
                  <h3 className={styles.sectionTitle}>Words with Same Root</h3>
                </div>
                <div className={styles.rootWordsList}>
                  {result.rootWords.map((w, i) => (
                    <div
                      key={i}
                      className={styles.rootWordRow}
                      onClick={() => executeSearch(w.term)}
                      role="button"
                      tabIndex={0}
                      title={`Search for "${w.term}"`}
                    >
                      <span className={styles.rootWordTerm}>{w.term}</span>

                      {/* Breakdown Column */}
                      <span className={styles.rootWordBreakdown}>
                        {w.breakdown ? (
                          w.breakdown.split('*').map((part, index) => {
                            // Even indices are normal, odd indices are highlighted (assuming *root* format)
                            // e.g. "pre/" (0) "dict" (1) "" (2) -> index 1 is root
                            return index % 2 === 1 ? (
                              <span key={index} className={styles.highlightRoot}>{part}</span>
                            ) : (
                              <span key={index}>{part}</span>
                            );
                          })
                        ) : (
                          // Fallback
                          <span className="opacity-50">-</span>
                        )}
                      </span>

                      <span className={styles.rootWordMeaning}>{w.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback to relatedWords if rootWords empty */}
            {result.type === 'word' && (!result.rootWords || result.rootWords.length === 0) && result.relatedWords && (
              <div className={styles.relatedSection}>
                <div className={styles.sectionHeader}>
                  <Globe className="w-4 h-4" />
                  <h3 className={styles.sectionTitle}>Related Words</h3>
                </div>
                <div className={styles.tags}>
                  {result.relatedWords.map((w, i) => (
                    <span key={i} className={styles.tag}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </main>
  );
}

function HistoryIcon({ type }: { type: 'word' | 'idiom' }) {
  return type === 'word' ? <Clock className="w-4 h-4" /> : <Info className="w-4 h-4" />;
}
