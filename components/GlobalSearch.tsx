import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export interface SearchResult {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  testament: 'old' | 'new';
}

export interface GlobalSearchProps {
  onSearchResults: (query: string) => void;
  onResultSelect: (result: SearchResult) => void;
  searchResults?: SearchResult[];
  searchQuery?: string;
  loading?: boolean;
  error?: string;
  recentSearches?: string[];
  testamentFilter?: 'all' | 'old' | 'new';
}

export function GlobalSearch({
  onSearchResults,
  onResultSelect,
  searchResults = [],
  searchQuery = '',
  loading = false,
  error,
  recentSearches = [],
  testamentFilter = 'all',
}: GlobalSearchProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [activeTestamentFilter, setActiveTestamentFilter] = useState<'all' | 'old' | 'new'>(
    testamentFilter
  );

  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inputValue.length >= 3) {
        onSearchResults(inputValue);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, onSearchResults]);

  const filteredResults = useMemo(() => {
    if (activeTestamentFilter === 'all') {
      return searchResults;
    }
    return searchResults.filter((result) => result.testament === activeTestamentFilter);
  }, [searchResults, activeTestamentFilter]);

  const limitedResults = useMemo(() => {
    return filteredResults.slice(0, 50); // Show first 50 results
  }, [filteredResults]);

  const handleClearSearch = () => {
    setInputValue('');
  };

  const handleRecentSearchSelect = (search: string) => {
    setInputValue(search);
    onSearchResults(search);
  };

  const handleRetry = () => {
    if (searchQuery) {
      onSearchResults(searchQuery);
    }
  };

  const renderSearchResult = ({ item, index }: { item: SearchResult; index: number }) => {
    const reference = `${item.bookName} ${item.chapter}:${item.verse}`;
    const testamentIndicator = item.testament === 'old' ? 'OT' : 'NT';

    return (
      <TouchableOpacity
        style={[styles.resultItem, { borderBottomColor: borderColor }]}
        onPress={() => onResultSelect(item)}
        testID={`search-result-${index}`}
        accessibilityRole="button"
        accessible={true}
      >
        <View style={styles.resultHeader}>
          <ThemedText style={styles.reference}>{reference}</ThemedText>
          <View
            style={[
              styles.testamentBadge,
              { backgroundColor: item.testament === 'old' ? '#8B4513' : '#4169E1' },
            ]}
          >
            <ThemedText style={styles.testamentText}>{testamentIndicator}</ThemedText>
          </View>
        </View>
        <ThemedText
          style={styles.verseText}
          testID={
            searchQuery && item.text.includes('<mark>') ? `highlighted-text-${index}` : undefined
          }
        >
          {item.text}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const renderRecentSearch = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      style={[styles.recentItem, { borderBottomColor: borderColor }]}
      onPress={() => handleRecentSearchSelect(item)}
      testID={`recent-search-${index}`}
      accessibilityRole="button"
    >
      <ThemedText style={styles.recentText}>{item}</ThemedText>
    </TouchableOpacity>
  );

  const showRecentSearches = !inputValue && recentSearches.length > 0;
  const showNoResults = searchQuery && filteredResults.length === 0 && !loading;
  const showMoreResults = filteredResults.length > 50;

  return (
    <ThemedView style={styles.container}>
      {/* Search Input */}
      <View style={[styles.searchContainer, { borderColor }]}>
        <View style={styles.searchIcon} testID="search-icon">
          <ThemedText style={styles.searchIconText}>🔍</ThemedText>
        </View>

        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Search Bible verses..."
          placeholderTextColor={borderColor}
          value={inputValue}
          onChangeText={setInputValue}
          testID="search-input"
          accessibilityLabel="Search Bible verses"
          editable={!loading}
        />

        {inputValue.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSearch}
            testID="clear-search-button"
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <ThemedText style={styles.clearButtonText}>✕</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Testament Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeTestamentFilter === 'all' && styles.activeFilter]}
          onPress={() => setActiveTestamentFilter('all')}
          testID="testament-filter-all"
        >
          <ThemedText
            style={[styles.filterText, activeTestamentFilter === 'all' && styles.activeFilterText]}
          >
            All
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeTestamentFilter === 'old' && styles.activeFilter]}
          onPress={() => setActiveTestamentFilter('old')}
          testID="testament-filter-old"
        >
          <ThemedText
            style={[styles.filterText, activeTestamentFilter === 'old' && styles.activeFilterText]}
          >
            Old Testament
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeTestamentFilter === 'new' && styles.activeFilter]}
          onPress={() => setActiveTestamentFilter('new')}
          testID="testament-filter-new"
        >
          <ThemedText
            style={[styles.filterText, activeTestamentFilter === 'new' && styles.activeFilterText]}
          >
            New Testament
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer} testID="search-loading">
          <ThemedText>Searching...</ThemedText>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            accessibilityRole="button"
          >
            <ThemedText style={styles.retryText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Searches */}
      {showRecentSearches && (
        <View style={styles.recentContainer}>
          <ThemedText style={styles.recentTitle}>Recent Searches</ThemedText>
          <FlatList
            data={recentSearches.slice(0, 10)}
            renderItem={renderRecentSearch}
            keyExtractor={(item, index) => `recent-${index}`}
            scrollEnabled={false}
          />
        </View>
      )}

      {/* No Results */}
      {showNoResults && (
        <View style={styles.emptyContainer}>
          <ThemedText>No verses found for &quot;{searchQuery}&quot;</ThemedText>
        </View>
      )}

      {/* Search Results */}
      {limitedResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <ThemedText
            style={styles.resultsCount}
            accessibilityLabel={`${filteredResults.length} search results found`}
          >
            {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
          </ThemedText>

          <FlatList
            data={limitedResults}
            renderItem={renderSearchResult}
            keyExtractor={(item, index) => `result-${item.bookId}-${item.chapter}-${item.verse}`}
            testID="search-results-flatlist"
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            getItemLayout={(data, index) => ({
              length: 80,
              offset: 80 * index,
              index,
            })}
          />

          {showMoreResults && (
            <TouchableOpacity style={styles.showMoreButton}>
              <ThemedText style={styles.showMoreText}>Show more results</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchIconText: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
    opacity: 0.6,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  activeFilter: {
    backgroundColor: '#b09a6d',
    borderColor: '#b09a6d',
  },
  filterText: {
    fontSize: 12,
  },
  activeFilterText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#b09a6d',
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
  },
  recentContainer: {
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  recentItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  recentText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsCount: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 8,
  },
  resultItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reference: {
    fontSize: 14,
    fontWeight: '600',
  },
  testamentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  testamentText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  verseText: {
    fontSize: 14,
    lineHeight: 20,
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreText: {
    color: '#b09a6d',
    fontWeight: '600',
  },
});
