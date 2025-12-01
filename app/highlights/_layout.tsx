import { Stack } from 'expo-router';

export default function HighlightsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[bookId]/[chapterNumber]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
