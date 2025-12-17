# 🚀 INSTRUCCIONES DE USO - Johnny IA v2

## ✅ TODO ESTÁ LISTO

Todos los archivos han sido restaurados y configurados correctamente:

- ✅ `screens/VendedorScreen.js` - Pantalla principal con lista de clientes
- ✅ `screens/TestCallScreen.js` - Pantalla de llamadas de prueba
- ✅ `server.js` - Servidor local con API y WebSocket
- ✅ `supabaseClient.js` - Cliente de Supabase
- ✅ `App.js` - Navegación configurada
- ✅ `.env` - Credenciales configuradas
- ✅ `package.json` - Dependencias instaladas

---

## 📱 CÓMO USAR LA APLICACIÓN

### PASO 1: Iniciar el servidor local

Abre una terminal y ejecuta:

```bash
cd /home/user/johnny-ia-v2
node server.js
```

**Deberías ver:**
```
[OK] Supabase inicializado
[SERVER] Corriendo en http://192.168.3.27:3000
```

⚠️ **IMPORTANTE:** Deja esta terminal abierta mientras uses la app.

---

### PASO 2: Iniciar la app móvil

**Abre OTRA terminal** (deja la anterior corriendo) y ejecuta:

```bash
cd /home/user/johnny-ia-v2
npm start
```

**O si tienes Expo CLI:**
```bash
expo start
```

---

### PASO 3: Abrir en tu dispositivo

**Opción A - Dispositivo físico (Recomendado):**
1. Instala "Expo Go" desde Play Store o App Store
2. Escanea el código QR que aparece en la terminal
3. La app se abrirá automáticamente

**Opción B - Emulador:**
```bash
# En la terminal donde corre expo, presiona:
# 'a' para Android
# 'i' para iOS (solo Mac)
```

---

## 🎯 FLUJO DE LA APLICACIÓN

1. **Pantalla principal:** Verás "💼 Vendedor IA"
2. **Lista de clientes:** Carga desde `http://192.168.3.27:3000/api/get-clients`
3. **Tocar un cliente:** Muestra menú con:
   - 🧪 **Probar Vendedor** → Abre llamada de prueba
   - 📋 Ver Leads (pendiente)
   - 📊 Dashboard (pendiente)
4. **Llamada de prueba:** Conecta a Render vía Socket.IO
5. **Audio bidireccional:** OpenAI Realtime API

---

## 🔧 SI ALGO NO FUNCIONA

### Error: "Cannot find module"
```bash
npm install
```

### Error: "EADDRINUSE" (puerto en uso)
```bash
killall node
# Luego vuelve a ejecutar: node server.js
```

### VendedorScreen no carga clientes
1. Verifica que `server.js` esté corriendo
2. Verifica tu IP local:
```bash
hostname -I | awk '{print $1}'
```
3. Si tu IP es diferente a `192.168.3.27`, actualiza estas líneas:
   - `screens/VendedorScreen.js:24`
   - `screens/TestCallScreen.js:71`

### TestCallScreen no conecta
1. Verifica que Render esté activo: https://johnny-ia-v2.onrender.com
2. Verifica la API Key de OpenAI en `.env`

---

## 📊 ESTRUCTURA DEL CÓDIGO

```
johnny-ia-v2/
├── App.js                    # Navegación principal
├── screens/
│   ├── VendedorScreen.js    # Lista de clientes
│   └── TestCallScreen.js    # Llamadas de prueba
├── server.js                # Servidor local (API + WebSocket)
├── supabaseClient.js        # Cliente de Supabase
├── .env                     # Credenciales (NO SE COMMITEA)
└── vendedor-ia-mejorado.js  # Backend en Render
```

---

## 🎨 CARACTERÍSTICAS

### VendedorScreen (Pantalla Principal)
- ✅ Lista de clientes desde Supabase
- ✅ Pull-to-refresh
- ✅ Tarjetas con información del cliente
- ✅ Menú contextual por cliente
- ✅ Navegación a pruebas

### TestCallScreen (Llamadas de Prueba)
- ✅ Conexión Socket.IO con Render
- ✅ OpenAI Realtime API
- ✅ Grabación de audio bidireccional
- ✅ Transcripción en tiempo real
- ✅ Control de mute
- ✅ Temporizador de llamada
- ✅ Guardar conversaciones

### Server.js (Backend Local)
- ✅ Endpoints de API REST
- ✅ WebSocket para OpenAI
- ✅ Integración con Supabase
- ✅ Conversión de audio PCM16 a WAV
- ✅ Sistema de sesiones de prueba

---

## 🔐 VARIABLES DE ENTORNO (.env)

Tu archivo `.env` ya está configurado con:
- ✅ SUPABASE_URL
- ✅ SUPABASE_ANON_KEY
- ✅ OPENAI_API_KEY
- ✅ TWILIO_ACCOUNT_SID
- ✅ TWILIO_AUTH_TOKEN
- ✅ TWILIO_NUMBER
- ✅ SERPAPI_KEY
- ✅ VENDOR_SERVER_URL
- ✅ PORT

⚠️ El archivo `.env` está en `.gitignore` para proteger tus credenciales.

---

## 📞 SOPORTE

Si encuentras algún error:
1. Copia el mensaje de error completo
2. Verifica que todas las terminales estén corriendo
3. Revisa los logs en ambas terminales

---

## ✨ ¡LISTO PARA USAR!

Todo está configurado correctamente. Solo necesitas:
1. Ejecutar `node server.js`
2. Ejecutar `npm start` en otra terminal
3. Abrir la app en tu dispositivo

**¡Disfruta tu vendedor IA!** 🎉
