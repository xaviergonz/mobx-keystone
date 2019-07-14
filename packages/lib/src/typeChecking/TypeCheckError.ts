/**
 * A type checking error.
 */
export class TypeCheckError {
  /**
   * Creates an instance of TypeError.
   * @param path Path where the error occured.
   * @param expectedTypeName Name of the expected type.
   * @param actualValue Actual value.
   */
  constructor(
    readonly path: ReadonlyArray<string | number>,
    readonly expectedTypeName: string,
    readonly actualValue: any
  ) {}
}
