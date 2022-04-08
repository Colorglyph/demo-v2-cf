import base91 from 'node-base91'
import { encodePng } from '@lunapaint/png-codec'
import shajs from 'sha.js'

export default async ({name, description, palette}) => {
  const wh = 16
  const ch = 4

  const data = Buffer.alloc(wh * wh * ch)

  palette.forEach(([r, g, b], i) => {
    const x = i % wh
    const y = Math.floor(i / wh)

    data[y * ch * wh + ch * x] = r
    data[y * ch * wh + ch * x + 1] = g
    data[y * ch * wh + ch * x + 2] = b
    data[y * ch * wh + ch * x + 3] = 255
  })

  let nameBuffer = Buffer.from(name)
  let descriptionBuffer = Buffer.from(description)
  let imageBuffer = await encodePng({ 
    data, 
    width: wh, 
    height: wh,
    bitDepth: 8,
    colorType: 2,
    ancillaryChunks: {}
  })
  .then(({data}) => Buffer.from(data))

  // Metadata
  let metadata = `text/plain;n=name;s=${nameBuffer.length},text/plain;n=description;s=${descriptionBuffer.length},image/png;n=image`

  // Create concatBuffer
  let i = 0
  const manageData = []

  let concatBuffer = Buffer.concat([
    nameBuffer,
    descriptionBuffer,
    imageBuffer,
  ])

  while (metadata.length) {
    let keyslice = 64 - 2 // key length - index
    let name = (i).toString(36).padStart(2, 0)
    let value = Buffer.alloc(0)

    if (i === 0) {
      keyslice = keyslice - 1 - `${metadata.length}`.length // keyslice - version - metadata length

      name += 1 // sep39 version, currently 1
      name += metadata.length
    }

    name += metadata.substring(0, keyslice)
    value = metadata.substring(keyslice, keyslice + 64) || value

    manageData.push([name, value])

    metadata = metadata.substring(keyslice + 64)
    i++
  }

  // Split concatBuffer into key:value chunks
  while (concatBuffer.length) {
    let keyslice = 64 - 2
    let name = (i).toString(36).padStart(2, 0)
    let value = Buffer.alloc(0)

    const prevManageData = manageData[manageData.length - 1]

    if (prevManageData[0].length < 64) {
      // Top up partial keys
      const slice = 64 - prevManageData[0].length

      const [basE91String, byteLength] = basE91EncodeToLength(
        concatBuffer,
        slice
      )

      prevManageData[0] += basE91String
      concatBuffer = concatBuffer.slice(byteLength)
    }

    if (prevManageData[1].length < 64) {
      // Top up partial values
      const slice = 64 - prevManageData[1].length

      prevManageData[1] = Buffer.concat([
        Buffer.from(prevManageData[1]),
        concatBuffer.slice(0, slice),
      ])
      concatBuffer = concatBuffer.slice(slice)
    }

    const [basE91String, byteLength] = basE91EncodeToLength(
      concatBuffer,
      keyslice
    )

    name += basE91String

    value = concatBuffer.slice(byteLength, byteLength + 64) || value
    concatBuffer = concatBuffer.slice(byteLength + 64)

    manageData.push([name, value])

    i++
  }

  return {
    manageData,
    hash: shajs('sha256').update(imageBuffer).digest()
  }
}

function basE91EncodeToLength(buffer, length) {
  let i = length
  let output = base91.encode(buffer.slice(0, i))

  while (output.length > length) {
    i--
    output = base91.encode(buffer.slice(0, i))
  }

  return [output, i]
}