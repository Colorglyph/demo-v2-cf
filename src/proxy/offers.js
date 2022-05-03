import { handleResponse } from "../@js/utils"

export default async ({ query, env }) => {
  const { HORIZON_URL } = env

  return await fetch(
  query.seller
    ? `${HORIZON_URL}/offers?seller=${query.seller}&limit=200&order=asc`
  : query.buying
    ? `${HORIZON_URL}/offers?buying=COLORGLYPH:${query.buying}&limit=200&order=asc` 
  : query.selling
    ? `${HORIZON_URL}/offers?selling=COLORGLYPH:${query.selling}&limit=200&order=asc`
  : null,
  {
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