export const logger = {
  info: (msg: string, ...args: unknown[]): void =>
    console.log(`[INFO] ${new Date().toISOString()} ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]): void =>
    console.warn(`[WARN] ${new Date().toISOString()} ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]): void =>
    console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]): void => {
    if (process.env.DEBUG === "true") {
      console.log(`[DEBUG] ${new Date().toISOString()} ${msg}`, ...args);
    }
  },
};
