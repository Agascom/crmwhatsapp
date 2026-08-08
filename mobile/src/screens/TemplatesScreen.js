import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { templatesStore } from '../store/templatesStore';

export default function TemplatesScreen({ navigation }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      templatesStore
        .list()
        .then(setTemplates)
        .finally(() => setLoading(false));
    }, [])
  );

  const remove = (tpl) => {
    Alert.alert('Supprimer le modèle', `Supprimer « ${tpl.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await templatesStore.remove(tpl.id);
          setTemplates(await templatesStore.list());
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Utilisez {'{name}'}, {'{phone}'} et {'{status}'} pour personnaliser chaque message.
        </Text>
      </View>
      <FlatList
        data={templates}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('TemplateForm', { templateId: item.id })}
            onLongPress={() => remove(item)}
          >
            <View style={styles.body}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.bodyText} numberOfLines={2}>{item.body}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={templates.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Chargement...' : 'Aucun modèle. Créez-en un avec +.'}</Text>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('TemplateForm', {})}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  banner: { backgroundColor: colors.background, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  bannerText: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
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
  bodyText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
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
