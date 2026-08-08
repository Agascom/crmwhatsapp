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
import { api, getConfig, setConfig } from '../api';

export default function LoginScreen({ onLogin }) {
  const [apiUrl, setApiUrlValue] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const loadConfig = async () => {
    const cfg = await getConfig();
    if (cfg.url) setApiUrlValue(cfg.url);
    if (cfg.key) setApiKey(cfg.key);
  };
  React.useEffect(() => { loadConfig(); }, []);

  const submit = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      Alert.alert('Champs requis', 'Saisissez l\'adresse du serveur OpenWA et la clé API.');
      return;
    }
    try {
      setLoading(true);
      await setConfig({ url: apiUrl.trim(), key: apiKey.trim() });
      await api.connect();
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
        <Text style={styles.subtitle}>Connexion directe à OpenWA</Text>

        <Text style={styles.label}>Adresse OpenWA</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrlValue}
          placeholder="https://openwa.votre-domaine.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={styles.label}>Clé API</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="owa_k1_..."
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>
          La clé API vient du dashboard OpenWA (menu API Keys). Rôle OPERATOR requis pour envoyer des messages.
        </Text>
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
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 16,
    lineHeight: 16
  }
});
