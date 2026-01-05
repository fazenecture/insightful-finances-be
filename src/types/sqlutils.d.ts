// types/sqlutils.d.ts
declare module "sqlutils/pg" {
  export const format: (query: string, params: any[]) => string;
  export const buildWhereFromQuery: (...args: any[]) => any;
  export const transformer: (...args: any[]) => any;
}
