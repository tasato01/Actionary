'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Search, BookOpen, Clock, Globe, Info, Sparkles, Volume2, AlertCircle, X, Moon, Sun, HelpCircle } from 'lucide-react';
import { searchMultipleDictionaries, type DictionaryResult } from './actions';
import styles from './page.module.css';

// Allow longer timeout for AI generation (Vercel specific const)
export const maxDuration = 60;

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryResult[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('actionary-theme');
    if (saved === 'dark' || saved === 'light') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(saved);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('actionary-theme', theme);
  }, [theme]);

  // Warm up speech synthesis to avoid the 8-second delay on first play
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Trigger voice fetching immediately
      window.speechSynthesis.getVoices();

      // Some browsers require a small silent utterance to fully initialize the engine
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
    }
  }, []);

  // Auto-scroll to results when they appear
  useEffect(() => {
    if (results && resultsRef.current) {
      // Use a slightly longer timeout to allow for full rendering and layout shift
      setTimeout(() => {
        if (resultsRef.current) {
          const yOffset = -20; // Small offset if needed, or 0 to be exact top
          const element = resultsRef.current;
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;

          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 600);
    }
  }, [results]);

  const executeSearch = (term: string) => {
    // Basic cleanup and split by newline (which came from commas)
    const terms = term.split('\n').map(t => t.trim()).filter(Boolean);
    if (terms.length === 0) return;

    // Check for non-English input (simple check for non-ASCII)
    const invalidTerm = terms.find(t => /[^\x20-\x7E]/.test(t));
    if (invalidTerm) {
      setErrors([`Please enter English text only. Invalid: "${invalidTerm}"`]);
      setResults(null);
      return;
    }

    setQuery(term);
    setErrors([]);
    setResults(null);

    startTransition(async () => {
      try {
        const responses = await searchMultipleDictionaries(terms);
        const newResults: DictionaryResult[] = [];
        const newErrors: string[] = [];

        responses.forEach((res, index) => {
          if (res.success) {
            newResults.push(res.data);
          } else {
            newErrors.push(`Error for "${terms[index]}": ${res.error}`);
          }
        });

        if (newResults.length > 0) setResults(newResults);
        else setResults(null);

        if (newErrors.length > 0) setErrors(newErrors);
        else setErrors([]);
      } catch (err: unknown) {
        console.error(err);
        setErrors([err instanceof Error ? err.message : 'Failed to retrieve information. Please try again.']);
      }
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRef.current) {
      inputRef.current.blur(); // Close keyboard on mobile
    }
    executeSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setErrors([]);
    inputRef.current?.focus();
  };

  // Helper to get color class based on POS
  const getPosClass = (pos: string) => {
    const p = pos.toLowerCase();
    if (p.includes('noun')) return styles.posNoun;
    if (p.includes('verb')) return styles.posVerb;
    if (p.includes('adj')) return styles.posAdjective;
    if (p.includes('adv')) return styles.posAdverb;
    if (p.includes('prep') || p.includes('conj')) return styles.posPreposition;
    return styles.posDefault;
  };

  const playAudio = (text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any currently playing speech to ensure immediate response
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';

    // Try to find a high-quality local English voice instead of a cloud voice which adds delay
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.localService);
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className={styles.container}>
      {/* Header / Branding */}
      <div className={styles.header}>
        <div className="flex justify-end gap-2 w-full px-4 mb-2 absolute top-4 right-4 z-50">
          <button onClick={() => setIsHelpOpen(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-400" title="使い方 (How to Use)">
            <HelpCircle className="w-6 h-6" />
          </button>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-400" title="Toggle Theme">
            {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
          </button>
        </div>
        <h1 className={styles.title}>
          Actionary
        </h1>
        <p className={styles.subtitle}>Premium Etymology Dictionary</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <div className={styles.searchGroup}>
          <div className={styles.glowEffect}></div>
          <div className={styles.inputWrapper}>
            <Search className={styles.searchIcon} />
            <textarea
              ref={inputRef}
              placeholder="Search words (use comma for multiple)..."
              className={styles.searchInput}
              value={query}
              onChange={(e) => {
                const val = e.target.value.replace(/,/g, '\n');
                setQuery(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  executeSearch(query);
                }
              }}
              rows={query.split('\n').length > 1 ? Math.min(query.split('\n').length, 5) : 1}
              style={{ minHeight: '44px' }}
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


          </div>
        </div>
      </form>

      {/* Error Message */}
      {errors.length > 0 && !isPending && (
        <div className="flex flex-col gap-2 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-2">
          {errors.map((error, idx) => (
            <div key={idx} className={styles.errorMessage}>
              <AlertCircle className="w-5 h-5 inline-block mr-2" />
              {error}
            </div>
          ))}
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
      {results && !isPending && (
        <div ref={resultsRef} className={styles.resultsWrapper} style={{ marginTop: '1rem' }}>
          {/* Navigation Hint for Multiple Cards */}
          {results.length > 1 && (
            <div className="text-center text-sm text-slate-500 dark:text-slate-400 mb-2 animate-pulse" style={{ animationDuration: '3s' }}>
              Swipe left / right or use scrollbar to see all {results.length} words
            </div>
          )}
          <div className={styles.cardsContainer}>
            {results.map((result, resultIndex) => (
              <div key={resultIndex} className={styles.card}>

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
                      <div className={`${styles.partOfSpeechHeader} ${getPosClass(group.partOfSpeech)}`}>
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

                {/* Morpheme Breakdown - Always Visible */}
                {result.morphemes && result.morphemes.length > 0 && (
                  <div className={styles.sectionSeparator}>
                    <div className={styles.sectionHeaderUncollapsible}>
                      <Sparkles className="w-4 h-4" />
                      <h3 className={styles.sectionTitle}>Morpheme Breakdown</h3>
                    </div>
                    <div className={styles.morphemeList}>
                      {result.morphemes.map((m, i) => (
                        <div key={i} className={styles.morphemeRow}>
                          <span className={styles.morphemePart}>{m.part}</span>
                          <span className={styles.morphemeMeaning}>{m.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etymology / Origin (Collapsible) */}
                {/* Etymology / Origin */}
                {(result.etymology || result.origin) && (
                  <div className={styles.sectionSeparator}>
                    <div className={styles.sectionHeaderUncollapsible}>
                      <div className="flex items-center gap-2">
                        <HistoryIcon type={result.type} />
                        <h3 className={styles.sectionTitle}>
                          {result.type === 'word' ? 'Etymology' : 'Origin'}
                        </h3>
                      </div>
                    </div>

                    <div className={styles.textBlock}>
                      <p className={styles.infoText}>
                        {result.type === 'word' ? result.etymology : result.origin}
                      </p>
                    </div>
                  </div>
                )}

                {/* Root Words / Cognates */}
                {result.type === 'word' && result.rootWords && result.rootWords.length > 0 && (
                  <div className={styles.sectionSeparator}>
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
                  <div className={styles.sectionSeparator}>
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

                {/* AI Disclaimer */}
                <div className={styles.disclaimer}>
                  <Sparkles className="w-3 h-3 inline-block mr-1" />
                  AI-generated content. Accuracy may vary.
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsHelpOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">使い方</h2>
              <button onClick={() => setIsHelpOpen(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-slate-600 dark:text-slate-300">
              <p><strong>1. 単語の検索:</strong> 英語の単語やイディオムを入力して検索します。</p>
              <p><strong>2. 複数単語の検索:</strong> カンマ(<code>,</code>)を入力すると自動で改行され、複数の単語を一度に検索できます。</p>
              <p><strong>3. カードのスワイプ:</strong> 複数単語を検索した場合、検索結果のカードを左右にスワイプして切り替えることができます。</p>
              <p><strong>4. ダークモード切替:</strong> 右上のアイコンから、画面のテーマをご利用環境に合わせて変更できます。</p>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function HistoryIcon({ type }: { type: 'word' | 'idiom' }) {
  return type === 'word' ? <Clock className="w-4 h-4" /> : <Info className="w-4 h-4" />;
}
