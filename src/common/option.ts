export class Option<T> {
  private constructor(
    public readonly isSome: boolean,
    private readonly value?: T
  ) {}

  static some<T>(value: T): Option<T> {
    return new Option<T>(true, value);
  }

  static none<T>(): Option<T> {
    return new Option<T>(false, undefined);
  }

  unwrap(): T {
    if (this.isSome) {
      return this.value as T;
    } else {
      throw new Error("Tried to unwrap a None Option");
    }
  }

  unwrapOr(defaultValue: T): T {
    return this.isSome ? (this.value as T) : defaultValue;
  }

  unwrapOrElse(fn: () => T): T {
    return this.isSome ? (this.value as T) : fn();
  }

  map<U>(fn: (value: T) => U): Option<U> {
    if (this.isSome) {
      return Option.some(fn(this.value as T));
    } else {
      return Option.none<U>();
    }
  }

  flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    if (this.isSome) {
      return fn(this.value as T);
    } else {
      return Option.none<U>();
    }
  }

  filter(predicate: (value: T) => boolean): Option<T> {
    if (this.isSome && predicate(this.value as T)) {
      return this;
    } else {
      return Option.none<T>();
    }
  }

  async filterAsync(
    predicate: (value: T) => Promise<boolean>
  ): Promise<Option<T>> {
    if (this.isSome && (await predicate(this.value as T))) {
      return this;
    } else {
      return Option.none<T>();
    }
  }

  match<U>(onSome: (value: T) => U, onNone: () => U): U {
    if (this.isSome) {
      return onSome(this.value as T);
    } else {
      return onNone();
    }
  }

  get isNone(): boolean {
    return !this.isSome;
  }

  ok(): T | undefined {
    return this.isSome ? this.value : undefined;
  }

  and<U>(other: Option<U>): Option<U> {
    return this.isSome ? other : Option.none<U>();
  }

  or(other: Option<T>): Option<T> {
    return this.isSome ? this : other;
  }

  zip<U>(other: Option<U>): Option<[T, U]> {
    if (this.isSome && other.isSome) {
      return Option.some([this.value as T, other.unwrap()]);
    } else {
      return Option.none<[T, U]>();
    }
  }

  static fromNullable<T>(value: T | null | undefined): Option<T> {
    return value !== null && value !== undefined
      ? Option.some(value)
      : Option.none<T>();
  }

  static fromThrowable<T>(fn: () => T): Option<T> {
    try {
      return Option.some(fn());
    } catch {
      return Option.none<T>();
    }
  }

  async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<Option<U>> {
    if (this.isSome) {
      return Option.some(await fn(this.value as T));
    } else {
      return Option.none<U>();
    }
  }

  async flatMapAsync<U>(
    fn: (value: T) => Promise<Option<U>>
  ): Promise<Option<U>> {
    if (this.isSome) {
      return await fn(this.value as T);
    } else {
      return Option.none<U>();
    }
  }

  async matchAsync<U>(
    onSome: (value: T) => Promise<U>,
    onNone: () => Promise<U>
  ): Promise<U> {
    if (this.isSome) {
      return await onSome(this.value as T);
    } else {
      return await onNone();
    }
  }
}
