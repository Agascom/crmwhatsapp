import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { opportunitiesStore, getStages } from '../store/opportunitiesStore';
import { api } from '../api';

function fmt(v) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function StageCard({ stage, deals, navigation }) {
  const stageDeals = deals.filter((d) => d.stage === stage.key);
  const total = stageDeals.reduce((s, d) => s + Number(d.value || 0), 0);

  return (
    <View style={styles.column}>
      <View style={[styles.columnHeader, { backgroundColor: stage.color }]}>
        <Text style={styles.columnTitle}>{stage.label}</Text>
        <Text style={styles.columnCount}>
          {stageDeals.length} · {fmt(total)}
        </Text>
      </View>
      <FlatList
        data={stageDeals}
        keyExtractor={(item) => String(item.client_id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Opportunity', { clientId: item.client_id })}
            onLongPress={() => {
              const chatId = api.phoneToChatId(item.client_phone);
              navigation.navigate('Chat', { chatId, title: item.client_name });
            }}
          >
            <Text style={styles.cardName} numberOfLines={1}>{item.client_name}</Text>
            {item.value > 0 ? <Text style={styles.cardValue}>{fmt(item.value)}</Text> : null}
            <Text style={styles.cardPhone}>
              {item.client_phone ? `+${item.client_phone}` : 'Pas de numéro'}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.columnEmpty}>—</Text>}
        contentContainerStyle={styles.columnContent}
      />
    </View>
  );
}

export default function PipelineScreen({ navigation }) {
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [st, d] = await Promise.all([getStages(), opportunitiesStore.listAll()]);
      setStages(st);
      setDeals(d);
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totalValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.toolbarTitle}>Pipeline de vente</Text>
          <Text style={styles.toolbarSub}>{deals.length} prospects · {fmt(totalValue)} en cours</Text>
        </View>
        <TouchableOpacity style={styles.importBtn} onPress={() => navigation.navigate('Import')}>
          <Text style={styles.importText}>Importer</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.empty}>Chargement...</Text>
      ) : (
        <FlatList
          horizontal
          data={stages}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <StageCard stage={item} deals={deals} navigation={navigation} />
          )}
          contentContainerStyle={styles.columns}
          showsHorizontalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  toolbarTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  toolbarSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  importBtn: {
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  importText: { color: colors.primaryDeep, fontSize: 13, fontWeight: '700' },
  columns: { padding: 12, gap: 12 },
  column: {
    width: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  columnHeader: { padding: 10 },
  columnTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  columnCount: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  columnContent: { padding: 8, gap: 8 },
  columnEmpty: { textAlign: 'center', color: colors.textMuted, fontSize: 13, paddingVertical: 12 },
  card: {
    backgroundColor: colors.incoming,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardValue: { fontSize: 13, fontWeight: '700', color: colors.primaryDeep, marginTop: 3 },
  cardPhone: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 }
});
