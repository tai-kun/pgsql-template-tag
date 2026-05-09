import { empty, join, raw, Sql, ident, literal, Slot, RawValue, slot } from "./core.js";

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
   *
   * @template TName スロットの名前となる文字列リテラル型です。
   * @template TValue スロットに許容される値の型です。
   */
  export type Slot<
    TName extends string = string,
    TValue extends RawValue = RawValue,
  > = import("./core.js").Slot<TName, TValue>;

  /**
   * 安全な SQL クエリーを構築するためのクラス型です。
   *
   * @template TBindings クエリーに渡される生の値のタプル型です。
   */
  export type Sql<TBindings extends readonly RawValue[] = readonly RawValue[]> =
    import("./core.js").Sql<TBindings>;
}

/**
 * テンプレートリテラルを使用して SQL クエリーを安全に構築するためのタグ関数です。
 *
 * @template TBindings クエリーに渡される生の値のタプル型です。
 * @param strings テンプレートリテラルの静的な文字列部分の配列です。
 * @param bindings テンプレートリテラルに埋め込まれた動的な値の配列です。
 * @returns パラメーター化された SQL 情報を保持する Sql インスタンスを返します。
 * @example
 * ```typescript
 * const query = sql`SELECT * FROM users WHERE id = ${1}`;
 * ```
 */
const sql = /*#__PURE__*/ Object.assign(
  function sql<const TBindings extends readonly RawValue[]>(
    strings: TemplateStringsArray,
    ...bindings: TBindings
  ): sql.Sql<TBindings> {
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
