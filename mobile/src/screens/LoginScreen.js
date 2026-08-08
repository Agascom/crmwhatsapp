import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';
import { api, getApiUrl, setApiUrl } from '../api';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrlValue] = useState('');
  const [loading, setLoading] = useState(false);

  const loadUrl = async () => setApiUrlValue(await getApiUrl());
  React.useEffect(() => { loadUrl(); }, []);

  const submit = async () => {
    if (!username || !password) {
      Alert.alert('Champs requis', 'Saisissez votre identifiant et votre mot de passe.');
      return;
    }
    try {
      setLoading(true);
      if (apiUrl.trim()) await setApiUrl(apiUrl.trim());
      await api.login(username.trim(), password);
      onLogin();
    } catch (err) {
      Alert.alert('Connexion impossible', err.message || 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.logo}>WhatsApp CRM</Text>
        <Text style={styles.subtitle}>Gérez vos clients et conversations</Text>

        <Text style={styles.label}>Adresse du serveur</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrlValue}
          placeholder="https://crm.votre-domaine.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.label}>Identifiant</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="admin"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDeep,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDeep,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 12
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text
  },
  button: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  }
});
