import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';

export default function ClientConfigScreen({ navigation }) {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [agentName, setAgentName] = useState('');
  const [products, setProducts] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!companyName || !industry || !agentName) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);

    const clientData = {
      client_id: companyName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
      company_name: companyName,
      industry: industry,
      agent_name: agentName,
      products: products.split(',').map(p => p.trim()).filter(p => p),
      created_at: new Date().toISOString()
    };

    try {
      const response = await fetch('http://192.168.3.27:3000/api/save-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          'Cliente guardado',
          'El cliente se guardó correctamente',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'No se pudo guardar el cliente');
      }
    } catch (error) {
      console.error('Error guardando cliente:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nuevo Cliente</Text>
        <Text style={styles.subtitle}>Configura tu vendedor IA</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de la Empresa *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Distribuidora ABC"
            value={companyName}
            onChangeText={setCompanyName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Industria *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Alimentos y Bebidas"
            value={industry}
            onChangeText={setIndustry}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre del Agente IA *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: María"
            value={agentName}
            onChangeText={setAgentName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Productos (separados por comas)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: Refrescos, Jugos, Agua"
            value={products}
            onChangeText={setProducts}
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Guardando...' : 'Guardar Cliente'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonCancel}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.buttonCancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonCancel: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonCancelText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
});
