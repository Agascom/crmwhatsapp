import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from './src/theme';
import { getToken, setToken } from './src/api';

import LoginScreen from './src/screens/LoginScreen';
import ConversationsScreen from './src/screens/ConversationsScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ChatScreen from './src/screens/ChatScreen';
import ContactScreen from './src/screens/ContactScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabStyles = { fontSize: 18 };

function HomeTabs({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.primaryDeep },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '700' }
      }}
    >
      <Tab.Screen
        name="Conversations"
        options={{
          title: 'WhatsApp CRM',
          tabBarLabel: 'Messages',
          tabBarIcon: () => <Text style={tabStyles}>💬</Text>
        }}
      >
        {(props) => <ConversationsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen
        name="Contacts"
        options={{ title: 'Contacts', tabBarLabel: 'Contacts', tabBarIcon: () => <Text style={tabStyles}>👥</Text> }}
      >
        {(props) => <ContactsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        options={{ title: 'Paramètres', tabBarLabel: 'Réglages', tabBarIcon: () => <Text style={tabStyles}>⚙️</Text> }}
      >
        {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then((t) => {
      setTokenState(t);
      setLoading(false);
    });
  }, []);

  const handleLogin = () => getToken().then(setTokenState);
  const handleLogout = async () => {
    await setToken(null);
    setTokenState(null);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryDeep },
          headerTintColor: colors.headerText,
          headerTitleStyle: { fontWeight: '700' }
        }}
      >
        {!token ? (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {() => <LoginScreen onLogin={handleLogin} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Home" options={{ headerShown: false }}>
              {() => <HomeTabs onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen
              name="Chat"
              options={({ route }) => ({ title: (route.params && route.params.title) || 'Conversation' })}
            >
              {(props) => <ChatScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="Contact" options={{ title: 'Fiche client' }}>
              {(props) => <ContactScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }
});
