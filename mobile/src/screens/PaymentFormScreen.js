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
import { invoicesStore } from '../store/invoicesStore';
import { paymentsStore } from '../store/paymentsStore';

const METHODS = ['Virement', 'Espèces', 'CB', 'PayPal', 'Autre'];

function fmt(v) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
}

export default function PaymentFormScreen({ route, navigation }) {
  const { invoiceId: prefilledInvoiceId, clientId: prefilledClientId, clientName } = route.params || {};

  const [openInvoices, setOpenInvoices] = useState([]);
  const [mode, setMode] = useState(prefilledInvoiceId ? 'invoice' : 'standalone');
  const [selectedId, setSelectedId] = useState(prefilledInvoiceId || null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Virement');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoicesStore
      .listOpenInvoices()
      .then((rows) => {
        setOpenInvoices(rows);
        if (prefilledInvoiceId) {
          const inv = rows.find((r) => String(r.id) === String(prefilledInvoiceId));
          if (inv) setAmount(String(inv.remaining > 0 ? inv.remaining : inv.total_ttc));
        }
      })
      .finally(() => setLoading(false));
  }, [prefilledInvoiceId]);

  const selectInvoice = (id) => {
    setSelectedId(id);
    const inv = openInvoices.find((r) => String(r.id) === String(id));
    if (inv) setAmount(String(inv.remaining > 0 ? inv.remaining : inv.total_ttc));
  };

  const save = async () => {
    const amt = Number(String(amount).replace(',', '.'));
    if (!amt || amt <= 0) {
      Alert.alert('Montant requis', 'Indiquez un montant valide.');
      return;
    }
    let clientId = prefilledClientId;
    if (mode === 'invoice' && selectedId) {
      const inv = openInvoices.find((r) => String(r.id) === String(selectedId));
      clientId = inv.client_id;
    }
    if (!clientId) {
      Alert.alert('Client requis', 'Encaissement sans facture : sélectionnez un client d’abord.');
      return;
    }
    try {
      setSaving(true);
      await paymentsStore.record({
        invoiceId: mode === 'invoice' ? selectedId : null,
        clientId,
        amount: amt,
        method,
        note
      });
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
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'invoice' && styles.modeBtnActive]}
          onPress={() => setMode('invoice')}
        >
          <Text style={[styles.modeText, mode === 'invoice' && styles.modeTextActive]}>Sur facture</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'standalone' && styles.modeBtnActive]}
          onPress={() => setMode('standalone')}
        >
          <Text style={[styles.modeText, mode === 'standalone' && styles.modeTextActive]}>Sans facture</Text>
        </TouchableOpacity>
      </View>

      {mode === 'invoice' ? (
        <>
          <Text style={styles.label}>Facture à régler</Text>
          {openInvoices.length === 0 ? (
            <Text style={styles.empty}>
              Aucune facture ouverte. Créez une facture depuis une fiche client.
            </Text>
          ) : (
            openInvoices.map((inv) => {
              const selected = String(inv.id) === String(selectedId);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.invRow, selected && styles.invRowSelected]}
                  onPress={() => selectInvoice(inv.id)}
                >
                  <View style={styles.invBody}>
                    <Text style={styles.invTitle} numberOfLines={1}>{inv.client_name}</Text>
                    <Text style={styles.invMeta}>
                      {inv.number} · reste {fmt(inv.remaining)} / {fmt(inv.total_ttc)}
                    </Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioActive]} />
                </TouchableOpacity>
              );
            })
          )}
        </>
      ) : (
        <Text style={styles.label}>
          Client : <Text style={styles.clientName}>{clientName || 'À renseigner'}</Text>
        </Text>
      )}

      <Text style={styles.label}>Montant (€)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="0,00"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Moyen de paiement</Text>
      <View style={styles.methodRow}>
        {METHODS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.methodBtn, method === m && styles.methodBtnActive]}
            onPress={() => setMethod(m)}
          >
            <Text style={[styles.methodText, method === m && styles.methodTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Note</Text>
      <TextInput
        style={[styles.input, styles.note]}
        value={note}
        onChangeText={setNote}
        placeholder="Optionnel"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>Enregistrer l'encaissement</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  modeBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  modeTextActive: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 18, marginBottom: 6 },
  clientName: { color: colors.text, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 10 },
  invRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.incoming
  },
  invRowSelected: { borderColor: colors.primary, borderWidth: 2 },
  invBody: { flex: 1 },
  invTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  invMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted
  },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
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
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.incoming
  },
  methodBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  methodText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  methodTextActive: { color: '#fff' },
  note: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
