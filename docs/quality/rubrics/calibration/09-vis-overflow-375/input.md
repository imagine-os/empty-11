# Case 09: horizontal overflow at phone width

Gate 3 screenshot `reports/visual/settings-billing/sm-390-light.png` and `reports/dom-metrics.json` entry:

```json
{ "shot": "settings-billing/sm-390-light", "scrollWidth": 468, "clientWidth": 390, "ellipsis": [], "outside": ["#plan-table"] }
```

The plan comparison table has four fixed 120 px columns. At 768 px and above no overflow. Dark theme identical.
