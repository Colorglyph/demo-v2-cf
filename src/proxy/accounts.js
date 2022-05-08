import { handleResponse } from "../@js/utils"

export default ({ query, env }) => {
  const { HORIZON_URL } = env

  return fetch(`${HORIZON_URL}/accounts/${query.id}`, {
    cf: {
      cacheTtlByStatus: { 
        '200-299': 5
      }
    },
  })
  .then(handleResponse)
  .then((record) => {
    delete record._links
    return record
  })
}