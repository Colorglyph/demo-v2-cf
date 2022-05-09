import BigNumber from "bignumber.js"
import { pick } from "lodash-es"

import { handleResponse } from "../@js/utils"

export default async ({ query, env, swap }) => {
  const { HORIZON_URL } = env
  const params = {
    seller: query.seller,
    buying: query.buying ? `COLORGLYPH:${query.buying}` : undefined,
    selling: query.selling ? `COLORGLYPH:${query.selling}` : undefined,
    limit: 200,
    order: 'asc'
  }
  const search = Object
  .keys(params)
  .filter((key) => params[key])
  .map(key => `${key}=${params[key]}`)
  .join('&')

  return await fetch(`${HORIZON_URL}/offers?${search}`, {cf: { cacheTtlByStatus: { '200-299': 5 }}})
  .then(handleResponse)
  .then(({_embedded: {records}}) => records
    .map((record) =>
      pick(record, ['id', 'seller', 'selling', 'buying', 'amount', 'price'])
    )
    .map((record) => {
      if (record.selling.asset_type !== 'native')
        delete record.selling.asset_type
      
      if (record.buying.asset_type !== 'native')
        delete record.buying.asset_type

      if (
        swap
        && record.buying.asset_code === 'COLORGLYPH'
        && record.selling.asset_code === 'COLORGLYPH'
      ) swap.push(record)

      record.cost = new BigNumber(record.amount).times(record.price).toFixed(7)

      return record
    })
  )
}