import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { promotionsStore } from '../store/promotionsStore';

function fmtDate(ts) {
  if (!ts) return 'valable en continu';
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PromotionsScreen({ navigation }) {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      promotionsStore
        .list()
        .then(setPromotions)
        .finally(() => setLoading(false));
    }, [])
  );

  const toggleActive = async (p, value) => {
    await promotionsStore.toggleActive(p.id, value);
    setPromotions(await promotionsStore.list());
  };

  const remove = (p) => {
    Alert.alert('Supprimer la promotion', `Supprimer « ${p.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await promotionsStore.remove(p.id);
          setPromotions(await promotionsStore.list());
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={promotions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('PromotionForm', { promotionId: item.id })}
            onLongPress={() => remove(item)}
          >
            <View style={styles.body}>
              <Text style={[styles.title, !item.active && styles.inactive]}>
                {item.title}{item.discount_label ? ` · ${item.discount_label}` : ''}
              </Text>
              <Text style={styles.bodyText} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.meta}>{fmtDate(item.valid_until)}</Text>
            </View>
            <Switch
              value={Boolean(item.active)}
              onValueChange={(v) => toggleActive(item, v)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </TouchableOpacity>
        )}
        contentContainerStyle={promotions.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Chargement...' : 'Aucune promotion. Créez-en une avec +.'}
          </Text>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('PromotionForm', {})}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  inactive: { color: colors.textMuted },
  bodyText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
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
