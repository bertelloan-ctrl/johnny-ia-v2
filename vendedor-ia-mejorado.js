import 'dotenv/config';
import express from 'express';
import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import Twilio from 'twilio';

// ════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY');
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Faltan credenciales de Supabase');
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) throw new Error('Faltan credenciales de Twilio');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log('📞 Endpoint Twilio: /incoming-call');
});

const wss = new WebSocketServer({ server });

// ════════════════════════════════════════════════════════════
// ESTADO DE LLAMADAS
// ════════════════════════════════════════════════════════════

const activeCalls = new Map();

// ════════════════════════════════════════════════════════════
// FUNCIONES DE SUPABASE
// ════════════════════════════════════════════════════════════

async function loadClientConfig(clientId) {
  try {
    const { data, error } = await supabase
      .from('johnny_clients')
      .select('*')
      .eq('client_id', clientId)
      .single();
    
    if (error) {
      console.error('❌ Error cargando config:', error);
      return null;
    }
    
    console.log(`✅ Configuración cargada para ${clientId}:`, data.company_name);
    return data;
  } catch (err) {
    console.error('❌ Error en loadClientConfig:', err);
    return null;
  }
}

async function saveTranscript(callSid, clientId, transcript, capturedData, status) {
  try {
    const { error } = await supabase
      .from('call_transcripts')
      .upsert({
        call_sid: callSid,
        client_id: clientId,
        transcript: transcript,
        captured_data: capturedData,
        status: status,
        voicemail_detected: capturedData.voicemail_detected || false,
        human_detected: capturedData.human_detected || false,
        duration_seconds: capturedData.duration_seconds || 0
      }, {
        onConflict: 'call_sid'
      });
    
    if (error) {
      console.error('❌ Error guardando transcript:', error);
    } else {
      console.log(`✅ Transcript guardado para ${callSid}`);
    }
  } catch (err) {
    console.error('❌ Error en saveTranscript:', err);
  }
}

// ════════════════════════════════════════════════════════════
// FUNCIÓN PARA COLGAR LLAMADAS
// ════════════════════════════════════════════════════════════

async function hangupCall(callSid) {
  try {
    await twilioClient.calls(callSid).update({ status: 'completed' });
    console.log(`📴 Llamada colgada: ${callSid}`);
  } catch (err) {
    console.error('❌ Error colgando llamada:', err);
  }
}

// ════════════════════════════════════════════════════════════
// DETECCIÓN DE PATRONES
// ════════════════════════════════════════════════════════════

const IVR_PATTERNS = [
  /marque|presione|oprima/i,
  /para\s+(hablar|ventas|compras|información)/i,
  /extensión|departamento/i,
  /gracias\s+por\s+llamar/i,
  /menu|opciones/i
];

const VOICEMAIL_PATTERNS = [
  /buzón\s+de\s+voz/i,
  /deje\s+(su\s+)?mensaje/i,
  /después\s+del\s+tono/i,
  /no\s+(estamos|está)\s+disponible/i,
  /leave\s+a\s+message/i
];

function detectIVR(text) {
  return IVR_PATTERNS.some(pattern => pattern.test(text));
}

function detectVoicemail(text) {
  return VOICEMAIL_PATTERNS.some(pattern => pattern.test(text));
}

// ════════════════════════════════════════════════════════════
// CONSTRUCCIÓN DE PROMPT DINÁMICO
// ════════════════════════════════════════════════════════════

