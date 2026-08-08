import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { campaignsStore, CAMPAIGN_STATUSES, renderTemplate } from '../store/campaignsStore';
import { api } from '../api';
import Badge from '../components/Badge';

const STATUS_COLORS = { prepared: '#78909C', in_progress: '#FFA000', done: '#43A047' };
const RECIPIENT_COLORS = { pending: '#78909C', sent: '#43A047', skipped: '#E53935' };
const RECIPIENT_LABELS = { pending: 'En attente', sent: 'Envoyé', skipped: 'Ignoré' };

export default function CampaignDetailScreen({ route, navigation }) {
  const { campaignId } = route.params || {};
  const [campaign, setCampaign] = useState(null);

  const load = useCallback(async () => {
    setCampaign(await campaignsStore.get(campaignId));
  }, [campaignId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!campaign) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const pending = campaign.recipients.filter((r) => r.status === 'pending').length;
  const sent = campaign.recipients.filter((r) => r.status === 'sent').length;

  const openWhatsApp = (r) => {
    if (!r.client_phone) {
      Alert.alert('Numéro manquant', `${r.client_name} n'a pas de numéro.`);
      return;
    }
    const message = campaign.template
      ? renderTemplate(campaign.template.body, r)
      : `Bonjour ${r.client_name},`;
    const chatId = api.phoneToChatId(r.client_phone);
    navigation.navigate('Chat', { chatId, title: r.client_name, initialText: message });
  };

  const mark = async (r, status) => {
    await campaignsStore.setRecipientStatus(r.id, status);
    load();
  };

  const remove = () => {
    Alert.alert(
      'Supprimer la campagne',
      `Supprimer « ${campaign.name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await campaignsStore.remove(campaignId);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const firstClient = campaign.recipients[0] || null;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={campaign.recipients}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View style={styles.headerBody}>
              <Text style={styles.name}>{campaign.name}</Text>
              <Text style={styles.meta}>
                {campaign.recipients.length} destinataire(s) · {sent} envoyé(s) · {pending} en attente
              </Text>
            </View>
            <Badge
              label={CAMPAIGN_STATUSES[campaign.status] || campaign.status}
              color={STATUS_COLORS[campaign.status] || '#78909C'}
            />
          </View>

          {campaign.template ? (
            <View style={styles.tplBox}>
              <Text style={styles.tplLabel}>Modèle : {campaign.template.name}</Text>
              <Text style={styles.tplText}>
                {firstClient
                  ? renderTemplate(campaign.template.body, firstClient)
                  : campaign.template.body}
              </Text>
              {firstClient ? <Text style={styles.tplHint}>Aperçu pour {firstClient.client_name} — {firstClient.client_phone ? `+${firstClient.client_phone}` : ''}</Text> : null}
            </View>
          ) : (
            <View style={styles.tplBox}>
              <Text style={styles.tplLabel}>Message libre</Text>
              <Text style={styles.tplText}>Bonjour {firstClient ? firstClient.client_name : '{name}'},</Text>
            </View>
          )}

          <Text style={styles.listTitle}>Destinataires</Text>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <Text style={styles.rowName} numberOfLines={1}>{item.client_name}</Text>
            <Text style={styles.rowPhone}>{item.client_phone ? `+${item.client_phone}` : 'Pas de numéro'}</Text>
            <Text style={[styles.rowStatus, { color: RECIPIENT_COLORS[item.status] }]}>
              {RECIPIENT_LABELS[item.status] || item.status}
            </Text>
          </View>
          <View style={styles.actions}>
            {item.status !== 'sent' ? (
              <TouchableOpacity style={styles.waBtn} onPress={() => openWhatsApp(item)}>
                <Text style={styles.waText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {item.status === 'pending' ? (
              <>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() =>
                    Alert.alert('Marquer envoyé', `Confirmer l'envoi à ${item.client_name} ?`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Oui', onPress: () => mark(item, 'sent') }
                    ])
                  }
                >
                  <Text style={styles.smallBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() =>
                    Alert.alert('Ignorer', `Ignorer ${item.client_name} ?`, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Ignorer', onPress: () => mark(item, 'skipped') }
                    ])
                  }
                >
                  <Text style={styles.smallBtnText}>✕</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>Aucun destinataire dans cette campagne.</Text>
      }
      ListFooterComponent={
        campaign && campaign.recipients.length > 0 ? (
          <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
            <Text style={styles.deleteText}>Supprimer la campagne</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBody: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  tplBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 10
  },
  tplLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  tplText: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20 },
  tplHint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  listTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 20, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    gap: 8
  },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowPhone: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowStatus: { fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waBtn: {
    backgroundColor: colors.primaryDeep,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  waText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  smallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.incoming
  },
  smallBtnText: { fontSize: 15, color: colors.textMuted, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 30 },
  deleteBtn: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' }
});
