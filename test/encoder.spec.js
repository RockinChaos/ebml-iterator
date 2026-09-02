/* global describe, it, beforeAll */
import assert from 'assert'
import EbmlIteratorEncoder from '../src/EbmlIteratorEncoder.js'
import 'jasmine'
import EbmlTagId from '../src/models/enums/EbmlTagId.js'
import EbmlTagPosition from '../src/models/enums/EbmlTagPosition.js'
import EbmlTagFactory from '../src/models/EbmlTagFactory.js'
import Tools from '../src/tools.js'

const invalidTag = {
  id: undefined,
  type: '404NotFound',
  position: undefined,
  size: -1,
  data: null
}

const incompleteTag = undefined

const ebmlStartTag = Object.assign(EbmlTagFactory.create(EbmlTagId.EBML), {
  size: 10,
  position: EbmlTagPosition.Start
})

const ebmlEndTag = Object.assign(EbmlTagFactory.create(EbmlTagId.EBML), {
  size: 10,
  position: EbmlTagPosition.End
})

const ebmlVersion1Tag = Object.assign(EbmlTagFactory.create(EbmlTagId.EBMLVersion), {
  position: EbmlTagPosition.Content,
  data: 1
})

const ebmlVersion0Tag = Object.assign(EbmlTagFactory.create(EbmlTagId.EBMLVersion), {
  position: EbmlTagPosition.Content,
  data: 0
})

describe('EBML Encoder', () => {
  describe('Encoder', () => {
    function createEncoder(expected, done, data) {
      const encoder = new EbmlIteratorEncoder()
      for (const item of data) {
        const chunk = encoder.processTag(item)
        if (chunk) {
          assert.strictEqual(
            Buffer.from(chunk).toString('hex'),
            Buffer.from(expected).toString('hex')
          )
          done()
        }
      }
    }

    it('should write a single tag', done => {
      createEncoder([0x42, 0x86, 0x81, 0x01], done, [ebmlVersion1Tag])
    })
    it('should write a tag with a single child', done => {
      createEncoder(
        [0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x00],
        done,
        [ebmlStartTag, ebmlVersion0Tag, ebmlEndTag]
      )
    })
    describe('#writeTag', () => {
      let encoder
      beforeAll(() => {
        encoder = new EbmlIteratorEncoder()
      })
      it('does nothing with incomplete tag data', () => {
        encoder.processTag(incompleteTag)
        assert.strictEqual(encoder.openTags.length, 0)
      })
      it('throws with an invalid tag id', () => {
        assert.throws(
          () => {
            encoder.processTag(invalidTag)
          },
          /No id found/,
          'Not throwing properly'
        )
      })
    })
    describe('#startTag', () => {
      let encoder
      beforeAll(() => {
        encoder = new EbmlIteratorEncoder()
      })
      it('throws with an invalid tag id', () => {
        assert.throws(
          () => {
            encoder.processTag(invalidTag)
          },
          /No id found/,
          'Not throwing properly'
        )
      })
    })
    describe('signed integer encoding', () => {
      it('uses a width the decoder can read', () => {
        assert.deepStrictEqual(Tools.writeSigned(-1), Buffer.from([0xff]))
        assert.deepStrictEqual(Tools.writeSigned(-129), Buffer.from([0xff, 0x7f]))
        assert.deepStrictEqual(Tools.writeSigned(-32769), Buffer.from([0xff, 0xff, 0x7f, 0xff]))
      })
    })
  })
})