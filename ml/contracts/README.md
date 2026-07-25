# Core ↔ ML contract fixtures (BE-2.7)

Single source of truth for the shape of every ML Service endpoint
(`docs/analysis/10-integrations-api.md` §2.4). Each JSON file pins a canonical
**request** and **response** for one endpoint.

Both sides validate against these same files, so a rename or type change on
either side breaks a test:

- **ML side** — `ml/tests/test_contract.py` drives each endpoint via FastAPI
  `TestClient` and asserts the live response has exactly the fixture's keys and
  types (the ML encoder cannot drift from the contract).
- **Core side** — `api/src/lib/ml-client.contract.test.ts` feeds the fixture
  response through a mocked `fetch` and asserts the `ml-client` decoder maps
  every field (the Core decoder cannot drift from the contract).

The contract is the set of **keys and types**, not the exact numbers — labels,
scores and prices depend on the trained model, so the tests assert shape and
value-domain (e.g. `label ∈ {GREAT_DEAL, FAIR_PRICE, OVERPRICED, UNAVAILABLE}`),
never equality with the example values.

| Fixture | Endpoint | Core decoder |
|---------|----------|--------------|
| `deal-rating.json` | `POST /v1/deal-rating` | `mlDealRating` (pass-through) |
| `fraud-check.json` | `POST /v1/fraud-check` | `mlFraudCheck` (snake→camel) |
| `blur.json` | `POST /v1/blur` | `mlBlur` (snake→camel, b64→Buffer) |
