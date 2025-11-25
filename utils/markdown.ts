import { MarkdownSegment } from '../types';

declare var marked: any;

/**
 * Renders paragraph content using the 'marked' library to ensure
 * all markdown features (lists, bold, italics, headings) are correctly converted to HTML.
 * @param paragraphContent The raw markdown string.
 * @returns An HTML string.
 */
export function renderParagraph(paragraphContent: string): string {
    if (typeof marked !== 'undefined') {
        // Configure marked if needed, or just use default
        return marked.parse(paragraphContent);
    }
    // Fallback if marked is not loaded (should not happen given index.html)
    return `<p>${paragraphContent}</p>`;
}

/**
 * (Optional) Helper to split code blocks if needed for custom components.
 * For simple rendering, marked handles code blocks too, but our MessageBubble 
 * might want to use the fancy CodeBlock component.
 */
export function parseMarkdown(markdownText: string): MarkdownSegment[] {
    if (!markdownText) return [];
    // ... (Existing implementation if needed for mixed content logic)
    return [{ type: 'paragraph', content: markdownText }];
}