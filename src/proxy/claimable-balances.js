import { pick } from "lodash-es"

import { handleResponse } from "../@js/utils"

export default ({ query, env }) => {
  const { HORIZON_URL } = env
  const params = {
    sponsor: query.sponsor,
    claimant: query.claimant,
    limit: 200,
    order: 'asc'
  }
  const search = Object
  .keys(params)
  .filter((key) => params[key])
  .map(key => `${key}=${params[key]}`)
  .join('&')

  return fetch(`${HORIZON_URL}/claimable_balances/?${search}`, {cf: {cacheTtlByStatus: { '200-299': 5 }}})
  .then(handleResponse)
  .then(({_embedded: {records}}) => records
    .map((record) =>
      pick(record, ['id', 'sponsor', 'asset', 'amount', 'claimants'])
    )
    .map((record) => {
      record.claimants.forEach(({destination}) => {
        if (record.sponsor === destination) {
          record.seller = destination
          record.selling = record.asset === 'native'
          ? {
            asset_type: 'native'
          } 
          : {
            asset_code: record.asset.split(':')[0],
            asset_issuer: record.asset.split(':')[1]
          }
        }
        else record.buying = {
          asset_code: 'COLORGLYPH',
          asset_issuer: destination
        }
      })

      record.type = 'claimable-balance'
      record.cost = record.amount

      delete record.sponsor
      delete record.asset
      delete record.amount
      delete record.claimants
      
      return record
    })
  )
}