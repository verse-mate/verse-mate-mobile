import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export interface Book {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
  lastRead?: number;
}

export interface BookAccordionProps {
  books: Book[];
  selectedTestament: 'old' | 'new';
  onBookSelect: (book: Book) => void;
  recentBooks?: Book[];
  searchQuery?: string;
  loading?: boolean;
}

export function BookAccordion({
  books,
  selectedTestament,
  onBookSelect,
  recentBooks = [],
  searchQuery = '',
  loading = false,
}: BookAccordionProps) {
  const [recentBooksExpanded, setRecentBooksExpanded] = useState(true);
  const borderColor = useThemeColor({}, 'icon');

  const filteredBooks = useMemo(() => {
    let filtered = books.filter((book) => book.testament === selectedTestament);

    if (searchQuery) {
      filtered = filtered.filter((book) =>
        book.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [books, selectedTestament, searchQuery]);

  const filteredRecentBooks = useMemo(() => {
    return recentBooks.filter((book) => book.testament === selectedTestament);
  }, [recentBooks, selectedTestament]);

  const toggleRecentBooks = () => {
    setRecentBooksExpanded(!recentBooksExpanded);
  };

  const renderBookItem = ({ item, index }: { item: Book; index: number }) => (
    <TouchableOpacity
      style={[styles.bookItem, { borderBottomColor: borderColor }]}
      onPress={() => onBookSelect(item)}
      testID={`book-item-${item.id}`}
      accessibilityLabel={`Select ${item.name}, ${item.chapters} chapters`}
      accessibilityRole="button"
    >
      <View style={styles.bookContent}>
        <ThemedText style={styles.bookName}>{item.name}</ThemedText>
        <ThemedText style={styles.chapterCount}>{item.chapters} chapters</ThemedText>
      </View>
    </TouchableOpacity>
  );

  const renderRecentBookItem = ({ item, index }: { item: Book; index: number }) => (
    <TouchableOpacity
      style={[styles.bookItem, { borderBottomColor: borderColor }]}
      onPress={() => onBookSelect(item)}
      testID={`recent-book-item-${item.id}`}
      accessibilityLabel={`Select ${item.name}, ${item.chapters} chapters`}
      accessibilityRole="button"
    >
      <View style={styles.bookContent}>
        <ThemedText style={styles.bookName}>{item.name}</ThemedText>
        <ThemedText style={styles.chapterCount}>{item.chapters} chapters</ThemedText>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container} testID="book-accordion">
        <ThemedView style={styles.loadingContainer} testID="book-list-loading">
          <ThemedText>Loading books...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  const hasSearchResults = searchQuery && filteredBooks.length === 0;
  const hasBooks = filteredBooks.length > 0;
  const hasRecentBooks = filteredRecentBooks.length > 0;

  return (
    <ThemedView style={styles.container} testID="book-accordion" accessible={true}>
      {hasRecentBooks && (
        <View style={styles.recentSection}>
          <TouchableOpacity
            style={styles.recentHeader}
            onPress={toggleRecentBooks}
            testID="recent-books-header"
            accessibilityRole="button"
            accessibilityLabel="Toggle recent books section"
          >
            <ThemedText style={styles.sectionTitle}>Recently Read</ThemedText>
            <ThemedText style={styles.expandIcon}>{recentBooksExpanded ? '−' : '+'}</ThemedText>
          </TouchableOpacity>

          {recentBooksExpanded && (
            <FlatList
              data={filteredRecentBooks}
              renderItem={renderRecentBookItem}
              keyExtractor={(item) => `recent-${item.id}`}
              style={styles.recentList}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {hasSearchResults ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText>No books match your search</ThemedText>
        </ThemedView>
      ) : !hasBooks && !loading ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText>No books found</ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={filteredBooks}
          renderItem={renderBookItem}
          keyExtractor={(item) => item.id.toString()}
          testID="book-accordion-flatlist"
          contentOffset={{ x: 0, y: 0 }}
          style={styles.bookList}
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={true}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recentSection: {
    marginBottom: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  recentList: {
    maxHeight: 200,
  },
  bookList: {
    flex: 1,
  },
  bookItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  bookContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  chapterCount: {
    fontSize: 14,
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
});
