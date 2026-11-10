declare module "sql.js" {
  export type Value = string | number | number[] | Uint8Array | null;
  export type RunResult = {
    lastInsertRowId: number;
    changes: number;
  };
  export type Statement = {
    run(params?: Value[]): RunResult;
    get(params?: Value[]): Record<string, unknown> | undefined;
    all(params?: Value[]): Record<string, unknown>[];
    free(): void;
  };
  export class Database {
    constructor(buffer?: Uint8Array);
    run(sql: string, params?: Value[]): RunResult;
    prepare(sql: string): Statement;
    get(sql: string, params?: Value[]): Record<string, unknown> | undefined;
    all(sql: string, params?: Value[]): Record<string, unknown>[];
    exec(sql: string): void;
    export(): Uint8Array;
    close(): void;
  }
  export function init(opts?: { locateFile?: (file: string) => string }): Promise<void>;
  export default Database;
}
