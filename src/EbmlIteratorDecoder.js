import Tools from './tools.js'
import EbmlElementType from './models/enums/EbmlElementType.js'
import EbmlTagPosition from './models/enums/EbmlTagPosition.js'
import EbmlTagFactory from './models/EbmlTagFactory.js'

export default class EbmlIteratorDecoder {
  constructor(options = {}) {
    this._stream = options.stream
    this._currentBufferOffset = 0
    this._tagStack = []
    this._buffer = Buffer.alloc(0)
    this._bufferTagIds = new Set(options.bufferTagIds || [])
  }

  get buffer() {
    return this._buffer
  }

  async * [Symbol.asyncIterator](stream = this._stream) {
    for await (const chunk of stream) {
      yield * this.parseTags(chunk)
    }
    // Unknown-size tags stay open until the stream ends.
    while (this._tagStack.length > 0 && this._tagStack[this._tagStack.length - 1].size === -1) {
      yield this.createTag(this._tagStack.pop(), EbmlTagPosition.End)
    }
  }

  * parseTags(chunk) {
    const input = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    this._buffer = this._buffer.length === 0 ? input : Buffer.concat([this._buffer, input])
    while (true) {
      const currentTag = this.readTagHeader(this._buffer)
      if (!currentTag) {
        return null
      }
      if (currentTag.type === EbmlElementType.Master && (!this._bufferTagIds.has(currentTag.id) || currentTag.size === -1)) {
        // A new tag of the same type closes the previous unknown-size tag.
        while (this._tagStack.length > 0) {
          const parent = this._tagStack[this._tagStack.length - 1]
          if (parent.size !== -1 || parent.id !== currentTag.id) break
          yield this.createTag(this._tagStack.pop(), EbmlTagPosition.End)
        }
        this._tagStack.push(currentTag)
        yield this.createTag(currentTag, EbmlTagPosition.Start)
        this.advanceBuffer(currentTag.tagHeaderLength)
        if (currentTag.size === 0) {
          yield this.createTag(this._tagStack.pop(), EbmlTagPosition.End)
        }
      } else {
        if (this._buffer.length < currentTag.tagHeaderLength + currentTag.size) {
          return null
        }
        const data = this._buffer.slice(currentTag.tagHeaderLength, currentTag.tagHeaderLength + currentTag.size)
        yield this.createTag(currentTag, EbmlTagPosition.Content, data)
        this.advanceBuffer(currentTag.tagHeaderLength + currentTag.size)
        while (this._tagStack.length > 0) {
          const nextTag = this._tagStack[this._tagStack.length - 1]
          if (nextTag.size === -1 || this._currentBufferOffset < (nextTag.absoluteStart + nextTag.tagHeaderLength + nextTag.size)) {
            break
          }
          yield this.createTag(nextTag, EbmlTagPosition.End)
          this._tagStack.pop()
        }
      }
    }
  }

  advanceBuffer(length) {
    this._currentBufferOffset += length
    this._buffer = this._buffer.slice(length)
  }

  readTagHeader(buffer, offset = 0) {
    if (buffer.length === 0) return null

    const tag = Tools.readVint(buffer, offset)
    if (tag == null) return null

    const size = Tools.readVint(buffer, offset + tag.length)
    if (size == null) return null

    let tagId = 0
    for (let index = offset; index < offset + tag.length; index += 1) {
      tagId = (tagId * 256) + buffer[index]
    }
    const tagObject = EbmlTagFactory.create(tagId)
    tagObject.size = size.value
    tagObject.sizeLength = size.length
    return Object.assign(tagObject, {
      absoluteStart: this._currentBufferOffset + offset,
      tagHeaderLength: tag.length + size.length
    })
  }

  createTag(tag, position, data) {
    const emittedTag = EbmlTagFactory.create(tag.id)
    emittedTag.absoluteStart = tag.absoluteStart
    emittedTag.tagHeaderLength = tag.tagHeaderLength
    emittedTag.size = tag.size
    emittedTag.sizeLength = tag.sizeLength
    emittedTag.position = position
    if (position === EbmlTagPosition.Content) {
      emittedTag.parseContent(data)
    }
    return emittedTag
  }
}