export { SearchHighlightProvider, useSearchHighlight, useSearchHighlightOptional } from './context/search-highlight-context';
export { useInThreadFind, findInThreadMatches } from './hooks/use-in-thread-find';
export { useSearchFilters, type SearchFilters, type SearchRoleFilter } from './hooks/use-search-filters';
export { splitByQuery, highlightSnippetText } from './utils/highlight-query';
export { mergeSearchResults, mergeMessageAndFileResults } from './utils/merge-search-hits';
export { default as InThreadFindBar } from './components/in-thread-find-bar';
export { default as SearchFiltersBar } from './components/search-filters-bar';
export { default as HighlightedText } from './components/highlighted-text';
