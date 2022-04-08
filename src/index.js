import {
  StatusError,
  ThrowableRouter,
} from 'itty-router-extras'

import apiContracts from './api/contracts'
import apiPreparePaletteAccount from './api/prepare-palette-account'

const router = ThrowableRouter()

router.post('/contracts/:command', apiContracts)
router.post('/utils/prepare-palette-account', apiPreparePaletteAccount)
router.all('*', () => { throw new StatusError(404, 'Not Found') })

export default { 
  fetch: (...args) => router
  .handle(...args)
  .then(response => {
    response.headers.append('Access-Control-Allow-Origin', '*') // cors ftw
    return response 
  }) 
}