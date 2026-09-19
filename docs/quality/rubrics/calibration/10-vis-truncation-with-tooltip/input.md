# Case 10: intentional truncation

Gate 3 screenshot `reports/visual/crm-contacts/md-768-dark.png` shows the company column truncated with an ellipsis for three of ten rows. `dom-metrics.json`:

```json
{ "shot": "crm-contacts/md-768-dark", "scrollWidth": 768, "clientWidth": 768, "ellipsis": [{ "sel": "td.company", "title": true, "tooltip": true }] }
```

The full company name is in the row's detail panel one click away.
