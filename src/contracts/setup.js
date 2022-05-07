import base62 from 'base62'
import BigNumber from 'bignumber.js'
import {
  Networks,
  TransactionBuilder,
  Operation,
  Keypair,
  Account,
} from 'stellar-base'
import shajs from 'sha.js'

import { handleResponse } from '../@js/utils'

// TODO
// Ensure royalty payments will be going to a created account (should we also ensure if it's an existing account that it's the userAccounts?)
  // Probably not
// Disable the account setup scenario? It doesn't require our signer so it could be done client side

export default async ({
  userAccount,
  royaltyIndex
}, { 
  STELLAR_NETWORK,
  HORIZON_URL,
  GLYPH_SPONSOR_PK,
}) => {
  if (parseInt(base62.decode(royaltyIndex)) > (62 ** 6 - 1))
    throw new Error(`royaltyIndex out or range`)

  const royaltyHash = shajs('sha256').update(GLYPH_SPONSOR_PK).update(royaltyIndex).digest()
  const royaltyKeypair = Keypair.fromRawEd25519Seed(royaltyHash)
  const royaltyAccount = royaltyKeypair.publicKey()
  const royaltyAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${royaltyAccount}`)
  .then(handleResponse)
  .catch((err) => {
    if (err?.status === 404)
      return null
    throw err
  })

  return fetch(`${HORIZON_URL}/accounts/${userAccount}`)
  .then(handleResponse)
  .then((account) => {
    const ops = []
    const signers = []

    if (
      royaltyAccountLoaded
      && royaltyAccountLoaded.sponsor !== userAccount
    ) throw new Error(`${royaltyAccount} already exists but is not sponsored by ${userAccount}`)

    if (!royaltyAccountLoaded) {
      signers.push(royaltyKeypair)

      ops.push(
        Operation.beginSponsoringFutureReserves({ // The userAccount will sponsor the royaltyAccount
          sponsoredId: royaltyAccount,
          source: userAccount
        }),

        Operation.createAccount({ // Create a new royaltyAccount
          destination: royaltyAccount,
          startingBalance: '0',
          source: userAccount
        }),

        Operation.setOptions({ // Set some options on the royaltyAccount
          masterWeight: 0, // Remove the master signer
          signer: {
            ed25519PublicKey: userAccount, // Add the userAccount as the primary signer
            weight: 1
          },
          source: royaltyAccount
        }),

        Operation.endSponsoringFutureReserves({ // Close sponsorship
          source: royaltyAccount
        }),
      )
    }

    ops.push(
      Operation.manageData({
        name: 'royaltyindex',
        value: royaltyIndex,
        source: userAccount
      })
    )

    let transaction = new TransactionBuilder(
      new Account(account.id, account.sequence), 
      {
        fee: new BigNumber(1).div('0.0000001').div(ops.length).toFixed(0, 3), // 1 XLM div # of ops
        networkPassphrase: Networks[STELLAR_NETWORK]
      }
    ).setTimeout(0)

    ops.forEach((op) => transaction.addOperation(op))

    transaction = transaction.build()

    if (signers.length)
      transaction.sign(...signers)

    return transaction.toXDR()
  })
}