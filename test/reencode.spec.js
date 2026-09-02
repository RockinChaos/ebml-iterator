import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { pipeline as _p, Readable } from 'node:stream'
import { promisify } from 'node:util'
import { EbmlStreamDecoder, EbmlStreamEncoder, EbmlTagId } from 'ebml-stream'
import { EbmlIteratorDecoder, EbmlIteratorEncoder } from '../src/index.js'

const pipeline = promisify(_p)

const files = ['video1.webm', 'video2.webm', 'video3.webm', 'video4.webm', 'test5.mkv']

async function * encode(stream) {
  yield * new EbmlIteratorEncoder({ stream })
}
async function * decode(stream) {
  yield * new EbmlIteratorDecoder({ stream })
}

async function hashStream(stream) {
  const hasher = createHash('sha1').setEncoding('hex')
  await pipeline(stream, hasher)
  return hasher.read()
}

for (const file of files) {
  console.log(`\n=== ${file} ===`)

  const originalHash = await hashStream(createReadStream('media/' + file))
  console.log(`original:      ${originalHash}`)

  const roundTripHash = await hashStream(Readable.from(encode(decode(createReadStream('media/' + file)))))
  console.log(`ebml-iterator: ${roundTripHash} [${roundTripHash === originalHash ? 'match' : 'mismatch'}]`)
  if (roundTripHash !== originalHash) {
    throw new Error(`EBML iterator round-trip changed ${file}`)
  }

  const ebmlDecoder = new EbmlStreamDecoder({
    bufferTagIds: [
      EbmlTagId.TrackEntry
    ]
  })
  const ebmlEncoder = new EbmlStreamEncoder()

  const ebmlStreamHash = await hashStream(createReadStream('media/' + file).pipe(ebmlDecoder).pipe(ebmlEncoder))
  console.log(`ebml-stream:   ${ebmlStreamHash} [${ebmlStreamHash === originalHash ? 'match' : 'mismatch'}]`)
}