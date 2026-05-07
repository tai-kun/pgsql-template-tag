import { empty, join, raw, Sql, ident } from "./core.js";

namespace sql {
  /**
   * SQL クエリーの構築に使用できる生の値、または別の Sql インスタンスを表す型です。
   */
  export type RawValue = import("./core.js").RawValue;

  /**
   * SQL クエリー内で使用される値の型定義です。
   */
  export type Value = import("./core.js").Value;

  /**
   * 安全な SQL クエリーを構築するためのクラス型です。
   */
  export type Sql = import("./core.js").Sql;
}

/**
 * テンプレートリテラルを使用して SQL クエリーを安全に構築するためのタグ関数です。
 *
 * @param strings テンプレートリテラルの静的な文字列部分の配列です。
 * @param bindings テンプレートリテラルに埋め込まれた動的な値の配列です。
 * @returns パラメーター化された SQL 情報を保持する Sql インスタンスを返します。
 * @example
 * ```typescript
 * const query = sql`SELECT * FROM users WHERE id = ${1}`;
 * ```
 */
const sql = /*#__PURE__*/ Object.assign(
  function sql(strings: TemplateStringsArray, ...bindings: readonly sql.RawValue[]): sql.Sql {
    return new Sql(strings, bindings);
  },
  {
    /**
     * Sql クラス自体への参照です。
     */
    Sql,

    /**
     * 生の文字列を SQL 断片として扱うための関数です。
     */
    raw,

    /**
     * 複数の SQL 断片を結合するための関数です。
     */
    join,

    /**
     * 空の SQL クエリーを表す定数です。
     */
    empty,

    /**
     * 識別子（テーブル名等）を安全にエスケープするための関数です。
     */
    ident,
  } as const,
);

export { sql };
