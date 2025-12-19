import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import io from 'socket.io-client';

export default function TestCallScreen({ route, navigation }) {
  const { clientId, clientName } = route.params;

  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const scrollViewRef = useRef();
  const recordingRef = useRef(null);
  const durationInterval = useRef(null);
  const audioInterval = useRef(null);

  useEffect(() => {
    requestPermissions();
    return () => {
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync();
      if (socket) socket.disconnect();
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (audioInterval.current) clearInterval(audioInterval.current);
    };
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } else {
        Alert.alert('Permiso necesario', 'Necesitamos acceso al microfono');
      }
    } catch (error) {
      console.error('Error permisos:', error);
    }
  };

  const startCall = async () => {
    if (!permissionGranted) {
      Alert.alert('Sin permisos', 'Activa el permiso del microfono');
      return;
    }

    addMessage('system', 'Iniciando llamada...');

    try {
      const newSocket = io('https://johnny-ia-v2.onrender.com');

      newSocket.on('connect', () => {
        console.log('Conectado con Socket.IO');
        addMessage('system', 'Llamada conectada');

        newSocket.emit('start-test-session', { clientId });
      });

      newSocket.on('session-started', async (data) => {
        console.log('Sesion iniciada:', data.sessionId);
        setSessionId(data.sessionId);
        setCallActive(true);

        durationInterval.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);

        await startContinuousRecording(newSocket, data.sessionId);
      });

      newSocket.on('agent-message', (data) => {
        console.log('Vendedor:', data.text);
        addMessage('agent', data.text);
      });

      newSocket.on('user-message', (data) => {
        console.log('Tu:', data.text);
        addMessage('user', data.text);
      });

      newSocket.on('agent-audio', async (data) => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: `data:audio/wav;base64,${data.audioBase64}` },
            { shouldPlay: true }
          );
          await sound.playAsync();
        } catch (error) {
          console.error('Error reproduciendo audio:', error);
        }
      });

      newSocket.on('error', (data) => {
        console.error('Error:', data.message);
        addMessage('system', 'Error: ' + data.message);
      });

      newSocket.on('disconnect', () => {
        console.log('Desconectado');
        endCall();
      });

      setSocket(newSocket);

    } catch (error) {
      console.error('Error iniciando llamada:', error);
      addMessage('system', 'Error al conectar');
    }
  };

  const startContinuousRecording = async (sock, sessId) => {
    try {
      console.log('[DEBUG] 🎤 Iniciando grabación continua...');
      const { recording: newRecording } = await Audio.Recording.createAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      recordingRef.current = newRecording;
      setRecording(newRecording);

      console.log('[DEBUG] ✅ Grabación iniciada exitosamente');

      sendAudioChunks(sock, sessId);

    } catch (error) {
      console.error('[ERROR] Error iniciando grabacion:', error);
      addMessage('system', 'Error al iniciar grabación: ' + error.message);
    }
  };

  const sendAudioChunks = (sock, sessId) => {
    if (audioInterval.current) {
      clearInterval(audioInterval.current);
    }

    console.log('[DEBUG] Iniciando envío de audio cada 3 segundos...');

    audioInterval.current = setInterval(async () => {
      if (!recordingRef.current || !sock || isMuted || !callActive) {
        console.log('[DEBUG] No se puede enviar audio:', {
          hasRecording: !!recordingRef.current,
          hasSocket: !!sock,
          isMuted,
          callActive
        });
        return;
      }

      try {
        console.log('[DEBUG] Intentando enviar chunk de audio...');
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        console.log('[DEBUG] URI del audio:', uri);

        if (uri) {
          const audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('[DEBUG] Audio convertido a base64, tamaño:', audioBase64.length);

          sock.emit('send-audio', {
            sessionId: sessId,
            audioBase64: audioBase64
          });

          console.log('[DEBUG] ✅ Audio enviado al servidor');
        } else {
          console.log('[DEBUG] ⚠️ URI vacía, no se puede leer el audio');
        }

        if (callActive && !isMuted) {
          const { recording: newRecording } = await Audio.Recording.createAsync({
            android: {
              extension: '.wav',
              outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
              audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
              sampleRate: 16000,
              numberOfChannels: 1,
              bitRate: 128000,
            },
            ios: {
              extension: '.wav',
              audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
              sampleRate: 16000,
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
        console.error('Error enviando audio:', error);
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

    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }

    if (audioInterval.current) {
      clearInterval(audioInterval.current);
    }

    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }

    if (socket) {
      socket.disconnect();
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
      const response = await fetch('https://johnny-ia-v2.onrender.com/api/save-test-conversation', {
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
        <Text style={styles.title}>Llamada de Prueba</Text>
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
  messageAgent: { borderLeftColor: '#10b981', backgroundColor: '#1e3a2f' },
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
