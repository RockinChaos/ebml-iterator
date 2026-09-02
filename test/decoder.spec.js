/* global describe, it */
import assert from 'assert'
import EbmlIteratorDecoder from '../src/EbmlIteratorDecoder.js'
import 'jasmine'
import EbmlTagPosition from '../src/models/enums/EbmlTagPosition.js'
import EbmlElementType from '../src/models/enums/EbmlElementType.js'

describe('EBML Decoder', () => {
  describe('Decoder', () => {
    it('waits for more data when a tag header is incomplete', () => {
      const decoder = new EbmlIteratorDecoder()

      assert.deepStrictEqual([...decoder.parseTags(Buffer.from([0x1a, 0x45]))], [])
      assert.strictEqual(decoder.buffer.length, 2)
    })

    it('clears the buffer after a complete tag in one chunk', () => {
      const decoder = new EbmlIteratorDecoder()

      assert.strictEqual([...decoder.parseTags(Buffer.from([0x42, 0x86, 0x81, 0x01]))].length, 1)
      assert.strictEqual(decoder.buffer.length, 0)
    })

    it('clears the buffer after a complete tag split across chunks', () => {
      const decoder = new EbmlIteratorDecoder()

      assert.deepStrictEqual([...decoder.parseTags(Buffer.from([0x42, 0x86]))], [])
      assert.strictEqual(decoder.buffer.length, 2)
      assert.strictEqual([...decoder.parseTags(Buffer.from([0x81, 0x01]))].length, 1)
      assert.strictEqual(decoder.buffer.length, 0)
    })

    it('tracks byte offsets across partial chunks', () => {
      const decoder = new EbmlIteratorDecoder()

      assert.deepStrictEqual([...decoder.parseTags(Buffer.from([0x42]))], [])
      assert.strictEqual(decoder.buffer.length, 1)
      assert.deepStrictEqual([...decoder.parseTags(Buffer.from([0x86]))], [])
      assert.strictEqual(decoder.buffer.length, 2)
      assert.deepStrictEqual([...decoder.parseTags(Buffer.from([0x81]))], [])
      assert.strictEqual(decoder.buffer.length, 3)

      const [firstTag] = [...decoder.parseTags(Buffer.from([0x01]))]
      const [secondTag] = [...decoder.parseTags(Buffer.from([0x42, 0x86, 0x81, 0x02]))]
      assert.strictEqual(firstTag.absoluteStart, 0)
      assert.strictEqual(secondTag.absoluteStart, 4)
      assert.strictEqual(decoder.buffer.length, 0)
    })

    it('should emit correct tag events for simple data', async () => {
      async function * stream() {
        yield Buffer.from([0x42, 0x86, 0x81, 0x01])
      }
      const decoder = new EbmlIteratorDecoder({ stream: stream() })

      for await (const tag of decoder) {
        assert.strictEqual(tag.position, EbmlTagPosition.Content)
        assert.strictEqual(tag.id.toString(16), '4286')
        assert.strictEqual(tag.size, 0x01)
        assert.strictEqual(tag.type, EbmlElementType.UnsignedInt)
        assert.deepStrictEqual(tag.data, 1)
      }
    })

    it('should emit correct EBML tag events for master tags', async () => {
      async function * data() {
        yield Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80])
      }

      const decoder = new EbmlIteratorDecoder()

      for await (const tag of decoder[Symbol.asyncIterator](data())) {
        if (tag.position === EbmlTagPosition.End) {
          assert.strictEqual(tag.id.toString(16), '1a45dfa3')
          continue
        }
        assert.strictEqual(tag.position, EbmlTagPosition.Start)
        assert.strictEqual(tag.id.toString(16), '1a45dfa3')
        assert.strictEqual(tag.size, 0)
        assert.strictEqual(tag.type, EbmlElementType.Master)
        assert.strictEqual(tag.data, undefined)
      }
    })

    it('should emit correct EBML:end events for master tags', async () => {
      async function * stream() {
        yield Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
        yield Buffer.from([0x84, 0x42, 0x86, 0x81, 0x00])
      }
      const decoder = new EbmlIteratorDecoder({ stream: stream() })
      let tags = 0
      for await (const tag of decoder) {
        if (tag.position === EbmlTagPosition.End) {
          assert.strictEqual(tags, 2) // two tags
          assert.strictEqual(tag.id.toString(16), '1a45dfa3')
          assert.strictEqual(tag.size, 4)
          assert.strictEqual(tag.type, EbmlElementType.Master)
          assert.strictEqual(tag.data, undefined)
        } else {
          tags += 1
        }
      }
    })

    it('keeps an unknown-size master open until the stream ends', async () => {
      async function * stream() {
        yield Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0xff, 0x42, 0x86, 0x82, 0x00, 0x01])
      }
      const tags = []
      for await (const tag of new EbmlIteratorDecoder({ stream: stream() })) {
        tags.push(tag)
      }

      assert.deepStrictEqual(tags.map(tag => tag.position), [
        EbmlTagPosition.Start,
        EbmlTagPosition.Content,
        EbmlTagPosition.End
      ])
      assert.strictEqual(tags[0].size, -1)
      assert.strictEqual(tags[0].sizeLength, 1)
    })
  })
})