function buildSystemPrompt(config) {
  if (!config) {
    return `Eres un asistente de ventas profesional. Mantén conversaciones naturales y captura datos de contacto.`;
  }

  const productsText = config.products ? config.products.join(', ') : 'nuestros productos';
  const minOrder = config.conditions?.min_order || 'consultar';
  const pricing = config.conditions?.pricing || 'según volumen';
  const deliveryTime = config.conditions?.delivery_time || 'según pedido';

  return `Eres ${config.agent_name || 'Roberto'}, vendedor profesional de ${config.company_name}.

TU EMPRESA:
- Industria: ${config.industry}
- Productos principales: ${productsText}
- Propuesta de valor: ${config.value_proposition || 'Calidad y servicio garantizado'}

CONDICIONES COMERCIALES:
- Precios: ${pricing}
- Pedido mínimo: ${minOrder}
- Tiempo de entrega: ${deliveryTime}
- Zona de cobertura: ${config.conditions?.coverage || 'Nacional'}

OBJETIVO DE LA LLAMADA:
${config.sales_goal === 'agendar_demo' ? 'Agendar una demostración o reunión' : 'Capturar interés y datos de contacto'}

TONO Y ESTILO:
- Sé ${config.tone || 'profesional y amigable'}
- Habla de manera natural y conversacional
- NO uses frases robóticas como "¿en qué puedo ayudarte?"
- Adapta tu lenguaje al contexto mexicano (usted/tú según la situación)

REGLAS CRÍTICAS:
1. Si la persona dice algo como "¿quién habla?" o "¿de dónde llama?", responde naturalmente: "Hola, habla ${config.agent_name || 'Roberto'} de ${config.company_name}"
2. Si preguntan por el departamento, menciona que buscas al área de compras o al responsable de ${config.industry}
3. Si detectas que es un IVR (sistema automatizado), NO hables, espera instrucciones
4. Si detectas un buzón de voz, cuelga inmediatamente
5. Captura SIEMPRE: nombre, empresa, email, teléfono, nivel de interés
6. Cuando termines la conversación y te despidas, di "hasta luego" o "que tengas buen día"

DATOS A CAPTURAR:
- Nombre completo
- Empresa
- Email (CRÍTICO)
- Teléfono
- Puesto o rol
- Volumen aproximado de compra
- Nivel de interés (alto/medio/bajo)

${config.additional_instructions || ''}

Ahora, inicia la conversación de manera natural cuando detectes que alguien responde.`;
}

// ════════════════════════════════════════════════════════════
// ENDPOINT TWILIO
// ════════════════════════════════════════════════════════════

