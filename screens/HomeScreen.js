import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

export default function HomeScreen({ navigation }) {
  const assistants = [
    {
      id: 'vendedor',
      name: 'Vendedor IA',
      emoji: '💼',
      description: 'Asistente de ventas automáticas',
      active: true,
      color: '#10b981',
      screen: 'Vendedor'
    },
    {
      id: 'chatbot',
      name: 'ChatBot IA',
      emoji: '💬',
      description: 'Atención al cliente 24/7',
      active: false,
      color: '#8b5cf6'
    },
    {
      id: 'marketing',
      name: 'Marketing IA',
      emoji: '📱',
      description: 'Gestión de redes sociales',
      active: false,
      color: '#f59e0b'
    },
    {
      id: 'compras',
      name: 'Compras IA',
      emoji: '🛒',
      description: 'Optimización de compras',
      active: false,
      color: '#3b82f6'
    },
    {
      id: 'logistica',
      name: 'Logística IA',
      emoji: '📦',
      description: 'Gestión de inventarios',
      active: false,
      color: '#ec4899'
    }
  ];

  const handlePress = (assistant) => {
    if (assistant.active && assistant.screen) {
      navigation.navigate(assistant.screen);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Bienvenido a Johnny IA</Text>
          <Text style={styles.subtitle}>Selecciona un asistente para comenzar</Text>
        </View>

        <View style={styles.grid}>
          {assistants.map((assistant) => (
            <TouchableOpacity
              key={assistant.id}
              style={[
                styles.card,
                { borderColor: assistant.color },
                !assistant.active && styles.cardDisabled
              ]}
              disabled={!assistant.active}
              onPress={() => handlePress(assistant)}
            >
              <Text style={styles.emoji}>{assistant.emoji}</Text>
              <Text style={styles.assistantName}>{assistant.name}</Text>
              <Text style={styles.description}>{assistant.description}</Text>

              {assistant.active ? (
                <View style={[styles.badge, { backgroundColor: assistant.color }]}>
                  <Text style={styles.badgeText}>Activo</Text>
                </View>
              ) : (
                <View style={styles.badgeComingSoon}>
                  <Text style={styles.badgeTextComingSoon}>Próximamente</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  assistantName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeComingSoon: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  badgeTextComingSoon: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
});
