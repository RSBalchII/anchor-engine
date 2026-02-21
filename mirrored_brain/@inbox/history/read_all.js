/**
 * Universal Context Aggregation Tool
 *
 * This script recursively scans all text files in a project root,
 * aggregates their content into a single YAML file with configurable limits.
 * Designed to work in any codebase from the root directory.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Configuration options
const CONFIG = {
  // Token limits
  tokenLimit: 50000000, // 50M tokens - increased to ensure full coverage
  maxFileSize: 10 * 1024 * 1024, // 10MB max per file
  maxLinesPerFile: 10000, // 10k lines per file

  // Output options
  outputDir: 'codebase',
  outputFile: 'combined_context.yaml',

  // File inclusion - Empty list implies "include all except excluded"
  includeExtensions: [],
  /*
      // Code files
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs',
      '.go', '.rs', '.rb', '.php', '.html', '.css', '.scss', '.sass', '.less',
      '.json', '.yaml', '.yml', '.xml', '.sql', '.sh', '.bash', '.zsh',
      '.md', '.txt', '.csv', '.toml', '.ini', '.cfg', '.conf', '.env',
      '.dockerfile', 'dockerfile', '.gitignore', '.npmignore', '.prettierignore',
      // Configuration files
      'makefile', 'cmakelists.txt', 'readme.md', 'readme.txt', 'readme',
      'license', 'license.md', 'changelog', 'changelog.md', 'contributing',
      'contributing.md', 'code_of_conduct', 'code_of_conduct.md'
    ],
  */
  excludeExtensions: [
    // Binary files
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.exe', '.bin', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    // Build/cache files
    '.o', '.obj', '.a', '.lib', '.out', '.class', '.jar', '.war', '.swp', '.swo',
    '.lock', '.cache', '.log', '.tmp', '.temp', '.DS_Store', 'Thumbs.db',
    '.pyc', '.pyo', '.pyd'
  ],

  excludeDirectories: [
    '.git', 'node_modules', 'archive', 'backups', 'logs', 'context', '.vscode',
    '.idea', '.pytest_cache', '__pycache__', 'dist', 'build', 'target',
    'venv', 'env', '.venv', '.env', 'Pods', 'Carthage', 'CocoaPods',
    '.next', '.nuxt', 'public', 'static', 'assets', 'images', 'img', 'codebase', 'coverage'
  ],

  excludeFiles: [
    'combined_context.yaml', 'combined_context.json', 'combined_memory.yaml', 'combined_memory.json',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'Gemfile.lock', 'Pipfile.lock', 'Cargo.lock', 'composer.lock',
    'go.sum', 'go.mod', 'requirements.txt', 'poetry.lock',
    // Database files
    '*.db', '*.sqlite', '*.sqlite3', '*.fdb', '*.mdb', '*.accdb',
    // Temporary files
    '*~', '*.tmp', '*.temp', '*.cache', '*.swp', '*.swo'
  ]
};

// Simple token counting function
function countTokens(text) {
  // A rough approximation: 1 token ≈ 4 characters or 1 word
  const words = text.match(/\b\w+\b/g) || [];
  return words.length + Math.ceil(text.length / 4);
}

// Function to check if a file is explicitly binary by content
function isBinary(buffer) {
  // Check first 8000 bytes for null bytes
  const len = Math.min(buffer.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

// Function to check if a path should be ignored based on configuration
function shouldIgnore(filePath, rootDir) {
  const fileName = path.basename(filePath).toLowerCase();
  const dirName = path.dirname(filePath).split(path.sep).pop().toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  // Check if directory should be excluded
  for (const excludeDir of CONFIG.excludeDirectories) {
    if (dirName === excludeDir.toLowerCase()) {
      return true;
    }
  }

  // Check if file extension should be excluded
  if (CONFIG.excludeExtensions.includes(ext)) {
    return true;
  }

  // Check if file should be excluded by name patterns
  for (const excludePattern of CONFIG.excludeFiles) {
    if (matchesPattern(fileName, excludePattern.toLowerCase()) ||
      matchesPattern(path.basename(filePath), excludePattern)) {
      return true;
    }
  }

  // Check if file is too large
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > CONFIG.maxFileSize) {
      return true;
    }
  } catch (e) {
    // If we can't stat the file, skip it
    return true;
  }

  // Check if file extension should be included (if include list is specified)
  if (CONFIG.includeExtensions && CONFIG.includeExtensions.length > 0) {
    const fullName = path.basename(filePath).toLowerCase();
    if (!CONFIG.includeExtensions.includes(ext) && !CONFIG.includeExtensions.includes(fullName)) {
      return true;
    }
  }

  return false;
}

// Helper function to check if a filename matches a pattern (supports wildcards)
function matchesPattern(fileName, pattern) {
  if (pattern === fileName) return true;

  if (pattern.startsWith('*') && fileName.endsWith(pattern.substring(1))) {
    return true;
  }

  if (pattern.endsWith('*') && fileName.startsWith(pattern.substring(0, pattern.length - 1))) {
    return true;
  }

  return false;
}

