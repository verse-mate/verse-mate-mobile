import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import type { Book } from '@/components/BookAccordion';
import { BookAccordion } from '@/components/BookAccordion';
import { ChapterGrid } from '@/components/ChapterGrid';
import type { SearchResult } from '@/components/GlobalSearch';
import { GlobalSearch } from '@/components/GlobalSearch';
import { TestamentToggle } from '@/components/TestamentToggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BookMappingService } from '@/utils/bookMapping';

type ViewMode = 'books' | 'chapters' | 'search';

export default function BooksScreen() {
  const router = useRouter();
  const bookMappingService = new BookMappingService();

  // State
  const [selectedTestament, setSelectedTestament] = useState<'old' | 'new'>('old');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('books');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Get all books from the mapping service
  const allBooks: Book[] = useMemo(() => {
    return bookMappingService.getAllBooks().map((book) => ({
      id: book.id,
      name: book.name,
      testament: book.testament,
      chapters: book.chapters,
    }));
  }, []);

  // Mock recent books (in real app, this would come from storage)
  const recentBooks: Book[] = useMemo(() => {
    return [
      { id: 19, name: 'Psalms', testament: 'old', chapters: 150, lastRead: Date.now() },
      { id: 43, name: 'John', testament: 'new', chapters: 21, lastRead: Date.now() - 1000 },
      { id: 45, name: 'Romans', testament: 'new', chapters: 16, lastRead: Date.now() - 2000 },
    ];
  }, []);

  // Book counts for testament toggle
  const bookCounts = useMemo(() => {
    const oldCount = allBooks.filter((book) => book.testament === 'old').length;
    const newCount = allBooks.filter((book) => book.testament === 'new').length;
    return { old: oldCount, new: newCount };
  }, [allBooks]);

  // Mock recent searches
  const recentSearches = ['love', 'faith', 'hope', 'peace'];

  // Handlers
  const handleTestamentChange = (testament: 'old' | 'new') => {
    setSelectedTestament(testament);
    setSelectedBook(null);
    setViewMode('books');
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
    setViewMode('chapters');
  };

  const handleChapterSelect = (book: Book, chapter: number) => {
    // Navigate to the Bible reader
    router.push(`/bible/${book.id}/${chapter}`);
  };

  const handleSearchResults = async (query: string) => {
    setSearchQuery(query);
    setLoading(true);
    setViewMode('search');

    // Mock search implementation (in real app, this would call an API)
    setTimeout(() => {
      const mockResults: SearchResult[] = [
        {
          bookId: 43,
          bookName: 'John',
          chapter: 3,
          verse: 16,
          text: `For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.`,
          testament: 'new' as const,
        },
        {
          bookId: 19,
          bookName: 'Psalms',
          chapter: 23,
          verse: 1,
          text: `The Lord is my shepherd, I lack nothing.`,
          testament: 'old' as const,
        },
        {
          bookId: 45,
          bookName: 'Romans',
          chapter: 8,
          verse: 28,
          text: `And we know that in all things God works for the good of those who love him, who have been called according to his purpose.`,
          testament: 'new' as const,
        },
      ].filter(
        (result) =>
          result.text.toLowerCase().includes(query.toLowerCase()) ||
          result.bookName.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(mockResults);
      setLoading(false);
    }, 500);
  };

  const handleSearchResultSelect = (result: SearchResult) => {
    // Navigate to the specific verse
    router.push(`/bible/${result.bookId}/${result.chapter}`);
  };

  const handleBackToBooks = () => {
    setSelectedBook(null);
    setViewMode('books');
  };

  const handleBackToBookSelection = () => {
    setViewMode('books');
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <ThemedView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {viewMode === 'search'
              ? 'Search'
              : viewMode === 'chapters'
                ? selectedBook?.name
                : 'Bible'}
          </ThemedText>

          {viewMode === 'chapters' && (
            <ThemedText style={styles.backButton} onPress={handleBackToBooks}>
              ← Back to Books
            </ThemedText>
          )}

          {viewMode === 'search' && (
            <ThemedText style={styles.backButton} onPress={handleBackToBookSelection}>
              ← Back to Books
            </ThemedText>
          )}
        </View>

        {/* Global Search - Always available */}
        <GlobalSearch
          onSearchResults={handleSearchResults}
          onResultSelect={handleSearchResultSelect}
          searchResults={searchResults}
          searchQuery={searchQuery}
          loading={loading}
          recentSearches={recentSearches}
        />

        {/* Content based on view mode */}
        {viewMode === 'books' && (
          <>
            {/* Testament Toggle */}
            <TestamentToggle
              selectedTestament={selectedTestament}
              onTestamentChange={handleTestamentChange}
              bookCounts={bookCounts}
            />

            {/* Book List */}
            <BookAccordion
              books={allBooks}
              selectedTestament={selectedTestament}
              onBookSelect={handleBookSelect}
              recentBooks={recentBooks}
            />
          </>
        )}

        {viewMode === 'chapters' && selectedBook && (
          <ChapterGrid book={selectedBook} onChapterSelect={handleChapterSelect} />
        )}

        {/* Search results are handled within GlobalSearch component */}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3ec',
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  backButton: {
    fontSize: 16,
    color: '#b09a6d',
    fontWeight: '600',
  },
});
