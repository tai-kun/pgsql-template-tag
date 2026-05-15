import { isPlainObject } from "es-toolkit/predicate";
import type { UnionToTuple } from "type-fest";

/**
 * SQL クエリー内で使用される値の型定義です。
 */
export type Value = unknown;

/**
 * SQL クエリーの構築に使用できる生の値、または別の Sql インスタンスを表す型です。
 */
// oxlint-disable-next-line typescript/no-redundant-type-constituents
export type RawValue = Value | Slot | Sql;

/**
 * Slot クラスを一意に識別するためのシンボルです。
 */
declare const SLOT_SYMBOL: unique symbol;

/**
 * Slot クラスの基底となる型定義です。
 */
const SlotTypes = class {} as {
  new (): {
    /**
     * このプロパティーは、TypeScript の `extends Slot` で `Slot` インスタンスのみに一致させるためにあります。そのため、`Slot` と同じプロパティーを持つオブジェクトに対して一致することはありません。
     */
    readonly ["~kind"]: typeof SLOT_SYMBOL;
  };
};

/**
 * スロットを表すクラスです。
 *
 * スロットは後から値を注入可能なプレースホルダーです。
 *
 * @template TName スロットの名前となる文字列リテラル型です。
 * @template TValue スロットに許容される値の型です。
 */
export class Slot<
  const TName extends string = string,
  TValue extends RawValue = RawValue,
> extends SlotTypes {
  /**
   * スロット名です。
   */
  public readonly name: TName;

  /**
   * デフォルト値です。
   */
  public readonly defaultValue: TValue;

  /**
   * 新しい Slot インスタンスを初期化します。
   *
   * @param name スロット名です。
   * @param defaultValue デフォルト値です。
   */
  public constructor(
    ...args: null extends TValue
      ? [name: TName, defaultValue?: TValue]
      : [name: TName, defaultValue: TValue]
  );

  public constructor(name: TName, defaultValue?: RawValue) {
    super();

    if (arguments.length < 2) {
      defaultValue = null;
    }

    this.name = name;
    this.defaultValue = defaultValue as TValue;
  }
}

/**
 * オブジェクトのバリューの型を抽出するヘルパー型です。
 *
 * @template T 対象となるオブジェクト型です。
 */
type $ValueOf<T> = T[keyof T];

/**
 * スロットの配列から、再帰的に値をマージして型を決定します。
 *
 * @template TSlots スロットのタプル型です。
 */
type $MergeSlotValue<TSlots> = TSlots extends [
  Slot<string, infer TValue>,
  infer TSlot,
  ...infer TOtherSlots,
]
  ? TValue & $MergeSlotValue<[TSlot, ...TOtherSlots]>
  : TSlots extends [Slot<string, infer TValue>]
    ? TValue
    : never;

type $ExtractSlot<TValues extends readonly RawValue[]> = TValues extends readonly [
  infer TValue,
  ...infer OterValues,
]
  ?
      | (TValue extends Slot
          ? TValue
          : TValue extends Sql<infer TValues>
            ? $ExtractSlot<TValues>
            : never)
      | $ExtractSlot<OterValues>
  : never;

/**
 * Value の配列からスロット情報を抽出し、名前ごとのマップ型に変換します。
 *
 * @template TValues Value の読み取り専用配列型です。
 */
type $MapSlotValue<TSlot extends Slot> = {
  // `Slot<"id", string | number> | Slot<"id", string>` の場合、`(string | number) & (string)` となるように、各スロットの積集合をとります。
  [TName in TSlot["name"]]: $MergeSlotValue<UnionToTuple<Extract<TSlot, Slot<TName>>>>;
};

/**
 * 指定された値のリストに対して、スロットを実際の内容で置き換えた型を生成します。
 *
 * @template TValues 置き換え対象の配列型です。
 * @template TSlots スロット名と値のマップ型です。
 */
