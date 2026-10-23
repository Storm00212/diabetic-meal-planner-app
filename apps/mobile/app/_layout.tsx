import 'react-native-gesture-handler';
import '../global.css';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { ThemeProvider, useThemeScheme } from '../src/shared/components/ThemeContext';

export default function Layout() {
  const scheme = useThemeScheme();

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={scheme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={scheme === "dark" ? "#0f172a" : "#f8fafc"}
      />
      <ThemeProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          {/* Routes in app/dashboard/ have no _layout file, so they are hoisted
              to this layout and named by their full relative path. */}
          <Stack.Screen name="dashboard/index" options={{ headerShown: true, title: 'Overview' }} />
          <Stack.Screen name="dashboard/dishes/index" options={{ headerShown: true, title: 'My Bucket' }} />
          <Stack.Screen name="dashboard/planner/index" options={{ headerShown: true, title: 'Meal Planner' }} />
          <Stack.Screen name="dashboard/plans/index" options={{ headerShown: true, title: 'Saved Plans' }} />
          <Stack.Screen name="dashboard/analytics/index" options={{ headerShown: true, title: 'Analytics' }} />
          <Stack.Screen name="dashboard/health-hub/index" options={{ headerShown: true, title: 'Health Hub' }} />
          <Stack.Screen name="dashboard/settings/index" options={{ headerShown: true, title: 'Settings' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
