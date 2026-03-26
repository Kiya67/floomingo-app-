
import { Stack } from 'expo-router';

export default function ExperiencesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
