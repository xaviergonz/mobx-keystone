export class DateBackedByProp extends Date {
  private _updateDate(method: string, superMethod: any, args: any[]): number {
    // work over a copy
    const date: any = new Date(this.getTime())
    date[method].apply(date, args)

    // update backed prop
    this._updateBackedProp(date)

    // if that succeeds apply over current date object
    return superMethod.apply(this, args)
  }

  constructor(value: string | number, private readonly _updateBackedProp: (date: Date) => void) {
    super(value)
  }

  // make mutable methods update the backed prop

  setTime(...args: any[]): any {
    return this._updateDate("setTime", super.setTime, args)
  }

  setMilliseconds(...args: any[]): any {
    return this._updateDate("setMilliseconds", super.setMilliseconds, args)
  }

  setUTCMilliseconds(...args: any[]): any {
    return this._updateDate("setUTCMilliseconds", super.setUTCMilliseconds, args)
  }

  setSeconds(...args: any[]): any {
    return this._updateDate("setSeconds", super.setSeconds, args)
  }

  setUTCSeconds(...args: any[]): any {
    return this._updateDate("setUTCSeconds", super.setUTCSeconds, args)
  }

  setMinutes(...args: any[]): any {
    return this._updateDate("setMinutes", super.setMinutes, args)
  }

  setUTCMinutes(...args: any[]): any {
    return this._updateDate("setUTCMinutes", super.setUTCMinutes, args)
  }

  setHours(...args: any[]): any {
    return this._updateDate("setHours", super.setHours, args)
  }

  setUTCHours(...args: any[]): any {
    return this._updateDate("setUTCHours", super.setUTCHours, args)
  }

  setDate(...args: any[]): any {
    return this._updateDate("setDate", super.setDate, args)
  }

  setUTCDate(...args: any[]): any {
    return this._updateDate("setUTCDate", super.setUTCDate, args)
  }

  setMonth(...args: any[]): any {
    return this._updateDate("setMonth", super.setMonth, args)
  }

  setUTCMonth(...args: any[]): any {
    return this._updateDate("setUTCMonth", super.setUTCMonth, args)
  }

  setFullYear(...args: any[]): any {
    return this._updateDate("setFullYear", super.setFullYear, args)
  }

  setUTCFullYear(...args: any[]): any {
    return this._updateDate("setUTCFullYear", super.setUTCFullYear, args)
  }
}
