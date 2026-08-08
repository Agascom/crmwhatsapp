import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Saisie d'étiquettes sous forme de chips (ajout via le clavier ou le bouton +).
export default function TagInput({ tags = [], onChange }) {
  const [value, setValue] = useState('');

  const add = () => {
    const t = value.trim();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setValue('');
  };

  const remove = (t) => {
    onChange(tags.filter((x) => x !== t));
  };

  return (
    <View>
      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((t) => (
            <TouchableOpacity key={t} style={styles.chip} onPress={() => remove(t)}>
              <Text style={styles.chipText}>{t} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="Ajouter une étiquette"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: {
    backgroundColor: colors.primaryDeep,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.incoming
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addBtnText: { color: '#fff', fontSize: 22, lineHeight: 24 }
});
