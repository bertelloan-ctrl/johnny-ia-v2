import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';

export default function DashboardScreen({ route }) {
  const { clientId } = route.params;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`http://192.168.3.27:3000/api/stats?client_id=${clientId}`);
      const data = await response.json();

      if (data.success) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
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
        <Text style={styles.title}>📊 Dashboard</Text>
        <Text style={styles.subtitle}>Estadísticas del cliente</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderColor: '#10b981' }]}>
          <Text style={styles.statNumber}>{stats?.totalLeads || 0}</Text>
          <Text style={styles.statLabel}>Total Leads</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#3b82f6' }]}>
          <Text style={styles.statNumber}>{stats?.newLeads || 0}</Text>
          <Text style={styles.statLabel}>Nuevos</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#f59e0b' }]}>
          <Text style={styles.statNumber}>{stats?.withPhone || 0}</Text>
          <Text style={styles.statLabel}>Con Teléfono</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#ec4899' }]}>
          <Text style={styles.statNumber}>{stats?.withEmail || 0}</Text>
          <Text style={styles.statLabel}>Con Email</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#8b5cf6' }]}>
          <Text style={styles.statNumber}>{stats?.called || 0}</Text>
          <Text style={styles.statLabel}>Contactados</Text>
        </View>

        <View style={[styles.statCard, { borderColor: '#64748b' }]}>
          <Text style={styles.statNumber}>
            {stats?.totalLeads > 0
              ? Math.round((stats.called / stats.totalLeads) * 100)
              : 0}%
          </Text>
          <Text style={styles.statLabel}>Tasa de Contacto</Text>
        </View>
      </View>
    </ScrollView>
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
  statsGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
  },
});
