import React, { useMemo } from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export interface Book {
  id: number;
  name: string;
  testament: 'old' | 'new';
  chapters: number;
}

export interface ChapterGridProps {
  book: Book | null;
  onChapterSelect: (book: Book, chapter: number) => void;
  selectedChapter?: number;
  loading?: boolean;
}

export function ChapterGrid({
  book,
  onChapterSelect,
  selectedChapter,
  loading = false,
}: ChapterGridProps) {
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const textColor = useThemeColor({}, 'text');

  const chapters = useMemo(() => {
    if (!book || book.chapters === 0) return [];
    return Array.from({ length: book.chapters }, (_, i) => i + 1);
  }, [book]);

  const renderChapter = ({ item: chapter, index }: { item: number; index: number }) => {
    const isSelected = selectedChapter === chapter;

    const handlePress = () => {
      if (!isSelected && book) {
        onChapterSelect(book, chapter);
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.chapterButton,
          {
            borderColor,
            backgroundColor: isSelected ? '#b09a6d' : backgroundColor,
          },
          isSelected && { opacity: 1 },
        ]}
        onPress={handlePress}
        testID={`chapter-${chapter}`}
        accessibilityLabel={`Chapter ${chapter} of ${book?.name}`}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityHint={`Tap to read chapter ${chapter}`}
        onPressIn={() => {
          // Handle press visual feedback
        }}
        onPressOut={() => {
          // Handle press out visual feedback
        }}
      >
        <ThemedText style={[styles.chapterText, { color: isSelected ? '#fff' : textColor }]}>
          {chapter}
        </ThemedText>
      </TouchableOpacity>
    );
  };

  const getItemLayout = (data: any, index: number) => {
    const { width } = Dimensions.get('window');
    const itemSize = (width - 80) / 5; // 5 columns with padding
    const row = Math.floor(index / 5);
    const col = index % 5;

    return {
      length: itemSize,
      offset: row * itemSize,
      index,
    };
  };

  const keyExtractor = (item: number) => item.toString();

  if (loading) {
    return (
      <ThemedView style={styles.container} pointerEvents="none" testID="chapter-grid-container">
        <ThemedView style={styles.loadingContainer} testID="chapter-grid-loading">
          <ThemedText>Loading chapters...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  if (!book) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.emptyContainer}>
          <ThemedText>Book not found</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  if (book.chapters === 0) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView style={styles.emptyContainer}>
          <ThemedText>No chapters available</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} testID="chapter-grid-container">
      {/* Book Header */}
      <View style={styles.header}>
        <ThemedText style={styles.bookTitle}>{book.name}</ThemedText>
      </View>

      {/* Chapter Grid */}
      <FlatList
        data={chapters}
        renderItem={renderChapter}
        keyExtractor={keyExtractor}
        numColumns={5}
        testID="chapter-grid"
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={book.chapters > 50}
        maxToRenderPerBatch={25}
        windowSize={10}
        initialNumToRender={25}
        getItemLayout={book.chapters > 50 ? getItemLayout : undefined}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chapterButton: {
    width: '18%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  chapterText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
