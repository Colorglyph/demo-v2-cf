import Bluebird from 'bluebird'

import sep39 from "../api/sep39"
import { handleResponse } from "../@js/utils"

// TODO load sep39 data

export default ({ query, env }) => {
  const { HORIZON_URL, STELLAR_NETWORK, GLYPH_SPONSOR_PK, SCRAPED_SPONSOR_PK } = env
  const sponsor = query.scraped === 'true' ? SCRAPED_SPONSOR_PK : GLYPH_SPONSOR_PK

  return fetch(`${HORIZON_URL}/accounts/?sponsor=${sponsor}&limit=200&order=desc`, {cf: {cacheTtlByStatus: { '200-299': 5 }}})
  .then(handleResponse)
  .then(({_embedded: {records}}) => Bluebird.map(records, async (record) => {
    await sep39({
      url: new URL(`file:////${record.id}`),
      search: {
        name: 'json',
        network: STELLAR_NETWORK.toLowerCase()
      }
    })
    .then((res) => res.json())
    .then((res) => res.forEach(({key, value}) => record[key] = value))

    delete record._links
    return record
  }, {concurrency: 10}))
}