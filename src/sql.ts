import { empty, join, raw, Sql, ident, literal, Slot } from "./core.js";

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
   * スロットを表すクラスです。
   *
   * スロットは後から値を注入可能なプレースホルダーです。
   */
  export type Slot = import("./core.js").Slot;

  /**
   * 安全な SQL クエリーを構築するためのクラス型です。
   */
  export type Sql = import("./core.js").Sql;
}

/**
 * 新しい Slot インスタンスを作成します。
 *
 * @param name スロット名です。
 * @param defaultValue デフォルト値です。
 * @returns 作成された新しい Slot インスタンスです。
 */
function slot(name: string, defaultValue?: sql.Value): sql.Slot;

function slot(...args: [any]): sql.Slot {
  return new sql.Slot(...args);
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
     * Sql クラスです。
     */
    Sql,

    /**
     * 生の文字列を SQL 断片として扱うための関数です。
     */
    raw,

    /**
     *　新しい Slot インスタンスを作成する関数です。
     */
    slot,

    /**
     * スロットを表すクラスです。
     *
     * スロットは後から値を注入可能なプレースホルダーです。
     */
    Slot,

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

    /**
     * 文字列を安全にエスケープするための関数です。
     */
    literal,
  } as const,
);

export { sql };
