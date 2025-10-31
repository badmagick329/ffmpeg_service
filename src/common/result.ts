export class Result<T, E> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly value?: T,
    public readonly error?: E
  ) {}
  static success<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }
  static failure<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  unwrap(): T {
    if (this.isSuccess) {
      return this.value as T;
    } else {
      throw new Error("Tried to unwrap a failure Result");
    }
  }

  unwrapError(): E {
    if (!this.isSuccess) {
      return this.error as E;
    } else {
      throw new Error("Tried to unwrapError a success Result");
    }
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isSuccess) {
      return Result.success(fn(this.value as T));
    } else {
      return Result.failure(this.error as E);
    }
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this.isSuccess) {
      return Result.success(this.value as T);
    } else {
      return Result.failure(fn(this.error as E));
    }
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isSuccess) {
      return fn(this.value as T);
    } else {
      return Result.failure(this.error as E);
    }
  }

  match<U>(onSuccess: (value: T) => U, onFailure: (error: E) => U): U {
    if (this.isSuccess) {
      return onSuccess(this.value as T);
    } else {
      return onFailure(this.error as E);
    }
  }

  unwrapOr(defaultValue: T): T {
    if (this.isSuccess) {
      return this.value as T;
    } else {
      return defaultValue;
    }
  }

  get isFailure(): boolean {
    return !this.isSuccess;
  }

  ok(): T | undefined {
    return this.isSuccess ? this.value : undefined;
  }

  err(): E | undefined {
    return this.isSuccess ? undefined : this.error;
  }

  and<U>(other: Result<U, E>): Result<U, E> {
    return this.isSuccess ? other : Result.failure(this.error as E);
  }

  or(other: Result<T, E>): Result<T, E> {
    return this.isSuccess ? this : other;
  }

  static fromThrowable<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.success(fn());
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  static async fromThrowableAsync<T>(
    fn: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      return Result.success(await fn());
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<Result<U, E>> {
    if (this.isSuccess) {
      return Result.success(await fn(this.value as T));
    } else {
      return Result.failure(this.error as E);
    }
  }

  async flatMapAsync<U>(
    fn: (value: T) => Promise<Result<U, E>>
  ): Promise<Result<U, E>> {
    if (this.isSuccess) {
      return await fn(this.value as T);
    } else {
      return Result.failure(this.error as E);
    }
  }

  async matchAsync<U>(
    onSuccess: (value: T) => Promise<U>,
    onFailure: (error: E) => Promise<U>
  ): Promise<U> {
    if (this.isSuccess) {
      return await onSuccess(this.value as T);
    } else {
      return await onFailure(this.error as E);
    }
  }
}
