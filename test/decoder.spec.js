/* global describe, it */
import assert from 'assert'
import EbmlIteratorDecoder from '../src/EbmlIteratorDecoder.js'
import 'jasmine'
import EbmlTagPosition from '../src/models/enums/EbmlTagPosition.js'
import EbmlElementType from '../src/models/enums/EbmlElementType.js'

describe('EBML Decoder', () => {
  describe('Decoder', () => {
    // it('should wait for more data if a tag is longer than the buffer', () => {
    //   const decoder = new Decoder()
    //   decoder.write(Buffer.from([0x1a, 0x45]))

    //   assert.strictEqual(2, decoder.buffer.length)
    // })

    // it('should clear the buffer after a full tag is written in one chunk', () => {
    //   const decoder = new Decoder()
    //   decoder.write(Buffer.from([0x42, 0x86, 0x81, 0x01]))

    //   assert.strictEqual(0, decoder.buffer.length)
    // })

    // it('should clear the buffer after a full tag is written in multiple chunks', () => {
    //   const decoder = new Decoder()

    //   decoder.write(Buffer.from([0x42, 0x86]))
    //   decoder.write(Buffer.from([0x81, 0x01]))

    //   assert.strictEqual(0, decoder.buffer.length)
    // })

    // it('should increment the cursor on each step', () => {
    //   const decoder = new Decoder()

    //   decoder.write(Buffer.from([0x42])) // 4

    //   assert.strictEqual(1, decoder.buffer.length)

    //   decoder.write(Buffer.from([0x86])) // 5

    //   assert.strictEqual(2, decoder.buffer.length)

    //   decoder.write(Buffer.from([0x81])) // 6 & 7

    //   assert.strictEqual(3, decoder.buffer.length)

    //   decoder.write(Buffer.from([0x01])) // 6 & 7

    //   assert.strictEqual(0, decoder.buffer.length)
    // })

    it('should emit correct tag events for simple data', async () => {
      async function * stream () {
        yield Buffer.from([0x42, 0x86, 0x81, 0x01])
      }
      const decoder = new EbmlIteratorDecoder({ stream: stream() })

      for await (const tag of decoder) {
        assert.strictEqual(tag.position, EbmlTagPosition.Content)
        // assert.strictEqual(tag, 0x286);
        assert.strictEqual(tag.id.toString(16), '4286')
        assert.strictEqual(tag.size, 0x01)
        assert.strictEqual(tag.type, EbmlElementType.UnsignedInt)
        assert.deepStrictEqual(tag.data, 1)
      }
    })

    it('should emit correct EBML tag events for master tags', async () => {
      async function * data () {
        yield Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80])
      }

      const decoder = new EbmlIteratorDecoder()

      for await (const tag of decoder[Symbol.asyncIterator](data())) {
        assert.strictEqual(tag.position, EbmlTagPosition.Start)
        // assert.strictEqual(tag, 0x0a45dfa3);
        assert.strictEqual(tag.id.toString(16), '1a45dfa3')
        assert.strictEqual(tag.size, 0)
        assert.strictEqual(tag.type, EbmlElementType.Master)
        assert.strictEqual(tag.data, undefined)
      }
    })

    it('should emit correct EBML:end events for master tags', async () => {
      async function * stream () {
        yield Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
        yield Buffer.from([0x84, 0x42, 0x86, 0x81, 0x00])
      }
      const decoder = new EbmlIteratorDecoder({ stream: stream() })
      let tags = 0
      for await (const tag of decoder) {
        if (tag.position === EbmlTagPosition.End) {
          assert.strictEqual(tags, 2) // two tags
          // assert.strictEqual(data.tag, 0x0a45dfa3);
          assert.strictEqual(tag.id.toString(16), '1a45dfa3')
          assert.strictEqual(tag.size, 4)
          assert.strictEqual(tag.type, EbmlElementType.Master)
          assert.strictEqual(tag.data, undefined)
        } else {
          tags += 1
        }
      }
    })
  })
})
