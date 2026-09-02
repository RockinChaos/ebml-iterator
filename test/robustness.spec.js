/* global describe, it */
import assert from 'assert'
import EbmlIteratorDecoder from '../src/EbmlIteratorDecoder.js'
import Block from '../src/models/tags/Block.js'
import EbmlDataTag from '../src/models/tags/EbmlDataTag.js'
import EbmlMasterTag from '../src/models/tags/EbmlMasterTag.js'
import EbmlElementType from '../src/models/enums/EbmlElementType.js'
import EbmlTagId from '../src/models/enums/EbmlTagId.js'
import EbmlTagPosition from '../src/models/enums/EbmlTagPosition.js'
import Tools from '../src/tools.js'
import 'jasmine'

describe('EBML robustness', () => {
  it('does not buffer unknown-size masters requested as buffered tags', async () => {
    async function * stream() {
      yield Buffer.from([0xa0, 0xff, 0xe7, 0x81, 0x00])
    }
    const tags = []
    for await (const tag of new EbmlIteratorDecoder({
      stream: stream(),
      bufferTagIds: [EbmlTagId.BlockGroup]
    })) {
      tags.push(tag)
    }

    assert.deepStrictEqual(tags.map(tag => [tag.id, tag.position]), [
      [EbmlTagId.BlockGroup, EbmlTagPosition.Start],
      [EbmlTagId.Timecode, EbmlTagPosition.Content],
      [EbmlTagId.BlockGroup, EbmlTagPosition.End]
    ])
  })

  it('closes an unknown-size Cluster before the next Cluster', async () => {
    async function * stream() {
      yield Buffer.from([
        0x1f, 0x43, 0xb6, 0x75, 0xff, 0xe7, 0x81, 0x00,
        0x1f, 0x43, 0xb6, 0x75, 0xff, 0xe7, 0x81, 0x01
      ])
    }
    const positions = []
    for await (const tag of new EbmlIteratorDecoder({ stream: stream() })) {
      if (tag.id === EbmlTagId.Cluster) positions.push(tag.position)
    }

    assert.deepStrictEqual(positions, [
      EbmlTagPosition.Start,
      EbmlTagPosition.End,
      EbmlTagPosition.Start,
      EbmlTagPosition.End
    ])
  })

  it('rejects unsafe eight-byte VINT values without mistaking them for unknown sizes', () => {
    assert.strictEqual(Tools.readVint(Buffer.from('01ffffffffffffff', 'hex')).value, -1)
    assert.throws(
      () => Tools.readVint(Buffer.from('0120010000000000', 'hex')),
      /Unrepresentable VINT value/
    )
    assert.throws(() => Tools.writeVint(127, 1), /cannot be represented/)
  })

  it('preserves float precision when 32 bits are insufficient', () => {
    const encoded = Tools.writeFloat(Math.PI)
    assert.strictEqual(encoded.length, 8)
    assert.strictEqual(Tools.readFloat(encoded), Math.PI)
  })

  it('preserves decoded numeric payload and size-field widths while re-encoding', () => {
    const unsigned = new EbmlDataTag(EbmlTagId.EBMLVersion, EbmlElementType.UnsignedInt)
    unsigned.data = 1
    unsigned.size = 4
    unsigned.sizeLength = 2
    assert.deepStrictEqual(unsigned.encode(), Buffer.from([0x42, 0x86, 0x40, 0x04, 0x00, 0x00, 0x00, 0x01]))

    unsigned.data = 256
    unsigned.size = 1
    unsigned.sizeLength = 1
    assert.throws(() => unsigned.encode(), /does not fit/)

    unsigned.size = undefined
    assert.deepStrictEqual(unsigned.encode(), Buffer.from([0x42, 0x86, 0x82, 0x01, 0x00]))

    const float = new EbmlDataTag(EbmlTagId.Duration, EbmlElementType.Float)
    float.data = 1.5
    float.size = 8
    assert.strictEqual(float.encode().length, 11)
  })

  it('reports malformed buffered masters and blocks clearly', () => {
    const master = new EbmlMasterTag(EbmlTagId.SeekHead)
    assert.throws(() => master.parseContent(Buffer.from([0x4d])), /Incomplete EBML child tag/)

    const block = new Block()
    assert.throws(() => block.parseContent(Buffer.from([0x81, 0x00])), /Incomplete Matroska block header/)
    assert.strictEqual(block.type, EbmlElementType.Binary)
  })
})