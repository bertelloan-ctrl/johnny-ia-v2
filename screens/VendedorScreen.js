import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';

export default function VendedorScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchClients();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchClients = async () => {
    try {
      const response = await fetch('https://johnny-ia-v2.onrender.com/api/get-clients');
      const data = await response.json();

      if (data.success) {
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  };

  const handleClientPress = (client) => {
    Alert.alert(
      client.company_name,
      '¿Qué deseas hacer?',
      [
        {
          text: '🧪 Probar Vendedor',
          onPress: () => navigation.navigate('TestVendor', {
            clientId: client.client_id,
            clientName: client.company_name
          })
        },
        {
          text: '📋 Ver Leads',
          onPress: () => navigation.navigate('Leads', { clientId: client.client_id })
        },
        {
          text: '📊 Dashboard',
          onPress: () => navigation.navigate('Dashboard', { clientId: client.client_id })
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>⏳ Cargando clientes...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>💼 Vendedor IA</Text>
        <Text style={styles.subtitle}>Gestiona tus clientes y campañas</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={styles.newClientCard}
          onPress={() => navigation.navigate('ClientConfig')}
        >
          <Text style={styles.newClientEmoji}>➕</Text>
          <Text style={styles.newClientTitle}>Nuevo Cliente</Text>
          <Text style={styles.newClientDesc}>Configura un nuevo vendedor IA</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Clientes Activos ({clients.length})
          </Text>

          {clients.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No hay clientes aún</Text>
              <Text style={styles.emptySubtext}>
                Crea tu primer cliente para empezar
              </Text>
            </View>
          ) : (
            clients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.clientCard}
                onPress={() => handleClientPress(client)}
              >
                <View style={styles.clientHeader}>
                  <Text style={styles.clientName}>{client.company_name}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Activo</Text>
                  </View>
                </View>

                <Text style={styles.clientIndustry}>
                  🏢 {client.industry || 'Sin industria'}
                </Text>

                {client.products && client.products.length > 0 && (
                  <Text style={styles.clientProducts}>
                    📦 {client.products.slice(0, 2).join(', ')}
                    {client.products.length > 2 && '...'}
                  </Text>
                )}

                {client.location && client.location.city && (
                  <Text style={styles.clientLocation}>
                    📍 {client.location.city}, {client.location.state}
                  </Text>
                )}

                <View style={styles.clientActions}>
                  <Text style={styles.clientActionHint}>
                    Toca para ver opciones →
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { fontSize: 16, color: '#64748b' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748b' },
  content: { padding: 16 },
  newClientCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 24, borderWidth: 2, borderColor: '#10b981', borderStyle: 'dashed', alignItems: 'center' },
  newClientEmoji: { fontSize: 48, marginBottom: 12 },
  newClientTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  newClientDesc: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },
  emptyState: { backgroundColor: '#fff', borderRadius: 12, padding: 40, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
  clientCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  clientName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1 },
  clientIndustry: { fontSize: 14, color: '#64748b', marginBottom: 6 },
  clientProducts: { fontSize: 14, color: '#64748b', marginBottom: 6 },
  clientLocation: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  clientActions: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, marginTop: 4 },
  clientActionHint: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
  badge: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' }
});
