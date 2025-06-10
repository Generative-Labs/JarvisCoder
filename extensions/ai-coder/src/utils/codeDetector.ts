import hljs from 'highlight.js';

interface CodeDetectionResult {
  isCode: boolean;
  language?: string;
}

// language keywords mapping
const codeKeywords = {
  // general programming languages
  javascript: ['function', 'const', 'let', 'var', 'import', 'export', 'class', 'async', 'await'],
  typescript: ['interface', 'type', 'enum', 'namespace', 'module'],
  python: ['def', 'class', 'import', 'from', 'async', 'await', 'async def'],
  java: ['public', 'private', 'protected', 'class', 'interface', 'enum', 'package', 'import'],
  cpp: ['#include', 'class', 'struct', 'namespace', 'template', 'using'],
  rust: ['fn', 'struct', 'enum', 'impl', 'trait', 'use', 'mod', 'pub', 'async'],
  go: ['func', 'type', 'struct', 'interface', 'package', 'import'],
  php: ['<?php', 'function', 'class', 'namespace', 'use', 'public', 'private'],
  ruby: ['def', 'class', 'module', 'require', 'include'],
  swift: ['func', 'class', 'struct', 'enum', 'protocol', 'import'],
  kotlin: ['fun', 'class', 'interface', 'object', 'package', 'import'],

  // config files
  yaml: ['---', 'version:', 'services:', 'environment:', 'config:'],
  json: ['{', '[', '"version":', '"config":', '"dependencies":'],
  xml: ['<?xml', '<project', '<config', '<settings', '<dependencies'],
  toml: ['[package]', '[dependencies]', '[config]', 'version ='],
  env: ['DB_', 'API_', 'PORT=', 'HOST=', 'ENV='],

  // database
  sql: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER'],

  // blockchain
  solidity: ['pragma solidity', 'contract', 'function', 'struct', 'mapping', 'event'],

  // other
  docker: ['FROM', 'RUN', 'CMD', 'ENTRYPOINT', 'ENV', 'COPY'],
  shell: ['#!/bin', 'export', 'alias', 'function', 'if [', 'for'],
  markdown: ['# ', '## ', '```', '---', '> '],
  html: ['<!DOCTYPE', '<html', '<head', '<body', '<div', '<script'],
  css: ['@import', '@media', '@keyframes', '.', '#', '{'],
};

