/**
 * Index Route
 *
 * Redirects to last read position on app launch, or defaults to Genesis 1
 */

import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useLastReadPosition } from '@/hooks/bible';

export default function Index() {
  const { lastPosition, isLoading } = useLastReadPosition();

  // Show loading indicator while fetching last read position
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Redirect to last read position if available
  if (lastPosition) {
    if (lastPosition.type === 'bible' && lastPosition.bookId && lastPosition.chapterNumber) {
      return <Redirect href={`/bible/${lastPosition.bookId}/${lastPosition.chapterNumber}`} />;
    }
    if (lastPosition.type === 'topic' && lastPosition.topicId) {
      return (
        <Redirect
          href={{
            pathname: '/topics/[topicId]',
            params: {
              topicId: lastPosition.topicId,
              category: lastPosition.topicCategory || 'EVENT',
            },
          }}
        />
      );
    }
  }

  // Default to Genesis 1 if no valid last position
  return <Redirect href="/bible/1/1" />;
}
