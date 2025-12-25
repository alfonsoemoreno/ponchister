import changelogRaw from "../../CHANGELOG.md?raw";
import packageJson from "../../package.json" assert { type: "json" };

type PackageJson = {
  version?: string;
};

export interface ReleaseNoteEntry {
  version: string;
  date?: string;
  body: string;
}

export interface ReleaseInfo {
  version: string;
  entries: ReleaseNoteEntry[];
}

function parseChangelog(raw: string, limit = 3): ReleaseNoteEntry[] {
  const entries: ReleaseNoteEntry[] = [];
  const entryRegex = /^##\s+(.+?)\n([\s\S]*?)(?=^##\s|Z)/gm;

  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(raw)) !== null) {
    const header = match[1].trim();
    const body = match[2].trim();
    const { version, date } = extractHeaderInfo(header);

    if (!version) {
      continue;
    }

    entries.push({
      version,
      date,
      body,
    });

    if (entries.length === limit) {
      break;
    }
  }

  return entries;
}

const changeLogCache = parseChangelog(changelogRaw);

function extractHeaderInfo(header: string): {
  version: string | null;
  date?: string;
} {
  const headerRegex =
    /^(?:\[(?<versionLink>[^\]]+)\]|(?<versionPlain>\S+))(?:[^]*?\((?<date>[^)]+)\))?/;
  const match = headerRegex.exec(header);

  if (!match?.groups) {
    return { version: null };
  }

  const version = match.groups.versionLink ?? match.groups.versionPlain ?? null;
  const date = match.groups.date?.trim();

  return { version, date };
}

export function getReleaseInfo(): ReleaseInfo {
  const version = (packageJson as PackageJson).version ?? "0.0.0";

  return {
    version,
    entries: changeLogCache,
  };
}
