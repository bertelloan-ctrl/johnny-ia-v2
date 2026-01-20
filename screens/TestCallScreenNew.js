// UPDATED VERSION 4.0 - WITH REMOTE LOGGING
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import io from 'socket.io-client';
import remoteLogger from '../utils/RemoteLogger';

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
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[APP] 🚀 COMPONENTE TESTCALLSCREEN MONTADO');
    console.log('[APP] 📡 REMOTE LOGGER ACTIVO - Los logs se enviarán al servidor');
    console.log('[APP] 📋 Parámetros recibidos:', JSON.stringify({ clientId, clientName }));
    console.log('[APP] 📁 FileSystem.cacheDirectory:', FileSystem.cacheDirectory);
    console.log('═══════════════════════════════════════════════════════════');

    requestPermissions();

    return () => {
      console.log('[APP] 🔄 Componente desmontándose, limpiando recursos...');
      try {
        // Enviar todos los logs pendientes antes de cerrar
        remoteLogger.forceFlush().catch(err =>
          console.error('[APP] Error enviando logs finales:', err)
        );

        if (recordingRef.current) {
          recordingRef.current.stopAndUnloadAsync().catch(err =>
            console.error('[APP] Error deteniendo grabación en cleanup:', err)
          );
        }
        if (socket) {
          socket.disconnect();
          console.log('[APP] Socket desconectado en cleanup');
        }
        if (durationInterval.current) clearInterval(durationInterval.current);
        if (audioInterval.current) clearInterval(audioInterval.current);
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
          // Continue anyway, don't block
        }
      } else {
        console.error('[APP ERROR] ❌ Permisos de audio denegados');
        Alert.alert('Permiso necesario', 'Necesitamos acceso al microfono');
      }
    } catch (error) {
      console.error('[APP ERROR] ❌ Error solicitando permisos:', error);
      console.error('[APP ERROR] Stack:', error.stack);
      Alert.alert('Error', 'Error al solicitar permisos: ' + error.message);
    }
  };

  const startCall = async () => {
    console.log('[APP] 📞 startCall() llamado');
    console.log('[APP] 📋 Permisos otorgados:', permissionGranted);

    if (!permissionGranted) {
      console.error('[APP ERROR] ❌ No hay permisos de audio');
      Alert.alert('Sin permisos', 'Activa el permiso del microfono');
      return;
    }

    console.log('[APP] 🚀 Iniciando proceso de llamada...');
    addMessage('system', 'Iniciando llamada...');

    try {
      console.log('[APP] 🔌 Creando conexión Socket.IO...');
      const newSocket = io('https://johnny-ia-v2.onrender.com', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });
      console.log('[APP] ✅ Socket creado, esperando conexión...');

      // Register ALL listeners BEFORE emitting any events
      newSocket.on('session-started', async (data) => {
        try {
          console.log('[APP] ✅ Sesión iniciada:', data?.sessionId || 'sin ID');
          console.log('[APP] 📋 Config recibida:', JSON.stringify(data?.config || {}, null, 2));

          if (!data || !data.sessionId) {
            console.error('[APP ERROR] ⚠️ session-started sin sessionId válido');
            addMessage('system', 'Error: sesión inválida');
            return;
          }

          setSessionId(data.sessionId);
          setCallActive(true);
          addMessage('system', '✅ Sesión iniciada: ' + data.sessionId);

          durationInterval.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);

          console.log('[APP] 🎤 Iniciando grabación continua...');
          try {
            await startContinuousRecording(newSocket, data.sessionId);
            console.log('[APP] ✅ Grabación iniciada exitosamente');
            addMessage('system', '🎤 Grabación iniciada');
          } catch (error) {
            console.error('[APP ERROR] ❌ Error al iniciar grabación:', error);
            console.error('[APP ERROR] Stack:', error.stack);
            addMessage('system', 'Error al iniciar grabación: ' + error.message);
            // Don't crash, continue
          }
        } catch (error) {
          console.error('[APP ERROR] ❌ Error en handler de session-started:', error);
          console.error('[APP ERROR] Stack:', error.stack);
          addMessage('system', 'Error al procesar inicio de sesión: ' + error.message);
          // Don't crash
        }
      });

      newSocket.on('agent-message', (data) => {
        console.log('[APP] 💬 Mensaje del vendedor:', data.text);
        addMessage('agent', data.text);
      });

      newSocket.on('user-message', (data) => {
        console.log('[APP] 🗣️ Tu mensaje:', data.text);
        addMessage('user', data.text);
      });

      newSocket.on('agent-audio', async (data) => {
        try {
          console.log('[APP] 🎵 Audio recibido del servidor');
          console.log('[APP] 📊 Tamaño del audio base64:', data?.audioBase64?.length || 'undefined');

          // Validate audio data
          if (!data || !data.audioBase64 || data.audioBase64.length === 0) {
            console.error('[APP ERROR] ⚠️ Audio data inválido o vacío');
            addMessage('system', 'Error: audio inválido recibido');
            return; // Don't crash, just return
          }

          // Validate FileSystem.cacheDirectory
          if (!FileSystem.cacheDirectory) {
            console.error('[APP ERROR] ⚠️ FileSystem.cacheDirectory no está disponible');
            addMessage('system', 'Error: no se puede acceder al almacenamiento temporal');
            return;
          }

          console.log('[APP] 📁 Cache directory:', FileSystem.cacheDirectory);

          // Pausar grabación mientras se reproduce el audio del agente
          const wasRecording = !!recordingRef.current;
          if (wasRecording) {
            try {
              await recordingRef.current.pauseAsync();
              console.log('[APP] ⏸️ Grabación pausada para reproducir audio');
            } catch (pauseError) {
              console.error('[APP ERROR] Error al pausar grabación:', pauseError);
              // Continue anyway, don't crash
            }
          }

          // Save audio to temporary file instead of using data URI
          const fileUri = FileSystem.cacheDirectory + `agent_audio_${Date.now()}.wav`;
          console.log('[APP] 💾 Guardando audio en:', fileUri);

          try {
            await FileSystem.writeAsStringAsync(fileUri, data.audioBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            console.log('[APP] ✅ Audio guardado exitosamente');
          } catch (writeError) {
            console.error('[APP ERROR] ❌ Error al escribir archivo de audio:', writeError);
            console.error('[APP ERROR] Detalles del error de escritura:', JSON.stringify(writeError, null, 2));
            addMessage('system', 'Error al guardar audio: ' + writeError.message);
            return; // Don't crash, just return
          }

          // Verify file was created
          try {
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            console.log('[APP] 📋 Info del archivo:', JSON.stringify(fileInfo, null, 2));
            if (!fileInfo.exists) {
              console.error('[APP ERROR] ❌ El archivo no fue creado');
              addMessage('system', 'Error: archivo de audio no fue creado');
              return;
            }
          } catch (infoError) {
            console.error('[APP ERROR] Error al verificar archivo:', infoError);
            // Continue anyway
          }

          // Create and play sound
          let sound = null;
          try {
            console.log('[APP] 🔊 Creando objeto de sonido...');
            const soundObject = await Audio.Sound.createAsync(
              { uri: fileUri },
              { shouldPlay: false, volume: 1.0 } // Don't autoplay, control manually
            );
            sound = soundObject.sound;
            console.log('[APP] ✅ Objeto de sonido creado');
          } catch (createError) {
            console.error('[APP ERROR] ❌ Error al crear sonido:', createError);
            console.error('[APP ERROR] Detalles:', JSON.stringify(createError, null, 2));
            addMessage('system', 'Error al crear audio: ' + createError.message);
            // Clean up file
            try {
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            } catch (delErr) {
              console.error('[APP ERROR] Error al eliminar archivo temporal:', delErr);
            }
            return;
          }

          try {
            console.log('[APP] ▶️ Reproduciendo audio del agente...');
            await sound.playAsync();
            console.log('[APP] ✅ Audio comenzó a reproducirse');
            addMessage('system', '🔊 Reproduciendo respuesta del vendedor');
          } catch (playError) {
            console.error('[APP ERROR] ❌ Error al reproducir audio:', playError);
            console.error('[APP ERROR] Detalles:', JSON.stringify(playError, null, 2));
            addMessage('system', 'Error al reproducir audio: ' + playError.message);
            // Clean up
            try {
              await sound.unloadAsync();
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            } catch (cleanupErr) {
              console.error('[APP ERROR] Error en limpieza:', cleanupErr);
            }
            return;
          }

          // Esperar a que termine de reproducir
          sound.setOnPlaybackStatusUpdate(async (status) => {
            try {
              if (status.didJustFinish) {
                console.log('[APP] ✅ Audio terminado, limpiando...');

                // Unload sound
                try {
                  await sound.unloadAsync();
                  console.log('[APP] ✅ Sonido descargado');
                } catch (unloadErr) {
                  console.error('[APP ERROR] Error al descargar sonido:', unloadErr);
                }

                // Delete temporary file
                try {
                  await FileSystem.deleteAsync(fileUri, { idempotent: true });
                  console.log('[APP] ✅ Archivo temporal eliminado');
                } catch (delErr) {
                  console.error('[APP ERROR] Error al eliminar archivo:', delErr);
                }

                // Resume recording
                if (wasRecording && recordingRef.current) {
                  try {
                    await recordingRef.current.startAsync();
                    console.log('[APP] ▶️ Grabación resumida');
                  } catch (resumeErr) {
                    console.error('[APP ERROR] Error al resumir grabación:', resumeErr);
                  }
                }
              }
            } catch (statusError) {
              console.error('[APP ERROR] Error en callback de status:', statusError);
              // Don't crash the app
            }
          });
        } catch (error) {
          console.error('[APP ERROR] ❌ Error general reproduciendo audio:', error);
          console.error('[APP ERROR] Stack:', error.stack);
          console.error('[APP ERROR] Detalles completos:', JSON.stringify(error, null, 2));
          addMessage('system', 'Error inesperado en audio: ' + error.message);
          // DON'T disconnect or crash - keep the component alive
        }
      });

      newSocket.on('error', (data) => {
        console.error('Error:', data.message);
        addMessage('system', 'Error: ' + data.message);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[APP] ⚠️ Socket desconectado');
        console.log('[APP] 📋 Razón de desconexión:', reason);
        console.log('[APP] 📋 Estado de la llamada:', callActive);
        console.log('[APP] 📋 Socket ID:', newSocket?.id);

        // Only end call if it was an error disconnect, not a normal one
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          console.log('[APP] ℹ️ Desconexión normal del servidor');
          addMessage('system', 'Desconectado del servidor: ' + reason);
          // Don't immediately end the call, let the user decide
        } else if (reason === 'transport close' || reason === 'transport error') {
          console.log('[APP] ❌ Error de transporte');
          addMessage('system', 'Error de conexión: ' + reason);
          // Keep the UI alive, don't call endCall()
        } else {
          console.log('[APP] ⚠️ Desconexión inesperada:', reason);
          addMessage('system', 'Desconectado inesperadamente: ' + reason);
        }

        // DON'T call endCall() automatically - keep the component alive for debugging
        // endCall();
      });

      // Handle connection errors
      newSocket.on('connect_error', (error) => {
        console.error('[APP] ❌ Error de conexión Socket.IO:', error);
        console.error('[APP] Error message:', error.message);
        console.error('[APP] Error stack:', error.stack);
        addMessage('system', 'Error de conexión: ' + error.message);
      });

      newSocket.on('connect_timeout', () => {
        console.error('[APP] ⏱️ Timeout de conexión Socket.IO');
        addMessage('system', 'Timeout: no se pudo conectar al servidor');
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('[APP] 🔄 Intento de reconexión #' + attemptNumber);
        addMessage('system', 'Intentando reconectar... (' + attemptNumber + ')');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('[APP] ❌ Error de reconexión:', error);
        addMessage('system', 'Error al reconectar: ' + error.message);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('[APP] ❌ Falló la reconexión');
        addMessage('system', 'No se pudo reconectar al servidor');
      });

      // Register 'connect' listener LAST, after all other listeners are ready
      newSocket.on('connect', () => {
        console.log('[APP] ✅ Conectado con Socket.IO');
        console.log('[APP] 📋 Socket ID:', newSocket.id);
        console.log('[APP] 📋 Socket conectado:', newSocket.connected);
        addMessage('system', '✅ Conectado al servidor');

        // Now that all listeners are registered, emit the event
        console.log('[APP] 📤 Emitiendo start-test-session con clientId:', clientId);
        newSocket.emit('start-test-session', { clientId });
        console.log('[APP] ✅ Evento start-test-session emitido');
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
