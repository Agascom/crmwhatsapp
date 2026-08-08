import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function Badge({ label, color }) {
  const bg = color || '#ECE5DD';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }
});
