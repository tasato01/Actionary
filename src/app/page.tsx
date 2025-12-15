'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Search, BookOpen, Clock, Globe, Info, Sparkles, Volume2, AlertCircle, X, ChevronDown, ChevronRight } from 'lucide-react';
import { searchDictionary, type DictionaryResult } from './actions';
import styles from './page.module.css';

export default function Home() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to results when they appear
  useEffect(() => {
    if (result && resultsRef.current) {
      // Small timeout to ensure DOM is ready and layout is stable
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);

  const executeSearch = (term: string) => {
    // Basic cleanup
    const cleanTerm = term.trim();
    if (!cleanTerm) return;

    // Check for non-English input (simple check for non-ASCII)
    if (/[^\x20-\x7E]/.test(cleanTerm)) {
      setError('Please enter English text only.');
      setResult(null);
      return;
    }

    // Update input to reflect what's being searched
    setQuery(cleanTerm);
    setError('');
    // Don't clear result immediately to prevent flashing empty state if it's a quick reload, 
    // but here we want to clear it to indicate new search starts visually.
    setResult(null);

    startTransition(async () => {
      try {
        const data = await searchDictionary(cleanTerm);
        setResult(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to retrieve information. Please try again.');
      }
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
    setError('');
    inputRef.current?.focus();
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
              ref={inputRef}
              type="text"
              placeholder="Search for a word or idiom..."
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {/* Reset/Clear Button */}
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className={styles.clearButton}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

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
          <AlertCircle className="w-5 h-5 inline-block mr-2" />
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
        <div ref={resultsRef} className={styles.resultsWrapper}>

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

            {/* Meanings Grouped by Part of Speech */}
            <div className={styles.meaningsContainer}>
              {result.meaning.map((group, index) => (
                <div key={index} className={styles.meaningGroup}>
                  <div className={styles.partOfSpeechHeader}>
                    {group.partOfSpeech}
                  </div>
                  <div className={styles.meaningsList}>
                    {group.definitions.map((def, i) => (
                      <div key={i} className={styles.meaningItem}>
                        <div className={styles.bullet} />
                        <p className={styles.meaningText}>{def}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Etymology / Origin (Collapsible) */}
            {(result.etymology || result.origin || (result.morphemes && result.morphemes.length > 0)) && (
              <div className={styles.sectionSeparator}>
                <details className={styles.detailsSection} open={false}>
                  <summary className={styles.summaryHeader}>
                    <div className="flex items-center gap-2">
                      <HistoryIcon type={result.type} />
                      <h3 className={styles.sectionTitle}>
                        {result.type === 'word' ? 'Etymology' : 'Origin'}
                      </h3>
                    </div>
                    <ChevronDown className={`w-4 h-4 ${styles.summaryIcon}`} />
                  </summary>

                  <div className={styles.detailsContent}>
                    {/* Morpheme Breakdown */}
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
                </details>
              </div>
            )}

            {/* Examples */}
            {result.examples && result.examples.length > 0 && (
              <div className={styles.sectionSeparator}>
                <div className={styles.sectionHeaderUncollapsible}>
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

            {/* Root Words / Cognates */}
            {result.type === 'word' && result.rootWords && result.rootWords.length > 0 && (
              <div className={styles.relatedSection}>
                <div className={styles.sectionHeaderUncollapsible}>
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
                            return index % 2 === 1 ? (
                              <span key={index} className={styles.highlightRoot}>{part}</span>
                            ) : (
                              <span key={index}>{part}</span>
                            );
                          })
                        ) : (
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
                <div className={styles.sectionHeaderUncollapsible}>
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

            {/* AI Disclaimer */}
            <div className={styles.disclaimer}>
              <Sparkles className="w-3 h-3 inline-block mr-1" />
              AI-generated content. Accuracy may vary.
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

function HistoryIcon({ type }: { type: 'word' | 'idiom' }) {
  return type === 'word' ? <Clock className="w-4 h-4" /> : <Info className="w-4 h-4" />;
}