type $FillSlots<TValues, TSlots> = TValues extends [infer TValue, ...infer TOtherValues]
  ? [
      TValue extends Slot<infer TName extends Extract<keyof TSlots, string>, infer TSlotValue>
        ? TSlotValue extends TSlots[TName]
          ? TSlotValue
          : TValue
        : TValue,
      ...$FillSlots<TOtherValues, TSlots>,
    ]
  : [];

/**
 * スロットを埋めるための部分的な引数型を定義します。
 *
 * @template TSlots スロット名と値のマップ型です。
 */
type _FillSlots<TSlots> =
  | {
      readonly [TName in Extract<keyof TSlots, string>]?: TSlots[TName];
    }
  | Iterable<
      readonly [
        name: $ValueOf<{
          [TName in Extract<keyof TSlots, string>]: TName | Slot<TName, TSlots[TName]>;
        }>,
        value: $ValueOf<TSlots>,
      ]
    >;

/**
 * すべてのスロットを埋めるために必要な引数型を定義します。
 *
 * @template TSlots スロット名と値のマップ型です。
 */
type _FillAllSlots<TSlots> = {
  readonly [TName in Extract<keyof TSlots, string>]: TSlots[TName];
};

/**
 * スロットの部分的な補完に使用する外部向けの型定義です。
 *
 * @template TValues RawValue の配列です。
 */
export type FillSlots<TValues extends readonly RawValue[] = readonly RawValue[]> = _FillSlots<
  $MapSlotValue<$ExtractSlot<TValues>>
>;

/**
 * すべてのスロットの強制的な補完に使用する外部向けの型定義です。
 *
 * @template TValues RawValue の配列です。
 */
export type FillAllSlots<TValues extends readonly RawValue[] = readonly RawValue[]> = _FillAllSlots<
  $MapSlotValue<$ExtractSlot<TValues>>
>;

/**
 * Sql クラスの内部状態を管理するためのプライベートな型定義です。
 */
type PrivateState = {
  /**
   * クエリーを構成する静的な文字列の配列です。
   */
  readonly parts: readonly [string, ...string[]];

  /**
   * プレースホルダーに対応するインデックス（1 から始まる数値）の配列です。
   */
  readonly phIds: readonly number[];

  /**
   * values のインデックス -> スロット情報 のマップです。
   */
  readonly idx2slot: ReadonlyMap<number, Slot>;

  /**
   * スロット名 -> values のインデックス のマップです。
   */
  readonly slot2idx: ReadonlyMap<string, ReadonlySet<number>>;
};

let internalUse = false;

/**
 * Sql クラスを一意に識別するためのシンボルです。
 */
declare const SQL_SYMBOL: unique symbol;

/**
 * Sql クラスの基底となる型定義です。
 */
const SqlTypes = class {} as {
  new (): {
    /**
     * このプロパティーは、TypeScript の `extends Sql` で `Sql` インスタンスのみに一致させるためにあります。そのため、`Sql` と同じプロパティーを持つオブジェクトに対して一致することはありません。
     */
    readonly ["~kind"]: typeof SQL_SYMBOL;
  };
};

/**
 * 安全な SQL クエリーを構築するためのクラスです。
 *
 * プレースホルダーを使用したパラメーター化クエリーを生成します。
 *
 * @template TRawBindings クエリーに渡される生の値のタプル型です。
 */
export class Sql<
  const TRawBindings extends readonly RawValue[] = readonly RawValue[],
