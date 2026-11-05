/**
 * Escapes special characters from user input for safe RegExp querying in MongoDB,
 * preventing ReDoS attacks and regex injection.
 */
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
