/**
 * SQL クエリー内で使用される値の型定義です。
 */
export type Value = unknown;

/**
 * SQL クエリーの構築に使用できる生の値、または別の Sql インスタンスを表す型です。
 */
// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type RawValue = Value | Sql;

/**
 * Sql クラスの内部状態を管理するためのプライベートな型定義です。
 */
type PrivateState = {
  /**
   * クエリーを構成する静的な文字列の配列です。
   */
  readonly s: readonly [string, ...string[]];

  /**
   * プレースホルダーに対応するインデックス（1 から始まる数値）の配列です。
   */
  readonly p: readonly number[];

  /**
   * キャッシュされた最終的なクエリーテキストです。
   */
  t?: string;
};

/**
 * 安全な SQL クエリーを構築するためのクラスです。
 * プレースホルダーを使用したパラメーター化クエリーを生成します。
 */
export class Sql {
  /**
   * 構築された SQL クエリーテキストを取得します。
   *
   * 初回アクセス時に文字列が結合され、結果はキャッシュされます。
   *
   * @returns SQL クエリーテキストを返します。
   */
  public get text(): string {
    // キャッシュが存在しない場合にのみ、文字列を構築します。
    if (this._.t === undefined) {
      let i = 0,
        text = this._.s[0];

      // 文字列の断片とプレースホルダー（$1, $2...）を交互に結合します。
      for (; i < this._.p.length; i++) {
        text += "$" + this._.p[i] + this._.s[i + 1];
      }

      this._.t = text;
    }

    return this._.t;
  }

  /**
   * クエリーに使用されるパラメーター値の配列です。
   */
  public readonly values: readonly Value[];

  /**
   * 内部状態を保持するためのプロパティーです。
   */
  private readonly _!: PrivateState;

  /**
   * 新しい Sql インスタンスを初期化します。
   *
   * @param rawStrings SQL の断片となる文字列の配列です。
   * @param rawBindings 文字列の間に挿入される値の配列です。
   */
  public constructor(rawStrings: readonly string[], rawBindings: readonly RawValue[]) {
    if (rawStrings.length === 0) {
      throw new TypeError("Expected at least 1 string");
    }

    if (rawStrings.length - 1 !== rawBindings.length) {
      throw new TypeError(
        `Expected ${rawStrings.length} strings to have ${rawStrings.length - 1} values`,
      );
    }

    const strings: [string, ...string[]] = [rawStrings[0]!];
    const bindings: Value[] = [];
    const placeholderIds: number[] = [];

    /** 値の重複を排除し、同じ値には同じプレースホルダー ID を割り当てるためのマップです。 */
    const valueToId = new Map<Value, number>();

    // 提供された全てのバインディング値を走査して、SQL 文字列と値を正規化します。
    for (let i = 0; i < rawBindings.length; i++) {
      const child = rawBindings[i];
      const rawString = rawStrings[i + 1]!;

      // バインディング値が Sql インスタンス（ネストされたクエリー）の場合の処理です。
      if (child instanceof Sql) {
        // 現在の最後の文字列断片に、ネストされた Sql の最初の断片を結合します。
        strings[strings.length - 1] += child._.s[0];

        // ネストされた Sql のプレースホルダーと値を再マッピングします。
        for (let j = 0; j < child._.p.length; j++) {
          const childPlaceholderId = child._.p[j]!;
          const value = child.values[childPlaceholderId - 1]!;

          let placeholderId = valueToId.get(value);
          if (placeholderId === undefined) {
            bindings.push(value);
            placeholderId = bindings.length;
            valueToId.set(value, placeholderId);
          }

          strings.push(child._.s[j + 1]!);
          placeholderIds.push(placeholderId);
        }

        // ネストされた Sql の展開が終わった後に、後続の生の文字列を結合します。
        strings[strings.length - 1] += rawString;
      } else {
        let placeholderId = valueToId.get(child);
        if (placeholderId === undefined) {
          bindings.push(child);
          placeholderId = bindings.length;
          valueToId.set(child, placeholderId);
        }

        strings.push(rawString);
        placeholderIds.push(placeholderId);
      }
    }

    this.values = bindings;

    // 内部状態を隠蔽し、不必要なプロパティーの露出を防ぎます。
    Object.defineProperty(this, "_", {
      value: {
        s: strings,
        p: placeholderIds,
      },
    });
  }

  /**
   * オブジェクトを JSON 形式に変換可能な形式で返します。
   *
   * @returns クエリーテキストと値の配列を含むオブジェクトを返します。
   */
  public toJSON(): {
    text: string;
    values: Value[];
  } {
    return {
      text: this.text,
      values: this.values.slice(),
    };
  }

  /**
   * インスタンスを文字列に変換します。
   *
   * @returns 構築された SQL クエリーテキストを返します。
   */
  public toString(): string {
    return this.text;
  }
}

/**
 * 生の文字列を SQL 断片として扱います。
 * この値はパラメーター化の対象にならず、そのままクエリーに含まれます。
 *
 * @param value SQL に含める生の文字列です。
 * @returns 指定された文字列を持つ Sql インスタンスを返します。
 */
export function raw(value: string): Sql {
  return new Sql([value], []);
}

/**
 * 空の SQL インスタンスを表す定数です。
 */
export const empty: Sql = raw("");

/**
 * 複数の SQL 断片や値を、指定されたセパレーターで結合します。
 *
 * 配列が空の場合は、{@link empty} を返します。
 *
 * @param values 結合対象となる値の配列です。
 * @param separator 結合時に挿入される文字列です。デフォルトはカンマ（,）です。
 * @returns 結合された新しい Sql インスタンスを返します。
 */
export function join(values: readonly RawValue[], separator: string | undefined = ","): Sql {
  if (values.length === 0) {
    return empty;
  }

  return new Sql(["", ...Array(values.length - 1).fill(separator), ""], values);
}

/**
 * 二重引用符をエスケープするための正規表現です。
 */
const DOUBLE_QUOTE_REGEX = /"/g;

/**
 * 文字列を SQL の識別子（テーブル名やカラム名など）として安全にエスケープします。
 *
 * 二重引用符を二重にすることでエスケープを行い、全体を二重引用符で囲みます。
 *
 * @param value エスケープする識別子の文字列です。
 * @returns エスケープ済みの識別子文字列を返します。
 */
export function ident(value: string): string {
  return '"' + value.replace(DOUBLE_QUOTE_REGEX, '""') + '"';
}
