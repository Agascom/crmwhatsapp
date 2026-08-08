import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { colors, statusColors } from '../theme';
import { api, isAuthError } from '../api';

const STATUSES = ['prospect', 'client', 'finalise'];

export default function ContactScreen({ route, navigation, onLogout }) {
  const { id, phone: prefilledPhone, name: prefilledName } = route.params || {};
  const isEdit = Boolean(id);

  const [name, setName] = useState(prefilledName || '');
  const [phone, setPhone] = useState(prefilledPhone || '');
  const [status, setStatus] = useState('prospect');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api
        .getContact(id)
        .then((c) => {
          setName(c.name);
          setPhone(c.phone || '');
          setStatus(c.status || 'prospect');
          setNotes(c.notes || '');
        })
        .catch((err) => {
          if (isAuthError(err)) onLogout();
          else Alert.alert('Erreur', err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, onLogout]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Le nom du contact est obligatoire.');
      return;
    }
    try {
      setSaving(true);
      if (isEdit) {
        await api.updateContact(id, { name: name.trim(), phone, status, notes });
      } else {
        await api.createContact({ name: name.trim(), phone, status, notes });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Enregistrement impossible', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(
      'Supprimer le contact',
      `Confirmer la suppression de « ${name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await api.deleteContact(id);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const openChat = () => {
    const chatId = `${phone.replace(/[^0-9]/g, '')}@c.us`;
    navigation.navigate('Chat', { chatId, title: name });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom du client" />

      <Text style={styles.label}>Téléphone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+33..."
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Statut</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusBtn, status === s && { backgroundColor: statusColors[s] }]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.statusBtnText, status === s && { color: '#fff' }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes internes (préférences, historique...)"
        multiline
      />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>{isEdit ? 'Enregistrer' : 'Créer le contact'}</Text>
        )}
      </TouchableOpacity>

      {phone.trim() ? (
        <TouchableOpacity style={styles.chatButton} onPress={openChat}>
          <Text style={styles.chatText}>Ouvrir la conversation WhatsApp</Text>
        </TouchableOpacity>
      ) : null}

      {isEdit ? (
        <TouchableOpacity style={styles.deleteButton} onPress={remove}>
          <Text style={styles.deleteText}>Supprimer le contact</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.incoming
  },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  statusBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chatButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  chatText: { color: colors.primaryDeep, fontSize: 16, fontWeight: '700' },
  deleteButton: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' }
});
