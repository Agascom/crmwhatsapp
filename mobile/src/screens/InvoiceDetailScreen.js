import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api, isAuthError } from '../api';
import {
  invoicesStore,
  QUOTE_STATUSES,
  INVOICE_STATUSES,
  STATUS_LABELS,
  TYPE_LABELS
} from '../store/invoicesStore';
import { generatePdf, invoiceFilename } from '../pdf';
import { paymentsStore } from '../store/paymentsStore';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import * as Sharing from 'expo-sharing';

const STATUS_COLORS = {
  draft: '#78909C',
  sent: '#1E88E5',
  accepted: '#43A047',
  rejected: '#E53935',
  paid: '#43A047',
  overdue: '#E53935',
  cancelled: '#78909C'
};

function fmtMoney(v) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function InvoiceDetailScreen({ route, navigation, onLogout }) {
  const { invoiceId } = route.params || {};
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const inv = await invoicesStore.get(invoiceId);
      if (!inv) {
        Alert.alert('Introuvable', 'Ce document n’existe plus.');
        navigation.goBack();
        return;
      }
      setInvoice(inv);
      const c = await api.getContact(inv.client_id);
      setClient(c);
      setPayments(await paymentsStore.listByInvoice(invoiceId));
    } catch (err) {
      if (isAuthError(err)) onLogout();
    } finally {
      setLoading(false);
    }
  }, [invoiceId, navigation, onLogout]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const allowedStatuses = invoice ? (invoice.type === 'invoice' ? INVOICE_STATUSES : QUOTE_STATUSES) : [];

  const changeStatus = async (s) => {
    await invoicesStore.setStatus(invoiceId, s);
    load();
  };

  const doPdf = async () => {
    if (!invoice || !client) return;
    try {
      setBusy(true);
      const gen = await generatePdf({ client, invoice, items: invoice.items });
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        Alert.alert('Partage indisponible', 'Le partage de fichiers n’est pas disponible sur cet appareil.');
        return;
      }
      await Sharing.shareAsync(gen.uri, { mimeType: 'application/pdf', dialogTitle: invoiceFilename(invoice) });
    } catch (err) {
      Alert.alert('Erreur PDF', err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendWhatsApp = async () => {
    if (!invoice || !client) return;
    if (!client.phone) {
      Alert.alert('Numéro manquant', 'Ajoutez un numéro au client pour envoyer le document.');
      return;
    }
    Alert.alert(
      'Envoyer le document',
      `Envoyer le ${TYPE_LABELS[invoice.type]} ${invoice.number} à ${client.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            try {
              setBusy(true);
              const gen = await generatePdf({ client, invoice, items: invoice.items });
              await api.sendDocument(api.phoneToChatId(client.phone), {
                base64: gen.base64,
                filename: invoiceFilename(invoice),
                mimetype: 'application/pdf',
                caption: `${TYPE_LABELS[invoice.type]} ${invoice.number} — ${fmtMoney(invoice.total_ttc)}`
              });
              await invoicesStore.setStatus(invoiceId, 'sent');
              load();
              Alert.alert('Envoyé', 'Le document a été envoyé via WhatsApp.');
            } catch (err) {
              Alert.alert('Envoi impossible', err.message);
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  };

  const remove = () => {
    Alert.alert(
      'Supprimer',
      `Supprimer le ${TYPE_LABELS[invoice.type]} ${invoice.number} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await invoicesStore.remove(invoiceId);
            navigation.goBack();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!invoice) return null;

  const tva = invoice.total_ttc - invoice.total_ht;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.docType}>{TYPE_LABELS[invoice.type]}</Text>
          <Text style={styles.docNumber}>N° {invoice.number}</Text>
        </View>
        <Badge label={STATUS_LABELS[invoice.status]} color={STATUS_COLORS[invoice.status]} />
      </View>

      <View style={styles.metaRow}>
        <View>
          <Text style={styles.metaLabel}>Client</Text>
          <Text style={styles.metaValue}>{client ? client.name : '—'}</Text>
          {client && client.phone ? <Text style={styles.metaSmall}>+{client.phone}</Text> : null}
        </View>
        <View style={styles.metaRight}>
          <Text style={styles.metaLabel}>Émis le</Text>
          <Text style={styles.metaValue}>{fmtDate(invoice.issue_date)}</Text>
          <Text style={styles.metaLabel}>Échéance</Text>
          <Text style={styles.metaValue}>{fmtDate(invoice.due_date)}</Text>
        </View>
      </View>

      {invoice.items.length === 0 ? (
        <EmptyState text="Aucune ligne." />
      ) : (
        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.td, styles.tLabel, styles.th]}>Désignation</Text>
            <Text style={[styles.td, styles.tNum, styles.th]}>Qté</Text>
            <Text style={[styles.td, styles.tNum, styles.th]}>PU</Text>
            <Text style={[styles.td, styles.tNum, styles.th]}>TVA</Text>
            <Text style={[styles.td, styles.tNum, styles.th]}>Total</Text>
          </View>
          {invoice.items.map((it) => (
            <View key={it.id} style={styles.tr}>
              <Text style={[styles.td, styles.tLabel]}>{it.label}</Text>
              <Text style={[styles.td, styles.tNum]}>{it.qty}</Text>
              <Text style={[styles.td, styles.tNum]}>{fmtMoney(it.unit_price)}</Text>
              <Text style={[styles.td, styles.tNum]}>{it.tva ? `${it.tva}%` : '—'}</Text>
              <Text style={[styles.td, styles.tNum]}>{fmtMoney(it.total)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total HT</Text>
          <Text style={styles.totalValue}>{fmtMoney(invoice.total_ht)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TVA</Text>
          <Text style={styles.totalValue}>{fmtMoney(tva)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total TTC</Text>
          <Text style={styles.totalGrand}>{fmtMoney(invoice.total_ttc)}</Text>
        </View>
      </View>

      {invoice.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{invoice.notes}</Text>
        </View>
      ) : null}

      <View style={styles.payHeader}>
        <Text style={styles.payHeaderTitle}>Encaissements</Text>
        <TouchableOpacity
          style={styles.payAddBtn}
          onPress={() =>
            navigation.navigate('PaymentForm', {
              invoiceId: invoice.id,
              clientId: invoice.client_id,
              clientName: client ? client.name : ''
            })
          }
        >
          <Text style={styles.payAddText}>+ Encaisser</Text>
        </TouchableOpacity>
      </View>
      {payments.length === 0 ? (
        <EmptyState text="Aucun encaissement pour ce document." />
      ) : (
        <>
          {payments.map((p) => (
            <View key={p.id} style={styles.payRow}>
              <View style={styles.payBody}>
                <Text style={styles.payText}>
                  {fmtMoney(p.amount)} {p.method ? `· ${p.method}` : ''}
                </Text>
                <Text style={styles.payMeta}>{fmtDate(p.created_at)}{p.note ? ` · ${p.note}` : ''}</Text>
              </View>
            </View>
          ))}
          <View style={styles.payTotal}>
            <Text style={styles.payTotalLabel}>Encaissé</Text>
            <Text style={styles.payTotalValue}>{fmtMoney(payments.reduce((s, p) => s + p.amount, 0))}</Text>
          </View>
        </>
      )}

      <Text style={styles.actionLabel}>Statut</Text>
      <View style={styles.statusRow}>
        {allowedStatuses.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusBtn, invoice.status === s && { backgroundColor: STATUS_COLORS[s] }]}
            onPress={() => changeStatus(s)}
          >
            <Text style={[styles.statusText, invoice.status === s && { color: '#fff' }]}>
              {STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={sendWhatsApp} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Envoyer par WhatsApp</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={doPdf} disabled={busy}>
          <Text style={styles.secondaryText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.editBtn}
        onPress={() =>
          navigation.navigate('InvoiceForm', {
            invoiceId: invoice.id,
            clientName: client ? client.name : ''
          })
        }
      >
        <Text style={styles.editText}>Modifier</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
        <Text style={styles.deleteText}>Supprimer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: {},
  docType: { fontSize: 22, fontWeight: '800', color: colors.primaryDeep },
  docNumber: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  metaRight: { alignItems: 'flex-end' },
  metaLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 4 },
  metaValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  metaSmall: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  table: { marginTop: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  thead: { backgroundColor: colors.background },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  td: { paddingHorizontal: 8, paddingVertical: 9, fontSize: 13, color: colors.text },
  tLabel: { flex: 2.2 },
  tNum: { flex: 0.9, textAlign: 'right' },
  th: { fontWeight: '700', color: colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  totals: { marginTop: 16, padding: 14, backgroundColor: colors.background, borderRadius: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalLabel: { color: colors.textMuted, fontSize: 14 },
  totalValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  totalGrand: { color: colors.primaryDeep, fontSize: 17, fontWeight: '800' },
  notesBox: { marginTop: 16 },
  notesLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  notesText: { fontSize: 13, color: colors.text, marginTop: 4 },
  payHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  payHeaderTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  payAddBtn: { borderWidth: 1, borderColor: colors.primaryDeep, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  payAddText: { color: colors.primaryDeep, fontSize: 12, fontWeight: '700' },
  payRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  payBody: { flex: 1 },
  payText: { fontSize: 14, fontWeight: '600', color: colors.text },
  payMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  payTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  payTotalLabel: { fontSize: 13, color: colors.textMuted },
  payTotalValue: { fontSize: 15, fontWeight: '800', color: colors.primaryDeep },
  actionLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 22, marginBottom: 6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.incoming
  },
  statusText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center'
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryText: { color: colors.primaryDeep, fontSize: 14, fontWeight: '700' },
  editBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  editText: { color: colors.primaryDeep, fontSize: 15, fontWeight: '600' },
  deleteBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' }
});
