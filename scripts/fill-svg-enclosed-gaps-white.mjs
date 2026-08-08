import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT_DIR = process.cwd();
const ASSETS_DIR = path.join(ROOT_DIR, "public", "assets");

async function getSvgFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return getSvgFiles(entryPath);
      }
      return entry.isFile() && entry.name.toLowerCase().endsWith(".svg")
        ? [entryPath]
        : [];
    })
  );

  return files.flat();
}

function fillEnclosedTransparentRegions(raw, width, height) {
  const channels = 4;
  const pixelCount = width * height;
  const outsideTransparent = new Uint8Array(pixelCount);
  const queue = [];

  const toIndex = (x, y) => y * width + x;
  const alphaAt = (pixelIndex) => raw[pixelIndex * channels + 3];

  const maybeQueueTransparent = (x, y) => {
    const pixelIndex = toIndex(x, y);
    if (outsideTransparent[pixelIndex] === 1) {
      return;
    }

    if (alphaAt(pixelIndex) === 0) {
      outsideTransparent[pixelIndex] = 1;
      queue.push(pixelIndex);
    }
  };

  for (let x = 0; x < width; x += 1) {
    maybeQueueTransparent(x, 0);
    maybeQueueTransparent(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    maybeQueueTransparent(0, y);
    maybeQueueTransparent(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const x = current % width;
    const y = Math.floor(current / width);

    if (x > 0) {
      maybeQueueTransparent(x - 1, y);
    }
    if (x < width - 1) {
      maybeQueueTransparent(x + 1, y);
    }
    if (y > 0) {
      maybeQueueTransparent(x, y - 1);
    }
    if (y < height - 1) {
      maybeQueueTransparent(x, y + 1);
    }
  }

  let enclosedPixelCount = 0;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (alphaAt(pixelIndex) === 0 && outsideTransparent[pixelIndex] === 0) {
      const offset = pixelIndex * channels;
      raw[offset] = 255;
      raw[offset + 1] = 255;
      raw[offset + 2] = 255;
      raw[offset + 3] = 255;
      enclosedPixelCount += 1;
    }
  }

  return enclosedPixelCount;
}

function buildEmbeddedSvg({ pngBase64, width, height, viewBox }) {
  const widthAttr = width ? ` width="${width}"` : "";
  const heightAttr = height ? ` height="${height}"` : "";
  const viewBoxAttr = viewBox ? ` viewBox="${viewBox}"` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"${widthAttr}${heightAttr}${viewBoxAttr}>\n  <image width="100%" height="100%" href="data:image/png;base64,${pngBase64}"/>\n</svg>\n`;
}

function parseSvgAttributes(svgSource) {
  const widthMatch = svgSource.match(/\bwidth\s*=\s*"([^"]+)"/i);
  const heightMatch = svgSource.match(/\bheight\s*=\s*"([^"]+)"/i);
  const viewBoxMatch = svgSource.match(/\bviewBox\s*=\s*"([^"]+)"/i);

  return {
    width: widthMatch?.[1] ?? "",
    height: heightMatch?.[1] ?? "",
    viewBox: viewBoxMatch?.[1] ?? "",
  };
}

async function processSvgFile(svgPath) {
  const svgSource = await fs.readFile(svgPath, "utf8");
  const parsedAttrs = parseSvgAttributes(svgSource);

  const rendered = await sharp(Buffer.from(svgSource), { density: 72 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = Buffer.from(rendered.data);
  const width = rendered.info.width;
  const height = rendered.info.height;

  const enclosedPixelCount = fillEnclosedTransparentRegions(raw, width, height);
  if (enclosedPixelCount === 0) {
    return { changed: false, enclosedPixelCount: 0 };
  }

  const png = await sharp(raw, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  const outSvg = buildEmbeddedSvg({
    pngBase64: png.toString("base64"),
    width: parsedAttrs.width,
    height: parsedAttrs.height,
    viewBox: parsedAttrs.viewBox,
  });

  await fs.writeFile(svgPath, outSvg, "utf8");

  return { changed: true, enclosedPixelCount };
}

async function main() {
  const svgFiles = await getSvgFiles(ASSETS_DIR);

  if (svgFiles.length === 0) {
    console.log(`No SVG files found in ${ASSETS_DIR}`);
    return;
  }

  let changedCount = 0;
  let changedPixels = 0;

  for (const svgFile of svgFiles) {
    const result = await processSvgFile(svgFile);
    if (result.changed) {
      changedCount += 1;
      changedPixels += result.enclosedPixelCount;
      console.log(`Updated ${path.relative(ROOT_DIR, svgFile)} (${result.enclosedPixelCount} px)`);
    } else {
      console.log(`No enclosed gaps in ${path.relative(ROOT_DIR, svgFile)}`);
    }
  }

  console.log(`\nDone. Updated ${changedCount}/${svgFiles.length} files. Filled ${changedPixels} enclosed pixels.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
