// Runs every <PyRunner> example under the same Pyodide version the site loads, so runnable code is
// proven to run and its assertions to hold (decision 0009). Downloads NumPy/SciPy wheels on first use,
// so it runs in CI and on demand (`npm run check:code`), not before every local build.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';

const DOCS_DIR = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const PYRUNNER_CODE = /<PyRunner[\s\S]*?code=\{`([\s\S]*?)`\}/g;

async function mdxFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => (entry.isDirectory() ? mdxFiles(join(directory, entry.name)) : entry.name.endsWith('.mdx') ? [join(directory, entry.name)] : [])),
	);
	return files.flat();
}

/** Import name -> Pyodide package name ("sklearn" -> "scikit-learn"), from the lockfile loadPackagesFromImports reads. */
function packageNamesByImport(pyodide) {
	const names = new Map();
	for (const entry of Object.values(pyodide.lockfile.packages)) {
		for (const importName of entry.imports) names.set(importName, entry.name);
	}
	return names;
}

/** The Pyodide packages `code` imports; the standard library and unknown modules are skipped, as loadPackagesFromImports does. */
function packagesImportedBy(code, findImports, packageNames) {
	const found = findImports(code);
	try {
		return [...new Set(found.toJs().filter((name) => packageNames.has(name)).map((name) => packageNames.get(name)))];
	} finally {
		found.destroy();
	}
}

/**
 * Loads each package explicitly and fails loudly. loadPackage only logs a failed download, so on a cold cache the
 * example would die later on a bare ModuleNotFoundError; this names the page and the package instead.
 */
async function loadPackagesFor(pyodide, packages, label) {
	if (packages.length === 0) return;
	const errors = [];
	await pyodide.loadPackage(packages, { messageCallback: () => undefined, errorCallback: (message) => errors.push(message) });
	const missing = packages.filter((name) => !(name in pyodide.loadedPackages));
	if (missing.length > 0 || errors.length > 0) {
		const detail = errors.length > 0 ? ` ${errors.join(' ')}` : '';
		throw new Error(`${label} imports ${packages.join(', ')}, but Pyodide could not load ${missing.length > 0 ? missing.join(', ') : 'them cleanly'}.${detail}`);
	}
}

async function main() {
	const examples = [];
	for (const file of await mdxFiles(DOCS_DIR)) {
		const source = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
		for (const match of source.matchAll(PYRUNNER_CODE)) {
			examples.push({ page: relative(DOCS_DIR, file).replace(/\\/g, '/'), code: match[1] });
		}
	}
	if (examples.length === 0) {
		console.log('Code check: no PyRunner examples found.');
		return;
	}

	const pyodide = await loadPyodide();
	const packageNames = packageNamesByImport(pyodide);
	const findImports = pyodide.pyimport('pyodide.code').find_imports;
	const failures = [];
	for (const [index, example] of examples.entries()) {
		const label = `${example.page} (example ${index + 1})`;
		try {
			await loadPackagesFor(pyodide, packagesImportedBy(example.code, findImports, packageNames), label);
			// Each example runs in a fresh namespace so one page can't leak variables into the next.
			const namespace = pyodide.globals.get('dict')();
			await pyodide.runPythonAsync(example.code, { globals: namespace });
			namespace.destroy();
			console.log(`  ok    ${label}`);
		} catch (error) {
			failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
			console.error(`  FAIL  ${label}`);
		}
	}
	if (failures.length > 0) {
		console.error(`Code check failed for ${failures.length} of ${examples.length} example(s):`);
		for (const failure of failures) console.error(`  - ${failure}`);
		process.exit(1);
	}
	console.log(`Code check passed: ${examples.length} runnable example(s).`);
}

main().catch((error) => {
	console.error('Code check crashed:', error);
	process.exit(1);
});
