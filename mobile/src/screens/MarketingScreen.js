import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { campaignsStore, CAMPAIGN_STATUSES } from '../store/campaignsStore';
import { api, isAuthError } from '../api';
import Badge from '../components/Badge';

const STATUS_COLORS = { prepared: '#78909C', in_progress: '#FFA000', done: '#43A047' };

export default function MarketingScreen({ navigation, onLogout }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [measuringId, setMeasuringId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await campaignsStore.list({ kind: 'marketing' });
      setCampaigns(data);
    } catch (err) {
      if (isAuthError(err)) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const measure = async (camp) => {
    setMeasuringId(camp.id);
    try {
      const replies = await campaignsStore.measureReplies(camp.id);
      if (replies.length === 0) {
        Alert.alert('Statistiques', 'Aucune réponse détectée parmi les destinataires envoyés.');
      } else {
        const lines = replies
          .map((r) => `${r.clientName} : ${r.count} réponse${r.count > 1 ? 's' : ''} (« ${String(r.lastMessage).slice(0, 40)}… »)`)
          .join('\n');
        Alert.alert(`Retours reçus (${replies.length})`, lines);
      }
    } catch (err) {
      if (isAuthError(err)) onLogout();
      else Alert.alert('Mesure impossible', err.message);
    } finally {
      setMeasuringId(null);
    }
  };

  const remove = (camp) => {
    Alert.alert('Supprimer la campagne', `Supprimer « ${camp.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await campaignsStore.remove(camp.id);
          load();
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.id })}
      onLongPress={() => remove(item)}
    >
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.promotion_title || item.template_name || 'Message libre'}
        </Text>
        <Text style={styles.meta}>
          {item.recipient_count} destinataire{item.recipient_count > 1 ? 's' : ''} · {item.sent_count} envoyé{item.sent_count > 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Badge label={CAMPAIGN_STATUSES[item.status] || item.status} color={STATUS_COLORS[item.status] || '#78909C'} />
        <TouchableOpacity
          style={styles.statsBtn}
          onPress={() => measure(item)}
          disabled={measuringId === item.id || item.sent_count === 0}
        >
          {measuringId === item.id ? (
            <ActivityIndicator color={colors.primaryDeep} size="small" />
          ) : (
            <Text style={styles.statsText}>📊</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Promotions & campagnes marketing</Text>
        <Text style={styles.bannerText}>
          Créez une promotion, visez un segment, puis envoyez chaque message en le validant à la main.
        </Text>
      </View>
      <FlatList
        data={campaigns}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={campaigns.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Chargement...' : 'Aucune campagne marketing. Créez-en une avec +.'}
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CampaignForm', { kind: 'marketing' })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  banner: { backgroundColor: colors.background, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  bannerText: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  body: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  right: { alignItems: 'center', gap: 6 },
  statsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.incoming
  },
  statsText: { fontSize: 15 },
  emptyContainer: { flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40, padding: 20 },
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
