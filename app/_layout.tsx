import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Group name="dashboard">
          <Stack.Screen name="index" options={{ headerShown: true, title: 'Overview' }} />
          <Stack.Screen name="dishes" options={{ headerShown: true, title: 'My Bucket' }} />
          <Stack.Screen name="planner" options={{ headerShown: true, title: 'Meal Planner' }} />
          <Stack.Screen name="health-hub" options={{ headerShown: true, title: 'Health Hub' }} />
        </Stack.Group>
      </Stack>
    </SafeAreaProvider>
  );
}
