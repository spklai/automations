import { exec } from './common/exec';

async function main() {
  console.log('Fetching repositories...');
  const repositories = await getRepositories();
  const repositoriesWithExtraManifests = repositories.filter(
    repo => repo.manifestCount > 1,
  );
  let cleanedUpCount = 0;
  for (const repository of repositoriesWithExtraManifests) {
    console.log(
      `Fetching unused manifests for repository ${repository.name}...`,
    );
    const manifests = await getUnusedManifestsForRepository(repository.name);
    for (const manifest of manifests) {
      if (manifest.digest === repository.latestManifestDigest) {
        continue;
      }
      console.log(
        `Deleting manifest ${manifest.digest} from repository ${repository.name}`,
      );
      await deleteManifest(repository.name, manifest.digest);
      cleanedUpCount++;
    }
  }
  if (cleanedUpCount > 0) {
    console.log('Starting layer garbage collection...');
    await startLayerGarbageCollection();
  }
  console.log(`Done. Cleaned up ${cleanedUpCount} manifests.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

interface Repository {
  name: string;
  latestManifestDigest: string;
  latestTag: string;
  tagCount: number;
  manifestCount: number;
  updatedAt: Date;
}

async function getRepositories(): Promise<Repository[]> {
  const out = await exec(`doctl registry repository list-v2`);
  return out
    .split('\n')
    .map(line => {
      const match = line.match(
        /^([a-z][a-zA-Z0-9\_\-]*)\s+(sha256:[a-z0-9]+)\s+([a-z][a-zA-Z0-9\_\-\.]+)\s+(\d+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\s[+\-]\d{4}\sUTC)$/,
      );
      if (!match) {
        return undefined;
      }
      const [
        ,
        name,
        latestManifestDigest,
        latestTag,
        tagCount,
        manifestCount,
        updatedAt,
      ] = match;
      return {
        name,
        latestManifestDigest,
        latestTag,
        tagCount: parseInt(tagCount, 10),
        manifestCount: parseInt(manifestCount, 10),
        updatedAt: new Date(updatedAt),
      };
    })
    .filter(item => !!item) as Repository[];
}

interface UnusedManifest {
  digest: string;
  compressedSize: string;
  uncompressedSize: string;
  updatedAt: Date;
}

async function getUnusedManifestsForRepository(
  repository: string,
): Promise<UnusedManifest[]> {
  const out = await exec(
    `doctl registry repository list-manifests "${repository}"`,
  );
  return out
    .split('\n')
    .map(line => {
      const match = line.match(
        /^(sha256:[a-z0-9]+)\s+([\d,]+(\.\d+)\s(GB|MB|TB))\s+([\d,]+(\.\d+)\s(GB|MB|TB))\s+(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\s[+\-]\d{4}\sUTC)\s+(\[\])$/,
      );
      if (!match) {
        return undefined;
      }
      return {
        digest: match[1],
        compressedSize: match[2],
        uncompressedSize: match[5],
        updatedAt: new Date(match[8]),
      };
    })
    .filter(item => !!item) as UnusedManifest[];
}

async function deleteManifest(
  repository: string,
  digest: string,
): Promise<void> {
  await exec(
    `doctl registry repository delete-manifest "${repository}" "${digest}" --force`,
  );
}

async function startLayerGarbageCollection(): Promise<void> {
  await exec(`doctl registry garbage-collection start --force`);
}
