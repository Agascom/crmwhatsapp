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
import { colors } from '../theme';
import { templatesStore } from '../store/templatesStore';

export default function TemplateFormScreen({ route, navigation }) {
  const { templateId } = route.params || {};
  const isEdit = Boolean(templateId);

  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      templatesStore
        .get(templateId)
        .then((t) => {
          if (t) {
            setName(t.name);
            setBody(t.body);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isEdit, templateId]);

  const save = async () => {
    if (!name.trim() || !body.trim()) {
      Alert.alert('Champs requis', 'Nom et message sont obligatoires.');
      return;
    }
    try {
      setSaving(true);
      if (isEdit) {
        await templatesStore.update(templateId, { name: name.trim(), body });
      } else {
        await templatesStore.create({ name: name.trim(), body });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Enregistrement impossible', err.message);
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
      <Text style={styles.label}>Nom du modèle</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ex. Relance devis"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.body]}
        value={body}
        onChangeText={setBody}
        placeholder={'Bonjour {name},\n\nVotre devis est disponible...'}
        placeholderTextColor={colors.textMuted}
        multiline
      />
      <Text style={styles.hint}>
        Variables disponibles : {'{name}'} (prénom/nom), {'{phone}'} (numéro), {'{status}'} (statut).
      </Text>

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>{isEdit ? 'Enregistrer' : 'Créer le modèle'}</Text>
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
  body: { minHeight: 160, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
