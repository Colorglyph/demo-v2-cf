import BigNumber from 'bignumber.js'
import { Keypair } from 'stellar-base'
import shajs from 'sha.js'

export async function handleResponse(response) {
  const isResponseJson = response.headers.get('content-type')?.indexOf('json') > -1

  if (response.ok)
    return isResponseJson
    ? response.json() 
    : response.text()

  throw isResponseJson
  ? {
    ...await response.json(),
    status: response.status
  }
  : await response.text()
}

export async function getRoyaltyAccounts(baseAsset, {
  COLOR_ISSUER_PK,
  GLYPH_SPONSOR_PK,
  HORIZON_URL, 
}) {
  const baseAssetIssuerAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${baseAsset.issuer}`).then(handleResponse)
  const baseAssetPaletteAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${baseAssetIssuerAccountLoaded.sponsor}`).then(handleResponse)
  const royaltyAccounts = baseAssetPaletteAccountLoaded.balances
  .filter(({ asset_issuer }) => asset_issuer === COLOR_ISSUER_PK)
  .map(({ asset_code, balance }) => {
    const royaltyIndex = asset_code.substring(6)
    const royaltyHash = shajs('sha256').update(GLYPH_SPONSOR_PK).update(royaltyIndex).digest()
    const royaltyKeypair = Keypair.fromRawEd25519Seed(royaltyHash)
    const royaltyAccount = royaltyKeypair.publicKey()

    return new Array(new BigNumber(balance).times(1e7).toNumber()).fill(royaltyAccount)
  })
  .flat()
  
  return [
    baseAssetIssuerAccountLoaded,
    royaltyAccounts
  ] 
}