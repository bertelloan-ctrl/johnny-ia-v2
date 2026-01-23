// PANTALLA DE PRUEBA CON TWILIO
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';

const SERVER_URL = 'https://johnny-ia-v2.onrender.com';

export default function TestCallScreenTwilio({ route, navigation }) {
  const { clientId, clientName } = route.params;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [calling, setCalling] = useState(false);
  const [callInProgress, setCallInProgress] = useState(false);

  const formatPhoneNumber = (text) => {
    // Remover todo excepto números y +
    const cleaned = text.replace(/[^\d+]/g, '');
    setPhoneNumber(cleaned);
  };

  const initiateCall = async () => {
    // Validar número de teléfono
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Error', 'Ingresa un número de teléfono válido');
      return;
    }

    // Asegurar que tiene formato internacional
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
      // Si no tiene +, asumir que es México (+52)
      formattedNumber = '+52' + formattedNumber;
    }

    setCalling(true);

    try {
      console.log('[TEST] Solicitando llamada de prueba a:', formattedNumber);

      const response = await fetch(`${SERVER_URL}/api/test-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          phoneNumber: formattedNumber
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCallInProgress(true);
        Alert.alert(
          '¡Llamada iniciada!',
          'Twilio te llamará en unos segundos. Contesta tu teléfono para hablar con tu vendedor IA.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Esperar 30 segundos y mostrar opción para finalizar
                setTimeout(() => {
                  if (callInProgress) {
                    Alert.alert(
                      'Llamada en progreso',
                      '¿Ya terminaste de probar tu vendedor?',
                      [
                        { text: 'Aún estoy probando', style: 'cancel' },
                        {
                          text: 'Terminar prueba',
                          onPress: () => {
                            setCallInProgress(false);
                            navigation.goBack();
                          }
                        }
                      ]
                    );
                  }
                }, 30000);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'No se pudo iniciar la llamada');
      }
    } catch (error) {
      console.error('[TEST ERROR]', error);
      Alert.alert('Error', 'Error al conectar con el servidor: ' + error.message);
    } finally {
      setCalling(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📞 Probar Vendedor IA</Text>
        <Text style={styles.subtitle}>{clientName}</Text>
      </View>

      <View style={styles.content}>
        {!callInProgress ? (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
              <Text style={styles.infoText}>
                1. Ingresa tu número de teléfono{'\n'}
                2. Presiona "LLAMARME"{'\n'}
                3. Twilio te marcará en unos segundos{'\n'}
                4. Contesta y habla con tu vendedor IA
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tu número de teléfono</Text>
              <TextInput
                style={styles.input}
                placeholder="+52 1234567890"
                placeholderTextColor="#64748b"
                value={phoneNumber}
                onChangeText={formatPhoneNumber}
                keyboardType="phone-pad"
                maxLength={15}
                autoFocus
              />
              <Text style={styles.hint}>
                Incluye código de país (ej: +52 para México)
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, calling && styles.buttonDisabled]}
              onPress={initiateCall}
              disabled={calling}
            >
              {calling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>📞 LLAMARME</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.callingContainer}>
            <View style={styles.pulseContainer}>
              <View style={styles.pulse} />
              <Text style={styles.callingIcon}>📞</Text>
            </View>

            <Text style={styles.callingTitle}>Llamada en progreso</Text>
            <Text style={styles.callingSubtitle}>
              Twilio te está llamando...{'\n'}
              Contesta tu teléfono para hablar con tu vendedor IA
            </Text>

            <TouchableOpacity
              style={styles.buttonCancel}
              onPress={() => {
                Alert.alert(
                  'Cancelar prueba',
                  '¿Estás seguro de cancelar?',
                  [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Sí, cancelar',
                      onPress: () => {
                        setCallInProgress(false);
                        navigation.goBack();
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.buttonCancelText}>Cancelar prueba</Text>
            </TouchableOpacity>
          </View>
        )}
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
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#334155',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#64748b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  callingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  pulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#10b981',
    opacity: 0.3,
  },
  callingIcon: {
    fontSize: 48,
  },
  callingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  callingSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  buttonCancel: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  buttonCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
