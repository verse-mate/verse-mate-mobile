import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BIBLE_BOOKS } from '@/constants/bible-books';
import { fontSizes, spacing } from '@/constants/bible-design-tokens';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDownloadedBooksForVersion } from '@/services/offline';

interface BibleVersionBookListProps {
  versionKey: string;
}

export function BibleVersionBookList({ versionKey }: BibleVersionBookListProps) {
  const { colors } = useTheme();
  const { downloadBibleBook, deleteBibleBook } = useOfflineContext();
  const [downloadedBooks, setDownloadedBooks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBookId, setActionBookId] = useState<number | null>(null);

  useEffect(() => {
    getDownloadedBooksForVersion(versionKey)
      .then(setDownloadedBooks)
      .finally(() => setLoading(false));
  }, [versionKey]);

  const handleDownload = async (bookId: number) => {
    setActionBookId(bookId);
    try {
      await downloadBibleBook(versionKey, bookId);
      const updated = await getDownloadedBooksForVersion(versionKey);
      setDownloadedBooks(updated);
    } finally {
      setActionBookId(null);
    }
  };

  const handleDelete = async (bookId: number) => {
    setActionBookId(bookId);
    try {
      await deleteBibleBook(versionKey, bookId);
      const updated = await getDownloadedBooksForVersion(versionKey);
      setDownloadedBooks(updated);
    } finally {
      setActionBookId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        {downloadedBooks.length} of {BIBLE_BOOKS.length} books downloaded
      </Text>
      {BIBLE_BOOKS.map((book) => {
        const isDownloaded = downloadedBooks.includes(book.id);
        const isActive = actionBookId === book.id;

        return (
          <View key={book.id} style={[styles.bookRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.bookInfo}>
              <Text style={[styles.bookName, { color: colors.textPrimary }]}>{book.name}</Text>
              <Text style={[styles.bookMeta, { color: colors.textTertiary }]}>
                {book.chapterCount} chapters
              </Text>
            </View>
            {isActive ? (
              <ActivityIndicator size="small" color={colors.gold} />
            ) : isDownloaded ? (
              <Pressable
                onPress={() => handleDelete(book.id)}
                style={styles.actionButton}
                testID={`book-delete-${book.id}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => handleDownload(book.id)}
                style={styles.actionButton}
                testID={`book-download-${book.id}`}
              >
                <Ionicons name="download-outline" size={18} color={colors.gold} />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: fontSizes.caption,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookInfo: {
    flex: 1,
  },
  bookName: {
    fontSize: fontSizes.body,
  },
  bookMeta: {
    fontSize: fontSizes.overline,
    marginTop: 2,
  },
  actionButton: {
    padding: spacing.sm,
  },
});
