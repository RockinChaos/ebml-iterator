export default class Tools {
  static readVint(buffer, start = 0) {
    const length = 8 - Math.floor(Math.log2(buffer[start]))
    if (length > 8) {
      if (length === Infinity) throw new Error(`Unrepresentable length: ${length}`)
      const number = Tools.readHexString(buffer, start, start + length)
      throw new Error(`Unrepresentable length: ${length} ${number}`)
    }
    if (isNaN(length) || start + length > buffer.length) {
      return null
    }
    const mask = (1 << (8 - length)) - 1
    if ((buffer[start] & mask) === mask && buffer.subarray(start + 1, start + length).every(i => i === 0xff)) {
      return {
        length,
        value: -1
      }
    }
    let value = buffer[start] & mask
    for (let i = 1; i < length; i += 1) {
      value *= Math.pow(2, 8)
      value += buffer[start + i]
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Unrepresentable VINT value: ${Tools.readHexString(buffer, start, start + length)}`)
    }
    return {
      length,
      value
    }
  }

  static writeVint(value, desiredLength) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Unrepresentable value: ${value}`)
    }
    let length = desiredLength
    if (length && (!Number.isInteger(length) || length < 1 || length > 8)) {
      throw new Error(`Invalid VINT length: ${length}`)
    }
    if (!length) {
      for (length = 1; length <= 8; length += 1) {
        if (value < Math.pow(2, (7 * length)) - 1) {
          break
        }
      }
    }
    if (value >= Math.pow(2, (7 * length)) - 1) {
      throw new Error(`Value ${value} cannot be represented in a ${length}-byte VINT`)
    }
    const buffer = Buffer.alloc(length)
    let val = value
    for (let i = 1; i <= length; i += 1) {
      const b = val & 0xff
      buffer[length - i] = b
      val -= b
      val /= Math.pow(2, 8)
    }
    buffer[0] |= 1 << (8 - length)
    return buffer
  }

  static padStart(val) {
    if (val.length === 0) {
      return '00'
    }
    if (val.length === 1) {
      return '0' + val
    }
    return val
  }

  static readHexString(buff, start = 0, end = buff.byteLength) {
    return Array.from(buff.subarray(start, end))
      .map(q => Number(q).toString(16))
      .reduce((acc, current) => `${acc}${this.padStart(current)}`, '')
  }

  static readUtf8(buff) {
    return Buffer.from(buff.buffer, buff.byteOffset, buff.byteLength).toString('utf8')
  }

  static readUnsigned(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
    switch (buff.byteLength) {
      case 1:
        return b.getUint8(0)
      case 2:
        return b.getUint16(0)
      case 4:
        return b.getUint32(0)
      default:
        break
    }
    if (buff.byteLength <= 6) {
      return buff.reduce((acc, current) => acc * 256 + current, 0)
    }
    const hex = Tools.readHexString(buff, 0, buff.byteLength)
    const num = parseInt(hex, 16)
    if (num <= Math.pow(256, 6)) {
      return num
    }
    return hex
  }

  static writeUnsigned(num, desiredLength) {
    if (typeof num === 'string') {
      const buffer = Buffer.from(num, 'hex')
      if (desiredLength && buffer.length !== desiredLength) {
        throw new Error(`Unsigned value does not fit in ${desiredLength} bytes`)
      }
      return buffer
    } else {
      if (!Number.isSafeInteger(num) || num < 0) {
        throw new Error(`Unrepresentable unsigned value: ${num}`)
      }
      let length = desiredLength
      if (length) {
        if (!Number.isInteger(length) || length < 1 || length > 6 || num >= Math.pow(2, 8 * length)) {
          throw new Error(`Unsigned value does not fit in ${length} bytes`)
        }
      } else {
        length = 1
        while (num >= Math.pow(2, 8 * length) && length < 6) length += 1
        if (num >= Math.pow(2, 8 * length)) throw new Error(`Unrepresentable unsigned value: ${num}`)
      }
      const buffer = Buffer.alloc(length)
      buffer.writeUIntBE(num, 0, length)
      return buffer
    }
  }

  static readSigned(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
    switch (buff.byteLength) {
      case 1:
        return b.getInt8(0)
      case 2:
        return b.getInt16(0)
      case 4:
        return b.getInt32(0)
      default:
        return NaN
    }
  }

  static writeSigned(num, desiredLength) {
    if (!Number.isSafeInteger(num)) {
      throw new Error(`Unrepresentable signed value: ${num}`)
    }
    if (desiredLength) {
      if (!Number.isInteger(desiredLength) || desiredLength < 1 || desiredLength > 6) {
        throw new Error(`Invalid signed integer length: ${desiredLength}`)
      }
      const minimum = -Math.pow(2, (8 * desiredLength) - 1)
      const maximum = Math.pow(2, (8 * desiredLength) - 1) - 1
      if (num < minimum || num > maximum) {
        throw new Error(`Signed value does not fit in ${desiredLength} bytes`)
      }
      const buffer = Buffer.alloc(desiredLength)
      buffer.writeIntBE(num, 0, desiredLength)
      return buffer
    }
    if (num >= -0x80 && num <= 0x7f) {
      const buf = Buffer.alloc(1)
      buf.writeInt8(num)
      return buf
    }
    if (num >= -0x8000 && num <= 0x7fff) {
      const buf = Buffer.alloc(2)
      buf.writeInt16BE(num)
      return buf
    }
    const buf = Buffer.alloc(4)
    buf.writeInt32BE(num)
    return buf
  }

  static readFloat(buff) {
    const b = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
    switch (buff.byteLength) {
      case 4:
        return b.getFloat32(0)
      case 8:
        return b.getFloat64(0)
      default:
        return NaN
    }
  }

  static writeFloat(num, desiredLength) {
    if (desiredLength === 4) {
      const buffer = Buffer.alloc(4)
      buffer.writeFloatBE(num, 0)
      return buffer
    }
    if (desiredLength === 8) {
      const buffer = Buffer.alloc(8)
      buffer.writeDoubleBE(num, 0)
      return buffer
    }
    if (desiredLength) throw new Error(`Invalid float length: ${desiredLength}`)
    const float32 = Buffer.alloc(4)
    float32.writeFloatBE(num, 0)
    if (Object.is(float32.readFloatBE(0), num)) return float32

    const float64 = Buffer.alloc(8)
    float64.writeDoubleBE(num, 0)
    return float64
  }
}