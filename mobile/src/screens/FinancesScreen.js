import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme';
import { paymentsStore } from '../store/paymentsStore';
import { buildRelanceMessage } from '../relance';
import { api } from '../api';
import Section from '../components/Section';
import EmptyState from '../components/EmptyState';

function fmt(v) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function FinancesScreen({ navigation, onLogout }) {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const [s, p] = await Promise.all([paymentsStore.stats(), paymentsStore.listRecent(30)]);
          setStats(s);
          setPayments(p);
        } catch (err) {
          Alert.alert('Erreur', err.message);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  const relancer = (row) => {
    const message = buildRelanceMessage({
      client: { name: row.client_name },
      invoice: row
    });
    Alert.alert(
      'Relance préparée',
      'Le message est prêt. Vous l’envoyez manuellement (aucun envoi automatique).',
      [
        { text: 'Copier', onPress: () => Clipboard.setStringAsync(message) },
        {
          text: 'Ouvrir WhatsApp',
          onPress: () => {
            const chatId = api.phoneToChatId(row.client_phone);
            navigation.navigate('Chat', { chatId, title: row.client_name, initialText: message });
          }
        },
        { text: 'Annuler', style: 'cancel' }
      ]
    );
  };

  if (loading && !stats) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cards}>
        <View style={[styles.card, styles.cardGreen]}>
          <Text style={styles.cardLabel}>CA encaissé</Text>
          <Text style={styles.cardValue}>{stats ? fmt(stats.received) : '—'}</Text>
          <Text style={styles.cardSub}>dont {stats ? fmt(stats.monthReceived) : '0,00 €'} ce mois</Text>
        </View>
        <View style={[styles.card, styles.cardBlue]}>
          <Text style={styles.cardLabel}>À encaisser</Text>
          <Text style={styles.cardValue}>{stats ? fmt(stats.outstanding) : '—'}</Text>
          <Text style={styles.cardSub}>{stats ? `${stats.outstandingCount} facture(s)` : ''}</Text>
        </View>
        <View style={[styles.card, styles.cardAmber]}>
          <Text style={styles.cardLabel}>Devis en attente</Text>
          <Text style={styles.cardValue}>{stats ? fmt(stats.pendingQuotes) : '—'}</Text>
          <Text style={styles.cardSub}>{stats ? `${stats.pendingQuotesCount} devis` : ''}</Text>
        </View>
      </View>

      <Section title="À relancer">
        {!stats || stats.overdue.length === 0 ? (
          <EmptyState text="Aucune facture en retard. Tout est en règle !" />
        ) : (
          stats.overdue.map((row) => (
            <TouchableOpacity key={row.id} style={styles.overdueRow} onPress={() => relancer(row)}>
              <View style={styles.overdueBody}>
                <Text style={styles.overdueTitle} numberOfLines={1}>
                  {row.client_name}
                </Text>
                <Text style={styles.overdueMeta}>
                  {row.number} · {fmt(row.total_ttc)}
                </Text>
              </View>
              <View style={styles.overdueRight}>
                <Text style={styles.overdueDays}>+{row.days}j</Text>
                <Text style={styles.overdueAction}>Relancer ›</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Section>

      <Section title="Derniers encaissements">
        {payments.length === 0 ? (
          <EmptyState text="Aucun encaissement enregistré." />
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.payRow}>
              <View style={styles.payBody}>
                <Text style={styles.payTitle} numberOfLines={1}>{p.client_name || 'Client inconnu'}</Text>
                <Text style={styles.payMeta}>
                  {p.invoice_number ? `${p.invoice_number} · ` : ''}{fmtDate(p.created_at)}
                  {p.method ? ` · ${p.method}` : ''}
                </Text>
              </View>
              <Text style={styles.payAmount}>+{fmt(p.amount)}</Text>
            </View>
          ))
        )}
      </Section>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('PaymentForm', {})}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 100 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.textMuted },
  cards: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, borderRadius: 12, padding: 12 },
  cardGreen: { backgroundColor: '#E8F5E9' },
  cardBlue: { backgroundColor: '#E3F2FD' },
  cardAmber: { backgroundColor: '#FFF8E1' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  cardValue: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 4 },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10
  },
  overdueBody: { flex: 1 },
  overdueTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  overdueMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  overdueRight: { alignItems: 'flex-end' },
  overdueDays: { fontSize: 12, fontWeight: '700', color: colors.danger },
  overdueAction: { fontSize: 12, fontWeight: '700', color: colors.primaryDeep, marginTop: 3 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 9
  },
  payBody: { flex: 1 },
  payTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  payMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  payAmount: { fontSize: 15, fontWeight: '800', color: colors.primaryDeep },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34 }
});
