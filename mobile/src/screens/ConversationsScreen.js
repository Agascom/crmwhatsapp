import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api, isAuthError } from '../api';

function formatTime(ts) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export default function ConversationsScreen({ navigation, onLogout }) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.getConversations();
      setItems(data);
    } catch (err) {
      if (isAuthError(err)) onLogout();
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [onLogout]);

  useFocusEffect(
    useCallback(() => {
      load(true);
      timer.current = setInterval(() => load(true), 5000);
      return () => clearInterval(timer.current);
    }, [load])
  );

  const renderItem = ({ item }) => {
    const name = item.contact?.name || item.chatId.split('@')[0];
    const phone = item.contact?.phone || item.chatId.split('@')[0];
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('Chat', { chatId: item.chatId, title: name || phone })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(name || phone).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>{name || phone}</Text>
            {item.lastTs ? <Text style={styles.time}>{formatTime(item.lastTs)}</Text> : null}
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage || 'Aucun message'}
            </Text>
            {item.unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.chatId}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(false)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySub}>Les messages envoyés et reçus apparaîtront ici.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  time: { fontSize: 12, color: colors.textMuted, marginLeft: 8 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  preview: { fontSize: 14, color: colors.textMuted, flex: 1, marginRight: 8 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyContainer: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center' }
});
