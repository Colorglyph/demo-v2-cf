import { handleResponse } from "../@js/utils"

export default ({ env }) => {
  const { HORIZON_URL, GLYPH_SPONSOR_PK } = env

  return fetch(`${HORIZON_URL}/accounts/?sponsor=${GLYPH_SPONSOR_PK}&limit=200&order=desc`, {
    cf: {
      cacheTtlByStatus: { 
        '200-299': 5
      }
    },
  })
  .then(handleResponse)
  .then(({_embedded: {records}}) => records.map((record) => {
    delete record._links 
    return record
  }))
}