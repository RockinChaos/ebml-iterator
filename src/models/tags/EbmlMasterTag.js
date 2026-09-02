import EbmlTag from '../EbmlTag.js'
import EbmlElementType from '../enums/EbmlElementType.js'
import EbmlTagPosition from '../enums/EbmlTagPosition.js'
import Tools from '../../tools.js'
import EbmlTagFactory from '../EbmlTagFactory.js'

export default class EbmlMasterTag extends EbmlTag {
  constructor(id, position = EbmlTagPosition.Content) {
    super(id, EbmlElementType.Master, position)
    this._children = []
  }

  get Children() {
    return this._children
  }

  set Children(value) {
    this._children = value
  }

  encodeContent() {
    return Buffer.concat(this._children.map(child => child.encode()))
  }

  parseContent(content) {
    while (content.length > 0) {
      const tag = Tools.readVint(content)
      if (!tag) throw new Error('Incomplete EBML child tag')
      const size = Tools.readVint(content, tag.length)
      if (!size) throw new Error('Incomplete EBML child size')
      const headerLength = tag.length + size.length
      const contentLength = size.value === -1 ? content.length - headerLength : size.value
      if (contentLength < 0 || content.length < headerLength + contentLength) {
        throw new Error('Incomplete EBML child content')
      }
      let tagId = 0
      for (let index = 0; index < tag.length; index += 1) {
        tagId = (tagId * 256) + content[index]
      }
      const tagObject = EbmlTagFactory.create(tagId)
      tagObject.sizeLength = size.length
      tagObject.size = size.value
      const totalTagLength = headerLength + contentLength
      tagObject.parseContent(content.slice(headerLength, totalTagLength))
      this._children.push(tagObject)
      content = content.slice(totalTagLength)
    }
  }
}