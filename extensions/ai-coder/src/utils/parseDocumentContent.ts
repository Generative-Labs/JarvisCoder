/**
 * Parses document content to extract metadata and content sections
 * @param {string} text - The document content to parse, expected to contain metadata between '---' delimiters
 * @returns {Object} An object containing the parsed document parts
 * @property {string} title - The document title extracted from metadata
 * @property {string} date - The document date (ISO format), defaults to current date if not specified
 * @property {string[]} categories - Array of category strings
 * @property {string} content - The main content of the document (after metadata section)
 * @property {string} wholeText - The original input text
 *
 * @throws {Error} If the document format is invalid (missing metadata delimiters or title)
 *
 * @example
 * ```typescript
 * const doc = `---
 * title: "My Document"
 * date: 2023-01-01 12:00:00 +0000
 * categories: docs example
 * ---
 * Document content here`;
 * const parsed = parseDocumentContent(doc);
 * // Returns: { title: 'My Document', date: '2023-01-01T12:00:00.000Z', categories: ['docs', 'example'], content: 'Document content here', wholeText: '...' }
 * ```
 */
export function parseDocumentContent(text: string): {
  title: string;
  date: string;
  categories: string[];
  content: string;
  wholeText: string;
} {
  // Look for the frontmatter delimiters (---)
  const firstDelimiterIndex = text.indexOf("---");
  if (firstDelimiterIndex === -1) {
    throw new Error(
      "Invalid prompt format: Missing metadata section (should start with ---)"
    );
  }

  const secondDelimiterIndex = text.indexOf("---", firstDelimiterIndex + 3);
  if (secondDelimiterIndex === -1) {
    throw new Error(
      "Invalid prompt format: Missing metadata closing delimiter (---)"
    );
  }

  // Extract the metadata section between the two delimiters
  const metadataSection = text
    .substring(firstDelimiterIndex + 3, secondDelimiterIndex)
    .trim();

  // Parse the metadata format
  const titleMatch = metadataSection.match(/title:\s*"([^"]+)"/);
  const dateMatch = metadataSection.match(
    /date:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+\-]\d{4})/
  );
  const categoriesMatch = metadataSection.match(/categories:\s*(.+?)($|\n)/);

  if (!titleMatch) {
    throw new Error("Invalid metadata format: Missing required title field");
  }

  const title = titleMatch[1].trim();

  // Extract date (optional)
  const date = dateMatch ? dateMatch[1].trim() : new Date().toISOString();

  // Extract categories (optional) and split into array
  let categories: string[] = [];
  if (categoriesMatch) {
    categories = categoriesMatch[1].trim().split(/\s+/).filter(Boolean);
  }

  // Content is everything after the second delimiter
  const content = text.substring(secondDelimiterIndex + 3).trim();

  return { title, date, categories, content, wholeText: text };
}
