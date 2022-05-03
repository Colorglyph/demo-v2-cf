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

export async function getColorSponsorAccounts(baseAsset, {
  COLOR_ISSUER_PK,
  GLYPH_SPONSOR_PK,
  HORIZON_URL, 
}) {
  const baseAssetIssuerAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${baseAsset.issuer}`).then(handleResponse)
  const baseAssetPaletteAccountLoaded = await fetch(`${HORIZON_URL}/accounts/${baseAssetIssuerAccountLoaded.sponsor}`).then(handleResponse)
  const colorSponsorAccounts = baseAssetPaletteAccountLoaded.balances
  .filter(({ asset_issuer }) => asset_issuer === COLOR_ISSUER_PK)
  .map(({ asset_code, balance }) => {
    const colorSponsorIndex = asset_code.substring(6)
    const colorSponsorHash = shajs('sha256').update(GLYPH_SPONSOR_PK).update(colorSponsorIndex).digest()
    const colorSponsorKeypair = Keypair.fromRawEd25519Seed(colorSponsorHash)
    const colorSponsorAccount = colorSponsorKeypair.publicKey()

    return new Array(new BigNumber(balance).times(1e7).toNumber()).fill(colorSponsorAccount)
  })
  .flat()
  
  return [
    baseAssetIssuerAccountLoaded,
    colorSponsorAccounts
  ] 
}