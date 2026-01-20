import { Platform } from 'react-native';

class RemoteLogger {
  constructor() {
    this.logs = [];
    this.serverUrl = 'https://johnny-ia-v2.onrender.com/api/client-logs';
    this.maxBatchSize = 20;
    this.flushInterval = 3000; // Enviar logs cada 3 segundos
    this.isEnabled = true;
    this.intervalId = null;

    this.deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
    };

    // Iniciar el envío periódico de logs
    this.startAutoFlush();

    // Sobrescribir console.log, console.error, console.warn
    this.overrideConsole();
  }

  overrideConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      if (this.isEnabled) {
        this.addLog('log', args.join(' '));
      }
    };

    console.error = (...args) => {
      originalError(...args);
      if (this.isEnabled) {
        this.addLog('error', args.join(' '));
      }
    };

    console.warn = (...args) => {
      originalWarn(...args);
      if (this.isEnabled) {
        this.addLog('warn', args.join(' '));
      }
    };
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
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          deviceInfo: this.deviceInfo,
        }),
      });

      if (!response.ok) {
        // Si falla, restaurar los logs
        this.logs = [...logsToSend, ...this.logs];
      }
    } catch (error) {
      // Si falla la conexión, restaurar los logs para reintentarlo después
      this.logs = [...logsToSend, ...this.logs];
      // Limitar el tamaño del buffer para no consumir demasiada memoria
      if (this.logs.length > 100) {
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
