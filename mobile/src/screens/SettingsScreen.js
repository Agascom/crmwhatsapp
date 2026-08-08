import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api, getConfig, setConfig, isAuthError } from '../api';

export default function SettingsScreen({ onLogout }) {
  const [apiUrl, setUrl] = useState('');
  const [apiKey, setKey] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getConfig().then((cfg) => {
        if (cfg.url) setUrl(cfg.url);
        if (cfg.key) setKey(cfg.key);
      });
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await api.getSessions();
      setSessions(data);
    } catch (err) {
      if (isAuthError(err)) onLogout();
    } finally {
      setLoadingSessions(false);
    }
  };

  const saveConfig = async () => {
    if (!apiUrl.trim() || !apiKey.trim()) {
      Alert.alert('Champs requis', 'L\'adresse et la clé API sont requises.');
      return;
    }
    try {
      await setConfig({ url: apiUrl.trim(), key: apiKey.trim() });
      await api.connect();
      Alert.alert('Enregistré', 'Configuration mise à jour.');
      loadSessions();
    } catch (err) {
      Alert.alert('Impossible de se connecter', err.message || 'Erreur réseau');
    }
  };

  const confirmLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment effacer la configuration ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: onLogout }
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Serveur OpenWA</Text>
      <TextInput
        style={styles.input}
        value={apiUrl}
        onChangeText={setUrl}
        placeholder="https://openwa.votre-domaine.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setKey}
        placeholder="owa_k1_..."
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <TouchableOpacity style={styles.saveButton} onPress={saveConfig}>
        <Text style={styles.saveText}>Enregistrer la configuration</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Connexion WhatsApp</Text>
      {loadingSessions ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
      ) : sessions.length === 0 ? (
        <Text style={styles.empty}>
          Aucune session détectée. Connectez votre numéro depuis le dashboard OpenWA.
        </Text>
      ) : (
        sessions.map((s) => (
          <View key={s.id} style={styles.sessionRow}>
            <View>
              <Text style={styles.sessionName}>{s.name}</Text>
              <Text style={styles.sessionPhone}>{s.phone || 'Non connecté'}</Text>
            </View>
            <View style={[styles.dot, { backgroundColor: s.status === 'ready' ? '#43A047' : '#E53935' }]} />
          </View>
        ))
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
        <Text style={styles.logoutText}>Effacer la configuration</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginTop: 20, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 8
  },
  saveButton: {
    marginTop: 10,
    backgroundColor: colors.primaryDeep,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sessionName: { fontSize: 15, fontWeight: '600', color: colors.text },
  sessionPhone: { fontSize: 13, color: colors.textMuted },
  dot: { width: 12, height: 12, borderRadius: 6 },
  logoutButton: { marginTop: 40, alignItems: 'center', paddingVertical: 10 },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '600' }
});