// code patterns
const codePatterns = {
  // generic code patterns
  generic: [
    /[{}[\];=<>]/g, // code symbols
    /(function|class|interface)\s+\w+/, // function/class definition
    /(const|let|var)\s+\w+\s*=/, // variable declaration
    /(if|for|while)\s*\(/, // control structure
    /(public|private|protected)\s+\w+/, // access modifier
    /(async|await)\s+\w+/, // async code
    /(import|export)\s+/, // module import/export
  ],
  // config file patterns
  config: [
    /^[A-Z_]+=/, // environment variable
    /^[a-z-]+:/, // YAML key-value pair
    /^\[[a-z-]+\]/, // TOML section
    /^<[a-z-]+>/, // XML tag
  ],
  // database patterns
  database: [/^SELECT\s+.+FROM/i, /^INSERT\s+INTO/i, /^CREATE\s+TABLE/i, /^ALTER\s+TABLE/i],
  // blockchain patterns
  blockchain: [/^contract\s+\w+/, /^function\s+\w+/, /^event\s+\w+/, /^mapping\s*\(/],
};

// file extension mapping
const fileExtensions = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.json': 'json',
  '.xml': 'xml',
  '.toml': 'toml',
  '.env': 'env',
  '.sql': 'sql',
  '.sol': 'solidity',
  '.dockerfile': 'docker',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.bat': 'bat',
  '.cmd': 'bat',
  '.ps1': 'powershell',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.vue': 'vue',
  '.coffee': 'coffeescript',
  '.lua': 'lua',
  '.scala': 'scala',
  '.vb': 'vb',
  '.vbs': 'vbscript',
  '.f90': 'fortran',
  '.f95': 'fortran',
  '.f03': 'fortran',
  '.f08': 'fortran',
  '.fs': 'fsharp',
  '.fsx': 'fsharp',
  '.elm': 'elm',
  '.clj': 'clojure',
  '.cljs': 'clojure',
  '.edn': 'clojure',
  '.erl': 'erlang',
  '.hrl': 'erlang',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.dart': 'dart',
  '.m': 'objective-c',
  '.mm': 'objective-cpp',
  '.pl': 'perl',
  '.pm': 'perl',
  '.r': 'r',
  '.jl': 'julia',
  '.groovy': 'groovy',
  '.makefile': 'makefile',
  '.mk': 'makefile',
  '.cmake': 'cmake',
  '.bazel': 'bazel',
  '.build': 'bazel',
  '.gradle': 'gradle',
  '.nim': 'nim',
  '.zig': 'zig',
  '.vala': 'vala',
  '.q': 'q',
  '.qml': 'qml',
  '.tex': 'latex',
  '.bib': 'bibtex',
  '.rst': 'restructuredtext',
  '.adoc': 'asciidoc',
  '.asciidoc': 'asciidoc',
  '.haml': 'haml',
  '.slim': 'slim',
  '.pug': 'pug',
  '.jade': 'pug',
  '.mustache': 'mustache',
  '.handlebars': 'handlebars',
  '.hbs': 'handlebars',
  '.ejs': 'ejs',
  '.twig': 'twig',
  '.liquid': 'liquid',
  '.jinja': 'jinja',
  '.j2': 'jinja',
  '.njk': 'nunjucks',
  '.nunjucks': 'nunjucks',
  '.smarty': 'smarty',
  '.tpl': 'smarty',
  '.dot': 'dot',
  '.csv': 'csv',
  '.tsv': 'tsv',
  '.log': 'log',
  '.out': 'out',
  '.dat': 'dat',
  '.sav': 'sav',
  '.dta': 'dta',
  '.arff': 'arff',
  '.orc': 'orc',
  '.parquet': 'parquet',
  '.avro': 'avro',
  '.feather': 'feather',
  '.hdf5': 'hdf5',
  '.h5': 'hdf5',
  '.nc': 'netcdf',
  '.grib': 'grib',
  '.grb': 'grib',
  '.fits': 'fits',
  '.root': 'root',
  '.mat': 'matlab',
  '.npz': 'numpy',
  '.pkl': 'pickle',
  '.joblib': 'joblib',
  '.rds': 'rds',
  '.rda': 'rdata',
  '.rdata': 'rdata',
  '.sas7bdat': 'sas',
  '.xpt': 'sas',
  '.por': 'spss',
  '.sd2': 'sas',
  '.ini': 'ini',
  '.conf': 'conf',
  '.cfg': 'conf',
  '.properties': 'properties',
  '.asp': 'asp',
  '.aspx': 'aspx',
  '.jsp': 'jsp',
};

/**
 * Detect if the text is a code block
 * @param {string} text - The text to detect
 * @returns {CodeDetectionResult} The detection result, including whether it is code and the possible language
 */
export const detectCodeBlock = (text: string): CodeDetectionResult => {
  // 1. check if the text already contains ``` mark
  if (text.includes('```')) {
    return { isCode: true };
  }

  const lines = text.split('\n');
  let isCode = false;
  let detectedLanguage: string | undefined;

  // 2. iterate each line to detect
  for (const line of lines) {
    // remove the leading indent and spaces
    const trimmedLine = line.trimStart();

    // skip the empty line
    if (!trimmedLine) {
      continue;
    }

    // check if the line starts with any code keywords
    for (const [lang, keywords] of Object.entries(codeKeywords)) {
      if (keywords.some((keyword) => trimmedLine.startsWith(keyword))) {
        isCode = true;
        detectedLanguage = lang;
        break;
      }
    }

    // if the language is detected, break the loop
    if (isCode) {
      break;
    }

    // check if the line contains code features
    for (const patterns of Object.values(codePatterns)) {
      if (patterns.some((pattern) => pattern.test(trimmedLine))) {
        isCode = true;
        break;
      }
    }

    // if the code is detected, continue to check other lines to find the language
    if (isCode) {
      continue;
    }
  }

  // 3. if the code is detected but no language, use highlight.js to detect the language
  if (isCode && !detectedLanguage) {
    const { language } = hljs.highlightAuto(text);
    if (language) {
      detectedLanguage = language;
    }
  }

  // 4. check the file extension (if the text contains the file name)
  if (!detectedLanguage) {
    for (const [ext, lang] of Object.entries(fileExtensions)) {
      if (text.includes(ext)) {
        isCode = true;
        detectedLanguage = lang;
        break;
      }
    }
  }

  return {
    isCode,
    language: detectedLanguage,
  };
};

/**
 * Detect the language by the file path
 * @param {string} filePath - The file path
 * @returns {string} The language
 */
export function detectLanguageByFilePath(filePath: string): string {
  const match = /\.[^.\/\\]+$/.exec(filePath);
  if (match) {
    const ext = match[0].toLowerCase();
    if (fileExtensions[ext as keyof typeof fileExtensions]) {
      return fileExtensions[ext as keyof typeof fileExtensions];
    }
  }
  return '';
}
