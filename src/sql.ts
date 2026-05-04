import { empty, join, raw, Sql, ident } from "./core.js";

namespace sql {
  export type RawValue = import("./core.js").RawValue;

  export type Value = import("./core.js").Value;

  export type Sql = import("./core.js").Sql;
}

const sql = /*#__PURE__*/ Object.assign(
  function sql(strings: TemplateStringsArray, ...bindings: readonly sql.RawValue[]): sql.Sql {
    return new Sql(strings, bindings);
  },
  {
    Sql,
    raw,
    join,
    empty,
    ident,
  } as const,
);

export { sql };
