import { Platform } from 'react-native';

// Store original console methods IMMEDIATELY before any override
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
};

class RemoteLogger {
  constructor() {
    this.logs = [];
    this.serverUrl = 'https://johnny-ia-v2.onrender.com/api/client-logs';
    this.maxBatchSize = 15;
    this.flushInterval = 2000; // Enviar logs cada 2 segundos (más rápido)
    this.isEnabled = true;
    this.intervalId = null;
    this.isOverridden = false;

    this.deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
    };

    // Iniciar el envío periódico de logs
    this.startAutoFlush();

    // Sobrescribir console.log, console.error, console.warn
    this.overrideConsole();

    // Log inicial para confirmar que está funcionando
    originalConsole.log('[REMOTE LOGGER] ✅ Inicializado y activo');
  }

  overrideConsole() {
    if (this.isOverridden) return;

    try {
      console.log = (...args) => {
        originalConsole.log(...args);
        if (this.isEnabled) {
          try {
            this.addLog('log', args.map(a => String(a)).join(' '));
          } catch (err) {
            originalConsole.error('[REMOTE LOGGER] Error en addLog:', err);
          }
        }
      };

      console.error = (...args) => {
        originalConsole.error(...args);
        if (this.isEnabled) {
          try {
            this.addLog('error', args.map(a => String(a)).join(' '));
          } catch (err) {
            originalConsole.error('[REMOTE LOGGER] Error en addLog:', err);
          }
        }
      };

      console.warn = (...args) => {
        originalConsole.warn(...args);
        if (this.isEnabled) {
          try {
            this.addLog('warn', args.map(a => String(a)).join(' '));
          } catch (err) {
            originalConsole.error('[REMOTE LOGGER] Error en addLog:', err);
          }
        }
      };

      this.isOverridden = true;
      originalConsole.log('[REMOTE LOGGER] ✅ Console methods sobrescritos');
    } catch (error) {
      originalConsole.error('[REMOTE LOGGER] ❌ Error sobrescribiendo console:', error);
    }
  }

  addLog(level, message, data = null) {
    if (!this.isEnabled) return;

    this.logs.push({
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    });

    // Si alcanzamos el tamaño máximo del batch, enviar inmediatamente
    if (this.logs.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  startAutoFlush() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  async flush() {
    if (this.logs.length === 0) return;

    const logsToSend = [...this.logs];
    this.logs = []; // Limpiar el buffer

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout de 5s

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          deviceInfo: this.deviceInfo,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        originalConsole.warn('[REMOTE LOGGER] ⚠️ Response no OK:', response.status);
        // Si falla, restaurar los logs
        this.logs = [...logsToSend, ...this.logs];
      } else {
        // Success - logs enviados
        const result = await response.json();
        originalConsole.log('[REMOTE LOGGER] ✅ Enviados', result.received, 'logs');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        originalConsole.warn('[REMOTE LOGGER] ⏱️ Timeout enviando logs');
      } else {
        originalConsole.warn('[REMOTE LOGGER] ⚠️ Error enviando logs:', error.message);
      }
      // Si falla la conexión, restaurar los logs para reintentarlo después
      this.logs = [...logsToSend, ...this.logs];
      // Limitar el tamaño del buffer para no consumir demasiada memoria
      if (this.logs.length > 100) {
        originalConsole.warn('[REMOTE LOGGER] ⚠️ Buffer lleno, descartando logs antiguos');
        this.logs = this.logs.slice(-50); // Mantener solo los últimos 50
      }
    }
  }

  disable() {
    this.isEnabled = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  enable() {
    this.isEnabled = true;
    this.startAutoFlush();
  }

  async forceFlush() {
    await this.flush();
  }
}

// Crear una instancia única (singleton)
const remoteLogger = new RemoteLogger();

export default remoteLogger;
