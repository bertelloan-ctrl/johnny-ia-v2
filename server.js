const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { Server } = require('socket.io');
require('dotenv').config();
const WebSocket = require('ws');
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.json());

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('[OK] Supabase inicializado');

// ========================================
// ENDPOINT: GUARDAR CLIENTE
// ========================================
app.post('/api/save-client', async (req, res) => {
  try {
    const clientData = req.body;

    console.log('[SAVE] Guardando cliente:', clientData.client_id);

    const { data, error } = await supabase
      .from('johnny_clients')
      .upsert(clientData, { onConflict: 'client_id' });

    if (error) throw error;

    res.json({ success: true, message: 'Cliente guardado correctamente' });
  } catch (error) {
    console.error('[ERROR] Guardando cliente:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ENDPOINT: OBTENER TODOS LOS CLIENTES
// ========================================
app.get('/api/get-clients', async (req, res) => {
  try {
    console.log('[CLIENTS] Obteniendo todos los clientes');

    const { data: clients, error } = await supabase
      .from('johnny_clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, clients: clients || [] });
  } catch (error) {
    console.error('[ERROR] Obteniendo clientes:', error.message);
    res.status(500).json({ success: false, error: error.message, clients: [] });
  }
});

// ========================================
// ENDPOINT: OBTENER CONFIGURACION DE UN CLIENTE
// ========================================
app.get('/api/get-client-config', async (req, res) => {
  try {
    const { client_id } = req.query;

    console.log('[CONFIG] Obteniendo configuracion de:', client_id);

    const { data: client, error } = await supabase
      .from('johnny_clients')
      .select('*')
      .eq('client_id', client_id)
      .single();

    if (error) throw error;

    res.json({ success: true, config: client });
  } catch (error) {
    console.error('[ERROR] Obteniendo configuracion:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ENDPOINT: OBTENER LEADS
// ========================================
app.get('/api/leads', async (req, res) => {
  try {
    const { client_id } = req.query;

    console.log('[LEADS] Obteniendo leads para:', client_id);

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('client_id', client_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, leads: leads || [] });
  } catch (error) {
    console.error('[ERROR] Obteniendo leads:', error.message);
    res.status(500).json({ success: false, error: error.message, leads: [] });
  }
});

// ========================================
// ENDPOINT: ESTADISTICAS
// ========================================
app.get('/api/stats', async (req, res) => {
  try {
    const { client_id } = req.query;

    console.log('[STATS] Obteniendo estadisticas para:', client_id);

    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client_id);

    const { count: newLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .eq('status', 'new');

    const { count: withPhone } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .not('phone', 'is', null);

    const { count: withEmail } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .not('email', 'is', null);

    const { count: called } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client_id)
      .in('status', ['calling', 'contacted']);

    res.json({
      success: true,
      totalLeads: totalLeads || 0,
      newLeads: newLeads || 0,
      withPhone: withPhone || 0,
      withEmail: withEmail || 0,
      called: called || 0
    });

  } catch (error) {
    console.error('[ERROR] Obteniendo estadisticas:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      totalLeads: 0,
      newLeads: 0,
      withPhone: 0,
      withEmail: 0,
      called: 0
    });
  }
});

// ========================================
// ENDPOINT: GUARDAR CONVERSACION DE PRUEBA
// ========================================
app.post('/api/save-test-conversation', async (req, res) => {
  const { clientId, sessionId, messages } = req.body;

  try {
    const { error } = await supabase
      .from('test_conversations')
      .insert({
        client_id: clientId,
        session_id: sessionId,
        transcript: messages,
        duration_seconds: 0,
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[ERROR] Guardando conversacion:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// ========================================
// HEALTH CHECK
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// INICIAR SERVIDOR Y WEBSOCKET
// ========================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('[SERVER] Corriendo en http://192.168.3.27:' + PORT);
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const testSessions = new Map();

// ========================================
// WEBSOCKET PARA PRUEBAS CON OPENAI
// ========================================
io.on('connection', (socket) => {
  console.log('[WS] Cliente conectado:', socket.id);

  let openaiWs = null;
  let sessionId = null;
  let clientConfig = null;

  socket.on('start-test-session', async (data) => {
    const { clientId } = data;
    sessionId = 'test_' + Date.now();

    console.log('[TEST] Sesion iniciada:', sessionId, 'Cliente:', clientId);

    try {
      const { data: config, error } = await supabase
        .from('johnny_clients')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error) throw error;

      clientConfig = config;

      console.log('✅ Configuración cargada para', clientId + ':', clientConfig.company_name);

      socket.emit('session-started', {
        sessionId,
        config: clientConfig
      });

      // Conectar con OpenAI Realtime
      const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

      openaiWs = new WebSocket(openaiUrl, {
        headers: {
          'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      console.log('[TEST] Conectando a OpenAI...');

      openaiWs.on('open', () => {
        console.log('[TEST] ✅ Conectado a OpenAI');

        const systemPrompt = buildSystemPrompt(clientConfig);

        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            temperature: 0.7
          }
        };

        openaiWs.send(JSON.stringify(sessionUpdate));

        // Esperar un momento para que la sesión se configure
        setTimeout(() => {
          // Solicitar que OpenAI genere un saludo de bienvenida
          openaiWs.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
              instructions: 'Saluda al cliente y preséntate brevemente'
            }
          }));

          console.log('[TEST] ✅ Sesión lista, esperando audio del usuario...');
        }, 500);
      });

      openaiWs.on('message', (message) => {
        try {
          const event = JSON.parse(message);

          // Log TODOS los eventos de OpenAI para debugging
          console.log('[OPENAI EVENT]:', event.type);

          if (event.type === 'error') {
            console.error('[OPENAI ERROR EVENT]:', JSON.stringify(event, null, 2));
            socket.emit('error', { message: 'Error de OpenAI: ' + (event.error?.message || 'Unknown') });
          }

          if (event.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('[USER]:', event.transcript);
            socket.emit('user-message', {
              text: event.transcript,
              timestamp: new Date().toISOString()
            });
          }

          if (event.type === 'response.done' && event.response.output) {
            console.log('[OPENAI] Respuesta completa recibida');
            for (const output of event.response.output) {
              if (output.type === 'message' && output.content) {
                for (const content of output.content) {
                  if (content.type === 'text') {
                    console.log('[AGENT]:', content.text);
                    socket.emit('agent-message', {
                      text: content.text,
                      timestamp: new Date().toISOString()
                    });
                  }
                }
              }
            }
          }

          if (event.type === 'response.audio.delta' && event.delta) {
            console.log('[OPENAI] Audio delta recibido, tamaño:', event.delta.length);
            const wavAudio = pcm16ToWav(event.delta, 24000, 1);
            socket.emit('agent-audio', {
              audioBase64: wavAudio,
              timestamp: new Date().toISOString()
            });
          }

          if (event.type === 'response.audio_transcript.done') {
            console.log('[AGENT TRANSCRIPT]:', event.transcript);
          }

        } catch (err) {
          console.error('[ERROR] Procesando evento OpenAI:', err);
        }
      });

      openaiWs.on('error', (error) => {
        console.error('[OPENAI ERROR]:', error.message);
        console.error('[OPENAI ERROR COMPLETO]:', JSON.stringify(error, null, 2));
      });

      openaiWs.on('close', (code, reason) => {
        console.log('[OPENAI] Desconectado - Codigo:', code, 'Razon:', reason.toString());
      });

    } catch (error) {
      console.error('[ERROR] Iniciando sesion:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('send-audio', async (data) => {
    if (!openaiWs || openaiWs.readyState !== 1) {
      console.log('[AUDIO] No se puede enviar, OpenAI no conectado');
      return;
    }

    try {
      // El cliente envía audioBase64 que es un WAV completo
      // Necesitamos extraer solo el PCM16 (sin header WAV)
      const wavBuffer = Buffer.from(data.audioBase64, 'base64');

      // Un header WAV típico tiene 44 bytes, el resto es PCM16
      const pcm16Data = wavBuffer.slice(44);
      const pcm16Base64 = pcm16Data.toString('base64');

      console.log('[AUDIO] Recibido WAV:', wavBuffer.length, 'bytes, PCM16:', pcm16Data.length, 'bytes');

      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcm16Base64
      }));

      console.log('[AUDIO] Audio PCM16 enviado a OpenAI');

      // Hacer commit y solicitar respuesta después de un breve delay
      setTimeout(() => {
        if (openaiWs && openaiWs.readyState === 1) {
          openaiWs.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }));

          openaiWs.send(JSON.stringify({
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }));

          console.log('[AUDIO] Commit y respuesta solicitada');
        }
      }, 500);

    } catch (error) {
      console.error('[ERROR] Procesando audio:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('[WS] Cliente desconectado');
    if (openaiWs) openaiWs.close();
  });
});

function buildSystemPrompt(config) {
  const products = config.products ? config.products.join(', ') : 'nuestros productos';
  const minOrder = config.conditions?.min_order || 'consultar';
  const pricing = config.conditions?.pricing || 'segun volumen';

  return 'Eres ' + (config.agent_name || 'un vendedor') + ' de ' + config.company_name + '. Productos: ' + products + '. Precios: ' + pricing + '. Pedido minimo: ' + minOrder + '. Habla de forma natural y conversacional en espanol mexicano.';
}

function pcm16ToWav(pcm16Base64, sampleRate = 24000, channels = 1) {
  const pcm16Buffer = Buffer.from(pcm16Base64, 'base64');
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcm16Buffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(channels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * channels * 2, 28);
  wavHeader.writeUInt16LE(channels * 2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcm16Buffer.length, 40);

  return Buffer.concat([wavHeader, pcm16Buffer]).toString('base64');
}
