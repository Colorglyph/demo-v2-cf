import getClaimableBalances from './claimable-balances'
import getOffers from './offers'

export default async ({ query, env }) => {
  const swap = []
  const [
    buy,
    sell,
  ] = await Promise.all([
    getClaimableBalances({query: {sponsor: query.id, claimant: query.id}, env}),
    getOffers({query: {seller: query.id}, env, swap})
  ])

  return {
    buy: [
      ...buy, 
      ...swap
    ],
    sell,
  }
}