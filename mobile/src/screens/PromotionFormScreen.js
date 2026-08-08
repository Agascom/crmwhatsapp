import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { colors } from '../theme';
import { promotionsStore } from '../store/promotionsStore';

const VALIDITY_OPTIONS = [7, 15, 30, 60];

export default function PromotionFormScreen({ route, navigation }) {
  const { promotionId } = route.params || {};
  const isEdit = Boolean(promotionId);

  const [title, setTitle] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [body, setBody] = useState('');
  const [validityDays, setValidityDays] = useState(30);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      promotionsStore
        .get(promotionId)
        .then((p) => {
          if (p) {
            setTitle(p.title);
            setDiscountLabel(p.discount_label || '');
            setBody(p.body);
            setActive(Boolean(p.active));
            if (p.valid_until) {
              const days = Math.round((p.valid_until - Date.now()) / 86400000);
              setValidityDays(days > 0 ? Math.min(days, 60) : 30);
            }
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isEdit, promotionId]);

  const save = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Champs requis', 'Titre et message sont obligatoires.');
      return;
    }
    try {
      setSaving(true);
      const data = {
        title: title.trim(),
        body,
        discount_label: discountLabel.trim(),
        active
      };
      if (isEdit) {
        data.valid_until = validityDays ? Date.now() + validityDays * 86400000 : null;
        await promotionsStore.update(promotionId, data);
      } else {
        data.valid_until = validityDays ? Date.now() + validityDays * 86400000 : null;
        await promotionsStore.create(data);
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
      <Text style={styles.label}>Titre</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Ex. -20% sur le site vitrine"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Réduction (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={discountLabel}
        onChangeText={setDiscountLabel}
        placeholder="Ex. -20% / 1 mois offert"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.body]}
        value={body}
        onChangeText={setBody}
        placeholder={'Bonjour {name},\n\nProfitez de notre offre : -20% sur...'}
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Text style={styles.label}>Validité</Text>
      <View style={styles.validityRow}>
        {VALIDITY_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.validityBtn, validityDays === d && styles.validityBtnActive]}
            onPress={() => setValidityDays(d)}
          >
            <Text style={[styles.validityText, validityDays === d && styles.validityTextActive]}>
              {d} j
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.validityBtn, validityDays === 0 && styles.validityBtnActive]}
          onPress={() => setValidityDays(0)}
        >
          <Text style={[styles.validityText, validityDays === 0 && styles.validityTextActive]}>
            En continu
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.activeRow}>
        <Text style={styles.activeLabel}>Promotion active</Text>
        <Switch
          value={active}
          onValueChange={setActive}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>{isEdit ? 'Enregistrer' : 'Créer la promotion'}</Text>
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
  body: { minHeight: 140, textAlignVertical: 'top' },
  validityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  validityBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.incoming
  },
  validityBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  validityText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  validityTextActive: { color: '#fff' },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20
  },
  activeLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
