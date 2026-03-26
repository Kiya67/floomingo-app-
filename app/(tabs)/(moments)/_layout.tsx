
import { Stack } from 'expo-router';

export default function MomentsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
