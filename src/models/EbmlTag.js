import EbmlTagId from './enums/EbmlTagId.js'
import Tools from '../tools.js'

export default class EbmlTag {
  constructor(id, type, position) {
    this.id = id
    this.type = type
    this.position = position
  }

  getTagDeclaration() {
    let tagHex = this.id.toString(16)
    if (tagHex.length % 2 !== 0) {
      tagHex = `0${tagHex}`
    }
    return Buffer.from(tagHex, 'hex')
  }

  encode() {
    let vintSize = null
    const content = this.encodeContent()
    if (this.size === -1) {
      vintSize = Buffer.from('01ffffffffffffff', 'hex')
    } else {
      let specialLength = this.sizeLength
      if ([
        EbmlTagId.Segment,
        EbmlTagId.Cluster
      ].some(i => i === this.id) && !specialLength) {
        specialLength = 8
      }
      if (specialLength && content.length >= Math.pow(2, 7 * specialLength) - 1) {
        specialLength = undefined
      }
      vintSize = Tools.writeVint(content.length, specialLength)
    }
    return Buffer.concat([
      this.getTagDeclaration(),
      vintSize,
      content
    ])
  }
}