/**
 * Turn pnpm's output into the package inventory the policy is applied to (PAP-211).
 *
 * Three inputs, all pnpm JSON, so nothing here guesses at a lockfile format:
 *   `pnpm licenses list --json`          every installed package and its licence
 *   `pnpm licenses list --json --prod`   the production subset
 *   `pnpm ls -r --depth Infinity --json --prod`   who reaches what, per project
 *
 * Context derivation is the whole point. A package is `dev` only when nothing
 * shippable reaches it; the moment a GPL CLI moves from `devDependencies` to
 * `dependencies` of an app, its tree walk puts it in `bundled` and the tier
 * changes under it. That is the edge case the policy exists for.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { detectLicenseFromText } from './text.mjs';

const list = (value) => (Array.isArray(value) ? value : []);
const key = (name, version) => `${name}@${version}`;

/** Every external package in one `pnpm ls` tree, walking through workspace links. */
export function walkTree(node, seen = new Set(), out = new Map()) {
  for (const [name, entry] of Object.entries(node?.dependencies ?? {})) {
    const version = String(entry?.version ?? '');
    const id = `${name}@${version}@${entry?.path ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!version.startsWith('link:'))
      out.set(key(name, version), { name, version, path: entry?.path });
    walkTree(entry, seen, out);
  }
  return out;
}

/** Which policy context a workspace project belongs to, by path prefix. */
export function contextOfProject(policy, projectPath) {
  const normalized = projectPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  for (const [context, definition] of Object.entries(policy.contexts ?? {})) {
    for (const prefix of list(definition.projects)) {
      if (
        normalized === prefix ||
        normalized.startsWith(`${prefix}/`) ||
        normalized.endsWith(`/${prefix}`) ||
        normalized.includes(`/${prefix}/`)
      ) {
        return context;
      }
    }
  }
  return null;
}

/** Flatten `pnpm licenses list --json` into `name@version -> licence string`. */
export function flattenLicenses(licensesJson) {
  const out = new Map();
  for (const [license, entries] of Object.entries(licensesJson ?? {})) {
    for (const entry of list(entries)) {
      for (const version of list(entry.versions)) {
        out.set(key(entry.name, version), {
          name: entry.name,
          version,
          license: entry.license ?? license,
          reportedGroup: license,
          paths: list(entry.paths),
          homepage: entry.homepage ?? null,
          author: entry.author ?? null,
          description: entry.description ?? null,
        });
      }
    }
  }
  return out;
}

/** The LICENSE-ish file text shipped inside an installed package, if any. */
export function readLicenseText(packagePath) {
  if (!packagePath) return null;
  let names = [];
  try {
    names = readdirSync(packagePath);
  } catch {
    return null;
  }
  const candidate = names.find((name) => /^(licen[cs]e|copying)(\.|$)/i.test(name));
  if (!candidate) return null;
  try {
    return readFileSync(join(packagePath, candidate), 'utf8').slice(0, 8000);
  } catch {
    return null;
  }
}

/**
 * Build the inventory: one row per `name@version`, with every context that
 * reaches it. `servicePackages` from the policy are layered on by hand — a
 * service is a product we run, not something a lockfile can tell us about.
 */
export function buildInventory({
  policy,
  root,
  licensesAll,
  licensesProd,
  lsProd,
  readText = readLicenseText,
}) {
  const all = flattenLicenses(licensesAll);
  const prod = flattenLicenses(licensesProd);
  const contexts = new Map();

  for (const project of list(lsProd)) {
    if (!project?.path) continue;
    // An absolute path is used when the project sits outside `root` (captured
    // pnpm JSON replayed through `--input`); `contextOfProject` matches either.
    const relativePath = relative(root, project.path) || '.';
    const context = contextOfProject(
      policy,
      relativePath.startsWith('..') ? project.path : relativePath,
    );
    if (!context) continue;
    for (const [id] of walkTree(project)) {
      if (!contexts.has(id)) contexts.set(id, new Set());
      contexts.get(id).add(context);
    }
  }

  const unreached = policy.unreachedProdContext ?? 'bundled';
  for (const id of prod.keys()) {
    if (!contexts.has(id)) contexts.set(id, new Set([unreached]));
  }

  const servicePackages = new Set(
    list(policy.servicePackages).map((entry) => entry.package ?? entry),
  );
  // Our own workspace packages are never third parties: they carry the repo's
  // licence, which is NJ-7's question, not this gate's (policy section 9).
  const workspaceNames = new Set(
    policy.skipPrivateWorkspacePackages === false
      ? []
      : list(lsProd)
          .filter((project) => project?.private !== false && project?.name)
          .map((project) => project.name),
  );

  const rows = [];
  for (const [id, entry] of all) {
    if (workspaceNames.has(entry.name)) continue;
    const found = contexts.get(id);
    const packageContexts = found ? [...found] : ['dev'];
    if (servicePackages.has(entry.name)) packageContexts.push('service');
    const declared = entry.license;
    const text = readText(entry.paths[0]);
    const detected = text ? detectLicenseFromText(text) : null;
    rows.push({
      package: entry.name,
      version: entry.version,
      declared,
      detected,
      contexts: packageContexts,
      paths: entry.paths,
      homepage: entry.homepage,
      author: entry.author,
      description: entry.description,
      production: prod.has(id),
    });
  }
  rows.sort((a, b) =>
    a.package === b.package
      ? a.version.localeCompare(b.version)
      : a.package.localeCompare(b.package),
  );
  return rows;
}
