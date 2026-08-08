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
import { templatesStore } from '../store/templatesStore';
import { campaignsStore } from '../store/campaignsStore';
import { clientsStore } from '../store/clientsStore';

const STATUSES = ['', 'prospect', 'client', 'finalise'];

export default function CampaignFormScreen({ route, navigation }) {
  const { templateId } = route.params || {};
  const [templates, setTemplates] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(templateId ? String(templateId) : '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [recipientCount, setRecipientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMeta = async () => {
    const [tpls, clients] = await Promise.all([templatesStore.list(), clientsStore.getAll()]);
    setTemplates(tpls);
    const tagSet = new Set();
    clients.forEach((c) => (c.tags || []).forEach((t) => tagSet.add(t)));
    setAllTags([...tagSet].sort());
    if (!selectedTemplate && tpls.length > 0) setSelectedTemplate(String(tpls[0].id));
  };

  useEffect(() => {
    loadMeta().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    campaignsStore
      .computeRecipients({ filterStatus, filterTag })
      .then((ids) => setRecipientCount(ids.length));
  }, [filterStatus, filterTag]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Donnez un nom à la campagne.');
      return;
    }
    try {
      setSaving(true);
      await campaignsStore.create({
        name: name.trim(),
        templateId: selectedTemplate ? Number(selectedTemplate) : null,
        filterStatus,
        filterTag
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Création impossible', err.message);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nom de la campagne</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex. Relance fin de mois"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.tplHeader}>
        <Text style={styles.label}>Modèle de message</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Templates')}>
          <Text style={styles.manageTpl}>Gérer les modèles</Text>
        </TouchableOpacity>
      </View>
      {templates.length === 0 ? (
        <Text style={styles.empty}>Aucun modèle. Créez-en un dans « Gérer les modèles ».</Text>
      ) : (
        templates.map((t) => {
          const selected = String(t.id) === selectedTemplate;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tplRow, selected && styles.tplRowSelected]}
              onPress={() => setSelectedTemplate(String(t.id))}
            >
              <View style={styles.tplBody}>
                <Text style={styles.tplName}>{t.name}</Text>
                <Text style={styles.tplBodyText} numberOfLines={2}>{t.body}</Text>
              </View>
              <View style={[styles.radio, selected && styles.radioActive]} />
            </TouchableOpacity>
          );
        })
      )}

      <Text style={styles.label}>Segment — statut</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s || 'all'}
            style={[
              styles.statusBtn,
              filterStatus === s && { backgroundColor: s ? statusColors[s] : colors.primaryDeep }
            ]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.statusText, filterStatus === s && { color: '#fff' }]}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Tous'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Segment — étiquette (optionnel)</Text>
      {allTags.length === 0 ? (
        <Text style={styles.empty}>Aucune étiquette définie sur vos clients.</Text>
      ) : (
        <View style={styles.tagRow}>
          <TouchableOpacity
            style={[styles.tagBtn, !filterTag && styles.tagBtnActive]}
            onPress={() => setFilterTag('')}
          >
            <Text style={[styles.tagText, !filterTag && styles.tagTextActive]}>Toutes</Text>
          </TouchableOpacity>
          {allTags.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tagBtn, filterTag === t && styles.tagBtnActive]}
              onPress={() => setFilterTag(t)}
            >
              <Text style={[styles.tagText, filterTag === t && styles.tagTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.countBox}>
        <Text style={styles.countText}>
          {recipientCount} destinataire{recipientCount > 1 ? 's' : ''} dans cette campagne
        </Text>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving || recipientCount === 0}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Créer la campagne</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
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
  tplHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  manageTpl: { color: colors.primaryDeep, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 8 },
  tplRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.incoming
  },
  tplRowSelected: { borderColor: colors.primary, borderWidth: 2 },
  tplBody: { flex: 1 },
  tplName: { fontSize: 14, fontWeight: '700', color: colors.text },
  tplBodyText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted, marginLeft: 8 },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
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
  statusText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.incoming
  },
  tagBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tagTextActive: { color: '#fff' },
  countBox: { marginTop: 20, padding: 14, backgroundColor: colors.background, borderRadius: 10 },
  countText: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  saveButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
