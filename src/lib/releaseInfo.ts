import changelogRaw from "../assets/changelog.md?raw";
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

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function parseChangelog(raw: string, limit = 3): ReleaseNoteEntry[] {
  const entries: ReleaseNoteEntry[] = [];
  const lines = normalizeLineEndings(raw).split("\n");

  let currentHeader: string | null = null;
  let currentBody: string[] = [];

  const commitCurrent = () => {
    if (!currentHeader) {
      return;
    }
    const { version, date } = extractHeaderInfo(currentHeader);
    if (!version) {
      return;
    }

    entries.push({
      version,
      date,
      body: currentBody.join("\n").trim(),
    });
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeader) {
        commitCurrent();
        if (entries.length === limit) {
          return entries;
        }
      }
      currentHeader = line.slice(3).trim();
      currentBody = [];
      continue;
    }

    if (currentHeader) {
      currentBody.push(line);
    }
  }

  commitCurrent();

  return entries.slice(0, limit);
}

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
  const entries = parseChangelog(changelogRaw);

  return {
    version,
    entries,
  };
}
