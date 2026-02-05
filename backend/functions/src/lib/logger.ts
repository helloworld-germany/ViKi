import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static logDir = path.resolve(process.cwd(), '../../log');
    private static appLogPath = path.join(Logger.logDir, 'app.log');
    
    // Ensure log directory exists
    static {
        if (!fs.existsSync(Logger.logDir)) {
           // Try to create it if we have permissions, though locally it should exist
           try {
               fs.mkdirSync(Logger.logDir, { recursive: true });
           } catch (e) {
               // Fallback or ignore
           }
        }
    }

    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    public log(msg: string) {
        try {
            const entry = `${new Date().toISOString()} [${this.context}] ${msg}\n`;
            fs.appendFileSync(Logger.appLogPath, entry);
        } catch (e) {
            // Silently fail or console log if file write fails
            // console.error(`Failed to write to log: ${e}`);
        }
    }
}

export const logToApp = (context: string, msg: string) => {
    new Logger(context).log(msg);
};
