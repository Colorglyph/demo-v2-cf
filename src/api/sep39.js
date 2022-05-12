import { isEmpty, orderBy } from 'lodash'
import { Base91 } from '@tinyanvil/base91'

import { handleResponse } from '../@js/utils'

const base91 = new Base91()

export default async ({ url, search }) => {
  const { pathname } = url || {}
  const [, , publicKey] = pathname?.split('/') || []
  const { id, name = 'image', network = 'public' } = search
  const horizon = network === 'public' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'

  const { mime, value } = await fetch(`${horizon}/accounts/${publicKey || id}`, {
    cf: {
      cacheTtlByStatus: { '200-299': 3600 }
    },
  })
  .then(handleResponse)
  .then(({ data }) => {
    if (isEmpty(data))
      throw { status: 404 }

    const manageData = Object.entries(data)

    //// DECODE (what you'd get from Horizon)
    // Collect and decode key:values
    let version
    let metadataLength

    const manageDataArray = manageData.map(([key, value]) => {
      const index = parseInt(key.substring(0, 2), 36)
      
      value = Buffer.from(value, 'base64')

      if (index === 0) {
        const [infoPrefix] = key.match(/\d+/)

        version = parseInt(infoPrefix.substring(2, 3))
        metadataLength = parseInt(infoPrefix.substring(3))
        key = key.substring(`${infoPrefix}`.length)
      }

      else
        key = key.substring(2)

      return {
        index,
        key,
        value
      }
    })

    // Arrange back into a concatBuffer
    const fieldBuffers = []

    let metadataBuffer = Buffer.alloc(0)

    orderBy(manageDataArray, 'index').forEach(({ key, value }) => {
      key = Buffer.from(key)
      value = Buffer.from(value)

      let metadataLeft = metadataLength - metadataBuffer.length

      if (metadataLeft > 0) {
        metadataBuffer = Buffer.concat([
          metadataBuffer,
          key.slice(0, metadataLeft)
        ])

        key = key.slice(metadataLeft)
        metadataLeft = metadataLength - metadataBuffer.length
      }

      if (metadataLeft > 0) {
        metadataBuffer = Buffer.concat([
          metadataBuffer,
          value.slice(0, metadataLeft)
        ])

        value = value.slice(metadataLeft)
        metadataLeft = metadataLength - metadataBuffer.length
      }

      fieldBuffers.push(
        Buffer.from(base91.decode(key, 'bytes')), 
        value
      )
    })

    let fieldBuffer = Buffer.concat(fieldBuffers)

    // Retrieve metadata buffer
    const metadataChunks = metadataBuffer.toString().split(',')

    // From this slice up concatBuffer into its parts
    const fields = metadataChunks.map((metadataChunk) => {
      let [mime, ...params] = metadataChunk.split(';')

      const keyObj = {}

      params.forEach((param) => {
        const [key, value] = param.split('=')
        keyObj[key] = value
      })

      const { s, n: key } = keyObj
      const value = fieldBuffer.slice(0, s)

      fieldBuffer = fieldBuffer.slice(s)

      return {
        key,
        mime,
        value
      }
    })

    // 🎉
    return name === 'json' 
    ? (() => {
      const value = fields.map(({ key, mime, value }) => ({
        key,
        mime,
        value: value.toString(mime.indexOf('text') > -1 ? 'utf8' : 'base64'),
      }))

      return {
        mime: 'application/json',
        value: JSON.stringify(value)
      }
    })()
    : fields.find(({ key }) => key === name) || fields[0]
  })

  return new Response(value, {
    headers: {
      'Content-Type': mime,
      'Content-Length': value.length,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `public, max-age=2419200`
    }
  })
}