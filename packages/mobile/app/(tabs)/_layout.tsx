import { Tabs } from "expo-router";
import { House, ListBullets, Users, BookOpen, Lightning, CalendarBlank } from "phosphor-react-native";
import { useI18n } from "../../lib/i18n";
import { useTheme } from "../../lib/themeStore";

export default function TabLayout() {
  const { t } = useI18n();
  const c = useTheme((s) => s.colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.bgCard,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textDim,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('Home', 'Home'),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="generator"
        options={{
          title: t('Genera', 'Generate'),
          tabBarIcon: ({ color, size }) => <Lightning color={color} size={size} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('Libreria', 'Library'),
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t('Sedute', 'Sessions'),
          tabBarIcon: ({ color, size }) => <ListBullets color={color} size={size} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: t('Rosa', 'Roster'),
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('Partite', 'Matches'),
          tabBarIcon: ({ color, size }) => <CalendarBlank color={color} size={size} weight="fill" />,
        }}
      />
    </Tabs>
  );
}
