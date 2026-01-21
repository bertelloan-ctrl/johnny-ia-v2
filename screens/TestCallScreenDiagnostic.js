// DIAGNOSTIC VERSION - MINIMAL CODE TO TEST LOGGING
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import io from 'socket.io-client';

export default function TestCallScreenDiagnostic({ route, navigation }) {
  const { clientId, clientName } = route.params;
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  const addMessage = (msg) => {
    setMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const testConnection = () => {
    addMessage('🔵 INICIANDO TEST DE CONEXIÓN...');

    try {
      const newSocket = io('https://johnny-ia-v2.onrender.com', {
        transports: ['websocket', 'polling'],
        timeout: 10000,
      });

      newSocket.on('connect', () => {
        addMessage('✅ CONECTADO - Socket ID: ' + newSocket.id);
        setConnected(true);

        // Enviar log de prueba #1
        newSocket.emit('client-log', {
          level: 'log',
          message: '🎯 TEST LOG #1 - Cliente conectado exitosamente',
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
        });
        addMessage('📤 LOG #1 ENVIADO');

        // Enviar log de prueba #2
        setTimeout(() => {
          newSocket.emit('client-log', {
            level: 'log',
            message: '🎯 TEST LOG #2 - Segundo log de prueba',
            data: { clientId, clientName, test: 'data' },
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
          });
          addMessage('📤 LOG #2 ENVIADO');
        }, 1000);

        // Enviar log de prueba #3
        setTimeout(() => {
          newSocket.emit('client-log', {
            level: 'log',
            message: '🎯 TEST LOG #3 - Tercer log de prueba',
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
          });
          addMessage('📤 LOG #3 ENVIADO');
        }, 2000);

        // Probar start-test-session
        setTimeout(() => {
          addMessage('📤 ENVIANDO start-test-session...');
          newSocket.emit('client-log', {
            level: 'log',
            message: '🎯 TEST LOG #4 - Antes de start-test-session',
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
          });

          newSocket.emit('start-test-session', { clientId });
          addMessage('✅ start-test-session ENVIADO');
        }, 3000);
      });

      newSocket.on('session-started', (data) => {
        addMessage('✅ SESSION-STARTED RECIBIDO: ' + data?.sessionId);
        newSocket.emit('client-log', {
          level: 'log',
          message: '🎯 TEST LOG #5 - session-started recibido: ' + data?.sessionId,
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
        });
      });

      newSocket.on('agent-audio', (data) => {
        addMessage('🎵 AUDIO RECIBIDO - Tamaño: ' + (data?.audioBase64?.length || 0));
        newSocket.emit('client-log', {
          level: 'log',
          message: '🎯 TEST LOG #6 - Audio recibido, tamaño: ' + (data?.audioBase64?.length || 0),
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
        });
      });

      newSocket.on('agent-message', (data) => {
        addMessage('💬 MENSAJE: ' + data.text);
      });

      newSocket.on('connect_error', (error) => {
        addMessage('❌ ERROR DE CONEXIÓN: ' + error.message);
      });

      newSocket.on('disconnect', (reason) => {
        addMessage('⚠️ DESCONECTADO - Razón: ' + reason);
        setConnected(false);
      });

      setSocket(newSocket);
      addMessage('🔧 Socket creado, esperando conexión...');

    } catch (error) {
      addMessage('❌ ERROR AL CREAR SOCKET: ' + error.message);
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
      addMessage('🔴 Desconectado manualmente');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔬 TEST DIAGNÓSTICO</Text>
        <Text style={styles.subtitle}>{clientName}</Text>
        <View style={[styles.statusBadge, connected && styles.statusBadgeConnected]}>
          <Text style={styles.statusText}>
            {connected ? '🟢 CONECTADO' : '🔴 DESCONECTADO'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.messagesContainer}>
        <Text style={styles.instructions}>
          Este es un test minimalista para diagnosticar el problema.{'\n\n'}
          1. Presiona "INICIAR TEST"{'\n'}
          2. Observa los mensajes aquí{'\n'}
          3. Revisa los logs de Render{'\n\n'}
          Deberías ver logs con "[CLIENT android]" en Render.
        </Text>

        {messages.map((msg, index) => (
          <Text key={index} style={styles.message}>{msg}</Text>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        {!socket ? (
          <TouchableOpacity style={styles.buttonStart} onPress={testConnection}>
            <Text style={styles.buttonText}>INICIAR TEST</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.buttonStop} onPress={disconnect}>
            <Text style={styles.buttonText}>DESCONECTAR</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.buttonBack}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>VOLVER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1e',
  },
  header: {
    backgroundColor: '#16213e',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgeConnected: {
    backgroundColor: '#10b981',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  instructions: {
    color: '#fbbf24',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
  },
  message: {
    color: '#e2e8f0',
    fontSize: 13,
    marginBottom: 8,
    fontFamily: 'monospace',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 4,
  },
  controls: {
    padding: 16,
    backgroundColor: '#16213e',
    gap: 12,
  },
  buttonStart: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  buttonStop: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  buttonBack: {
    backgroundColor: '#64748b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
