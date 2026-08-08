import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch
} from 'react-native';
import { colors, statusColors } from '../theme';
import { api, isAuthError } from '../api';
import { remindersStore } from '../store/remindersStore';
import { timelineStore } from '../store/timelineStore';
import { invoicesStore, TYPE_LABELS, STATUS_LABELS } from '../store/invoicesStore';
import Badge from '../components/Badge';
import Section from '../components/Section';
import TagInput from '../components/TagInput';
import EmptyState from '../components/EmptyState';

const STATUSES = ['prospect', 'client', 'finalise'];

const INVOICE_STATUS_COLORS = {
  draft: '#78909C',
  sent: '#1E88E5',
  accepted: '#43A047',
  rejected: '#E53935',
  paid: '#43A047',
  overdue: '#E53935',
  cancelled: '#78909C'
};

function fmtMoney(v) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')} €`;
}

const TIMELINE_ICONS = {
  created: '🆕',
  status: '🔄',
  note: '📝',
  tags: '🏷️',
  reminder: '⏰',
  reminder_done: '✅',
  message: '💬'
};

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function dueLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const DUE_OPTIONS = [
  { label: "Aujourd'hui", days: 0 },
  { label: 'Demain', days: 1 },
  { label: 'Semaine', days: 7 }
];

export default function ContactScreen({ route, navigation, onLogout }) {
  const { id, phone: prefilledPhone, name: prefilledName } = route.params || {};
  const isEdit = Boolean(id);

  const [name, setName] = useState(prefilledName || '');
  const [phone, setPhone] = useState(prefilledPhone || '');
  const [status, setStatus] = useState('prospect');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [reminders, setReminders] = useState([]);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDue, setReminderDue] = useState(DUE_OPTIONS[1].days);
  const [timeline, setTimeline] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);

  const loadClientData = async () => {
    try {
      const [c, r, t, inv] = await Promise.all([
        api.getContact(id),
        remindersStore.list(id),
        timelineStore.list(id),
        invoicesStore.listByClient(id)
      ]);
      setName(c.name);
      setPhone(c.phone || '');
      setStatus(c.status || 'prospect');
      setNotes(c.notes || '');
      setTags(c.tags || []);
      setReminders(r);
      setTimeline(t);
      setInvoices(inv);
    } catch (err) {
      if (isAuthError(err)) onLogout();
      else Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEdit) loadClientData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const loadHistory = async (clientPhone) => {
    if (!clientPhone) return;
    setHistoryLoading(true);
    try {
      const chatId = api.phoneToChatId(clientPhone);
      const msgs = await api.getMessages(chatId);
      setHistory(msgs.slice(-20).reverse());
    } catch (err) {
      // L'historique est un bonus : on n'interrompt pas la fiche en cas d'erreur.
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isEdit && phone) loadHistory(phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Nom requis', 'Le nom du client est obligatoire.');
      return;
    }
    try {
      setSaving(true);
      if (isEdit) {
        const updated = await api.updateContact(id, { name: name.trim(), phone, status, notes, tags });
        if (updated && updated.phone !== phone) setPhone(updated.phone);
      } else {
        await api.createContact({ name: name.trim(), phone, status, notes, tags });
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Enregistrement impossible', err.message);
    } finally {
      setSaving(false);
    }
  };

  const addReminder = async () => {
    if (!reminderTitle.trim()) {
      Alert.alert('Titre requis', 'Donnez un titre au rappel.');
      return;
    }
    const dueAt = Date.now() + reminderDue * 24 * 60 * 60 * 1000;
    await remindersStore.add(id, reminderTitle.trim(), dueAt);
    setReminderTitle('');
    setReminders(await remindersStore.list(id));
    setTimeline(await timelineStore.list(id));
  };

  const toggleReminder = async (rem) => {
    await remindersStore.toggle(rem.id, !rem.done);
    setReminders(await remindersStore.list(id));
    setTimeline(await timelineStore.list(id));
  };

  const removeReminder = async (rem) => {
    await remindersStore.remove(rem.id);
    setReminders(await remindersStore.list(id));
  };

  const remove = () => {
    Alert.alert(
      'Supprimer le contact',
      `Confirmer la suppression de « ${name} » ? Les rappels et l'historique seront aussi supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await api.deleteContact(id);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const openChat = () => {
    const chatId = api.phoneToChatId(phone);
    navigation.navigate('Chat', { chatId, title: name });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom du client" />

      <Text style={styles.label}>Téléphone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+33..."
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Statut</Text>
      <View style={styles.statusRow}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusBtn, status === s && { backgroundColor: statusColors[s] }]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.statusBtnText, status === s && { color: '#fff' }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes internes (préférences, historique...)"
        multiline
      />

      <Text style={styles.label}>Étiquettes</Text>
      <TagInput tags={tags} onChange={setTags} />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveText}>{isEdit ? 'Enregistrer' : 'Créer le client'}</Text>
        )}
      </TouchableOpacity>

      {phone.trim() ? (
        <TouchableOpacity style={styles.chatButton} onPress={openChat}>
          <Text style={styles.chatText}>Ouvrir la conversation WhatsApp</Text>
        </TouchableOpacity>
      ) : null}

      {isEdit ? (
        <>
          <Section title="Rappels & relances">
            <Text style={styles.hint}>
              Les rappels restent internes : aucun envoi automatique, vous relancez vous-même depuis la conversation.
            </Text>
            <View style={styles.reminderForm}>
              <TextInput
                style={[styles.input, styles.reminderInput]}
                value={reminderTitle}
                onChangeText={setReminderTitle}
                placeholder="Titre du rappel (ex. relance devis)"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.dueRow}>
                {DUE_OPTIONS.map((o) => (
                  <TouchableOpacity
                    key={o.label}
                    style={[styles.dueBtn, reminderDue === o.days && styles.dueBtnActive]}
                    onPress={() => setReminderDue(o.days)}
                  >
                    <Text style={[styles.dueText, reminderDue === o.days && styles.dueTextActive]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.addReminderBtn} onPress={addReminder}>
                <Text style={styles.addReminderText}>+ Ajouter le rappel</Text>
              </TouchableOpacity>
            </View>

            {reminders.length === 0 ? (
              <EmptyState text="Aucun rappel planifié pour ce client." />
            ) : (
              reminders.map((r) => (
                <View key={r.id} style={styles.reminderRow}>
                  <Switch
                    value={Boolean(r.done)}
                    onValueChange={() => toggleReminder(r)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor="#fff"
                  />
                  <View style={styles.reminderBody}>
                    <Text
                      style={[styles.reminderTitle, r.done && styles.reminderDone]}
                      numberOfLines={1}
                    >
                      {r.title}
                    </Text>
                    <Text style={styles.reminderDue}>{dueLabel(r.due_at)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeReminder(r)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Section>

          <Section title="Devis & factures">
            <View style={styles.invoiceHeader}>
              <Text style={styles.invoiceCount}>
                {invoices.length} document{invoices.length > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                style={styles.newInvoiceBtn}
                onPress={() =>
                  navigation.navigate('InvoiceForm', {
                    clientId: id,
                    clientName: name || 'Client'
                  })
                }
              >
                <Text style={styles.newInvoiceText}>+ Nouveau</Text>
              </TouchableOpacity>
            </View>
            {invoices.length === 0 ? (
              <EmptyState text="Aucun devis ni facture pour ce client." />
            ) : (
              invoices.map((inv) => (
                <TouchableOpacity
                  key={inv.id}
                  style={styles.invoiceRow}
                  onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: inv.id })}
                >
                  <View style={styles.invoiceBody}>
                    <Text style={styles.invoiceTitle} numberOfLines={1}>
                      {TYPE_LABELS[inv.type]} {inv.number}
                    </Text>
                    <Text style={styles.invoiceMeta}>
                      {new Date(inv.issue_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · {fmtMoney(inv.total_ttc)}
                    </Text>
                  </View>
                  <Badge label={STATUS_LABELS[inv.status]} color={INVOICE_STATUS_COLORS[inv.status]} />
                </TouchableOpacity>
              ))
            )}
          </Section>

          <Section title="Activité">
            {timeline.length === 0 ? (
              <EmptyState text="Aucune activité enregistrée pour l'instant." />
            ) : (
              timeline.map((e) => (
                <View key={e.id} style={styles.timelineRow}>
                  <Text style={styles.timelineIcon}>{TIMELINE_ICONS[e.type] || '•'}</Text>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineTitle}>{e.title}</Text>
                    {e.detail ? <Text style={styles.timelineDetail} numberOfLines={1}>{e.detail}</Text> : null}
                    <Text style={styles.timelineDate}>{formatDate(e.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </Section>

          <Section title="Conversation WhatsApp">
            {!phone ? (
              <EmptyState text="Ajoutez un numéro pour afficher l'historique." />
            ) : historyLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} />
            ) : history.length === 0 ? (
              <EmptyState text="Aucun message trouvé avec ce numéro." />
            ) : (
              history.map((m) => (
                <View key={m.id} style={styles.historyRow}>
                  <Text style={styles.historyIcon}>{m.from_me ? '➡️' : '⬅️'}</Text>
                  <View style={styles.historyBody}>
                    <Text style={styles.historyText} numberOfLines={2}>{m.body}</Text>
                    <Text style={styles.historyDate}>
                      {m.from_me ? 'Vous' : 'Client'} · {formatDate(m.ts * 1000)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Section>

          <TouchableOpacity style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>Supprimer le client</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.incoming
  },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  statusBtnText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  saveButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chatButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center'
  },
  chatText: { color: colors.primaryDeep, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 17 },
  reminderForm: { gap: 8, marginBottom: 8 },
  reminderInput: {},
  dueRow: { flexDirection: 'row', gap: 8 },
  dueBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  dueBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  dueText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  dueTextActive: { color: '#fff' },
  addReminderBtn: {
    backgroundColor: colors.primaryDeep,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center'
  },
  addReminderText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    gap: 10
  },
  reminderBody: { flex: 1 },
  reminderTitle: { fontSize: 15, color: colors.text, fontWeight: '600' },
  reminderDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  reminderDue: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  removeText: { color: colors.danger, fontSize: 16, padding: 4 },
  timelineRow: { flexDirection: 'row', paddingVertical: 7, gap: 10 },
  timelineIcon: { fontSize: 16, width: 22 },
  timelineBody: { flex: 1 },
  timelineTitle: { fontSize: 14, color: colors.text, fontWeight: '600' },
  timelineDetail: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  timelineDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  historyRow: { flexDirection: 'row', paddingVertical: 7, gap: 10 },
  historyIcon: { fontSize: 16, width: 22 },
  historyBody: { flex: 1 },
  historyText: { fontSize: 14, color: colors.text },
  historyDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  invoiceCount: { color: colors.textMuted, fontSize: 12 },
  newInvoiceBtn: {
    borderWidth: 1,
    borderColor: colors.primaryDeep,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  newInvoiceText: { color: colors.primaryDeep, fontSize: 13, fontWeight: '700' },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 9,
    gap: 10
  },
  invoiceBody: { flex: 1 },
  invoiceTitle: { fontSize: 15, color: colors.text, fontWeight: '600' },
  invoiceMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  deleteButton: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' }
});
