import 'dotenv/config';
import express from 'express';
import ExpressWs from 'express-ws';
import Twilio from 'twilio';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

const app = express();
ExpressWs(app);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VOICEMAIL_KEYWORDS = [
  'buzón', 'buzon', 'mensaje', 'señal', 'tono', 'beep',
  'voicemail', 'mailbox', 'leave a message', 'not available'
];

const IVR_KEYWORDS = {
  compras: ['compra', 'compras', 'purchasing', 'procurement'],
  ventas: ['venta', 'ventas', 'sales', 'comercial'],
  operadora: ['operadora', 'operator', 'recepción', 'reception']
};

function buildSystemPrompt(clientConfig) {
  return `Eres ${clientConfig.agent_name || 'Roberto'}, vendedor de ${clientConfig.company_name || 'la empresa'}.

REGLAS CRÍTICAS:

1. BUZÓN DE VOZ:
   Si escuchas "buzón", "mensaje", "señal", di: [VOICEMAIL_DETECTED]

2. IVR (MENÚS):
   Si escuchas "para compras marque 2", responde: [DTMF:2]
   Si no sabes qué marcar: [DTMF:0]

3. PERSONA REAL:
   Si alguien dice "bueno", "hola", "diga", di: [HUMAN_DETECTED]
   Luego presenta: "${clientConfig.pitch || 'Ofrecemos soluciones de calidad'}"

4. CAPTURA DE DATOS:
   - Email: [EMAIL:texto]
   - Teléfono: [PHONE:texto]
   - Nombre: [NAME:texto]

5. Si nadie contesta en 10 seg: [TIMEOUT]

Habla natural en español mexicano. Sé breve.`;
}

const sessions = new Map();

class CallSession {
  constructor(callSid, streamSid, clientId, config) {
    this.callSid = callSid;
    this.streamSid = streamSid;
    this.clientId = clientId;
    this.config = config;
    this.transcript = [];
    this.capturedData = {};
    this.startTime = Date.now();
    this.voicemailDetected = false;
    this.humanDetected = false;
    this.dtmfSent = [];
  }

  addTranscript(speaker, text) {
    this.transcript.push({ speaker, text, timestamp: Date.now() });
    console.log(`${speaker === 'agent' ? '🤖' : '👤'}: "${text}"`);
  }

  detectVoicemail(text) {
    const lower = text.toLowerCase();
    const detected = VOICEMAIL_KEYWORDS.some(k => lower.includes(k));
    if (detected) {
      console.log('📭 BUZÓN DETECTADO');
      this.voicemailDetected = true;
    }
    return detected;
  }

  detectHuman(text) {
    const lower = text.toLowerCase();
    if (lower.includes('bueno') || lower.includes('hola') || lower.includes('diga')) {
      console.log('👨 PERSONA DETECTADA');
      this.humanDetected = true;
      return true;
    }
    return false;
  }

  detectIvrOption(text) {
    const lower = text.toLowerCase();
    const numberPattern = /(?:marque|presione|press)\s*(\d+)/gi;
    let match;
    const options = [];
    
    while ((match = numberPattern.exec(lower)) !== null) {
      const number = match[1];
      const before = lower.substring(Math.max(0, match.index - 50), match.index);
      
      if (IVR_KEYWORDS.compras.some(k => before.includes(k))) {
        options.push({ number, priority: 1, type: 'compras' });
      } else if (IVR_KEYWORDS.ventas.some(k => before.includes(k))) {
        options.push({ number, priority: 2, type: 'ventas' });
      } else if (IVR_KEYWORDS.operadora.some(k => before.includes(k))) {
        options.push({ number, priority: 3, type: 'operadora' });
      }
    }

    if (options.length > 0) {
      options.sort((a, b) => a.priority - b.priority);
      console.log(`🎯 IVR: Marcar ${options[0].number} (${options[0].type})`);
      return { action: 'dtmf', digit: options[0].number };
    }
    return null;
  }

  extractData(text) {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      this.capturedData.email = emailMatch[0];
      console.log('📧 Email:', emailMatch[0]);
    }

    const phoneMatch = text.match(/(?:\+?52\s*)?(?:\d[\s.-]*){10,}/);
    if (phoneMatch) {
      this.capturedData.phone = phoneMatch[0].replace(/[^\d]/g, '');
      console.log('📞 Teléfono:', this.capturedData.phone);
    }
  }

  async saveToDatabase() {
    try {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      
      const { error } = await supabase
        .from('call_transcripts')
        .insert({
          call_sid: this.callSid,
          client_id: this.clientId,
          transcript: this.transcript,
          captured_data: this.capturedData,
          voicemail_detected: this.voicemailDetected,
          human_detected: this.humanDetected,
          duration_seconds: duration,
          status: this.voicemailDetected ? 'voicemail' : (this.humanDetected ? 'completed' : 'failed'),
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error guardando:', error);
      } else {
        console.log('✅ Guardado en BD');
      }
    } catch (err) {
      console.error('❌ Error:', err);
    }
  }
}

app.post('/incoming-call', async (req, res) => {
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const clientId = req.query.client_id || 'unknown';
  
  console.log('📞 Llamada entrante:', from);

  const response = new Twilio.twiml.VoiceResponse();
  const connect = response.connect();
  
  connect.stream({
    url: `wss://${req.headers.host}/media-stream?client_id=${clientId}`
  });

  res.type('text/xml');
  res.send(response.toString());
});

