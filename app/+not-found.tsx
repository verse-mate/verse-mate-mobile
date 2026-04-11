import { useTheme } from '@/contexts/ThemeContext';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.code, { color: colors.textSecondary }]}>404</Text>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Page not found</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        The page you're looking for doesn't exist or has been moved.
      </Text>
      <Link href="/bible/1/1" style={[styles.link, { color: colors.gold }]}>
        Go to Bible
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  code: {
    fontSize: 72,
    fontWeight: '200',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 400,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
