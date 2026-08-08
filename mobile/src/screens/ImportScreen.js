import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { colors } from '../theme';
import { clientsStore } from '../store/clientsStore';
import { opportunitiesStore } from '../store/opportunitiesStore';

function normalize(input) {
  return String(input || '').replace(/[^0-9]/g, '').replace(/^0+/, '');
}

export default function ImportScreen({ navigation }) {
  const [mode, setMode] = useState('device');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [paste, setPaste] = useState('');
  const [importing, setImporting] = useState(false);

  const loadDeviceContacts = async () => {
    const perm = await Contacts.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorisez l’accès aux contacts pour les importer.');
      return;
    }
    setLoading(true);
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.PhoneNumbers]
    });
    const mapped = data
      .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
      .map((c) => {
        const p = c.phoneNumbers.find((x) => x.number) || c.phoneNumbers[0];
        const phone = normalize(p.number);
        return {
          key: `${c.id}`,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
          phone
        };
      })
      .filter((c) => c.name && c.phone)
      .sort((a, b) => a.name.localeCompare(b.name));
    setContacts(mapped);
    setLoading(false);
  };

  const visible = contacts.filter(
    (c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const importSelected = async () => {
    const chosen = contacts.filter((c) => selected.has(c.key));
    if (chosen.length === 0) {
      Alert.alert('Sélection vide', 'Cochez au moins un contact.');
      return;
    }
    await runImport(chosen.map((c) => ({ name: c.name, phone: c.phone })));
  };

  const parsePaste = async () => {
    const lines = paste.split('\n').map((l) => l.trim()).filter(Boolean);
    const entries = [];
    for (const line of lines) {
      const parts = line.split(/[;,]/).map((s) => s.trim());
      if (parts.length >= 2) {
        entries.push({ name: parts[0], phone: normalize(parts[1]) });
      }
    }
    if (entries.length === 0) {
      Alert.alert('Format attendu', 'Une entrée par ligne : Nom;+33612345678');
      return;
    }
    await runImport(entries);
  };

  const runImport = async (entries) => {
    setImporting(true);
    let created = 0;
    let skipped = 0;
    try {
      for (const e of entries) {
        const existing = await clientsStore.getByPhone(e.phone);
        if (existing || !e.phone) {
          skipped += 1;
          continue;
        }
        const client = await clientsStore.create({
          name: e.name,
          phone: e.phone,
          status: 'prospect',
          source: 'import'
        });
        await opportunitiesStore.ensureForClient(client.id);
        created += 1;
      }
      Alert.alert('Import terminé', `${created} contact(s) importé(s)${skipped ? `, ${skipped} ignoré(s)` : ''}.`);
      setSelected(new Set());
      setPaste('');
    } catch (err) {
      Alert.alert('Import impossible', err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'device' && styles.modeBtnActive]}
          onPress={() => setMode('device')}
        >
          <Text style={[styles.modeText, mode === 'device' && styles.modeTextActive]}>Téléphone</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'paste' && styles.modeBtnActive]}
          onPress={() => setMode('paste')}
        >
          <Text style={[styles.modeText, mode === 'paste' && styles.modeTextActive]}>Coller</Text>
        </TouchableOpacity>
      </View>

      {mode === 'device' ? (
        <>
          {contacts.length === 0 && !loading ? (
            <View style={styles.centered}>
              <TouchableOpacity style={styles.loadBtn} onPress={loadDeviceContacts}>
                <Text style={styles.loadText}>Charger mes contacts</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher..."
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <FlatList
                data={visible}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => {
                  const checked = selected.has(item.key);
                  return (
                    <TouchableOpacity style={styles.row} onPress={() => toggle(item.key)}>
                      <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                        {checked ? <Text style={styles.checkText}>✓</Text> : null}
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.rowPhone}>{item.phone ? `+${item.phone}` : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.empty}>{loading ? 'Chargement...' : 'Aucun contact trouvé.'}</Text>
                }
              />
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {selected.size} sélectionné{selected.size > 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={importSelected}
                  disabled={importing || selected.size === 0}
                >
                  {importing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.importText}>Importer ({selected.size})</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <Text style={styles.pasteHint}>
            Une entrée par ligne : Nom;+33612345678 (ou Nom,+33612345678). Les doublons sont ignorés.
          </Text>
          <TextInput
            style={[styles.input, styles.pasteInput]}
            value={paste}
            onChangeText={setPaste}
            placeholder={'Jean Dupont;+33612345678\nMarie Martin;+33798765432'}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity style={styles.importBtn} onPress={parsePaste} disabled={importing}>
            {importing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.importText}>Importer</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  modeRow: { flexDirection: 'row', gap: 8, padding: 12 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.incoming
  },
  modeBtnActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  modeTextActive: { color: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadBtn: {
    backgroundColor: colors.primaryDeep,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 30
  },
  loadText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchBar: { paddingHorizontal: 12, paddingBottom: 8 },
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
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, color: colors.text, fontWeight: '600' },
  rowPhone: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40, padding: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  footerText: { fontSize: 13, color: colors.textMuted },
  importBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 8
  },
  importText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pasteHint: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 12, lineHeight: 17 },
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
  pasteInput: { minHeight: 140, marginHorizontal: 12, marginTop: 10 }
});
