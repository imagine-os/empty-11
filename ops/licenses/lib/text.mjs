/**
 * Detect the licence a package's LICENSE file actually contains (PAP-211).
 *
 * The policy's text-over-field rule says the FILE wins when it disagrees with
 * the `license` field, because the field is a manifest claim and the file is the
 * grant. Two deliberate limits keep this useful instead of noisy:
 *
 *   1. A signature is a phrase that appears verbatim in the canonical text, with
 *      optional "and not this other phrase" clauses to separate texts that share
 *      an opening sentence (0BSD and ISC differ only by the copyright proviso).
 *      Anything that does not match returns `null`, which flags nothing.
 *   2. Only the first few thousand characters are read. Many packages append the
 *      licences of everything they bundle to their own LICENSE file; the grant
 *      that matters is the one at the top.
 *
 * The consumer (lib/classify.mjs) only raises a finding when the detected text
 * lands in a DIFFERENT TIER than the declared field. A package calling its 0BSD
 * text "ISC" is not a licence problem; a package calling its AGPL text "MIT" is.
 */

const HEAD_CHARS = 4000;

/** `[spdxId, mustContain[], mustNotContain[]]`, first match wins. */
const SIGNATURES = [
  ['AGPL-3.0-or-later', ['GNU AFFERO GENERAL PUBLIC LICENSE', 'Version 3'], []],
  ['LGPL-3.0-or-later', ['GNU LESSER GENERAL PUBLIC LICENSE', 'Version 3'], []],
  ['LGPL-2.1-or-later', ['GNU LESSER GENERAL PUBLIC LICENSE', 'Version 2.1'], []],
  ['GPL-3.0-or-later', ['GNU GENERAL PUBLIC LICENSE', 'Version 3'], []],
  ['GPL-2.0-or-later', ['GNU GENERAL PUBLIC LICENSE', 'Version 2'], []],
  ['SSPL-1.0', ['Server Side Public License'], []],
  ['BUSL-1.1', ['Business Source License 1.1'], []],
  ['Elastic-2.0', ['Elastic License 2.0'], []],
  ['MPL-2.0', ['Mozilla Public License Version 2.0'], []],
  ['Apache-2.0', ['Apache License', 'Version 2.0'], []],
  ['BlueOak-1.0.0', ['Blue Oak Model License'], []],
  ['Unlicense', ['free and unencumbered software released into the public domain'], []],
  ['CC0-1.0', ['CC0 1.0 Universal'], []],
  ['OFL-1.1', ['SIL OPEN FONT LICENSE'], []],
  ['CC-BY-4.0', ['Creative Commons Attribution 4.0'], []],
  ['WTFPL', ['DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE'], []],
  [
    '0BSD',
    ['Permission to use, copy, modify, and/or distribute this software for any purpose'],
    ['provided that the above copyright notice'],
  ],
  [
    'ISC',
    [
      'Permission to use, copy, modify, and/or distribute this software',
      'provided that the above copyright notice',
    ],
    [],
  ],
  ['BSD-3-Clause', ['Redistributions of source code', 'Neither the name of'], []],
  ['BSD-2-Clause', ['Redistributions of source code'], []],
  ['MIT', ['Permission is hereby granted, free of charge'], []],
];

const COMMONS_CLAUSE = 'Commons Clause';

/** Best-effort SPDX id for a licence text. `null` when nothing matches. */
export function detectLicenseFromText(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const haystack = text.slice(0, HEAD_CHARS).replace(/\s+/g, ' ').toLowerCase();
  const has = (needle) => haystack.includes(needle.toLowerCase());
  let base = null;
  for (const [id, needles, forbidden] of SIGNATURES) {
    if (needles.every(has) && !forbidden.some(has)) {
      base = id;
      break;
    }
  }
  if (base === null) return null;
  if (has(COMMONS_CLAUSE)) return `${base} WITH Commons-Clause`;
  return base;
}
