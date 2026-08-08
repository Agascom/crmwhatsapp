import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, statusColors } from '../theme';
import { api, isAuthError } from '../api';

export default function ContactsScreen({ navigation, onLogout }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (term) => {
    try {
      const data = await api.getContacts(term);
      setContacts(data);
    } catch (err) {
      if (isAuthError(err)) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  useFocusEffect(
    useCallback(() => {
      load(search.trim());
    }, [load, search])
  );

  const confirmDelete = (contact) => {
    Alert.alert(
      'Supprimer le contact',
      `Supprimer « ${contact.name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await api.deleteContact(contact.id);
            load(search.trim());
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('Contact', { id: item.id })}
      onLongPress={() => confirmDelete(item)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || colors.textMuted }]}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un client..."
          placeholderTextColor={colors.textMuted}
        />
      </View>
      <FlatList
        data={contacts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={contacts.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Chargement...' : 'Aucun contact. Appuyez sur + pour en ajouter.'}
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ContactForm', {})}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  searchBar: { padding: 10, backgroundColor: colors.surface },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    backgroundColor: colors.incoming
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  phone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
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
