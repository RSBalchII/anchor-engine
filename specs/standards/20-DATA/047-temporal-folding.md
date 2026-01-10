# Standard 047: Temporal Folding
**Status:** Active | **Category:** DATA

## The Rule
1. **Immutable History:** We do not overwrite memories. We stack them. Every save creates a new node linked by `source`.
2. **The Fold:** During retrieval, if multiple memories share the same `source` (file path):
    - **The Head (Latest):** Is fully rendered with the "Elastic Window" method.
    - **The Tail (History):** Is compressed into a metadata block (Timestamps + IDs only).
3. **Token Economy:** Never output full text for superseded versions unless explicitly requested with `deep: true`.