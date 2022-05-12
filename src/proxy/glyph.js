import getAccount from './account'
import getOffers from './offers'
import getClaimableBalances from './claimable-balances'

import sep39 from '../api/sep39'

export default ({ query, env }) => {
  const { STELLAR_NETWORK } = env

  return getAccount({query, env})
  .then(async (account) => {
    const [
      buyOffers,
      buyClaimableBalances,
      sell
    ] = await Promise.all([
      getOffers({query: {buying: account.id}, env}), // Offers to buy glyph (only interesting if owner is calling??)
      getClaimableBalances({query: {claimant: account.id}, env}), // Claimable balances to buy glyph  (only interesting if owner is calling?)
      getOffers({query: {selling: account.id}, env}), // Offers to sell glyph

      sep39({
        search: {
          id: account.id,
          name: 'json',
          network: STELLAR_NETWORK.toLowerCase()
        }
      })
      .then((res) => res.json())
      .then((res) => res.forEach(({key, value}) => account[key] = value))
    ])

    account.offers = {
      buy: [
        ...buyOffers,
        ...buyClaimableBalances
      ],
      sell
    }

    delete account._links
    return account
  })
}