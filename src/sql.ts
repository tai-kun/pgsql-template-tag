import { empty, join, raw, type RawValue, Sql } from "./core.js";

namespace sql {
  export type RawValue = import("./core.js").RawValue;

  export type Value = import("./core.js").Value;

  export type Sql = import("./core.js").Sql;
}

const sql = /*#__PURE__*/ Object.assign(
  function sql(strings: TemplateStringsArray, ...bindings: readonly RawValue[]): Sql {
    return new Sql(strings, bindings);
  },
  {
    Sql,
    raw,
    join,
    empty,
  } as const,
);

export { sql };
