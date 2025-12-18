import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';

export default function LeadsScreen({ route }) {
  const { clientId } = route.params;
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch(`https://johnny-ia-v2.onrender.com/api/leads?client_id=${clientId}`);
      const data = await response.json();

      if (data.success) {
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error obteniendo leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeads();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        return '#10b981';
      case 'calling':
        return '#f59e0b';
      case 'contacted':
        return '#3b82f6';
      case 'failed':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'new':
        return 'Nuevo';
      case 'calling':
        return 'Llamando';
      case 'contacted':
        return 'Contactado';
      case 'failed':
        return 'Fallido';
      default:
        return status;
    }
  };

  const renderLead = ({ item }) => (
    <TouchableOpacity style={styles.leadCard}>
      <View style={styles.leadHeader}>
        <Text style={styles.leadName}>{item.name || 'Sin nombre'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      {item.phone && (
        <Text style={styles.leadInfo}>📞 {item.phone}</Text>
      )}

      {item.email && (
        <Text style={styles.leadInfo}>📧 {item.email}</Text>
      )}

      {item.company && (
        <Text style={styles.leadInfo}>🏢 {item.company}</Text>
      )}

      <Text style={styles.leadDate}>
        {new Date(item.created_at).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📋 Leads</Text>
        <Text style={styles.subtitle}>{leads.length} leads en total</Text>
      </View>

      {leads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No hay leads aún</Text>
          <Text style={styles.emptySubtext}>
            Los leads aparecerán aquí cuando se generen
          </Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          renderItem={renderLead}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leadName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  leadInfo: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6,
  },
  leadDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
