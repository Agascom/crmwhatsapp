import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { campaignsStore, CAMPAIGN_STATUSES } from '../store/campaignsStore';
import Badge from '../components/Badge';

const STATUS_COLORS = { prepared: '#78909C', in_progress: '#FFA000', done: '#43A047' };

export default function CampaignsScreen({ navigation }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      campaignsStore
        .list()
        .then(setCampaigns)
        .finally(() => setLoading(false));
    }, [])
  );

  const remove = (camp) => {
    Alert.alert(
      'Supprimer la campagne',
      `Supprimer « ${camp.name} » et sa liste de destinataires ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await campaignsStore.remove(camp.id);
            setCampaigns(await campaignsStore.list());
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.id })}
      onLongPress={() => remove(item)}
    >
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta}>
          {item.recipient_count} destinataire{item.recipient_count > 1 ? 's' : ''} ·{' '}
          {item.sent_count} envoyé{item.sent_count > 1 ? 's' : ''}
          {item.template_name ? ` · ${item.template_name}` : ''}
        </Text>
      </View>
      <Badge label={CAMPAIGN_STATUSES[item.status] || item.status} color={STATUS_COLORS[item.status] || '#78909C'} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Relances proposées, jamais envoyées seules.</Text>
        <Text style={styles.bannerText}>
          Chaque destinataire est ouvert dans WhatsApp avec le message prérempli : vous validez l'envoi.
        </Text>
      </View>
      <FlatList
        data={campaigns}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={campaigns.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Chargement...' : 'Aucune campagne. Créez-en une avec +.'}
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CampaignForm', {})}
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
