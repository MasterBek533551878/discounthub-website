"""Copy tracked website assets to a fresh directory for Cloudflare Pages.

Print only the output path so PowerShell can capture it in $pagesDir.
Requires Python 3.10+ and Git. Existing build directories are never overwritten.
"""
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {
    "index.html", "contact.html", "privacy.html", "terms.html", "favicon.ico",
    "ph-launch.css", "robots.txt", "script.js", "sitemap.xml", "styles.css",
    "webmcp.js",
}
WEB_DIRECTORIES = {
    "ai", "assets", "best-tech-deals", "deals", "partner-offers",
    "promo-codes", "public", "stores",
}
ASSET_EXTENSIONS = {
    ".html", ".css", ".js", ".json", ".xml", ".png", ".jpg", ".jpeg",
    ".svg", ".webp", ".avif", ".gif", ".ico", ".woff", ".woff2",
    ".ttf", ".otf", ".webmanifest",
}


def build() -> Path:
    tracked = subprocess.check_output(
        ["git", "-C", str(ROOT), "ls-files", "-z"],
    ).decode("utf-8").split("\0")
    selected = []
    for name in filter(None, tracked):
        relative = PurePosixPath(name)
        if name not in ROOT_FILES and not (
            relative.parts[0] in WEB_DIRECTORIES
            and relative.suffix.lower() in ASSET_EXTENSIONS
        ):
            continue
        source = ROOT / relative
        if not source.is_file() or not source.resolve().is_relative_to(ROOT):
            raise RuntimeError(f"Missing or external website asset: {name}")
        selected.append(name)
    required = ROOT_FILES | {"deals/index.html", "promo-codes/index.html", "ai/index.html"}
    missing = required.difference(selected)
    if missing:
        raise RuntimeError(f"Required website assets are not tracked: {sorted(missing)}")

    build_root = ROOT / "dist"
    build_root.mkdir(exist_ok=True)
    output = Path(tempfile.mkdtemp(prefix="pages-", dir=build_root))
    for name in selected:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    return output


if __name__ == "__main__":
    print(build())
