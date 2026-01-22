// VERSION HTTP POLLING - Sin Socket.IO
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const SERVER_URL = 'https://johnny-ia-v2.onrender.com';

export default function TestCallScreen({ route, navigation }) {
  const { clientId, clientName } = route.params;

  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const scrollViewRef = useRef();
  const recordingRef = useRef(null);
  const durationInterval = useRef(null);
  const audioInterval = useRef(null);
  const pollingInterval = useRef(null);

  useEffect(() => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[APP] 🚀 COMPONENTE TESTCALLSCREEN MONTADO (HTTP POLLING)');
    console.log('[APP] 📋 Parámetros:', { clientId, clientName });
    console.log('[APP] 📁 FileSystem.cacheDirectory:', FileSystem.cacheDirectory);
    console.log('═══════════════════════════════════════════════════════════');

    requestPermissions();

    return () => {
      console.log('[APP] 🔄 Limpiando recursos...');
      try {
        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(err =>
            console.error('[APP] Error deteniendo grabación:', err)
          );
        }
        if (durationInterval.current) clearInterval(durationInterval.current);
        if (audioInterval.current) clearInterval(audioInterval.current);
        if (pollingInterval.current) clearInterval(pollingInterval.current);
      } catch (cleanupError) {
        console.error('[APP] Error durante cleanup:', cleanupError);
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      console.log('[APP] 🎤 Solicitando permisos de audio...');
      const { status } = await Audio.requestPermissionsAsync();
      console.log('[APP] 📋 Estado de permisos:', status);

      if (status === 'granted') {
        setPermissionGranted(true);
        console.log('[APP] ✅ Permisos de audio otorgados');

        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          console.log('[APP] ✅ Modo de audio configurado');
        } catch (modeError) {
          console.error('[APP ERROR] Error configurando modo de audio:', modeError);
        }
      } else {
        console.error('[APP ERROR] ❌ Permisos de audio denegados');
        Alert.alert('Permiso necesario', 'Necesitamos acceso al microfono');
      }
    } catch (error) {
      console.error('[APP ERROR] ❌ Error solicitando permisos:', error);
      Alert.alert('Error', 'Error al solicitar permisos: ' + error.message);
    }
  };

  const startCall = async () => {
    console.log('[APP] 📞 startCall() llamado');

    if (!permissionGranted) {
      console.error('[APP ERROR] ❌ No hay permisos de audio');
      Alert.alert('Sin permisos', 'Activa el permiso del microfono');
      return;
    }

    console.log('[APP] 🚀 Iniciando proceso de llamada via HTTP...');
    addMessage('system', 'Iniciando llamada...');

    try {
      // Iniciar sesión en el servidor
      console.log('[APP] 📤 POST /api/start-test-session');
      const response = await fetch(`${SERVER_URL}/api/start-test-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json();

      if (!data.success || !data.sessionId) {
        throw new Error('No se pudo iniciar sesión');
      }

      console.log('[APP] ✅ Sesión iniciada:', data.sessionId);
      setSessionId(data.sessionId);
      setCallActive(true);
      addMessage('system', '✅ Sesión iniciada: ' + data.sessionId);

      // Iniciar contador de duración
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      // Iniciar polling de mensajes
      startPolling(data.sessionId);

      // Iniciar grabación continua
      console.log('[APP] 🎤 Iniciando grabación continua...');
      try {
        await startContinuousRecording(data.sessionId);
        console.log('[APP] ✅ Grabación iniciada exitosamente');
        addMessage('system', '🎤 Grabación iniciada');
      } catch (error) {
        console.error('[APP ERROR] ❌ Error al iniciar grabación:', error);
        addMessage('system', 'Error al iniciar grabación: ' + error.message);
      }

    } catch (error) {
      console.error('[APP ERROR] Error iniciando llamada:', error);
      addMessage('system', 'Error al conectar: ' + error.message);
    }
  };

  const startPolling = (sessId) => {
    console.log('[APP] 🔄 Iniciando polling cada 500ms...');

    pollingInterval.current = setInterval(async () => {
      try {
        const response = await fetch(`${SERVER_URL}/api/poll-messages/${sessId}`);
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          console.log('[APP] 📥 Recibidos', data.messages.length, 'mensajes');

          for (const message of data.messages) {
            await handleMessage(message);
          }
        }
      } catch (error) {
        console.error('[APP ERROR] Error en polling:', error);
      }
    }, 500);
  };

  const handleMessage = async (message) => {
    console.log('[APP] 📨 Procesando mensaje tipo:', message.type);

    try {
      if (message.type === 'session-started') {
        console.log('[APP] ✅ session-started recibido');
        // Ya manejado en startCall
      }

      else if (message.type === 'agent-audio') {
        console.log('[APP] 🎵 Audio recibido, tamaño:', message.audioBase64?.length || 0);
        await playAudio(message.audioBase64);
      }

      else if (message.type === 'agent-message') {
        console.log('[APP] 💬 Mensaje del vendedor:', message.text);
        addMessage('agent', message.text);
      }

      else if (message.type === 'user-message') {
        console.log('[APP] 🗣️ Tu mensaje:', message.text);
        addMessage('user', message.text);
      }

      else if (message.type === 'error') {
        console.error('[APP] ❌ Error del servidor:', message.message);
        addMessage('system', 'Error: ' + message.message);
      }
    } catch (error) {
      console.error('[APP ERROR] Error procesando mensaje:', error);
    }
  };

  const playAudio = async (audioBase64) => {
    if (!audioBase64 || audioBase64.length === 0) {
      console.error('[APP ERROR] Audio inválido');
      return;
    }

    try {
      // Pausar grabación
      const wasRecording = !!recordingRef.current;
      if (wasRecording) {
        await recordingRef.current.pauseAsync();
        console.log('[APP] ⏸️ Grabación pausada');
      }

      // Guardar audio en archivo temporal
      const fileUri = FileSystem.cacheDirectory + `agent_audio_${Date.now()}.wav`;
      console.log('[APP] 💾 Guardando audio en:', fileUri);

      await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[APP] ✅ Audio guardado');

      // Crear y reproducir sonido
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true, volume: 1.0 }
      );

      console.log('[APP] ▶️ Reproduciendo audio...');
      addMessage('system', '🔊 Reproduciendo respuesta del vendedor');

      // Esperar a que termine
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          console.log('[APP] ✅ Audio terminado');
          await sound.unloadAsync();
          await FileSystem.deleteAsync(fileUri, { idempotent: true });

          // Resumir grabación
          if (wasRecording && recordingRef.current) {
            await recordingRef.current.startAsync();
            console.log('[APP] ▶️ Grabación resumida');
          }
        }
      });

    } catch (error) {
      console.error('[APP ERROR] Error reproduciendo audio:', error);
      addMessage('system', 'Error reproduciendo audio: ' + error.message);
    }
  };

  const startContinuousRecording = async (sessId) => {
    try {
      console.log('[APP] 🎤 Creando grabación...');
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 24000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      recordingRef.current = newRecording;
      setRecording(newRecording);
      console.log('[APP] ✅ Grabación iniciada');

      // Enviar audio cada 3 segundos
      sendAudioChunks(sessId);

    } catch (error) {
      console.error('[APP ERROR] Error iniciando grabación:', error);
      throw error;
    }
  };

  const sendAudioChunks = (sessId) => {
    if (audioInterval.current) {
      clearInterval(audioInterval.current);
    }

    console.log('[APP] 🔄 Iniciando envío de audio cada 3 segundos...');

    audioInterval.current = setInterval(async () => {
      if (!recordingRef.current || isMuted || !callActive) {
        return;
      }

      try {
        console.log('[APP] 📤 Enviando chunk de audio...');
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();

        if (uri) {
          const audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('[APP] 📡 POST /api/send-audio, tamaño:', audioBase64.length);

          // Enviar audio al servidor via HTTP
          await fetch(`${SERVER_URL}/api/send-audio`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sessId,
              audioBase64: audioBase64
            }),
          });

          console.log('[APP] ✅ Audio enviado');
        }

        // Crear nueva grabación
        if (callActive && !isMuted) {
          const { recording: newRecording } = await Audio.Recording.createAsync({
            android: {
              extension: '.wav',
              outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
              audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
              sampleRate: 24000,
              numberOfChannels: 1,
              bitRate: 128000,
            },
            ios: {
              extension: '.wav',
              audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
              sampleRate: 24000,
              numberOfChannels: 1,
              bitRate: 128000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
          });
          recordingRef.current = newRecording;
        }

      } catch (error) {
        console.error('[APP ERROR] Error enviando audio:', error);
      }
    }, 3000);
  };

  const toggleMute = async () => {
    setIsMuted(!isMuted);

    if (!isMuted) {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
        setRecording(null);
      }
    }
  };

  const endCall = async () => {
    setCallActive(false);

    if (durationInterval.current) clearInterval(durationInterval.current);
    if (audioInterval.current) clearInterval(audioInterval.current);
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }

    addMessage('system', 'Llamada finalizada - Duracion: ' + formatDuration(callDuration));
  };

  const addMessage = (speaker, text) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      speaker,
      text,
      timestamp: new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };

    setTranscript(prev => [...prev, newMessage]);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  };

  const handleEndCall = () => {
    Alert.alert(
      'Finalizar llamada',
      'Quieres guardar la transcripcion de esta llamada?',
      [
        {
          text: 'No guardar',
          style: 'cancel',
          onPress: () => {
            endCall();
            navigation.goBack();
          }
        },
        { text: 'Guardar y salir', onPress: saveAndExit }
      ]
    );
  };

  const saveAndExit = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/save-test-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sessionId: sessionId || 'test_' + Date.now(),
          messages: transcript
        })
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Guardado', 'Transcripcion guardada correctamente');
      }
    } catch (error) {
      console.error('Error guardando:', error);
    } finally {
      await endCall();
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Llamada de Prueba (HTTP)</Text>
        <Text style={styles.subtitle}>{clientName}</Text>
        {callActive && (
          <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.transcriptContainer}
        contentContainerStyle={styles.transcriptContent}
      >
        {transcript.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Presiona Iniciar Llamada</Text>
            <Text style={styles.emptySubtext}>Tendras una conversacion en tiempo real con tu vendedor IA</Text>
          </View>
        ) : (
          transcript.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.message,
                msg.speaker === 'user' && styles.messageUser,
                msg.speaker === 'agent' && styles.messageAgent,
                msg.speaker === 'system' && styles.messageSystem
              ]}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.messageSpeaker}>
                  {msg.speaker === 'user' ? 'Tu' :
                   msg.speaker === 'agent' ? 'Vendedor IA' :
                   'Sistema'}
                </Text>
                <Text style={styles.messageTime}>{msg.timestamp}</Text>
              </View>
              <Text style={styles.messageText}>{msg.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.controls}>
        {!callActive ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonCall]}
            onPress={startCall}
          >
            <Text style={styles.buttonText}>INICIAR LLAMADA</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.callControls}>
            <TouchableOpacity
              style={[styles.iconButton, isMuted && styles.iconButtonActive]}
              onPress={toggleMute}
            >
              <Text style={styles.iconButtonLabel}>{isMuted ? 'MUTEAR' : 'MIC'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonHangup]}
              onPress={handleEndCall}
            >
              <Text style={styles.buttonText}>COLGAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {callActive && (
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, !isMuted && styles.statusDotActive]} />
          <Text style={styles.statusText}>
            {isMuted ? 'Microfono silenciado' : 'En llamada'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { backgroundColor: '#16213e', padding: 20, paddingTop: 50, alignItems: 'center', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#94a3b8' },
  duration: { fontSize: 32, fontWeight: 'bold', color: '#10b981', marginTop: 10 },
  transcriptContainer: { flex: 1, backgroundColor: '#0f0f1e' },
  transcriptContent: { padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#94a3b8', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 40 },
  message: { backgroundColor: '#16213e', borderRadius: 12, padding: 12, marginBottom: 12, borderLeftWidth: 4 },
  messageUser: { borderLeftColor: '#3b82f6', backgroundColor: '#1e3a5f' },
  messageAgent: { borderLeftColor: '#10b981', backgroundColor: '#1e3a2e' },
  messageSystem: { borderLeftColor: '#64748b', backgroundColor: '#1a1a2e' },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  messageSpeaker: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  messageTime: { fontSize: 12, color: '#64748b' },
  messageText: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  controls: { padding: 16, backgroundColor: '#16213e' },
  callControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  button: { borderRadius: 16, padding: 20, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  buttonCall: { backgroundColor: '#10b981' },
  buttonHangup: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  iconButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  iconButtonActive: { backgroundColor: '#dc2626' },
  iconButtonLabel: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
  statusBar: { position: 'absolute', top: 120, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#64748b', marginRight: 8 },
  statusDotActive: { backgroundColor: '#10b981' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' }
});
