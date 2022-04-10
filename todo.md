- TODO // In order to get this on the Turrets network anywhere we use `glyphSigner` will need to be replaced with a collection of Turret signers which can be derived from a sort of reference account and copied from. So maybe `glyphSigner` holds no value but does have the signers that anyone adding `glyphSigner` should mirror the signers for. Then we just have to keep the `glyphSigner` up to date and if we heal anything we can can write a contract that heals off of this template.

- When there are two identical offers how is "taker" determined? Isn't it conceivable that you could try and claim an escrow for account A but account B's offer is attempted to be taken?
  - Yep, duplicate offers easily break the current design.
  - Solved by allowing selection of what offer you want to "sell now" to while still using the escrowSponsorAccount and not using the path payment method and rather do direct payments or insert a third proxy asset in the path
  - The flow then for finding best offer is use path payments for the given desired counter asset to find top price then just pick any specific offer in that range. Or actually just pick any account there. Until we can order accounts off a custom key or really until we can order/filter offers by amount this is the way.
  - Actually what if the offer from the escrowSponsorAccount account was self sponsored? Then we could filter offers and since it's ensured to be all for the same amount it's problem solved.

- Can you offer glyphs as a counter asset in a sale? Probably not because glyphs are auth required assets
  - Maybe glyph to glyph trades should bypass royalties
  - Along with this it would be cool to explore the ability to offer the same glyph many times but then cancel all pending once any one was accepted
- TEST // Can you offer colors? Probably as colors are unlocked assets

- TEST // What happens when you try and make an identical offer? Same user, same counterAsset, same amount.
  - Should fail
- TEST // What happens when the same user makes an identical counterAsset offer at a different price
  - Should succeed but the buy should take the higher offer without any escrow crossing

- ~~TODO // Do we need price amounts in the sponsor account since we're required to take the oldest highest price?~~

- TODO // Ensure when minting with sponsored colors that the number of different sponsors won't cause royalty payment issues further down the line (grow any single transaction past 100 ops)

- TODO // Can royalties be supported on unlocked assets?
  - Less locked? Pool accounts, enforced path payments, AMMs, etc.
  - Pending claimable balances as permissions keys
  - Access to CG credits that can be used to redeem for colors

--- NEW AFTER REFORMAT ---

DONE
- Possible for a Buy A with B and Buy B with A to cross without matching if occurring in same ledger
  - Due to the auth required nature of offers not being able to match without authorization (good thing)
  - Solution may just be offering again as pending offers will clear when matching
    - Or delete unmatched offer and offer again

DONE
- Why can't we send color royalties to the user? If we attach a marker in the user account I don't see a good reason this couldn't be the case
  - Glyph royalties are paid to user accounts, why not colors as well?
  - Because we only have 6 characters of asset to find the royalty account recipient address so it needs to be a derived address
    - Secondarily it would be hard to ensure your id was unique if it were a manage data attr as those currently aren't searchable on-chain via Horizon