app.post('/incoming-call', async (req, res) => {
  const callSid = req.body.CallSid;
  const clientId = req.query.client_id || 'allopack__001';
  
  console.log(`📞 Llamada entrante: ${callSid} | Cliente: ${clientId}`);
  
  const config = await loadClientConfig(clientId);
  
  if (!config) {
    console.error('❌ No se pudo cargar la configuración del cliente');
    return res.status(500).send('Error de configuración');
  }

  activeCalls.set(callSid, {
    callSid,
    clientId,
    config,
    transcript: [],
    capturedData: {},
    startTime: Date.now(),
    ivrDetected: false,
    voicemailDetected: false,
    humanDetected: false,
    streamSid: null,
    conversationEnded: false
  });

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${req.headers.host}/media-stream">
      <Parameter name="callSid" value="${callSid}"/>
      <Parameter name="clientId" value="${clientId}"/>
    </Stream>
  </Connect>
</Response>`;

  res.type('text/xml').send(twiml);
});

// ════════════════════════════════════════════════════════════
// WEBSOCKET - TWILIO MEDIA STREAM
// ════════════════════════════════════════════════════════════

wss.on('connection', async (twilioWs, req) => {
  console.log('🔌 Cliente Twilio conectado');

  let openaiWs = null;
  let callSid = null;
  let callState = null;
  let streamSid = null;

  twilioWs.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.event === 'start') {
        callSid = msg.start.callSid;
        streamSid = msg.start.streamSid;
        callState = activeCalls.get(callSid);

        if (!callState) {
          console.error('❌ No se encontró estado de llamada para:', callSid);
          return;
        }

        callState.streamSid = streamSid;
        console.log(`📞 Stream iniciado: ${streamSid}`);

        await connectToOpenAI(callState, twilioWs);
      }

      if (msg.event === 'media' && openaiWs && openaiWs.readyState === 1) {
        const audioPayload = {
          type: 'input_audio_buffer.append',
          audio: msg.media.payload
        };
        openaiWs.send(JSON.stringify(audioPayload));
      }

      if (msg.event === 'stop') {
        console.log('📞 Stream detenido');
        if (openaiWs) openaiWs.close();
        
        if (callState) {
          const duration = Math.floor((Date.now() - callState.startTime) / 1000);
          callState.capturedData.duration_seconds = duration;
          
          await saveTranscript(
            callSid,
            callState.clientId,
            callState.transcript,
            callState.capturedData,
            callState.humanDetected ? 'completed' : 'no_answer'
          );
        }
        
        activeCalls.delete(callSid);
      }

    } catch (err) {
      console.error('❌ Error procesando mensaje de Twilio:', err);
    }
  });

  async function connectToOpenAI(callState, twilioWs) {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

    openaiWs = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openaiWs.on('open', () => {
      console.log('✅ Conectado a OpenAI Realtime API');

      const sessionUpdate = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: buildSystemPrompt(callState.config),
          voice: 'alloy',
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          temperature: 0.7,
          max_response_output_tokens: 1000
        }
      };

      openaiWs.send(JSON.stringify(sessionUpdate));
      console.log('⚙️ Sesión de OpenAI configurada');
    });

    openaiWs.on('message', async (data) => {
      try {
        const event = JSON.parse(data);

        // TRANSCRIPCIONES DEL CLIENTE
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = event.transcript.trim();
          console.log(`👤 Cliente: ${transcript}`);
          
          callState.transcript.push({
            role: 'user',
            content: transcript,
            timestamp: new Date().toISOString()
          });

          // Detectar despedida del cliente
          const despedidasCliente = ['hasta luego', 'adiós', 'adios', 'nos hablamos', 'te marco después', 'hablamos luego', 'bye', 'chao', 'gracias', 'ok gracias'];
          const clientText = transcript.toLowerCase();
          const clienteDespidio = despedidasCliente.some(d => clientText.includes(d));

          if (clienteDespidio && !callState.conversationEnded) {
            console.log('👋 Cliente se despidió - Colgando en 2 segundos');
            callState.conversationEnded = true;
            setTimeout(async () => {
              await hangupCall(callState.callSid);
            }, 2000);
          }

          // Detección de IVR
          if (!callState.humanDetected && detectIVR(transcript)) {
            callState.ivrDetected = true;
            console.log('🤖 [IVR DETECTADO] - Sistema automatizado identificado');
          }

          // Detección de buzón de voz
          if (detectVoicemail(transcript)) {
            callState.voicemailDetected = true;
            callState.capturedData.voicemail_detected = true;
            console.log('📬 [VOICEMAIL] - Buzón detectado, colgando...');
            
            await hangupCall(callState.callSid);
            
            if (openaiWs) openaiWs.close();
            return;
          }

          // Detección de persona real
          if (!callState.humanDetected && transcript.length > 5) {
            callState.humanDetected = true;
            callState.capturedData.human_detected = true;
            console.log('✅ [PERSONA DETECTADA] - Iniciando conversación');
          }
        }

        // RESPUESTAS DEL AGENTE (TEXTO)
        if (event.type === 'response.done' && event.response.output) {
          for (const output of event.response.output) {
            if (output.type === 'message' && output.content) {
              for (const content of output.content) {
                if (content.type === 'text') {
                  const agentText = content.text;
                  console.log(`🤖 Agente: ${agentText}`);

                  // Detectar buzón de voz en respuesta del agente
                  if (agentText.includes('[VOICEMAIL_DETECTED]')) {
                    console.log('📭 Buzón detectado - Colgando');
                    callState.conversationEnded = true;
                    await hangupCall(callState.callSid);
                  }

                  // Detectar despedidas del agente
                  const despedidas = [
                    'gracias por tu tiempo',
                    'que tengas buen día',
                    'hasta luego',
                    'nos vemos',
                    'adiós',
                    'fue un placer',
                    'estaremos en contacto',
                    'te mando la información',
                    'te envío',
                    'nos hablamos'
                  ];

                  const isDespedida = despedidas.some(d => agentText.toLowerCase().includes(d));

                  if (isDespedida && !callState.conversationEnded) {
                    console.log('👋 Despedida detectada - Colgando en 3 segundos');
                    callState.conversationEnded = true;
                    setTimeout(async () => {
                      await hangupCall(callState.callSid);
                    }, 3000);
                  }
                  
                  callState.transcript.push({
                    role: 'assistant',
                    content: agentText,
                    timestamp: new Date().toISOString()
                  });

                  extractCapturedData(agentText, callState.capturedData);
                }
              }
            }
          }
        }

        // AUDIO DEL AGENTE
        if (event.type === 'response.audio.delta' && event.delta) {
          const audioPayload = {
            event: 'media',
            streamSid: callState.streamSid,
            media: { payload: event.delta }
          };
          twilioWs.send(JSON.stringify(audioPayload));
        }

      } catch (err) {
        console.error('❌ Error procesando evento de OpenAI:', err);
      }
    });

    openaiWs.on('error', (error) => {
      console.error('❌ Error en WebSocket de OpenAI:', error);
    });

    openaiWs.on('close', () => {
      console.log('🔌 Desconectado de OpenAI');
    });
  }

  twilioWs.on('close', () => {
    console.log('🔌 Cliente Twilio desconectado');
    if (openaiWs) openaiWs.close();
  });
});

// ════════════════════════════════════════════════════════════
// EXTRACCIÓN DE DATOS
// ════════════════════════════════════════════════════════════

function extractCapturedData(text, capturedData) {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch && !capturedData.email) {
    capturedData.email = emailMatch[0];
    console.log(`📧 Email capturado: ${capturedData.email}`);
  }

  const phoneMatch = text.match(/(?:\+?52)?[\s-]?\(?\d{2,3}\)?[\s-]?\d{3,4}[\s-]?\d{4}/);
  if (phoneMatch && !capturedData.phone) {
    capturedData.phone = phoneMatch[0].replace(/\D/g, '');
    console.log(`📞 Teléfono capturado: ${capturedData.phone}`);
  }

  const nameMatch = text.match(/(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i);
  if (nameMatch && !capturedData.name) {
    capturedData.name = nameMatch[1];
    console.log(`👤 Nombre capturado: ${capturedData.name}`);
  }

  const companyMatch = text.match(/(?:trabajo en|empresa|compañía)\s+([A-Z][a-zA-Z\s]+)/i);
  if (companyMatch && !capturedData.company) {
    capturedData.company = companyMatch[1].trim();
    console.log(`🏢 Empresa capturada: ${capturedData.company}`);
  }
}
// Función para convertir PCM16 a WAV
function pcm16ToWav(pcm16Base64, sampleRate = 24000, channels = 1) {
  const pcm16Buffer = Buffer.from(pcm16Base64, 'base64');
  const wavHeader = Buffer.alloc(44);
  
  // RIFF header
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcm16Buffer.length, 4);
  wavHeader.write('WAVE', 8);
  
  // fmt chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // chunk size
  wavHeader.writeUInt16LE(1, 20); // audio format (PCM)
  wavHeader.writeUInt16LE(channels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  wavHeader.writeUInt16LE(channels * 2, 32); // block align
  wavHeader.writeUInt16LE(16, 34); // bits per sample
  
  // data chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcm16Buffer.length, 40);
  
  return Buffer.concat([wavHeader, pcm16Buffer]).toString('base64');
}
// ════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    activeCalls: activeCalls.size,
    timestamp: new Date().toISOString()
  });
});
// ════════════════════════════════════════════════════════════
// WEBSOCKET PARA PRUEBAS DIRECTAS DESDE APP (SIN TWILIO)
// ════════════════════════════════════════════════════════════

wss.on('connection', (clientWs, req) => {
  // Detectar si NO es de Twilio (es conexión de prueba desde app)
  const isTestConnection = req.url && req.url.includes('test-session');
  
  if (!isTestConnection) return; // Si es Twilio, usar el flujo normal
  
  console.log('🧪 Conexion de prueba desde app');

  let openaiWs = null;
  let sessionId = null;
  let clientId = null;
  let clientConfig = null;

  clientWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // ══════════════════════════════════════
      // INICIAR SESION DE PRUEBA
      // ══════════════════════════════════════
      if (data.type === 'start-test-session') {
        clientId = data.clientId;
        sessionId = 'test_' + Date.now();
        
        console.log('[TEST] Sesion iniciada:', sessionId, 'Cliente:', clientId);

        // Cargar configuración del cliente
        clientConfig = await loadClientConfig(clientId);
        
        if (!clientConfig) {
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'No se pudo cargar la configuracion del cliente'
          }));
          return;
        }

        // Conectar con OpenAI Realtime
        const openaiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
        
        openaiWs = new WebSocket(openaiUrl, {
          headers: {
            'Authorization': 'Bearer ' + OPENAI_API_KEY,
            'OpenAI-Beta': 'realtime=v1'
          }
        });

        openaiWs.on('open', () => {
          console.log('[TEST] Conectado a OpenAI');

          // Configurar sesión con el prompt del cliente
          const sessionUpdate = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: buildSystemPrompt(clientConfig),
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duratio n_ms: 500
              },
              temperature: 0.7
            }
          };

          openaiWs.send(JSON.stringify(sessionUpdate));

          // Confirmar al cliente
          clientWs.send(JSON.stringify({
            type: 'session-started',
            sessionId,
            config: clientConfig
          }));

          // Mensaje de bienvenida
          const welcomeMsg = 'Hola! Soy ' + (clientConfig.agent_name || 'tu vendedor') + ' de ' + clientConfig.company_name + '. En que puedo ayudarte?';
          
          clientWs.send(JSON.stringify({
            type: 'agent-message',
            text: welcomeMsg,
            timestamp: new Date().toISOString()
          }));
        });

        openaiWs.on('message', (openaiMessage) => {
          try {
            const event = JSON.parse(openaiMessage);

            // Transcripción del usuario
            if (event.type === 'conversation.item.input_audio_transcription.completed') {
              console.log('[USER]:', event.transcript);
              clientWs.send(JSON.stringify({
                type: 'user-message',
                text: event.transcript,
                timestamp: new Date().toISOString()
              }));
            }

            // Transcripción del agente
            if (event.type === 'response.done' && event.response.output) {
              for (const output of event.response.output) {
                if (output.type === 'message' && output.content) {
                  for (const content of output.content) {
                    if (content.type === 'text') {
                      console.log('[AGENT]:', content.text);
                      clientWs.send(JSON.stringify({
                        type: 'agent-message',
                        text: content.text,
                        timestamp: new Date().toISOString()
                      }));
                    }
                  }
                }
              }
            }

          // Audio del agente - Convertir PCM16 a WAV
if (event.type === 'response.audio.delta' && event.delta) {
  const wavAudio = pcm16ToWav(event.delta, 24000, 1);
  clientWs.send(JSON.stringify({
    type: 'agent-audio',
    audioBase64: wavAudio,
    timestamp: new Date().toISOString()
  }));
}

          } catch (err) {
            console.error('[ERROR] Procesando evento OpenAI:', err);
          }
        });

        openaiWs.on('error', (error) => {
          console.error('[ERROR] OpenAI:', error);
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'Error de conexion con OpenAI'
          }));
        });

        openaiWs.on('close', () => {
          console.log('[TEST] OpenAI desconectado');
        });
      }

      // ══════════════════════════════════════
      // ENVIAR AUDIO A OPENAI
      // ══════════════════════════════════════
      if (data.type === 'send-audio' && openaiWs && openaiWs.readyState === 1) {
  // Enviar audio
  openaiWs.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: data.audioBase64
  }));
  
  // Forzar que OpenAI procese y responda
  setTimeout(() => {
    openaiWs.send(JSON.stringify({
      type: 'input_audio_buffer.commit'
    }));
    
    openaiWs.send(JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Responde de forma natural y conversacional a lo que el usuario acaba de decir.'
      }
    }));
  }, 500);
}

    } catch (err) {
      console.error('[ERROR] Mensaje de cliente:', err);
    }
  });

  clientWs.on('close', () => {
    console.log('[TEST] Cliente desconectado');
    if (openaiWs) openaiWs.close();
  });
});
console.log('✅ Servidor iniciado correctamente');
