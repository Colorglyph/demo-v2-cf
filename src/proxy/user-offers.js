import BigNumber from "bignumber.js"
import { pick } from "lodash-es"
import { handleResponse } from "../@js/utils"

export default async ({ query, env }) => {
  const { HORIZON_URL } = env

  const swap = []

  const [
    sell, 
    buy
  ] = await Promise.all([
    fetch(`${HORIZON_URL}/accounts/${query.id}/offers?limit=200&order=asc`, {cf: { cacheTtlByStatus: { '200-299': 5 }}})
    .then(handleResponse)
    .then(({_embedded: {records}}) => records
      .map((record) =>
        pick(record, ['id', 'selling', 'buying', 'amount', 'price'])
      )
      .map((record) => {
        if (record.selling.asset_type !== 'native')
          delete record.selling.asset_type
        
        if (record.buying.asset_type !== 'native')
          delete record.buying.asset_type

        if (
          record.buying.asset_code === 'COLORGLYPH'
          && record.selling.asset_code === 'COLORGLYPH'
        ) swap.push(record)

        record.cost = new BigNumber(record.amount).times(record.price).toFixed(7)

        return record
      })
    ),

    fetch(`${HORIZON_URL}/claimable_balances/?sponsor=${query.id}&claimant=${query.id}&limit=200&order=asc`, {cf: {cacheTtlByStatus: { '200-299': 5 }}})
    .then(handleResponse)
    .then(({_embedded: {records}}) => records
      .map((record) =>
        pick(record, ['id', 'asset', 'amount', 'claimants'])
      )
      .map((record) => {
        record.claimants.forEach(({destination}) => {
          if (destination === query.id) 
            record.selling = record.asset === 'native'
            ? {
              asset_type: 'native'
            } 
            : {
              asset_code: record.asset.split(':')[0],
              asset_issuer: record.asset.split(':')[1]
            }
          else record.buying = {
            asset_code: 'COLORGLYPH',
            asset_issuer: destination
          }
        })

        record.cost = record.amount

        delete record.asset
        delete record.amount
        delete record.claimants
        
        return record
      })
    )
  ])

  return {
    sell,
    buy: [
      ...buy, 
      ...swap
    ]
  }
}