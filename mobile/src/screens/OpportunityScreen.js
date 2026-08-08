import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api, isAuthError } from '../api';
import { opportunitiesStore, getStages } from '../store/opportunitiesStore';
import Section from '../components/Section';
import EmptyState from '../components/EmptyState';

const CLOSE_OPTIONS = [7, 15, 30, 60];

function fmt(v) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
}

export default function OpportunityScreen({ route, navigation, onLogout }) {
  const { clientId } = route.params || {};
  const [client, setClient] = useState(null);
  const [stages, setStages] = useState([]);
  const [stage, setStage] = useState('new');
  const [value, setValue] = useState('');
  const [expectedClose, setExpectedClose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, st, deals] = await Promise.all([
        api.getContact(clientId),
        getStages(),
        opportunitiesStore.listAll()
      ]);
      setClient(c);
      setStages(st);
      const deal = deals.find((d) => Number(d.client_id) === Number(clientId));
      if (deal) {
        setStage(deal.stage);
        setValue(deal.value ? String(deal.value) : '');
        setExpectedClose(deal.expected_close || null);
      }
    } catch (err) {
      if (isAuthError(err)) onLogout();
      else Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, onLogout]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changeStage = async (s) => {
    setStage(s);
    await opportunitiesStore.setStage(clientId, s);
    if (s === 'won') {
      await api.updateContact(clientId, { status: 'client' });
      setClient({ ...client, status: 'client' });
    } else if (s === 'lost') {
      await api.updateContact(clientId, { status: 'prospect' });
      setClient({ ...client, status: 'prospect' });
    }
  };

  const saveValue = async () => {
    try {
      setSaving(true);
      await opportunitiesStore.setField(clientId, {
        value: Number(String(value).replace(',', '.')) || 0,
        expectedClose
      });
      Alert.alert('Enregistré', `Opportunité à ${fmt(value)}.`);
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!client) return null;

  const activeStage = stages.find((s) => s.key === stage);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name}>{client.name}</Text>
          <Text style={styles.phone}>{client.phone ? `+${client.phone}` : 'Pas de numéro'}</Text>
        </View>
        <TouchableOpacity
          style={styles.ficheBtn}
          onPress={() => navigation.navigate('Contact', { id: client.id })}
        >
          <Text style={styles.ficheText}>Fiche</Text>
        </TouchableOpacity>
      </View>

      {client.phone ? (
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() =>
            navigation.navigate('Chat', {
              chatId: api.phoneToChatId(client.phone),
              title: client.name
            })
          }
        >
          <Text style={styles.chatText}>Ouvrir WhatsApp</Text>
        </TouchableOpacity>
      ) : null}

      <Section title="Étape de vente">
        <View style={styles.stageWrap}>
          {stages.map((s) => {
            const active = s.key === stage;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.stageBtn, active && { backgroundColor: s.color }]}
                onPress={() => changeStage(s.key)}
              >
                <Text style={[styles.stageText, active && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <Section title="Montant de l'opportunité">
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />
      </Section>

      <Section title="Clôture prévue">
        <View style={styles.closeRow}>
          <TouchableOpacity
            style={[styles.closeBtn, !expectedClose && styles.closeBtnActive]}
            onPress={() => setExpectedClose(null)}
          >
            <Text style={[styles.closeText, !expectedClose && styles.closeTextActive]}>—</Text>
          </TouchableOpacity>
          {CLOSE_OPTIONS.map((d) => {
            const target = Date.now() + d * 86400000;
            const active = expectedClose && new Date(expectedClose).toDateString() === new Date(target).toDateString();
            return (
              <TouchableOpacity
                key={d}
                style={[styles.closeBtn, active && styles.closeBtnActive]}
                onPress={() => setExpectedClose(target)}
              >
                <Text style={[styles.closeText, active && styles.closeTextActive]}>+{d} j</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {expectedClose ? (
          <Text style={styles.closeDate}>
            {new Date(expectedClose).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Text>
        ) : null}
      </Section>

      <TouchableOpacity style={styles.saveButton} onPress={saveValue} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Enregistrer</Text>
        )}
      </TouchableOpacity>

      {activeStage ? (
        <View style={styles.stageInfo}>
          <EmptyState text={`Étape actuelle : ${activeStage.label}`} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerBody: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  phone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  ficheBtn: {
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  ficheText: { color: colors.primaryDeep, fontSize: 13, fontWeight: '700' },
  chatBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center'
  },
  chatText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stageWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.incoming
  },
  stageText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
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
  closeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  closeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.incoming
  },
  closeBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  closeText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  closeTextActive: { color: '#fff' },
  closeDate: { fontSize: 13, color: colors.text, marginTop: 8, fontWeight: '600' },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stageInfo: { marginTop: 24 }
});
