TEST 
- What happens when you try to sell the same glyph for the same asset and same amount?
  - Different amount?
- What happens when you try to buy the same glyph for the same asset and same amount?
  - Different amount?
- What happens when you try to buy it now at a lower sell price of the same counter asset?
- What happens when you try to sell it now at a lower sell price of the same counter asset?

NOTE
- Possible for a Buy A with B and Buy B with A to cross without matching if occurring in same ledger
  - Due to the auth required nature of offers not being able to match without authorization (good thing)
  - Solution may just be offering again as pending offers will clear when matching
    - Or delete unmatched offer and offer again
- Why can't we send color royalties to the user? If we attach a marker in the user account I don't see a good reason this couldn't be the case
  - Glyph royalties are paid to user accounts, why not colors as well?
  - Because we only have 6 characters of asset to find the royalty account recipient address so it needs to be a derived address
    - Secondarily it would be hard to ensure your id was unique if it were a manage data attr as those currently aren't searchable on-chain via Horizon