import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { colors } from '../theme';
import { api, isAuthError } from '../api';

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ route, navigation, onLogout }) {
  const { chatId, title, initialText } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState(initialText || '');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);
  const timer = useRef(null);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await api.getMessages(chatId);
      setMessages(data);
      api.markRead(chatId).catch(() => {});
      if (!silent) setLoading(false);
    } catch (err) {
      if (isAuthError(err)) onLogout();
      if (!silent) setLoading(false);
    }
  }, [chatId, onLogout]);

  useEffect(() => {
    load(false);
    timer.current = setInterval(() => load(true), 4000);
    return () => clearInterval(timer.current);
  }, [load]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      chat_id: chatId,
      body: content,
      direction: 'outgoing',
      from_me: 1,
      type: 'text',
      ts: Math.floor(Date.now() / 1000)
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    try {
      const saved = await api.sendMessage(chatId, content);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
      load(true);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      Alert.alert('Envoi impossible', err.message || 'Erreur réseau');
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => {
    const mine = item.from_me === 1 || item.direction === 'outgoing';
    return (
      <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirRow]}>
        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
          <Text style={styles.bubbleText}>{item.body}</Text>
          <Text style={styles.bubbleTime}>{item.ts ? formatTime(item.ts) : ''}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun message. Écrivez le premier message !</Text>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Écrivez un message"
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={send} disabled={sending || !text.trim()}>
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { padding: 12 },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  mine: { backgroundColor: colors.outgoing },
  theirs: { backgroundColor: colors.incoming },
  bubbleText: { fontSize: 15, color: colors.text },
  bubbleTime: { fontSize: 11, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 3 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    maxHeight: 120,
    fontSize: 15,
    backgroundColor: colors.incoming
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  sendText: { color: '#fff', fontSize: 18 }
});