> extends SqlTypes {
  /**
   * 内部変数を組み立てるためのビルダーを作成します。
   *
   * @param firstPart クエリーの最初のパートです。
   * @returns 内部変数を組み立てるためのビルダーです。
   */
  static #builder(firstPart: string) {
    return {
      /**
       * クエリーを構成する静的な文字列の配列です。
       */
      _parts: [firstPart] as [string, ...string[]],

      /**
       * プレースホルダーに対応するインデックス（1 から始まる数値）の配列です。
       */
      _phIds: [] as number[],

      /**
       * バインドされる値の配列です。
       */
      _values: [] as Value[],

      /**
       * values のインデックス -> スロット情報 のマップです。
       */
      _idx2slot: new Map<number, Slot>(),

      /**
       * スロット名 -> values のインデックス のマップです。
       */
      _slot2idx: new Map<string, Set<number>>(),

      /**
       * 値の重複を排除し、同じ値には同じプレースホルダー ID を割り当てるためのマップです。
       */
      _value2id: new Map<Value, number>(),

      /**
       * SQL クエリーに値とパートをバインドします。
       *
       * @param binding 値です。
       * @param part パートです。
       */
      bind(binding: Value, part: string): void {
        // バインディング値が Sql インスタンス（ネストされたクエリー）の場合の処理です。
        if (binding instanceof Sql) {
          const state = binding.#state;
          // 現在の最後の文字列断片に、ネストされた Sql の最初の断片を結合します。
          this._parts[this._parts.length - 1] += state.parts[0];

          // ネストされた Sql のプレースホルダーと値を再マッピングします。
          for (let j = 0; j < state.phIds.length; j++) {
            const part = state.parts[j + 1]!;

            const bindingPlaceholderId = state.phIds[j]!;
            const valueIndex = bindingPlaceholderId - 1;
            const value = binding.values[valueIndex]!;

            const placeholderId = this._register(value);

            this._parts.push(part);
            this._phIds.push(placeholderId);
          }

          // ネストされた Sql の展開が終わった後に、後続の生の文字列を結合します。
          this._parts[this._parts.length - 1] += part;
        } else {
          const placeholderId = this._register(binding);

          this._parts.push(part);
          this._phIds.push(placeholderId);
        }
      },

      build(): {
        text: string;
        state: PrivateState;
        values: readonly Value[];
      } {
        // 文字列の断片とプレースホルダー（$1, $2...）を交互に結合します。
        let text = this._parts[0];
        for (let i = 0; i < this._phIds.length; i++) {
          text += "$" + this._phIds[i] + this._parts[i + 1];
        }

        return {
          text,
          state: {
            parts: this._parts,
            phIds: this._phIds,
            idx2slot: this._idx2slot,
            slot2idx: this._slot2idx,
          },
          values: this._values,
        };
      },

      /**
       * 値またはスロットをレジストリーに登録します。
       *
       * @param value 登録する値です。
       * @returns 割り当てられたプレースホルダー ID（1 始まり）を返します。
       */
      _register(value: Value): number {
        if (value instanceof Slot) {
          return this._registerSlot(value);
        } else {
          return this._registerValue(value);
        }
      },

      /**
       * スロットをレジストリーに登録します。
       *
       * @param slot 登録するスロットです。
       * @returns 割り当てられたプレースホルダー ID を返します。
       */
      _registerSlot(slot: Slot): number {
        let placeholderId = this._value2id.get(slot);
        if (placeholderId === undefined) {
          placeholderId = this._values.push(slot.defaultValue);
          this._value2id.set(slot, placeholderId);

          const idx = placeholderId - 1;
          this._idx2slot.set(idx, slot);
          const idxes =
            // TODO(tai-kun): this._slot2idx.getOrInsert(slot.name, new Set())
            this._slot2idx.get(slot.name) ||
            this._slot2idx.set(slot.name, new Set()).get(slot.name)!;
          idxes.add(idx);
        }

        return placeholderId;
      },

      /**
       * 生の値をレジストリーに登録します。
       *
       * @param value 登録する値です。
       * @returns 割り当てられたプレースホルダー ID を返します。
       */
      _registerValue(value: Value): number {
        let placeholderId = this._value2id.get(value);
        if (placeholderId === undefined) {
          placeholderId = this._values.push(value);
          this._value2id.set(value, placeholderId);
        }

        return placeholderId;
      },
    };
  }

  /**
   * 内部状態を保持するためのプロパティーです。
   */
  readonly #state: PrivateState;

  /**
   * 構築された SQL クエリーテキストです。
   */
  public readonly text: string;

  /**
   * クエリーに使用されるパラメーター値の配列です。
   */
  public readonly values: readonly Value[];

  /**
   * 新しい Sql インスタンスを初期化します。
   *
   * @param rawStrings SQL の断片となる文字列の配列です。
   * @param rawBindings 文字列の間に挿入される値の配列です。
   */
  public constructor(rawStrings: readonly string[], rawBindings: TRawBindings) {
    super();

    if (internalUse) {
      this.text = arguments[0] as string;
      this.values = arguments[1] as Value[];
      this.#state = arguments[2] as PrivateState;
      return;
    }

    if (rawStrings.length === 0) {
      throw new TypeError("Expected at least 1 string");
    }

    if (rawStrings.length - 1 !== rawBindings.length) {
      throw new TypeError(
        `Expected ${rawStrings.length} strings to have ${rawStrings.length - 1} values`,
      );
    }

    // 提供された全てのバインディング値を走査して、SQL 文字列と値を正規化します。
    const builder = Sql.#builder(rawStrings[0]!);
    for (let i = 0; i < rawBindings.length; i++) {
      const binding = rawBindings[i];

      const part = rawStrings[i + 1]!;

      builder.bind(binding, part);
    }

    const { text, state, values } = builder.build();
    this.text = text;
    this.values = values;
    this.#state = state;
  }

  /**
   * スロットを値で埋める内部メソッドです。
   *
   * @param slots スロットのマップまたはエントリーの配列です。
   * @param all 全てのスロットが埋まっているかチェックするかどうかです。
   * @returns 新しい Sql インスタンスを返します。
   */
  #fill(slots: any, all: boolean): Sql {
    if (isPlainObject(slots)) {
      slots = Object.entries(slots);
    } else {
      // 一旦 Map のインスタンスにすることで、重複する名前またはスロットを 1 つに絞ります。
      slots = new Map(slots);
    }

    const state = this.#state;
    const filled = new Set<number>();
    const values = this.values.slice();

    // 指定された値を走査し、対応するインデックスの値を置換します。
    for (const [target, value] of slots) {
      let idxes: ReadonlySet<number> | undefined;
      if (typeof target === "string") {
        idxes = state.slot2idx.get(target);
      } else {
        // インスタンスが直接指定された場合、全インデックスから一致するものを探します。
        for (const [idx, slot] of state.idx2slot) {
          if (slot === target) {
            idxes ||= new Set();
            (idxes as Set<number>).add(idx);
          }
        }
      }

      if (idxes !== undefined) {
        // 該当するすべてのプレースホルダーインデックスを新しい値で更新します。
        for (const idx of idxes) {
          values[idx] = value;
          filled.add(idx);
        }
      }
    }

    // 全て埋める必要がある場合、未解決のスロットが残っていないか検証します。
    if (all) {
      for (let idx = 0; idx < values.length; idx++) {
        if (state.idx2slot.has(idx) && !filled.has(idx)) {
          const missingSlots = new Set<string>();
          missingSlots.add(state.idx2slot.get(idx)!.name);
          for (; idx < values.length; idx++) {
            if (state.idx2slot.has(idx)) {
              missingSlots.add(state.idx2slot.get(idx)!.name);
            }
          }

          throw new Error(`Not all slots are filled. Missing: ${[...missingSlots].join(", ")}`);
        }
      }
    }

    // 提供された全てのバインディング値を走査して、SQL 文字列と値を正規化します。
    const builder = Sql.#builder(state.parts[0]);
    for (let i = 0; i < state.phIds.length; i++) {
      const placeholderId = state.phIds[i]!;
      const valueIndex = placeholderId - 1;
      const binding = values[valueIndex];

      const part = state.parts[i + 1]!;

      builder.bind(binding, part);
    }

    internalUse = true;
    try {
      const { text, state, values } = builder.build();
      // @ts-expect-error: プライベートな呼び出しのため型チェックを抑制します。
      return new Sql(text, values, state);
    } finally {
      internalUse = false;
    }
  }

  /**
   * スロットを値で埋めます。
   *
   * @template TSlots 指定されたスロットのマップ型です。
   * @param slots スロットの値です。
   * @returns スロットが埋められた新しい Sql インスタンスです。
   */
  public fill<TSlots extends FillSlots<TRawBindings>>(
    slots: TSlots,
  ): Sql<$FillSlots<TRawBindings, TSlots>> {
    return this.#fill(slots, false);
  }

  /**
   * すべてのスロットを値で埋めます。
   *
   * @template TSlots 全てのスロットをカバーするマップ型です。
   * @param slots スロットの値です。
   * @returns スロットが埋められた新しい Sql インスタンスです。
   */
  public fillAll<TSlots extends FillAllSlots<TRawBindings>>(
    slots: TSlots,
  ): Sql<$FillSlots<TRawBindings, TSlots>> {
    return this.#fill(slots, true);
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
  public override toString(): string {
    return this.text;
  }
}