app.ws('/media-stream', async (ws, req) => {
  console.log('🔵 WebSocket conectado');
  
  const clientId = req.query.client_id || 'unknown';
  let callSid = null;
  let streamSid = null;
  let session = null;
  let openAiWs = null;

  let clientConfig = {};
  try {
    const { data } = await supabase
      .from('johnny_clients')
      .select('*')
      .eq('client_id', clientId)
      .single();

    if (data) {
      clientConfig = data.config || {};
      console.log(`✅ Config: ${clientConfig.company_name || clientId}`);
    }
  } catch (err) {
    console.error('⚠️ Error config:', err.message);
  }

  const openAiUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';
  
  openAiWs = new WebSocket(openAiUrl, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  openAiWs.on('open', () => {
    console.log('✅ OpenAI conectado');
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        turn_detection: { type: 'server_vad' },
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        voice: 'sage',
        instructions: buildSystemPrompt(clientConfig),
        modalities: ['text', 'audio'],
        temperature: 0.7,
      }
    };

    openAiWs.send(JSON.stringify(sessionConfig));
  });

  openAiWs.on('message', (data) => {
    try {
      const event = JSON.parse(data);

      if (event.type === 'response.audio.delta' && event.delta) {
        const audioPayload = {
          event: 'media',
          streamSid: streamSid,
          media: { payload: event.delta }
        };
        ws.send(JSON.stringify(audioPayload));
      }

      else if (event.type === 'response.audio_transcript.delta') {
        const text = event.delta || '';
        process.stdout.write(text);
        
        if (session) {
          if (text.includes('[VOICEMAIL_DETECTED]')) {
            console.log('\n📭 Comando: COLGAR');
            session.voicemailDetected = true;
            setTimeout(() => hangupCall(callSid), 500);
          }
          else if (text.includes('[DTMF:')) {
            const match = text.match(/\[DTMF:(\d+)\]/);
            if (match) {
              const digit = match[1];
              console.log(`\n🔢 Comando: DTMF ${digit}`);
              sendDtmf(callSid, digit);
              session.dtmfSent.push(digit);
            }
          }
          else if (text.includes('[HUMAN_DETECTED]')) {
            console.log('\n👨 Comando: PERSONA');
            session.humanDetected = true;
          }
        }
      }

      else if (event.type === 'response.audio_transcript.done') {
        const fullText = event.transcript || '';
        if (session && fullText) {
          session.addTranscript('agent', fullText);
          session.extractData(fullText);
        }
      }

      else if (event.type === 'conversation.item.input_audio_transcription.completed') {
        const text = event.transcript || '';
        console.log(`\n👤 Cliente: "${text}"`);
        
        if (session && text) {
          session.addTranscript('client', text);
          
          if (session.detectVoicemail(text)) {
            setTimeout(() => hangupCall(callSid), 1000);
            return;
          }

          session.detectHuman(text);

          const ivrAction = session.detectIvrOption(text);
          if (ivrAction && ivrAction.action === 'dtmf') {
            setTimeout(() => {
              sendDtmf(callSid, ivrAction.digit);
              session.dtmfSent.push(ivrAction.digit);
            }, 1000);
          }

          session.extractData(text);
        }
      }

    } catch (err) {
      console.error('⚠️ Error OpenAI:', err.message);
    }
  });

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);

      if (msg.event === 'start') {
        callSid = msg.start.callSid;
        streamSid = msg.start.streamSid;
        
        console.log('🎙️ Stream:', streamSid);

        session = new CallSession(callSid, streamSid, clientId, clientConfig);
        sessions.set(callSid, session);
      }

      else if (msg.event === 'media' && openAiWs && openAiWs.readyState === WebSocket.OPEN) {
        const audioAppend = {
          type: 'input_audio_buffer.append',
          audio: msg.media.payload
        };
        openAiWs.send(JSON.stringify(audioAppend));
      }

      else if (msg.event === 'stop') {
        console.log('🛑 Stream detenido');
        
        if (session) {
          console.log('📊 Duración:', Math.floor((Date.now() - session.startTime) / 1000), 's');
          console.log('📭 Buzón:', session.voicemailDetected);
          console.log('👨 Persona:', session.humanDetected);
          console.log('📧 Datos:', session.capturedData);

          await session.saveToDatabase();
          sessions.delete(callSid);
        }

        if (openAiWs) {
          openAiWs.close();
        }
      }

    } catch (err) {
      console.error('⚠️ Error Twilio:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket cerrado');
    if (session) {
      session.saveToDatabase();
    }
    if (openAiWs) {
      openAiWs.close();
    }
  });
});

async function sendDtmf(callSid, digits) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = new Twilio(accountSid, authToken);

    await client.calls(callSid).update({
      twiml: `<Response><Play digits="${digits}"/><Pause length="2"/></Response>`
    });

    console.log(`🔢 DTMF "${digits}" enviado`);
  } catch (err) {
    console.error('❌ Error DTMF:', err.message);
  }
}

async function hangupCall(callSid) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = new Twilio(accountSid, authToken);

    await client.calls(callSid).update({ status: 'completed' });
    console.log(`📴 Llamada colgada`);
  } catch (err) {
    console.error('❌ Error colgar:', err.message);
  }
}

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size
  });
});

app.listen(PORT, () => {
  console.log('🚀 VENDEDOR IA V2');
  console.log(`🌐 Puerto ${PORT}`);
  console.log('✅ Detección: buzón, IVR, persona');
});