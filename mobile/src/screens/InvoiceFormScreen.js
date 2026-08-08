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
import { invoicesStore, computeTotals, TYPE_LABELS } from '../store/invoicesStore';
import Section from '../components/Section';

const TVA_RATES = [0, 5.5, 10, 20];
const DUE_OPTIONS = [15, 30, 60, 90];

function makeLine() {
  return { id: `l${Date.now()}-${Math.random()}`, label: '', qty: '1', unit_price: '', tva: 20 };
}

function money(v) {
  return Number(v || 0).toFixed(2).replace('.', ',');
}

export default function InvoiceFormScreen({ route, navigation }) {
  const { invoiceId, clientId, clientName, initialType } = route.params || {};
  const isEdit = Boolean(invoiceId);

  const [type, setType] = useState(initialType || 'quote');
  const [dueDays, setDueDays] = useState(initialType === 'invoice' ? 30 : 15);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      invoicesStore
        .get(invoiceId)
        .then((inv) => {
          if (!inv) {
            Alert.alert('Introuvable', 'Ce document n’existe plus.');
            navigation.goBack();
            return;
          }
          setType(inv.type);
          setNotes(inv.notes || '');
          setItems(
            inv.items.map((it) => ({
              id: `l${it.id}`,
              label: it.label,
              qty: String(it.qty),
              unit_price: String(it.unit_price),
              tva: Number(it.tva || 0)
            }))
          );
          const days = Math.round(((inv.due_date || inv.issue_date) - inv.issue_date) / 86400000);
          setDueDays(days > 0 && DUE_OPTIONS.includes(days) ? days : 30);
        })
        .finally(() => setLoading(false));
    }
  }, [isEdit, invoiceId, navigation]);

  const updateLine = (id, key, value) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
  };

  const removeLine = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const validItems = items.filter((it) => it.label && it.label.trim());
  const totals = computeTotals(
    validItems.map((it) => ({
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      tva: Number(it.tva)
    }))
  );

  const save = async () => {
    if (validItems.length === 0) {
      Alert.alert('Lignes requises', 'Ajoutez au moins une ligne de prestation.');
      return;
    }
    const payload = {
      type,
      items: validItems.map((it) => ({
        label: it.label.trim(),
        qty: Number(it.qty) || 0,
        unit_price: Number(it.unit_price) || 0,
        tva: Number(it.tva) || 0
      })),
      notes,
      dueDate: Date.now() + dueDays * 24 * 60 * 60 * 1000
    };
    try {
      setSaving(true);
      if (isEdit) {
        await invoicesStore.update(invoiceId, payload);
      } else {
        await invoicesStore.create({ ...payload, clientId });
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
      {!isEdit ? (
        <Section title="Type de document">
          <View style={styles.typeRow}>
            {Object.keys(TYPE_LABELS).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                onPress={() => {
                  setType(t);
                  setDueDays(t === 'invoice' ? 30 : 15);
                }}
              >
                <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                  {TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>
      ) : null}

      <Text style={styles.clientLabel}>
        Client : <Text style={styles.clientName}>{clientName || '...'}</Text>
      </Text>

      <Section title="Lignes">
        {items.map((it) => (
          <View key={it.id} style={styles.line}>
            <View style={styles.lineHeader}>
              <TextInput
                style={[styles.input, styles.lineLabel]}
                value={it.label}
                onChangeText={(v) => updateLine(it.id, 'label', v)}
                placeholder="Désignation (ex. site vitrine)"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity onPress={() => removeLine(it.id)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.lineRow}>
              <TextInput
                style={[styles.input, styles.lineNum]}
                value={it.qty}
                onChangeText={(v) => updateLine(it.id, 'qty', v)}
                placeholder="Qté"
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.input, styles.lineNum, styles.linePrice]}
                value={it.unit_price}
                onChangeText={(v) => updateLine(it.id, 'unit_price', v)}
                placeholder="PU €"
                keyboardType="decimal-pad"
              />
              <View style={styles.tvaRow}>
                {TVA_RATES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.tvaBtn, Number(it.tva) === r && styles.tvaBtnActive]}
                    onPress={() => updateLine(it.id, 'tva', r)}
                  >
                    <Text
                      style={[styles.tvaText, Number(it.tva) === r && styles.tvaTextActive]}
                    >
                      {r}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addLineBtn} onPress={() => setItems((p) => [...p, makeLine()])}>
          <Text style={styles.addLineText}>+ Ajouter une ligne</Text>
        </TouchableOpacity>
      </Section>

      <Section title="Échéance">
        <View style={styles.dueRow}>
          {DUE_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dueBtn, dueDays === d && styles.dueBtnActive]}
              onPress={() => setDueDays(d)}
            >
              <Text style={[styles.dueText, dueDays === d && styles.dueTextActive]}>+{d} j</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title="Notes">
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Conditions, délais, remise..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
      </Section>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total HT</Text>
          <Text style={styles.totalValue}>{money(totals.ht)} €</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total TTC</Text>
          <Text style={styles.totalGrand}>{money(totals.ttc)} €</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>{isEdit ? 'Enregistrer' : 'Créer le document'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  typeBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  typeText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  typeTextActive: { color: '#fff' },
  clientLabel: { fontSize: 14, color: colors.text, marginTop: 16 },
  clientName: { fontWeight: '700' },
  line: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.incoming
  },
  lineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineLabel: { flex: 1 },
  removeText: { color: colors.danger, fontSize: 16, padding: 4 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  lineNum: { flex: 1 },
  linePrice: { flex: 1.2 },
  tvaRow: { flexDirection: 'row', gap: 4 },
  tvaBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: colors.surface
  },
  tvaBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  tvaText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tvaTextActive: { color: '#fff' },
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
  addLineBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center'
  },
  addLineText: { color: colors.primaryDeep, fontSize: 14, fontWeight: '700' },
  dueRow: { flexDirection: 'row', gap: 8 },
  dueBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  dueBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  dueText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  dueTextActive: { color: '#fff' },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  totals: { marginTop: 20, padding: 14, backgroundColor: colors.background, borderRadius: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  totalValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  totalGrand: { color: colors.primaryDeep, fontSize: 17, fontWeight: '800' },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
