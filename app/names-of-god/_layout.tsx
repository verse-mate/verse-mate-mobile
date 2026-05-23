import { Stack } from 'expo-router';

export default function NamesOfGodLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[nameId]" />
    </Stack>
  );
}
