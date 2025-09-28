import type React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LoadingSkeleton } from './LoadingSkeleton';

interface BookListLoadingSkeletonProps {
  bookCount?: number;
  showSearch?: boolean;
}

/**
 * Loading skeleton for book list/selection interface
 */
export const BookListLoadingSkeleton: React.FC<BookListLoadingSkeletonProps> = ({
  bookCount = 20,
  showSearch = true,
}) => {
  return (
    <View style={styles.container} testID="book-list-loading-skeleton">
      {/* Search Bar Skeleton */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <LoadingSkeleton
            width="100%"
            height={44}
            borderRadius={22}
            testID="search-bar-skeleton"
          />
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Old Testament Section */}
        <View style={styles.sectionContainer}>
          <LoadingSkeleton
            width="40%"
            height={24}
            borderRadius={6}
            style={styles.sectionHeader}
            testID="old-testament-header-skeleton"
          />

          <View style={styles.booksGrid}>
            {Array.from({ length: Math.ceil(bookCount * 0.6) }, (_, index) => (
              <View key={`old-${index}`} style={styles.bookItemContainer}>
                <LoadingSkeleton
                  width="100%"
                  height={60}
                  borderRadius={8}
                  testID={`book-item-skeleton-${index}`}
                />
                <LoadingSkeleton
                  width="70%"
                  height={12}
                  borderRadius={3}
                  style={styles.chapterCountSkeleton}
                  testID={`chapter-count-skeleton-${index}`}
                />
              </View>
            ))}
          </View>
        </View>

        {/* New Testament Section */}
        <View style={styles.sectionContainer}>
          <LoadingSkeleton
            width="45%"
            height={24}
            borderRadius={6}
            style={styles.sectionHeader}
            testID="new-testament-header-skeleton"
          />

          <View style={styles.booksGrid}>
            {Array.from({ length: Math.ceil(bookCount * 0.4) }, (_, index) => {
              const globalIndex = Math.ceil(bookCount * 0.6) + index;
              return (
                <View key={`new-${index}`} style={styles.bookItemContainer}>
                  <LoadingSkeleton
                    width="100%"
                    height={60}
                    borderRadius={8}
                    testID={`book-item-skeleton-${globalIndex}`}
                  />
                  <LoadingSkeleton
                    width="70%"
                    height={12}
                    borderRadius={3}
                    style={styles.chapterCountSkeleton}
                    testID={`chapter-count-skeleton-${globalIndex}`}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3ec',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  booksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bookItemContainer: {
    width: '48%',
    marginBottom: 16,
  },
  chapterCountSkeleton: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
