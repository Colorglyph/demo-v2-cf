import { handleResponse } from "../@js/utils"

export default ({ query, env }) => {
  const { HORIZON_URL, COLOR_ISSUER_PK } = env

  return fetch(`${HORIZON_URL}/accounts/?sponsor=${query.id}&limit=200&order=desc`, {
    cf: {
      cacheTtlByStatus: { 
        '200-299': 5
      }
    },
  })
  .then(handleResponse)
  .then(({_embedded: {records}}) => records
  .filter((record) => record.balances.find(({asset_issuer}) => asset_issuer === COLOR_ISSUER_PK)) // NOTE: Might be worth adding another unique sponsorship to palette accounts so we don't need to filter
  .map((record) => {
    delete record._links 
    return record
  }))
}