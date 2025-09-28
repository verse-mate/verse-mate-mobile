import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { LoadingSkeleton } from './LoadingSkeleton';

interface ChapterLoadingSkeletonProps {
  verseCount?: number;
}

/**
 * Loading skeleton for chapter content
 */
export const ChapterLoadingSkeleton: React.FC<ChapterLoadingSkeletonProps> = ({
  verseCount = 10,
}) => {
  // Generate random widths for verse skeletons to make them look more realistic
  const verseWidths = React.useMemo(() => {
    return Array.from({ length: verseCount }, () => {
      // Random width between 60% and 95% of container
      return `${Math.floor(Math.random() * 35) + 60}%` as const;
    });
  }, [verseCount]);

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={styles.content}
        testID="chapter-loading-skeleton"
        accessible={true}
        accessibilityLabel="Loading chapter content"
      >
        {/* Chapter Title Skeleton */}
        <View style={styles.headerContainer}>
          <LoadingSkeleton
            width="60%"
            height={32}
            borderRadius={8}
            style={styles.titleSkeleton}
            testID="chapter-header-skeleton"
          />
          <View accessible={true} accessibilityLabel="Loading chapter title" />
        </View>

        {/* Verse Skeletons */}
        <View style={styles.versesContainer}>
          {Array.from({ length: verseCount }, (_, index) => (
            <View key={`verse-skeleton-${index}-${Math.random()}`} style={styles.verseContainer}>
              {/* Verse Number Skeleton */}
              <LoadingSkeleton
                width={24}
                height={16}
                borderRadius={3}
                style={styles.verseNumberSkeleton}
              />

              {/* Verse Text Skeleton */}
              <View style={styles.verseTextContainer}>
                <LoadingSkeleton
                  width={verseWidths[index]}
                  height={18}
                  borderRadius={4}
                  style={styles.verseTextSkeleton}
                  testID={`verse-skeleton-${index}`}
                />

                {/* Sometimes add a second line for longer verses */}
                {Math.random() > 0.6 && (
                  <LoadingSkeleton
                    width={`${Math.floor(Math.random() * 40) + 30}%`}
                    height={18}
                    borderRadius={4}
                    style={StyleSheet.flatten([styles.verseTextSkeleton, { marginTop: 4 }])}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f3ec',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  titleSkeleton: {
    alignSelf: 'center',
  },
  versesContainer: {
    flex: 1,
  },
  verseContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  verseNumberSkeleton: {
    marginTop: 2,
    marginRight: 12,
  },
  verseTextContainer: {
    flex: 1,
  },
  verseTextSkeleton: {
    // Additional styling handled by individual skeletons
  },
});
