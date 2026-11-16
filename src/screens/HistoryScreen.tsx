
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Running History
      </Text>

      <Text style={styles.subtitle}>
        Your running journey, one kilometre at a time.
      </Text>

      <View style={styles.emptyCard}>
        <Text style={styles.icon}>🏃</Text>

        <Text style={styles.emptyTitle}>
          Your runs will appear here
        </Text>

        <Text style={styles.emptyDescription}>
          Every completed running session
          will be saved in your history.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
    padding: 22,
    paddingTop: 55,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 25,
    marginTop: 35,
    alignItems: 'center',
  },
  icon: {
    fontSize: 45,
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyDescription: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
});