/**
 * 生の文字列を SQL 断片として扱います。
 *
 * この値はパラメーター化の対象にならず、そのままクエリーに含まれます。
 *
 * @param value SQL に含める生の文字列です。
 * @returns 指定された文字列を持つ Sql インスタンスを返します。
 */
export function raw(value: string): Sql<[]> {
  return new Sql([value], []);
}

/**
 * 空の SQL インスタンスを表す定数です。
 */
export const empty: Sql<[]> = raw("");

/**
 * 複数の SQL 断片や値を、指定されたセパレーターで結合します。
 *
 * 配列が空の場合は、{@link empty} を返します。
 *
 * @param values 結合対象となる値の配列です。
 * @param separator 結合時に挿入される文字列です。デフォルトはカンマ（,）です。
 * @returns 結合された新しい Sql インスタンスを返します。
 */
export function join<const TValues extends readonly RawValue[]>(
  values: TValues,
  separator: string | undefined = ",",
): Sql<TValues> {
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
 * @param value エスケープする識別子の文字列です。
 * @returns エスケープ済みの識別子文字列を返します。
 */
export function escapeIdent(value: string): string {
  return value.replace(DOUBLE_QUOTE_REGEX, '""');
}

/**
 * 文字列を SQL の識別子（テーブル名やカラム名など）として安全にエスケープします。
 *
 * 二重引用符を二重にすることでエスケープを行い、全体を二重引用符で囲みます。
 *
 * @param value エスケープする識別子の文字列です。
 * @returns エスケープ済みの識別子文字列を返します。
 */
export function ident(value: string): `"${string}"` {
  return `"${escapeIdent(value)}"`;
}

/**
 * 一重引用符をエスケープするための正規表現です。
 */
const SINGLE_QUOTE_REGEX = /'/g;

/**
 * 文字列を SQL のリテラル文字列として安全にエスケープします。
 *
 * @param value エスケープする文字列です。
 * @returns エスケープ済みのリテラル文字列を返します。
 */
export function escapeLiteral(value: string): string {
  return value.replace(SINGLE_QUOTE_REGEX, "''");
}

/**
 * 文字列を SQL のリテラル文字列として安全にエスケープします。
 *
 * 一重引用符を二重にすることでエスケープを行い、全体を一重引用符で囲みます。
 *
 * @param value エスケープする文字列です。
 * @returns エスケープ済みのリテラル文字列を返します。
 */
export function literal(value: string): `'${string}'` {
  return `'${escapeLiteral(value)}'`;
}

/**
 * 新しい Slot インスタンスを作成します。
 *
 * @template TName スロットの名前となる文字列リテラル型です。
 * @template TValue スロットに許容される値の型です。
 * @param name スロット名です。
 * @param defaultValue デフォルト値です。
 * @returns 作成された新しい Slot インスタンスです。
 */
export function slot<const TName extends string, TValue extends RawValue = RawValue>(
  name: TName,
  defaultValue?: TValue,
): Slot<TName, TValue>;

export function slot(...args: [any]): Slot {
  return new Slot(...args);
}
