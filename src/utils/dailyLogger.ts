import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment-timezone';

class DailyLogger {
  private logsDir: string;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor() {
    // Forçar caminho baseado no arquivo server.js
    const projectRoot = path.resolve(__dirname, '..', '..');
    this.logsDir = path.join(projectRoot, 'logs');
    console.log(`📁 Diretório de logs: ${this.logsDir}`);
    console.log(`📁 process.cwd(): ${process.cwd()}`);
    console.log(`📁 __dirname: ${__dirname}`);
    this.ensureLogsDirectory();
    this.setupConsoleInterceptor();
    this.startCleanupRoutine();
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `console-${today}.log`);
  }

  private writeToFile(level: string, ...args: any[]): void {
    const timestamp = moment().tz('America/Sao_Paulo').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    try {
      fs.appendFileSync(this.getLogFileName(), logEntry);
    } catch (error) {
      // Fallback silencioso para não quebrar a aplicação
    }
  }

  private setupConsoleInterceptor(): void {
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;

    console.log = (...args: any[]) => {
      this.originalConsoleLog(...args);
      this.writeToFile('LOG', ...args);
    };

    console.error = (...args: any[]) => {
      this.originalConsoleError(...args);
      this.writeToFile('ERROR', ...args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsoleWarn(...args);
      this.writeToFile('WARN', ...args);
    };
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logsDir);
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      files.forEach(file => {
        if (file.startsWith('console-') && file.endsWith('.log')) {
          const filePath = path.join(this.logsDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < fiveDaysAgo) {
            fs.unlinkSync(filePath);
            console.log(`Log antigo removido: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('Erro na limpeza de logs:', error);
    }
  }

  private startCleanupRoutine(): void {
    // Executa limpeza a cada 24 horas
    setInterval(() => {
      this.cleanupOldLogs();
    }, 24 * 60 * 60 * 1000);

    // Executa limpeza inicial após 1 minuto
    setTimeout(() => {
      this.cleanupOldLogs();
    }, 60 * 1000);
  }
}

export const dailyLogger = new DailyLogger();