// Function to limit file content based on line count
function limitFileContent(content) {
  if (!content) return '';

  const lines = content.split('\n');
  if (lines.length <= CONFIG.maxLinesPerFile) {
    return content;
  }

  // Take the first and last parts of the file to preserve context
  const header = lines.slice(0, CONFIG.maxLinesPerFile / 2).join('\n');
  const footer = lines.slice(-CONFIG.maxLinesPerFile / 2).join('\n');

  return `${header}\n\n... [CONTENT TRUNCATED - ${lines.length - CONFIG.maxLinesPerFile} LINES REMOVED] ...\n\n${footer}`;
}

// Function to aggregate all file contents from the project root
function createFullCorpusRecursive(rootDir = process.cwd()) {
  // Allow rootDir to be passed as command line argument
  if (process.argv[2] && process.argv[2] !== 'json' && process.argv[2] !== 'yaml') {
    rootDir = path.resolve(process.argv[2]);
  }

  const outputDir = path.join(rootDir, CONFIG.outputDir);
  console.log(`Scanning project root: ${rootDir}`);

  if (!fs.existsSync(outputDir)) {
    console.log(`Output directory does not exist, creating: ${outputDir}`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const aggregatedData = {
    project_structure: rootDir,
    scan_config: {
      tokenLimit: CONFIG.tokenLimit,
      maxFileSize: CONFIG.maxFileSize,
      maxLinesPerFile: CONFIG.maxLinesPerFile,
      includeExtensions: CONFIG.includeExtensions,
      excludeExtensions: CONFIG.excludeExtensions,
      excludeDirectories: CONFIG.excludeDirectories,
      excludeFiles: CONFIG.excludeFiles
    },
    files: []
  };

  let totalTokens = 0;

  // Walk through all files in the project
  function walkDirectory(currentPath) {
    let items;
    try {
      items = fs.readdirSync(currentPath);
    } catch (e) {
      console.warn(`Could not read directory: ${currentPath} - ${e.message}`);
      return;
    }

    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const relativePath = path.relative(rootDir, itemPath);

      let stat;
      try {
        stat = fs.statSync(itemPath);
      } catch (e) {
        continue;
      }

      if (stat.isDirectory()) {
        // Skip excluded directories
        const dirName = item.toLowerCase();
        if (CONFIG.excludeDirectories.some(exclude => dirName === exclude.toLowerCase())) {
          continue;
        }

        walkDirectory(itemPath);
      } else {
        // Check if file should be ignored
        if (shouldIgnore(itemPath, rootDir)) {
          continue;
        }

        try {
          // Read as buffer first to check for binary content
          const buffer = fs.readFileSync(itemPath);

          if (isBinary(buffer)) {
            // console.log(`Skipping binary file: ${relativePath}`);
            continue;
          }

          const rawContent = buffer.toString('utf8');
          const content = limitFileContent(rawContent);
          const fileTokens = countTokens(content);

          if (totalTokens + fileTokens > CONFIG.tokenLimit) {
            // console.log(`Token limit reached. Skipping: ${relativePath}`);
            continue;
          }

          const fileData = {
            path: relativePath,
            content: content,
            tokens: fileTokens,
            size: Buffer.byteLength(rawContent, 'utf8')
          };

          aggregatedData.files.push(fileData);
          totalTokens += fileTokens;
          // console.log(`Processed: ${relativePath} (${fileTokens} tokens)`);
        } catch (e) {
          console.warn(`Could not read file: ${itemPath} - ${e.message}`);
          // Skip non-text files or files with read errors
        }
      }
    }
  }

  walkDirectory(rootDir);

  aggregatedData.metadata = {
    total_files: aggregatedData.files.length,
    total_tokens: totalTokens,
    token_limit: CONFIG.tokenLimit,
    token_limit_reached: totalTokens >= CONFIG.tokenLimit,
    timestamp: new Date().toISOString(),
    root_directory: rootDir,
    config: CONFIG
  };

  // Write to YAML file in output directory
  const outputFile = path.join(outputDir, CONFIG.outputFile);
  const yamlContent = yaml.dump(aggregatedData, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });
  fs.writeFileSync(outputFile, yamlContent);

  console.error("Aggregation complete!");
  console.error(`Output file: ${outputFile}`);
  console.error(`Total files processed: ${aggregatedData.metadata.total_files}`);
  console.error(`Total tokens: ${aggregatedData.metadata.total_tokens}`);
  console.error(`Scan completed at: ${new Date().toISOString()}`);

  return aggregatedData;
}

// Alternative function to output JSON format
function createFullCorpusRecursiveJSON(rootDir = process.cwd()) {
  const result = createFullCorpusRecursive(rootDir);
  const outputDir = path.join(rootDir, CONFIG.outputDir);
  const outputFile = path.join(outputDir, CONFIG.outputFile.replace('.yaml', '.json'));

  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`JSON output also saved to: ${outputFile}`);

  return result;
}

module.exports = { CONFIG, createFullCorpusRecursive, createFullCorpusRecursiveJSON };

// Run if this file is executed directly
if (require.main === module) {
  console.error('Starting universal project aggregation...');

  // Allow format selection via command line argument
  const format = process.argv[3] || 'yaml';
  let rootDir = process.argv[2];

  // Check if first arg is format instead of dir
  if (rootDir === 'json' || rootDir === 'yaml') {
    rootDir = process.cwd();
  } else {
    rootDir = rootDir || process.cwd();
  }

  if (process.argv.includes('json') || format.toLowerCase() === 'json') {
    createFullCorpusRecursiveJSON(rootDir);
  } else {
    createFullCorpusRecursive(rootDir);
  }
}