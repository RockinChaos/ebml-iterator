import EbmlTag from '../EbmlTag.js'
import EbmlElementType from '../enums/EbmlElementType.js'
import Tools from '../../tools.js'
import EbmlTagPosition from '../enums/EbmlTagPosition.js'

export default class EbmlDataTag extends EbmlTag {
  constructor(id, type) {
    super(id, type, EbmlTagPosition.Content)
  }

  parseContent(data) {
    switch (this.type) {
      case EbmlElementType.UnsignedInt:
        this.data = Tools.readUnsigned(data)
        break
      case EbmlElementType.Float:
        this.data = Tools.readFloat(data)
        break
      case EbmlElementType.Integer:
        this.data = Tools.readSigned(data)
        break
      case EbmlElementType.String:
        this.data = String.fromCharCode(...data)
        break
      case EbmlElementType.UTF8:
        this.data = Tools.readUtf8(data)
        break
      default:
        this.data = data
        break
    }
  }

  encodeContent() {
    switch (this.type) {
      case EbmlElementType.UnsignedInt:
        return Tools.writeUnsigned(this.data, this.size)
      case EbmlElementType.Float:
        return Tools.writeFloat(this.data, this.size)
      case EbmlElementType.Integer:
        return Tools.writeSigned(this.data, this.size)
      case EbmlElementType.String:
        return Buffer.from(this.data, 'ascii')
      case EbmlElementType.UTF8:
        return Buffer.from(this.data, 'utf8')
      case EbmlElementType.Binary:
      default:
        return this.data
    }
  }
}