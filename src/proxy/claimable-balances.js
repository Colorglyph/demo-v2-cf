import { handleResponse } from "../@js/utils"

export default ({ query, env }) => {
  const { HORIZON_URL } = env

  return fetch(`${HORIZON_URL}/claimable_balances/?claimant=${query.id}&limit=200&order=asc`, {
    cf: {
      cacheTtlByStatus: { 
        '200-299': 5
      }
    },
  })
  .then(handleResponse)
  .then(({_embedded: {records}}) => records
  .map((record) => {
    delete record._links 
    return record
  }))
}